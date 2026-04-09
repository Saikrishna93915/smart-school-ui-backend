import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  receiptNumber: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'cheque', 'online', 'card', 'bank_transfer'],
    required: true
  },
  chequeNumber: {
    type: String
  },
  bankName: {
    type: String
  },
  transactionId: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'completed'
  }
});

const feeItemStatusSchema = new mongoose.Schema({
  feeItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeStructure.feeItems'
  },
  name: String,
  amount: Number,
  dueDate: Date,
  paid: {
    type: Boolean,
    default: false
  },
  paymentDate: Date,
  amountPaid: {
    type: Number,
    default: 0
  },
  discountApplied: {
    type: Number,
    default: 0
  },
  lateFeeApplied: {
    type: Number,
    default: 0
  }
});

const studentFeeSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  admissionNumber: {
    type: String,
    required: true
  },
  academicYear: {
    type: String,
    required: true,
    match: /^\d{4}-\d{4}$/
  },
  className: {
    type: String,
    required: true
  },
  section: {
    type: String,
    required: true
  },
  feeStructureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeStructure',
    required: true
  },
  totalFeeAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  totalDue: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  lateFeeAmount: {
    type: Number,
    default: 0
  },
  feeItems: [feeItemStatusSchema],
  payments: [paymentSchema],
  paymentHistory: [{
    date: Date,
    amount: Number,
    description: String,
    receiptNumber: String
  }],
  status: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue'],
    default: 'pending'
  },
  dueDate: {
    type: Date,
    required: true
  },
  reminders: [{
    sentDate: Date,
    type: String,
    status: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

studentFeeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // Calculate totals
  this.totalPaid = this.payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);
  
  this.totalDue = this.totalFeeAmount - this.totalPaid - this.discountAmount + this.lateFeeAmount;
  
  // Update status
  if (this.totalDue <= 0) {
    this.status = 'paid';
  } else if (this.totalPaid > 0) {
    this.status = 'partial';
  } else if (new Date() > this.dueDate) {
    this.status = 'overdue';
  } else {
    this.status = 'pending';
  }
  
  next();
});

// Generate receipt number
studentFeeSchema.methods.generateReceiptNumber = function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `REC-${year}${month}${day}-${random}`;
};

export default mongoose.model('StudentFee', studentFeeSchema);