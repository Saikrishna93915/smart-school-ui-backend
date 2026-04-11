import Syllabus from "../models/Syllabus.js";
import Subject from "../models/Subject.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";

/**
 * @desc    Create new syllabus
 * @route   POST /api/syllabus
 * @access  Admin, Teacher (only for assigned classes)
 */
export const createSyllabus = async (req, res) => {
  try {
    const { className, section, subjectId, academicYear, chapters, term, examSchedule } = req.body;

    // Validate subject exists
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found"
      });
    }

    // If teacher is creating, they must have teacher role
    if (req.user.role === "teacher") {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher) {
        return res.status(403).json({
          success: false,
          message: "You are not registered as a teacher"
        });
      }
    }

    // Check if syllabus already exists
    const existingSyllabus = await Syllabus.findOne({
      className,
      section,
      subjectId,
      academicYear: academicYear || "2025-2026"
    });

    if (existingSyllabus) {
      return res.status(400).json({
        success: false,
        message: "Syllabus already exists for this class-section-subject"
      });
    }

    // Create syllabus
    const syllabus = await Syllabus.create({
      className,
      section,
      subjectId,
      academicYear: academicYear || "2025-2026",
      chapters: chapters || [],
      term,
      examSchedule,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    const populatedSyllabus = await Syllabus.findById(syllabus._id)
      .populate('subjectId', 'subjectName subjectCode category');

    res.status(201).json({
      success: true,
      message: "Syllabus created successfully",
      data: populatedSyllabus
    });

  } catch (error) {
    console.error("Error creating syllabus:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create syllabus"
    });
  }
};

/**
 * @desc    Get all syllabus (with filters)
 * @route   GET /api/syllabus
 * @access  Admin, Teacher, Student, Parent
 */
export const getAllSyllabus = async (req, res) => {
  try {
    const { className, section, subjectId, academicYear } = req.query;

    // Build filter
    const filter = { isPublished: true };
    
    if (className) filter.className = className;
    if (section) filter.section = section;
    if (subjectId) filter.subjectId = subjectId;
    if (academicYear) filter.academicYear = academicYear;

    // Role-based filtering
    if (req.user.role === "student") {
      // Students can only see their own class syllabus
      let student = null;
      
      // First try linkedId
      if (req.user.linkedId) {
        student = await Student.findOne({ 
          _id: req.user.linkedId,
          status: { $ne: "deleted" }
        });
      }
      
      // Fallback: find by username
      if (!student && req.user.username) {
        student = await Student.findOne({
          admissionNumber: req.user.username,
          status: { $ne: "deleted" }
        });
        
        if (student) {
          await User.findByIdAndUpdate(req.user._id, { linkedId: student._id });
        }
      }
      
      if (student) {
        filter.className = student.class.className;
        filter.section = student.class.section || "";
        filter.academicYear = student.class.academicYear || "2025-2026";
      }
    } else if (req.user.role === "teacher") {
      // Teachers can see all syllabuses (assignment-based filtering removed)
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher) {
        return res.status(403).json({
          success: false,
          message: "You are not registered as a teacher"
        });
      }
    }

    const syllabuses = await Syllabus.find(filter)
      .populate('subjectId', 'subjectName subjectCode category')
      .populate('createdBy', 'fullName')
      .populate('updatedBy', 'fullName')
      .sort({ className: 1, section: 1 });

    // Hide teacher notes for students/parents
    if (req.user.role === "student" || req.user.role === "parent") {
      syllabuses.forEach(syllabus => {
        syllabus.chapters.forEach(chapter => {
          chapter.teacherNotes = undefined;
        });
      });
    }

    res.status(200).json({
      success: true,
      count: syllabuses.length,
      data: syllabuses
    });

  } catch (error) {
    console.error("Error fetching syllabus:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch syllabus"
    });
  }
};

/**
 * @desc    Get syllabus by ID
 * @route   GET /api/syllabus/:id
 * @access  Admin, Teacher, Student, Parent
 */
