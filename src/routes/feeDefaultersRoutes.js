// src/routes/feeDefaultersRoutes.js
import express from 'express';
import {
  getFeeDefaulters,
  sendReminders,
  getDefaulterDetails,
  updateDefaulterNotes,
  exportFeeDefaulters,
  getFeeDefaultersStatistics,
  markDefaulterPaid
} from '../controllers/feeDefaultersController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication and admin/finance role
// All routes require authentication and admin/finance/cashier/principal role
router.use(protect);
router.use(authorize('admin', 'finance', 'cashier', 'accountant', 'owner', 'principal'));

// Main routes
router.get('/', getFeeDefaulters);
router.post('/send-reminders', sendReminders);
router.get('/statistics', getFeeDefaultersStatistics);
router.get('/export', exportFeeDefaulters);

// Individual defaulter routes
router.get('/:admissionNumber', getDefaulterDetails);
router.put('/:admissionNumber/notes', updateDefaulterNotes);
router.post('/:admissionNumber/mark-paid', markDefaulterPaid);

export default router;