// models/Cashier.js - Cashier Profile Management
import mongoose from 'mongoose';

const cashierSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  alternatePhone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  dateOfBirth: {
    type: Date
  },
  dateOfJoining: {
    type: Date,
    default: Date.now
  },
  branch: {
    type: String,
    required: true,
    default: 'Main Branch'
  },
  shiftTiming: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'full-day', 'flexible'],
    default: 'full-day'
  },
  salary: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on-leave', 'suspended', 'terminated'],
    default: 'active'
  },
  role: {
    type: String,
    default: 'cashier'
  },
  permissions: {
    canCollectFees: {
      type: Boolean,
      default: true
    },
    canIssueReceipts: {
      type: Boolean,
      default: true
    },
    canVoidTransactions: {
      type: Boolean,
      default: false
    },
    canRefund: {
      type: Boolean,
      default: false
    },
    dailyLimit: {
      type: Number,
      default: 100000
    }
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cashier'
  },
  totalCollections: {
    type: Number,
    default: 0
  },
  totalTransactions: {
    type: Number,
    default: 0
  },
  lastShiftDate: {
    type: Date
  },
  documents: [{
    type: {
      type: String,
      enum: ['aadhar', 'pan', 'id_card', 'certificate', 'other']
    },
    number: String,
    fileUrl: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes - Removed duplicates (unique fields already create indexes)
cashierSchema.index({ status: 1 });
cashierSchema.index({ branch: 1 });

// Virtual for full name
cashierSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for years of experience
cashierSchema.virtual('experience').get(function() {
  if (!this.dateOfJoining) return 0;
  const diffTime = new Date() - new Date(this.dateOfJoining);
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365);
  return Math.floor(diffYears);
});

// Static method to get active cashiers
cashierSchema.statics.getActiveCashiers = async function() {
  return this.find({ status: 'active', isDeleted: false })
    .select('employeeId firstName lastName email phone branch shiftTiming');
};

// Static method to get cashier by user ID
cashierSchema.statics.getByUserId = async function(userId) {
  return this.findOne({
    $or: [{ user: userId }, { userId }],
    isDeleted: false
  });
};

// Instance method to update totals
cashierSchema.methods.updateTotals = async function(amount) {
  this.totalCollections += amount;
  this.totalTransactions += 1;
  this.lastShiftDate = new Date();
  await this.save();
};

// Set JSON transformation
cashierSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret.isDeleted;
    return ret;
  }
});

const Cashier = mongoose.model('Cashier', cashierSchema);

export default Cashier;
