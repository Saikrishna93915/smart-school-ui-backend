// models/VehicleChecklist.js - Vehicle Pre-Trip/Post-Trip Inspection Checklist
import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['ok', 'issue', 'not_applicable'], 
    default: null 
  },
  notes: { type: String, trim: true },
  images: [{ type: String }] // URLs to uploaded images
}, { _id: false });

const checklistSectionSchema = new mongoose.Schema({
  section: { type: String, required: true },
  items: [checklistItemSchema]
}, { _id: false });

const vehicleChecklistSchema = new mongoose.Schema({
  checklistId: {
    type: String,
    unique: true,
    default: () => `VCL${Date.now().toString().slice(-8)}`
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true
  },
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip'
  },
  checklistType: {
    type: String,
    enum: ['pre-trip', 'post-trip', 'daily', 'weekly', 'monthly'],
    default: 'pre-trip'
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  odometerReading: {
    type: Number,
    min: 0
  },
  fuelLevel: {
    type: Number,
    min: 0,
    max: 100
  },
  sections: [checklistSectionSchema],
  overallStatus: {
    type: String,
    enum: ['pass', 'fail', 'pending'],
    default: 'pending'
  },
  issuesFound: [{
    item: String,
    description: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    actionRequired: String
  }],
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewNotes: { type: String, trim: true },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes - Removed duplicates (unique fields already create indexes)
vehicleChecklistSchema.index({ vehicle: 1 });
vehicleChecklistSchema.index({ driver: 1 });
vehicleChecklistSchema.index({ trip: 1 });
vehicleChecklistSchema.index({ date: 1 });
vehicleChecklistSchema.index({ overallStatus: 1 });

// Virtual for issue count
vehicleChecklistSchema.virtual('issueCount').get(function() {
  return this.issuesFound?.length || 0;
});

// Method to calculate overall status
vehicleChecklistSchema.methods.calculateOverallStatus = function() {
  const allItems = this.sections.flatMap(section => section.items);
  const hasIssues = allItems.some(item => item.status === 'issue');
  const allCompleted = allItems.every(item => item.status !== null && item.status !== 'not_applicable');
  
  if (!allCompleted) {
    this.overallStatus = 'pending';
  } else if (hasIssues) {
    this.overallStatus = 'fail';
  } else {
    this.overallStatus = 'pass';
  }
  
  return this.overallStatus;
};

const VehicleChecklist = mongoose.model('VehicleChecklist', vehicleChecklistSchema);

export default VehicleChecklist;
