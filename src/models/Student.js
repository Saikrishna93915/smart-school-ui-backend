import mongoose from "mongoose";

const ParentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    occupation: { type: String },
  },
  { _id: false }
);

const StudentSchema = new mongoose.Schema(
  {
    admissionNumber: {
      type: String,
      required: true,
      unique: true,
    },

    student: {
      firstName: { type: String, required: true },
      lastName: { type: String },
      gender: { type: String, enum: ["Male", "Female", "Other"] },
      dob: { type: Date },
    },

    class: {
      className: { type: String, required: true },
      section: { type: String, required: true },
      academicYear: { type: String, required: true },
    },

    parents: {
      father: ParentSchema,
      mother: ParentSchema,
    },

    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    transport: {
      type: String,
      enum: ["yes", "no"],
      default: "no",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Student", StudentSchema);
