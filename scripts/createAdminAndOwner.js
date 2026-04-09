// scripts/createAdminAndOwner.js
// Run: node scripts/createAdminAndOwner.js
// Purpose: Create admin and owner users with secure credentials
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const { default: User } = await import("../src/models/User.js");

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/school_erp";

// Generate secure passwords
const ownerPassword = "Owner#" + crypto.randomBytes(4).toString("hex") + "!2026";
const adminPassword = "Admin#" + crypto.randomBytes(4).toString("hex") + "!2026";

const usersToCreate = [
  {
    name: "School Owner",
    username: "owner@pmctechschool.com",
    email: "owner@pmctechschool.com",
    password: ownerPassword,
    role: "owner",
    phone: "9000000001",
    active: true,
    forcePasswordChange: false,
  },
  {
    name: "System Admin",
    username: "admin@pmctechschool.com",
    email: "admin@pmctechschool.com",
    password: adminPassword,
    role: "admin",
    phone: "9000000002",
    active: true,
    forcePasswordChange: false,
  },
];

async function run() {
  try {
    console.log("🔐 Connecting to MongoDB Atlas...\n");
    await mongoose.connect(MONGO_URI);
    console.log(`✅ Connected to: ${mongoose.connection.host}/${mongoose.connection.name}\n`);

    for (const userData of usersToCreate) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`👤 Processing ${userData.role.toUpperCase()} account...`);
      console.log(`${"=".repeat(60)}`);

      const exists = await User.findOne({
        $or: [{ email: userData.email }, { username: userData.username }]
      });

      if (exists) {
        console.log(`⚠️  ${userData.role} already exists: ${userData.email}`);
        console.log(`🔄 Updating password to new secure credential...`);
        exists.password = userData.password;
        exists.forcePasswordChange = false;
        exists.active = true;
        await exists.save();
        console.log(`✅ Password updated for ${userData.role}`);
      } else {
        const user = await User.create(userData);
        console.log(`✅ Created ${userData.role}: ${userData.email}`);
        console.log(`🆔 User ID: ${user._id}`);
      }

      console.log(`\n🔑 NEW CREDENTIALS:`);
      console.log(`   Username: ${userData.username}`);
      console.log(`   Password: ${userData.password}`);
      console.log(`   Role: ${userData.role}`);
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ ALL CREDENTIALS CREATED/UPDATED SUCCESSFULLY`);
    console.log(`${"=".repeat(60)}\n`);

    console.log(`📋 SUMMARY:`);
    console.log(`   Owner: owner@pmctechschool.com / ${ownerPassword}`);
    console.log(`   Admin: admin@pmctechschool.com / ${adminPassword}`);
    console.log(`\n⚠️  IMPORTANT: Store these credentials securely!`);
    console.log(`🔒 Do NOT commit them to version control.\n`);

    process.exit(0);
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();
