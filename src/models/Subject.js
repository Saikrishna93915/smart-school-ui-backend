import mongoose from "mongoose";

/**
 * Enhanced Subject Model
 * Supports class-specific subjects and metadata
 */
const SubjectSchema = new mongoose.Schema(
  {
    subjectName: {
      type: String,
      required: true,
      trim: true
    },
    
    subjectCode: {
      type: String,
      trim: true,
      uppercase: true,
      // e.g., MATH-10, ENG-LKG
    },
    
    className: {
      type: String,
      required: true,
      // LKG, UKG, 1st Class, 2nd Class, ..., 10th Class
    },
    
    description: {
      type: String,
      trim: true
    },
    
    // Subject type
    category: {
      type: String,
      enum: ["Core", "Optional", "Language", "Activity", "Lab"],
      default: "Core"
    },
    
    // Marks configuration
    totalMarks: {
      type: Number,
      default: 100
    },
    
    passingMarks: {
      type: Number,
      default: 35
    },
    
    // Practical/theory split (for science subjects)
    hasPractical: {
      type: Boolean,
      default: false
    },
    
    practicalMarks: {
      type: Number,
      default: 0
    },
    
    theoryMarks: {
      type: Number,
      default: 100
    },
    
    isActive: {
      type: Boolean,
      default: true
    },
    
    // Academic year
    academicYear: {
      type: String,
      default: "2025-2026"
    },
    
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { 
    timestamps: true 
  }
);

// Index for fast lookups
SubjectSchema.index({ className: 1, subjectName: 1, academicYear: 1 });

const Subject = mongoose.model("Subject", SubjectSchema);
export default Subject;
