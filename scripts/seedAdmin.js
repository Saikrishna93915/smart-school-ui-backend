/**
 * SEED ADMIN USER
 * Creates a default admin account for the school ERP system
 *
 * Usage: node scripts/seedAdmin.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    console.log(`📍 Using URI: ${process.env.MONGO_URI}`);
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      $or: [
        { email: "admin@school.com" },
        { username: "admin" }
      ]
    });

    if (existingAdmin) {
      console.log("\n⚠️  Admin account already exists:");
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Role: ${existingAdmin.role}`);
      console.log("\n✅ No action needed. You can login with existing credentials.");
      process.exit(0);
    }

    // Create admin user
    console.log("\n📝 Creating admin account...");

    const admin = await User.create({
      name: "School Admin",
      email: "admin@school.com",
      username: "admin",
      password: "Admin@123", // Will be hashed automatically by pre-save middleware
      role: "admin",
      phone: "",
      active: true,
      forcePasswordChange: false // Admin doesn't need to change password on first login
    });

    console.log("\n✅ Admin account created successfully!");
    console.log("\n╔════════════════════════════════════════════════╗");
    console.log("║         ADMIN LOGIN CREDENTIALS                ║");
    console.log("╠════════════════════════════════════════════════╣");
    console.log("║  Email:    admin@school.com                    ║");
    console.log("║  Username: admin                               ║");
    console.log("║  Password: Admin@123                           ║");
    console.log("║  Role:     admin                               ║");
    console.log("╚════════════════════════════════════════════════╝");
    console.log("\n🔐 You can now login with these credentials.");
    console.log("⚠️  Please change the password after first login for security.");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
    process.exit(1);
  }
};

// Run the seed function
seedAdmin();
