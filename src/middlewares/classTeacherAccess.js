import Class from "../models/Class.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";

const ADMIN_ROLES = ["admin", "owner"];

const resolveTeacherId = async (user) => {
  if (user?.linkedId) {
    const linkedTeacher = await Teacher.findById(user.linkedId).select("_id");
    if (linkedTeacher?._id) return linkedTeacher._id.toString();
  }

  const teacher = await Teacher.findOne({ user: user?._id }).select("_id");
  return teacher?._id ? teacher._id.toString() : null;
};

const resolveClassQuery = (req) => {
  const classId = req.params.classId || req.body.classId || req.query.classId;
  const className = req.params.className || req.body.className || req.query.className;
  const section = req.params.section || req.body.section || req.query.section;
  const academicYear = req.body.academicYear || req.query.academicYear;
  const admissionNumber = req.params.admissionNumber || req.body.admissionNumber || req.query.admissionNumber;
  const studentId = req.params.id || req.body.studentId || req.query.studentId;

  return { classId, className, section, academicYear, admissionNumber, studentId };
};

const resolveTargetClass = async (req) => {
  const { classId, className, section, academicYear, admissionNumber, studentId } = resolveClassQuery(req);

  if (classId) {
    return Class.findById(classId).select("_id name section academicYear classTeacher");
  }

  if (studentId) {
    const student = await Student.findById(studentId).select("class");
    const studentClass = student?.class;
    if (!studentClass) return null;

    return Class.findOne({
      name: studentClass.className || studentClass.name,
      section: studentClass.section || null,
      academicYear: studentClass.academicYear || academicYear,
    }).select("_id name section academicYear classTeacher");
  }

  if (admissionNumber) {
    const student = await Student.findOne({ admissionNumber }).select("class");
    const studentClass = student?.class;
    if (!studentClass) return null;

    return Class.findOne({
      name: studentClass.className || studentClass.name,
      section: studentClass.section || null,
      academicYear: studentClass.academicYear || academicYear,
    }).select("_id name section academicYear classTeacher");
  }

  if (className) {
    const query = { name: className };
    if (section && section !== "all") query.section = section;
    if (academicYear) query.academicYear = academicYear;

    return Class.findOne(query).select("_id name section academicYear classTeacher");
  }

  return null;
};

export const requireClassTeacherAccess = () => {
  return async (req, res, next) => {
    try {
      if (ADMIN_ROLES.includes(req.user?.role)) {
        return next();
      }

      if (req.user?.role !== "teacher") {
        return res.status(403).json({
          success: false,
          message: "Only principal/admin/owner/class teacher can access this resource",
        });
      }

      const teacherId = await resolveTeacherId(req.user);
      if (!teacherId) {
        return res.status(403).json({
          success: false,
          message: "Teacher profile not found for this user",
        });
      }

      const targetClass = await resolveTargetClass(req);
      if (!targetClass) {
        return res.status(400).json({
          success: false,
          message: "Class context is required for class teacher access",
        });
      }

      if (!targetClass.classTeacher) {
        return res.status(403).json({
          success: false,
          message: "This class does not have a class teacher assigned",
        });
      }

      if (targetClass.classTeacher.toString() !== teacherId) {
        return res.status(403).json({
          success: false,
          message: "You are not the class teacher for this class",
        });
      }

      req.classTeacherContext = {
        teacherId,
        classId: targetClass._id.toString(),
        className: targetClass.name,
        section: targetClass.section,
        academicYear: targetClass.academicYear,
      };

      return next();
    } catch (error) {
      console.error("Class teacher access middleware error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to validate class teacher access",
      });
    }
  };
};
