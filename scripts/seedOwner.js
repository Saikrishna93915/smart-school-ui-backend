/**
 * SEED OWNER USER
 * Creates a default owner account for the school ERP system
 * 
 * Usage: node scripts/seedOwner.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";

dotenv.config();

const seedOwner = async () => {
  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    // Check if owner already exists
    const existingOwner = await User.findOne({ 
      email: "owner@gmail.com" 
    });

    if (existingOwner) {
      console.log("⚠️  Owner account already exists:");
      console.log(`   Email: ${existingOwner.email}`);
      console.log(`   Username: ${existingOwner.username}`);
      console.log(`   Role: ${existingOwner.role}`);
      console.log("\n✅ No action needed. You can login with existing credentials.");
      process.exit(0);
    }

    // Create owner user
    console.log("\n📝 Creating owner account...");
    
    const owner = await User.create({
      name: "School Owner",
      email: "owner@gmail.com",
      username: "owner@gmail.com",
      password: "Owner@123", // Will be hashed automatically by pre-save middleware
      role: "owner",
      phone: "",
      active: true,
      forcePasswordChange: false // Owner doesn't need to change password
    });

    console.log("\n✅ Owner account created successfully!");
    console.log("\n╔════════════════════════════════════════════════╗");
    console.log("║         OWNER LOGIN CREDENTIALS                ║");
    console.log("╠════════════════════════════════════════════════╣");
    console.log("║  Email:    owner@gmail.com                     ║");
    console.log("║  Username: owner@gmail.com                     ║");
    console.log("║  Password: Owner@123                           ║");
    console.log("║  Role:     owner                               ║");
    console.log("╚════════════════════════════════════════════════╝");
    console.log("\n🔐 You can now login with these credentials.");
    console.log("⚠️  Please change the password after first login for security.");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding owner:", error);
    process.exit(1);
  }
};

// Run the seed function
seedOwner();
