/**
 * SETTINGS ROUTES - PRODUCTION GRADE WITH RATE LIMITING
 * All settings-related endpoints with proper middleware stack
 */

import express from "express";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import { standardRateLimiter, strictRateLimiter, uploadRateLimiter } from "../middlewares/rateLimiter.js";
import { uploadLogoMiddleware } from "../middlewares/uploadMiddleware.js";
import * as settingController from "../controllers/settingsController.js";

const router = express.Router();

// =================== SETTINGS ROUTES ===================

// @route   GET /api/settings
// @desc    Get all settings (combined)
// @access  Private (Admin/Owner)
router.get("/", 
  protect, 
  authorize("admin", "owner"), 
  standardRateLimiter,
  settingController.getAllSettings
);

// @route   GET /api/settings/health
// @desc    Get system health status
// @access  Private (Admin/Owner)
router.get("/health", 
  protect, 
  authorize("admin", "owner"), 
  standardRateLimiter,
  settingController.getSystemHealth
);

// @route   GET /api/settings/:category
// @desc    Get settings by specific category (school/academic/notifications/security/billing/advanced)
// @access  Private (Admin/Owner)
router.get("/:category", 
  protect, 
  authorize("admin", "owner"), 
  standardRateLimiter,
  settingController.getSettingsByCategory
);

// @route   PUT /api/settings/school
// @desc    Update school profile settings
// @access  Private (Admin/Owner)
router.put("/school", 
  protect, 
  authorize("admin", "owner"), 
  strictRateLimiter,
  settingController.updateSchoolProfile
);

// @route   PUT /api/settings/academic
// @desc    Update academic year settings
// @access  Private (Admin/Owner)
router.put("/academic", 
  protect, 
  authorize("admin", "owner"), 
  strictRateLimiter,
  settingController.updateAcademicSettings
);

// @route   PUT /api/settings/notifications
// @desc    Update notification preferences
// @access  Private (Admin/Owner)
router.put("/notifications", 
  protect, 
  authorize("admin", "owner"), 
  strictRateLimiter,
  settingController.updateNotificationSettings
);

// @route   PUT /api/settings/security
// @desc    Update security settings (2FA, API keys, etc.)
// @access  Private (Admin/Owner)
router.put("/security", 
  protect, 
  authorize("admin", "owner"), 
  strictRateLimiter,
  settingController.updateSecuritySettings
);

// @route   PUT /api/settings/billing
// @desc    Update billing and subscription settings
// @access  Private (Admin/Owner)
router.put("/billing", 
  protect, 
  authorize("admin", "owner"), 
  strictRateLimiter,
  settingController.updateBillingSettings
);

// @route   PUT /api/settings/advanced
// @desc    Update advanced system settings
// @access  Private (Admin/Owner)
router.put("/advanced", 
  protect, 
  authorize("admin", "owner"), 
  strictRateLimiter,
  settingController.updateAdvancedSettings
);

// @route   POST /api/settings/backup
// @desc    Create system backup
// @access  Private (Admin/Owner)
router.post("/backup", 
  protect, 
  authorize("admin", "owner"), 
  strictRateLimiter,
  settingController.createBackup
);

// @route   POST /api/settings/export
// @desc    Export system data (CSV/JSON)
// @access  Private (Admin/Owner)
router.post("/export", 
  protect, 
  authorize("admin", "owner"), 
  strictRateLimiter,
  settingController.exportData
);

// @route   POST /api/settings/logo
// @desc    Upload school logo
// @access  Private (Admin/Owner)
router.post("/logo", 
  protect, 
  authorize("admin", "owner"), 
  uploadRateLimiter,
  uploadLogoMiddleware,
  settingController.uploadLogo
);

export default router;
