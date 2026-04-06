/**
 * Seed Script: Initialize Subjects for LKG to 10th Class
 * Run: node scripts/seedSubjects.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Subject from "../src/models/Subject.js";
import connectDB from "../src/config/db.js";

dotenv.config();

// Subject configuration for each class
const subjectsData = {
  "LKG": [
    { subjectName: "English", subjectCode: "ENG-LKG", category: "Language", totalMarks: 50, passingMarks: 20 },
    { subjectName: "Mathematics", subjectCode: "MATH-LKG", category: "Core", totalMarks: 50, passingMarks: 20 },
    { subjectName: "Rhymes & Stories", subjectCode: "RHY-LKG", category: "Activity", totalMarks: 50, passingMarks: 20 },
    { subjectName: "Drawing", subjectCode: "DRAW-LKG", category: "Activity", totalMarks: 50, passingMarks: 20 },
    { subjectName: "General Awareness", subjectCode: "GK-LKG", category: "Core", totalMarks: 50, passingMarks: 20 }
  ],
  
  "UKG": [
    { subjectName: "English", subjectCode: "ENG-UKG", category: "Language", totalMarks: 50, passingMarks: 20 },
    { subjectName: "Mathematics", subjectCode: "MATH-UKG", category: "Core", totalMarks: 50, passingMarks: 20 },
    { subjectName: "Rhymes & Stories", subjectCode: "RHY-UKG", category: "Activity", totalMarks: 50, passingMarks: 20 },
    { subjectName: "Drawing", subjectCode: "DRAW-UKG", category: "Activity", totalMarks: 50, passingMarks: 20 },
    { subjectName: "General Awareness", subjectCode: "GK-UKG", category: "Core", totalMarks: 50, passingMarks: 20 },
    { subjectName: "EVS", subjectCode: "EVS-UKG", category: "Core", totalMarks: 50, passingMarks: 20 }
  ],

  "1st Class": [
    { subjectName: "English", subjectCode: "ENG-1", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Mathematics", subjectCode: "MATH-1", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Hindi", subjectCode: "HIN-1", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "EVS", subjectCode: "EVS-1", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Computer", subjectCode: "COMP-1", category: "Optional", totalMarks: 50, passingMarks: 20 },
    { subjectName: "Drawing", subjectCode: "DRAW-1", category: "Activity", totalMarks: 50, passingMarks: 20 }
  ],

  "2nd Class": [
    { subjectName: "English", subjectCode: "ENG-2", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Mathematics", subjectCode: "MATH-2", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Hindi", subjectCode: "HIN-2", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "EVS", subjectCode: "EVS-2", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Computer", subjectCode: "COMP-2", category: "Optional", totalMarks: 50, passingMarks: 20 },
    { subjectName: "Drawing", subjectCode: "DRAW-2", category: "Activity", totalMarks: 50, passingMarks: 20 }
  ],

  "3rd Class": [
    { subjectName: "English", subjectCode: "ENG-3", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Mathematics", subjectCode: "MATH-3", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Hindi", subjectCode: "HIN-3", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "EVS", subjectCode: "EVS-3", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Computer", subjectCode: "COMP-3", category: "Optional", totalMarks: 50, passingMarks: 20 },
    { subjectName: "Drawing", subjectCode: "DRAW-3", category: "Activity", totalMarks: 50, passingMarks: 20 }
  ],

  "4th Class": [
    { subjectName: "English", subjectCode: "ENG-4", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Mathematics", subjectCode: "MATH-4", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Hindi", subjectCode: "HIN-4", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "EVS", subjectCode: "EVS-4", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Computer", subjectCode: "COMP-4", category: "Optional", totalMarks: 50, passingMarks: 20 },
    { subjectName: "Drawing", subjectCode: "DRAW-4", category: "Activity", totalMarks: 50, passingMarks: 20 },
    { subjectName: "General Knowledge", subjectCode: "GK-4", category: "Core", totalMarks: 50, passingMarks: 20 }
  ],

  "5th Class": [
    { subjectName: "English", subjectCode: "ENG-5", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Mathematics", subjectCode: "MATH-5", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Hindi", subjectCode: "HIN-5", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "EVS", subjectCode: "EVS-5", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Computer", subjectCode: "COMP-5", category: "Optional", totalMarks: 50, passingMarks: 20 },
    { subjectName: "Drawing", subjectCode: "DRAW-5", category: "Activity", totalMarks: 50, passingMarks: 20 },
    { subjectName: "General Knowledge", subjectCode: "GK-5", category: "Core", totalMarks: 50, passingMarks: 20 }
  ],

  "6th Class": [
    { subjectName: "English", subjectCode: "ENG-6", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Mathematics", subjectCode: "MATH-6", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Hindi", subjectCode: "HIN-6", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Science", subjectCode: "SCI-6", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Social Studies", subjectCode: "SST-6", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Computer", subjectCode: "COMP-6", category: "Optional", totalMarks: 50, passingMarks: 20 },
    { subjectName: "Drawing", subjectCode: "DRAW-6", category: "Activity", totalMarks: 50, passingMarks: 20 }
  ],

  "7th Class": [
    { subjectName: "English", subjectCode: "ENG-7", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Mathematics", subjectCode: "MATH-7", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Hindi", subjectCode: "HIN-7", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Science", subjectCode: "SCI-7", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Social Studies", subjectCode: "SST-7", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Computer", subjectCode: "COMP-7", category: "Optional", totalMarks: 50, passingMarks: 20 },
    { subjectName: "Drawing", subjectCode: "DRAW-7", category: "Activity", totalMarks: 50, passingMarks: 20 }
  ],

  "8th Class": [
    { subjectName: "English", subjectCode: "ENG-8", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Mathematics", subjectCode: "MATH-8", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Hindi", subjectCode: "HIN-8", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Science", subjectCode: "SCI-8", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Social Studies", subjectCode: "SST-8", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Computer", subjectCode: "COMP-8", category: "Optional", totalMarks: 50, passingMarks: 20 }
  ],

  "9th Class": [
    { subjectName: "English", subjectCode: "ENG-9", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Mathematics", subjectCode: "MATH-9", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Hindi", subjectCode: "HIN-9", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Science", subjectCode: "SCI-9", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Social Science", subjectCode: "SST-9", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Computer", subjectCode: "COMP-9", category: "Optional", totalMarks: 50, passingMarks: 20 }
  ],

  "10th Class": [
    { subjectName: "English", subjectCode: "ENG-10", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Mathematics", subjectCode: "MATH-10", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Hindi", subjectCode: "HIN-10", category: "Language", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Science", subjectCode: "SCI-10", category: "Core", totalMarks: 100, passingMarks: 35, hasPractical: true, theoryMarks: 80, practicalMarks: 20 },
    { subjectName: "Social Science", subjectCode: "SST-10", category: "Core", totalMarks: 100, passingMarks: 35 },
    { subjectName: "Computer", subjectCode: "COMP-10", category: "Optional", totalMarks: 50, passingMarks: 20 }
  ]
};

const seedSubjects = async () => {
  try {
    console.log("🌱 Starting subject seeding process...");
    
    await connectDB();
    
    // Clear existing subjects (optional - comment out if you want to keep existing data)
    // await Subject.deleteMany({});
    // console.log("🗑️  Cleared existing subjects");

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const [className, subjects] of Object.entries(subjectsData)) {
      console.log(`\n📚 Processing ${className}...`);

      for (const subjectData of subjects) {
        try {
          // Check if subject already exists
          const existing = await Subject.findOne({
            subjectName: subjectData.subjectName,
            className,
            academicYear: "2025-2026"
          });

          if (existing) {
            console.log(`   ⏭️  Skipped: ${subjectData.subjectName} (already exists)`);
            totalSkipped++;
            continue;
          }

          // Create subject
          await Subject.create({
            ...subjectData,
            className,
            academicYear: "2025-2026",
            isActive: true
          });

          console.log(`   ✅ Created: ${subjectData.subjectName} (${subjectData.subjectCode})`);
          totalCreated++;

        } catch (error) {
          console.error(`   ❌ Error creating ${subjectData.subjectName}:`, error.message);
        }
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`🎉 Seeding completed!`);
    console.log(`✅ Created: ${totalCreated} subjects`);
    console.log(`⏭️  Skipped: ${totalSkipped} subjects (already existed)`);
    console.log("=".repeat(60) + "\n");

    process.exit(0);

  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  }
};

// Run the seed function
seedSubjects();
