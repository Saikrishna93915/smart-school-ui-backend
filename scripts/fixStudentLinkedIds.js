import mongoose from "mongoose";
import User from "../src/models/User.js";
import Student from "../src/models/Student.js";
import dotenv from "dotenv";

dotenv.config();

const fixStudentLinkedIds = async () => {
  try {
    console.log("🔍 Starting fix for missing student linkedIds...\n");

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Find all student users with null linkedId
    const studentsWithoutLinkedId = await User.find({
      role: "student",
      linkedId: { $in: [null, undefined, ""] }
    });

    console.log(`Found ${studentsWithoutLinkedId.length} student users with missing linkedId\n`);

    if (studentsWithoutLinkedId.length === 0) {
      console.log("✅ All student users have linkedId set!");
      process.exit(0);
    }

    let fixed = 0;
    let notFound = 0;

    for (const user of studentsWithoutLinkedId) {
      // Try to find the student by admission number (username)
      const student = await Student.findOne({
        admissionNumber: user.username,
        status: { $ne: "deleted" }
      });

      if (student) {
        // Update the user with the linkedId
        await User.findByIdAndUpdate(user._id, { linkedId: student._id });
        console.log(`✅ Fixed: ${user.username} (${user.name}) -> LinkedId: ${student._id}`);
        fixed++;
      } else {
        console.log(`❌ Not found: ${user.username} (${user.name})`);
        notFound++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Not Found: ${notFound}`);
    console.log(`\n✅ Migration complete!`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error during migration:", error);
    process.exit(1);
  }
};

fixStudentLinkedIds();
