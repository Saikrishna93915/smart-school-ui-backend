import asyncHandler from 'express-async-handler';
import ProgressExamCycle from '../models/ProgressExamCycle.js';
import ProgressMarkEntry from '../models/ProgressMarkEntry.js';
import ProgressClassRemark from '../models/ProgressClassRemark.js';
import TeacherAssignment from '../models/TeacherAssignment.js';
import Teacher from '../models/Teacher.js';
import Class from '../models/Class.js';
import Student from '../models/Student.js';
import Subject from '../models/Subject.js';

const ADMIN_ROLES = ['admin', 'owner'];

function calculateGrade(percentage = 0) {
  if (percentage >= 90) return { grade: 'A+', gradePoint: 10 };
  if (percentage >= 80) return { grade: 'A', gradePoint: 9 };
  if (percentage >= 70) return { grade: 'B+', gradePoint: 8 };
  if (percentage >= 60) return { grade: 'B', gradePoint: 7 };
  if (percentage >= 50) return { grade: 'C+', gradePoint: 6 };
  if (percentage >= 40) return { grade: 'C', gradePoint: 5 };
  if (percentage >= 35) return { grade: 'D', gradePoint: 4 };
  return { grade: 'F', gradePoint: 0 };
}

function getAcademicYearFromStudent(student) {
  return student?.class?.academicYear || '2025-2026';
}

async function resolveTeacherProfileId(user) {
  if (user?.linkedId) {
    const byLinked = await Teacher.findById(user.linkedId).select('_id');
    if (byLinked?._id) return byLinked._id;
  }

  const byUser = await Teacher.findOne({ user: user._id }).select('_id');
  return byUser?._id || null;
}

async function ensureTeacherAuthorizedForSubject({ user, className, section, subjectId, academicYear }) {
  if (ADMIN_ROLES.includes(user.role)) return true;
  if (user.role !== 'teacher') return false;

  const teacherProfileId = await resolveTeacherProfileId(user);
  if (!teacherProfileId) return false;

  const classDoc = await Class.findOne({
    name: className,
    section,
    academicYear
  }).select('_id classTeacher');

  if (classDoc?.classTeacher && classDoc.classTeacher.toString() === teacherProfileId.toString()) {
    return true;
  }

  const assignment = await TeacherAssignment.findOne({
    teacher: teacherProfileId,
    assignmentType: 'subject_teacher',
    class: classDoc?._id,
    subject: subjectId,
    academicYear,
    status: 'active'
  }).select('_id');

  if (assignment) return true;

  const legacyAssignment = await TeacherAssignment.findOne({
    teacherId: teacherProfileId,
    className,
    section,
    subjectId,
    academicYear,
    isActive: true
  }).select('_id');

  return Boolean(legacyAssignment);
}

async function ensureTeacherAuthorizedForClass({ user, className, section, academicYear }) {
  if (ADMIN_ROLES.includes(user.role)) return true;
  if (user.role !== 'teacher') return false;

  const teacherProfileId = await resolveTeacherProfileId(user);
  if (!teacherProfileId) return false;

  const classDoc = await Class.findOne({
    name: className,
    section,
    academicYear
  }).select('_id classTeacher');

  if (classDoc?.classTeacher && classDoc.classTeacher.toString() === teacherProfileId.toString()) {
    return true;
  }

  const assignment = await TeacherAssignment.findOne({
    teacher: teacherProfileId,
    assignmentType: 'class_teacher',
    class: classDoc?._id,
    academicYear,
    status: 'active'
  }).select('_id');

  if (assignment) return true;

  const legacyAssignment = await TeacherAssignment.findOne({
    teacherId: teacherProfileId,
    className,
    section,
    academicYear,
    isActive: true
  }).select('_id');

  return Boolean(legacyAssignment);
}

export const createExamCycle = asyncHandler(async (req, res) => {
  const {
    academicYear,
    examName,
    examCode,
    examType,
    examSequence,
    startDate,
    endDate,
    resultDate,
    isActive = true
  } = req.body;

  if (!academicYear || !examName || !examCode || !examType || !examSequence) {
    return res.status(400).json({
      success: false,
      message: 'academicYear, examName, examCode, examType and examSequence are required'
    });
  }

  const cycle = await ProgressExamCycle.create({
    academicYear,
    examName,
    examCode,
    examType,
    examSequence,
    startDate,
    endDate,
    resultDate,
    isActive,
    createdBy: req.user._id
  });

  res.status(201).json({
    success: true,
    data: cycle,
    message: 'Exam cycle created successfully'
  });
});

