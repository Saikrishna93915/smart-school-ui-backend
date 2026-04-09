import Subject from "../models/Subject.js";

/**
 * @desc    Create new subject
 * @route   POST /api/subjects
 * @access  Admin only
 */
export const createSubject = async (req, res) => {
  try {
    const {
      subjectName,
      subjectCode,
      className,
      description,
      category,
      totalMarks,
      passingMarks,
      hasPractical,
      practicalMarks,
      theoryMarks,
      academicYear
    } = req.body;

    // Check if subject already exists for this class
    const existingSubject = await Subject.findOne({
      subjectName,
      className,
      academicYear: academicYear || "2025-2026"
    });

    if (existingSubject) {
      return res.status(400).json({
        success: false,
        message: `${subjectName} already exists for ${className}`
      });
    }

    const subject = await Subject.create({
      subjectName,
      subjectCode,
      className,
      description,
      category,
      totalMarks,
      passingMarks,
      hasPractical,
      practicalMarks,
      theoryMarks,
      academicYear: academicYear || "2025-2026",
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: "Subject created successfully",
      data: subject
    });

  } catch (error) {
    console.error("Error creating subject:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create subject"
    });
  }
};

/**
 * @desc    Get all subjects (with filters)
 * @route   GET /api/subjects
 * @access  Public (all authenticated users)
 */
export const getAllSubjects = async (req, res) => {
  try {
    const { className, category, academicYear, isActive } = req.query;

    // Build filter
    const filter = {};
    
    if (className) filter.className = className;
    if (category) filter.category = category;
    if (academicYear) filter.academicYear = academicYear;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const subjects = await Subject.find(filter)
      .populate('createdBy', 'fullName')
      .sort({ className: 1, subjectName: 1 });

    res.status(200).json({
      success: true,
      count: subjects.length,
      data: subjects
    });

  } catch (error) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch subjects"
    });
  }
};

/**
 * @desc    Get subjects by class
 * @route   GET /api/subjects/class/:className
 * @access  Public (all authenticated users)
 */
export const getSubjectsByClass = async (req, res) => {
  try {
    const { className } = req.params;
    const { academicYear } = req.query;

    const subjects = await Subject.find({
      className,
      academicYear: academicYear || "2025-2026",
      isActive: true
    }).sort({ subjectName: 1 });

    res.status(200).json({
      success: true,
      count: subjects.length,
      className,
      data: subjects
    });

  } catch (error) {
    console.error("Error fetching subjects by class:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch subjects"
    });
  }
};

/**
 * @desc    Get subject by ID
 * @route   GET /api/subjects/:id
 * @access  Public (all authenticated users)
 */
export const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findById(id)
      .populate('createdBy', 'fullName email');

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found"
      });
    }

    res.status(200).json({
      success: true,
      data: subject
    });

  } catch (error) {
    console.error("Error fetching subject by ID:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch subject"
    });
  }
};

/**
 * @desc    Update subject
 * @route   PUT /api/subjects/:id
 * @access  Admin only
 */
export const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const subject = await Subject.findById(id);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found"
      });
    }

    // Update fields
    Object.keys(updateData).forEach(key => {
      subject[key] = updateData[key];
    });

    await subject.save();

    res.status(200).json({
      success: true,
      message: "Subject updated successfully",
      data: subject
    });

  } catch (error) {
    console.error("Error updating subject:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update subject"
    });
  }
};

/**
 * @desc    Delete/deactivate subject
 * @route   DELETE /api/subjects/:id
 * @access  Admin only
 */
export const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findById(id);

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found"
      });
    }

    // Soft delete by setting isActive to false
    subject.isActive = false;
    await subject.save();

    res.status(200).json({
      success: true,
      message: "Subject deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting subject:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete subject"
    });
  }
};

/**
 * @desc    Bulk create subjects for a class
 * @route   POST /api/subjects/bulk
 * @access  Admin only
 */
export const bulkCreateSubjects = async (req, res) => {
  try {
    const { className, subjects, academicYear } = req.body;
    // subjects = [{ subjectName, subjectCode, category, ... }]

    const createdSubjects = [];
    const errors = [];

    for (const subjectData of subjects) {
      try {
        // Check if already exists
        const exists = await Subject.findOne({
          subjectName: subjectData.subjectName,
          className,
          academicYear: academicYear || "2025-2026"
        });

        if (exists) {
          errors.push({
            subjectName: subjectData.subjectName,
            error: "Subject already exists"
          });
          continue;
        }

        const subject = await Subject.create({
          ...subjectData,
          className,
          academicYear: academicYear || "2025-2026",
          createdBy: req.user._id
        });

        createdSubjects.push(subject);

      } catch (error) {
        errors.push({
          subjectName: subjectData.subjectName,
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `${createdSubjects.length} subjects created successfully`,
      data: createdSubjects,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Error in bulk subject creation:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create subjects"
    });
  }
};

/**
 * @desc    Get all unique classes that have subjects
 * @route   GET /api/subjects/classes/list
 * @access  Public (all authenticated users)
 */
export const getClassesWithSubjects = async (req, res) => {
  try {
    const { academicYear } = req.query;

    const filter = { isActive: true };
    if (academicYear) filter.academicYear = academicYear;

    const classes = await Subject.distinct('className', filter);

    res.status(200).json({
      success: true,
      count: classes.length,
      data: classes.sort()
    });

  } catch (error) {
    console.error("Error fetching classes with subjects:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch classes"
    });
  }
};
