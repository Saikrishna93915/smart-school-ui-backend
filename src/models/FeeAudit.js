// src/models/FeeAudit.js - Fee Change Audit Trail Model
import mongoose from "mongoose";

const feeAuditSchema = new mongoose.Schema(
  {
    // Student Reference
    admissionNumber: {
      type: String,
      required: true,
      index: true,
      ref: "Student",
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Student",
    },
    studentName: {
      type: String,
      required: true,
    },
    
    // Class Information
    className: String,
    section: String,
    academicYear: {
      type: String,
      required: true,
    },

    // Action Type
    actionType: {
      type: String,
      enum: ["create", "update", "delete", "adjustment", "concession", "scholarship", "waiver"],
      required: true,
    },

    // Previous Fee Structure
    previousFeeStructure: {
      totalFee: Number,
      baseFee: Number,
      activityFee: Number,
      examFee: Number,
      transportFee: Number,
      otherFees: Number,
      feeComponents: Array,
    },

    // New Fee Structure
    newFeeStructure: {
      totalFee: Number,
      baseFee: Number,
      activityFee: Number,
      examFee: Number,
      transportFee: Number,
      otherFees: Number,
      feeComponents: Array,
    },

    // Changes Summary
    changesSummary: {
      totalFeeChange: Number, // Difference in total fee
      componentsChanged: [String], // List of component names that changed
      reason: String, // Reason for fee change
      adjustmentType: {
        type: String,
        enum: ["increase", "decrease", "no_change"],
      },
    },

    // Reason & Notes
    reason: {
      type: String,
      required: true,
    },
    notes: String,
    
    // Approval Details (optional - for future workflow)
    approvalRequired: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved", // By default, changes are auto-approved
    },

    // Audit Metadata
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    performedByName: {
      type: String,
      required: true,
    },
    performedByRole: String,
    ipAddress: String,
    userAgent: String,
    
    // Additional Context
    affectedFeeStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeStructure",
    },
    relatedPayments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    }],
  },
  { 
    timestamps: true,
    collection: "feeaudits"
  }
);

// Indexes for efficient querying
feeAuditSchema.index({ admissionNumber: 1, createdAt: -1 });
feeAuditSchema.index({ studentId: 1, createdAt: -1 });
feeAuditSchema.index({ performedBy: 1 });
feeAuditSchema.index({ actionType: 1 });
feeAuditSchema.index({ createdAt: -1 });

// Static method to log fee change
feeAuditSchema.statics.logFeeChange = async function(auditData) {
  try {
    const audit = new this(auditData);
    await audit.save();
    console.log(`✅ Fee audit logged for ${auditData.admissionNumber}`);
    return audit;
  } catch (error) {
    console.error("❌ Error logging fee audit:", error);
    throw error;
  }
};

// Static method to get audit history for a student
feeAuditSchema.statics.getStudentAuditHistory = async function(admissionNumber, options = {}) {
  const { limit = 50, skip = 0, actionType } = options;
  
  const query = { admissionNumber };
  if (actionType) {
    query.actionType = actionType;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('performedBy', 'name email username')
    .populate('approvedBy', 'name email username')
    .lean();
};

// Instance method to format audit entry for display
feeAuditSchema.methods.formatForDisplay = function() {
  const totalFeeChange = this.changesSummary?.totalFeeChange || 0;
  const changeDirection = totalFeeChange > 0 ? "increased" : totalFeeChange < 0 ? "decreased" : "unchanged";
  
  return {
    id: this._id,
    date: this.createdAt,
    action: this.actionType,
    student: {
      name: this.studentName,
      admissionNumber: this.admissionNumber,
      class: `${this.className}-${this.section}`,
    },
    changes: {
      previous: this.previousFeeStructure?.totalFee || 0,
      new: this.newFeeStructure?.totalFee || 0,
      difference: totalFeeChange,
      direction: changeDirection,
      components: this.changesSummary?.componentsChanged || [],
    },
    reason: this.reason,
    notes: this.notes,
    performedBy: {
      name: this.performedByName,
      role: this.performedByRole,
    },
    approval: {
      required: this.approvalRequired,
      status: this.approvalStatus,
      approvedBy: this.approvedBy,
      approvedAt: this.approvedAt,
    },
  };
};

export default mongoose.model("FeeAudit", feeAuditSchema);
