import mongoose from "mongoose";

const permissionAuditLogSchema = new mongoose.Schema({
  // Admin/Principal who made the change
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  adminName: String,
  adminRole: String,
  
  // Teacher affected
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true,
  },
  teacherName: String,
  teacherDepartment: String,
  
  // Action performed
  action: {
    type: String,
    enum: ["grant", "revoke", "modify", "bulk_update", "template_apply"],
    required: true,
  },
  
  // What was changed
  resource: {
    type: String,
    enum: ["class", "subject", "section", "permission", "all"],
    required: true,
  },
  permission: String,
  
  // Change details
  oldValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,
  reason: String,
  
  // System info
  ipAddress: String,
  userAgent: String,
  
  // Status
  status: {
    type: String,
    enum: ["success", "failed"],
    default: "success",
  },
  errorMessage: String,
}, {
  timestamps: true,
});

// Add indexes for better query performance
permissionAuditLogSchema.index({ "teacherId": 1, "createdAt": -1 });
permissionAuditLogSchema.index({ "adminId": 1, "createdAt": -1 });
permissionAuditLogSchema.index({ "action": 1, "createdAt": -1 });
permissionAuditLogSchema.index({ "createdAt": -1 });

const PermissionAuditLog = mongoose.model("PermissionAuditLog", permissionAuditLogSchema);

export default PermissionAuditLog;
