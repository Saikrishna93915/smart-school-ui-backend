import mongoose from "mongoose";

const teacherPermissionSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true,
    unique: true,
  },
  permissions: {
    // Class and subject access
    classes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
    }],
    sections: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
    }],
    subjects: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
    }],
    
    // Academic permissions
    canTakeExams: {
      type: Boolean,
      default: false,
    },
    canEnterMarks: {
      type: Boolean,
      default: false,
    },
    canCreateReports: {
      type: Boolean,
      default: false,
    },
    canManageTimetable: {
      type: Boolean,
      default: false,
    },
    
    // Student management permissions
    canViewAttendance: {
      type: Boolean,
      default: true,
    },
    canManageStudents: {
      type: Boolean,
      default: false,
    },
    canApproveLeave: {
      type: Boolean,
      default: false,
    },
    
    // Administrative permissions
    canManageAnnouncements: {
      type: Boolean,
      default: false,
    },
    canAccessAnalytics: {
      type: Boolean,
      default: false,
    },
    canManageLibrary: {
      type: Boolean,
      default: false,
    },
  },
  
  // Applied template tracking
  appliedTemplate: {
    id: String,
    name: String,
    appliedAt: Date,
  },
  
  // Last updated info
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ["active", "inactive", "suspended"],
    default: "active",
  },
}, {
  timestamps: true,
});

// Add indexes for better query performance
teacherPermissionSchema.index({ "teacher": 1, "status": 1 });
teacherPermissionSchema.index({ "permissions.classes": 1 });
teacherPermissionSchema.index({ "permissions.subjects": 1 });

const TeacherPermission = mongoose.model("TeacherPermission", teacherPermissionSchema);

export default TeacherPermission;
