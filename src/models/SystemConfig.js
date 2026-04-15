/**
 * SystemConfig Model
 * Stores all dynamic configuration data that was previously hardcoded
 * This makes the entire system configurable through the database
 */

import mongoose from "mongoose";

const systemConfigSchema = new mongoose.Schema({
  // Configuration category/key
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Configuration value (can be object, string, number, array)
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Category for easy querying (school, security, fees, academic, notifications, etc.)
  category: {
    type: String,
    required: true,
    enum: [
      'school',
      'security',
      'fees',
      'academic',
      'notifications',
      'grading',
      'certificates',
      'transport',
      'finance',
      'system',
      'limits',
      'thresholds',
      'email',
      'sms',
      'whatsapp',
      'ui',
      'navigation'
    ],
    index: true
  },

  // Description of what this config does
  description: {
    type: String
  },

  // Whether this config can be modified by admin users
  isEditable: {
    type: Boolean,
    default: true
  },

  // Data type for validation
  valueType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    required: true
  },

  // Last modified by (user ID)
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Version tracking for config changes
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Index for fast category lookups
systemConfigSchema.index({ category: 1, key: 1 });

// Static method to get config by key
systemConfigSchema.statics.getConfig = async function(key) {
  const config = await this.findOne({ key });
  return config ? config.value : null;
};

// Static method to get all configs by category
systemConfigSchema.statics.getConfigsByCategory = async function(category) {
  const configs = await this.find({ category });
  const result = {};
  configs.forEach(config => {
    result[config.key] = config.value;
  });
  return result;
};

// Static method to set/update config
systemConfigSchema.statics.setConfig = async function(key, value, userId) {
  return this.findOneAndUpdate(
    { key },
    { 
      value,
      modifiedBy: userId,
      $inc: { version: 1 }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

// Static method to get all configs
systemConfigSchema.statics.getAllConfigs = async function() {
  const configs = await this.find({});
  const result = {};
  configs.forEach(config => {
    result[config.key] = config.value;
  });
  return result;
};

// Static method to get configs by multiple categories
systemConfigSchema.statics.getConfigsByCategories = async function(categories) {
  const configs = await this.find({ category: { $in: categories } });
  const result = {};
  configs.forEach(config => {
    result[config.key] = config.value;
  });
  return result;
};

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);

export default SystemConfig;
