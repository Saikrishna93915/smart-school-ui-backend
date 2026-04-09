import mongoose from 'mongoose';

const progressExamCycleSchema = new mongoose.Schema(
  {
    academicYear: {
      type: String,
      required: true,
      trim: true
    },
    examName: {
      type: String,
      required: true,
      trim: true
    },
    examCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    examType: {
      type: String,
      enum: ['Unit Test', 'Quarterly', 'Half Yearly', 'Annual'],
      required: true
    },
    examSequence: {
      type: Number,
      required: true,
      min: 1
    },
    startDate: Date,
    endDate: Date,
    resultDate: Date,
    isActive: {
      type: Boolean,
      default: true
    },
    isPublished: {
      type: Boolean,
      default: false
    },
    publishedAt: Date,
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

progressExamCycleSchema.index({ examCode: 1 }, { unique: true });
progressExamCycleSchema.index(
  { academicYear: 1, examSequence: 1, examName: 1 },
  { unique: true }
);

const ProgressExamCycle = mongoose.model('ProgressExamCycle', progressExamCycleSchema);
export default ProgressExamCycle;
