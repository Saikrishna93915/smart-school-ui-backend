// routes/cashierRoutes.js - Cashier Portal Routes
import express from "express";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import {
  getDashboardStats,
  getDailyCollectionReport,
  getCashierReceipts,
  voidTransaction,
  markReceiptPrinted,
  emailReceipt
} from "../controllers/cashierController.js";

const router = express.Router();

// All routes require authentication + cashier/admin/owner/accountant role
router.use(protect);
router.use(authorize("cashier", "admin", "owner", "accountant"));

router.get("/dashboard", getDashboardStats);
router.get("/daily-report", getDailyCollectionReport);
router.get("/receipts", getCashierReceipts);
router.post("/transactions/:id/void", voidTransaction);
router.post("/receipts/:id/print", markReceiptPrinted);
router.post("/receipts/:id/email", emailReceipt);

export default router;
