import ClassSchedule from '../models/ClassSchedule.js';
import Attendance from '../models/Attendance.js';
import StudentPerformance from '../models/StudentPerformance.js';
import ClassAnnouncement from '../models/ClassAnnouncement.js';
import Assignment from '../models/Assignment.js';
import User from '../models/User.js';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Get teacher dashboard overview
 * @route   GET /api/teacher/dashboard
 * @access  Private (Teacher)
 */
export const getDashboardOverview = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get today's classes
  const todaysClassSchedules = await ClassSchedule.find({
    teacherId,
    dayOfWeek: today.getDay(),
    isActive: true
  })
    .populate('classId', 'className')
    .populate('sectionId', 'section')
    .populate('subjectId', 'subjectName')
    .lean();

  // Get attendance pending for today
  const pendingAttendance = await Attendance.find({
    teacherId,
    date: {
      $gte: today,
      $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
    },
    status: { $ne: 'marked' }
  })
    .populate('classId', 'className')
    .populate('sectionId', 'section')
    .lean();

  // Get performance alerts (students below 75%)
  const performanceAlerts = await StudentPerformance.find({
    teacherId,
    overallPerformance: { $in: ['failing', 'below-average'] }
  })
    .populate('studentId', 'name email')
    .populate('classId', 'className')
    .limit(5)
    .lean();

  // Get pending assignments
  const pendingAssignments = await Assignment.find({
    teacherId,
    status: 'published',
    dueDate: { $gte: today }
  })
    .populate('classId', 'className')
    .sort({ dueDate: 1 })
    .limit(5)
    .lean();

  // Get recent class announcements
  const recentAnnouncements = await ClassAnnouncement.find({
    teacherId,
    isActive: true,
    datePosted: {
      $gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    }
  })
    .sort({ datePosted: -1 })
    .limit(5)
    .lean();

  res.status(200).json({
    success: true,
    data: {
      todaysClasses: {
        count: todaysClassSchedules.length,
        classes: todaysClassSchedules
      },
      pendingTasks: {
        attendanceCount: pendingAttendance.length,
        assignmentCount: pendingAssignments.length,
        totalPending: pendingAttendance.length + pendingAssignments.length
      },
      performanceAlerts: {
        count: performanceAlerts.length,
        alerts: performanceAlerts
      },
      recentAnnouncements: recentAnnouncements,
      timestamp: new Date()
    }
  });
});

/**
 * @desc    Get quick statistics for dashboard
 * @route   GET /api/teacher/dashboard/statistics
 * @access  Private (Teacher)
 */
export const getDashboardStatistics = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;

  // Get classes managed by this teacher from class schedules
  const schedules = await ClassSchedule.find({ teacherId }).lean();
  const uniqueClassIds = [...new Set(schedules.map(s => String(s.classId)))];

  // Total students in those classes
  const students = await User.countDocuments({
    role: 'student'
  });

  // Total classes
  const classes = uniqueClassIds.length;

  // Average attendance rate
  const attendanceData = await Attendance.aggregate([
    {
      $match: {
        teacherId,
        status: 'marked'
      }
    },
    {
      $group: {
        _id: '$studentId',
        attendedClasses: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        averageAttendance: { $avg: '$attendedClasses' }
      }
    }
  ]);

  const avgAttendance = attendanceData.length > 0 ? attendanceData[0].averageAttendance : 0;

  // Total assignments
  const totalAssignments = await Assignment.countDocuments({
    teacherId,
    status: 'published'
  });

  // Total study materials
  const totalMaterials = await StudyMaterial.countDocuments({
    teacherId
  });

  res.status(200).json({
    success: true,
    data: {
      totalClasses: classes,
      totalStudents: students,
      totalAssignments,
      totalMaterials,
      averageAttendanceRate: Math.round(avgAttendance),
      statistics: {
        classesManaged: classes,
        studentsSupervised: students,
        activeAssignments: totalAssignments,
        resourcesCreated: totalMaterials
      }
    }
  });
});

/**
 * @desc    Get pending tasks widget data
 * @route   GET /api/teacher/dashboard/pending-tasks
 * @access  Private (Teacher)
 */
export const getPendingTasks = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Attendance to mark
  const attendanceCount = await Attendance.countDocuments({
    teacherId,
    date: {
      $gte: today,
      $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
    },
    status: { $ne: 'marked' }
  });

  // Assignments to grade
  const ungraduatedSubmissions = await AssignmentSubmission.countDocuments({
    status: 'submitted',
    gradedBy: teacherId
  });

  // Announcements to post
  const scheduledAnnouncements = await ClassAnnouncement.countDocuments({
    teacherId,
    isScheduled: true,
    schedulePublish: {
      $lte: new Date()
    },
    isActive: false
  });

  res.status(200).json({
    success: true,
    data: {
      tasksToMark: attendanceCount,
      submissionsToGrade: ungraduatedSubmissions,
      announcementsToPost: scheduledAnnouncements,
      totalPendingTasks: attendanceCount + ungraduatedSubmissions + scheduledAnnouncements
    }
  });
});

/**
 * @desc    Get alerts for students with low performance/attendance
 * @route   GET /api/teacher/dashboard/alerts
 * @access  Private (Teacher)
 */
export const getStudentAlerts = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;

  const alerts = await StudentPerformance.find({
    teacherId
  })
    .or([
      { overallPerformance: { $in: ['failing', 'below-average'] } },
      { attendanceRate: { $lt: 75 } },
      { performanceTrend: 'declining' }
    ])
    .populate('studentId', 'name email')
    .populate('classId', 'className')
    .limit(10)
    .lean();

  // Format alerts
  const formattedAlerts = alerts.map(alert => {
    let severity = 'info';
    let reason = [];

    if (alert.overallPerformance === 'failing') {
      severity = 'critical';
      reason.push('Low performance');
    } else if (alert.overallPerformance === 'below-average') {
      severity = 'high';
      reason.push('Below average');
    }

    if (alert.attendanceRate < 75) {
      severity = severity === 'critical' ? 'critical' : 'high';
      reason.push(`Low attendance (${alert.attendanceRate}%)`);
    }

    if (alert.performanceTrend === 'declining') {
      severity = severity === 'critical' ? 'critical' : 'high';
      reason.push('Declining performance');
    }

    return {
      studentId: alert.studentId._id,
      studentName: alert.studentId.name,
      className: alert.classId.className,
      severity,
      reasons: reason,
      performancePercentage: alert.performancePercentage,
      attendanceRate: alert.attendanceRate,
      trend: alert.performanceTrend
    };
  });

  res.status(200).json({
    success: true,
    data: {
      totalAlerts: formattedAlerts.length,
      alerts: formattedAlerts.sort((a, b) => {
        const severityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
    }
  });
});

export default {
  getDashboardOverview,
  getDashboardStatistics,
  getPendingTasks,
  getStudentAlerts
};
