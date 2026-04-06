import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import Student from "../src/models/Student.js";
import FeeStructure from "../src/models/FeeStructure.js";

dotenv.config();

const hasTransportComponent = (feeStructure) => {
  const components = feeStructure?.feeComponents || [];
  return components.some((component) => component.componentName === "Transport Fee");
};

const main = async () => {
  await connectDB();

  const feeStructures = await FeeStructure.find(
    {},
    "studentId admissionNumber feeComponents transportOpted transportFee"
  ).lean();

  const transportByStudentId = new Map();
  const transportByAdmission = new Map();

  const feeStructureUpdates = [];

  for (const fee of feeStructures) {
    const hasTransport = hasTransportComponent(fee);

    if (fee.studentId) {
      transportByStudentId.set(String(fee.studentId), hasTransport);
    }
    if (fee.admissionNumber) {
      transportByAdmission.set(String(fee.admissionNumber), hasTransport);
    }

    if (fee.transportOpted !== hasTransport) {
      feeStructureUpdates.push({
        updateOne: {
          filter: { _id: fee._id },
          update: { $set: { transportOpted: hasTransport } },
        },
      });
    }
  }

  if (feeStructureUpdates.length > 0) {
    await FeeStructure.bulkWrite(feeStructureUpdates);
  }

  const students = await Student.find({}, "admissionNumber transport").lean();
  const studentUpdates = [];

  for (const student of students) {
    const transportFromFee =
      transportByStudentId.get(String(student._id)) ??
      transportByAdmission.get(String(student.admissionNumber)) ??
      false;

    const desiredTransport = student.transport === "yes" || transportFromFee ? "yes" : "no";

    if (student.transport !== desiredTransport) {
      studentUpdates.push({
        updateOne: {
          filter: { _id: student._id },
          update: { $set: { transport: desiredTransport } },
        },
      });
    }
  }

  if (studentUpdates.length > 0) {
    await Student.bulkWrite(studentUpdates);
  }

  console.log(
    `✅ Transport backfill complete. FeeStructures updated: ${feeStructureUpdates.length}, Students updated: ${studentUpdates.length}`
  );

  await mongoose.disconnect();
};

main().catch((error) => {
  console.error("❌ Transport backfill failed:", error);
  process.exit(1);
});
