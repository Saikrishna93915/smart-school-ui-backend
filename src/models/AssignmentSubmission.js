import mongoose from 'mongoose';

const assignmentSubmissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true
    },
    sectionId: {
      type: String,
      required: true
    },
    submittedFile: {
      fileName: String,
      fileUrl: String,
      fileSize: Number
    },
    submittedText: {
      type: String,
      default: ''
    },
    submittedDate: {
      type: Date,
      default: Date.now
    },
    isLateSubmission: {
      type: Boolean,
      default: false
    },
    daysLate: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['pending', 'submitted', 'graded', 'unsubmitted'],
      default: 'unsubmitted'
    },
    obtainedPoints: {
      type: Number,
      min: 0
    },
    totalPoints: {
      type: Number,
      default: 100
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    gradeLevel: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'F', 'P', 'F'],
      default: null
    },
    feedback: {
      type: String,
      default: ''
    },
    teacherRemarks: {
      type: String,
      default: ''
    },
    gradedDate: {
      type: Date,
      default: null
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    plagiarismScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    rubricScores: [
      {
        criterion: String,
        maxPoints: Number,
        obtainedPoints: Number,
        weight: Number
      }
    ],
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
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

// Indexes
assignmentSubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
assignmentSubmissionSchema.index({ studentId: 1 });
assignmentSubmissionSchema.index({ classId: 1, sectionId: 1 });
assignmentSubmissionSchema.index({ status: 1 });
assignmentSubmissionSchema.index({ gradedDate: 1 });

export default mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);
