import Class from '../models/Class.js';
import Assignment from '../models/Assignment.js';
import StudentPerformance from '../models/StudentPerformance.js';
import ClassSchedule from '../models/ClassSchedule.js';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Get all classes assigned to teacher
 * @route   GET /api/teacher/classes
 * @access  Private (Teacher)
 */
export const getMyClasses = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;

  // Get class schedules to find assigned classes
  const classSchedules = await ClassSchedule.find({
    teacherId
  })
    .populate('classId', 'className')
    .distinct('classId');

  const classes = await Class.find({
    _id: { $in: classSchedules }
  });

  res.status(200).json({
    success: true,
    count: classes.length,
    data: classes
  });
});

/**
 * @desc    Get detailed information for a class
 * @route   GET /api/teacher/classes/:classId
 * @access  Private (Teacher)
 */
export const getClassDetails = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const teacherId = req.user._id;

  // Verify teacher is assigned to this class
  const isAssigned = await ClassSchedule.findOne({
    classId,
    teacherId
  });

  if (!isAssigned) {
    return res.status(403).json({
      success: false,
      message: 'You are not assigned to this class'
    });
  }

  const classData = await Class.findById(classId);

  if (!classData) {
    return res.status(404).json({
      success: false,
      message: 'Class not found'
    });
  }

  // Get teacher's subjects in this class
  const subjects = await ClassSchedule.find({
    classId,
    teacherId
  })
    .populate('subjectId', 'subjectName subjectCode')
    .distinct('subjectId');

  // Count assignments
  const assignmentCount = await Assignment.countDocuments({
    classId,
    teacherId
  });

  // Get class statistics
  const totalSections = classData.sections?.length || 0;

  const details = {
    class: classData,
    sections: classData.sections || [],
    subjects,
    statistics: {
      totalSections,
      totalSubjectsAssigned: subjects.length,
      totalAssignments: assignmentCount
    }
  };

  res.status(200).json({
    success: true,
    data: details
  });
});

/**
 * @desc    Get all sections in a class
 * @route   GET /api/teacher/classes/:classId/sections
 * @access  Private (Teacher)
 */
export const getClassSections = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const teacherId = req.user._id;

  // Verify teacher is assigned to this class
  const isAssigned = await ClassSchedule.findOne({
    classId,
    teacherId
  });

  if (!isAssigned) {
    return res.status(403).json({
      success: false,
      message: 'You are not assigned to this class'
    });
  }

  const classData = await Class.findById(classId);

  if (!classData) {
    return res.status(404).json({
      success: false,
      message: 'Class not found'
    });
  }

  const sections = classData.sections || [];

  const sectionsWithStats = sections.map((s, index) => ({
    _id: index,
    sectionName: s,
    totalStudents: 0
  }));

  res.status(200).json({
    success: true,
    count: sectionsWithStats.length,
    data: sectionsWithStats
  });
});

/**
 * @desc    Get students in a section
 * @route   GET /api/teacher/classes/:classId/sections/:sectionId/students
 * @access  Private (Teacher)
 */
export const getSectionStudents = asyncHandler(async (req, res) => {
  const { classId, sectionId } = req.params;
  const teacherId = req.user._id;

  // Verify teacher is assigned to this class
  const isAssigned = await ClassSchedule.findOne({
    classId,
    teacherId
  });

  if (!isAssigned) {
    return res.status(403).json({
      success: false,
      message: 'You are not assigned to this class'
    });
  }

  const classData = await Class.findById(classId);

  if (!classData) {
    return res.status(404).json({
      success: false,
      message: 'Class not found'
    });
  }

  const sectionName = classData.sections?.[sectionId];

  if (!sectionName) {
    return res.status(404).json({
      success: false,
      message: 'Section not found'
    });
  }

  res.status(200).json({
    success: true,
    count: 0,
    data: {
      section: {
        _id: sectionId,
        sectionName
      },
      students: []
    }
  });
});

/**
 * @desc    Get class performance summary
 * @route   GET /api/teacher/classes/:classId/performance-summary
 * @access  Private (Teacher)
 */
