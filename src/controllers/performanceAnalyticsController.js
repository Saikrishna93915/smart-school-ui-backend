import StudentPerformance from '../models/StudentPerformance.js';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Get performance data for a specific student in a subject
 * @route   GET /api/teacher/analytics/student/:studentId/:subjectId
 * @access  Private (Teacher)
 */
export const getStudentPerformance = asyncHandler(async (req, res) => {
  const { studentId, subjectId } = req.params;
  const teacherId = req.user._id;

  const performance = await StudentPerformance.findOne({
    studentId,
    subjectId,
    teacherId
  }).populate('studentId', 'name email personal.firstName personal.lastName rollNumber');

  if (!performance) {
    return res.status(404).json({
      success: false,
      message: 'Performance record not found'
    });
  }

  res.status(200).json({
    success: true,
    data: performance
  });
});

/**
 * @desc    Get all students' performance for a class
 * @route   GET /api/teacher/analytics/class/:classId/:subjectId
 * @access  Private (Teacher)
 */
export const getClassPerformance = asyncHandler(async (req, res) => {
  const { classId, subjectId } = req.params;
  const teacherId = req.user._id;

  const performances = await StudentPerformance.find({
    classId,
    subjectId,
    teacherId
  })
    .populate('studentId', 'name rollNumber personal.firstName personal.lastName')
    .sort({ performancePercentage: -1 });

  // Calculate class statistics
  const classStats = {
    totalStudents: performances.length,
    excellentCount: performances.filter(p => p.overallPerformance === 'excellent').length,
    aboveAverageCount: performances.filter(p => p.overallPerformance === 'above-average').length,
    averageCount: performances.filter(p => p.overallPerformance === 'average').length,
    belowAverageCount: performances.filter(p => p.overallPerformance === 'below-average').length,
    failingCount: performances.filter(p => p.overallPerformance === 'failing').length,
    averagePercentage: (performances.reduce((sum, p) => sum + p.performancePercentage, 0) / performances.length).toFixed(2),
    averageAttendance: (performances.reduce((sum, p) => sum + p.attendanceRate, 0) / performances.length).toFixed(2)
  };

  res.status(200).json({
    success: true,
    count: performances.length,
    statistics: classStats,
    data: performances
  });
});

/**
 * @desc    Get top performing students
 * @route   GET /api/teacher/analytics/top-performers/:classId/:subjectId
 * @access  Private (Teacher)
 */
export const getTopPerformers = asyncHandler(async (req, res) => {
  const { classId, subjectId } = req.params;
  const { limit = 10 } = req.query;
  const teacherId = req.user._id;

  const topPerformers = await StudentPerformance.find({
    classId,
    subjectId,
    teacherId
  })
    .populate('studentId', 'name rollNumber personal.firstName personal.lastName')
    .sort({ performancePercentage: -1 })
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    count: topPerformers.length,
    data: topPerformers.map(p => ({
      studentId: p.studentId._id,
      studentName: p.studentId.name,
      rollNumber: p.studentId.rollNumber,
      performancePercentage: p.performancePercentage,
      performanceGrade: p.performanceGrade,
      averageExamMarks: p.examMarks.averageMarks,
      averageAssignmentMarks: p.assignmentMarks.averageMarks,
      attendanceRate: p.attendanceRate
    }))
  });
});

/**
 * @desc    Get struggling students
 * @route   GET /api/teacher/analytics/struggling/:classId/:subjectId
 * @access  Private (Teacher)
 */
