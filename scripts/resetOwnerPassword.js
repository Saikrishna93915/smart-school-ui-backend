/**
 * RESET OWNER PASSWORD
 * Resets the owner account password to Owner@123
 * 
 * Usage: node scripts/resetOwnerPassword.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";

dotenv.config();

const resetOwnerPassword = async () => {
  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    // Find owner user
    const owner = await User.findOne({ 
      email: "owner@gmail.com",
      role: "owner"
    });

    if (!owner) {
      console.log("❌ Owner account not found!");
      console.log("   Please run: node scripts/seedOwner.js first");
      process.exit(1);
    }

    console.log("\n📝 Resetting owner password...");
    console.log(`   Found owner: ${owner.name} (${owner.email})`);

    // Update password - this will automatically trigger the pre-save middleware to hash it
    owner.password = "Owner@123";
    owner.forcePasswordChange = false;
    await owner.save();

    console.log("\n✅ Owner password reset successfully!");
    console.log("\n╔════════════════════════════════════════════════╗");
    console.log("║         OWNER LOGIN CREDENTIALS                ║");
    console.log("╠════════════════════════════════════════════════╣");
    console.log("║  Email:    owner@gmail.com                     ║");
    console.log("║  Username: owner@gmail.com                     ║");
    console.log("║  Password: Owner@123                           ║");
    console.log("║  Role:     owner                               ║");
    console.log("╚════════════════════════════════════════════════╝");
    console.log("\n🔐 You can now login with these credentials.");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting password:", error);
    process.exit(1);
  }
};

// Run the reset function
resetOwnerPassword();
