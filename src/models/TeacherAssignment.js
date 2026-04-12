import mongoose from "mongoose";

const teacherAssignmentSchema = new mongoose.Schema({
  assignmentType: {
    type: String,
    enum: ["subject_teacher", "class_teacher"],
    default: "subject_teacher",
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true,
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  },
  className: {
    type: String,
    default: null,
    trim: true,
  },
  section: {
    type: String,
    default: null,
    trim: true,
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    default: null,
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    default: null,
  },
  academicYear: {
    type: String,
    required: true,
  },
  term: {
    type: String,
    enum: ["term1", "term2", "annual"],
    default: "annual",
  },
  periodsPerWeek: {
    type: Number,
    default: 5,
    min: 0,
    max: 50,
  },
  isPrimary: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ["active", "inactive", "pending", "on_leave"],
    default: "active",
  },
  notes: {
    type: String,
    default: "",
    trim: true,
  },
}, {
  timestamps: true,
});

teacherAssignmentSchema.index({ class: 1, academicYear: 1, assignmentType: 1 });
teacherAssignmentSchema.index({ teacher: 1, academicYear: 1 });

const TeacherAssignment = mongoose.model("TeacherAssignment", teacherAssignmentSchema);

export default TeacherAssignment;
