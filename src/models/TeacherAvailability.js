import mongoose from 'mongoose';

/**
 * TeacherAvailability Model - Tracks teacher availability for scheduling
 * Used to mark when teachers are unavailable (leave, training, meetings, etc.)
 */
const teacherAvailabilitySchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher is required']
    },
    
    dayOfWeek: {
      type: Number,
      required: [true, 'Day of week is required'],
      min: 0,
      max: 6
      // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    },
    
    timeSlotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TimeSlot',
      required: [true, 'Time slot is required']
    },
    
    isAvailable: {
      type: Boolean,
      default: true
      // false = teacher is not available during this slot
    },
    
    academicYearId: {
      type: String,
      required: true
    },
    
    term: {
      type: String,
      enum: ['term1', 'term2', 'annual'],
      default: 'annual'
    },
    
    unavailabilityType: {
      type: String,
      enum: ['leave', 'training', 'meeting', 'personal', 'medical', 'other', null],
      default: null
    },
    
    reason: {
      type: String,
      trim: true
      // e.g., "On leave", "Staff meeting", "Training session"
    },
    
    startDate: {
      type: Date
      // For temporary unavailability
    },
    
    endDate: {
      type: Date
      // For temporary unavailability
    },
    
    isPermanent: {
      type: Boolean,
      default: false
      // true = ongoing unavailability for the term/year
    },
    
    isRecurring: {
      type: Boolean,
      default: true
      // true = applies every week on this day/time
    },
    
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    approvalDate: {
      type: Date
    },
    
    notes: {
      type: String,
      trim: true
    },
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index
teacherAvailabilitySchema.index(
  { teacherId: 1, dayOfWeek: 1, timeSlotId: 1, academicYearId: 1, term: 1 },
  { unique: true }
);

// Indexes for queries
teacherAvailabilitySchema.index({ teacherId: 1, isAvailable: 1 });
teacherAvailabilitySchema.index({ academicYearId: 1, term: 1 });
teacherAvailabilitySchema.index({ startDate: 1, endDate: 1 });

// Method to check if teacher is available on a specific date
teacherAvailabilitySchema.methods.isAvailableOnDate = function(checkDate) {
  if (this.isAvailable) return true;
  
  if (!this.isPermanent && this.startDate && this.endDate) {
    const check = new Date(checkDate);
    return check < this.startDate || check > this.endDate;
  }
  
  return false;
};

const TeacherAvailability = mongoose.model('TeacherAvailability', teacherAvailabilitySchema);

export default TeacherAvailability;
