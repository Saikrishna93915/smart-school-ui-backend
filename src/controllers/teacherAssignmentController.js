import TeacherAssignment from "../models/TeacherAssignment.js";
import Teacher from "../models/Teacher.js";
import Subject from "../models/Subject.js";
import mongoose from "mongoose";

/**
 * @desc    Create a new teacher assignment
 * @route   POST /api/teacher-assignments
 * @access  Admin only
 */
export const createTeacherAssignment = async (req, res) => {
  try {
    const { teacherId, className, section, subjectId, academicYear, notes } = req.body;

    // Validate teacher exists - try by ObjectId first, then by employeeId
    let teacher = null;
    
    // Check if teacherId is a valid MongoDB ObjectId format
    try {
      if (mongoose.Types.ObjectId.isValid(teacherId) && teacherId.length === 24) {
        teacher = await Teacher.findById(teacherId);
      }
    } catch (e) {
      // If findById fails, teacher remains null and we'll try employeeId
    }
    
    // If not found by ObjectId, try by employeeId/staffId
    if (!teacher) {
      teacher = await Teacher.findOne({ employeeId: teacherId });
    }
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: `Teacher with ID "${teacherId}" not found`
      });
    }

    // Validate subject exists
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found"
      });
    }

    // Check if assignment already exists
    const existingAssignment = await TeacherAssignment.findOne({
      className,
      section,
      subjectId,
      academicYear
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: `${subject.subjectName} is already assigned to another teacher for ${className}-${section}`
      });
    }

    // Create assignment using teacher's actual ObjectId
    const assignment = await TeacherAssignment.create({
      teacherId: teacher._id,
      className,
      section,
      subjectId,
      academicYear: academicYear || "2025-2026",
      assignedBy: req.user._id,
      notes
    });

    const populatedAssignment = await TeacherAssignment.findById(assignment._id)
      .populate('teacherId', 'personal.firstName personal.lastName employeeId')
      .populate('subjectId', 'subjectName subjectCode');

    res.status(201).json({
      success: true,
      message: "Teacher assignment created successfully",
      data: populatedAssignment
    });

  } catch (error) {
    console.error("Error creating teacher assignment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create teacher assignment"
    });
  }
};

/**
 * @desc    Get all teacher assignments (with filters)
 * @route   GET /api/teacher-assignments
 * @access  Admin
 */
export const getAllTeacherAssignments = async (req, res) => {
  try {
    const { className, section, teacherId, subjectId, academicYear } = req.query;

    // Build filter
    const filter = { isActive: true };
    
    if (className) filter.className = className;
    if (section) filter.section = section;
    if (subjectId) filter.subjectId = subjectId;
    if (academicYear) filter.academicYear = academicYear;

    // Handle teacherId filter - resolve employeeId to ObjectId if needed
    if (teacherId) {
      let resolvedTeacherId = teacherId;
      if (!mongoose.Types.ObjectId.isValid(teacherId)) {
        // Try to find teacher by employeeId
        const teacher = await Teacher.findOne({ employeeId: teacherId });
        if (teacher) {
          resolvedTeacherId = teacher._id;
        }
      }
      filter.teacherId = resolvedTeacherId;
    }

    const assignments = await TeacherAssignment.find(filter)
      .populate('teacherId', 'personal.firstName personal.lastName employeeId contact.email')
      .populate('subjectId', 'subjectName subjectCode category')
      .sort({ className: 1, section: 1 });

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments
    });

  } catch (error) {
    console.error("Error fetching teacher assignments:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch teacher assignments"
    });
  }
};

/**
 * @desc    Get assignments for logged-in teacher (My Assignments)
 * @route   GET /api/teacher-assignments/my
 * @access  Teacher
 */
export const getMyAssignments = async (req, res) => {
  try {
    // req.user contains logged-in user info
    // For teachers, we need to find their Teacher document
    const teacher = await Teacher.findOne({ user: req.user._id });
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher profile not found"
      });
    }

    const assignments = await TeacherAssignment.find({
      teacherId: teacher._id,
      isActive: true
    })
      .populate('subjectId', 'subjectName subjectCode category totalMarks')
      .sort({ className: 1, section: 1 });

    // Group assignments by class-section for better UI display
    const groupedAssignments = assignments.reduce((acc, assignment) => {
      const key = `${assignment.className}-${assignment.section}`;
      if (!acc[key]) {
        acc[key] = {
          className: assignment.className,
          section: assignment.section,
          subjects: []
        };
      }
      acc[key].subjects.push({
        _id: assignment._id,
        subjectId: assignment.subjectId._id,
        subjectName: assignment.subjectId.subjectName,
        subjectCode: assignment.subjectId.subjectCode,
        category: assignment.subjectId.category,
        academicYear: assignment.academicYear
      });
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: Object.values(groupedAssignments),
      rawData: assignments // Also send raw data for flexibility
    });

  } catch (error) {
    console.error("Error fetching teacher's assignments:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch assignments"
    });
  }
};

/**
 * @desc    Get assignments by teacher ID
 * @route   GET /api/teacher-assignments/teacher/:teacherId
 * @access  Admin
 */
