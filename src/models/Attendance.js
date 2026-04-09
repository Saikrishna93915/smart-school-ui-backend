import mongoose from "mongoose";

/**
 * Attendance Schema
 * Session-based (Morning / Afternoon)
 * One record per student per day
 */
const attendanceSchema = new mongoose.Schema(
  {
    // 🔗 Student Reference
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    // 🏫 Academic Context
    academicYear: {
      type: String,
      required: true, // e.g. "2025-2026"
    },

    className: {
      type: String,
      required: true, // e.g. "10th"
    },

    section: {
      type: String,
      required: true, // e.g. "A"
    },

    // 📅 Attendance Date
    date: {
      type: Date,
      required: true,
      index: true,
    },

    // ⏱ Session-based Attendance
    sessions: {
      morning: {
        type: String,
        enum: ["present", "absent"],
        required: true,
      },
      afternoon: {
        type: String,
        enum: ["present", "absent"],
        required: true,
      },
    },

    // 👤 Marked By (Admin for now)
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    markedRole: {
      type: String,
      enum: ["admin", "owner"],
      default: "admin",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * 🔒 Prevent duplicate attendance
 * One student → one attendance record per day
 */
attendanceSchema.index(
  { studentId: 1, date: 1 },
  { unique: true }
);

export default mongoose.model("Attendance", attendanceSchema);
