import mongoose from 'mongoose';

const classScheduleSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true
    },
    sectionId: {
      type: String,
      required: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    subject: {
      type: String,
      required: true // Subject name for quick reference
    },
    dayOfWeek: {
      type: Number,
      enum: [0, 1, 2, 3, 4, 5, 6], // 0 = Sunday, 6 = Saturday
      required: true
    },
    dayName: {
      type: String,
      enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      required: true
    },
    startTime: {
      type: String, // HH:mm format, e.g., "09:00"
      required: true
    },
    endTime: {
      type: String, // HH:mm format, e.g., "10:00"
      required: true
    },
    duration: {
      type: Number, // in minutes
      default: 45
    },
    room: {
      type: String,
      default: ''
    },
    building: {
      type: String,
      default: ''
    },
    academicYear: {
      type: String,
      required: true
    },
    semester: {
      type: String,
      default: '1'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    notes: {
      type: String,
      default: ''
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Compound index for efficient queries
classScheduleSchema.index({ classId: 1, sectionId: 1, dayOfWeek: 1 });
classScheduleSchema.index({ teacherId: 1 });
classScheduleSchema.index({ classId: 1, dayOfWeek: 1, startTime: 1 });
classScheduleSchema.index({ academicYear: 1 });

export default mongoose.model('ClassSchedule', classScheduleSchema);
