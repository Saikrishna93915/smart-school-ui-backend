import express from 'express';
import { getRecentActivities, getTopDefaulters } from '../controllers/activityController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication and admin/owner/principal role
router.use(protect);
router.use(authorize('admin', 'owner', 'principal'));

/**
 * @route   GET /api/activities/recent
 * @desc    Get recent activities with optional limit
 * @query   limit - Number of activities to fetch (default: 10)
 * @access  Private (Admin/Owner/Principal)
 */
router.get('/recent', getRecentActivities);

/**
 * @route   GET /api/activities/top-defaulters
 * @desc    Get top fee defaulters
 * @query   limit - Number of defaulters to fetch (default: 10)
 * @access  Private (Admin/Owner/Principal)
 */
router.get('/top-defaulters', getTopDefaulters);

export default router;
