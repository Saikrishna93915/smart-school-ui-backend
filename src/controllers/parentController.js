/**
 * Parent Controller - Parent portal for viewing child information
 */

import asyncHandler from '../utils/asyncHandler.js';
import Student from '../models/Student.js';
import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import FeeStructure from '../models/FeeStructure.js';
import Payment from '../models/Payment.js';
import TimetableSlot from '../models/TimetableSlot.js';
import Timetable from '../models/Timetable.js';
import TimeSlot from '../models/TimeSlot.js';
import Subject from '../models/Subject.js';
import ProgressMarkEntry from '../models/ProgressMarkEntry.js';
import ProgressExamCycle from '../models/ProgressExamCycle.js';
import ProgressClassRemark from '../models/ProgressClassRemark.js';

/**
 * Helper: Get all children for a parent user
 */
async function getParentChildren(parentUser) {
  // First try children array on User
  if (parentUser.children && parentUser.children.length > 0) {
    const students = await Student.find({
      _id: { $in: parentUser.children },
      status: { $ne: "deleted" }
    }).lean();
    if (students.length > 0) return students;
  }

  // Fallback: find by parent email in Student
  const email = parentUser.email?.toLowerCase();
  if (email) {
    return await Student.find({
      $or: [
        { "parents.father.email": email },
        { "parents.mother.email": email }
      ],
      status: { $ne: "deleted" }
    }).lean();
  }

  return [];
}

/**
 * @desc    Get parent dashboard overview
 * @route   GET /api/parent/dashboard
 * @access  Private (Parent)
 */
export const getParentDashboard = asyncHandler(async (req, res) => {
  const children = await getParentChildren(req.user);

  if (children.length === 0) {
    return res.status(200).json({
      success: true,
      data: { children: [], summary: { totalChildren: 0, avgAttendance: 0, totalFeesDue: 0 } }
    });
  }

  const childIds = children.map(c => c._id);

  // Get today's date range
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  // Get today's attendance for all children
  const todayAttendance = await Attendance.find({
    studentId: { $in: childIds },
    date: { $gte: today, $lt: tomorrow }
  }).lean();

  // Get this month's fee data
  const feeData = await FeeStructure.find({
    studentId: { $in: childIds }
  }).lean();

  const totalDue = feeData.reduce((sum, f) => {
    const due = Math.max(0, (f.totalFee || 0) - (f.totalPaid || 0) - (f.discountApplied || 0));
    return sum + due;
  }, 0);

  // Build children summary
  const childrenSummary = children.map(child => {
    const attendance = todayAttendance.find(a => String(a.studentId) === String(child._id));
    const fees = feeData.find(f => String(f.studentId) === String(child._id));
    const totalFee = fees?.totalFee || 0;
    const totalPaid = fees?.totalPaid || 0;
    const due = Math.max(0, totalFee - totalPaid - (fees?.discountApplied || 0));

    return {
      id: child._id,
      name: `${child.student?.firstName || ''} ${child.student?.lastName || ''}`.trim() || child.admissionNumber,
      className: child.class?.className || '',
      section: child.class?.section || '',
      admissionNumber: child.admissionNumber,
      attendanceToday: attendance ? {
        morning: attendance.sessions?.morning || 'not_marked',
        afternoon: attendance.sessions?.afternoon || 'not_marked'
      } : null,
      feesDue: due,
      totalFee
    };
  });

  // Calculate average attendance for the month
  const monthStart = new Date(today.getUTCFullYear(), today.getUTCMonth(), 1);
  const monthAttendance = await Attendance.find({
    studentId: { $in: childIds },
    date: { $gte: monthStart, $lt: tomorrow }
  }).lean();

  let presentCount = 0;
  let totalCount = 0;
  for (const record of monthAttendance) {
    if (record.sessions?.morning === 'present') { presentCount++; totalCount++; }
    else if (record.sessions?.morning === 'absent') { totalCount++; }
    if (record.sessions?.afternoon === 'present') { presentCount++; totalCount++; }
    else if (record.sessions?.afternoon === 'absent') { totalCount++; }
  }

  res.status(200).json({
    success: true,
    data: {
      children: childrenSummary,
      summary: {
        totalChildren: children.length,
        avgAttendance: totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0,
        totalFeesDue: totalDue
      }
    }
  });
});

/**
 * @desc    Get child's attendance
 * @route   GET /api/parent/child/:childId/attendance
 * @access  Private (Parent)
 */
