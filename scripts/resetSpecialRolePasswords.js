// scripts/resetSpecialRolePasswords.js
// Run: node scripts/resetSpecialRolePasswords.js
// Purpose: Reset cashier and principal passwords to new secure credentials
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

// Dynamic imports after env load
const { default: User } = await import("../src/models/User.js");

// Use MongoDB Atlas as primary
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/school_erp";

// NEW SECURE CREDENTIALS
const credentials = [
  {
    email: "cashier@school.com",
    username: "cashier@school.com",
    newPassword: "Cashier#c7c6c224!2026",
    role: "cashier",
    name: "Cashier User"
  },
  {
    email: "principal@school.com",
    username: "principal@school.com",
    newPassword: "Principal#ae8610c4!2026",
    role: "principal",
    name: "Principal"
  }
];

async function run() {
  try {
    console.log("🔐 Connecting to MongoDB Atlas...\n");
    await mongoose.connect(MONGO_URI);
    console.log(`✅ Connected to: ${mongoose.connection.host}/${mongoose.connection.name}\n`);

    for (const cred of credentials) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`👤 Processing ${cred.role.toUpperCase()} account...`);
      console.log(`${"=".repeat(60)}`);

      // Find user
      const user = await User.findOne({
        $or: [{ email: cred.email }, { username: cred.username }]
      });

      if (!user) {
        console.log(`❌ ${cred.role} not found: ${cred.email}`);
        console.log(`💡 Creating new ${cred.role} user...`);
        
        // Create new user if doesn't exist
        const newUser = await User.create({
          name: cred.name,
          username: cred.username,
          email: cred.email,
          password: cred.newPassword,
          role: cred.role,
          phone: cred.role === "cashier" ? "9000000010" : "9000000011",
          active: true,
          forcePasswordChange: false // They have a strong password already
        });
        
        console.log(`✅ Created ${cred.role}: ${cred.email}`);
        console.log(`🆔 User ID: ${newUser._id}`);
      } else {
        // Update existing user password
        user.password = cred.newPassword;
        user.forcePasswordChange = false;
        user.active = true;
        await user.save();
        
        console.log(`✅ Password updated for ${cred.role}`);
        console.log(`📧 Email: ${user.email}`);
        console.log(`🆔 User ID: ${user._id}`);
      }

      console.log(`\n🔑 NEW CREDENTIALS:`);
      console.log(`   Username: ${cred.username}`);
      console.log(`   Password: ${cred.newPassword}`);
      console.log(`   Role: ${cred.role}`);
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ ALL CREDENTIALS UPDATED SUCCESSFULLY`);
    console.log(`${"=".repeat(60)}\n`);

    console.log(`📋 SUMMARY:`);
    console.log(`   Cashier:   cashier@school.com / Cashier#c7c6c224!2026`);
    console.log(`   Principal: principal@school.com / Principal#ae8610c4!2026`);
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
