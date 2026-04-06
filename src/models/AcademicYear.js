import mongoose from 'mongoose';

const academicYearSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  year: {
    type: String,
    required: true,
    match: [/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY']
  },
  name: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isCurrent: {
    type: Boolean,
    default: false,
    index: true
  },
  terms: [{
    name: {
      type: String,
      required: true
    },
    number: {
      type: Number,
      required: true,
      min: 1
    },
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ['upcoming', 'active', 'completed', 'cancelled'],
      default: 'upcoming'
    }
  }],
  sessions: [{
    name: String,
    type: {
      type: String,
      enum: ['regular', 'summer', 'winter', 'special'],
      default: 'regular'
    },
    startDate: Date,
    endDate: Date
  }],
  holidays: [{
    date: Date,
    name: String,
    type: {
      type: String,
      enum: ['national', 'state', 'religious', 'school', 'other']
    },
    description: String
  }],
  gradingSystem: {
    type: {
      type: String,
      enum: ['percentage', 'cgpa', 'letter', 'both'],
      default: 'percentage'
    },
    passingPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 33
    },
    maxMarks: {
      type: Number,
      default: 100
    },
    gradeScale: [{
      min: Number,
      max: Number,
      grade: String,
      points: Number,
      description: String
    }]
  },
  timetable: {
    classDuration: {
      type: Number,
      min: 30,
      max: 120,
      default: 45
    },
    periodsPerDay: {
      type: Number,
      min: 1,
      max: 12,
      default: 8
    },
    workingDays: {
      monday: { type: Boolean, default: true },
      tuesday: { type: Boolean, default: true },
      wednesday: { type: Boolean, default: true },
      thursday: { type: Boolean, default: true },
      friday: { type: Boolean, default: true },
      saturday: { type: Boolean, default: false },
      sunday: { type: Boolean, default: false }
    }
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'archived'],
    default: 'draft'
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date
  }
}, {
  timestamps: true
});

// Ensure only one current academic year per school
academicYearSchema.pre('save', async function() {
  if (this.isCurrent) {
    await this.constructor.updateMany(
      { schoolId: this.schoolId, _id: { $ne: this._id } },
      { $set: { isCurrent: false } }
    );
  }
  
  // Validate dates
  if (this.startDate >= this.endDate) {
    throw new Error('Start date must be before end date');
  }
});

// Static method to get current academic year
academicYearSchema.statics.getCurrent = function(schoolId) {
  return this.findOne({ schoolId, isCurrent: true });
};

// Method to check if date is within academic year
academicYearSchema.methods.isDateInRange = function(date) {
  const checkDate = new Date(date);
  return checkDate >= this.startDate && checkDate <= this.endDate;
};

// Method to get active term
academicYearSchema.methods.getActiveTerm = function() {
  const now = new Date();
  return this.terms.find(term => 
    term.status === 'active' || 
    (term.startDate <= now && term.endDate >= now)
  );
};

export default mongoose.model('AcademicYear', academicYearSchema);