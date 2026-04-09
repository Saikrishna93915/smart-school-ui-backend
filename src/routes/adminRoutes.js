import express from "express";
import { createUser } from "../controllers/adminController.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// CRITICAL: Only admin/owner can create users
router.post("/user", protect, authorize('admin', 'owner'), createUser);

export default router;
