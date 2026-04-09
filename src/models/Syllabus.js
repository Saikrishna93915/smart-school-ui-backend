import mongoose from "mongoose";

/**
 * Enhanced Syllabus Model for Complete ERP System
 * Supports chapter-wise progress tracking, teacher updates, and student visibility
 */

const ChapterSchema = new mongoose.Schema({
  chapterNumber: {
    type: Number,
    required: true
  },
  chapterName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  topics: [{
    topicName: String,
    duration: String, // e.g., "2 hours"
  }],
  status: {
    type: String,
    enum: ["pending", "ongoing", "completed"],
    default: "pending"
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  // Learning outcomes for parents/students
  learningOutcomes: [String],
  // Resources like PDFs, links
  resources: [{
    title: String,
    url: String,
    type: {
      type: String,
      enum: ["pdf", "video", "link", "document"]
    }
  }],
  // Teacher notes (visible only to teachers and admin)
  teacherNotes: {
    type: String,
    trim: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const SyllabusSchema = new mongoose.Schema(
  {
    // Class and Section Info
    className: {
      type: String,
      required: true,
      // LKG, UKG, 1st Class, 2nd Class, ..., 10th Class
    },
    
    section: {
      type: String,
      required: true,
      enum: ["A", "B", "C", "D"],
    },
    
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true
    },
    
    academicYear: {
      type: String,
      required: true,
      default: "2025-2026"
    },
    
    // Syllabus content
    chapters: [ChapterSchema],
    
    // Overall syllabus info
    totalChapters: {
      type: Number,
      default: 0
    },
    
    completedChapters: {
      type: Number,
      default: 0
    },
    
    progressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    
    // Syllabus metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    
    // Visibility control
    isPublished: {
      type: Boolean,
      default: true // Students can see published syllabus
    },
    
    // Term/semester (optional)
    term: {
      type: String,
      enum: ["Term 1", "Term 2", "Term 3", "Annual"],
      default: "Annual"
    },
    
    // Exam info related to syllabus
    examSchedule: {
      midTerm: Date,
      finalTerm: Date
    }
  },
  { 
    timestamps: true 
  }
);

// Compound unique index - one syllabus per class-section-subject-year
SyllabusSchema.index(
  { className: 1, section: 1, subjectId: 1, academicYear: 1 },
  { unique: true }
);

// Pre-save hook to calculate progress
SyllabusSchema.pre('save', function() {
  if (this.chapters && this.chapters.length > 0) {
    this.totalChapters = this.chapters.length;
    this.completedChapters = this.chapters.filter(ch => ch.status === 'completed').length;
    this.progressPercentage = Math.round((this.completedChapters / this.totalChapters) * 100);
  }
});

// Method to update chapter status
SyllabusSchema.methods.updateChapterStatus = function(chapterId, status, userId) {
  const chapter = this.chapters.id(chapterId);
  if (chapter) {
    chapter.status = status;
    chapter.updatedBy = userId;
    chapter.updatedAt = new Date();
    
    if (status === 'completed') {
      chapter.completedDate = new Date();
    } else if (status === 'ongoing' && !chapter.startDate) {
      chapter.startDate = new Date();
    }
  }
  return this.save();
};

const Syllabus = mongoose.model("Syllabus", SyllabusSchema);
export default Syllabus;
