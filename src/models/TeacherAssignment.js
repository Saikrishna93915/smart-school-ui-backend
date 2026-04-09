import mongoose from "mongoose";

/**
 * TeacherAssignment Model
 * Defines which teacher teaches which subject for which class and section
 * Core model for ERP teacher-subject mapping
 */
const TeacherAssignmentSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true
    },
    
    className: {
      type: String,
      required: true,
      // LKG, UKG, 1st Class, 2nd Class, ..., 10th Class
    },
    
    section: {
      type: String,
      required: true,
      enum: ["A", "B", "C", "D"],
    },
    
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true
    },
    
    academicYear: {
      type: String,
      required: true,
      default: "2025-2026"
    },
    
    isActive: {
      type: Boolean,
      default: true
    },
    
    // Assignment metadata
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    
    assignedDate: {
      type: Date,
      default: Date.now
    },
    
    // Notes for admin reference
    notes: {
      type: String,
      trim: true
    }
  },
  { 
    timestamps: true,
    // Ensure no duplicate assignments
    indexes: [
      { teacherId: 1, className: 1, section: 1, subjectId: 1, academicYear: 1 }
    ]
  }
);

// Compound index to prevent duplicate assignments
TeacherAssignmentSchema.index(
  { className: 1, section: 1, subjectId: 1, academicYear: 1 },
  { unique: true }
);

// Virtual to get teacher details populated
TeacherAssignmentSchema.virtual('teacherDetails', {
  ref: 'Teacher',
  localField: 'teacherId',
  foreignField: '_id',
  justOne: true
});

// Virtual to get subject details
TeacherAssignmentSchema.virtual('subjectDetails', {
  ref: 'Subject',
  localField: 'subjectId',
  foreignField: '_id',
  justOne: true
});

const TeacherAssignment = mongoose.model("TeacherAssignment", TeacherAssignmentSchema);
export default TeacherAssignment;