export const getClassPerformanceSummary = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { subjectId } = req.query;
  const teacherId = req.user._id;

  // Verify teacher is assigned to this class
  const isAssigned = await ClassSchedule.findOne({
    classId,
    teacherId
  });

  if (!isAssigned) {
    return res.status(403).json({
      success: false,
      message: 'You are not assigned to this class'
    });
  }

  let query = {
    classId,
    teacherId
  };

  if (subjectId) query.subjectId = subjectId;

  const performances = await StudentPerformance.find(query)
    .populate('studentId', 'name rollNumber');

  const summary = {
    totalStudents: performances.length,
    excellentStudents: performances.filter(p => p.overallPerformance === 'excellent').length,
    aboveAverageStudents: performances.filter(p => p.overallPerformance === 'above-average').length,
    averageStudents: performances.filter(p => p.overallPerformance === 'average').length,
    belowAverageStudents: performances.filter(p => p.overallPerformance === 'below-average').length,
    failingStudents: performances.filter(p => p.overallPerformance === 'failing').length,
    averagePercentage: (performances.reduce((sum, p) => sum + p.performancePercentage, 0) / performances.length).toFixed(2),
    averageAttendance: (performances.reduce((sum, p) => sum + p.attendanceRate, 0) / performances.length).toFixed(2),
    studentsNeedingIntervention: performances.filter(p => p.interventionsNeeded?.length > 0).length,
    alerts: performances
      .filter(p => p.overallPerformance === 'failing' || p.attendanceRate < 75 || p.performanceTrend === 'declining')
      .map(p => ({
        studentId: p.studentId._id,
        studentName: p.studentId.name,
        rollNumber: p.studentId.rollNumber,
        reason: p.overallPerformance === 'failing' ? 'Failing' : p.attendanceRate < 75 ? 'Low Attendance' : 'Declining Trend'
      }))
  };

  res.status(200).json({
    success: true,
    data: summary
  });
});

/**
 * @desc    Get class assignment statistics
 * @route   GET /api/teacher/classes/:classId/assignments-summary
 * @access  Private (Teacher)
 */
export const getClassAssignmentSummary = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const teacherId = req.user._id;

  // Verify teacher is assigned to this class
  const isAssigned = await ClassSchedule.findOne({
    classId,
    teacherId
  });

  if (!isAssigned) {
    return res.status(403).json({
      success: false,
      message: 'You are not assigned to this class'
    });
  }

  const assignments = await Assignment.find({
    classId,
    teacherId
  });

  const summary = {
    totalAssignments: assignments.length,
    draftAssignments: assignments.filter(a => a.status === 'draft').length,
    publishedAssignments: assignments.filter(a => a.status === 'published').length,
    closedAssignments: assignments.filter(a => a.status === 'closed').length,
    averageSubmissionCount: (assignments.reduce((sum, a) => sum + a.submissionCount, 0) / (assignments.length || 1)).toFixed(0),
    averageGradeCount: (assignments.reduce((sum, a) => sum + a.gradeCount, 0) / (assignments.length || 1)).toFixed(0),
    pendingAssignments: assignments.filter(a => a.status === 'published').map(a => ({
      _id: a._id,
      title: a.title,
      dueDate: a.dueDate,
      submissionCount: a.submissionCount,
      gradeCount: a.gradeCount,
      pendingGrades: a.submissionCount - a.gradeCount
    }))
  };

  res.status(200).json({
    success: true,
    data: summary
  });
});

/**
 * @desc    Get class schedule summary
 * @route   GET /api/teacher/classes/:classId/schedule-summary
 * @access  Private (Teacher)
 */
export const getClassScheduleSummary = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const teacherId = req.user._id;

  const schedules = await ClassSchedule.find({
    classId,
    teacherId,
    isActive: true
  })
    .populate('subjectId', 'subjectName subjectCode');

  const groupedByDay = {
    Sunday: [],
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: []
  };

  schedules.forEach(schedule => {
    groupedByDay[schedule.dayName].push({
      _id: schedule._id,
      subjectId: schedule.subjectId._id,
      subject: schedule.subjectId.subjectName,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      room: schedule.room,
      building: schedule.building
    });
  });

  const summary = {
    totalSessions: schedules.length,
    totalHours: (schedules.reduce((sum, s) => sum + s.duration, 0) / 60).toFixed(2),
    subjects: [...new Set(schedules.map(s => s.subjectId.subjectName))],
    schedule: groupedByDay,
    rooms: [...new Set(schedules.map(s => s.room).filter(Boolean))],
    buildings: [...new Set(schedules.map(s => s.building).filter(Boolean))]
  };

  res.status(200).json({
    success: true,
    data: summary
  });
});

/**
 * @desc    Get quick overview of all classes
 * @route   GET /api/teacher/classes/overview
 * @access  Private (Teacher)
 */
export const getClassesOverview = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;

  const classSchedules = await ClassSchedule.find({
    teacherId
  })
    .populate('classId', 'className level')
    .distinct('classId');

  const classes = await Class.find({
    _id: { $in: classSchedules }
  }).lean();

  // Get stats for each class
  const classesWithStats = await Promise.all(
    classes.map(async (cls) => {
      const totalSections = cls.sections?.length || 0;
      const assignmentCount = await Assignment.countDocuments({
        classId: cls._id,
        teacherId
      });
      const scheduleCount = await ClassSchedule.countDocuments({
        classId: cls._id,
        teacherId
      });

      return {
        _id: cls._id,
        className: cls.className,
        level: cls.level,
        totalSections,
        totalAssignments: assignmentCount,
        totalSchedules: scheduleCount
      };
    })
  );

  res.status(200).json({
    success: true,
    count: classesWithStats.length,
    data: classesWithStats
  });
});

export default {
  getMyClasses,
  getClassDetails,
  getClassSections,
  getSectionStudents,
  getClassPerformanceSummary,
  getClassAssignmentSummary,
  getClassScheduleSummary,
  getClassesOverview
};
