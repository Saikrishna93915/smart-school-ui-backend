#!/usr/bin/env node
/**
 * Interactive Student-User Linking Diagnostic & Fix Script
 * This script helps identify and fix mismatches between Student records and User accounts
 */

import mongoose from "mongoose";
import User from "../src/models/User.js";
import Student from "../src/models/Student.js";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  try {
    console.log("\n" + "=".repeat(80));
    console.log("🔍 STUDENT-USER LINKING DIAGNOSTIC TOOL");
    console.log("=".repeat(80) + "\n");

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Fetch all data
    const studentUsers = await User.find({ role: "student" }).lean();
    const students = await Student.find({ status: { $ne: "deleted" } }).lean();

    console.log(`📊 DATABASE STATUS:`);
    console.log(`   Student Users: ${studentUsers.length}`);
    console.log(`   Student Records: ${students.length}\n`);

    if (studentUsers.length === 0) {
      console.log("❌ No student users found. Create users first!\n");
      rl.close();
      process.exit(0);
    }

    if (students.length === 0) {
      console.log("❌ No student records found. Create student records first!\n");
      rl.close();
      process.exit(0);
    }

    // Analyze each student user
    console.log("📋 STUDENT USER ANALYSIS:\n");
    
    let unmatchedUsers = [];

    for (const user of studentUsers) {
      console.log(`User: ${user.username}`);
      console.log(`  - userId: ${user._id}`);
      console.log(`  - linkedId: ${user.linkedId || "❌ NULL"}`);

      // Try to find matching student
      const matchedStudent = students.find(
        (s) => s.admissionNumber === user.username ||
               s.admissionNumber.toLowerCase() === user.username.toLowerCase()
      );

      if (matchedStudent) {
        console.log(`  ✅ Matched to student: ${matchedStudent.student.firstName} ${matchedStudent.student.lastName}`);
        console.log(`     Student ID: ${matchedStudent._id}`);
        console.log(`     Class: ${matchedStudent.class.className}-${matchedStudent.class.section}`);

        // Check if linkedId is correct
        if (user.linkedId && user.linkedId.toString() === matchedStudent._id.toString()) {
          console.log(`     ✅ linkedId is CORRECT\n`);
        } else {
          console.log(`     ⚠️ linkedId is WRONG or NULL - needs fixing\n`);
          unmatchedUsers.push({
            userId: user._id,
            username: user.username,
            currentLinkedId: user.linkedId,
            correctStudentId: matchedStudent._id,
            studentName: `${matchedStudent.student.firstName} ${matchedStudent.student.lastName}`
          });
        }
      } else {
        console.log(`  ❌ No matching student record found`);
        console.log(`     Expected admission number: ${user.username}\n`);
        unmatchedUsers.push({
          userId: user._id,
          username: user.username,
          currentLinkedId: user.linkedId,
          correctStudentId: null,
          error: "No matching student"
        });
      }
    }

    // Show available students
    console.log("\n📚 AVAILABLE STUDENTS:\n");
    students.forEach((student, index) => {
      console.log(`${index + 1}. ${student.admissionNumber}: ${student.student.firstName} ${student.student.lastName}`);
      console.log(`   Class: ${student.class.className}-${student.class.section}`);
      console.log(`   ID: ${student._id}\n`);
    });

    // Fix unmatched users
    if (unmatchedUsers.length > 0) {
      console.log(`\n⚠️ FOUND ${unmatchedUsers.length} UNMATCHED USER(S) - FIX NEEDED\n`);

      for (const unmatchedUser of unmatchedUsers) {
        console.log(`\nProcessing: ${unmatchedUser.username}`);

        if (unmatchedUser.error) {
          console.log(`❌ ${unmatchedUser.error}`);
          console.log("   This student has no user account creation.\n");
        } else {
          const fix = await question(
            `Update linkedId from ${unmatchedUser.currentLinkedId || "NULL"} to ${unmatchedUser.correctStudentId}? (y/n) `
          );

          if (fix.toLowerCase() === "y") {
            await User.findByIdAndUpdate(
              unmatchedUser.userId,
              { linkedId: unmatchedUser.correctStudentId }
            );
            console.log(`✅ Updated! linkedId now set to: ${unmatchedUser.correctStudentId}\n`);
          }
        }
      }
    } else {
      console.log("\n✅ ALL STUDENT USERS ARE PROPERLY LINKED!\n");
    }

    console.log("=".repeat(80));
    console.log("✅ Diagnostic complete");
    console.log("=".repeat(80) + "\n");

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    rl.close();
    process.exit(1);
  }
}

main();