export const getExamCycles = asyncHandler(async (req, res) => {
  const { academicYear, isActive, isPublished } = req.query;

  const filter = {};
  if (academicYear) filter.academicYear = academicYear;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

  const cycles = await ProgressExamCycle.find(filter)
    .sort({ academicYear: -1, examSequence: 1 })
    .populate('createdBy', 'name role')
    .populate('publishedBy', 'name role');

  res.json({
    success: true,
    data: cycles
  });
});

export const upsertStudentMarks = asyncHandler(async (req, res) => {
  const {
    examCycleId,
    studentId,
    subjectId,
    className,
    section,
    theoryMarks = 0,
    practicalMarks = 0,
    maxMarks = 100,
    passingMarks = 35,
    teacherRemarks,
    isAbsent = false,
    submit = false
  } = req.body;

  if (!examCycleId || !studentId || !subjectId || !className || !section) {
    return res.status(400).json({
      success: false,
      message: 'examCycleId, studentId, subjectId, className and section are required'
    });
  }

  const examCycle = await ProgressExamCycle.findById(examCycleId);
  if (!examCycle) {
    return res.status(404).json({ success: false, message: 'Exam cycle not found' });
  }

  const student = await Student.findById(studentId).select('class');
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  const subject = await Subject.findById(subjectId).select('_id subjectName');
  if (!subject) {
    return res.status(404).json({ success: false, message: 'Subject not found' });
  }

  const isAuthorized = await ensureTeacherAuthorizedForSubject({
    user: req.user,
    className,
    section,
    subjectId,
    academicYear: examCycle.academicYear
  });

  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to enter marks for this class-section-subject'
    });
  }

  const normalizedTheory = Number(theoryMarks) || 0;
  const normalizedPractical = Number(practicalMarks) || 0;
  const normalizedMax = Number(maxMarks) || 100;
  const normalizedPassing = Number(passingMarks) || 35;
  const totalMarks = isAbsent ? 0 : normalizedTheory + normalizedPractical;
  const percentage = normalizedMax > 0 ? (totalMarks / normalizedMax) * 100 : 0;
  const gradeMeta = calculateGrade(percentage);

  const passingStatus = isAbsent
    ? 'Absent'
    : totalMarks >= normalizedPassing
    ? 'Pass'
    : 'Fail';

  const status = submit ? 'Submitted' : 'Draft';

  const updated = await ProgressMarkEntry.findOneAndUpdate(
    {
      studentId,
      examCycleId,
      subjectId
    },
    {
      $set: {
        academicYear: examCycle.academicYear,
        className,
        section,
        theoryMarks: normalizedTheory,
        practicalMarks: normalizedPractical,
        totalMarks,
        maxMarks: normalizedMax,
        passingMarks: normalizedPassing,
        passingStatus,
        grade: gradeMeta.grade,
        gradePoint: gradeMeta.gradePoint,
        teacherRemarks,
        enteredBy: req.user._id,
        enteredDate: new Date(),
        status,
        isLocked: false
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  )
    .populate('studentId', 'admissionNumber student.firstName student.lastName class')
    .populate('subjectId', 'subjectName subjectCode')
    .populate('examCycleId', 'examName examCode examType examSequence academicYear');

  res.status(200).json({
    success: true,
    data: updated,
    message: submit ? 'Marks submitted successfully' : 'Marks saved as draft'
  });
});

export const verifyMarksForClass = asyncHandler(async (req, res) => {
  const {
    examCycleId,
    className,
    section,
    studentId,
    verifyStatus = 'Verified'
  } = req.body;

  if (!examCycleId || !className || !section) {
    return res.status(400).json({
      success: false,
      message: 'examCycleId, className and section are required'
    });
  }

  const examCycle = await ProgressExamCycle.findById(examCycleId).select('academicYear isPublished');
  if (!examCycle) {
    return res.status(404).json({ success: false, message: 'Exam cycle not found' });
  }

  const canVerify = await ensureTeacherAuthorizedForClass({
    user: req.user,
    className,
    section,
    academicYear: examCycle.academicYear
  });

  if (!canVerify) {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to verify marks for this class'
    });
  }

  if (!['Verified', 'Published'].includes(verifyStatus)) {
    return res.status(400).json({
      success: false,
      message: 'verifyStatus must be either Verified or Published'
    });
  }

  const filter = { examCycleId, className, section };
  if (studentId) filter.studentId = studentId;

  const updates = {
    status: verifyStatus,
    verifiedBy: req.user._id,
    verifiedDate: new Date()
  };

  if (verifyStatus === 'Published') {
    updates.isLocked = true;
  }

  const result = await ProgressMarkEntry.updateMany(filter, { $set: updates });

  res.json({
    success: true,
    data: {
      matchedCount: result.matchedCount || 0,
      modifiedCount: result.modifiedCount || 0
    },
    message: `Marks ${verifyStatus.toLowerCase()} successfully`
  });
});

