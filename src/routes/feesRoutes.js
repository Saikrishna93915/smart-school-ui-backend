import express from "express";
import {
  getAllFeeStructures,
  getFeeDefaulters,
  createFeeStructure,
  getFeeStructureByStudent,
  updateStudentFees,
  getFeeAuditHistory,
  getMyFeeStructure,
  processStudentPayment,
  getPaymentHistory,
  downloadReceiptPDF,
  getFeesAnalytics,
  exportPaymentsCSV,
  getParentPaymentHistory,
  getParentReceipts,
  emailReceipt,
} from "../controllers/feesController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// ===== STUDENT/PARENT ENDPOINTS =====

// @route   GET /api/fees/my-fee-structure
// @desc    Get current student's fee structure
router.get("/my-fee-structure", getMyFeeStructure);

// @route   POST /api/fees/pay
// @desc    Process student payment
router.post("/pay", processStudentPayment);

// @route   GET /api/fees/history/:studentId
// @desc    Get student payment history (admin/teacher)
router.get("/history/:studentId", authorize("admin", "finance", "accountant", "teacher"), getPaymentHistory);

// @route   GET /api/fees/history (no studentId - parent context)
// @desc    Get parent's children payment history
router.get("/history", getParentPaymentHistory);

// @route   GET /api/fees/receipts
// @desc    Get parent's children receipts
router.get("/receipts", getParentReceipts);

// @route   POST /api/fees/receipts/email/:paymentId
// @desc    Email receipt to parent
router.post("/receipts/email/:paymentId", emailReceipt);

// @route   GET /api/fees/receipts/download/:paymentId
// @desc    Download receipt
router.get("/receipts/download/:paymentId", downloadReceiptPDF);

// ===== ADMIN/ACCOUNTANT ENDPOINTS =====

// @route   GET /api/fees/structures
// @desc    Get all fee structures with filters
router.get("/structures", authorize("admin", "finance", "accountant"), getAllFeeStructures);

// @route   GET /api/fees/defaulters
// @desc    Get fee defaulters
router.get("/defaulters", authorize("admin", "finance", "accountant"), getFeeDefaulters);

// @route   POST /api/fees/structure
// @desc    Create fee structure for a student
router.post("/structure", authorize("admin", "finance"), createFeeStructure);

// @route   GET /api/fees/structure/:studentId
// @desc    Get fee structure by student ID
router.get("/structure/:studentId", authorize("admin", "finance", "accountant"), getFeeStructureByStudent);

// @route   PUT /api/fees/update-student-fees/:admissionNumber
// @desc    Update student fee structure with audit trail
router.put("/update-student-fees/:admissionNumber", authorize("admin", "finance"), updateStudentFees);

// @route   GET /api/fees/audit-history/:admissionNumber
// @desc    Get fee change audit history for a student
router.get("/audit-history/:admissionNumber", authorize("admin", "finance", "accountant"), getFeeAuditHistory);

// @route   GET /api/fees/analytics
// @desc    Get fees analytics and reports
router.get("/analytics", authorize("admin", "finance", "accountant"), getFeesAnalytics);

// @route   GET /api/fees/export/csv
// @desc    Export payments as CSV
router.get("/export/csv", authorize("admin", "finance", "accountant"), exportPaymentsCSV);

export default router;
