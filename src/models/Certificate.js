import mongoose from 'mongoose';
const { Schema } = mongoose;

const certificateSchema = new Schema({
  certificateId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Student Information
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  rollNumber: {
    type: String
  },
  admissionNumber: {
    type: String
  },
  
  // Certificate Details
  certificateType: {
    type: String,
    required: true,
    enum: [
      'Bonafide Certificate',
      'Study Certificate',
      'Character Certificate',
      'Conduct Certificate',
      'Transfer Certificate',
      'Migration Certificate',
      'Sports Certificate',
      'Merit Certificate',
      'Medical Certificate',
      'Income Certificate',
      'Attendance Certificate',
      'Internship Certificate',
      'Leaving Certificate',
      'Course Completion'
    ]
  },
  
  // Academic Information
  class: {
    type: String,
    required: true
  },
  section: {
    type: String
  },
  academicYear: {
    type: String,
    required: true
  },
  
  // Certificate Content
  purpose: {
    type: String,
    required: true
  },
  certificateText: {
    type: String
  },
  additionalNotes: {
    type: String
  },
  
  // Dates
  issueDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  validUntil: {
    type: Date
  },
  
  // Status & Workflow
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Issued', 'Cancelled'],
    default: 'Pending'
  },
  
  // Approval Information
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  
  // Digital Security
  qrCode: {
    type: String
  },
  verificationUrl: {
    type: String
  },
  digitalSignature: {
    type: String
  },
  
  // File Storage
  pdfUrl: {
    type: String
  },
  pdfPath: {
    type: String
  },
  
  // Academic Performance (for merit certificates)
  percentage: {
    type: Number
  },
  attendance: {
    type: Number
  },
  grade: {
    type: String
  },
  
  // Verification Status
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationCount: {
    type: Number,
    default: 0
  },
  lastVerifiedAt: {
    type: Date
  },
  
  // School Information
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School'
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: String
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster queries
certificateSchema.index({ studentId: 1, certificateType: 1 });
certificateSchema.index({ status: 1 });
certificateSchema.index({ issueDate: -1 });
certificateSchema.index({ academicYear: 1 });
certificateSchema.index({ class: 1 });

// Virtual for full class name
certificateSchema.virtual('fullClass').get(function() {
  return this.section ? `${this.class} (Section ${this.section})` : this.class;
});

// Method to generate certificate ID
certificateSchema.statics.generateCertificateId = async function() {
  const year = new Date().getFullYear();
  const count = await this.countDocuments({ 
    certificateId: new RegExp(`^CERT-${year}-`) 
  });
  const nextNumber = (count + 1).toString().padStart(4, '0');
  return `CERT-${year}-${nextNumber}`;
};

// Method to get certificate text template
certificateSchema.methods.getCertificateText = function() {
  const templates = {
    'Bonafide Certificate': `This is to certify that ${this.studentName} (Student ID: ${this.admissionNumber || 'N/A'}, Roll No: ${this.rollNumber || 'N/A'}) is a bonafide student of our institution, studying in ${this.fullClass} during the academic year ${this.academicYear}.`,
    
    'Study Certificate': `This is to certify that ${this.studentName} (Student ID: ${this.admissionNumber || 'N/A'}, Roll No: ${this.rollNumber || 'N/A'}) has successfully completed ${this.fullClass} for the academic year ${this.academicYear}${this.percentage ? ` with ${this.percentage}% marks` : ''}${this.attendance ? ` and ${this.attendance}% attendance` : ''}.`,
    
    'Character Certificate': `This is to certify that ${this.studentName} (Student ID: ${this.admissionNumber || 'N/A'}, Roll No: ${this.rollNumber || 'N/A'}) has maintained good conduct and character during the course of study in ${this.fullClass} for the academic year ${this.academicYear}.`,
    
    'Transfer Certificate': `This is to certify that ${this.studentName} (Student ID: ${this.admissionNumber || 'N/A'}, Roll No: ${this.rollNumber || 'N/A'}) studied in ${this.fullClass} during the academic year ${this.academicYear}. All dues have been cleared and the student is eligible for transfer.`,
    
    'Attendance Certificate': `This is to certify that ${this.studentName} (Student ID: ${this.admissionNumber || 'N/A'}, Roll No: ${this.rollNumber || 'N/A'}) maintained ${this.attendance || 'N/A'}% attendance in ${this.fullClass} during the academic year ${this.academicYear}.`,
    
    'Merit Certificate': `This is to certify that ${this.studentName} (Student ID: ${this.admissionNumber || 'N/A'}, Roll No: ${this.rollNumber || 'N/A'}) has achieved outstanding academic performance in ${this.fullClass} for the academic year ${this.academicYear} with ${this.percentage || 'N/A'}% marks and has been awarded this merit certificate.`
  };
  
  return this.certificateText || templates[this.certificateType] || 
    `This is to certify that ${this.studentName} is a student of ${this.fullClass} for the academic year ${this.academicYear}.`;
};

// Pre-save hook to generate certificate ID if not present
certificateSchema.pre('save', async function(next) {
  if (!this.certificateId) {
    this.certificateId = await this.constructor.generateCertificateId();
  }
  
  // Generate verification URL
  if (!this.verificationUrl && this.certificateId) {
    this.verificationUrl = `${process.env.FRONTEND_URL || 'https://school.com'}/verify/${this.certificateId}`;
  }
  
  next();
});

const Certificate = mongoose.model('Certificate', certificateSchema);

export default Certificate;
