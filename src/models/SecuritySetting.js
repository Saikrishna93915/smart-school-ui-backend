import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const securitySettingSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    unique: true,
    index: true
  },
  authentication: {
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorMethod: {
      type: String,
      enum: ['email', 'sms', 'authenticator', 'none'],
      default: 'none'
    },
    sessionTimeout: {
      type: Number, // in minutes
      min: 5,
      max: 1440,
      default: 30
    },
    maxSessions: {
      type: Number,
      min: 1,
      max: 10,
      default: 3
    },
    rememberMeDuration: {
      type: Number, // in days
      min: 1,
      max: 30,
      default: 7
    }
  },
  passwordPolicy: {
    minLength: {
      type: Number,
      min: 6,
      max: 32,
      default: 8
    },
    requireUppercase: {
      type: Boolean,
      default: true
    },
    requireLowercase: {
      type: Boolean,
      default: true
    },
    requireNumbers: {
      type: Boolean,
      default: true
    },
    requireSpecialChars: {
      type: Boolean,
      default: true
    },
    expiryDays: {
      type: Number,
      min: 0, // 0 means never expire
      max: 365,
      default: 90
    },
    historySize: {
      type: Number,
      min: 0,
      max: 10,
      default: 3
    }
  },
  loginSecurity: {
    maxFailedAttempts: {
      type: Number,
      min: 1,
      max: 10,
      default: 5
    },
    lockoutDuration: {
      type: Number, // in minutes
      min: 1,
      max: 1440,
      default: 15
    },
    ipWhitelist: [{
      ip: String,
      description: String,
      addedAt: Date,
      addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    blocklist: [{
      ip: String,
      reason: String,
      blockedAt: Date,
      blockedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      expiresAt: Date
    }]
  },
  apiSecurity: {
    apiKey: {
      type: String,
      select: false
    },
    apiKeyHash: {
      type: String,
      select: false
    },
    apiKeyExpiry: Date,
    rateLimit: {
      requests: {
        type: Number,
        default: 100
      },
      perMinutes: {
        type: Number,
        default: 1
      }
    },
    allowedOrigins: [String],
    allowedMethods: [String],
    webhookUrl: String,
    webhookSecret: {
      type: String,
      select: false
    }
  },
  dataSecurity: {
    encryptionEnabled: {
      type: Boolean,
      default: true
    },
    backupEncryption: {
      type: Boolean,
      default: true
    },
    dataRetention: {
      logs: {
        type: Number, // in days
        default: 90
      },
      backups: {
        type: Number, // in days
        default: 30
      },
      auditTrails: {
        type: Number, // in days
        default: 365
      }
    },
    autoBackup: {
      enabled: Boolean,
      frequency: {
        type: String,
        enum: ['hourly', 'daily', 'weekly', 'monthly']
      },
      time: String,
      retention: Number
    }
  },
  auditLogging: {
    enabled: {
      type: Boolean,
      default: true
    },
    logLevel: {
      type: String,
      enum: ['minimal', 'normal', 'verbose', 'debug'],
      default: 'normal'
    },
    retentionDays: {
      type: Number,
      default: 90
    }
  },
  compliance: {
    gdprCompliant: Boolean,
    hipaaCompliant: Boolean,
    ferpaCompliant: Boolean,
    isoCertified: Boolean,
    lastAudit: Date,
    nextAudit: Date
  },
  alerts: {
    failedLogin: Boolean,
    newDevice: Boolean,
    suspiciousActivity: Boolean,
    dataExport: Boolean,
    settingChange: Boolean
  },
  metadata: {
    lastSecurityScan: Date,
    securityScore: {
      type: Number,
      min: 0,
      max: 100
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    version: {
      type: Number,
      default: 1
    }
  }
}, {
  timestamps: true
});

// Pre-save middleware to hash API key
securitySettingSchema.pre('save', async function(next) {
  if (this.isModified('apiSecurity.apiKey') && this.apiSecurity.apiKey) {
    const salt = await bcrypt.genSalt(10);
    this.apiSecurity.apiKeyHash = await bcrypt.hash(this.apiSecurity.apiKey, salt);
    this.apiSecurity.apiKey = undefined; // Don't store plain text
  }
  next();
});

// Method to verify API key
securitySettingSchema.methods.verifyApiKey = async function(apiKey) {
  if (!this.apiSecurity.apiKeyHash) return false;
  return await bcrypt.compare(apiKey, this.apiSecurity.apiKeyHash);
};

// Method to generate new API key
securitySettingSchema.methods.generateApiKey = function() {
  return `sk_${crypto.randomBytes(16).toString('hex')}`;
};

// Static method to get security settings for school
securitySettingSchema.statics.findBySchool = function(schoolId) {
  return this.findOne({ schoolId }).select('-apiSecurity.apiKeyHash');
};

export default mongoose.model('SecuritySetting', securitySettingSchema);