export const getStrugglingStudents = asyncHandler(async (req, res) => {
  const { classId, subjectId } = req.params;
  const teacherId = req.user._id;

  const strugglingStudents = await StudentPerformance.find({
    classId,
    subjectId,
    teacherId,
    $or: [
      { overallPerformance: { $in: ['failing', 'below-average'] } },
      { attendanceRate: { $lt: 75 } },
      { performanceTrend: 'declining' }
    ]
  })
    .populate('studentId', 'name rollNumber personal.firstName personal.lastName email');

  // Group by severity
  const grouped = {
    critical: strugglingStudents.filter(s => s.overallPerformance === 'failing'),
    highRisk: strugglingStudents.filter(
      s => s.overallPerformance === 'below-average' && s.attendanceRate < 75
    ),
    atRisk: strugglingStudents.filter(
      s => s.overallPerformance === 'below-average' || s.performanceTrend === 'declining'
    )
  };

  res.status(200).json({
    success: true,
    data: grouped
  });
});

/**
 * @desc    Get performance trend for a student
 * @route   GET /api/teacher/analytics/student-trend/:studentId/:subjectId
 * @access  Private (Teacher)
 */
export const getStudentTrend = asyncHandler(async (req, res) => {
  const { studentId, subjectId } = req.params;
  const teacherId = req.user._id;

  const performance = await StudentPerformance.findOne({
    studentId,
    subjectId,
    teacherId
  })
    .populate('studentId', 'name rollNumber')
    .populate('progressNotes');

  if (!performance) {
    return res.status(404).json({
      success: false,
      message: 'Performance record not found'
    });
  }

  // Extract trend data
  const trendData = {
    student: {
      name: performance.studentId.name,
      rollNumber: performance.studentId.rollNumber
    },
    currentTrend: performance.performanceTrend,
    examHistory: performance.examMarks.exams.map(e => ({
      examName: e.examName,
      marks: e.marks,
      totalMarks: e.totalMarks,
      percentage: e.percentage,
      date: e.date
    })),
    assignmentHistory: performance.assignmentMarks.submissions.map(s => ({
      title: s.title,
      marks: s.obtainedPoints,
      totalMarks: s.totalPoints,
      percentage: s.percentage,
      submittedDate: s.submittedDate
    })),
    attendanceHistory: {
      totalClasses: performance.attendanceData.totalClasses,
      attended: performance.attendanceData.classesAttended,
      rate: performance.attendanceRate
    },
    performanceChange: {
      previousPercentage: performance.performancePercentage,
      trend: performance.performanceTrend,
      improvementRate: 0 // Can be calculated if historical data exists
    },
    recentComments: performance.teacherComments.slice(-5)
  };

  res.status(200).json({
    success: true,
    data: trendData
  });
});

/**
 * @desc    Get attendance analysis for a class
 * @route   GET /api/teacher/analytics/attendance/:classId/:subjectId
 * @access  Private (Teacher)
 */
export const getAttendanceAnalysis = asyncHandler(async (req, res) => {
  const { classId, subjectId } = req.params;
  const teacherId = req.user._id;

  const performances = await StudentPerformance.find({
    classId,
    subjectId,
    teacherId
  }).populate('studentId', 'name rollNumber');

  const analysis = {
    classTotal: performances.length,
    excellentAttendance: performances.filter(p => p.attendanceRate >= 95).length,
    goodAttendance: performances.filter(p => p.attendanceRate >= 85 && p.attendanceRate < 95).length,
    averageAttendance: performances.filter(p => p.attendanceRate >= 75 && p.attendanceRate < 85).length,
    poorAttendance: performances.filter(p => p.attendanceRate < 75).length,
    classAverageAttendance: (performances.reduce((sum, p) => sum + p.attendanceRate, 0) / performances.length).toFixed(2),
    lowAttendanceStudents: performances
      .filter(p => p.attendanceRate < 75)
      .map(p => ({
        studentId: p.studentId._id,
        name: p.studentId.name,
        rollNumber: p.studentId.rollNumber,
        attendanceRate: p.attendanceRate,
        totalClasses: p.attendanceData.totalClasses,
        classesAttended: p.attendanceData.classesAttended,
        classesAbsent: p.attendanceData.classesAbsent
      }))
  };

  res.status(200).json({
    success: true,
    data: analysis
  });
});

/**
 * @desc    Get assignment performance analysis
 * @route   GET /api/teacher/analytics/assignments/:classId/:subjectId
 * @access  Private (Teacher)
 */
