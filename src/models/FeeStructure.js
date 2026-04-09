// src/models/FeeStructure.js - FIXED VERSION
import mongoose from "mongoose";

const feeStructureSchema = new mongoose.Schema(
  {
    admissionNumber: {
      type: String,
      required: true,
      ref: "Student",
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Student",
    },
    studentName: String,
    className: String,
    section: String,

    academicYear: {
      type: String,
      required: true,
    },

    // Fee Components
    feeComponents: [
      {
        componentName: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        dueDate: Date,
        isMandatory: {
          type: Boolean,
          default: true,
        },
        isRecurring: {
          type: Boolean,
          default: false,
        },
        frequency: {
          type: String,
          enum: ["one-time", "monthly", "quarterly", "half-yearly", "yearly"],
          default: "one-time",
        },
        status: {
          type: String,
          enum: ["pending", "paid", "partial", "overdue"],
          default: "pending",
        },
        paidAmount: {
          type: Number,
          default: 0,
        },
      },
    ],

    // Transport
    transportOpted: {
      type: Boolean,
      default: false,
    },
    transportFee: {
      type: Number,
      default: 0,
    },

    // Total Calculations
    totalFee: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDue: {
      type: Number,
      min: 0,
    },

    // Discounts
    discountApplied: {
      type: Number,
      default: 0,
    },
    discountReason: String,

    // Payment Schedule
    paymentSchedule: [
      {
        installmentNo: Number,
        dueDate: Date,
        amount: Number,
        status: {
          type: String,
          enum: ["pending", "paid", "overdue"],
          default: "pending",
        },
        paidDate: Date,
        receiptNo: String,
      },
    ],

    // Status
    overallStatus: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Compound unique index: one fee structure per student per academic year
feeStructureSchema.index({ admissionNumber: 1, academicYear: 1 }, { unique: true });

// FIXED Pre-save middleware - ASYNC VERSION (no next parameter issue)
feeStructureSchema.pre("save", async function() {
  // Async version doesn't use 'next' parameter
  try {
    // Calculate totalDue
    const totalPaid = this.totalPaid || 0;
    const totalFee = this.totalFee || 0;
    const discount = this.discountApplied || 0;
    
    this.totalDue = Math.max(0, totalFee - totalPaid - discount);
  } catch (error) {
    console.error("Error in feeStructure pre-save:", error.message);
    throw error; // Let Mongoose handle the error
  }
});

// Alternative: If you want to keep sync version, fix it properly
// feeStructureSchema.pre("save", function(next) {
//   try {
//     this.totalDue = Math.max(0, this.totalFee - this.totalPaid - (this.discountApplied || 0));
//     next(); // MUST CALL next()
//   } catch (error) {
//     next(error); // Pass error to next
//   }
// });

export default mongoose.model("FeeStructure", feeStructureSchema);