import express from 'express';
import {
  getParentDashboard,
  getChildAttendance,
  getChildTimetable
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

export default router;
