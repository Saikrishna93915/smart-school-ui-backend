import mongoose from "mongoose";

const permissionTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  
  // Template permissions structure
  permissions: {
    canTakeExams: {
      type: Boolean,
      default: false,
    },
    canEnterMarks: {
      type: Boolean,
      default: false,
    },
    canViewAttendance: {
      type: Boolean,
      default: false,
    },
    canManageStudents: {
      type: Boolean,
      default: false,
    },
    canCreateReports: {
      type: Boolean,
      default: false,
    },
    canManageAnnouncements: {
      type: Boolean,
      default: false,
    },
    canAccessAnalytics: {
      type: Boolean,
      default: false,
    },
    canManageTimetable: {
      type: Boolean,
      default: false,
    },
    canApproveLeave: {
      type: Boolean,
      default: false,
    },
    canManageLibrary: {
      type: Boolean,
      default: false,
    },
  },
  
  // Template categorization
  type: {
    type: String,
    enum: ["system", "custom"],
    default: "custom",
  },
  category: {
    type: String,
    enum: ["teaching", "administrative", "hod", "exam", "custom"],
    default: "teaching",
  },
  
  // Usage tracking
  usageCount: {
    type: Number,
    default: 0,
  },
  
  // Creator info
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  
  // Status
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
}, {
  timestamps: true,
});

// Add indexes
permissionTemplateSchema.index({ "type": 1, "category": 1 });
permissionTemplateSchema.index({ "name": 1 });

const PermissionTemplate = mongoose.model("PermissionTemplate", permissionTemplateSchema);

export default PermissionTemplate;
