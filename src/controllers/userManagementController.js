/**
 * User Management Controller
 * Allows admin to view, create, edit, and manage users (teachers, parents, owners)
 */

import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/User.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import { generateDefaultPassword, getNextSequenceNumber } from "../utils/passwordGenerator.js";

/**
 * GET: Fetch all users of a specific role
 * Query params: role (teacher, parent, owner, student)
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const { role, search } = req.query;

  if (!role) {
    return res.status(400).json({
      success: false,
      message: "Role is required"
    });
  }

  const query = { role: role.toLowerCase() };

  // Add search capability
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } }
    ];
  }

  const users = await User.find(query)
    .select('-password')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: users.length,
    data: users
  });
});

/**
 * GET: Fetch single user by ID
 */
export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).select('-password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

/**
 * POST: Create a new user (teacher, parent, owner)
 * Auto-generates default password
 */
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, phone, role, linkedId } = req.body;

  console.log('📋 User creation request:', { name, email, phone, role, linkedId });

  if (!name || !email || !role) {
    return res.status(400).json({
      success: false,
      message: "Name, email, and role are required",
      missing: {
        name: !name,
        email: !email,
        role: !role
      }
    });
  }

  // Validate role
  const validRoles = ["admin", "owner", "teacher", "student", "parent", "cashier", "principal", "driver"];
  if (!validRoles.includes(role.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      receivedRole: role,
      validRoles: validRoles
    });
  }

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [
      { email: email.toLowerCase() },
      { phone: phone }
    ]
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: "User with this email or phone already exists",
      existingEmail: existingUser.email,
      existingPhone: existingUser.phone
    });
  }

  // Generate default password
  const sequenceNumber = await getNextSequenceNumber(User, role);
  const defaultPassword = generateDefaultPassword(role, sequenceNumber);

  // Create user
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    username: email.toLowerCase().trim(),
    phone: phone || "",
    password: defaultPassword, // Will be hashed by pre-save middleware
    role: role.toLowerCase(),
    linkedId: linkedId || null,
    active: true,
    forcePasswordChange: true // Force password change on first login
  });

  console.log('✅ User created successfully:', user._id);

  res.status(201).json({
    success: true,
    message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully with default password`,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      defaultPassword: defaultPassword, // Return password only during creation
      forcePasswordChange: user.forcePasswordChange
    }
  });
});

/**
 * PUT: Update user details
 */
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, active } = req.body;

  // Prevent updating password here (use changePassword endpoint)
  if (req.body.password) {
    return res.status(400).json({
      success: false,
      message: "Use the password change endpoint to update password"
    });
  }

  // Build update object
  const updateData = {};
  if (name) updateData.name = name.trim();
  if (email) updateData.email = email.toLowerCase();
  if (phone) updateData.phone = phone;
  if (typeof active === 'boolean') updateData.active = active;

  const user = await User.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  res.status(200).json({
    success: true,
    message: "User updated successfully",
    data: user
  });
});

/**
 * PUT: Reset user password to default
 * Useful for users who forgot their password
 */
export const resetUserPasswordToDefault = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  // Generate new default password
  const sequenceNumber = await getNextSequenceNumber(User, user.role);
  const newDefaultPassword = generateDefaultPassword(user.role, sequenceNumber);

  user.password = newDefaultPassword;
  user.forcePasswordChange = true;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password reset to default",
    data: {
      userId: user._id,
      name: user.name,
      newDefaultPassword: newDefaultPassword,
      forcePasswordChange: true
    }
  });
});

/**
 * DELETE: Deactivate a user (soft delete)
 */
export const deactivateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findByIdAndUpdate(
    id,
    { active: false },
    { new: true }
  ).select('-password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  res.status(200).json({
    success: true,
    message: "User deactivated successfully",
    data: user
  });
});

/**
 * DELETE: Permanently delete a user
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findByIdAndDelete(id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  res.status(200).json({
    success: true,
    message: "User deleted successfully"
  });
});

/**
 * GET: User statistics
 */
export const getUserStats = asyncHandler(async (req, res) => {
  const stats = {
    totalTeachers: await User.countDocuments({ role: 'teacher', active: true }),
    totalParents: await User.countDocuments({ role: 'parent', active: true }),
    totalOwners: await User.countDocuments({ role: 'owner', active: true }),
    totalStudents: await User.countDocuments({ role: 'student', active: true }),
    totalCashiers: await User.countDocuments({ role: 'cashier', active: true }),
    totalPrincipals: await User.countDocuments({ role: 'principal', active: true }),
    totalDrivers: await User.countDocuments({ role: 'driver', active: true }),
    totalAdmins: await User.countDocuments({ role: 'admin', active: true }),
    inactiveUsers: await User.countDocuments({ active: false })
  };

  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * POST: Bulk create users from CSV or array
 */
export const bulkCreateUsers = asyncHandler(async (req, res) => {
  const { users } = req.body;

  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Users array is required"
    });
  }

  const createdUsers = [];
  const errors = [];

  for (let i = 0; i < users.length; i++) {
    try {
      const { name, email, phone, role } = users[i];

      if (!name || !email || !role) {
        errors.push(`Row ${i + 1}: Missing required fields`);
        continue;
      }

      // Check for duplicates
      const existingUser = await User.findOne({
        $or: [
          { email: email.toLowerCase() },
          { phone: phone }
        ]
      });

      if (existingUser) {
        errors.push(`Row ${i + 1}: User already exists`);
        continue;
      }

      // Generate default password
      const sequenceNumber = await getNextSequenceNumber(User, role);
      const defaultPassword = generateDefaultPassword(role, sequenceNumber);

      const user = await User.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        username: email.toLowerCase().trim(),
        phone: phone || "",
        password: defaultPassword,
        role: role.toLowerCase(),
        active: true,
        forcePasswordChange: true
      });

      createdUsers.push({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        defaultPassword: defaultPassword
      });
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error.message}`);
    }
  }

  res.status(201).json({
    success: true,
    message: `Created ${createdUsers.length} users with ${errors.length} errors`,
    createdCount: createdUsers.length,
    errorCount: errors.length,
    data: createdUsers,
    errors: errors
  });
});

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  resetUserPasswordToDefault,
  deactivateUser,
  deleteUser,
  getUserStats,
  bulkCreateUsers
};
