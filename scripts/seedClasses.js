/**
 * Seed Script: Initialize Classes (LKG to 10th)
 * Run: node scripts/seedClasses.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../src/config/db.js";
import Class from "../src/models/Class.js";

dotenv.config();

const classesData = [
  { className: "LKG", sections: ["A", "B"] },
  { className: "UKG", sections: ["A", "B"] },
  { className: "1st Class", sections: ["A", "B", "C"] },
  { className: "2nd Class", sections: ["A", "B", "C"] },
  { className: "3rd Class", sections: ["A", "B", "C"] },
  { className: "4th Class", sections: ["A", "B"] },
  { className: "5th Class", sections: ["A", "B"] },
  { className: "6th Class", sections: ["A", "B"] },
  { className: "7th Class", sections: ["A", "B"] },
  { className: "8th Class", sections: ["A", "B"] },
  { className: "9th Class", sections: ["A", "B"] },
  { className: "10th Class", sections: ["A", "B"] },
];

async function seedClasses() {
  try {
    await connectDB();
    console.log("✅ Connected to MongoDB");

    // Clear existing classes
    console.log("\n🗑️  Clearing existing classes...");
    const deleteResult = await Class.deleteMany({});
    console.log(`   ✓ Deleted ${deleteResult.deletedCount} classes`);

    // Insert new classes
    console.log("\n🏫 Creating classes...");
    const classes = await Class.insertMany(classesData);
    console.log(`   ✓ Created ${classes.length} classes`);

    // Display summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 CLASSES SEED SUMMARY");
    console.log("=".repeat(60));
    console.log("\n✅ Classes Created:");
    
    for (const cls of classes) {
      console.log(`   • ${cls.className} - Sections: ${cls.sections.join(", ")}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Classes seeding completed successfully!");
    console.log("=".repeat(60));
    console.log("\n📝 Next Step: Run 'node scripts/seedSubjects.js' to create subjects");
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
