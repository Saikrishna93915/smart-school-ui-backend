import mongoose from 'mongoose';

const progressClassRemarkSchema = new mongoose.Schema(
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
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
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
    totalMarksObtained: {
      type: Number,
      default: 0
    },
    totalMaxMarks: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    rankInClass: Number,
    gradeObtained: String,
    coCurricular: {
      literature: { type: String, enum: ['A', 'B', 'C', 'D'], default: 'C' },
      cultural: { type: String, enum: ['A', 'B', 'C', 'D'], default: 'C' },
      scientific: { type: String, enum: ['A', 'B', 'C', 'D'], default: 'C' },
      creativity: { type: String, enum: ['A', 'B', 'C', 'D'], default: 'C' },
      games: { type: String, enum: ['A', 'B', 'C', 'D'], default: 'C' }
    },
    personality: {
      regularity: { type: String, enum: ['A', 'B', 'C', 'D'], default: 'C' },
      punctuality: { type: String, enum: ['A', 'B', 'C', 'D'], default: 'C' },
      cleanliness: { type: String, enum: ['A', 'B', 'C', 'D'], default: 'C' },
      discipline: { type: String, enum: ['A', 'B', 'C', 'D'], default: 'C' },
      cooperation: { type: String, enum: ['A', 'B', 'C', 'D'], default: 'C' }
    },
    attendance: {
      totalWorkingDays: { type: Number, default: 0 },
      daysPresent: { type: Number, default: 0 },
      attendancePercentage: { type: Number, default: 0 }
    },
    classTeacherRemark: String,
    promotedToClass: String,
    resultDeclaredOn: Date,
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

progressClassRemarkSchema.index(
  { studentId: 1, examCycleId: 1 },
  { unique: true }
);

const ProgressClassRemark = mongoose.model('ProgressClassRemark', progressClassRemarkSchema);
export default ProgressClassRemark;
