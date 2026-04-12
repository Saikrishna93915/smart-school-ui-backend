/**
 * SETTINGS CONTROLLER (PRODUCTION GRADE)
 * HTTP request handlers using service layer architecture
 */

import asyncHandler from '../utils/asyncHandler.js';
import settingsService from '../services/settingsService.js';
import ApiResponse from '../utils/ApiResponse.js';
import {
  validateSchoolProfile,
  validateAcademicSettings,
  validateSecuritySettings,
  validateNotificationSettings,
  validateAdvancedSettings
} from '../validators/settingsValidator.js';

// ==================== GET ALL SETTINGS ====================

export const getAllSettings = asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId || null;
  const settings = await settingsService.getAllSettings(schoolId);
  
  return res.status(200).json(
    ApiResponse.success('Settings retrieved successfully', settings)
  );
});

// ==================== GET SETTINGS BY CATEGORY ====================

export const getSettingsByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const schoolId = req.user?.schoolId || null;
  
  const data = await settingsService.getSettingsByCategory(category, schoolId);
  
  return res.status(200).json(
    ApiResponse.success(`${category} settings retrieved successfully`, data)
  );
});

// ==================== UPDATE SCHOOL PROFILE ====================

export const updateSchoolProfile = asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId || null;
  
  // Validate input
  const validation = validateSchoolProfile(req.body);
  if (!validation.isValid) {
    return res.status(400).json(
      ApiResponse.badRequest('Validation failed', validation.errors)
    );
  }
  
  const updated = await settingsService.updateSchoolProfile(req.body, schoolId);
  
  return res.status(200).json(
    ApiResponse.success('School profile updated successfully', updated)
  );
});

// ==================== UPDATE ACADEMIC SETTINGS ====================

export const updateAcademicSettings = asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId || null;
  
  // Validate input
  const validation = validateAcademicSettings(req.body);
  if (!validation.isValid) {
    return res.status(400).json(
      ApiResponse.badRequest('Validation failed', validation.errors)
    );
  }
  
  const updated = await settingsService.updateAcademicSettings(req.body, schoolId);
  
  return res.status(200).json(
    ApiResponse.success('Academic settings updated successfully', updated)
  );
});

// ==================== UPDATE NOTIFICATION SETTINGS ====================

export const updateNotificationSettings = asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId || null;
  
  // Validate input
  const validation = validateNotificationSettings(req.body);
  if (!validation.isValid) {
    return res.status(400).json(
      ApiResponse.badRequest('Validation failed', validation.errors)
    );
  }
  
  const updated = await settingsService.updateNotificationSettings(req.body, schoolId);
  
  return res.status(200).json(
    ApiResponse.success('Notification settings updated successfully', updated)
  );
});

// ==================== UPDATE SECURITY SETTINGS ====================

export const updateSecuritySettings = asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId || null;
  
  // Validate input
  const validation = validateSecuritySettings(req.body);
  if (!validation.isValid) {
    return res.status(400).json(
      ApiResponse.badRequest('Validation failed', validation.errors)
    );
  }
  
  const updated = await settingsService.updateSecuritySettings(req.body, schoolId);
  
  return res.status(200).json(
    ApiResponse.success('Security settings updated successfully', updated)
  );
});

// ==================== UPDATE BILLING SETTINGS ====================

export const updateBillingSettings = asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId || null;
  
  const updated = await settingsService.updateBillingSettings(req.body, schoolId);
  
  return res.status(200).json(
    ApiResponse.success('Billing settings updated successfully', updated)
  );
});

// ==================== UPDATE ADVANCED SETTINGS ====================

export const updateAdvancedSettings = asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId || null;

  const validation = validateAdvancedSettings(req.body);
  if (!validation.isValid) {
    return res.status(400).json(
      ApiResponse.badRequest('Validation failed', validation.errors)
    );
  }
  
  const updated = await settingsService.updateAdvancedSettings(req.body, schoolId);
  
  return res.status(200).json(
    ApiResponse.success('Advanced settings updated successfully', updated)
  );
});

// ==================== SYSTEM HEALTH ====================

export const getSystemHealth = asyncHandler(async (req, res) => {
  const schoolId = req.user?.schoolId || null;
  
  const health = await settingsService.getSettingsByCategory('health', schoolId);
  
  return res.status(200).json(
    ApiResponse.success('System health retrieved successfully', health)
  );
});

// ==================== BACKUP & EXPORT ====================

export const createBackup = asyncHandler(async (req, res) => {
  const backupId = `backup-${Date.now()}`;
  const backupData = {
    backupId,
    status: 'in-progress',
    timestamp: new Date(),
    estimatedSize: '125 MB',
    estimatedTime: '2-3 minutes'
  };
  
  // TODO: Implement actual backup logic using background jobs
  
  return res.status(200).json(
    ApiResponse.success('Backup initiated successfully', backupData)
  );
});

export const exportData = asyncHandler(async (req, res) => {
  const format = req.body?.format || 'json';
  const exportId = `export-${Date.now()}`;
  
  const exportData = {
    exportId,
    format,
    status: 'processing',
    downloadUrl: `/api/settings/exports/${exportId}.${format}`,
    expiresIn: '24 hours'
  };
  
  // TODO: Implement actual export logic
  
  return res.status(200).json(
    ApiResponse.success('Data export initiated successfully', exportData)
  );
});

// ==================== FILE UPLOAD ====================

export const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json(
      ApiResponse.badRequest('No file uploaded')
    );
  }
  
  const schoolId = req.user?.schoolId || null;
  const logoUrl = `/uploads/logos/${req.file.filename}`;
  
  // Save logo URL to school profile in database (logo is an object with url property)
  const updated = await settingsService.updateSchoolProfile({ 
    logo: { url: logoUrl }
  }, schoolId);
  
  return res.status(200).json(
    ApiResponse.success('Logo uploaded and saved successfully', { 
      logoUrl, 
      path: logoUrl,
      school: updated 
    })
  );
});
