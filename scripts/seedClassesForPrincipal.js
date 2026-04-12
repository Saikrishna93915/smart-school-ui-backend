/**
 * Seed Script: Initialize Classes for Principal Timetable
 * Run: node scripts/seedClassesForPrincipal.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../src/config/db.js";
import Class from "../src/models/Class.js";

dotenv.config();

const classesData = [
  { name: "LKG", section: "A", capacity: 30, academicYear: "2024-2025", studentCount: 25 },
  { name: "LKG", section: "B", capacity: 30, academicYear: "2024-2025", studentCount: 28 },
  { name: "UKG", section: "A", capacity: 30, academicYear: "2024-2025", studentCount: 27 },
  { name: "UKG", section: "B", capacity: 30, academicYear: "2024-2025", studentCount: 26 },
  { name: "1st Class", section: "A", capacity: 35, academicYear: "2024-2025", studentCount: 32 },
  { name: "1st Class", section: "B", capacity: 35, academicYear: "2024-2025", studentCount: 30 },
  { name: "1st Class", section: "C", capacity: 35, academicYear: "2024-2025", studentCount: 29 },
  { name: "2nd Class", section: "A", capacity: 35, academicYear: "2024-2025", studentCount: 33 },
  { name: "2nd Class", section: "B", capacity: 35, academicYear: "2024-2025", studentCount: 31 },
  { name: "3rd Class", section: "A", capacity: 40, academicYear: "2024-2025", studentCount: 35 },
  { name: "3rd Class", section: "B", capacity: 40, academicYear: "2024-2025", studentCount: 34 },
  { name: "4th Class", section: "A", capacity: 40, academicYear: "2024-2025", studentCount: 36 },
  { name: "4th Class", section: "B", capacity: 40, academicYear: "2024-2025", studentCount: 37 },
  { name: "5th Class", section: "A", capacity: 40, academicYear: "2024-2025", studentCount: 38 },
  { name: "6th Class", section: "A", capacity: 45, academicYear: "2024-2025", studentCount: 40 },
  { name: "6th Class", section: "B", capacity: 45, academicYear: "2024-2025", studentCount: 39 },
  { name: "7th Class", section: "A", capacity: 45, academicYear: "2024-2025", studentCount: 41 },
  { name: "7th Class", section: "B", capacity: 45, academicYear: "2024-2025", studentCount: 42 },
  { name: "8th Class", section: "A", capacity: 45, academicYear: "2024-2025", studentCount: 43 },
  { name: "8th Class", section: "B", capacity: 45, academicYear: "2024-2025", studentCount: 40 },
  { name: "9th Class", section: "A", capacity: 50, academicYear: "2024-2025", studentCount: 45 },
  { name: "9th Class", section: "B", capacity: 50, academicYear: "2024-2025", studentCount: 44 },
  { name: "10th Class", section: "A", capacity: 50, academicYear: "2024-2025", studentCount: 47 },
  { name: "10th Class", section: "B", capacity: 50, academicYear: "2024-2025", studentCount: 46 },
];

async function seedClasses() {
  try {
    await connectDB();
    console.log("✅ Connected to MongoDB");

    // Check if classes already exist
    const existingCount = await Class.countDocuments();
    if (existingCount > 0) {
      console.log(`\n⚠️  Found ${existingCount} existing classes`);
      console.log("   Skipping seed (data already exists)");
      
      // Show sample
      const sample = await Class.findOne().select("name section academicYear");
      if (sample) {
        console.log(`\n   Sample: ${sample.name} - ${sample.section} (${sample.academicYear})`);
      }
    } else {
      // Insert new classes
      console.log("\n🏫 Creating classes for Principal Timetable...");
      const classes = await Class.insertMany(classesData);
      console.log(`   ✅ Created ${classes.length} classes`);

      // Display summary
      console.log("\n" + "=".repeat(60));
      console.log("📊 PRINCIPAL CLASSES SEED SUMMARY");
      console.log("=".repeat(60));
      console.log("\n✅ Classes Created:");

      for (const cls of classes) {
        console.log(`   • ${cls.name} - Section: ${cls.section} | Capacity: ${cls.capacity} | Students: ${cls.studentCount}`);
      }

      console.log("\n" + "=".repeat(60));
      console.log("✅ Classes seeding completed successfully!");
      console.log("=".repeat(60));
    }

    console.log("\n");

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("\n❌ Error seeding classes:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

seedClasses();
