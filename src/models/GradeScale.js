import mongoose from 'mongoose';

/**
 * GradeScale Model - Custom grading scheme
 * Allows admins to define their own grade boundaries, letters, points, and remarks
 */
const gradeScaleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    grades: [
      {
        grade: {
          type: String,
          required: true,
          trim: true
        },
        minPercentage: {
          type: Number,
          required: true,
          min: 0,
          max: 100
        },
        maxPercentage: {
          type: Number,
          required: true,
          min: 0,
          max: 100
        },
        gradePoint: {
          type: Number,
          required: true,
          min: 0,
          max: 10
        },
        remark: {
          type: String,
          required: true,
          trim: true
        },
        color: {
          type: String,
          default: '#6b7280'
        }
      }
    ],
    isDefault: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

// Ensure grade ranges don't overlap (validation at app level for simplicity)
gradeScaleSchema.index({ name: 1 }, { unique: true });

const GradeScale = mongoose.model('GradeScale', gradeScaleSchema);
export default GradeScale;
