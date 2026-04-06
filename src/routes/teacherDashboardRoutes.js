import express from 'express';
import {
  getDashboardOverview,
  getDashboardStatistics,
  getPendingTasks,
  getStudentAlerts
} from '../controllers/teacherDashboardController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/teacher/dashboard
 * @desc    Get dashboard overview (today's classes, pending tasks, alerts, announcements)
 * @access  Private (Teacher)
 */
router.get('/', getDashboardOverview);

/**
 * @route   GET /api/teacher/dashboard/statistics
 * @desc    Get dashboard statistics (total classes, students, assignments, materials)
 * @access  Private (Teacher)
 */
router.get('/statistics', getDashboardStatistics);

/**
 * @route   GET /api/teacher/dashboard/pending-tasks
 * @desc    Get pending tasks count (attendance to mark, submissions to grade, announcements to post)
 * @access  Private (Teacher)
 */
router.get('/pending-tasks', getPendingTasks);

/**
 * @route   GET /api/teacher/dashboard/alerts
 * @desc    Get student alerts (failing, low attendance, declining trends)
 * @access  Private (Teacher)
 */
router.get('/alerts', getStudentAlerts);

export default router;
