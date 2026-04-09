// src/models/Payment.js - FIXED VERSION
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    // Student Information
    admissionNumber: {
      type: String,
      required: true,
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
    class: {
      type: Object,
      default: {},
    },
    className: String,
    section: String,
    
    // Academic Year
    academicYear: {
      type: String,
      required: true,
    },
    
    // Fee Structure Reference
    feeStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeStructure",
    },
    
    // CRITICAL FIX: ADD THESE FIELDS!
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    dueAmount: {
      type: Number,
      default: 0,
    },
    
    // Payment Status
    status: {
      type: String,
      enum: ["pending", "partial", "paid", "completed", "overdue", "cancelled"],
      default: "pending",
    },
    
    // Dates
    dueDate: Date,
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    
    // Payment Details
    receiptNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Cashier/Collector Information
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cashierName: {
      type: String,
    },
    cashierId: {
      type: String,
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShiftSession",
    },

    // Payment Method
    paymentMethod: {
      type: String,
      enum: ["cash", "cheque", "dd", "online", "upi", "card", "bank-transfer"],
      default: "cash",
    },
    
    // Transaction Details
    referenceNo: String,
    transactionId: String,
    bankName: String,
    chequeNo: String,
    chequeDate: Date,
    utrNo: String,
    upiId: String,
    ifscCode: String,
    accountNumber: String,
    cardLast4: String,
    
    // Amount Details
    amount: Number,
    discount: {
      type: Number,
      default: 0,
    },
    discountReason: String,
    lateFee: {
      type: Number,
      default: 0,
    },
    lateFeeReason: String,
    netAmount: Number,
    
    // Fee Breakdown
    breakdown: [
      {
        name: String,
        amount: Number,
        category: String,
      },
    ],
    
    feesPaid: Array,
    
    // Communication Flags
    sendReceipt: {
      type: Boolean,
      default: true,
    },
    sendSMS: {
      type: Boolean,
      default: true,
    },
    sendEmail: {
      type: Boolean,
      default: true,
    },
    printed: {
      type: Boolean,
      default: false,
    },
    
    // Description
    description: String,
    
    // Audit Fields
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    recordedByName: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    voidReason: String,
    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    voidedAt: Date,
  },
  { timestamps: true }
);

// Create indexes - Removed duplicates (unique/sparse fields already create indexes)
paymentSchema.index({ admissionNumber: 1 });
paymentSchema.index({ academicYear: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ paymentMethod: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ utrNo: 1 });

// CRITICAL: Add indexes for shift reconciliation and duplicate prevention
paymentSchema.index({ shiftId: 1, status: 1 }); // Shift reconciliation
paymentSchema.index({ studentId: 1, amount: 1, paymentMethod: 1, createdAt: -1 }); // Duplicate detection
paymentSchema.index({ receiptNumber: 1 }, { unique: true, sparse: true }); // Ensure unique receipts

// Pre-save middleware to calculate dueAmount if not set
paymentSchema.pre("save", function (next) {
  if (this.isModified("totalAmount") || this.isModified("paidAmount")) {
    this.dueAmount = Math.max(0, this.totalAmount - this.paidAmount);
  }
  next();
});

export default mongoose.model("Payment", paymentSchema);
