const mongoose = require("mongoose");

const feeStructureSchema = new mongoose.Schema({
  admissionNumber: {
    type: String,
    required: true,
    unique: true,
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
  feeComponents: [
    {
      componentName: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      dueDate: Date,
      isMandatory: { type: Boolean, default: true },
      isRecurring: { type: Boolean, default: false },
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
      paidAmount: { type: Number, default: 0 },
    },
  ],
  transportOpted: { type: Boolean, default: false },
  transportFee: { type: Number, default: 0 },
  totalFee: { type: Number, required: true, min: 0 },
  totalPaid: { type: Number, default: 0, min: 0 },
  totalDue: { type: Number, min: 0 },
  discountApplied: { type: Number, default: 0 },
  discountReason: String,
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
  overallStatus: {
    type: String,
    enum: ["active", "completed", "cancelled"],
    default: "active",
  },
}, { timestamps: true });

feeStructureSchema.pre("save", function(next) {
  try {
    this.totalDue = Math.max(0, this.totalFee - this.totalPaid - (this.discountApplied || 0));
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("FeeStructure", feeStructureSchema);