export const getChildAttendance = asyncHandler(async (req, res) => {
  const { childId } = req.params;
  const { startDate, endDate } = req.query;

  const children = await getParentChildren(req.user);
  const childIds = children.map(c => String(c._id));

  if (!childIds.includes(String(childId))) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const query = { studentId: childId };
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    query.date = { $gte: start, $lte: end };
  }

  const records = await Attendance.find(query).sort({ date: -1 }).limit(30).lean();

  const child = children.find(c => String(c._id) === childId);

  res.status(200).json({
    success: true,
    data: {
      child: child ? {
        name: `${child.student?.firstName || ''} ${child.student?.lastName || ''}`.trim(),
        className: child.class?.className || '',
        section: child.class?.section || ''
      } : null,
      records
    }
  });
});

/**
 * @desc    Get child's timetable
 * @route   GET /api/parent/child/:childId/timetable
 * @access  Private (Parent)
 */
export const getChildTimetable = asyncHandler(async (req, res) => {
  const { childId } = req.params;

  const children = await getParentChildren(req.user);
  const childIds = children.map(c => String(c._id));

  if (!childIds.includes(String(childId))) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const child = children.find(c => String(c._id) === childId);
  if (!child) {
    return res.status(404).json({ success: false, message: "Child not found" });
  }

  const timetable = await Timetable.findOne({
    classId: child._id, // Note: classId might not match student _id; use className
    status: { $ne: "archived" },
    isPublished: true
  }).lean();

  // Try finding by class name
  let slots = [];
  if (!timetable) {
    const t = await Timetable.findOne({
      'classId.className': child.class?.className,
      sectionId: child.class?.section,
      status: { $ne: "archived" },
      isPublished: true
    }).populate('classId', 'className').lean();

    if (t) {
      slots = await TimetableSlot.find({
        timetableId: t._id,
        isActive: true
      })
        .populate('timeSlotId')
        .populate('subjectId', 'subjectName subjectCode')
        .populate('teacherId', 'name')
        .sort({ dayOfWeek: 1, 'timeSlotId.displayOrder': 1 })
        .lean();
    }
  } else {
    slots = await TimetableSlot.find({
      timetableId: timetable._id,
      isActive: true
    })
      .populate('timeSlotId')
      .populate('subjectId', 'subjectName subjectCode')
      .populate('teacherId', 'name')
      .sort({ dayOfWeek: 1, 'timeSlotId.displayOrder': 1 })
      .lean();
  }

  res.status(200).json({
    success: true,
    data: {
      child: {
        name: `${child.student?.firstName || ''} ${child.student?.lastName || ''}`.trim(),
        className: child.class?.className || '',
        section: child.class?.section || ''
      },
      timetable: timetable || null,
      slots
    }
  });
});

/**
 * @desc    Get child's exam performance
 * @route   GET /api/parent/child/:childId/performance
 * @access  Private (Parent)
 */
export const getChildPerformance = asyncHandler(async (req, res) => {
  const { childId } = req.params;

  const children = await getParentChildren(req.user);
  const childIds = children.map(c => String(c._id));

  if (!childIds.includes(String(childId))) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const child = children.find(c => String(c._id) === childId);
  if (!child) {
    return res.status(404).json({ success: false, message: "Child not found" });
  }

  // Get all published exam cycles for this academic year
  const examCycles = await ProgressExamCycle.find({
    isPublished: true,
    academicYear: child.class?.academicYear || undefined
  }).sort({ examSequence: 1 }).lean();

  // Get all mark entries for this student
  const markEntries = await ProgressMarkEntry.find({
    studentId: childId
  }).populate('subjectId', 'subjectName subjectCode').populate('examCycleId', 'examName examType examSequence').lean();

  // Group marks by exam cycle
  const performanceByExam = examCycles.map(exam => {
    const entries = markEntries.filter(e => String(e.examCycleId?._id || e.examCycleId) === String(exam._id));
    const totalObtained = entries.reduce((sum, e) => sum + (e.totalMarks || 0), 0);
    const totalMax = entries.reduce((sum, e) => sum + (e.maxMarks || 0), 0);
    const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : 0;

    const subjects = entries.map(e => ({
      subjectName: e.subjectId?.subjectName || 'Unknown',
      subjectCode: e.subjectId?.subjectCode || '',
      marks: e.totalMarks,
      maxMarks: e.maxMarks,
      passingMarks: e.passingMarks,
      grade: e.grade,
      passingStatus: e.passingStatus
    }));

    return {
      examId: exam._id,
      examName: exam.examName,
      examType: exam.examType,
      percentage: parseFloat(percentage),
      totalObtained,
      totalMax,
      subjects
    };
  });

  res.status(200).json({
    success: true,
    data: {
      child: {
        name: `${child.student?.firstName || ''} ${child.student?.lastName || ''}`.trim(),
        className: child.class?.className || '',
        section: child.class?.section || ''
      },
      exams: performanceByExam
    }
  });
});

/**
 * @desc    Get child's report cards list
 * @route   GET /api/parent/child/:childId/reports
 * @access  Private (Parent)
 */