export const getSyllabusById = async (req, res) => {
  try {
    const { id } = req.params;

    const syllabus = await Syllabus.findById(id)
      .populate('subjectId', 'subjectName subjectCode category totalMarks')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName');

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        message: "Syllabus not found"
      });
    }

    // Hide teacher notes for students/parents
    if (req.user.role === "student" || req.user.role === "parent") {
      syllabus.chapters.forEach(chapter => {
        chapter.teacherNotes = undefined;
      });
    }

    res.status(200).json({
      success: true,
      data: syllabus
    });

  } catch (error) {
    console.error("Error fetching syllabus by ID:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch syllabus"
    });
  }
};

/**
 * @desc    Get syllabus for student (their class)
 * @route   GET /api/syllabus/student/my
 * @access  Student
 */
export const getStudentSyllabus = async (req, res) => {
  try {
    console.log(`\n🔍 getStudentSyllabus called for user:`, {
      userId: req.user._id,
      username: req.user.username,
      linkedId: req.user.linkedId,
      role: req.user.role
    });

    let student = null;

    // Method 1: Try to find student by linkedId
    if (req.user.linkedId) {
      console.log(`  🔎 Method 1: Searching by linkedId: ${req.user.linkedId}`);
      student = await Student.findOne({ 
        _id: req.user.linkedId,
        status: { $ne: "deleted" }
      });
      if (student) {
        console.log(`  ✅ Found student by linkedId`);
        return sendSyllabusResponse(res, student);
      }
      console.log(`  ❌ Not found by linkedId`);
    }

    // Method 2: Try to find student by username (admission number) - exact match
    if (req.user.username) {
      console.log(`  🔎 Method 2: Searching by exact admissionNumber: ${req.user.username}`);
      student = await Student.findOne({
        admissionNumber: req.user.username,
        status: { $ne: "deleted" }
      });

      if (student) {
        console.log(`  ✅ Found student by admissionNumber, updating linkedId...`);
        await User.findByIdAndUpdate(req.user._id, { linkedId: student._id });
        console.log(`  ✅ Updated linkedId for user ${req.user._id} -> ${student._id}`);
        return sendSyllabusResponse(res, student);
      }
      console.log(`  ❌ Not found by exact admissionNumber`);

      // Method 3: Try case-insensitive search
      console.log(`  🔎 Method 3: Searching by case-insensitive admissionNumber`);
      student = await Student.findOne({
        admissionNumber: new RegExp(`^${req.user.username}$`, 'i'),
        status: { $ne: "deleted" }
      });

      if (student) {
        console.log(`  ✅ Found student by case-insensitive admissionNumber`);
        await User.findByIdAndUpdate(req.user._id, { linkedId: student._id });
        return sendSyllabusResponse(res, student);
      }
      console.log(`  ❌ Not found by case-insensitive search`);
    }

    // Method 4: Find ANY active student (fallback - only if exactly 1 student exists)
    console.log(`  🔎 Method 4: Looking for any active student...`);
    const allStudents = await Student.find({ status: { $ne: "deleted" } }).lean();
    console.log(`     Found ${allStudents.length} total students in database`);
    
    if (allStudents.length === 1) {
      console.log(`  ℹ️ Only 1 student in system, assuming that's the logged-in student`);
      student = await Student.findOne({ status: { $ne: "deleted" } });
      await User.findByIdAndUpdate(req.user._id, { linkedId: student._id });
      return sendSyllabusResponse(res, student);
    }

    // No student found - provide detailed diagnostic
    console.error(`\n❌ CRITICAL: Student not found for user:`, {
      userId: req.user._id,
      linkedId: req.user.linkedId,
      username: req.user.username,
      totalStudentsInDB: allStudents.length
    });

    return res.status(404).json({
      success: false,
      message: "Student profile not found.",
      debug: {
        userId: req.user._id,
        username: req.user.username,
        expectedAdmissionNumber: req.user.username,
        totalStudentsInSystem: allStudents.length,
        sampleStudentAdmissionNumbers: allStudents.slice(0, 3).map(s => s.admissionNumber),
        instructions: "Contact admin or check if student record exists in database"
      }
    });

  } catch (error) {
    console.error("❌ Error fetching student syllabus:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch syllabus"
    });
  }
};

