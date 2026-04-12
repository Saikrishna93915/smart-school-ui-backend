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

export default {
  getParentDashboard,
  getChildAttendance,
  getChildTimetable
};
