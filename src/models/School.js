import mongoose from 'mongoose';

const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: {
      type: String,
      default: 'India'
    },
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  logo: {
    url: String,
    publicId: String,
    thumbnailUrl: String
  },
  establishedYear: Number,
  principal: {
    name: String,
    email: String,
    phone: String
  },
  board: {
    type: String,
    enum: ['CBSE', 'ICSE', 'State', 'IB', 'IGCSE', 'NIOS', 'Other'],
    default: 'CBSE'
  },
  medium: {
    type: String,
    enum: ['English', 'Hindi', 'Both', 'Regional'],
    default: 'English'
  },
  website: String,
  motto: String,
  contactPersons: [{
    name: String,
    designation: String,
    email: String,
    phone: String,
    department: String
  }],
  socialMedia: {
    facebook: String,
    twitter: String,
    linkedin: String,
    instagram: String,
    youtube: String
  },
  features: {
    hasTransport: Boolean,
    hasHostel: Boolean,
    hasCafeteria: Boolean,
    hasLibrary: Boolean,
    hasSports: Boolean,
    hasLaboratories: Boolean
  },
  statistics: {
    totalStudents: {
      type: Number,
      default: 0
    },
    totalStaff: {
      type: Number,
      default: 0
    },
    totalClasses: {
      type: Number,
      default: 0
    },
    totalSections: {
      type: Number,
      default: 0
    },
    totalSubjects: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'active'
  },
  subscription: {
    plan: String,
    status: String,
    startDate: Date,
    endDate: Date,
    trialEnds: Date
  },
  settings: {
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    },
    dateFormat: {
      type: String,
      default: 'DD/MM/YYYY'
    },
    currency: {
      type: String,
      default: 'INR'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  metadata: {
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastUpdated: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full address
schoolSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  return `${addr.street}, ${addr.city}, ${addr.state} - ${addr.pincode}, ${addr.country}`;
});

// Pre-save middleware to generate school code
schoolSchema.pre('save', async function() {
  if (!this.code) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.code = `SS-${year}-${String(count + 1).padStart(4, '0')}`;
  }
});

// Static method to get active schools
schoolSchema.statics.getActiveSchools = function() {
  return this.find({ status: 'active' }).select('name code email phone status');
};

// Static method to get by ID with full details
schoolSchema.statics.getFullById = function(id) {
  return this.findById(id).populate('metadata.createdBy metadata.updatedBy', 'name email');
};

export default mongoose.model('School', schoolSchema);
