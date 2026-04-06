// src/routes/studentAttendanceRoutes.js
import express from "express";
import {
  getStudentAttendance,
  getCurrentStudent,
  getStudentMonthlySummary,
  getStudentYearlySummary
} from "../controllers/studentAttendanceController.js";

import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All routes require student to be authenticated
// Students can ONLY view their own attendance
router.use(protect);

/**
 * GET /api/attendance/student/me
 * Get current authenticated student's info
 */
router.get("/student/me", getCurrentStudent);

/**
 * GET /api/attendance/student/:studentId
 * Get student attendance for date range
 * Query: startDate, endDate (yyyy-MM-dd)
 */
router.get("/student/:studentId", (req, res, next) => {
  // Security: Verify student can only access their own data
  if (req.user._id.toString() !== req.params.studentId && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You can only view your own attendance'
    });
  }
  next();
}, getStudentAttendance);

/**
 * GET /api/attendance/student/:studentId/summary
 * Get monthly attendance summary
 * Query: month (1-12), year (YYYY)
 */
router.get("/student/:studentId/summary", (req, res, next) => {
  if (req.user._id.toString() !== req.params.studentId && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You can only view your own attendance'
    });
  }
  next();
}, getStudentMonthlySummary);

/**
 * GET /api/attendance/student/:studentId/yearly
 * Get yearly attendance summary
 * Query: year (YYYY)
 */
router.get("/student/:studentId/yearly", (req, res, next) => {
  if (req.user._id.toString() !== req.params.studentId && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You can only view your own attendance'
    });
  }
  next();
}, getStudentYearlySummary);

export default router;
