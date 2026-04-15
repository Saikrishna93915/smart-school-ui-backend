/**
 * SEED SYSTEM CONFIGURATION
 * Populates the database with all dynamic configuration values
 * This replaces all hardcoded data with database-driven configuration
 *
 * Usage: node scripts/seedSystemConfig.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import SystemConfig from "../src/models/SystemConfig.js";

dotenv.config();

const seedSystemConfig = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    console.log(`📍 Using URI: ${process.env.MONGO_URI}`);
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    // Check if configs already exist
    const existingCount = await SystemConfig.countDocuments();
    if (existingCount > 0) {
      console.log(`\n⚠️  Found ${existingCount} existing configurations.`);
      console.log("Do you want to update them? (y/n)");
      // For non-interactive mode, we'll upsert
    }

    console.log("\n📝 Seeding system configurations...\n");

    const configs = [
      // ==================== SCHOOL PROFILE ====================
      {
        key: 'school.name',
        value: 'PMC Tech School',
        category: 'school',
        description: 'School name displayed across the system',
        valueType: 'string'
      },
      {
        key: 'school.code',
        value: 'PMC-2024-001',
        category: 'school',
        description: 'Unique school identification code',
        valueType: 'string'
      },
      {
        key: 'school.email',
        value: 'info@pmctechschool.com',
        category: 'school',
        description: 'Primary school email address',
        valueType: 'string'
      },
      {
        key: 'school.phone',
        value: '+91 98765 43210',
        category: 'school',
        description: 'Primary school contact number',
        valueType: 'string'
      },
      {
        key: 'school.address',
        value: {
          street: '123 Education Street',
          city: 'Hyderabad',
          state: 'Telangana',
          country: 'India',
          pincode: '500001'
        },
        category: 'school',
        description: 'School physical address',
        valueType: 'object'
      },
      {
        key: 'school.website',
        value: 'https://pmctechschool.com',
        category: 'school',
        description: 'School website URL',
        valueType: 'string'
      },
      {
        key: 'school.motto',
        value: 'Excellence in Education',
        category: 'school',
        description: 'School motto/tagline',
        valueType: 'string'
      },
      {
        key: 'school.establishedYear',
        value: 2010,
        category: 'school',
        description: 'Year school was established',
        valueType: 'number'
      },
      {
        key: 'school.logo',
        value: '',
        category: 'school',
        description: 'School logo URL/path',
        valueType: 'string'
      },
      {
        key: 'school.gstin',
        value: '',
        category: 'school',
        description: 'School GST identification number',
        valueType: 'string'
      },
      {
        key: 'school.bankDetails',
        value: {
          bankName: '',
          accountNumber: '',
          ifscCode: '',
          branch: ''
        },
        category: 'school',
        description: 'School bank account details',
        valueType: 'object'
      },

      // ==================== ACADEMIC YEAR ====================
      {
        key: 'academic.currentYear',
        value: '2025-2026',
        category: 'academic',
        description: 'Current academic year',
        valueType: 'string'
      },
      {
        key: 'academic.startDate',
        value: '2025-04-01',
        category: 'academic',
        description: 'Academic year start date',
        valueType: 'string'
      },
      {
        key: 'academic.endDate',
        value: '2026-03-31',
        category: 'academic',
        description: 'Academic year end date',
        valueType: 'string'
      },
      {
        key: 'academic.terms',
        value: [
          { name: 'Term 1', number: 1, startDate: '2025-04-01', endDate: '2025-09-30' },
          { name: 'Term 2', number: 2, startDate: '2025-10-01', endDate: '2026-03-31' }
        ],
        category: 'academic',
        description: 'Academic terms/semesters',
        valueType: 'array'
      },
      {
        key: 'academic.board',
        value: 'CBSE',
        category: 'academic',
        description: 'Education board (CBSE, ICSE, State, etc.)',
        valueType: 'string'
      },
      {
        key: 'academic.medium',
        value: 'English',
        category: 'academic',
        description: 'Primary medium of instruction',
        valueType: 'string'
      },
      {
        key: 'academic.classDuration',
        value: 45,
        category: 'academic',
        description: 'Default class duration in minutes',
        valueType: 'number'
      },
      {
        key: 'academic.periodsPerDay',
        value: 8,
        category: 'academic',
        description: 'Default number of periods per day',
        valueType: 'number'
      },
      {
        key: 'academic.workingDays',
        value: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        category: 'academic',
        description: 'Default working days of the week',
        valueType: 'array'
      },

      // ==================== SECURITY SETTINGS ====================
      {
        key: 'security.sessionTimeout',
        value: 30,
        category: 'security',
        description: 'Session timeout in minutes',
        valueType: 'number'
      },
      {
        key: 'security.passwordMinLength',
        value: 8,
        category: 'security',
        description: 'Minimum password length',
        valueType: 'number'
      },
      {
        key: 'security.passwordExpiryDays',
        value: 90,
        category: 'security',
        description: 'Password expiry duration in days',
        valueType: 'number'
      },
      {
        key: 'security.maxFailedAttempts',
        value: 3,
        category: 'security',
        description: 'Maximum failed login attempts before lockout',
        valueType: 'number'
      },
      {
        key: 'security.lockoutDuration',
        value: 15,
        category: 'security',
        description: 'Account lockout duration in minutes',
        valueType: 'number'
      },
      {
        key: 'security.requireUppercase',
        value: true,
        category: 'security',
        description: 'Require uppercase letters in passwords',
        valueType: 'boolean'
      },
      {
        key: 'security.requireLowercase',
        value: true,
        category: 'security',
        description: 'Require lowercase letters in passwords',
        valueType: 'boolean'
      },
      {
        key: 'security.requireNumbers',
        value: true,
        category: 'security',
        description: 'Require numbers in passwords',
        valueType: 'boolean'
      },
      {
        key: 'security.requireSpecialChars',
        value: true,
        category: 'security',
        description: 'Require special characters in passwords',
        valueType: 'boolean'
      },

      // ==================== FEE STRUCTURE ====================
      {
        key: 'fees.structure',
        value: {
          'LKG': { baseFee: 20000, transportFee: 20000, activityFee: 3000, examFee: 1000, otherFees: 1000 },
          'UKG': { baseFee: 22000, transportFee: 20000, activityFee: 3500, examFee: 1500, otherFees: 1500 },
          '1st Class': { baseFee: 25000, transportFee: 22000, activityFee: 4000, examFee: 2000, otherFees: 2000 },
          '2nd Class': { baseFee: 27000, transportFee: 22000, activityFee: 4000, examFee: 2000, otherFees: 2000 },
          '3rd Class': { baseFee: 29000, transportFee: 23000, activityFee: 4500, examFee: 2500, otherFees: 2000 },
          '4th Class': { baseFee: 31000, transportFee: 23000, activityFee: 4500, examFee: 2500, otherFees: 2000 },
          '5th Class': { baseFee: 33000, transportFee: 24000, activityFee: 4500, examFee: 2500, otherFees: 2000 },
          '6th Class': { baseFee: 35000, transportFee: 24000, activityFee: 5000, examFee: 3000, otherFees: 2000 },
          '7th Class': { baseFee: 38000, transportFee: 24000, activityFee: 5000, examFee: 3000, otherFees: 2000 },
          '8th Class': { baseFee: 42000, transportFee: 25000, activityFee: 5000, examFee: 3000, otherFees: 2000 },
          '9th Class': { baseFee: 46000, transportFee: 25000, activityFee: 5000, examFee: 3000, otherFees: 2000 },
          '10th Class': { baseFee: 50000, transportFee: 25000, activityFee: 5000, examFee: 3000, otherFees: 2000 },
          '11th Class': { baseFee: 55000, transportFee: 25000, activityFee: 5500, examFee: 3500, otherFees: 2500 },
          '12th Class': { baseFee: 60000, transportFee: 25000, activityFee: 6000, examFee: 4000, otherFees: 3000 }
        },
        category: 'fees',
        description: 'Fee structure by class',
        valueType: 'object'
      },
      {
        key: 'fees.latePenaltyRate',
        value: 0.01,
        category: 'fees',
        description: 'Late fee penalty rate per month (1%)',
        valueType: 'number'
      },
      {
        key: 'fees.maxPaymentAmount',
        value: 999999,
        category: 'fees',
        description: 'Maximum payment amount allowed',
        valueType: 'number'
      },
      {
        key: 'fees.roundingTolerance',
        value: 1,
        category: 'fees',
        description: 'Rounding tolerance for payments',
        valueType: 'number'
      },

      // ==================== GRADING SYSTEM ====================
      {
        key: 'grading.scale',
        value: [
          { min: 90, max: 100, grade: 'A+', points: 10, description: 'Outstanding' },
          { min: 80, max: 89, grade: 'A', points: 9, description: 'Excellent' },
          { min: 70, max: 79, grade: 'B+', points: 8, description: 'Very Good' },
          { min: 60, max: 69, grade: 'B', points: 7, description: 'Good' },
          { min: 50, max: 59, grade: 'C+', points: 6, description: 'Satisfactory' },
          { min: 40, max: 49, grade: 'C', points: 5, description: 'Average' },
          { min: 33, max: 39, grade: 'D', points: 4, description: 'Pass' },
          { min: 0, max: 32, grade: 'F', points: 0, description: 'Fail' }
        ],
        category: 'grading',
        description: 'Grading scale and percentages',
        valueType: 'array'
      },
      {
        key: 'grading.passingPercentage',
        value: 33,
        category: 'grading',
        description: 'Minimum passing percentage',
        valueType: 'number'
      },
      {
        key: 'grading.maxMarks',
        value: 100,
        category: 'grading',
        description: 'Maximum marks for subjects',
        valueType: 'number'
      },

      // ==================== NOTIFICATIONS ====================
      {
        key: 'notifications.settings',
        value: [
          { name: 'Attendance Alerts', channels: ['email', 'sms', 'whatsapp'], enabled: true },
          { name: 'Fee Reminders', channels: ['email', 'sms'], enabled: true },
          { name: 'Exam Notifications', channels: ['email', 'whatsapp'], enabled: true },
          { name: 'AI Insights', channels: ['email'], enabled: true },
          { name: 'Emergency Alerts', channels: ['sms', 'whatsapp', 'voice'], enabled: true }
        ],
        category: 'notifications',
        description: 'Notification settings and channels',
        valueType: 'array'
      },

      // ==================== THRESHOLDS & LIMITS ====================
      {
        key: 'thresholds.cashierVariance',
        value: 500,
        category: 'thresholds',
        description: 'Cashier shift variance threshold for admin notification',
        valueType: 'number'
      },
      {
        key: 'thresholds.defaulterCritical',
        value: 50000,
        category: 'thresholds',
        description: 'Critical defaulter amount threshold',
        valueType: 'number'
      },
      {
        key: 'thresholds.defaulterHigh',
        value: 20000,
        category: 'thresholds',
        description: 'High priority defaulter amount threshold',
        valueType: 'number'
      },
      {
        key: 'thresholds.defaulterModerate',
        value: 5000,
        category: 'thresholds',
        description: 'Moderate defaulter amount threshold',
        valueType: 'number'
      },
      {
        key: 'thresholds.dailyEmailRateLimit',
        value: 2000,
        category: 'thresholds',
        description: 'Rate limit delay between bulk emails (ms)',
        valueType: 'number'
      },
      {
        key: 'thresholds.maxStudents',
        value: 5000,
        category: 'thresholds',
        description: 'Maximum student capacity',
        valueType: 'number'
      },
      {
        key: 'thresholds.maxStaff',
        value: 200,
        category: 'thresholds',
        description: 'Maximum staff capacity',
        valueType: 'number'
      },

      // ==================== CERTIFICATE TEMPLATES ====================
      {
        key: 'certificates.templates',
        value: {
          'Bonafide Certificate': 'This is to certify that {studentName} is a bonafide student of {schoolName} studying in Class {class} Section {section} during the academic year {academicYear}.',
          'Study Certificate': 'This is to certify that {studentName} is a regular student of {schoolName} studying in Class {class} Section {section} from {startDate} to {endDate}.',
          'Character Certificate': 'This is to certify that {studentName} is a student of Class {class} Section {section} at {schoolName} and bears good moral character.',
          'Transfer Certificate': 'This is to certify that {studentName} was a student of {schoolName} from {startDate} to {endDate} and has been transferred to another institution.',
          'Attendance Certificate': 'This is to certify that {studentName} of Class {class} Section {section} has maintained {attendancePercentage}% attendance during the academic year {academicYear}.',
          'Merit Certificate': 'This is to certify that {studentName} has secured {marks} marks and achieved {grade} grade in {examName} examination, demonstrating academic excellence.'
        },
        category: 'certificates',
        description: 'Certificate templates with placeholders',
        valueType: 'object'
      },
      {
        key: 'certificates.verificationUrl',
        value: 'https://pmctechschool.com/verify',
        category: 'certificates',
        description: 'Base URL for certificate verification',
        valueType: 'string'
      },

      // ==================== SYSTEM LIMITS ====================
      {
        key: 'limits.maxUploadSize',
        value: '100mb',
        category: 'limits',
        description: 'Maximum file upload size',
        valueType: 'string'
      },
      {
        key: 'limits.apiRateLimit',
        value: { requests: 100, perMinutes: 15 },
        category: 'limits',
        description: 'API rate limiting defaults',
        valueType: 'object'
      },
      {
        key: 'limits.queryResults',
        value: 1000,
        category: 'limits',
        description: 'Maximum query results limit',
        valueType: 'number'
      },
      {
        key: 'limits.cashierDailyLimit',
        value: 100000,
        category: 'limits',
        description: 'Cashier daily transaction limit',
        valueType: 'number'
      },

      // ==================== EMAIL SETTINGS ====================
      {
        key: 'email.senderName',
        value: 'PMC Tech School',
        category: 'email',
        description: 'Default email sender name',
        valueType: 'string'
      },
      {
        key: 'email.fromAddress',
        value: 'noreply@pmctechschool.com',
        category: 'email',
        description: 'Default email from address',
        valueType: 'string'
      },
      {
        key: 'email.bulkDelay',
        value: 2000,
        category: 'email',
        description: 'Delay between bulk emails in milliseconds',
        valueType: 'number'
      },

      // ==================== UI CONFIGURATION ====================
      {
        key: 'ui.allowedFileTypes',
        value: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'],
        category: 'ui',
        description: 'Allowed image file types for upload',
        valueType: 'array'
      },
      {
        key: 'ui.currency',
        value: 'INR',
        category: 'ui',
        description: 'Default currency',
        valueType: 'string'
      },
      {
        key: 'ui.currencySymbol',
        value: '₹',
        category: 'ui',
        description: 'Currency symbol',
        valueType: 'string'
      },

      // ==================== PASSWORD DEFAULTS ====================
      {
        key: 'passwords.defaultByRole',
        value: {
          teacher: 'Teacher@123',
          parent: 'Parent@123',
          student: 'Student@123',
          owner: 'Owner@123',
          admin: 'Admin@123',
          cashier: 'Cashier@123',
          principal: 'Principal@123',
          driver: 'Driver@123'
        },
        category: 'system',
        description: 'Default passwords by role (should be changed after first login)',
        valueType: 'object'
      }
    ];

    console.log(`📦 Inserting ${configs.length} configurations...\n`);

    let created = 0;
    let updated = 0;

    for (const config of configs) {
      const existing = await SystemConfig.findOne({ key: config.key });
      
      if (existing) {
        // Update existing config
        existing.value = config.value;
        existing.description = config.description;
        existing.valueType = config.valueType;
        existing.category = config.category;
        existing.version += 1;
        await existing.save();
        updated++;
        console.log(`✏️  Updated: ${config.key}`);
      } else {
        // Create new config
        await SystemConfig.create(config);
        created++;
        console.log(`✅ Created: ${config.key}`);
      }
    }

    console.log("\n╔════════════════════════════════════════════════╗");
    console.log("║     SYSTEM CONFIGURATION SEEDING COMPLETE       ║");
    console.log("╠════════════════════════════════════════════════╣");
    console.log(`║  ✅ Created: ${created.toString().padEnd(30)}║`);
    console.log(`║  ✏️  Updated: ${updated.toString().padEnd(30)}║`);
    console.log(`║  📊 Total: ${configs.length.toString().padEnd(31)}║`);
    console.log("╚════════════════════════════════════════════════╝");
    console.log("\n🎉 All configurations are now dynamic and stored in the database!");
    console.log("💡 Admin users can modify these through the Settings API.");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding system config:", error);
    process.exit(1);
  }
};

// Run the seed function
seedSystemConfig();
