import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/User.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import Driver from "../models/Driver.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs"; // Import bcrypt for manual comparison

/* =========================
   GENERATE JWT TOKEN
========================= */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      linkedId: user.linkedId || null
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

const normalizePhoneDigits = (value = '') => String(value).replace(/\D/g, '');

const phonesEquivalent = (storedPhone, inputPhone) => {
  const storedDigits = normalizePhoneDigits(storedPhone);
  const inputDigits = normalizePhoneDigits(inputPhone);

  if (!storedDigits || !inputDigits) return false;
  if (storedDigits === inputDigits) return true;

  const storedLast10 = storedDigits.slice(-10);
  const inputLast10 = inputDigits.slice(-10);
  return storedLast10.length === 10 && inputLast10.length === 10 && storedLast10 === inputLast10;
};

/* =========================
   REGISTER
========================= */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({
      success: false,
      message: "All fields are required"
    });
  }

  // Validate role
  if (!["admin", "owner", "teacher", "parent", "cashier", "principal", "driver"].includes(role)) {
    return res.status(400).json({
      success: false,
      message: "Invalid role for registration"
    });
  }

  // Check for existing user
  const existingUser = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { username: email.toLowerCase() }]
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: "User already exists"
    });
  }

  // Create user (password will be auto-hashed by pre-save middleware)
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    username: email.toLowerCase().trim(),
    password: password,
    role: role.toLowerCase(),
    phone: phone || "",
    active: true,
    forcePasswordChange: role !== "admin" // Admin doesn't need to change password
  });

  const token = generateToken(user);

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    token,
    role: user.role,
    name: user.name,
    forcePasswordChange: user.forcePasswordChange
  });
});

/* =========================
   LOGIN
========================= */
export const login = asyncHandler(async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({
      success: false,
      message: "Username, password and role are required"
    });
  }

  const identifier = String(username).trim();
  const normalizedEmail = identifier.toLowerCase();
  const normalizedDigits = identifier.replace(/\D/g, '');
  const phoneCandidates = normalizedDigits
    ? Array.from(
        new Set([
          normalizedDigits,
          `+${normalizedDigits}`,
          normalizedDigits.length === 10 ? `+91${normalizedDigits}` : '',
          normalizedDigits.length === 12 && normalizedDigits.startsWith('91')
            ? `+${normalizedDigits}`
            : '',
        ].filter(Boolean))
      )
    : [];

  // Find user by username/email/phone and role
  let user = await User.findOne({
    role: role.toLowerCase(),
    active: true,
    $or: [
      { username: normalizedEmail },
      { email: normalizedEmail },
      ...(phoneCandidates.length > 0 ? [{ phone: { $in: phoneCandidates } }] : [])
    ]
  });

  // Fallback for formatted phone numbers (spaces, country code formats, etc.)
  if (!user && normalizedDigits) {
    const phoneUsers = await User.find({
      role: role.toLowerCase(),
      active: true,
      phone: { $exists: true, $ne: '' }
    }).limit(500);

    user = phoneUsers.find((candidate) => phonesEquivalent(candidate.phone, normalizedDigits)) || null;
  }

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials"
    });
  }

  // Check password - using bcrypt directly in case matchPassword method fails
  let isMatch;
  try {
    // Try the instance method first
    if (typeof user.matchPassword === 'function') {
      isMatch = await user.matchPassword(password);
    } else {
      // Fallback: use bcrypt directly
      isMatch = await bcrypt.compare(password, user.password);
    }

    // Backward-compatibility for parent default password variants
    if (!isMatch && role.toLowerCase() === 'parent') {
      const fallbackPasswords = ['Parent@123', 'Parents@123'];
      for (const candidate of fallbackPasswords) {
        if (candidate === password) continue;
        const candidateMatch = typeof user.matchPassword === 'function'
          ? await user.matchPassword(candidate)
          : await bcrypt.compare(candidate, user.password);
        if (candidateMatch) {
          isMatch = true;
          break;
        }
      }
    }
  } catch (error) {
    console.error("Password check error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error"
    });
  }

  if (!isMatch) {
    // Legacy recovery path:
    // Some older teacher records were created with pre-hashed passwords and then
    // re-hashed by User pre-save middleware, which breaks default password login.
    // If teacher enters default password while forcePasswordChange is still true,
    // reset to a correctly hashed default and allow login.
    if (
      role.toLowerCase() === 'teacher' &&
      password === 'Teacher@123' &&
      user.forcePasswordChange
    ) {
      user.password = 'Teacher@123';
      await user.save();
      isMatch = true;
    }
  }

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials"
    });
  }

  // Fetch additional role-specific data
  let additionalData = {};

  if (role.toLowerCase() === 'cashier') {
    additionalData.permissions = ["fee_collection", "receipts", "defaulters", "reports"];
  }

  if (role.toLowerCase() === 'principal') {
    additionalData.permissions = ["view_all"];
  }

  if (role.toLowerCase() === 'driver') {
    const driverProfile = await Driver.findOne({
      $or: [{ user: user._id }, { userId: user._id }]
    }).lean();
    if (driverProfile) {
      additionalData.driverId = driverProfile._id;
      additionalData.assignedVehicle = driverProfile.assignedVehicle;
      user.linkedId = driverProfile._id;
    }
  }

  if (role.toLowerCase() === 'teacher') {
    const teacherProfile = await Teacher.findOne({ 
      $or: [
        { "contact.email": username.trim().toLowerCase() },
        { user: user._id }
      ] 
    }).lean();
    
    if (teacherProfile) {
      additionalData.assignedClasses = teacherProfile.assignedClasses || [];
      additionalData.teacherId = teacherProfile._id;
    }
  }

  if (role.toLowerCase() === 'parent') {
    const children = await Student.find({ 
      "parentInfo.email": username.trim().toLowerCase(),
      status: { $ne: "deleted" }
    }).lean();
    
    additionalData.children = children.map(child => ({
      id: child._id,
      name: `${child.personal?.firstName || ''} ${child.personal?.lastName || ''}`.trim(),
      class: child.academic?.class || '',
      section: child.academic?.section || ''
    }));
  }

  // Generate token
  const token = generateToken(user);

  res.status(200).json({
    success: true,
    token,
    role: user.role,
    name: user.name,
    userId: user._id,
    linkedId: user.linkedId,
    forcePasswordChange: user.forcePasswordChange,
    ...additionalData
  });
});

