// routes/feeFollowUpRoutes.js - Fee Follow-up Routes
import express from 'express';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import {
  getPendingFeeStudents,
  sendSingleReminder,
  sendBulkReminders,
  sendPaymentConfirmation,
  getFollowUpStats
} from '../controllers/feeFollowUpController.js';

const router = express.Router();

// All routes require authentication and cashier/admin role
router.use(protect);
router.use(authorize('cashier', 'admin', 'owner'));

// @route   GET /api/cashier/follow-ups/pending
// @desc    Get students with pending fees
router.get('/pending', getPendingFeeStudents);

// @route   POST /api/cashier/follow-ups/send-reminder
// @desc    Send single reminder email
router.post('/send-reminder', sendSingleReminder);

// @route   POST /api/cashier/follow-ups/send-bulk
// @desc    Send bulk reminder emails
router.post('/send-bulk', sendBulkReminders);

// @route   POST /api/cashier/follow-ups/send-payment-confirmation
// @desc    Send payment confirmation email
router.post('/send-payment-confirmation', sendPaymentConfirmation);

// @route   GET /api/cashier/follow-ups/stats
// @desc    Get follow-up statistics
router.get('/stats', getFollowUpStats);

export default router;
