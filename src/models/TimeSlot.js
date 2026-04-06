import mongoose from 'mongoose';

/**
 * TimeSlot Model - School Timing Configuration
 * Defines the time periods in the school day (Period 1, Break, Lunch, etc.)
 */
const timeSlotSchema = new mongoose.Schema(
  {
    slotName: {
      type: String,
      required: [true, 'Slot name is required'],
      trim: true
      // Period 1, Period 2, Morning Break, Lunch Break, etc.
    },
    
    slotType: {
      type: String,
      enum: ['period', 'break', 'lunch', 'activity'],
      default: 'period',
      required: true
    },
    
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      // Format: "09:00" (24-hour format)
    },
    
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      // Format: "09:45" (24-hour format)
    },
    
    durationMinutes: {
      type: Number,
      // Auto-calculated from start and end time
    },
    
    displayOrder: {
      type: Number,
      required: true,
      default: 0
      // For sorting slots in sequence
    },
    
    academicYearId: {
      type: String,
      required: true,
      // Reference to academic year
    },
    
    isActive: {
      type: Boolean,
      default: true
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

// Calculate duration before saving
timeSlotSchema.pre('save', function(next) {
  if (this.startTime && this.endTime) {
    const [startHour, startMin] = this.startTime.split(':').map(Number);
    const [endHour, endMin] = this.endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    this.durationMinutes = endMinutes - startMinutes;
  }
  next();
});

// Indexes for performance
timeSlotSchema.index({ academicYearId: 1, displayOrder: 1 });
timeSlotSchema.index({ isActive: 1 });
timeSlotSchema.index({ slotType: 1 });

const TimeSlot = mongoose.model('TimeSlot', timeSlotSchema);

export default TimeSlot;
