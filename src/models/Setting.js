import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  type: {
    type: String,
    enum: ['school', 'academic', 'notification', 'security', 'billing', 'advanced'],
    required: true
  },
  category: {
    type: String,
    enum: ['profile', 'system', 'communication', 'security', 'payment', 'database'],
    required: true
  },
  key: {
    type: String,
    required: true,
    index: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  dataType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'array', 'object', 'date'],
    default: 'string'
  },
  group: {
    type: String,
    enum: ['general', 'academic', 'notifications', 'security', 'billing', 'advanced'],
    default: 'general'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  isEncrypted: {
    type: Boolean,
    default: false
  },
  version: {
    type: Number,
    default: 1
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  metadata: {
    description: String,
    validationRules: mongoose.Schema.Types.Mixed,
    allowedValues: [mongoose.Schema.Types.Mixed],
    min: Number,
    max: Number,
    pattern: String,
    required: Boolean,
    defaultValue: mongoose.Schema.Types.Mixed
  },
  history: [{
    value: mongoose.Schema.Types.Mixed,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    reason: String
  }]
}, {
  timestamps: true,
  versionKey: false
});

// Compound index for faster queries
settingSchema.index({ schoolId: 1, type: 1, key: 1 }, { unique: true });
settingSchema.index({ schoolId: 1, category: 1 });
settingSchema.index({ schoolId: 1, group: 1 });

// Pre-save middleware for history tracking
settingSchema.pre('save', function(next) {
  if (this.isModified('value')) {
    this.history.push({
      value: this.value,
      changedBy: this.lastModifiedBy,
      changedAt: new Date(),
      reason: this.modificationReason || 'Manual update'
    });
    
    // Keep only last 10 history entries
    if (this.history.length > 10) {
      this.history = this.history.slice(-10);
    }
    
    this.version += 1;
  }
  next();
});

// Static method to get all settings by school
settingSchema.statics.findBySchool = function(schoolId) {
  return this.find({ schoolId }).lean();
};

// Static method to get grouped settings
settingSchema.statics.findGrouped = async function(schoolId) {
  const settings = await this.find({ schoolId }).lean();
  
  return settings.reduce((groups, setting) => {
    if (!groups[setting.group]) {
      groups[setting.group] = {};
    }
    if (!groups[setting.group][setting.category]) {
      groups[setting.group][setting.category] = {};
    }
    groups[setting.group][setting.category][setting.key] = setting.value;
    return groups;
  }, {});
};

export default mongoose.model('Setting', settingSchema);