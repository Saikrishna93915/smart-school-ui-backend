/**
 * SEED DEFAULT SETTINGS
 * Initializes default school settings, academic year, and configurations
 * 
 * Usage: node scripts/seedDefaultSettings.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import School from "../src/models/School.js";
import AcademicYear from "../src/models/AcademicYear.js";
import Setting from "../src/models/Setting.js";
import User from "../src/models/User.js";

dotenv.config();

const seedDefaultSettings = async () => {
  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected\n");

    // Check if school already exists
    let school = await School.findOne();

    if (!school) {
      console.log("📝 Creating default school profile...");
      
      school = await School.create({
        name: "Silver Sand International School",
        code: "SSIS-2024-001",
        email: "info@silversand.edu",
        phone: "+91 11 2654 9876",
        address: {
          street: "123 Knowledge Park, Sector 62",
          city: "Noida",
          state: "Uttar Pradesh",
          country: "India",
          pincode: "201309"
        },
        establishedYear: 2005,
        principal: {
          name: "Dr. Ramesh Kumar",
          email: "principal@silversand.edu",
          phone: "+91 98765 43210"
        },
        board: "CBSE",
        medium: "English",
        website: "https://silversand.edu",
        motto: "Excellence Through Innovation",
        features: {
          hasTransport: true,
          hasHostel: false,
          hasCafeteria: true,
          hasLibrary: true,
          hasSports: true,
          hasLaboratories: true
        },
        statistics: {
          totalStudents: 1248,
          totalStaff: 45,
          totalClasses: 36,
          totalSections: 48,
          totalSubjects: 18
        },
        status: "active",
        settings: {
          timezone: "Asia/Kolkata",
          dateFormat: "DD/MM/YYYY",
          currency: "INR",
          language: "en"
        }
      });

      console.log("✅ School profile created successfully!");
      console.log(`   Name: ${school.name}`);
      console.log(`   Code: ${school.code}`);
      console.log(`   Email: ${school.email}\n`);
    } else {
      console.log("⚠️  School profile already exists:");
      console.log(`   Name: ${school.name}`);
      console.log(`   Code: ${school.code}\n`);
    }

    // Check if academic year exists
    let academicYear = await AcademicYear.findOne({ schoolId: school._id, isCurrent: true });

    if (!academicYear) {
      console.log("📝 Creating default academic year...");
      
      academicYear = await AcademicYear.create({
        schoolId: school._id,
        year: "2024-2025",
        name: "Academic Year 2024-2025",
        startDate: new Date("2024-04-01"),
        endDate: new Date("2025-03-31"),
        isCurrent: true,
        terms: [
          {
            name: "First Term",
            number: 1,
            startDate: new Date("2024-04-01"),
            endDate: new Date("2024-09-30"),
            status: "active"
          },
          {
            name: "Second Term",
            number: 2,
            startDate: new Date("2024-10-01"),
            endDate: new Date("2025-03-31"),
            status: "upcoming"
          }
        ],
        sessions: [
          {
            name: "April-September",
            type: "regular",
            startDate: new Date("2024-04-01"),
            endDate: new Date("2024-09-30")
          },
          {
            name: "October-March",
            type: "regular",
            startDate: new Date("2024-10-01"),
            endDate: new Date("2025-03-31")
          }
        ],
        gradingSystem: {
          type: "percentage",
          passingPercentage: 33,
          maxMarks: 100,
          gradeScale: [
            { min: 90, max: 100, grade: "A+", points: 10, description: "Outstanding" },
            { min: 80, max: 89, grade: "A", points: 9, description: "Excellent" },
            { min: 70, max: 79, grade: "B+", points: 8, description: "Very Good" },
            { min: 60, max: 69, grade: "B", points: 7, description: "Good" },
            { min: 50, max: 59, grade: "C+", points: 6, description: "Satisfactory" },
            { min: 40, max: 49, grade: "C", points: 5, description: "Average" },
            { min: 33, max: 39, grade: "D", points: 4, description: "Pass" },
            { min: 0, max: 32, grade: "F", points: 0, description: "Fail" }
          ]
        },
        timetable: {
          classDuration: 45,
          periodsPerDay: 8,
          workingDays: {
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false
          }
        },
        status: "active"
      });

      console.log("✅ Academic year created successfully!");
      console.log(`   Year: ${academicYear.year}`);
      console.log(`   Start Date: ${academicYear.startDate.toDateString()}`);
      console.log(`   End Date: ${academicYear.endDate.toDateString()}\n`);
    } else {
      console.log("⚠️  Academic year already exists:");
      console.log(`   Year: ${academicYear.year}`);
      console.log(`   Status: ${academicYear.status}\n`);
    }

    // Seed default advanced settings layout
    const advancedSettings = await Setting.findOne({
      schoolId: school._id,
      type: "advanced",
      key: "root"
    });

    if (!advancedSettings) {
      console.log("📝 Creating default advanced settings...");

      await Setting.create({
        schoolId: school._id,
        type: "advanced",
        category: "system",
        key: "root",
        dataType: "object",
        group: "advanced",
        value: {
          layout: {
            navigationMode: "hybrid",
            mobileNavigation: "cards",
            showSidebar: true,
            showDashboardCards: true,
            featuredModules: [
              "dashboard",
              "attendance",
              "fees",
              "students",
              "teachers",
              "exams",
              "classes",
              "reports",
              "notifications",
              "communication",
              "settings"
            ]
          }
        }
      });

      console.log("✅ Advanced settings created successfully!");
    } else {
      console.log("⚠️  Advanced settings already exists:\n");
    }

    console.log("╔════════════════════════════════════════════════╗");
    console.log("║     DEFAULT SETTINGS INITIALIZED              ║");
    console.log("╠════════════════════════════════════════════════╣");
    console.log("║  School Profile:        ✅ Created            ║");
    console.log("║  Academic Year:         ✅ Created            ║");
    console.log("║  Advanced Layout:       ✅ Created            ║");
    console.log("║  Grading System:        ✅ Configured         ║");
    console.log("║  Timetable:             ✅ Set                ║");
    console.log("╚════════════════════════════════════════════════╝");
    console.log("\n🎉 You can now access the Settings page!");
    console.log("   Go to: http://localhost:5173/settings\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding settings:", error);
    process.exit(1);
  }
};

// Run the seed function
seedDefaultSettings();
