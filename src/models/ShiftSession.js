// models/ShiftSession.js - Cashier Shift Management
import mongoose from 'mongoose';

const getShiftDateInIST = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata'
  }).format(new Date());

const shiftSessionSchema = new mongoose.Schema({
  cashier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cashier',
    required: true
  },
  shiftDate: {
    type: String,
    required: true,
    default: getShiftDateInIST
  },
  openingTime: {
    type: Date,
    required: true
  },
  closingTime: {
    type: Date
  },
  openingBalance: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  closingBalance: {
    type: Number,
    min: 0
  },
  cashInHand: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'pending'],
    default: 'open'
  },
  transactions: {
    count: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    cash: {
      type: Number,
      default: 0,
      min: 0
    },
    online: {
      type: Number,
      default: 0,
      min: 0
    },
    upi: {
      type: Number,
      default: 0,
      min: 0
    },
    cheque: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  variance: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true
  },
  openedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
shiftSessionSchema.index({ cashier: 1, shiftDate: -1 });
shiftSessionSchema.index({ cashier: 1, status: 1 });
shiftSessionSchema.index({ shiftDate: 1, status: 1 });

// Static method to get today's open shift
shiftSessionSchema.statics.getTodayOpenShift = async function(cashierId) {
  const today = getShiftDateInIST();
  return this.findOne({
    cashier: cashierId,
    shiftDate: today,
    status: 'open'
  });
};

// Static method to get shifts by date range
shiftSessionSchema.statics.getShiftsByDateRange = async function(cashierId, fromDate, toDate, limit = 50) {
  const query = {
    cashier: cashierId,
    shiftDate: {
      $gte: fromDate,
      $lte: toDate
    }
  };
  
  return this.find(query)
    .sort({ shiftDate: -1, openingTime: -1 })
    .limit(limit)
    .populate('cashier', 'name employeeId');
};

// Instance method to update transaction totals
shiftSessionSchema.methods.updateTransactionTotals = async function(payment) {
  if (!this.transactions) {
    this.transactions = {
      count: 0,
      totalAmount: 0,
      cash: 0,
      online: 0,
      upi: 0,
      cheque: 0
    };
  }
  
  this.transactions.count += 1;
  this.transactions.totalAmount += payment.amount;
  
  // Update method-specific totals
  switch(payment.paymentMethod) {
    case 'cash':
      this.transactions.cash += payment.amount;
      break;
    case 'online':
      this.transactions.online += payment.amount;
      break;
    case 'upi':
      this.transactions.upi += payment.amount;
      break;
    case 'cheque':
    case 'dd':
      this.transactions.cheque += payment.amount;
      break;
  }
  
  await this.save();
};

// Virtual for shift duration
shiftSessionSchema.virtual('duration').get(function() {
  if (!this.closingTime || !this.openingTime) return null;
  const duration = new Date(this.closingTime) - new Date(this.openingTime);
  const hours = Math.floor(duration / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
});

// Virtual for variance percentage
shiftSessionSchema.virtual('variancePercentage').get(function() {
  if (!this.closingBalance || !this.cashInHand) return 0;
  return ((this.variance / this.cashInHand) * 100).toFixed(2);
});

// Set JSON transformation
shiftSessionSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

const ShiftSession = mongoose.model('ShiftSession', shiftSessionSchema);

export default ShiftSession;
