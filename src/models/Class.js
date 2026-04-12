import mongoose from "mongoose";
import {
  buildCanonicalClassFields,
  normalizeAcademicYear,
  normalizeClassSection,
} from "../utils/classNaming.js";

const classTeacherHistorySchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
    assignedFrom: {
      type: Date,
      default: Date.now,
    },
    assignedTo: {
      type: Date,
      default: null,
    },
    assignedBy: {
      type: String,
      default: "system",
      trim: true,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "ended", "transferred"],
      default: "active",
    },
  },
  { _id: true, timestamps: true }
);

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  section: {
    type: String,
    default: null,
    trim: true,
  },
  classNumber: {
    type: Number,
    default: null,
  },
  classOrder: {
    type: Number,
    default: 99,
  },
  capacity: {
    type: Number,
    required: true,
    default: 40,
  },
  status: {
    type: String,
    enum: ["active", "inactive", "archived", "upcoming"],
    default: "active",
  },
  term: {
    type: String,
    enum: ["term1", "term2", "annual"],
    default: "annual",
  },
  classTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    default: null,
  },
  classTeacherAssignedAt: {
    type: Date,
    default: null,
  },
  classTeacherAssignedBy: {
    type: String,
    default: null,
    trim: true,
  },
  classTeacherHistory: {
    type: [classTeacherHistorySchema],
    default: [],
  },
  academicYear: {
    type: String,
    required: true,
  },
  studentCount: {
    type: Number,
    default: 0,
  },
  roomNumber: {
    type: String,
    default: null,
    trim: true,
  },
  building: {
    type: String,
    default: null,
    trim: true,
  },
  floor: {
    type: Number,
    default: 1,
  },
  timetableId: {
    type: String,
    default: null,
    trim: true,
  },
  periodsPerDay: {
    type: Number,
    default: 8,
  },
  workingDays: {
    type: [String],
    default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
  isComposite: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: String,
    default: "system",
    trim: true,
  },
  updatedBy: {
    type: String,
    default: "system",
    trim: true,
  },
}, {
  timestamps: true,
});

classSchema.pre("validate", function normalizeClassDocument() {
  const canonicalFields = buildCanonicalClassFields({
    name: this.name,
    section: this.section,
    academicYear: this.academicYear,
  });

  if (canonicalFields.name) {
    this.name = canonicalFields.name;
  }

  this.section = normalizeClassSection(this.section);
  this.academicYear = normalizeAcademicYear(this.academicYear);
  this.classNumber = canonicalFields.classNumber;
  this.classOrder = canonicalFields.classOrder;
});

classSchema.index({ name: 1, section: 1, academicYear: 1 }, { unique: true });
classSchema.index({ classNumber: 1, section: 1, academicYear: 1 });
classSchema.index({ status: 1, classOrder: 1, academicYear: 1 });
classSchema.index({ classTeacher: 1, academicYear: 1 });

const Class = mongoose.model("Class", classSchema);

export default Class;