export const saveClassTeacherRemark = asyncHandler(async (req, res) => {
  const {
    examCycleId,
    studentId,
    className,
    section,
    classTeacherRemark,
    promotedToClass,
    rankInClass,
    attendance,
    coCurricular,
    personality
  } = req.body;

  if (!examCycleId || !studentId || !className || !section) {
    return res.status(400).json({
      success: false,
      message: 'examCycleId, studentId, className and section are required'
    });
  }

  const examCycle = await ProgressExamCycle.findById(examCycleId).select('academicYear');
  if (!examCycle) {
    return res.status(404).json({ success: false, message: 'Exam cycle not found' });
  }

  const canUpdate = await ensureTeacherAuthorizedForClass({
    user: req.user,
    className,
    section,
    academicYear: examCycle.academicYear
  });

  if (!canUpdate) {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to add class teacher remarks for this class'
    });
  }

  const marks = await ProgressMarkEntry.find({ examCycleId, studentId, className, section });
  const totalMarksObtained = marks.reduce((sum, item) => sum + (item.totalMarks || 0), 0);
  const totalMaxMarks = marks.reduce((sum, item) => sum + (item.maxMarks || 0), 0);
  const percentage = totalMaxMarks > 0 ? Number(((totalMarksObtained / totalMaxMarks) * 100).toFixed(2)) : 0;
  const gradeMeta = calculateGrade(percentage);

  const updated = await ProgressClassRemark.findOneAndUpdate(
    { examCycleId, studentId },
    {
      $set: {
        academicYear: examCycle.academicYear,
        className,
        section,
        totalMarksObtained,
        totalMaxMarks,
        percentage,
        gradeObtained: gradeMeta.grade,
        rankInClass,
        classTeacherRemark,
        promotedToClass,
        attendance,
        coCurricular,
        personality,
        resultDeclaredOn: new Date(),
        enteredBy: req.user._id
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
    .populate('studentId', 'admissionNumber student.firstName student.lastName class')
    .populate('examCycleId', 'examName examCode academicYear');

  res.status(200).json({
    success: true,
    data: updated,
    message: 'Class teacher remark saved successfully'
  });
});

export const publishExamResults = asyncHandler(async (req, res) => {
  const { examCycleId } = req.params;

  const examCycle = await ProgressExamCycle.findById(examCycleId);
  if (!examCycle) {
    return res.status(404).json({ success: false, message: 'Exam cycle not found' });
  }

  examCycle.isPublished = true;
  examCycle.publishedAt = new Date();
  examCycle.publishedBy = req.user._id;
  await examCycle.save();

  const marksUpdate = await ProgressMarkEntry.updateMany(
    { examCycleId: examCycle._id },
    {
      $set: {
        status: 'Published',
        isLocked: true,
        verifiedBy: req.user._id,
        verifiedDate: new Date()
      }
    }
  );

  res.json({
    success: true,
    data: {
      examCycle,
      marksPublished: marksUpdate.modifiedCount || 0
    },
    message: 'Exam results published successfully'
  });
});

export const getStudentProgressReport = asyncHandler(async (req, res) => {
  const routeStudentId = req.params.studentId;
  const { examCycleId, academicYear } = req.query;

  let studentId = routeStudentId;

  if (req.user.role === 'student') {
    studentId = req.user.linkedId ? String(req.user.linkedId) : routeStudentId;
  }

  if (!studentId) {
    return res.status(400).json({
      success: false,
      message: 'studentId is required'
    });
  }

  if (req.user.role === 'parent' && req.user.linkedId && String(req.user.linkedId) !== String(studentId)) {
    return res.status(403).json({
      success: false,
      message: 'Parents can only view linked student report'
    });
  }

  const student = await Student.findById(studentId).select('admissionNumber student class');
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  const filter = {
    studentId
  };

  if (examCycleId) filter.examCycleId = examCycleId;
  if (academicYear) filter.academicYear = academicYear;

  if (!ADMIN_ROLES.includes(req.user.role) && req.user.role !== 'teacher') {
    filter.status = 'Published';
  }

  const entries = await ProgressMarkEntry.find(filter)
    .populate('subjectId', 'subjectName subjectCode')
    .populate('examCycleId', 'examName examType examSequence academicYear isPublished')
    .sort({ 'examCycleId.examSequence': 1, createdAt: 1 });

  const grouped = new Map();
  for (const entry of entries) {
    const key = String(entry.examCycleId?._id || 'unknown');
    if (!grouped.has(key)) {
      grouped.set(key, {
        exam: entry.examCycleId,
        subjects: [],
        totals: { obtained: 0, max: 0, percentage: 0 },
        weakSubjects: []
      });
    }

    const item = grouped.get(key);
    item.subjects.push(entry);
    item.totals.obtained += entry.totalMarks || 0;
    item.totals.max += entry.maxMarks || 0;
    if ((entry.totalMarks || 0) < (entry.passingMarks || 35)) {
      item.weakSubjects.push(entry.subjectId?.subjectName || 'Unknown Subject');
    }
  }

  const reports = Array.from(grouped.values()).map((item) => {
    const percentage = item.totals.max > 0 ? Number(((item.totals.obtained / item.totals.max) * 100).toFixed(2)) : 0;
    const gradeMeta = calculateGrade(percentage);
    return {
      ...item,
      totals: {
        ...item.totals,
        percentage,
        grade: gradeMeta.grade
      },
      weakStudentFlag: item.weakSubjects.length >= 2
    };
  });

  const classRemarks = await ProgressClassRemark.find({
    studentId,
    ...(examCycleId ? { examCycleId } : {})
  })
    .populate('examCycleId', 'examName examType examSequence academicYear')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      student,
      reports,
      classTeacherRemarks: classRemarks,
      generatedAt: new Date(),
      note: 'Report card PDF generation can be layered on top of this endpoint.'
    }
  });
});

