import mongoose from "mongoose";

const receiptSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
    },

    studentDetails: {
      name: {
        type: String,
        required: true,
      },
      admissionNumber: {
        type: String,
        required: true,
      },
      className: {
        type: String,
        required: true,
      },
      section: {
        type: String,
        required: true,
      },
      parentName: {
        type: String,
        required: true,
      },
      parentPhone: {
        type: String,
        required: true,
      },
      parentEmail: String,
    },

    paymentDetails: {
      date: {
        type: Date,
        required: true,
      },
      method: {
        type: String,
        required: true,
      },
      reference: String,
      bankName: String,
      chequeNo: String,
      transactionId: String,
    },

    amountDetails: {
      totalAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      discount: {
        type: Number,
        default: 0,
        min: 0,
      },
      discountReason: String,
      lateFee: {
        type: Number,
        default: 0,
        min: 0,
      },
      lateFeeReason: String,
      netAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      amountInWords: {
        type: String,
        required: true,
      },
    },

    feesBreakdown: [
      {
        feeType: String,
        amount: Number,
        dueDate: Date,
      },
    ],

    schoolDetails: {
      name: {
        type: String,
        default: "PMC Tech School",
      },
      address: {
        type: String,
        default: "Hosur - Krishnagiri Highways, Nallaganakothapalli, Near Koneripalli (PO), Hosur, Krishnagiri District, Tamil Nadu - 635 117",
      },
      phone: {
        type: String,
        default: "+91 XXXXXXXXXX",
      },
      email: {
        type: String,
        default: "office@pmctechschool.com",
      },
      principal: {
        type: String,
        default: "Principal Name",
      },
      registrationNo: {
        type: String,
        default: "REG-EDU-2024-001",
      },
      gstin: {
        type: String,
        default: "29AAACI0000A1Z5",
      },
    },

    // Status tracking
    emailed: {
      type: Boolean,
      default: false,
    },
    emailedAt: Date,
    emailTo: String,
    
    smsSent: {
      type: Boolean,
      default: false,
    },
    smsSentAt: Date,
    smsTo: String,
    
    printed: {
      type: Boolean,
      default: false,
    },
    printedAt: Date,
    
    // Additional metadata
    academicYear: {
      type: String,
      default: "2024-2025",
    },
    
    status: {
      type: String,
      enum: ["active", "cancelled", "refunded"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Pre-save middleware to handle empty strings
receiptSchema.pre("save", function (next) {
  // Convert empty strings to null for optional fields
  const optionalFields = [
    "studentDetails.parentEmail",
    "paymentDetails.reference",
    "paymentDetails.bankName",
    "paymentDetails.chequeNo",
    "paymentDetails.transactionId",
    "amountDetails.discountReason",
    "amountDetails.lateFeeReason",
  ];

  optionalFields.forEach((field) => {
    const fieldParts = field.split('.');
    if (fieldParts.length === 2) {
      if (this[fieldParts[0]] && this[fieldParts[0]][fieldParts[1]] === "") {
        this[fieldParts[0]][fieldParts[1]] = null;
      }
    }
  });

  // Ensure all required school details have defaults
  if (!this.schoolDetails || !this.schoolDetails.name) {
    this.schoolDetails = {
      name: "PMC Tech School",
      address: "Hosur - Krishnagiri Highways, Nallaganakothapalli, Near Koneripalli (PO), Hosur, Krishnagiri District, Tamil Nadu - 635 117",
      phone: "+91 XXXXXXXXXX",
      email: "office@pmctechschool.com",
      principal: "Principal Name",
      registrationNo: "REG-EDU-2024-001",
      gstin: "29AAACI0000A1Z5",
    };
  }

  next();
});

// Virtual for formatted date
receiptSchema.virtual('formattedDate').get(function() {
  return this.paymentDetails.date ? 
    this.paymentDetails.date.toLocaleDateString('en-IN') : 
    new Date().toLocaleDateString('en-IN');
});

// Virtual for formatted amount
receiptSchema.virtual('formattedAmount').get(function() {
  return this.amountDetails.netAmount ? 
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(this.amountDetails.netAmount) : '₹0';
});

// Set toJSON options to include virtuals
receiptSchema.set('toJSON', { virtuals: true });
receiptSchema.set('toObject', { virtuals: true });

export default mongoose.model("Receipt", receiptSchema);