/**
 * Helper function to send syllabus response
 */
const sendSyllabusResponse = async (res, student) => {
  try {
    // Verify student has required class info
    if (!student.class || !student.class.className) {
      console.error(`❌ Student ${student._id} missing class info:`, student.class);
      return res.status(400).json({
        success: false,
        message: "Student profile incomplete. Class information missing."
      });
    }

    console.log(`  📚 Searching for syllabuses:`, {
      className: student.class.className,
      section: student.class.section || "",
      academicYear: student.class.academicYear || "2025-2026"
    });

    const syllabuses = await Syllabus.find({
      className: student.class.className,
      section: student.class.section || "",
      academicYear: student.class.academicYear || "2025-2026",
      isPublished: true
    })
      .populate('subjectId', 'subjectName subjectCode category totalMarks')
      .sort({ 'subjectId.subjectName': 1 });

    console.log(`  ✅ Found ${syllabuses.length} syllabuses`);

    // Remove teacher notes
    if (syllabuses && syllabuses.length > 0) {
      syllabuses.forEach(syllabus => {
        if (syllabus.chapters && Array.isArray(syllabus.chapters)) {
          syllabus.chapters.forEach(chapter => {
            chapter.teacherNotes = undefined;
          });
        }
      });
    }

    return res.status(200).json({
      success: true,
      count: syllabuses.length,
      studentInfo: {
        name: `${student.student.firstName} ${student.student.lastName || ""}`.trim(),
        admissionNumber: student.admissionNumber,
        class: student.class.className,
        section: student.class.section || "",
        academicYear: student.class.academicYear || "2025-2026"
      },
      data: syllabuses
    });
  } catch (error) {
    console.error("❌ Error in sendSyllabusResponse:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch syllabus"
    });
  }
};

/**
 * @desc    Update syllabus (chapters, progress, etc.)
 * @route   PUT /api/syllabus/:id
 * @access  Admin, Teacher (only assigned)
 */
export const updateSyllabus = async (req, res) => {
  try {
    const { id } = req.params;
    const { chapters, term, examSchedule, isPublished } = req.body;

    const syllabus = await Syllabus.findById(id);

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        message: "Syllabus not found"
      });
    }

    // If teacher is updating, verify they exist as a teacher
    if (req.user.role === "teacher") {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to update this syllabus"
        });
      }
    }

    // Update fields
    if (chapters) syllabus.chapters = chapters;
    if (term) syllabus.term = term;
    if (examSchedule) syllabus.examSchedule = examSchedule;
    if (isPublished !== undefined) syllabus.isPublished = isPublished;
    
    syllabus.updatedBy = req.user._id;

    await syllabus.save();

    const updatedSyllabus = await Syllabus.findById(id)
      .populate('subjectId', 'subjectName subjectCode');

    res.status(200).json({
      success: true,
      message: "Syllabus updated successfully",
      data: updatedSyllabus
    });

  } catch (error) {
    console.error("Error updating syllabus:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update syllabus"
    });
  }
};

/**
 * @desc    Update chapter status
 * @route   PUT /api/syllabus/:id/chapter/:chapterId
 * @access  Admin, Teacher (only assigned)
 */
