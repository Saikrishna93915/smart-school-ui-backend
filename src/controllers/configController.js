/**
 * System Configuration Controller
 * Provides API endpoints to get and update dynamic system configurations
 * All previously hardcoded data is now fetched from the database
 */

import SystemConfig from "../models/SystemConfig.js";
import asyncHandler from "express-async-handler";
import { ApiError } from "../utils/ApiError.js";

// @desc    Get all system configurations
// @route   GET /api/config
// @access  Private (Admin, Owner)
export const getAllConfigs = asyncHandler(async (req, res) => {
  const configs = await SystemConfig.getAllConfigs();
  res.json({
    success: true,
    data: configs,
    message: "System configurations retrieved successfully"
  });
});

// @desc    Get configuration by key
// @route   GET /api/config/:key
// @access  Private
export const getConfigByKey = asyncHandler(async (req, res) => {
  const { key } = req.params;
  
  const config = await SystemConfig.getConfig(key);
  
  if (!config) {
    throw new ApiError(404, `Configuration '${key}' not found`);
  }

  res.json({
    success: true,
    data: config,
    message: `Configuration '${key}' retrieved successfully`
  });
});

// @desc    Get configurations by category
// @route   GET /api/config/category/:category
// @access  Private
export const getConfigsByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  
  const configs = await SystemConfig.getConfigsByCategory(category);
  
  res.json({
    success: true,
    data: configs,
    message: `Configurations for category '${category}' retrieved successfully`
  });
});

// @desc    Get configurations by multiple categories
// @route   POST /api/config/bulk
// @access  Private
export const getConfigsByCategories = asyncHandler(async (req, res) => {
  const { categories } = req.body;
  
  if (!categories || !Array.isArray(categories)) {
    throw new ApiError(400, "Categories must be an array");
  }

  const configs = await SystemConfig.getConfigsByCategories(categories);
  
  res.json({
    success: true,
    data: configs,
    message: "Configurations retrieved successfully"
  });
});

// @desc    Update system configuration
// @route   PUT /api/config/:key
// @access  Private (Admin, Owner only)
export const updateConfig = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (value === undefined || value === null) {
    throw new ApiError(400, "Configuration value is required");
  }

  const existingConfig = await SystemConfig.findOne({ key });
  
  if (!existingConfig) {
    throw new ApiError(404, `Configuration '${key}' not found`);
  }

  if (!existingConfig.isEditable) {
    throw new ApiError(403, `Configuration '${key}' is not editable`);
  }

  const updatedConfig = await SystemConfig.setConfig(key, value, req.user?._id);

  res.json({
    success: true,
    data: updatedConfig,
    message: `Configuration '${key}' updated successfully`
  });
});

// @desc    Create new configuration
// @route   POST /api/config
// @access  Private (Admin, Owner only)
export const createConfig = asyncHandler(async (req, res) => {
  const { key, value, category, description, valueType } = req.body;

  if (!key || value === undefined || !category || !valueType) {
    throw new ApiError(400, "Key, value, category, and valueType are required");
  }

  const existingConfig = await SystemConfig.findOne({ key });
  
  if (existingConfig) {
    throw new ApiError(409, `Configuration '${key}' already exists. Use PUT to update.`);
  }

  const config = await SystemConfig.create({
    key,
    value,
    category,
    description,
    valueType,
    modifiedBy: req.user?._id
  });

  res.status(201).json({
    success: true,
    data: config,
    message: `Configuration '${key}' created successfully`
  });
});

// @desc    Get public configurations (school info, etc.)
// @route   GET /api/config/public
// @access  Public
export const getPublicConfigs = asyncHandler(async (req, res) => {
  const publicCategories = ['school', 'ui'];
  const configs = await SystemConfig.getConfigsByCategories(publicCategories);
  
  res.json({
    success: true,
    data: configs,
    message: "Public configurations retrieved successfully"
  });
});

// @desc    Get fee structure (dynamic from DB)
// @route   GET /api/config/fees/structure
// @access  Private
export const getFeeStructure = asyncHandler(async (req, res) => {
  const feeStructure = await SystemConfig.getConfig('fees.structure');
  
  if (!feeStructure) {
    throw new ApiError(404, "Fee structure not configured");
  }

  res.json({
    success: true,
    data: feeStructure,
    message: "Fee structure retrieved successfully"
  });
});

// @desc    Get grading scale (dynamic from DB)
// @route   GET /api/config/grading/scale
// @access  Private
export const getGradingScale = asyncHandler(async (req, res) => {
  const gradingScale = await SystemConfig.getConfig('grading.scale');
  
  if (!gradingScale) {
    throw new ApiError(404, "Grading scale not configured");
  }

  res.json({
    success: true,
    data: gradingScale,
    message: "Grading scale retrieved successfully"
  });
});

// @desc    Get notification settings (dynamic from DB)
// @route   GET /api/config/notifications/settings
// @access  Private
export const getNotificationSettings = asyncHandler(async (req, res) => {
  const settings = await SystemConfig.getConfig('notifications.settings');
  
  if (!settings) {
    throw new ApiError(404, "Notification settings not configured");
  }

  res.json({
    success: true,
    data: settings,
    message: "Notification settings retrieved successfully"
  });
});

// @desc    Get certificate templates (dynamic from DB)
// @route   GET /api/config/certificates/templates
// @access  Private
export const getCertificateTemplates = asyncHandler(async (req, res) => {
  const templates = await SystemConfig.getConfig('certificates.templates');
  
  if (!templates) {
    throw new ApiError(404, "Certificate templates not configured");
  }

  res.json({
    success: true,
    data: templates,
    message: "Certificate templates retrieved successfully"
  });
});

// @desc    Get school profile (dynamic from DB)
// @route   GET /api/config/school
// @access  Private
export const getSchoolProfile = asyncHandler(async (req, res) => {
  const schoolConfigs = await SystemConfig.getConfigsByCategory('school');
  
  if (Object.keys(schoolConfigs).length === 0) {
    throw new ApiError(404, "School profile not configured");
  }

  res.json({
    success: true,
    data: schoolConfigs,
    message: "School profile retrieved successfully"
  });
});

// @desc    Reset configuration to default
// @route   POST /api/config/:key/reset
// @access  Private (Admin, Owner only)
export const resetConfig = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { defaultValue } = req.body;

  if (defaultValue === undefined) {
    throw new ApiError(400, "defaultValue is required for reset");
  }

  const config = await SystemConfig.setConfig(key, defaultValue, req.user?._id);

  res.json({
    success: true,
    data: config,
    message: `Configuration '${key}' reset to default`
  });
});

// @desc    Bulk update configurations
// @route   PUT /api/config/bulk
// @access  Private (Admin, Owner only)
export const bulkUpdateConfigs = asyncHandler(async (req, res) => {
  const updates = req.body;

  if (!updates || typeof updates !== 'object') {
    throw new ApiError(400, "Updates must be an object with key-value pairs");
  }

  const results = [];
  
  for (const [key, value] of Object.entries(updates)) {
    const config = await SystemConfig.setConfig(key, value, req.user?._id);
    results.push(config);
  }

  res.json({
    success: true,
    data: results,
    message: `${results.length} configurations updated successfully`
  });
});
