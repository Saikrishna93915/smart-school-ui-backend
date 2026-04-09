// models/Driver.js - COMPLETE CLEAN VERSION (NO MIDDLEWARE)
import mongoose from 'mongoose';

const driverSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      unique: true,
      trim: true
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    licenseNo: {
      type: String,
      unique: true,
      trim: true
    },
    licenseType: {
      type: String,
      enum: ['LMV', 'HMV', 'MCWG', 'MCWOG', 'MGV', 'HPMV', 'HTV'],
      default: 'LMV'
    },
    licenseExpiry: {
      type: Date
    },
    dob: {
      type: Date
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', null],
      default: null
    },
    emergencyContact: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone: { type: String, trim: true }
    },
    joiningDate: {
      type: Date,
      default: Date.now
    },
    salary: {
      type: Number,
      min: 0
    },
    bankDetails: {
      accountNo: { type: String, trim: true },
      bankName: { type: String, trim: true },
      ifscCode: { type: String, trim: true }
    },
    assignedVehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle'
    },
    status: {
      type: String,
      enum: ['active', 'on-leave', 'suspended', 'inactive'],
      default: 'active'
    },
    shift: {
      type: String,
      enum: ['morning', 'evening', 'night', 'full-day'],
      default: 'full-day'
    },
    rating: {
      type: Number,
      default: 5,
      min: 0,
      max: 5
    },
    totalTrips: {
      type: Number,
      default: 0,
      min: 0
    },
    avatar: {
      type: String,
      default: ''
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Indexes - Removed duplicates (unique fields already create indexes)
driverSchema.index({ status: 1 });
driverSchema.index({ assignedVehicle: 1 });

// Virtual fields
driverSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

driverSchema.virtual('licenseStatus').get(function() {
  if (!this.licenseExpiry) return 'unknown';
  const today = new Date();
  const diffTime = this.licenseExpiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'expiring-soon';
  return 'valid';
});

driverSchema.virtual('experience').get(function() {
  if (!this.joiningDate) return 0;
  const diffTime = new Date() - new Date(this.joiningDate);
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365);
  return Math.floor(diffYears);
});

// NO MIDDLEWARE - REMOVED ALL pre() hooks

const Driver = mongoose.model('Driver', driverSchema);

export default Driver;