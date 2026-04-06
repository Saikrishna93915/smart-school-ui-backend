import mongoose from 'mongoose';

const systemHealthSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  uptime: {
    type: Number, // percentage
    min: 0,
    max: 100,
    default: 100
  },
  responseTime: {
    average: Number, // in milliseconds
    p95: Number,
    p99: Number,
    max: Number
  },
  resources: {
    cpu: {
      usage: Number, // percentage
      cores: Number,
      load: [Number]
    },
    memory: {
      total: Number, // in GB
      used: Number,
      free: Number,
      usage: Number // percentage
    },
    storage: {
      total: Number, // in GB
      used: Number,
      free: Number,
      usage: Number // percentage
    },
    network: {
      inbound: Number, // in Mbps
      outbound: Number,
      connections: Number
    }
  },
  database: {
    connections: {
      active: Number,
      idle: Number,
      total: Number
    },
    queries: {
      perSecond: Number,
      slowQueries: Number,
      avgQueryTime: Number
    },
    size: {
      total: Number, // in MB
      data: Number,
      index: Number
    }
  },
  services: [{
    name: String,
    status: {
      type: String,
      enum: ['up', 'down', 'degraded', 'maintenance']
    },
    responseTime: Number,
    lastCheck: Date,
    version: String
  }],
  users: {
    active: Number,
    total: Number,
    concurrent: Number,
    newToday: Number
  },
  errorLogs: [{
    type: String,
    message: String,
    count: Number,
    firstOccurred: Date,
    lastOccurred: Date
  }],
  alerts: [{
    level: {
      type: String,
      enum: ['info', 'warning', 'error', 'critical']
    },
    message: String,
    service: String,
    timestamp: Date,
    resolved: Boolean,
    resolvedAt: Date
  }],
  metrics: {
    requests: {
      total: Number,
      successful: Number,
      failed: Number,
      perSecond: Number
    },
    cache: {
      hitRate: Number,
      size: Number,
      evictions: Number
    },
    queue: {
      length: Number,
      processing: Number,
      waiting: Number
    }
  },
  backups: {
    lastSuccessful: Date,
    lastFailed: Date,
    size: Number,
    count: Number
  },
  security: {
    failedLogins: Number,
    suspiciousActivities: Number,
    blockedIPs: Number,
    lastScan: Date
  },
  recommendations: [{
    type: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    message: String,
    action: String,
    estimatedImpact: String
  }],
  metadata: {
    collectedBy: String,
    interval: Number, // in minutes
    nextCheck: Date,
    version: String
  }
}, {
  timestamps: true
});

// Indexes for time-series queries
systemHealthSchema.index({ schoolId: 1, timestamp: -1 });
systemHealthSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

// Static method to get latest health status
systemHealthSchema.statics.getLatest = function(schoolId) {
  return this.findOne({ schoolId }).sort({ timestamp: -1 });
};

// Static method to get health history
systemHealthSchema.statics.getHistory = function(schoolId, hours = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({
    schoolId,
    timestamp: { $gte: cutoff }
  }).sort({ timestamp: 1 });
};

// Method to check if system is healthy
systemHealthSchema.methods.isHealthy = function() {
  return this.uptime >= 99.5 &&
    this.responseTime.average < 500 &&
    this.resources.cpu.usage < 80 &&
    this.resources.memory.usage < 85 &&
    this.resources.storage.usage < 90;
};

// Pre-save middleware to calculate derived metrics
systemHealthSchema.pre('save', function(next) {
  // Calculate overall health score
  let score = 100;
  
  if (this.uptime < 99) score -= 20;
  if (this.responseTime.average > 1000) score -= 15;
  if (this.resources.cpu.usage > 90) score -= 10;
  if (this.resources.memory.usage > 90) score -= 10;
  if (this.resources.storage.usage > 95) score -= 5;
  
  this.healthScore = Math.max(0, score);
  
  next();
});

export default mongoose.model('SystemHealth', systemHealthSchema);