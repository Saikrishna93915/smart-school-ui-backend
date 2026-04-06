import mongoose from 'mongoose';

const notificationSettingSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  category: {
    type: String,
    enum: ['academic', 'financial', 'security', 'system', 'communication', 'emergency'],
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  channels: [{
    type: String,
    enum: ['email', 'sms', 'whatsapp', 'push', 'in_app', 'voice'],
    required: true
  }],
  isEnabled: {
    type: Boolean,
    default: true,
    index: true
  },
  schedule: {
    type: {
      type: String,
      enum: ['instant', 'daily', 'weekly', 'monthly', 'custom'],
      default: 'instant'
    },
    time: String,
    days: [String],
    frequency: Number // in minutes for custom
  },
  recipients: {
    roles: [{
      type: String,
      enum: ['admin', 'teacher', 'student', 'parent', 'staff']
    }],
    specificUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    groups: [String]
  },
  templates: {
    email: {
      subject: String,
      body: String,
      html: Boolean
    },
    sms: {
      message: String,
      maxLength: {
        type: Number,
        default: 160
      }
    },
    whatsapp: {
      templateId: String,
      parameters: [String]
    }
  },
  triggers: [{
    event: String,
    conditions: mongoose.Schema.Types.Mixed,
    delay: Number // in minutes
  }],
  rules: {
    maxPerDay: {
      type: Number,
      default: 10
    },
    quietHours: {
      start: String, // "22:00"
      end: String,   // "06:00"
      enabled: Boolean
    },
    emergencyOverride: {
      type: Boolean,
      default: true
    }
  },
  statistics: {
    sentCount: {
      type: Number,
      default: 0
    },
    deliveredCount: {
      type: Number,
      default: 0
    },
    readCount: {
      type: Number,
      default: 0
    },
    lastSent: Date
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    version: {
      type: Number,
      default: 1
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
notificationSettingSchema.index({ schoolId: 1, category: 1, type: 1 }, { unique: true });
notificationSettingSchema.index({ schoolId: 1, isEnabled: 1 });

// Static method to get all enabled notifications for a school
notificationSettingSchema.statics.getEnabledForSchool = function(schoolId) {
  return this.find({ schoolId, isEnabled: true });
};

// Method to check if notification should be sent based on schedule
notificationSettingSchema.methods.shouldSendNow = function() {
  if (this.schedule.type === 'instant') return true;
  
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  
  switch (this.schedule.type) {
    case 'daily':
      return this.schedule.time === currentTime;
    case 'weekly':
      return this.schedule.days.includes(currentDay) && this.schedule.time === currentTime;
    case 'custom':
      // Implement custom scheduling logic
      return true;
    default:
      return false;
  }
};

export default mongoose.model('NotificationSetting', notificationSettingSchema);