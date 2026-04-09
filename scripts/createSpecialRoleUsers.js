// scripts/createSpecialRoleUsers.js
// Run: node scripts/createSpecialRoleUsers.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

// Dynamic imports after env load
const { default: User } = await import("../src/models/User.js");
const { default: Driver } = await import("../src/models/Driver.js");

// Use MongoDB Atlas as primary
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/school_erp";

const usersToCreate = [
  {
    name: "Cashier User",
    username: "cashier@school.com",
    email: "cashier@school.com",
    password: "Cashier#c7c6c224!2026",
    role: "cashier",
    phone: "9000000010",
    forcePasswordChange: false,
  },
  {
    name: "Principal",
    username: "principal@school.com",
    email: "principal@school.com",
    password: "Principal#ae8610c4!2026",
    role: "principal",
    phone: "9000000011",
    forcePasswordChange: false,
  },
  {
    name: "Driver One",
    username: "driver001",
    email: "driver001@school.com",
    password: "Driver@123",
    role: "driver",
    phone: "9000000012",
    forcePasswordChange: true,
  },
];

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    for (const userData of usersToCreate) {
      const exists = await User.findOne({
        $or: [{ email: userData.email }, { username: userData.username }],
      });

      if (exists) {
        console.log(`[SKIP] ${userData.role} already exists: ${userData.email}`);
        continue;
      }

      const user = await User.create({ ...userData, active: true });
      console.log(`[CREATED] ${userData.role}: ${userData.username} / ${userData.password}`);

      // Link driver user to Driver document
      if (userData.role === "driver") {
        const result = await Driver.findOneAndUpdate(
          { phone: userData.phone },
          { user: user._id, userId: user._id },
          { new: true }
        );
        if (result) {
          console.log(`  -> Linked to Driver record: ${result._id}`);
        } else {
          // Create a basic driver record if none found
          const newDriver = await Driver.create({
            firstName: "Driver",
            lastName: "One",
            email: userData.email,
            phone: userData.phone,
            user: user._id,
            userId: user._id,
            status: "active",
          });
          console.log(`  -> Created Driver record: ${newDriver._id}`);
        }
      }
    }

    console.log("\nDone. Login credentials:");
    console.log("  Cashier:   cashier@school.com  / Cashier@123");
    console.log("  Principal: principal@school.com / Principal@123");
    console.log("  Driver:    driver001            / Driver@123");

    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

run();
