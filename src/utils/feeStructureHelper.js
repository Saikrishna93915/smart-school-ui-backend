import FeeStructure from "../models/FeeStructure.js";

const feeConfig = {
  "10th Class": { baseFee: 50000, transportFee: 25000, activityFee: 5000, examFee: 3000, otherFees: 2000 },
  "11th Class": { baseFee: 55000, transportFee: 25000, activityFee: 5500, examFee: 3500, otherFees: 2500 },
  "12th Class": { baseFee: 60000, transportFee: 25000, activityFee: 6000, examFee: 4000, otherFees: 3000 },
  LKG: { baseFee: 20000, transportFee: 20000, activityFee: 3000, examFee: 1000, otherFees: 1000 },
  UKG: { baseFee: 22000, transportFee: 20000, activityFee: 3500, examFee: 1500, otherFees: 1500 },
  "1st Class": { baseFee: 25000, transportFee: 22000, activityFee: 4000, examFee: 2000, otherFees: 2000 },
  "2nd Class": { baseFee: 27000, transportFee: 22000, activityFee: 4000, examFee: 2000, otherFees: 2000 },
  "3rd Class": { baseFee: 29000, transportFee: 23000, activityFee: 4500, examFee: 2500, otherFees: 2000 },
  "4th Class": { baseFee: 31000, transportFee: 23000, activityFee: 4500, examFee: 2500, otherFees: 2000 },
  "5th Class": { baseFee: 33000, transportFee: 24000, activityFee: 4500, examFee: 2500, otherFees: 2000 },
  "6th Class": { baseFee: 35000, transportFee: 24000, activityFee: 5000, examFee: 3000, otherFees: 2000 },
  "7th Class": { baseFee: 38000, transportFee: 24000, activityFee: 5000, examFee: 3000, otherFees: 2000 },
  "8th Class": { baseFee: 42000, transportFee: 25000, activityFee: 5000, examFee: 3000, otherFees: 2000 },
  "9th Class": { baseFee: 46000, transportFee: 25000, activityFee: 5000, examFee: 3000, otherFees: 2000 },
};

const normalizeTransport = (value) => {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return value > 0 ? "yes" : "no";

  const text = typeof value === "string" ? value.toLowerCase().trim() : "";
  if (!text) return "no";
  if (["yes", "y", "true", "1", "active", "enabled", "enrolled"].includes(text)) return "yes";
  return "no";
};

const buildDefaultFeeStructurePayload = (student) => {
  const className = student?.class?.className || "10th Class";
  const config = feeConfig[className] || feeConfig["10th Class"];
  const transport = normalizeTransport(student?.transport);
  const transportFee = transport === "yes" ? config.transportFee : 0;
  const academicYear = student?.class?.academicYear || "2025-2026";
  const totalFee = config.baseFee + config.activityFee + config.examFee + config.otherFees + transportFee;
  const defaultDueDate = new Date(new Date().getFullYear(), 5, 30);

  const feeComponents = [
    {
      componentName: "Base Fee",
      amount: config.baseFee,
      dueDate: defaultDueDate,
      isMandatory: true,
      isRecurring: true,
      frequency: "yearly",
      status: "pending",
      paidAmount: 0,
    },
    {
      componentName: "Activity Fee",
      amount: config.activityFee,
      dueDate: defaultDueDate,
      isMandatory: true,
      isRecurring: true,
      frequency: "yearly",
      status: "pending",
      paidAmount: 0,
    },
    {
      componentName: "Exam Fee",
      amount: config.examFee,
      dueDate: defaultDueDate,
      isMandatory: true,
      isRecurring: true,
      frequency: "yearly",
      status: "pending",
      paidAmount: 0,
    },
    {
      componentName: "Other Fees",
      amount: config.otherFees,
      dueDate: defaultDueDate,
      isMandatory: false,
      isRecurring: false,
      frequency: "one-time",
      status: "pending",
      paidAmount: 0,
    },
  ];

  if (transportFee > 0) {
    feeComponents.push({
      componentName: "Transport Fee",
      amount: transportFee,
      dueDate: defaultDueDate,
      isMandatory: false,
      isRecurring: true,
      frequency: "yearly",
      status: "pending",
      paidAmount: 0,
    });
  }

  return {
    admissionNumber: student.admissionNumber,
    studentId: student._id,
    studentName: `${student?.student?.firstName || ""} ${student?.student?.lastName || ""}`.trim(),
    className,
    section: student?.class?.section || "",
    academicYear,
    transportOpted: transport === "yes",
    transportFee,
    feeComponents,
    totalFee,
    totalPaid: 0,
    totalDue: totalFee,
    overallStatus: "active",
  };
};

export const ensureFeeStructureForStudent = async (student) => {
  if (!student?._id || !student?.admissionNumber) return null;

  const academicYear = student?.class?.academicYear || "2025-2026";
  const existing = await FeeStructure.findOne({
    admissionNumber: student.admissionNumber,
    academicYear,
  });

  if (existing) return existing;

  const payload = buildDefaultFeeStructurePayload(student);
  return FeeStructure.create(payload);
};

export const ensureFeeStructuresForStudents = async (students = []) => {
  for (const student of students) {
    try {
      await ensureFeeStructureForStudent(student);
    } catch (error) {
      if (error?.code !== 11000) {
        console.error(`Failed to ensure fee structure for ${student?.admissionNumber}:`, error.message);
      }
    }
  }
};

