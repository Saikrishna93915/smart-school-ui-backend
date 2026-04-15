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
import Announcement from '../models/Announcement.js';
import Assignment from '../models/Assignment.js';
import AssignmentSubmission from '../models/AssignmentSubmission.js';
import Trip from '../models/Trip.js';
import Vehicle from '../models/Vehicle.js';
import Class from '../models/Class.js';

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
      data: {
        children: [],
        summary: { totalChildren: 0, avgAttendance: 0, totalFeesDue: 0 },
        announcements: [],
        upcomingEvents: [],
        notifications: { unread: 0, alerts: [] }
      }
    });
  }

  const childIds = children.map(c => c._id);
  const childIdStrs = childIds.map(id => String(id));

  // ========================
  // 1. TODAY'S ATTENDANCE
  // ========================
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const todayAttendance = await Attendance.find({
    studentId: { $in: childIds },
    date: { $gte: today, $lt: tomorrow }
  }).lean();

  // ========================
  // 2. MONTHLY ATTENDANCE STATS
  // ========================
  const monthStart = new Date(today.getUTCFullYear(), today.getUTCMonth(), 1);
  const monthAttendance = await Attendance.find({
    studentId: { $in: childIds },
    date: { $gte: monthStart, $lt: tomorrow }
  }).lean();

  let presentCount = 0;
  let totalCount = 0;
  let absentCount = 0;
  for (const record of monthAttendance) {
    if (record.sessions?.morning === 'present') { presentCount++; totalCount++; }
    else if (record.sessions?.morning === 'absent') { absentCount++; totalCount++; }
    if (record.sessions?.afternoon === 'present') { presentCount++; totalCount++; }
    else if (record.sessions?.afternoon === 'absent') { absentCount++; totalCount++; }
  }

  const avgAttendance = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  // ========================
  // 3. FEES DATA
  // ========================
  const feeData = await FeeStructure.find({
    studentId: { $in: childIds }
  }).lean();

  const totalDue = feeData.reduce((sum, f) => {
    const due = Math.max(0, (f.totalFee || 0) - (f.totalPaid || 0) - (f.discountApplied || 0));
    return sum + due;
  }, 0);

  // Recent transactions (last 5 across all children)
  const recentTransactions = await Payment.find({
    studentId: { $in: childIds }
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('amount paidAmount dueAmount status paymentDate paymentMethod receiptNumber description studentName className')
    .lean();

  // ========================
  // 4. PERFORMANCE DATA
  // ========================
  const performanceData = await ProgressMarkEntry.aggregate([
    { $match: { studentId: { $in: childIdStrs } } },
    { $group: {
      _id: { studentId: '$studentId', examCycleId: '$examCycleId' },
      totalObtained: { $sum: '$totalMarks' },
      totalMax: { $sum: '$maxMarks' },
      subjectCount: { $sum: 1 }
    }},
    { $sort: { '_id.examCycleId': -1 } }
  ]);

  const examCycleIds = [...new Set(performanceData.map(p => String(p._id.examCycleId)))];
  const examCycles = await ProgressExamCycle.find({ _id: { $in: examCycleIds } })
    .select('_id examName examType')
    .lean();
  const examMap = {};
  examCycles.forEach(e => { examMap[String(e._id)] = e; });

  const childPerformanceMap = {};
  for (const perf of performanceData) {
    const studentId = String(perf._id.studentId);
    if (!childPerformanceMap[studentId]) {
      childPerformanceMap[studentId] = { latestExam: null, overallPercentage: 0, examsTaken: 0 };
    }
    const exam = examMap[String(perf._id.examCycleId)];
    const pct = perf.totalMax > 0 ? ((perf.totalObtained / perf.totalMax) * 100).toFixed(1) : 0;

    if (!childPerformanceMap[studentId].latestExam) {
      childPerformanceMap[studentId].latestExam = {
        name: exam?.examName || 'Unknown',
        type: exam?.examType || '',
        percentage: parseFloat(pct),
        totalObtained: perf.totalObtained,
        totalMax: perf.totalMax,
        subjects: perf.subjectCount
      };
    }
    childPerformanceMap[studentId].examsTaken++;
  }

  // ========================
  // 5. ANNOUNCEMENTS (latest 5 published, not expired)
  // ========================
  const now = new Date();
  const announcements = await Announcement.find({
    status: 'published',
    $or: [
      { 'audience.type': 'all' },
      { 'audience.type': 'parents' },
      { 'audience.parentIds': { $in: [req.user._id] } }
    ],
    $or: [
      { expiresAt: { $gt: now } },
      { expiresAt: null }
    ]
  })
    .sort({ pinned: -1, createdAt: -1 })
    .limit(5)
    .select('title type priority createdAt pinned')
    .lean();

  // ========================
  // 6. UPCOMING EXAM EVENTS
  // ========================
  const upcomingExams = await ProgressExamCycle.find({
    isPublished: true,
    resultDate: { $gte: now }
  })
    .sort({ resultDate: 1 })
    .limit(3)
    .select('examName examType resultDate')
    .lean();

  // ========================
  // 7. HOMEWORK / ASSIGNMENTS (pending for each child's class)
  // ========================
  // Look up Class ObjectIds by className/section (Assignment.classId is an ObjectId ref)
  const classNames = [...new Set(children.map(c => c.class?.className).filter(Boolean))];
  const sections = [...new Set(children.map(c => c.class?.section).filter(Boolean))];

  let classObjectIds = [];
  if (classNames.length > 0) {
    const classes = await Class.find({ className: { $in: classNames } }).select('_id className').lean();
    classObjectIds = classes.map(c => c._id);
  }

  // Query assignments by resolved class ObjectIds
  const pendingAssignments = classObjectIds.length > 0
    ? await Assignment.find({
        classId: { $in: classObjectIds },
        sectionId: { $in: sections },
        status: 'published',
        dueDate: { $gte: now }
      })
        .sort({ dueDate: 1 })
        .limit(5)
        .populate('subjectId', 'subjectName')
        .select('title subjectId dueDate totalPoints status')
        .lean()
    : [];

  // Count pending submissions per child (by className + section)
  const assignmentCounts = {};
  for (const child of children) {
    const childClassObj = classObjectIds.length > 0
      ? await Class.findOne({ className: child.class?.className }).select('_id').lean()
      : null;

    const count = childClassObj
      ? await Assignment.countDocuments({
          classId: childClassObj._id,
          sectionId: child.class?.section,
          status: 'published',
          dueDate: { $gte: now }
        })
      : 0;
    assignmentCounts[String(child._id)] = count;
  }

  // ========================
  // 8. TRANSPORT STATUS (today's trips for children)
  // ========================
  const transportData = {};
  for (const child of children) {
    if (child.transport === 'yes') {
      const todayTrip = await Trip.findOne({
        'students.studentId': child._id,
        scheduledStart: { $gte: today, $lt: tomorrow },
        status: { $in: ['scheduled', 'in-progress'] }
      })
        .populate('vehicle', 'vehicleNo type status currentLocation')
        .select('tripType status scheduledStart actualStart vehicle')
        .lean();

      if (todayTrip) {
        const studentTrip = todayTrip.students.find(s => String(s.studentId) === String(child._id));
        const vehicle = todayTrip.vehicle;
        transportData[String(child._id)] = {
          vehicleNo: vehicle?.vehicleNo || 'N/A',
          vehicleType: vehicle?.type || 'bus',
          tripType: todayTrip.tripType,
          status: todayTrip.status,
          scheduledStart: todayTrip.scheduledStart,
          actualStart: todayTrip.actualStart,
          boardingStop: studentTrip?.boardingStop
        };
      }
    }
  }

  // ========================
  // 9. BUILD CHILDREN SUMMARY
  // ========================
  const childrenSummary = children.map(child => {
    const attendance = todayAttendance.find(a => String(a.studentId) === String(child._id));
    const fees = feeData.find(f => String(f.studentId) === String(child._id));
    const totalFee = fees?.totalFee || 0;
    const totalPaid = fees?.totalPaid || 0;
    const due = Math.max(0, totalFee - totalPaid - (fees?.discountApplied || 0));
    const perf = childPerformanceMap[String(child._id)] || { latestExam: null, overallPercentage: 0, examsTaken: 0 };

    // Get next due date from payment schedule
    let nextDueDate = null;
    if (fees?.paymentSchedule) {
      const upcoming = fees.paymentSchedule
        .filter(s => s.status === 'pending' && new Date(s.dueDate) >= now)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
      if (upcoming) nextDueDate = upcoming.dueDate;
    }

    return {
      id: child._id,
      name: `${child.student?.firstName || ''} ${child.student?.lastName || ''}`.trim() || child.admissionNumber,
      className: child.class?.className || '',
      section: child.class?.section || '',
      admissionNumber: child.admissionNumber,
      dob: child.student?.dob,
      gender: child.student?.gender,
      attendanceToday: attendance ? {
        morning: attendance.sessions?.morning || 'not_marked',
        afternoon: attendance.sessions?.afternoon || 'not_marked'
      } : null,
      attendanceMonthly: {
        present: presentCount,
        absent: absentCount,
        total: totalCount,
        percentage: totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0
      },
      feesDue: due,
      totalFee,
      totalPaid,
      nextDueDate,
      performance: perf,
      transport: transportData[String(child._id)] || null,
      pendingAssignments: assignmentCounts[String(child._id)] || 0
    };
  });

  // ========================
  // 10. NOTIFICATIONS (unread count + recent alerts)
  // ========================
  // Count unpaid/overdue payments as alerts
  const overduePayments = await Payment.find({
    studentId: { $in: childIds },
    status: { $in: ['pending', 'overdue'] }
  })
    .sort({ dueDate: 1 })
    .limit(3)
    .select('studentName amount dueAmount status dueDate')
    .lean();

  const notifications = {
    unread: overduePayments.length,
    alerts: overduePayments.map(p => ({
      type: 'fee_alert',
      message: `Fee payment pending for ${p.studentName}`,
      amount: p.dueAmount,
      status: p.status,
      dueDate: p.dueDate
    }))
  };

  // ========================
  // 11. FORMAT ANNOUNCEMENTS
  // ========================
  const formattedAnnouncements = announcements.map(a => ({
    id: a._id,
    title: a.title,
    type: a.type,
    priority: a.priority,
    date: a.createdAt,
    pinned: a.pinned
  }));

  // ========================
  // 12. FORMAT UPCOMING EVENTS
  // ========================
  const upcomingEvents = upcomingExams.map(e => ({
    id: e._id,
    title: `${e.examName} (${e.examType})`,
    type: 'exam',
    date: e.resultDate
  }));

  // Add pending assignments as events
  pendingAssignments.forEach(a => {
    upcomingEvents.push({
      id: a._id,
      title: `${a.title}`,
      type: 'assignment',
      date: a.dueDate,
      subject: a.subjectId?.subjectName || 'Unknown'
    });
  });

  // Sort events by date, keep top 5
  upcomingEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

  // ========================
  // 13. FORMAT RECENT TRANSACTIONS
  // ========================
  const formattedTransactions = recentTransactions.map(t => ({
    id: t._id,
    studentName: t.studentName,
    className: t.className,
    amount: t.amount || t.paidAmount || 0,
    dueAmount: t.dueAmount || 0,
    status: t.status,
    date: t.paymentDate || t.createdAt,
    paymentMethod: t.paymentMethod,
    receiptNumber: t.receiptNumber,
    description: t.description
  }));

  // ========================
  // 14. BUILD FINAL RESPONSE
  // ========================
  res.status(200).json({
    success: true,
    data: {
      children: childrenSummary,
      summary: {
        totalChildren: children.length,
        avgAttendance,
        totalFeesDue: totalDue
      },
      announcements: formattedAnnouncements,
      upcomingEvents: upcomingEvents.slice(0, 5),
      recentTransactions: formattedTransactions,
      notifications,
      pendingAssignments: pendingAssignments.map(a => ({
        id: a._id,
        title: a.title,
        subject: a.subjectId?.subjectName || 'Unknown',
        dueDate: a.dueDate,
        totalPoints: a.totalPoints
      }))
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
