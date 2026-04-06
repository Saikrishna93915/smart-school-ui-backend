import mongoose from "mongoose";
import Student from "../src/models/Student.js";
import User from "../src/models/User.js";

const MONGO_URI = "mongodb://127.0.0.1:27017/school_erp";

async function createParentUsers() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected");

  const students = await Student.find({ status: "active" });

  console.log(`\n📊 Found ${students.length} active students`);
  console.log(`🔄 Creating parent user accounts...\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const student of students) {
    try {
      // Create user for father if mobile exists
      if (student.parents?.father?.phone) {
        const fatherPhone = student.parents.father.phone;
        const existingFather = await User.findOne({
          username: fatherPhone,
          role: "parent",
        });

        if (!existingFather) {
          await User.create({
            name: student.parents.father.name || "Father",
            username: fatherPhone,
            phone: fatherPhone,
            password: "Parent@123",
            role: "parent",
            linkedId: student._id, // Link to student record
            forcePasswordChange: true,
            active: true,
          });
          created++;
          console.log(`✓ Created father account: ${fatherPhone} for ${student.student.firstName}`);
        } else {
          skipped++;
        }
      }

      // Create user for mother if mobile exists
      if (student.parents?.mother?.phone) {
        const motherPhone = student.parents.mother.phone;
        const existingMother = await User.findOne({
          username: motherPhone,
          role: "parent",
        });

        if (!existingMother) {
          await User.create({
            name: student.parents.mother.name || "Mother",
            username: motherPhone,
            phone: motherPhone,
            password: "Parent@123",
            role: "parent",
            linkedId: student._id, // Link to student record
            forcePasswordChange: true,
            active: true,
          });
          created++;
          console.log(`✓ Created mother account: ${motherPhone} for ${student.student.firstName}`);
        } else {
          skipped++;
        }
      }
    } catch (error) {
      errors++;
      console.error(`❌ Error creating parent for ${student.admissionNumber}:`, error.message);
    }
  }

  console.log("\n========================================");
  console.log(`✅ Parent users created: ${created}`);
  console.log(`⏭️  Users skipped (already exist): ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log("========================================\n");

  console.log("📝 Parent Login Details:");
  console.log("   Username: Parent's mobile number");
  console.log("   Password: Parent@123");
  console.log("   Role: parent\n");

  process.exit();
}

createParentUsers();
