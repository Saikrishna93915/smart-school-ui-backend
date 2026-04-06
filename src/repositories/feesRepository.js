import FeeStructure from "../models/FeeStructure.js";
import StudentFee from "../models/StudentFee.js";
import Payment from "../models/Payment.js";
import Receipt from "../models/Receipt.js";
import Student from "../models/Student.js";

// ===========================
// FEE STRUCTURE REPOSITORY
// ===========================

export const feeStructureRepository = {
  // Create fee structure
  async create(data) {
    const feeStructure = await FeeStructure.create(data);
    return feeStructure;
  },

  // Get all fee structures with filters
  async findAll(filters = {}) {
    const query = FeeStructure.find(filters).sort("-createdAt");
    return query;
  },

  // Get by ID
  async findById(id) {
    return FeeStructure.findById(id);
  },

  // Get by academic year and class
  async findByAcademicYearAndClass(academicYear, className) {
    return FeeStructure.findOne({ academicYear, className });
  },

  // Update fee structure
  async update(id, data) {
    return FeeStructure.findByIdAndUpdate(id, data, { new: true });
  },

  // Delete fee structure
  async delete(id) {
    return FeeStructure.findByIdAndDelete(id);
  },
};

// ===========================
// STUDENT FEES REPOSITORY
// ===========================

export const studentFeeRepository = {
  // Create student fee
  async create(data) {
    return StudentFee.create(data);
  },

  // Get student fee
  async findByStudentId(studentId) {
    return StudentFee.findOne({ studentId }).populate("feeStructureId");
  },

  // Get student fee by admission number
  async findByAdmissionNumber(admissionNumber) {
    return StudentFee.findOne({ admissionNumber }).populate("feeStructureId");
  },

  // Get all student fees
  async findAll(filters = {}) {
    return StudentFee.find(filters)
      .populate("studentId")
      .populate("feeStructureId")
      .sort("-createdAt");
  },

  // Update student fee
  async update(studentId, data) {
    return StudentFee.findOneAndUpdate({ studentId }, data, { new: true });
  },

  // Update installment status
  async updateInstallmentStatus(studentId, installmentNo, status) {
    return StudentFee.updateOne(
      { studentId, "installments.installmentNo": installmentNo },
      { $set: { "installments.$.status": status } }
    );
  },

  // Calculate due amounts
  async calculateDues(studentId) {
    const studentFee = await StudentFee.findOne({ studentId });
    if (!studentFee) return null;

    const pendingInstallments = studentFee.installments.filter(
      (inst) => inst.status === "pending" || inst.status === "overdue"
    );

    const totalDue = pendingInstallments.reduce((sum, inst) => sum + inst.amount, 0);
    const totalPenalty = pendingInstallments.reduce((sum, inst) => sum + inst.penalty, 0);

    return {
      totalDue,
      totalPenalty,
      totalWithPenalty: totalDue + totalPenalty,
      pendingInstallments,
    };
  },
};

// ===========================
// PAYMENT REPOSITORY
// ===========================

export const paymentRepository = {
  // Create payment
  async create(data) {
    return Payment.create(data);
  },

  // Get payment by ID
  async findById(id) {
    return Payment.findById(id);
  },

  // Get payment by receipt number
  async findByReceiptNumber(receiptNumber) {
    return Payment.findOne({ receiptNumber });
  },

  // Get student payments
  async findByStudentId(studentId, filters = {}) {
    const query = { studentId, ...filters };
    return Payment.find(query).sort("-paymentDate");
  },

  // Get all payments with filters
  async findAll(filters = {}) {
    return Payment.find(filters)
      .populate("studentId")
      .populate("recordedBy")
      .sort("-paymentDate");
  },

  // Update payment
  async update(id, data) {
    return Payment.findByIdAndUpdate(id, data, { new: true });
  },

  // Get payment statistics
  async getPaymentStats(academicYear) {
    return Payment.aggregate([
      { $match: { academicYear, status: "completed" } },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);
  },

  // Generate next receipt number
  async generateReceiptNumber() {
    const lastReceipt = await Payment.findOne()
      .sort("-receiptNumber")
      .select("receiptNumber");

    const year = new Date().getFullYear();
    let nextNumber = 1;

    if (lastReceipt && lastReceipt.receiptNumber) {
      const match = lastReceipt.receiptNumber.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    return `REC${year}${String(nextNumber).padStart(6, "0")}`;
  },
};

// ===========================
// RECEIPT REPOSITORY
// ===========================

export const receiptRepository = {
  // Create receipt
  async create(data) {
    return Receipt.create(data);
  },

  // Get receipt by ID
  async findById(id) {
    return Receipt.findById(id)
      .populate("studentId")
      .populate("paymentId");
  },

  // Get receipt by receipt number
  async findByReceiptNumber(receiptNumber) {
    return Receipt.findOne({ receiptNumber })
      .populate("studentId")
      .populate("paymentId");
  },

  // Get student receipts
  async findByStudentId(studentId) {
    return Receipt.find({ studentId })
      .populate("paymentId")
      .sort("-date");
  },

  // Get all receipts
  async findAll(filters = {}) {
    return Receipt.find(filters)
      .populate("studentId")
      .populate("paymentId")
      .sort("-date");
  },

  // Update receipt
  async update(id, data) {
    return Receipt.findByIdAndUpdate(id, data, { new: true });
  },

  // Delete receipt
  async delete(id) {
    return Receipt.findByIdAndDelete(id);
  },
};

// ===========================
// ANALYTICS REPOSITORY
// ===========================

export const analyticsRepository = {
  // Get total revenue
  async getTotalRevenue(filters = {}) {
    const result = await Payment.aggregate([
      { $match: { status: "completed", ...filters } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    return result[0]?.total || 0;
  },

  // Get total dues
  async getTotalDues(filters = {}) {
    const result = await StudentFee.aggregate([
      { $match: filters },
      { $group: { _id: null, total: { $sum: "$remainingAmount" } } },
    ]);
    return result[0]?.total || 0;
  },

  // Get payment trends by month
  async getPaymentTrends(academicYear) {
    return Payment.aggregate([
      { $match: { academicYear, status: "completed" } },
      {
        $group: {
          _id: {
            year: { $year: "$paymentDate" },
            month: { $month: "$paymentDate" },
          },
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);
  },

  // Get class-wise collection
  async getClassWiseCollection(academicYear) {
    return Payment.aggregate([
      { $match: { academicYear, status: "completed" } },
      {
        $group: {
          _id: "$className",
          totalCollection: { $sum: "$amount" },
          paymentCount: { $sum: 1 },
          averagePayment: {
            $avg: "$amount",
          },
        },
      },
      { $sort: { totalCollection: -1 } },
    ]);
  },

  // Get payment method breakdown
  async getPaymentMethodStats(academicYear) {
    return Payment.aggregate([
      { $match: { academicYear, status: "completed" } },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          percentage: {
            $divide: [
              { $sum: "$amount" },
              {
                $sum: {
                  $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0],
                },
              },
            ],
          },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);
  },
};
