import mongoose from 'mongoose';

const studentPerformanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
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
    academicYear: {
      type: String,
      required: true
    },
    // Academic Metrics
    examMarks: {
      totalExams: { type: Number, default: 0 },
      totalMarks: { type: Number, default: 0 },
      averageMarks: { type: Number, default: 0 },
      highestMarks: { type: Number, default: 0 },
      lowestMarks: { type: Number, default: 0 },
      exams: [
        {
          examId: mongoose.Schema.Types.ObjectId,
          examName: String,
          marks: Number,
          totalMarks: Number,
          percentage: Number,
          date: Date
        }
      ]
    },
    assignmentMarks: {
      totalAssignments: { type: Number, default: 0 },
      submittedAssignments: { type: Number, default: 0 },
      averageMarks: { type: Number, default: 0 },
      submissions: [
        {
          assignmentId: mongoose.Schema.Types.ObjectId,
          title: String,
          obtainedPoints: Number,
          totalPoints: Number,
          percentage: Number,
          submittedDate: Date
        }
      ]
    },
    attendanceRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    attendanceData: {
      totalClasses: { type: Number, default: 0 },
      classesAttended: { type: Number, default: 0 },
      classesAbsent: { type: Number, default: 0 }
    },
    // Behavioral & Engagement
    participationScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    engagement: {
      type: String,
      enum: ['very-low', 'low', 'medium', 'high', 'very-high'],
      default: 'medium'
    },
    discipline: {
      type: String,
      enum: ['poor', 'fair', 'good', 'very-good', 'excellent'],
      default: 'good'
    },
    behaviorIncidents: {
      type: Number,
      default: 0
    },
    classParticipation: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    // Performance Categories
    overallPerformance: {
      type: String,
      enum: ['failing', 'below-average', 'average', 'above-average', 'excellent'],
      default: 'average'
    },
    performanceGrade: {
      type: String,
      enum: ['F', 'D', 'C', 'B', 'A'],
      default: 'C'
    },
    performancePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    // Trend Analysis
    performanceTrend: {
      type: String,
      enum: ['declining', 'stable', 'improving', 'rapidly-improving'],
      default: 'stable'
    },
    improvementAreas: [String],
    strengthAreas: [String],
    // Teacher Comments & Feedback
    teacherComments: [
      {
        comment: String,
        date: { type: Date, default: Date.now },
        category: {
          type: String,
          enum: ['academic', 'behavioral', 'engagement', 'general']
        }
      }
    ],
    recommendations: {
      type: String,
      default: ''
    },
    interventionsNeeded: [
      {
        intervention: String,
        priority: {
          type: String,
          enum: ['high', 'medium', 'low']
        },
        startDate: Date,
        status: {
          type: String,
          enum: ['pending', 'in-progress', 'completed'],
          default: 'pending'
        }
      }
    ],
    // Progress Tracking
    progressNotes: [
      {
        note: String,
        date: { type: Date, default: Date.now },
        noteType: String
      }
    ],
    lastReviewDate: {
      type: Date,
      default: null
    },
    parentsNotificationSent: {
      type: Boolean,
      default: false
    },
    parentNotificationDate: {
      type: Date,
      default: null
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
studentPerformanceSchema.index({ studentId: 1, classId: 1, subjectId: 1 });
studentPerformanceSchema.index({ classId: 1, sectionId: 1 });
studentPerformanceSchema.index({ teacherId: 1 });
studentPerformanceSchema.index({ overallPerformance: 1 });
studentPerformanceSchema.index({ attendanceRate: 1 });

// Unique index: one record per student per subject per year
studentPerformanceSchema.index(
  { studentId: 1, subjectId: 1, academicYear: 1 },
  { unique: true }
);

export default mongoose.model('StudentPerformance', studentPerformanceSchema);
