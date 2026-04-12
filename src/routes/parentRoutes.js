import express from 'express';
import {
  getParentDashboard,
  getChildAttendance,
  getChildTimetable,
  getChildPerformance,
  getChildReports,
  getChildComparison
} from '../controllers/parentController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(authorize('parent', 'admin', 'owner'));

// @route   GET /api/parent/dashboard
// @desc    Get parent dashboard overview
router.get('/dashboard', getParentDashboard);

// @route   GET /api/parent/child/:childId/attendance
// @desc    Get child's attendance
router.get('/child/:childId/attendance', getChildAttendance);

// @route   GET /api/parent/child/:childId/timetable
// @desc    Get child's timetable
router.get('/child/:childId/timetable', getChildTimetable);

// @route   GET /api/parent/child/:childId/performance
// @desc    Get child's exam performance
router.get('/child/:childId/performance', getChildPerformance);

// @route   GET /api/parent/child/:childId/reports
// @desc    Get child's report cards list
router.get('/child/:childId/reports', getChildReports);

// @route   GET /api/parent/child/:childId/comparison
// @desc    Get child's performance comparison with class
router.get('/child/:childId/comparison', getChildComparison);

export default router;
