import { z } from "zod";

// === FEE STRUCTURE VALIDATORS ===
export const createFeeStructureSchema = z.object({
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, "Format: YYYY-YYYY"),
  className: z.string().min(1, "Class is required"),
  feeComponents: z.array(
    z.object({
      componentName: z.string().min(1),
      amount: z.number().positive("Amount must be positive"),
      dueDate: z.string().datetime().optional(),
      isMandatory: z.boolean().default(true),
      frequency: z.enum(["one-time", "monthly", "quarterly", "half-yearly", "yearly"]),
    })
  ).min(1, "At least one fee component required"),
  totalFee: z.number().positive(),
});

export const updateFeeStructureSchema = createFeeStructureSchema.partial();

// === STUDENT FEES VALIDATORS ===
export const createStudentFeeSchema = z.object({
  studentId: z.string().min(1, "Student ID required"),
  className: z.string().min(1),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  feeStructureId: z.string().optional(),
  totalAmount: z.number().positive(),
  installments: z.array(
    z.object({
      installmentNo: z.number().positive(),
      dueDate: z.string().datetime(),
      amount: z.number().positive(),
      penalty: z.number().default(0),
      status: z.enum(["pending", "paid", "overdue"]).default("pending"),
    })
  ).min(1),
});

export const updateStudentFeeSchema = createStudentFeeSchema.partial();

// === PAYMENT VALIDATORS ===
export const createPaymentSchema = z.object({
  studentId: z.string().min(1, "Student ID required"),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMethod: z.enum([
    "cash",
    "cheque",
    "online",
    "upi",
    "card",
    "bank-transfer",
    "wallet",
  ]),
  duesIds: z.array(z.string()).optional(),
  transactionId: z.string().optional(),
  chequeNo: z.string().optional(),
  bankName: z.string().optional(),
  description: z.string().optional(),
});

export const verifyPaymentSchema = z.object({
  paymentId: z.string().min(1),
  transactionId: z.string().optional(),
});

// === RECEIPT VALIDATORS ===
export const createReceiptSchema = z.object({
  studentId: z.string().min(1),
  paymentId: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.string(),
});

export const generateReceiptSchema = z.object({
  paymentId: z.string().min(1),
  format: z.enum(["pdf", "json"]).default("pdf"),
});

// === HELPER FUNCTION ===
export const validateInput = (data, schema) => {
  try {
    return {
      success: true,
      data: schema.parse(data),
    };
  } catch (error) {
    return {
      success: false,
      errors: error.errors,
    };
  }
};
