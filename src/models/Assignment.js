import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
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
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: [true, 'Assignment title is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Assignment description is required']
    },
    instructions: {
      type: String,
      default: ''
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required']
    },
    totalPoints: {
      type: Number,
      default: 100,
      min: 0,
      max: 1000
    },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    submissionType: {
      type: String,
      enum: ['file', 'text', 'both'],
      default: 'file'
    },
    allowLateSubmission: {
      type: Boolean,
      default: true
    },
    latePenalty: {
      type: Number,
      default: 0, // Percentage deduction
      min: 0,
      max: 100
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'closed'],
      default: 'draft'
    },
    submissionCount: {
      type: Number,
      default: 0
    },
    gradeCount: {
      type: Number,
      default: 0
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

// Indexes
assignmentSchema.index({ classId: 1, sectionId: 1 });
assignmentSchema.index({ teacherId: 1 });
assignmentSchema.index({ dueDate: 1 });
assignmentSchema.index({ status: 1 });

export default mongoose.model('Assignment', assignmentSchema);
