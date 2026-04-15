/**
 * System Configuration Routes
 * All API endpoints for managing dynamic system configurations
 */

import express from "express";
import {
  getAllConfigs,
  getConfigByKey,
  getConfigsByCategory,
  getConfigsByCategories,
  updateConfig,
  createConfig,
  getPublicConfigs,
  getFeeStructure,
  getGradingScale,
  getNotificationSettings,
  getCertificateTemplates,
  getSchoolProfile,
  resetConfig,
  bulkUpdateConfigs
} from "../controllers/configController.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public routes (no authentication required)
router.get("/public", getPublicConfigs);

// Protected routes (authentication required)
router.get("/", protect, getAllConfigs);
router.get("/bulk", protect, getConfigsByCategories);
router.get("/fees/structure", protect, getFeeStructure);
router.get("/grading/scale", protect, getGradingScale);
router.get("/notifications/settings", protect, getNotificationSettings);
router.get("/certificates/templates", protect, getCertificateTemplates);
router.get("/school", protect, getSchoolProfile);

// Get by key or category
router.get("/category/:category", protect, getConfigsByCategory);
router.get("/:key", protect, getConfigByKey);

// Admin/Owner only routes (modification)
router.post("/", protect, authorize("admin", "owner"), createConfig);
router.put("/bulk", protect, authorize("admin", "owner"), bulkUpdateConfigs);
router.put("/:key", protect, authorize("admin", "owner"), updateConfig);
router.post("/:key/reset", protect, authorize("admin", "owner"), resetConfig);

export default router;
