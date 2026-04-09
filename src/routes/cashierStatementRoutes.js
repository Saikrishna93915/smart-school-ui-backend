// routes/cashierStatementRoutes.js - Cashier Transaction History Routes
import express from "express";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import {
  getCashierStatement,
  getTransactionDetails,
  getCashierShifts,
  getCurrentShift,
  openShift,
  closeShift,
  exportStatement,
} from "../controllers/cashierStatementController.js";
import { triggerManualAutoClose } from "../services/shiftAutoCloseService.js";

const router = express.Router();

// All routes require authentication and cashier role
router.use(protect);
router.use(authorize("cashier", "admin", "owner"));

// @route   GET /api/cashier/statement
// @desc    Get cashier's transaction history with filters
router.get("/statement", getCashierStatement);

// @route   GET /api/cashier/statement/shifts
// @desc    Get cashier's shift sessions history
router.get("/statement/shifts", getCashierShifts);

// @route   GET /api/cashier/statement/shift/current
// @desc    Get current open shift
router.get("/statement/shift/current", getCurrentShift);

// @route   POST /api/cashier/statement/shift/open
// @desc    Open new shift session
router.post("/statement/shift/open", openShift);

// @route   POST /api/cashier/statement/shift/close/:shiftId
// @desc    Close current shift session
router.post("/statement/shift/close/:shiftId", closeShift);

// @route   POST /api/cashier/statement/export
// @desc    Export transaction statement
router.post("/statement/export", exportStatement);

// @route   GET /api/cashier/statement/:transactionId
// @desc    Get specific transaction details
router.get("/statement/:transactionId", getTransactionDetails);

// @route   POST /api/cashier/statement/trigger-auto-close
// @desc    Manually trigger auto-close (for testing)
router.post("/statement/trigger-auto-close", triggerManualAutoClose);

export default router;
