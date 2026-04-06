import express from "express";
import {
  getAdminDashboardSummary,
  getFeeCollectionChart,
  getAttendanceStats,
} from "../controllers/dashboardController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/dashboard/admin-summary
 * @desc    Get complete dashboard data (fees + attendance)
 * @access  Private (Admin/Owner/Principal)
 */
router.get("/admin-summary", authorize("admin", "owner", "principal"), getAdminDashboardSummary);

/**
 * @route   GET /api/dashboard/fee-collection
 * @desc    Get fee collection chart data
 * @access  Private (Admin/Owner/Principal)
 */
router.get("/fee-collection", authorize("admin", "owner", "principal"), getFeeCollectionChart);

/**
 * @route   GET /api/dashboard/attendance-stats
 * @desc    Get attendance statistics chart data
 * @access  Private (Admin/Owner/Principal)
 */
router.get("/attendance-stats", authorize("admin", "owner", "principal"), getAttendanceStats);

export default router;
