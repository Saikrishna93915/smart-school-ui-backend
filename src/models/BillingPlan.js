import mongoose from 'mongoose';

const billingPlanSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    unique: true,
    index: true
  },
  currentPlan: {
    name: {
      type: String,
      enum: ['basic', 'professional', 'enterprise', 'custom'],
      required: true
    },
    displayName: String,
    price: {
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      currency: {
        type: String,
        default: 'INR'
      },
      period: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly', 'lifetime'],
        default: 'monthly'
      },
      isRecurring: {
        type: Boolean,
        default: true
      }
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: Date,
    trialEnds: Date,
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended', 'cancelled', 'expired'],
      default: 'active'
    },
    autoRenew: {
      type: Boolean,
      default: true
    }
  },
  limits: {
    students: {
      max: Number,
      current: {
        type: Number,
        default: 0
      },
      used: {
        type: Number,
        default: 0
      }
    },
    staff: {
      max: Number,
      current: {
        type: Number,
        default: 0
      },
      used: {
        type: Number,
        default: 0
      }
    },
    storage: {
      max: Number, // in GB
      current: {
        type: Number,
        default: 0
      },
      used: {
        type: Number,
        default: 0
      }
    },
    aiCredits: {
      max: Number,
      current: {
        type: Number,
        default: 0
      },
      used: {
        type: Number,
        default: 0
      }
    },
    apiCalls: {
      max: Number,
      current: {
        type: Number,
        default: 0
      },
      used: {
        type: Number,
        default: 0
      }
    }
  },
  features: {
    basic: [String],
    professional: [String],
    enterprise: [String],
    custom: [String]
  },
  addons: [{
    name: String,
    description: String,
    price: {
      amount: Number,
      currency: String,
      period: String
    },
    quantity: Number,
    status: String,
    startDate: Date,
    endDate: Date
  }],
  billingInfo: {
    companyName: String,
    taxId: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      pincode: String
    },
    contactPerson: {
      name: String,
      email: String,
      phone: String
    }
  },
  paymentMethod: {
    type: {
      type: String,
      enum: ['credit_card', 'debit_card', 'net_banking', 'upi', 'bank_transfer', 'cash'],
      default: 'credit_card'
    },
    lastFour: String,
    expiryMonth: String,
    expiryYear: String,
    cardBrand: String,
    upiId: String,
    bankName: String,
    accountNumber: String,
    ifscCode: String
  },
  invoices: [{
    invoiceId: String,
    number: String,
    date: Date,
    amount: Number,
    currency: String,
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled']
    },
    dueDate: Date,
    paidDate: Date,
    paymentMethod: String,
    items: [{
      description: String,
      quantity: Number,
      unitPrice: Number,
      amount: Number
    }],
    taxes: [{
      name: String,
      rate: Number,
      amount: Number
    }],
    totalAmount: Number,
    pdfUrl: String
  }],
  transactions: [{
    transactionId: String,
    date: Date,
    amount: Number,
    currency: String,
    type: {
      type: String,
      enum: ['payment', 'refund', 'credit', 'debit']
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending', 'cancelled']
    },
    description: String,
    reference: String,
    gateway: String
  }],
  nextBilling: {
    date: Date,
    amount: Number,
    estimatedAmount: Number
  },
  alerts: {
    usage: {
      enabled: Boolean,
      threshold: Number // percentage
    },
    payment: {
      enabled: Boolean,
      daysBefore: Number
    },
    expiry: {
      enabled: Boolean,
      daysBefore: Number
    }
  },
  metadata: {
    createdAt: Date,
    updatedAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    salesRep: {
      name: String,
      email: String,
      phone: String
    },
    notes: String
  }
}, {
  timestamps: true
});

// Indexes
billingPlanSchema.index({ schoolId: 1, 'currentPlan.status': 1 });
billingPlanSchema.index({ 'currentPlan.endDate': 1 });

// Virtual for next payment due
billingPlanSchema.virtual('nextPaymentDue').get(function() {
  if (!this.currentPlan.isRecurring || !this.currentPlan.endDate) {
    return null;
  }
  return new Date(this.currentPlan.endDate);
});

// Method to check if plan is active
billingPlanSchema.methods.isActive = function() {
  const now = new Date();
  return this.currentPlan.status === 'active' &&
    (!this.currentPlan.endDate || now < this.currentPlan.endDate);
};

// Method to upgrade plan
billingPlanSchema.methods.upgrade = async function(newPlan, price, period) {
  this.currentPlan.name = newPlan;
  this.currentPlan.price.amount = price;
  this.currentPlan.price.period = period;
  this.currentPlan.status = 'active';
  
  // Update limits based on new plan
  this.updateLimits(newPlan);
  
  return this.save();
};

// Method to update limits based on plan
billingPlanSchema.methods.updateLimits = function(planName) {
  const limits = {
    basic: { students: 500, staff: 10, storage: 10, aiCredits: 1000, apiCalls: 10000 },
    professional: { students: 2000, staff: 50, storage: 100, aiCredits: 10000, apiCalls: 50000 },
    enterprise: { students: 10000, staff: 500, storage: 1000, aiCredits: 100000, apiCalls: 1000000 }
  };
  
  if (limits[planName]) {
    this.limits.students.max = limits[planName].students;
    this.limits.staff.max = limits[planName].staff;
    this.limits.storage.max = limits[planName].storage;
    this.limits.aiCredits.max = limits[planName].aiCredits;
    this.limits.apiCalls.max = limits[planName].apiCalls;
  }
};

// Static method to get plan by school
billingPlanSchema.statics.findBySchool = function(schoolId) {
  return this.findOne({ schoolId });
};

export default mongoose.model('BillingPlan', billingPlanSchema);