export const getClassExamSummary = asyncHandler(async (req, res) => {
  const { examCycleId, className, section } = req.query;

  if (!examCycleId || !className || !section) {
    return res.status(400).json({
      success: false,
      message: 'examCycleId, className and section are required'
    });
  }

  const examCycle = await ProgressExamCycle.findById(examCycleId).select('academicYear examName examSequence examType');
  if (!examCycle) {
    return res.status(404).json({ success: false, message: 'Exam cycle not found' });
  }

  const canView = await ensureTeacherAuthorizedForClass({
    user: req.user,
    className,
    section,
    academicYear: examCycle.academicYear
  });

  if (!canView && !['student', 'parent'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to view this class summary'
    });
  }

  const entries = await ProgressMarkEntry.find({ examCycleId, className, section })
    .populate('subjectId', 'subjectName subjectCode')
    .populate('studentId', 'admissionNumber student.firstName student.lastName');

  const studentSummaryMap = new Map();

  for (const entry of entries) {
    const studentKey = String(entry.studentId?._id || entry.studentId);

    if (!studentSummaryMap.has(studentKey)) {
      studentSummaryMap.set(studentKey, {
        student: entry.studentId,
        obtained: 0,
        max: 0,
        subjects: []
      });
    }

    const summary = studentSummaryMap.get(studentKey);
    summary.obtained += entry.totalMarks || 0;
    summary.max += entry.maxMarks || 0;
    summary.subjects.push({
      subject: entry.subjectId,
      marks: entry.totalMarks,
      maxMarks: entry.maxMarks,
      status: entry.passingStatus,
      grade: entry.grade
    });
  }

  const students = Array.from(studentSummaryMap.values())
    .map((item) => {
      const percentage = item.max > 0 ? Number(((item.obtained / item.max) * 100).toFixed(2)) : 0;
      return {
        ...item,
        percentage,
        grade: calculateGrade(percentage).grade
      };
    })
    .sort((a, b) => b.percentage - a.percentage)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const classAverage = students.length
    ? Number((students.reduce((sum, s) => sum + s.percentage, 0) / students.length).toFixed(2))
    : 0;

  res.json({
    success: true,
    data: {
      examCycle,
      className,
      section,
      totalStudents: students.length,
      classAverage,
      students
    }
  });
});
