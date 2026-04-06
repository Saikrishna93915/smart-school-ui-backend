import mongoose from 'mongoose';

const teacherLessonSchema = new mongoose.Schema(
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
    lessonTitle: {
      type: String,
      required: [true, 'Lesson title is required'],
      trim: true
    },
    chapterName: {
      type: String,
      required: true
    },
    chapterNumber: {
      type: Number,
      default: 0
    },
    topicName: {
      type: String,
      required: true
    },
    syllabus: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    duration: {
      type: Number, // in minutes
      default: 45
    },
    lessonDate: {
      type: Date,
      default: Date.now
    },
    learningOutcomes: [String],
    keyPoints: [String],
    teachingMethods: [String],
    resources: [
      {
        resourceName: String,
        resourceUrl: String,
        resourceType: String
      }
    ],
    preRequisites: [String],
    assignments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assignment'
      }
    ],
    materials: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudyMaterial'
      }
    ],
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate'
    },
    status: {
      type: String,
      enum: ['planned', 'in-progress', 'completed'],
      default: 'planned'
    },
    notes: {
      type: String,
      default: ''
    },
    feedback: {
      averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      studentFeedback: String
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
teacherLessonSchema.index({ classId: 1, sectionId: 1 });
teacherLessonSchema.index({ teacherId: 1 });
teacherLessonSchema.index({ subjectId: 1 });
teacherLessonSchema.index({ chapterName: 1 });
teacherLessonSchema.index({ lessonDate: -1 });
teacherLessonSchema.index({ status: 1 });

export default mongoose.model('TeacherLesson', teacherLessonSchema);
