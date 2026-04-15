import FeeStructure from "../models/FeeStructure.js";
import { getConfig, getFeeStructureForClass } from "../services/configService.js";

// REMOVED: Hardcoded fee structure - now fetched from database dynamically
// Use getConfig('fees.structure') or getFeeStructureForClass(className) instead

const normalizeTransport = (value) => {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return value > 0 ? "yes" : "no";

  const text = typeof value === "string" ? value.toLowerCase().trim() : "";
  if (!text) return "no";
  if (["yes", "y", "true", "1", "active", "enabled", "enrolled"].includes(text)) return "yes";
  return "no";
};

const buildDefaultFeeStructurePayload = async (student) => {
  const className = student?.class?.className || "10th Class";
  
  // DYNAMIC: Fetch fee structure from database instead of hardcoded values
  const config = await getFeeStructureForClass(className);
  
  if (!config) {
    console.warn(`⚠️ No fee structure found for class '${className}'. Using fallback.`);
    // Fallback to minimal defaults if not configured
    config = { baseFee: 15000, transportFee: 6000, activityFee: 3500, examFee: 5000, otherFees: 2000 };
  }
  
  const transport = normalizeTransport(student?.transport);
  const transportFee = transport === "yes" ? config.transportFee : 0;
  const academicYear = await getConfig('academic.currentYear', student?.class?.academicYear || "2025-2026");
  const totalFee = config.baseFee + config.activityFee + config.examFee + config.otherFees + transportFee;
  
  // Get due date from config or use default
  const defaultDueDateStr = await getConfig('fees.defaultDueDate', '06-30');
  const [month, day] = defaultDueDateStr.split('-').map(Number);
  const defaultDueDate = new Date(new Date().getFullYear(), month - 1, day);

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

  const academicYear = await getConfig('academic.currentYear', student?.class?.academicYear || "2025-2026");
  const existing = await FeeStructure.findOne({
    admissionNumber: student.admissionNumber,
    academicYear,
  });

  if (existing) return existing;

  // Now async since buildDefaultFeeStructurePayload is async
  const payload = await buildDefaultFeeStructurePayload(student);
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