export const updateChapterStatus = async (req, res) => {
  try {
    const { id, chapterId } = req.params;
    const { status, startDate, endDate, teacherNotes } = req.body;

    const syllabus = await Syllabus.findById(id);

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        message: "Syllabus not found"
      });
    }

    // If teacher is updating, verify they exist as a teacher
    if (req.user.role === "teacher") {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized"
        });
      }
    }

    // Find and update chapter
    const chapter = syllabus.chapters.id(chapterId);
    
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found"
      });
    }

    if (status) chapter.status = status;
    if (startDate) chapter.startDate = startDate;
    if (endDate) chapter.endDate = endDate;
    if (teacherNotes !== undefined) chapter.teacherNotes = teacherNotes;
    
    if (status === "completed") {
      chapter.completedDate = new Date();
    } else if (status === "ongoing" && !chapter.startDate) {
      chapter.startDate = new Date();
    }
    
    chapter.updatedBy = req.user._id;
    chapter.updatedAt = new Date();

    await syllabus.save();

    res.status(200).json({
      success: true,
      message: "Chapter status updated successfully",
      data: syllabus
    });

  } catch (error) {
    console.error("Error updating chapter status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update chapter status"
    });
  }
};

/**
 * @desc    Add new chapter to syllabus
 * @route   POST /api/syllabus/:id/chapter
 * @access  Admin, Teacher (only assigned)
 */
export const addChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const chapterData = req.body;

    const syllabus = await Syllabus.findById(id);

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        message: "Syllabus not found"
      });
    }

    // Verify teacher authorization
    if (req.user.role === "teacher") {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to add chapters to this syllabus"
        });
      }
    }

    syllabus.chapters.push({
      ...chapterData,
      updatedBy: req.user._id,
      updatedAt: new Date()
    });

    await syllabus.save();

    res.status(201).json({
      success: true,
      message: "Chapter added successfully",
      data: syllabus
    });

  } catch (error) {
    console.error("Error adding chapter:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to add chapter"
    });
  }
};

/**
 * @desc    Delete chapter from syllabus
 * @route   DELETE /api/syllabus/:id/chapter/:chapterId
 * @access  Admin, Teacher (only assigned)
 */
export const deleteChapter = async (req, res) => {
  try {
    const { id, chapterId } = req.params;

    const syllabus = await Syllabus.findById(id);

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        message: "Syllabus not found"
      });
    }

    // Verify teacher authorization
    if (req.user.role === "teacher") {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to delete chapters from this syllabus"
        });
      }
    }

    // Remove chapter using Mongoose pull
    syllabus.chapters.pull(chapterId);
    await syllabus.save();

    res.status(200).json({
      success: true,
      message: "Chapter deleted successfully",
      data: syllabus
    });

  } catch (error) {
    console.error("Error deleting chapter:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete chapter"
    });
  }
};

/**
 * @desc    Delete syllabus
 * @route   DELETE /api/syllabus/:id
 * @access  Admin only
 */
export const deleteSyllabus = async (req, res) => {
  try {
    const { id } = req.params;

    const syllabus = await Syllabus.findByIdAndDelete(id);

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        message: "Syllabus not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Syllabus deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting syllabus:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete syllabus"
    });
  }
};

/**
 * @desc    Get syllabus statistics for a class
 * @route   GET /api/syllabus/stats/:className/:section
 * @access  Admin, Teacher
 */
export const getSyllabusStats = async (req, res) => {
  try {
    const { className, section } = req.params;
    const { academicYear } = req.query;

    const syllabuses = await Syllabus.find({
      className,
      section,
      academicYear: academicYear || "2025-2026"
    }).populate('subjectId', 'subjectName');

    const stats = syllabuses.map(syllabus => ({
      subjectName: syllabus.subjectId.subjectName,
      totalChapters: syllabus.totalChapters,
      completedChapters: syllabus.completedChapters,
      progressPercentage: syllabus.progressPercentage,
      ongoingChapters: syllabus.chapters.filter(ch => ch.status === 'ongoing').length,
      pendingChapters: syllabus.chapters.filter(ch => ch.status === 'pending').length
    }));

    const overallProgress = syllabuses.reduce((acc, s) => acc + s.progressPercentage, 0) / syllabuses.length || 0;

    res.status(200).json({
      success: true,
      className,
      section,
      overallProgress: Math.round(overallProgress),
      subjects: stats
    });

  } catch (error) {
    console.error("Error fetching syllabus stats:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch syllabus statistics"
    });
  }
};
