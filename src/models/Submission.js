import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({
  questionId: String,
  selectedOptions: [Number],
  textAnswer: String,
  rawAnswer: mongoose.Schema.Types.Mixed,
  codeAnswer: String,
  marksAwarded: Number
});

const submissionSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  status: {
    type: String,
    enum: ["in-progress", "submitted", "evaluated"],
    default: "submitted"
  },

  answers: [answerSchema],
  totalMarksObtained: Number,
  rank: Number,
  submittedAt: Date,
  evaluatedAt: Date,
  progress: {
    timeRemaining: Number,
    lastSavedAt: Date
  }
}, { timestamps: true });

export default mongoose.model("Submission", submissionSchema);
