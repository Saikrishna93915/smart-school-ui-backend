/**
 * Configuration Service
 * Helper functions to retrieve dynamic configurations from database
 * Use this instead of hardcoded values throughout the backend
 */

import SystemConfig from "../models/SystemConfig.js";

// Cache to reduce DB queries (will be refreshed periodically)
let configCache = {};
let cacheExpiry = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get configuration value by key
 * @param {string} key - Configuration key (e.g., 'school.name', 'fees.structure')
 * @param {any} fallback - Fallback value if config not found
 * @returns {Promise<any>} Configuration value
 */
export const getConfig = async (key, fallback = null) => {
  try {
    // Check cache first
    if (cacheExpiry && Date.now() < cacheExpiry && configCache[key] !== undefined) {
      return configCache[key];
    }

    const value = await SystemConfig.getConfig(key);
    
    // Update cache
    configCache[key] = value !== null ? value : fallback;
    
    return value !== null ? value : fallback;
  } catch (error) {
    console.error(`❌ Error fetching config '${key}':`, error.message);
    return fallback;
  }
};

/**
 * Get multiple configurations by keys
 * @param {string[]} keys - Array of configuration keys
 * @returns {Promise<Object>} Object with key-value pairs
 */
export const getConfigs = async (keys) => {
  const result = {};
  
  for (const key of keys) {
    result[key] = await getConfig(key);
  }
  
  return result;
};

/**
 * Get all configurations by category
 * @param {string} category - Configuration category
 * @returns {Promise<Object>} Object with key-value pairs
 */
export const getConfigsByCategory = async (category) => {
  try {
    return await SystemConfig.getConfigsByCategory(category);
  } catch (error) {
    console.error(`❌ Error fetching configs for category '${category}':`, error.message);
    return {};
  }
};

/**
 * Get fee structure for a specific class
 * @param {string} className - Class name (e.g., '10th Class')
 * @returns {Promise<Object>} Fee configuration for the class
 */
export const getFeeStructureForClass = async (className) => {
  const feeStructure = await getConfig('fees.structure', {});
  return feeStructure[className] || null;
};

/**
 * Get school name
 * @returns {Promise<string>} School name
 */
export const getSchoolName = async () => {
  return await getConfig('school.name', 'School ERP');
};

/**
 * Get school profile (all school-related configs)
 * @returns {Promise<Object>} School configuration
 */
export const getSchoolProfile = async () => {
  return await getConfigsByCategory('school');
};

/**
 * Get grading scale
 * @returns {Promise<Array>} Grading scale array
 */
export const getGradingScale = async () => {
  return await getConfig('grading.scale', []);
};

/**
 * Get passing percentage
 * @returns {Promise<number>} Passing percentage
 */
export const getPassingPercentage = async () => {
  return await getConfig('grading.passingPercentage', 33);
};

/**
 * Get notification settings
 * @returns {Promise<Array>} Notification settings array
 */
export const getNotificationSettings = async () => {
  return await getConfig('notifications.settings', []);
};

/**
 * Get certificate template by type
 * @param {string} type - Certificate type
 * @returns {Promise<string>} Certificate template
 */
export const getCertificateTemplate = async (type) => {
  const templates = await getConfig('certificates.templates', {});
  return templates[type] || null;
};

/**
 * Get security settings
 * @returns {Promise<Object>} Security configuration
 */
export const getSecuritySettings = async () => {
  return await getConfigsByCategory('security');
};

/**
 * Get academic year configuration
 * @returns {Promise<Object>} Academic year configuration
 */
export const getAcademicYear = async () => {
  return await getConfigsByCategory('academic');
};

/**
 * Get thresholds
 * @returns {Promise<Object>} Threshold configuration
 */
export const getThresholds = async () => {
  return await getConfigsByCategory('thresholds');
};

/**
 * Get cashier variance threshold
 * @returns {Promise<number>} Variance threshold
 */
export const getCashierVarianceThreshold = async () => {
  return await getConfig('thresholds.cashierVariance', 500);
};

/**
 * Get defaulter thresholds
 * @returns {Promise<Object>} Defaulter threshold levels
 */
export const getDefaulterThresholds = async () => {
  return {
    critical: await getConfig('thresholds.defaulterCritical', 50000),
    high: await getConfig('thresholds.defaulterHigh', 20000),
    moderate: await getConfig('thresholds.defaulterModerate', 5000)
  };
};

/**
 * Get late penalty rate
 * @returns {Promise<number>} Late penalty rate (decimal)
 */
export const getLatePenaltyRate = async () => {
  return await getConfig('fees.latePenaltyRate', 0.01);
};

/**
 * Get maximum payment amount
 * @returns {Promise<number>} Maximum payment amount
 */
export const getMaxPaymentAmount = async () => {
  return await getConfig('fees.maxPaymentAmount', 999999);
};

/**
 * Get default password for role
 * @param {string} role - User role
 * @returns {Promise<string>} Default password
 */
export const getDefaultPassword = async (role) => {
  const passwords = await getConfig('passwords.defaultByRole', {});
  return passwords[role] || null;
};

/**
 * Get UI configuration
 * @returns {Promise<Object>} UI configuration
 */
export const getUIConfig = async () => {
  return await getConfigsByCategory('ui');
};

/**
 * Get email configuration
 * @returns {Promise<Object>} Email configuration
 */
export const getEmailConfig = async () => {
  return await getConfigsByCategory('email');
};

/**
 * Get limits
 * @returns {Promise<Object>} System limits
 */
export const getLimits = async () => {
  return await getConfigsByCategory('limits');
};

/**
 * Clear configuration cache
 */
export const clearConfigCache = () => {
  configCache = {};
  cacheExpiry = null;
  console.log('🔄 Configuration cache cleared');
};

/**
 * Refresh cache
 */
const refreshCache = async () => {
  try {
    const allConfigs = await SystemConfig.getAllConfigs();
    configCache = allConfigs;
    cacheExpiry = Date.now() + CACHE_TTL;
    console.log('✅ Configuration cache refreshed');
  } catch (error) {
    console.error('❌ Error refreshing config cache:', error.message);
  }
};

// Auto-refresh cache on first call
let cacheInitialized = false;
const initializeCache = async () => {
  if (!cacheInitialized) {
    await refreshCache();
    cacheInitialized = true;
  }
};

// Initialize cache asynchronously
initializeCache().catch(console.error);

// Export all helper functions
export default {
  getConfig,
  getConfigs,
  getConfigsByCategory,
  getFeeStructureForClass,
  getSchoolName,
  getSchoolProfile,
  getGradingScale,
  getPassingPercentage,
  getNotificationSettings,
  getCertificateTemplate,
  getSecuritySettings,
  getAcademicYear,
  getThresholds,
  getCashierVarianceThreshold,
  getDefaulterThresholds,
  getLatePenaltyRate,
  getMaxPaymentAmount,
  getDefaultPassword,
  getUIConfig,
  getEmailConfig,
  getLimits,
  clearConfigCache
};
