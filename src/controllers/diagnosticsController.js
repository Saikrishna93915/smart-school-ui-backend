import User from "../models/User.js";
import Student from "../models/Student.js";

/**
 * @desc    Diagnostic endpoint for student-user linking
 * @route   GET /api/diagnose/syllabus
 * @access  Admin only
 */
export const diagnoseSyllabusIssues = async (req, res) => {
  try {
    console.log("🔍 Running comprehensive diagnostics...\n");

    // Get student users with issues
    const studentUsersTotal = await User.countDocuments({ role: "student" });
    const studentUsersWithoutLinkedId = await User.countDocuments({
      role: "student",
      linkedId: { $in: [null, undefined, ""] }
    });

    // Get all student users and their details
    const studentUsers = await User.find({ role: "student" })
      .select("username linkedId name email")
      .lean();

    // Get students without corresponding users
    const studentsTotal = await Student.countDocuments({ status: { $ne: "deleted" } });
    const studentsWithoutUsers = await Student.find({
      status: { $ne: "deleted" }
    })
      .select("admissionNumber _id class student")
      .lean();

    let orphanedStudents = [];
    let studentsOk = 0;
    const studentUserMap = [];

    for (const student of studentsWithoutUsers) {
      const user = await User.findOne({ username: student.admissionNumber });
      const recordInfo = {
        studentId: student._id,
        admissionNumber: student.admissionNumber,
        studentName: `${student.student.firstName} ${student.student.lastName || ""}`,
        class: student.class?.className,
        section: student.class?.section,
        userExists: !!user,
        userId: user?._id,
        userLinkedId: user?.linkedId,
        userLinkedIdMatches: user?.linkedId?.toString() === student._id.toString()
      };

      studentUserMap.push(recordInfo);

      if (!user) {
        orphanedStudents.push({
          studId: student._id,
          admissionNumber: student.admissionNumber,
          name: `${student.student.firstName} ${student.student.lastName || ""}`
        });
      } else {
        studentsOk++;
      }
    }

    res.status(200).json({
      success: true,
      summary: {
        studentUsers: {
          total: studentUsersTotal,
          withoutLinkedId: studentUsersWithoutLinkedId,
          withLinkedId: studentUsersTotal - studentUsersWithoutLinkedId
        },
        students: {
          total: studentsTotal,
          orphaned: orphanedStudents.length,
          withUsers: studentsOk
        }
      },
      issues: [
        studentUsersWithoutLinkedId > 0
          ? `❌ ${studentUsersWithoutLinkedId} student users missing linkedId`
          : "✅ All student users have linkedId",
        orphanedStudents.length > 0
          ? `❌ ${orphanedStudents.length} students without user accounts`
          : "✅ All students have user accounts"
      ],
      studentUserMap: studentUserMap,
      orphanedStudents: orphanedStudents.slice(0, 10),
      allStudentUsers: studentUsers,
      recommendations: [
        studentUsersWithoutLinkedId > 0 ? "Run: node scripts/fixStudentLinkedIds.js" : null,
        orphanedStudents.length > 0 ? "Create user accounts for orphaned students" : null
      ].filter(Boolean),
      message: "Run migrations if issues found"
    });
  } catch (error) {
    console.error("Diagnostic error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get detailed info for current authenticated student
 * @route   GET /api/diagnose/student/me
 * @access  Student
 */
export const diagnoseCurrentStudent = async (req, res) => {
  try {
    console.log(`\n📋 Diagnosing current student ${req.user._id}\n`);

    res.status(200).json({
      success: true,
      currentUser: {
        userId: req.user._id,
        username: req.user.username,
        name: req.user.name,
        linkedId: req.user.linkedId,
        role: req.user.role
      },
      message: "Student diagnostics loaded. Check browser console for API logs."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    List all students in database
 * @route   GET /api/diagnose/students/list
 * @access  Admin only
 */
export const listAllStudents = async (req, res) => {
  try {
    const students = await Student.find({ status: { $ne: "deleted" } })
      .select("admissionNumber _id student class")
      .lean()
      .sort({ admissionNumber: 1 });

    const studentsWithUserStatus = [];

    for (const student of students) {
      const user = await User.findOne({ username: student.admissionNumber });
      studentsWithUserStatus.push({
        admissionNumber: student.admissionNumber,
        studentId: student._id,
        name: `${student.student.firstName} ${student.student.lastName || ""}`,
        class: `${student.class.className}-${student.class.section}`,
        userAccountExists: !!user,
        userId: user?._id,
        userUsername: user?.username,
        linkedIdSet: !!user?.linkedId,
        linkedIdMatches: user?.linkedId?.toString() === student._id.toString()
      });
    }

    res.status(200).json({
      success: true,
      totalStudents: studentsWithUserStatus.length,
      students: studentsWithUserStatus
    });
  } catch (error) {
    console.error("Error listing students:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
