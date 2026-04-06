// models/IncidentReport.js - Incident/Accident Reporting System
import mongoose from 'mongoose';

const incidentReportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    unique: true,
    default: () => `INC${Date.now().toString().slice(-8)}`
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
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
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route'
  },
  // Incident Details
  type: {
    type: String,
    enum: [
      'accident',
      'near_miss',
      'student_injury',
      'student_misbehavior',
      'vehicle_breakdown',
      'route_deviation',
      'traffic_violation',
      'medical_emergency',
      'weather_related',
      'theft',
      'vandalism',
      'other'
    ],
    required: true
  },
  category: {
    type: String,
    enum: ['safety', 'behavioral', 'mechanical', 'operational', 'medical', 'security'],
    default: 'operational'
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    default: 'medium'
  },
  // Location & Time
  location: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  incidentDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  incidentTime: {
    type: String,
    required: true
  },
  // Description
  description: {
    type: String,
    required: true,
    trim: true
  },
  // People Involved
  studentsInvolved: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    },
    name: String,
    className: String,
    section: String,
    injury: String,
    actionTaken: String
  }],
  witnesses: [{
    name: String,
    contact: String,
    statement: String
  }],
  // Response & Action
  immediateAction: {
    type: String,
    trim: true
  },
  actionTaken: {
    type: String,
    trim: true
  },
  reportedTo: {
    police: { type: Boolean, default: false },
    parents: { type: Boolean, default: false },
    insurance: { type: Boolean, default: false },
    rto: { type: Boolean, default: false }
  },
  // Investigation
  status: {
    type: String,
    enum: ['pending', 'under_review', 'investigating', 'resolved', 'closed'],
    default: 'pending'
  },
  investigationNotes: {
    type: String,
    trim: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewDate: Date,
  resolution: {
    type: String,
    trim: true
  },
  resolutionDate: Date,
  // Evidence
  photos: [{
    url: String,
    caption: String,
    uploadedAt: Date
  }],
  documents: [{
    type: { type: String }, // FIR, Medical Report, Insurance Claim, etc.
    url: String,
    uploadedAt: Date
  }],
  // Financial
  estimatedDamage: {
    type: Number,
    min: 0
  },
  insuranceClaim: {
    filed: { type: Boolean, default: false },
    claimNumber: String,
    amount: Number
  },
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
incidentReportSchema.index({ driver: 1 });
incidentReportSchema.index({ vehicle: 1 });
incidentReportSchema.index({ type: 1 });
incidentReportSchema.index({ severity: 1 });
incidentReportSchema.index({ status: 1 });
incidentReportSchema.index({ incidentDate: 1 });

// Virtual fields
incidentReportSchema.virtual('isResolved').get(function() {
  return this.status === 'resolved' || this.status === 'closed';
});

incidentReportSchema.virtual('daysOpen').get(function() {
  const start = this.incidentDate || this.createdAt;
  const end = this.resolutionDate || new Date();
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
});

// Method to update status
incidentReportSchema.methods.updateStatus = function(newStatus, notes, userId) {
  this.status = newStatus;
  if (notes) {
    this.investigationNotes = notes;
  }
  if (newStatus === 'resolved' || newStatus === 'closed') {
    this.resolutionDate = new Date();
  }
  if (userId) {
    this.reviewedBy = userId;
    this.reviewDate = new Date();
  }
  return this.save();
};

const IncidentReport = mongoose.model('IncidentReport', incidentReportSchema);

export default IncidentReport;
