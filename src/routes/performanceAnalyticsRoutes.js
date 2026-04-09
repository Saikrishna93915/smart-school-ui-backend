import express from 'express';
import {
  getStudentPerformance,
  getClassPerformance,
  getTopPerformers,
  getStrugglingStudents,
  getStudentTrend,
  getAttendanceAnalysis,
  getAssignmentAnalysis,
  addStudentComment,
  updateIntervention
} from '../controllers/performanceAnalyticsController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/teacher/analytics/student/:studentId/:subjectId
 * @desc    Get performance data for a specific student in a subject
 * @access  Private (Teacher)
 */
router.get('/student/:studentId/:subjectId', getStudentPerformance);

/**
 * @route   GET /api/teacher/analytics/class/:classId/:subjectId
 * @desc    Get all students' performance for a class
 * @access  Private (Teacher)
 */
router.get('/class/:classId/:subjectId', getClassPerformance);

/**
 * @route   GET /api/teacher/analytics/top-performers/:classId/:subjectId
 * @desc    Get top performing students
 * @access  Private (Teacher)
 * @query   limit - Number of top performers to return (default: 10)
 */
router.get('/top-performers/:classId/:subjectId', getTopPerformers);

/**
 * @route   GET /api/teacher/analytics/struggling/:classId/:subjectId
 * @desc    Get struggling students (failing, low attendance, declining trend)
 * @access  Private (Teacher)
 */
router.get('/struggling/:classId/:subjectId', getStrugglingStudents);

/**
 * @route   GET /api/teacher/analytics/student-trend/:studentId/:subjectId
 * @desc    Get performance trend for a student
 * @access  Private (Teacher)
 */
router.get('/student-trend/:studentId/:subjectId', getStudentTrend);

/**
 * @route   GET /api/teacher/analytics/attendance/:classId/:subjectId
 * @desc    Get attendance analysis for a class
 * @access  Private (Teacher)
 */
router.get('/attendance/:classId/:subjectId', getAttendanceAnalysis);

/**
 * @route   GET /api/teacher/analytics/assignments/:classId/:subjectId
 * @desc    Get assignment performance analysis
 * @access  Private (Teacher)
 */
router.get('/assignments/:classId/:subjectId', getAssignmentAnalysis);

/**
 * @route   PUT /api/teacher/analytics/student/:studentId/:subjectId/comment
 * @desc    Add teacher comment to student performance
 * @access  Private (Teacher)
 */
router.put('/student/:studentId/:subjectId/comment', addStudentComment);

/**
 * @route   PUT /api/teacher/analytics/student/:studentId/:subjectId/intervention
 * @desc    Update student intervention record
 * @access  Private (Teacher)
 */
router.put('/student/:studentId/:subjectId/intervention', updateIntervention);

export default router;
