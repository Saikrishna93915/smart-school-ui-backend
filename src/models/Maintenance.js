// models/Maintenance.js - COMPLETE CLEAN VERSION (NO MIDDLEWARE)
import mongoose from 'mongoose';

const maintenanceSchema = new mongoose.Schema({
  maintenanceId: {
    type: String,
    unique: true,
    default: () => `MT${Date.now().toString().slice(-6)}`
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
  issueDescription: {
    type: String,
    required: true,
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  estimatedCost: {
    type: Number,
    default: 0,
    min: 0
  },
  actualCost: {
    type: Number,
    min: 0
  },
  scheduledDate: {
    type: Date,
    default: Date.now
  },
  completionDate: {
    type: Date
  },
  reportedBy: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// REMOVE THE PROBLEMATIC MIDDLEWARE
// maintenanceSchema.pre(/^find/, function (next) {
//   if (this._conditions.isDeleted !== true) {
//     this.where({ isDeleted: { $ne: true } });
//   }
//   next();
// });

// Indexes - Removed duplicates (unique fields already create indexes)
maintenanceSchema.index({ vehicle: 1 });
maintenanceSchema.index({ status: 1 });
maintenanceSchema.index({ priority: 1 });
maintenanceSchema.index({ scheduledDate: 1 });

// Virtual fields
maintenanceSchema.virtual('overdue').get(function() {
  if (this.status !== 'completed' && this.scheduledDate) {
    return new Date() > new Date(this.scheduledDate);
  }
  return false;
});

maintenanceSchema.virtual('costDifference').get(function() {
  if (this.actualCost && this.estimatedCost) {
    return this.actualCost - this.estimatedCost;
  }
  return 0;
});

maintenanceSchema.virtual('duration').get(function() {
  if (this.completionDate && this.scheduledDate) {
    const start = new Date(this.scheduledDate);
    const end = new Date(this.completionDate);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)); // Days
  }
  return 0;
});

const Maintenance = mongoose.model('Maintenance', maintenanceSchema);

export default Maintenance;