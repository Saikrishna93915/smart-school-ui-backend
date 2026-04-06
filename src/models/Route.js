// models/Route.js - COMPLETE CLEAN VERSION (NO MIDDLEWARE)
import mongoose from 'mongoose';

const routeSchema = new mongoose.Schema(
  {
    routeNo: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    zone: {
      type: String,
      required: true,
      enum: ['north', 'south', 'east', 'west', 'central'],
      default: 'central'
    },
    startPoint: {
      type: String,
      required: true,
      trim: true
    },
    endPoint: {
      type: String,
      required: true,
      trim: true
    },
    totalDistance: {
      type: Number,
      required: true,
      min: 0
    },
    estimatedTime: {
      type: Number,
      required: true,
      min: 0
    },
    stops: [
      {
        stopNo: { type: Number, required: true },
        name: { type: String, required: true },
        address: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        arrivalTime: { type: String, required: true },
        departureTime: { type: String, required: true },
        students: { type: Number, default: 0 }
      }
    ],
    assignedVehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle'
    },
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver'
    },
    schedule: {
      morningPickup: { type: String },
      morningDrop: { type: String },
      eveningPickup: { type: String },
      eveningDrop: { type: String }
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'temporary-closed'],
      default: 'active'
    },
    monthlyStudents: {
      type: Number,
      default: 0,
      min: 0
    },
    monthlyEfficiency: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
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

// REMOVE THE PROBLEMATIC MIDDLEWARE
// routeSchema.pre(/^find/, function (next) {
//   if (this._conditions.isDeleted !== true) {
//     this.where({ isDeleted: { $ne: true } });
//   }
//   next();
// });

// Indexes - Removed duplicates (unique fields already create indexes)
routeSchema.index({ zone: 1 });
routeSchema.index({ status: 1 });
routeSchema.index({ assignedVehicle: 1 });
routeSchema.index({ assignedDriver: 1 });

// Virtual fields
routeSchema.virtual('efficiencyPercentage').get(function() {
  return this.monthlyEfficiency || 0;
});

routeSchema.virtual('averageSpeed').get(function() {
  if (this.totalDistance === 0 || this.estimatedTime === 0) return 0;
  return (this.totalDistance / (this.estimatedTime / 60)).toFixed(2); // km/h
});

const Route = mongoose.model('Route', routeSchema);

export default Route;