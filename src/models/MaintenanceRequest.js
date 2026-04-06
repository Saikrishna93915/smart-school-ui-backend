// models/MaintenanceRequest.js - Enhanced Maintenance Request/Work Order System
import mongoose from 'mongoose';

const maintenanceRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    unique: true,
    default: () => `MNT${Date.now().toString().slice(-8)}`
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  // Request Details
  issueType: {
    type: String,
    enum: [
      'engine',
      'brakes',
      'tires',
      'lights',
      'ac_heating',
      'transmission',
      'suspension',
      'body_damage',
      'fluid_leak',
      'battery',
      'safety_equipment',
      'electrical',
      'interior',
      'other'
    ],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  // Vehicle Status at Reporting
  odometerReading: {
    type: Number,
    min: 0
  },
  fuelLevel: {
    type: Number,
    min: 0,
    max: 100
  },
  // Status Tracking
  status: {
    type: String,
    enum: ['pending', 'approved', 'in_progress', 'on_hold', 'completed', 'cancelled', 'rejected'],
    default: 'pending'
  },
  // Scheduling
  scheduledDate: Date,
  estimatedCompletionDate: Date,
  completionDate: Date,
  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Mechanic or maintenance staff
  },
  assignedGarage: {
    name: String,
    address: String,
    contact: String
  },
  // Cost Tracking
  estimatedCost: {
    type: Number,
    min: 0
  },
  actualCost: {
    type: Number,
    min: 0
  },
  costBreakdown: [{
    item: String,
    type: { type: String, enum: ['part', 'labor', 'other'] },
    quantity: Number,
    unitPrice: Number,
    total: Number
  }],
  // Work Details
  diagnosis: {
    type: String,
    trim: true
  },
  workPerformed: {
    type: String,
    trim: true
  },
  partsReplaced: [{
    partName: String,
    partNumber: String,
    quantity: Number,
    cost: Number
  }],
  // Notes & Communication
  notes: {
    type: String,
    trim: true
  },
  driverNotes: {
    type: String,
    trim: true
  },
  mechanicNotes: {
    type: String,
    trim: true
  },
  adminNotes: {
    type: String,
    trim: true
  },
  // Approval Workflow
  approvalRequired: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: {
    type: String,
    trim: true
  },
  // Evidence
  photos: [{
    url: String,
    caption: String,
    uploadedAt: Date
  }],
  documents: [{
    type: String, // invoice, receipt, warranty, etc.
    url: String,
    uploadedAt: Date
  }],
  // Quality Control
  qualityCheck: {
    performed: { type: Boolean, default: false },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: Date,
    passed: Boolean,
    notes: String
  },
  // Follow-up
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: Date,
  followUpNotes: String,
  // Reporting
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedAt: {
    type: Date,
    default: Date.now
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes - Removed duplicates (unique fields already create indexes)
maintenanceRequestSchema.index({ vehicle: 1 });
maintenanceRequestSchema.index({ driver: 1 });
maintenanceRequestSchema.index({ status: 1 });
maintenanceRequestSchema.index({ priority: 1 });
maintenanceRequestSchema.index({ issueType: 1 });
maintenanceRequestSchema.index({ scheduledDate: 1 });

// Virtual fields
maintenanceRequestSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') return false;
  if (!this.estimatedCompletionDate) return false;
  return new Date() > this.estimatedCompletionDate;
});

maintenanceRequestSchema.virtual('daysOpen').get(function() {
  const start = this.createdAt;
  const end = this.completionDate || new Date();
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
});

maintenanceRequestSchema.virtual('costVariance').get(function() {
  if (!this.estimatedCost || !this.actualCost) return 0;
  return this.actualCost - this.estimatedCost;
});

// Methods
maintenanceRequestSchema.methods.approve = function(userId, notes) {
  this.status = 'approved';
  this.approvedBy = userId;
  this.approvedAt = new Date();
  if (notes) this.adminNotes = notes;
  return this.save();
};

maintenanceRequestSchema.methods.reject = function(reason, userId) {
  this.status = 'rejected';
  this.rejectionReason = reason;
  this.approvedBy = userId;
  this.approvedAt = new Date();
  return this.save();
};

maintenanceRequestSchema.methods.updateStatus = function(newStatus, userId, notes) {
  this.status = newStatus;
  if (notes) {
    if (userId) {
      this.mechanicNotes = notes;
    } else {
      this.driverNotes = notes;
    }
  }
  if (newStatus === 'completed') {
    this.completionDate = new Date();
  }
  return this.save();
};

maintenanceRequestSchema.methods.complete = function(workPerformed, actualCost, userId) {
  this.status = 'completed';
  this.completionDate = new Date();
  if (workPerformed) this.workPerformed = workPerformed;
  if (actualCost) this.actualCost = actualCost;
  if (userId) {
    this.qualityCheck.performedBy = userId;
    this.qualityCheck.performedAt = new Date();
  }
  return this.save();
};

const MaintenanceRequest = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);

export default MaintenanceRequest;