export const getAssignmentsByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Try by ObjectId first, then by employeeId
    let resolvedTeacherId = teacherId;
    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      const teacher = await Teacher.findOne({ employeeId: teacherId });
      if (teacher) {
        resolvedTeacherId = teacher._id;
      } else {
        return res.status(404).json({
          success: false,
          message: `Teacher with ID "${teacherId}" not found`
        });
      }
    }

    const assignments = await TeacherAssignment.find({
      teacherId: resolvedTeacherId,
      isActive: true
    })
      .populate('subjectId', 'subjectName subjectCode')
      .sort({ className: 1, section: 1 });

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments
    });

  } catch (error) {
    console.error("Error fetching assignments by teacher:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch assignments"
    });
  }
};

/**
 * @desc    Get assignments by class and section
 * @route   GET /api/teacher-assignments/class/:className/section/:section
 * @access  Admin, Teacher, Student (for viewing their teachers)
 */
export const getAssignmentsByClass = async (req, res) => {
  try {
    const { className, section } = req.params;
    const { academicYear } = req.query;

    const assignments = await TeacherAssignment.find({
      className,
      section,
      academicYear: academicYear || "2025-2026",
      isActive: true
    })
      .populate('teacherId', 'personal.firstName personal.lastName contact.email contact.phone')
      .populate('subjectId', 'subjectName subjectCode category');

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments
    });

  } catch (error) {
    console.error("Error fetching assignments by class:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch assignments"
    });
  }
};

/**
 * @desc    Update teacher assignment
 * @route   PUT /api/teacher-assignments/:id
 * @access  Admin only
 */
export const updateTeacherAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId, className, section, subjectId, academicYear, notes, isActive } = req.body;

    const assignment = await TeacherAssignment.findById(id);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found"
      });
    }

    // Update fields
    if (teacherId) {
      // Try by ObjectId first, then by employeeId
      let teacher;
      if (mongoose.Types.ObjectId.isValid(teacherId)) {
        teacher = await Teacher.findById(teacherId);
      }
      if (!teacher) {
        teacher = await Teacher.findOne({ employeeId: teacherId });
      }
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: `Teacher with ID "${teacherId}" not found`
        });
      }
      assignment.teacherId = teacher._id;
    }
    if (className) assignment.className = className;
    if (section) assignment.section = section;
    if (subjectId) assignment.subjectId = subjectId;
    if (academicYear) assignment.academicYear = academicYear;
    if (notes !== undefined) assignment.notes = notes;
    if (isActive !== undefined) assignment.isActive = isActive;

    await assignment.save();

    const updatedAssignment = await TeacherAssignment.findById(id)
      .populate('teacherId', 'personal.firstName personal.lastName employeeId')
      .populate('subjectId', 'subjectName subjectCode');

    res.status(200).json({
      success: true,
      message: "Assignment updated successfully",
      data: updatedAssignment
    });

  } catch (error) {
    console.error("Error updating teacher assignment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update assignment"
    });
  }
};

/**
 * @desc    Delete/deactivate teacher assignment
 * @route   DELETE /api/teacher-assignments/:id
 * @access  Admin only
 */
export const deleteTeacherAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await TeacherAssignment.findById(id);
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found"
      });
    }

    // Soft delete by setting isActive to false
    assignment.isActive = false;
    await assignment.save();

    res.status(200).json({
      success: true,
      message: "Assignment deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting teacher assignment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete assignment"
    });
  }
};

/**
 * @desc    Bulk assign subjects to a teacher
 * @route   POST /api/teacher-assignments/bulk
 * @access  Admin only
 */
export const bulkAssignTeacher = async (req, res) => {
  try {
    const { teacherId, assignments } = req.body;
    // assignments = [{ className, section, subjectId, academicYear }]

    // Try by ObjectId first, then by employeeId
    let teacher = null;
    
    try {
      if (mongoose.Types.ObjectId.isValid(teacherId) && teacherId.length === 24) {
        teacher = await Teacher.findById(teacherId);
      }
    } catch (e) {
      // If findById fails, teacher remains null and we'll try employeeId
    }
    
    if (!teacher) {
      teacher = await Teacher.findOne({ employeeId: teacherId });
    }
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: `Teacher with ID "${teacherId}" not found`
      });
    }

    const createdAssignments = [];
    const errors = [];

    for (const assignment of assignments) {
      try {
        // Check if already exists
        const exists = await TeacherAssignment.findOne({
          className: assignment.className,
          section: assignment.section,
          subjectId: assignment.subjectId,
          academicYear: assignment.academicYear || "2025-2026"
        });

        if (exists) {
          errors.push({
            assignment,
            error: "Assignment already exists"
          });
          continue;
        }

        const newAssignment = await TeacherAssignment.create({
          teacherId: teacher._id,
          className: assignment.className,
          section: assignment.section,
          subjectId: assignment.subjectId,
          academicYear: assignment.academicYear || "2025-2026",
          assignedBy: req.user._id
        });

        createdAssignments.push(newAssignment);

      } catch (error) {
        errors.push({
          assignment,
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `${createdAssignments.length} assignments created successfully`,
      data: createdAssignments,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Error in bulk assignment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create bulk assignments"
    });
  }
};
