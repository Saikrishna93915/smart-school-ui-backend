import mongoose from 'mongoose';

/**
 * TimetableSlot Model - Individual period in the timetable
 * Links day, time, subject, and teacher together
 */
const timetableSlotSchema = new mongoose.Schema(
  {
    timetableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Timetable',
      required: [true, 'Timetable reference is required']
    },
    
    dayOfWeek: {
      type: Number,
      required: [true, 'Day of week is required'],
      min: 0,
      max: 6
      // 0 = Sunday, 1 = Monday, 2 = Tuesday, ..., 6 = Saturday
    },
    
    dayName: {
      type: String,
      enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      required: true
    },
    
    timeSlotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TimeSlot',
      required: [true, 'Time slot is required']
    },
    
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject'
      // Optional - can be empty for free periods
    },
    
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
      // Reference to teacher (User with role = 'teacher')
    },
    
    roomNumber: {
      type: String,
      trim: true
      // e.g., "101", "Lab A", "Physics Lab"
    },
    
    building: {
      type: String,
      trim: true
      // Optional building identifier
    },
    
    floor: {
      type: String,
      trim: true
      // Optional floor number
    },
    
    isLabSession: {
      type: Boolean,
      default: false
      // Indicates if this is a practical/lab session
    },
    
    isSplitClass: {
      type: Boolean,
      default: false
      // For classes divided into groups (e.g., Physics practical)
    },
    
    splitGroup: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'all', null],
      default: null
      // Which group this slot is for (if split)
    },
    
    alternateWeek: {
      type: String,
      enum: ['odd', 'even', 'both', null],
      default: 'both'
      // For alternating schedule patterns
    },
    
    substituteTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
      // Temporary substitute teacher
    },
    
    isSubstitute: {
      type: Boolean,
      default: false
    },
    
    substituteDate: {
      type: Date
      // Date for which substitute is assigned
    },
    
    hasConflict: {
      type: Boolean,
      default: false
    },
    
    conflictType: {
      type: String,
      enum: ['teacher_clash', 'room_clash', 'double_booking', 'qualification_mismatch', 'none'],
      default: 'none'
    },
    
    conflictDetails: {
      type: String
      // Human-readable conflict description
    },
    
    isActive: {
      type: Boolean,
      default: true
    },
    
    remarks: {
      type: String,
      trim: true
    },
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    lastModifiedBy: {
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

// Compound unique index to prevent duplicate slots
timetableSlotSchema.index(
  { timetableId: 1, dayOfWeek: 1, timeSlotId: 1, splitGroup: 1 },
  { unique: true }
);

// Indexes for queries
timetableSlotSchema.index({ timetableId: 1, dayOfWeek: 1 });
timetableSlotSchema.index({ teacherId: 1, dayOfWeek: 1, timeSlotId: 1 });
timetableSlotSchema.index({ subjectId: 1 });
timetableSlotSchema.index({ roomNumber: 1, dayOfWeek: 1, timeSlotId: 1 });
timetableSlotSchema.index({ hasConflict: 1 });
timetableSlotSchema.index({ isActive: 1 });

// Auto-set dayName based on dayOfWeek
timetableSlotSchema.pre('save', async function(next) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (this.dayOfWeek !== undefined) {
    this.dayName = days[this.dayOfWeek];
  }
});

// Method to mark as conflict
timetableSlotSchema.methods.markConflict = function(type, details) {
  this.hasConflict = true;
  this.conflictType = type;
  this.conflictDetails = details;
  return this.save();
};

// Method to clear conflict
timetableSlotSchema.methods.clearConflict = function() {
  this.hasConflict = false;
  this.conflictType = 'none';
  this.conflictDetails = null;
  return this.save();
};

// Method to assign substitute
timetableSlotSchema.methods.assignSubstitute = function(teacherId, date) {
  this.substituteTeacherId = teacherId;
  this.isSubstitute = true;
  this.substituteDate = date;
  return this.save();
};

const TimetableSlot = mongoose.model('TimetableSlot', timetableSlotSchema);

export default TimetableSlot;