export const getChildReports = asyncHandler(async (req, res) => {
  const { childId } = req.params;

  const children = await getParentChildren(req.user);
  const childIds = children.map(c => String(c._id));

  if (!childIds.includes(String(childId))) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const child = children.find(c => String(c._id) === childId);
  if (!child) {
    return res.status(404).json({ success: false, message: "Child not found" });
  }

  // Get published exam cycles (these represent available reports)
  const examCycles = await ProgressExamCycle.find({
    isPublished: true,
    academicYear: child.class?.academicYear || undefined
  }).sort({ examSequence: 1 }).lean();

  // Get class teacher remarks for this student
  const classRemarks = await ProgressClassRemark.find({
    studentId: childId
  }).populate('examCycleId', 'examName examType').sort({ createdAt: -1 }).lean();

  const reports = examCycles.map(exam => {
    const remark = classRemarks.find(r => String(r.examCycleId?._id || r.examCycleId) === String(exam._id));
    return {
      reportId: exam._id,
      examName: exam.examName,
      examType: exam.examType,
      generatedOn: exam.resultDate || exam.updatedAt,
      format: 'PDF',
      hasTeacherRemark: !!remark?.classTeacherRemark,
      teacherRemark: remark?.classTeacherRemark || null,
      promotedToClass: remark?.promotedToClass || null,
      rankInClass: remark?.rankInClass || null,
      attendance: remark?.attendance || null
    };
  });

  res.status(200).json({
    success: true,
    data: {
      child: {
        name: `${child.student?.firstName || ''} ${child.student?.lastName || ''}`.trim(),
        className: child.class?.className || '',
        section: child.class?.section || ''
      },
      reports
    }
  });
});

/**
 * @desc    Get child's performance comparison with class
 * @route   GET /api/parent/child/:childId/comparison
 * @access  Private (Parent)
 */
export const getChildComparison = asyncHandler(async (req, res) => {
  const { childId } = req.params;
  const { examCycleId } = req.query;

  const children = await getParentChildren(req.user);
  const childIds = children.map(c => String(c._id));

  if (!childIds.includes(String(childId))) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const child = children.find(c => String(c._id) === childId);
  if (!child) {
    return res.status(404).json({ success: false, message: "Child not found" });
  }

  // Build query filter
  const query = { className: child.class?.className, section: child.class?.section };
  if (examCycleId) query.examCycleId = examCycleId;
  if (child.class?.academicYear) query.academicYear = child.class.academicYear;

  const allEntries = await ProgressMarkEntry.find(query)
    .populate('subjectId', 'subjectName subjectCode')
    .populate('examCycleId', 'examName examType')
    .lean();

  // Get this child's entries
  const childEntries = allEntries.filter(e => String(e.studentId) === childId);

  // Calculate class averages per subject
  const subjectMap = {};
  for (const entry of allEntries) {
    const subjectName = entry.subjectId?.subjectName || 'Unknown';
    if (!subjectMap[subjectName]) {
      subjectMap[subjectName] = { total: 0, count: 0, max: 0, childScore: null };
    }
    const pct = entry.maxMarks > 0 ? (entry.totalMarks / entry.maxMarks) * 100 : 0;
    subjectMap[subjectName].total += pct;
    subjectMap[subjectName].count++;
    if (pct > subjectMap[subjectName].max) subjectMap[subjectName].max = pct;

    if (String(entry.studentId) === childId) {
      subjectMap[subjectName].childScore = pct;
    }
  }

  const comparison = Object.entries(subjectMap).map(([subject, data]) => ({
    subjectName: subject,
    childPercentage: data.childScore ? data.childScore.toFixed(1) : 0,
    classAverage: data.count > 0 ? (data.total / data.count).toFixed(1) : 0,
    topScore: data.max.toFixed(1)
  }));

  // Overall comparison
  const childOverall = childEntries.reduce((sum, e) => {
    const pct = e.maxMarks > 0 ? (e.totalMarks / e.maxMarks) * 100 : 0;
    return sum + pct;
  }, 0);
  const classOverall = allEntries.reduce((sum, e) => {
    const pct = e.maxMarks > 0 ? (e.totalMarks / e.maxMarks) * 100 : 0;
    return sum + pct;
  }, 0);

  res.status(200).json({
    success: true,
    data: {
      child: {
        name: `${child.student?.firstName || ''} ${child.student?.lastName || ''}`.trim(),
        className: child.class?.className || '',
        section: child.class?.section || ''
      },
      overall: {
        childPercentage: childEntries.length > 0 ? (childOverall / childEntries.length).toFixed(1) : 0,
        classAverage: allEntries.length > 0 ? (classOverall / allEntries.length).toFixed(1) : 0
      },
      subjects: comparison
    }
  });
});

export default {
  getParentDashboard,
  getChildAttendance,
  getChildTimetable,
  getChildPerformance,
  getChildReports,
  getChildComparison
};
