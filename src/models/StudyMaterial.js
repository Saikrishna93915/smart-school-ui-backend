import mongoose from 'mongoose';

const studyMaterialSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true
    },
    sectionId: {
      type: String,
      required: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: [true, 'Material title is required'],
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    chapterName: {
      type: String,
      default: ''
    },
    topicName: {
      type: String,
      default: ''
    },
    materialType: {
      type: String,
      enum: ['pdf', 'video', 'document', 'worksheet', 'presentation', 'image', 'audio', 'other'],
      required: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      default: 0
    },
    thumbnailUrl: {
      type: String,
      default: null
    },
    duration: {
      type: Number, // in minutes, for videos
      default: 0
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    learningOutcomes: [String],
    uploadedDate: {
      type: Date,
      default: Date.now
    },
    downloads: {
      type: Number,
      default: 0
    },
    views: {
      type: Number,
      default: 0
    },
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      count: {
        type: Number,
        default: 0
      }
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Indexes
studyMaterialSchema.index({ classId: 1, sectionId: 1 });
studyMaterialSchema.index({ teacherId: 1 });
studyMaterialSchema.index({ subjectId: 1 });
studyMaterialSchema.index({ materialType: 1 });
studyMaterialSchema.index({ uploadedDate: -1 });
studyMaterialSchema.index({ status: 1 });

export default mongoose.model('StudyMaterial', studyMaterialSchema);
