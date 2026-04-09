import mongoose from 'mongoose';

const progressMarkEntrySchema = new mongoose.Schema(
  {
    academicYear: {
      type: String,
      required: true,
      trim: true
    },
    examCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProgressExamCycle',
      required: true
    },
    className: {
      type: String,
      required: true,
      trim: true
    },
    section: {
      type: String,
      required: true,
      trim: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    theoryMarks: {
      type: Number,
      default: 0,
      min: 0
    },
    practicalMarks: {
      type: Number,
      default: 0,
      min: 0
    },
    totalMarks: {
      type: Number,
      default: 0,
      min: 0
    },
    maxMarks: {
      type: Number,
      default: 100,
      min: 1
    },
    passingMarks: {
      type: Number,
      default: 35,
      min: 0
    },
    passingStatus: {
      type: String,
      enum: ['Pass', 'Fail', 'Absent', 'Not Applicable'],
      default: 'Not Applicable'
    },
    grade: {
      type: String,
      trim: true
    },
    gradePoint: {
      type: Number,
      min: 0,
      max: 10
    },
    teacherRemarks: {
      type: String,
      trim: true
    },
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    enteredDate: {
      type: Date,
      default: Date.now
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedDate: Date,
    isLocked: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Verified', 'Published'],
      default: 'Draft'
    }
  },
  { timestamps: true }
);

progressMarkEntrySchema.index(
  { studentId: 1, examCycleId: 1, subjectId: 1 },
  { unique: true }
);
progressMarkEntrySchema.index({ examCycleId: 1, className: 1, section: 1 });
progressMarkEntrySchema.index({ studentId: 1, academicYear: 1 });

const ProgressMarkEntry = mongoose.model('ProgressMarkEntry', progressMarkEntrySchema);
export default ProgressMarkEntry;
