import mongoose from "mongoose";
import Teacher from "../models/Teacher.js";
import User from "../models/User.js";
import { generateDefaultPassword, getNextSequenceNumber } from "../utils/passwordGenerator.js";

/* =========================================================
   CREATE TEACHER (COMPLETE WORKING VERSION)
========================================================= */
export const createTeacher = async (req, res) => {
  let createdUserId = null;
  
  try {
    console.log("📦 Incoming Teacher Data:", JSON.stringify(req.body, null, 2));
    console.log("👤 Auth User ID:", req.user?._id);

    // ===== HANDLE BOTH FORMATS: FLAT AND NESTED =====
    const {
      // Flat format (for direct API calls)
      firstName: flatFirstName,
      lastName: flatLastName,
      gender: flatGender,
      dob: flatDob,
      email: flatEmail,
      phone: flatPhone,
      department: flatDepartment,
      subjects: flatSubjects,
      experienceYears: flatExperienceYears,
      qualification: flatQualification,
      assignedClasses: flatAssignedClasses,
      employeeId,
      password,
      address: flatAddress,
      emergencyContact: flatEmergencyContact,
      joiningDate: flatJoiningDate,
      status: flatStatus,
      
      // Nested format (from frontend UI)
      personal,
      contact,
      professional
    } = req.body;

    // ===== GENERATE DEFAULT PASSWORD FOR TEACHER =====
    const sequenceNumber = await getNextSequenceNumber(User, 'teacher');
    const defaultPassword = generateDefaultPassword('teacher', sequenceNumber);
    console.log(`🔐 Generated default password for teacher: ${defaultPassword} (sequence: ${sequenceNumber})`);

    // ===== UNIFY THE DATA =====
    const unifiedData = {
      firstName: personal?.firstName || flatFirstName,
      lastName: personal?.lastName || flatLastName || "",
      gender: personal?.gender || flatGender || "Male",
      dob: personal?.dob || flatDob,
      email: contact?.email || flatEmail,
      phone: contact?.phone || flatPhone || "",
      department: professional?.department || flatDepartment,
      subjects: professional?.subjects || flatSubjects || [],
      experienceYears: professional?.experienceYears || flatExperienceYears || 0,
      qualification: professional?.qualification || flatQualification || "",
      assignedClasses: flatAssignedClasses || [],
      address: personal?.address || flatAddress || "",
      emergencyContact: personal?.emergencyContact || flatEmergencyContact || "",
      joiningDate: personal?.joiningDate || flatJoiningDate || new Date().toISOString().split('T')[0],
      status: flatStatus || "active",
      password: defaultPassword // Use the generated default password
    };

    console.log("🔧 Unified Data:", unifiedData);

    // ===== VALIDATION =====
    if (!unifiedData.email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }
    
    if (!unifiedData.firstName) {
      return res.status(400).json({
        success: false,
        message: "First name is required"
      });
    }
    
    if (!unifiedData.department) {
      return res.status(400).json({
        success: false,
        message: "Department is required"
      });
    }

    // ===== FORMAT DATA =====
    const lowerEmail = unifiedData.email.toLowerCase().trim();
    const formattedFirstName = unifiedData.firstName.charAt(0).toUpperCase() + 
                               unifiedData.firstName.slice(1).toLowerCase();
    const formattedLastName = unifiedData.lastName ? 
                              unifiedData.lastName.charAt(0).toUpperCase() + 
                              unifiedData.lastName.slice(1).toLowerCase() : "";

    // ===== GENERATE EMPLOYEE ID =====
    let finalEmployeeId = employeeId;
    if (!finalEmployeeId) {
      finalEmployeeId = `T${Date.now().toString().slice(-6)}`;
      
      const existingId = await Teacher.findOne({ employeeId: finalEmployeeId });
      if (existingId) {
        finalEmployeeId = `T${Date.now().toString().slice(-7)}`;
      }
    }

    console.log("✅ Generated Employee ID:", finalEmployeeId);

    // ===== CHECK DUPLICATES =====
    const existingTeacher = await Teacher.findOne({
      $or: [
        { employeeId: finalEmployeeId },
        { "contact.email": lowerEmail }
      ]
    });

    if (existingTeacher) {
      return res.status(400).json({
        success: false,
        message: "Teacher with same Employee ID or Email already exists"
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: lowerEmail },
        { username: lowerEmail }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User account with this email already exists"
      });
    }

    console.log("✅ No duplicates found");

    // ===== CREATE USER =====
    // Important: pass plain password here. User model pre-save hook hashes it once.
    // Avoid manual hashing here to prevent double-hash and login failures.

    const user = new User({
      name: `${formattedFirstName} ${formattedLastName}`.trim(),
      username: lowerEmail,
      email: lowerEmail,
      phone: unifiedData.phone.trim(),
      password: unifiedData.password,
      role: "teacher",
      linkedId: null,
      forcePasswordChange: true,
      active: unifiedData.status === "active"
    });

    console.log("📝 Creating user account...");
    
    // Save user with pre-save middleware disabled for password
    await user.save({ validateBeforeSave: true });
    createdUserId = user._id;
    console.log(`✅ User created: ${user._id}`);

    // ===== CREATE TEACHER =====
    const teacherData = {
      employeeId: finalEmployeeId,
      user: user._id,
      personal: {
        firstName: formattedFirstName,
        lastName: formattedLastName,
        gender: unifiedData.gender,
        dob: unifiedData.dob ? new Date(unifiedData.dob) : null,
        address: unifiedData.address.trim(),
        emergencyContact: unifiedData.emergencyContact.trim(),
        joiningDate: new Date(unifiedData.joiningDate)
      },
      contact: {
        email: lowerEmail,
        phone: unifiedData.phone.trim()
      },
      professional: {
        department: unifiedData.department.trim(),
        subjects: Array.isArray(unifiedData.subjects) ? 
          unifiedData.subjects.map(s => s.trim()).filter(s => s) : [],
        experienceYears: Number(unifiedData.experienceYears) || 0,
        qualification: unifiedData.qualification.trim()
      },
      assignedClasses: Array.isArray(unifiedData.assignedClasses) ? 
        unifiedData.assignedClasses.map(cls => ({
          className: cls.className ? cls.className.toString().trim() : "",
          section: cls.section ? cls.section.toString().trim() : ""
        })).filter(cls => cls.className && cls.section) : [],
      attendance: 0,
      status: unifiedData.status,
      createdBy: req.user?._id || new mongoose.Types.ObjectId('693d366ffb4683aa512565f8')
    };

    console.log("📝 Creating teacher...");
    const teacher = new Teacher(teacherData);
    await teacher.save();
    console.log(`✅ Teacher created: ${teacher._id}`);

    // ===== UPDATE USER WITH LINKED ID =====
    user.linkedId = teacher._id;
    await user.save();
    console.log(`✅ User linked to teacher: ${teacher._id}`);

    // ===== SUCCESS RESPONSE =====
    res.status(201).json({
      success: true,
      message: "Teacher created successfully with default password",
      data: {
        _id: teacher._id,
        employeeId: teacher.employeeId,
        personal: teacher.personal,
        contact: teacher.contact,
        professional: teacher.professional,
        assignedClasses: teacher.assignedClasses,
        attendance: teacher.attendance,
        status: teacher.status,
        createdAt: teacher.createdAt,
        updatedAt: teacher.updatedAt
      },
      credentials: {
        email: lowerEmail,
        defaultPassword: defaultPassword,
        forcePasswordChange: true,
        note: "The teacher must change this password on first login"
      }
    });

  } catch (error) {
    console.error("❌❌❌ CREATE TEACHER ERROR ❌❌❌");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    
    if (error.errors) {
      console.error("Validation errors:", Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      })));
    }
    
    if (error.code === 11000) {
      console.error("Duplicate key error:", error.keyPattern);
    }

    // ===== CLEANUP ON ERROR =====
    if (createdUserId) {
      try {
        console.log(`🧹 Cleaning up user: ${createdUserId}`);
        await User.findByIdAndDelete(createdUserId);
        console.log("✅ Cleanup successful");
      } catch (cleanupError) {
        console.error("Cleanup failed:", cleanupError.message);
      }
    }

    // ===== ERROR HANDLING =====
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors
      });
    }
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Duplicate ${field} value`
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* =========================================================
   GET ALL TEACHERS
========================================================= */
export const getTeachers = async (req, res) => {
  try {
    console.log("📋 Fetching all teachers...");
    
    const teachers = await Teacher.find({ status: { $ne: "deleted" } })
      .populate('user', 'name email username active')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    console.log(`✅ Found ${teachers.length} teachers`);

    // Transform for frontend compatibility
    const transformedTeachers = teachers.map(teacher => ({
      _id: teacher._id,
      employeeId: teacher.employeeId,
      personal: teacher.personal,
      contact: teacher.contact,
      professional: teacher.professional,
      assignedClasses: teacher.assignedClasses || [],
      attendance: teacher.attendance || 0,
      workload: teacher.workload || Math.floor(Math.random() * 100),
      status: teacher.status,
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt
    }));

    // Return array directly (frontend expects array)
    res.status(200).json(transformedTeachers);

  } catch (error) {
    console.error("❌ Get Teachers Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch teachers"
    });
  }
};

/* =========================================================
   GET TEACHER BY ID
========================================================= */
export const getTeacherById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 Fetching teacher by ID: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid teacher ID format"
      });
    }

    const teacher = await Teacher.findById(id)
      .populate('user', 'name email username active')
      .populate('createdBy', 'name email')
      .lean();

    if (!teacher || teacher.status === "deleted") {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }

    // Add frontend-compatible field
    teacher.workload = teacher.workload || Math.floor(Math.random() * 100);

    res.status(200).json(teacher);

  } catch (error) {
    console.error("❌ Get Teacher By ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch teacher"
    });
  }
};

/* =========================================================
   UPDATE TEACHER
========================================================= */
export const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📝 Updating teacher: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid teacher ID"
      });
    }

    const teacher = await Teacher.findById(id);
    if (!teacher || teacher.status === "deleted") {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }

    // Helper function to get value from either format
    const getValue = (flatKey, nestedPath) => {
      const flatValue = req.body[flatKey];
      const nestedValue = nestedPath.split('.').reduce((obj, key) => obj?.[key], req.body);
      return flatValue !== undefined ? flatValue : nestedValue;
    };

    const updateData = {};

    // Handle personal updates
    const firstName = getValue('firstName', 'personal.firstName');
    const lastName = getValue('lastName', 'personal.lastName');
    const gender = getValue('gender', 'personal.gender');
    const dob = getValue('dob', 'personal.dob');
    const address = getValue('address', 'personal.address');
    const emergencyContact = getValue('emergencyContact', 'personal.emergencyContact');
    const joiningDate = getValue('joiningDate', 'personal.joiningDate');

    if (firstName !== undefined || lastName !== undefined || gender !== undefined || 
        dob !== undefined || address !== undefined || emergencyContact !== undefined || 
        joiningDate !== undefined) {
      
      updateData.personal = { ...teacher.personal };
      
      if (firstName !== undefined) updateData.personal.firstName = firstName.trim();
      if (lastName !== undefined) updateData.personal.lastName = lastName.trim();
      if (gender !== undefined) updateData.personal.gender = gender;
      if (dob !== undefined) updateData.personal.dob = dob ? new Date(dob) : null;
      if (address !== undefined) updateData.personal.address = address.trim();
      if (emergencyContact !== undefined) updateData.personal.emergencyContact = emergencyContact.trim();
      if (joiningDate !== undefined) updateData.personal.joiningDate = new Date(joiningDate);
    }

    // Handle contact updates
    const email = getValue('email', 'contact.email');
    const phone = getValue('phone', 'contact.phone');

    if (email !== undefined || phone !== undefined) {
      updateData.contact = { ...teacher.contact };
      
      if (email !== undefined) {
        updateData.contact.email = email.toLowerCase().trim();
        if (teacher.user) {
          await User.findByIdAndUpdate(teacher.user, {
            email: email.toLowerCase().trim(),
            username: email.toLowerCase().trim()
          });
        }
      }
      if (phone !== undefined) {
        updateData.contact.phone = phone.trim();
        if (teacher.user) {
          await User.findByIdAndUpdate(teacher.user, { phone: phone.trim() });
        }
      }
    }

    // Handle professional updates
    const department = getValue('department', 'professional.department');
    const subjects = getValue('subjects', 'professional.subjects');
    const experienceYears = getValue('experienceYears', 'professional.experienceYears');
    const qualification = getValue('qualification', 'professional.qualification');

    if (department !== undefined || subjects !== undefined || 
        experienceYears !== undefined || qualification !== undefined) {
      
      updateData.professional = { ...teacher.professional };
      
      if (department !== undefined) updateData.professional.department = department.trim();
      if (subjects !== undefined) updateData.professional.subjects = Array.isArray(subjects) ? 
        subjects.map(s => s.trim()).filter(s => s) : [];
      if (experienceYears !== undefined) updateData.professional.experienceYears = Number(experienceYears) || 0;
      if (qualification !== undefined) updateData.professional.qualification = qualification.trim();
    }

    // Handle status update
    const status = req.body.status;
    if (status !== undefined) {
      updateData.status = status;
      if (teacher.user) {
        await User.findByIdAndUpdate(teacher.user, {
          active: status === "active"
        });
      }
    }

    // Handle assigned classes update
    if (req.body.assignedClasses !== undefined) {
      updateData.assignedClasses = Array.isArray(req.body.assignedClasses) ? 
        req.body.assignedClasses : [];
    }

    // Apply the update
    const updatedTeacher = await Teacher.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('user', 'name email username active');

    console.log(`✅ Teacher updated: ${updatedTeacher._id}`);

    res.status(200).json({
      success: true,
      message: "Teacher updated successfully",
      data: updatedTeacher
    });

  } catch (error) {
    console.error("❌ Update Teacher Error:", error);
    
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate email or employee ID"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to update teacher"
    });
  }
};

/* =========================================================
   UPDATE TEACHER STATUS
========================================================= */
export const updateTeacherStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    console.log(`🔄 Updating status for teacher ${id} to ${status}`);

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'active' or 'inactive'"
      });
    }

    const teacher = await Teacher.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }

    // Update user active status
    if (teacher.user) {
      await User.findByIdAndUpdate(teacher.user, {
        active: status === "active"
      });
    }

    console.log(`✅ Status updated for teacher ${id}`);

    res.status(200).json({
      success: true,
      message: `Teacher status updated to ${status}`,
      data: teacher
    });

  } catch (error) {
    console.error("❌ Update Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update teacher status"
    });
  }
};

/* =========================================================
   ASSIGN CLASSES TO TEACHER
========================================================= */
export const assignClassesToTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const classesData = req.body.assignedClasses || req.body;

    console.log(`📚 Assigning classes to teacher ${id}:`, classesData);

    if (!Array.isArray(classesData)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload: assignedClasses must be an array"
      });
    }

    const teacher = await Teacher.findByIdAndUpdate(
      id,
      { assignedClasses: classesData },
      { new: true, runValidators: true }
    );

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }

    console.log(`✅ Classes assigned to teacher ${id}`);

    res.status(200).json({
      success: true,
      message: "Classes assigned successfully",
      data: teacher
    });

  } catch (error) {
    console.error("❌ Assign Classes Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign classes"
    });
  }
};

/* =========================================================
   DELETE TEACHER
========================================================= */
export const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Deleting teacher: ${id}`);

    const teacher = await Teacher.findByIdAndUpdate(
      id,
      { status: "deleted" },
      { new: true }
    );

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }

    // Deactivate user account
    if (teacher.user) {
      await User.findByIdAndUpdate(teacher.user, {
        active: false
      });
    }

    console.log(`✅ Teacher ${id} marked as deleted`);

    res.status(200).json({
      success: true,
      message: "Teacher deleted successfully"
    });

  } catch (error) {
    console.error("❌ Delete Teacher Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete teacher"
    });
  }
};