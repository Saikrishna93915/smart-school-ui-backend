import mongoose from "mongoose";

const timetableSchema = new mongoose.Schema({
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  },
  // Compatibility fields for legacy unique index: classId_1_sectionId_1_academicYearId_1_term_1_version_1
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    default: null,
  },
  section: {
    type: String,  // Section name: "A", "B", "C", etc.
    default: null,
    trim: true,
  },
  sectionId: {
    type: String,
    default: null,
    trim: true,
  },
  academicYearId: {
    type: String,
    default: null,
    trim: true,
  },
  term: {
    type: String,
    default: null,
    trim: true,
  },
  version: {
    type: String,
    default: null,
    trim: true,
  },
  day: {
    type: String,
    required: true,
    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
  period: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
  },
  subject: {
    type: String,  // Changed from ObjectId to String to support subject codes like "ENG101"
    required: true,
    trim: true,
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  roomNo: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

timetableSchema.index({ class: 1, section: 1, day: 1, period: 1 }, { unique: true });

const Timetable = mongoose.model("Timetable", timetableSchema);

export default Timetable;
