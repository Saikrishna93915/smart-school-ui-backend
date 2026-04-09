// routes/paymentRoutes.js - Payment Management Routes
import express from 'express';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import {
  recordPayment,
  getPaymentHistory,
  getPaymentStatistics,
  getPaymentById,
  voidPayment,
  getReceiptByPaymentId,
  getReceiptByNumber,
  reprintReceipt
} from '../controllers/paymentController.js';

const router = express.Router();

// All routes require authentication and cashier/admin role
router.use(protect);
router.use(authorize('cashier', 'admin', 'owner'));

// @route   POST /api/finance/payments/record
// @desc    Record a new payment
router.post('/record', recordPayment);

// @route   GET /api/finance/payments/history
// @desc    Get payment history with filters
router.get('/history', getPaymentHistory);

// @route   GET /api/finance/payments/statistics
// @desc    Get payment statistics
router.get('/statistics', getPaymentStatistics);

// @route   GET /api/finance/payments/:id
// @desc    Get payment by ID
router.get('/:id', getPaymentById);

// @route   POST /api/finance/payments/:id/void
// @desc    Void/cancel payment (Admin only)
router.post('/:id/void', authorize('admin', 'owner'), voidPayment);

// @route   GET /api/finance/receipts/payment/:paymentId
// @desc    Get receipt by payment ID
router.get('/receipts/payment/:paymentId', getReceiptByPaymentId);

// @route   GET /api/finance/receipts/:receiptNumber
// @desc    Get receipt by receipt number
router.get('/receipts/:receiptNumber', getReceiptByNumber);

// @route   POST /api/finance/receipts/:id/reprint
// @desc    Reprint receipt
router.post('/receipts/:id/reprint', reprintReceipt);

export default router;