/* =========================
   CHANGE PASSWORD
========================= */
export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Old password and new password are required"
    });
  }

  // Validation
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 6 characters"
    });
  }

  if (oldPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: "New password must be different from old password"
    });
  }

  // Find user
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  // Check old password
  let isMatch;
  try {
    if (typeof user.matchPassword === 'function') {
      isMatch = await user.matchPassword(oldPassword);
    } else {
      isMatch = await bcrypt.compare(oldPassword, user.password);
    }
  } catch (error) {
    console.error("Password check error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error"
    });
  }

  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: "Old password is incorrect"
    });
  }

  // Update password
  user.password = newPassword;
  user.forcePasswordChange = false;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password updated successfully"
  });
});

/* =========================
   FORGOT PASSWORD (Optional)
========================= */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required"
    });
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
    active: true
  });

  if (!user) {
    // Return generic message for security
    return res.status(200).json({
      success: true,
      message: "If an account exists, a password reset link will be sent"
    });
  }

  // Generate reset token (simple version)
  const resetToken = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET + user.password,
    { expiresIn: '15m' }
  );

  // In a real app, you would send an email here
  // For now, return the token (in development only)
  if (process.env.NODE_ENV === 'development') {
    return res.status(200).json({
      success: true,
      message: "Password reset initiated",
      resetToken: resetToken,
      userId: user._id
    });
  }

  res.status(200).json({
    success: true,
    message: "Password reset instructions sent to your email"
  });
});

/* =========================
   LOGOUT
========================= */
export const logout = asyncHandler(async (req, res) => {
  // Logout is typically handled on the frontend by clearing the JWT token
  // Backend just confirms the logout
  res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
});

/* =========================
   UPDATE PROFILE
========================= */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  // Check if email is being changed and if it already exists
  if (email && email !== user.email) {
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: user._id }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already in use"
      });
    }
  }

  // Update fields
  if (name) user.name = name.trim();
  if (email) user.email = email.toLowerCase();
  if (phone) user.phone = phone;

  await user.save();

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role
    }
  });
});