import User from "../models/User.js";
import Student from "../models/Student.js";

/**
 * @desc    DIRECT FIX - Find student by admission number and link user
 * @route   POST /api/diagnose/fix-student-link/:admissionNumber
 * @access  Admin, or Student accessing their own
 */
export const fixStudentLink = async (req, res) => {
  try {
    const { admissionNumber } = req.params;
    
    console.log(`\n🔍 Attempting to fix student link for: ${admissionNumber}\n`);

    // Step 1: Find the user
    console.log(`Step 1: Finding user with username: ${admissionNumber}`);
    const user = await User.findOne({ 
      username: admissionNumber.toLowerCase().trim(),
      role: "student"
    });

    if (!user) {
      console.log(`❌ User not found with username: ${admissionNumber}`);
      return res.status(404).json({
        success: false,
        message: "Student user not found",
        data: {
          username: admissionNumber,
          foundUser: false
        }
      });
    }

    console.log(`✅ Found user:`, {
      userId: user._id,
      username: user.username,
      currentLinkedId: user.linkedId
    });

    // Step 2: Find the student
    console.log(`\nStep 2: Finding student with admissionNumber: ${admissionNumber}`);
    const student = await Student.findOne({ 
      admissionNumber: admissionNumber,
      status: { $ne: "deleted" }
    });

    if (!student) {
      console.log(`❌ Student not found with admissionNumber: ${admissionNumber}`);
      return res.status(404).json({
        success: false,
        message: "Student record not found",
        data: {
          admissionNumber,
          foundStudent: false
        }
      });
    }

    console.log(`✅ Found student:`, {
      studentId: student._id,
      admissionNumber: student.admissionNumber,
      name: `${student.student.firstName} ${student.student.lastName}`,
      class: `${student.class.className}-${student.class.section}`
    });

    // Step 3: Check if already linked correctly
    if (user.linkedId && user.linkedId.toString() === student._id.toString()) {
      console.log(`✅ User is ALREADY correctly linked!`);
      return res.status(200).json({
        success: true,
        message: "User already correctly linked to student",
        data: {
          userId: user._id,
          studentId: student._id,
          alreadyLinked: true
        }
      });
    }

    // Step 4: Link user to student
    console.log(`\nStep 3: Linking user to student...`);
    const oldLinkedId = user.linkedId;
    user.linkedId = student._id;
    await user.save();

    console.log(`✅ Successfully linked!`);
    console.log(`   Previous linkedId: ${oldLinkedId || "NULL"}`);
    console.log(`   New linkedId: ${student._id}\n`);

    res.status(200).json({
      success: true,
      message: "Student link fixed successfully",
      data: {
        userId: user._id,
        username: user.username,
        studentId: student._id,
        studentName: `${student.student.firstName} ${student.student.lastName}`,
        studentClass: `${student.class.className}-${student.class.section}`,
        linkedIdUpdated: true,
        previousLinkedId: oldLinkedId
      }
    });

  } catch (error) {
    console.error(`\n❌ Error fixing link:`, error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Check all students and auto-fix any broken links
 * @route   POST /api/diagnose/fix-all-links
 * @access  Admin only
 */
export const fixAllStudentLinks = async (req, res) => {
  try {
    console.log(`\n🔧 Running AUTO-FIX for ALL student links...\n`);

    // Get all student users
    const studentUsers = await User.find({ role: "student" });
    console.log(`Found ${studentUsers.length} student users\n`);

    let fixed = 0;
    let alreadyLinked = 0;
    let notFound = 0;
    const results = [];

    for (const user of studentUsers) {
      console.log(`Processing: ${user.username}`);

      // Try to find matching student
      const student = await Student.findOne({
        admissionNumber: user.username,
        status: { $ne: "deleted" }
      });

      if (!student) {
        console.log(`  ❌ No student record found\n`);
        notFound++;
        results.push({
          username: user.username,
          status: "notFound",
          error: "No matching student record"
        });
        continue;
      }

      // Check if already linked correctly
      if (user.linkedId && user.linkedId.toString() === student._id.toString()) {
        console.log(`  ✅ Already correctly linked\n`);
        alreadyLinked++;
        results.push({
          username: user.username,
          status: "alreadyLinked"
        });
        continue;
      }

      // Fix the link
      user.linkedId = student._id;
      await user.save();
      console.log(`  ✅ Fixed! Linked to student ${student._id}\n`);
      fixed++;
      results.push({
        username: user.username,
        status: "fixed",
        studentId: student._id
      });
    }

    console.log(`\n🎯 SUMMARY:`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Already Linked: ${alreadyLinked}`);
    console.log(`   Not Found: ${notFound}\n`);

    res.status(200).json({
      success: true,
      message: "Student link fix complete",
      summary: {
        totalProcessed: studentUsers.length,
        fixed,
        alreadyLinked,
        notFound
      },
      results
    });

  } catch (error) {
    console.error(`\n❌ Error in fix-all:`, error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
