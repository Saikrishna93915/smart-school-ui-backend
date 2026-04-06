import mongoose from 'mongoose';

/**
 * Timetable Model - Master timetable for each class/section
 * Contains metadata about the timetable and links to individual slots
 */
const timetableSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required']
    },
    
    sectionId: {
      type: String,
      required: [true, 'Section is required']
      // Section name like "A", "B", "C"
    },
    
    academicYearId: {
      type: String,
      required: [true, 'Academic year is required']
      // e.g., "2024-25", "2025-26"
    },
    
    term: {
      type: String,
      enum: ['term1', 'term2', 'annual'],
      default: 'annual'
    },
    
    version: {
      type: Number,
      default: 1
      // For version control when updating timetables
    },
    
    isPublished: {
      type: Boolean,
      default: false
      // Only published timetables are visible to students/parents
    },
    
    publishedDate: {
      type: Date
    },
    
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    effectiveFrom: {
      type: Date,
      required: [true, 'Effective from date is required']
    },
    
    effectiveTo: {
      type: Date
    },
    
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft'
    },
    
    totalPeriods: {
      type: Number,
      default: 0
      // Total number of periods per week
    },
    
    assignedPeriods: {
      type: Number,
      default: 0
      // Number of periods with assigned subjects
    },
    
    hasConflicts: {
      type: Boolean,
      default: false
    },
    
    conflictCount: {
      type: Number,
      default: 0
    },
    
    notes: {
      type: String,
      trim: true
    },
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
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

// Compound unique index to prevent duplicate timetables
timetableSchema.index(
  { classId: 1, sectionId: 1, academicYearId: 1, term: 1, version: 1 },
  { unique: true }
);

// Indexes for queries
timetableSchema.index({ classId: 1, sectionId: 1, isPublished: 1 });
timetableSchema.index({ academicYearId: 1, status: 1 });
timetableSchema.index({ effectiveFrom: 1, effectiveTo: 1 });
timetableSchema.index({ isPublished: 1, status: 1 });

// Virtual for completion percentage
timetableSchema.virtual('completionPercentage').get(function() {
  if (this.totalPeriods === 0) return 0;
  return Math.round((this.assignedPeriods / this.totalPeriods) * 100);
});

// Method to publish timetable
timetableSchema.methods.publish = function(userId) {
  this.isPublished = true;
  this.publishedDate = new Date();
  this.publishedBy = userId;
  this.status = 'published';
  return this.save();
};

// Method to archive timetable
timetableSchema.methods.archive = function() {
  this.status = 'archived';
  this.isPublished = false;
  return this.save();
};

timetableSchema.set('toJSON', { virtuals: true });
timetableSchema.set('toObject', { virtuals: true });

const Timetable = mongoose.model('Timetable', timetableSchema);

export default Timetable;
