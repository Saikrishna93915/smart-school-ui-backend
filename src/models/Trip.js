import mongoose from 'mongoose';

const tripSchema = new mongoose.Schema(
  {
    tripId: {
      type: String,
      required: true,
      unique: true,
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: true,
    },
    tripType: {
      type: String,
      enum: ['morning-pickup', 'morning-drop', 'evening-pickup', 'evening-drop'],
      required: true,
    },
    scheduledStart: {
      type: Date,
      required: true,
    },
    actualStart: {
      type: Date,
    },
    scheduledEnd: {
      type: Date,
      required: true,
    },
    actualEnd: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'completed', 'delayed', 'cancelled'],
      default: 'scheduled',
    },
    students: [
      {
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
        boardingStop: { type: Number, required: true },
        dropStop: { type: Number, required: true },
        boarded: { type: Boolean, default: false },
        boardedAt: { type: Date },
        dropped: { type: Boolean, default: false },
        droppedAt: { type: Date },
      },
    ],
    totalStudents: {
      type: Number,
      default: 0,
    },
    presentStudents: {
      type: Number,
      default: 0,
    },
    attendance: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    locations: [
      {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        speed: { type: Number, default: 0 },
        timestamp: { type: Date, default: Date.now },
        address: { type: String },
      },
    ],
    startOdometer: {
      type: Number,
      required: true,
    },
    endOdometer: {
      type: Number,
    },
    distanceCovered: {
      type: Number,
    },
    fuelConsumed: {
      type: Number,
    },
    incidents: [
      {
        type: {
          type: String,
          enum: ['breakdown', 'accident', 'delay', 'other'],
        },
        description: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        location: { type: String },
        actionTaken: { type: String },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate attendance and generate trip ID before saving
tripSchema.pre('save', async function (next) {
  try {
    // Calculate attendance percentage
    if (this.totalStudents > 0) {
      this.attendance = (this.presentStudents / this.totalStudents) * 100;
    }

    // Calculate distance covered if end odometer is set
    if (this.endOdometer && this.startOdometer) {
      this.distanceCovered = this.endOdometer - this.startOdometer;
    }

    // Generate trip ID if not provided
    if (!this.tripId) {
      const count = await this.constructor.countDocuments();
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      this.tripId = `TRP${year}${month}${(count + 1).toString().padStart(4, '0')}`;
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Query middleware to exclude deleted documents
tripSchema.pre(/^find/, function (next) {
  if (this._conditions.isDeleted !== true) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

export default mongoose.model('Trip', tripSchema);