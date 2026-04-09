import mongoose from "mongoose";

const proctoringLogSchema = new mongoose.Schema({
  exam: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Exam",
    required: true 
  },
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: true 
  },
  submission: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Submission"
  },
  violationType: {
    type: String,
    enum: [
      "tab_switch",
      "window_blur", 
      "fullscreen_exit",
      "copy_attempt",
      "paste_attempt",
      "right_click",
      "keyboard_shortcut",
      "other"
    ],
    required: true
  },
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true 
});

// Index for faster queries
proctoringLogSchema.index({ exam: 1, student: 1 });
proctoringLogSchema.index({ exam: 1, violationType: 1 });
proctoringLogSchema.index({ timestamp: -1 });

export default mongoose.model("ProctoringLog", proctoringLogSchema);
