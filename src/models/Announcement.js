import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true
    },
    summary: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ["general", "exam", "holiday", "event", "meeting", "emergency", "achievement", "reminder"],
      default: "general"
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium"
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "published", "archived"],
      default: "draft"
    },
    audience: {
      type: {
        type: String,
        enum: ["all", "students", "parents", "teachers", "staff", "custom"],
        default: "all"
      },
      classes: [String],
      sections: [String],
      studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
      parentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Parent" }],
      teacherIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Teacher" }]
    },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    },
    scheduledFor: {
      type: Date
    },
    expiresAt: {
      type: Date
    },
    pinned: {
      type: Boolean,
      default: false
    },
    featured: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    stats: {
      views: { type: Number, default: 0 },
      reads: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      reactions: {
        likes: { type: Number, default: 0 },
        dislikes: { type: Number, default: 0 }
      },
      comments: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

// Index for faster queries
announcementSchema.index({ type: 1, status: 1, createdAt: -1 });
announcementSchema.index({ pinned: -1, createdAt: -1 });

export default mongoose.model("Announcement", announcementSchema);
