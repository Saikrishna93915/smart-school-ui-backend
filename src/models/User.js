// models/User.js - COMPLETE WORKING VERSION
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true
    },

    phone: {
      type: String,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["admin", "owner", "teacher", "student", "parent", "cashier", "principal", "driver"],
      required: true
    },

    linkedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },

    children: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    }],

    forcePasswordChange: {
      type: Boolean,
      default: true
    },

    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

/* =========================
   HASH PASSWORD BEFORE SAVE
========================= */
userSchema.pre("save", async function() {
  try {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified("password")) {
      return;
    }
    
    // Hash password with salt rounds
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    console.error("❌ Password hashing error:", error);
    throw error;
  }
});

/* =========================
   COMPARE PASSWORD (Instance method)
========================= */
userSchema.methods.matchPassword = async function(enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
};

export default mongoose.model("User", userSchema);