export const getAssignmentAnalysis = asyncHandler(async (req, res) => {
  const { classId, subjectId } = req.params;
  const teacherId = req.user._id;

  const performances = await StudentPerformance.find({
    classId,
    subjectId,
    teacherId
  }).populate('studentId', 'name rollNumber');

  // Calculate grades distribution
  const gradeDistribution = {
    A: performances.filter(p => p.assignmentMarks.averageMarks >= 90).length,
    B: performances.filter(p => p.assignmentMarks.averageMarks >= 80 && p.assignmentMarks.averageMarks < 90).length,
    C: performances.filter(p => p.assignmentMarks.averageMarks >= 70 && p.assignmentMarks.averageMarks < 80).length,
    D: performances.filter(p => p.assignmentMarks.averageMarks >= 60 && p.assignmentMarks.averageMarks < 70).length,
    F: performances.filter(p => p.assignmentMarks.averageMarks < 60).length
  };

  const analysis = {
    totalStudents: performances.length,
    totalAssignmentsSubmitted: performances.reduce((sum, p) => sum + p.assignmentMarks.submittedAssignments, 0),
    averageSubmissionRate: (
      (performances.reduce((sum, p) => sum + p.assignmentMarks.submittedAssignments, 0) / 
      (performances.length * performances[0]?.assignmentMarks.totalAssignments || 1)) * 100
    ).toFixed(2),
    classAverageMarks: (performances.reduce((sum, p) => sum + p.assignmentMarks.averageMarks, 0) / performances.length).toFixed(2),
    gradeDistribution,
    nonSubmitters: performances
      .filter(p => p.assignmentMarks.submittedAssignments === 0)
      .map(p => ({
        studentId: p.studentId._id,
        name: p.studentId.name,
        rollNumber: p.studentId.rollNumber
      }))
  };

  res.status(200).json({
    success: true,
    data: analysis
  });
});

/**
 * @desc    Add teacher comment to student performance
 * @route   PUT /api/teacher/analytics/student/:studentId/:subjectId/comment
 * @access  Private (Teacher)
 */
export const addStudentComment = asyncHandler(async (req, res) => {
  const { studentId, subjectId } = req.params;
  const { comment, category } = req.body;
  const teacherId = req.user._id;

  if (!comment) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a comment'
    });
  }

  const performance = await StudentPerformance.findOneAndUpdate(
    { studentId, subjectId, teacherId },
    {
      $push: {
        teacherComments: {
          comment,
          date: new Date(),
          category: category || 'general'
        }
      }
    },
    { new: true }
  );

  if (!performance) {
    return res.status(404).json({
      success: false,
      message: 'Performance record not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Comment added successfully',
    data: performance
  });
});

/**
 * @desc    Update student intervention record
 * @route   PUT /api/teacher/analytics/student/:studentId/:subjectId/intervention
 * @access  Private (Teacher)
 */
export const updateIntervention = asyncHandler(async (req, res) => {
  const { studentId, subjectId } = req.params;
  const { intervention, priority } = req.body;
  const teacherId = req.user._id;

  if (!intervention) {
    return res.status(400).json({
      success: false,
      message: 'Please provide intervention details'
    });
  }

  const performance = await StudentPerformance.findOneAndUpdate(
    { studentId, subjectId, teacherId },
    {
      $push: {
        interventionsNeeded: {
          intervention,
          priority: priority || 'medium',
          startDate: new Date(),
          status: 'pending'
        }
      }
    },
    { new: true }
  );

  if (!performance) {
    return res.status(404).json({
      success: false,
      message: 'Performance record not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Intervention recorded successfully',
    data: performance
  });
});

export default {
  getStudentPerformance,
  getClassPerformance,
  getTopPerformers,
  getStrugglingStudents,
  getStudentTrend,
  getAttendanceAnalysis,
  getAssignmentAnalysis,
  addStudentComment,
  updateIntervention
};
