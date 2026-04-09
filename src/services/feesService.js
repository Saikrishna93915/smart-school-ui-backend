import {
  feeStructureRepository,
  studentFeeRepository,
  paymentRepository,
  receiptRepository,
  analyticsRepository,
} from "../repositories/feesRepository.js";
import Student from "../models/Student.js";
import Payment from "../models/Payment.js";
import Receipt from "../models/Receipt.js";

// ===========================
// FEE SERVICE
// ===========================

export class FeeService {
  // === FEE STRUCTURE MANAGEMENT ===

  async createFeeStructure(data) {
    try {
      const feeStructure = await feeStructureRepository.create(data);
      return {
        success: true,
        message: "Fee structure created successfully",
        data: feeStructure,
      };
    } catch (error) {
      throw new Error(`Failed to create fee structure: ${error.message}`);
    }
  }

  async getFeeStructures(academicYear, className) {
    try {
      const filters = {};
      if (academicYear) filters.academicYear = academicYear;
      if (className) filters.className = className;

      const structures = await feeStructureRepository.findAll(filters);
      return {
        success: true,
        data: structures,
      };
    } catch (error) {
      throw new Error(`Failed to fetch fee structures: ${error.message}`);
    }
  }

  async getFeeStructureById(id) {
    try {
      const structure = await feeStructureRepository.findById(id);
      if (!structure) {
        throw new Error("Fee structure not found");
      }
      return {
        success: true,
        data: structure,
      };
    } catch (error) {
      throw new Error(`Failed to fetch fee structure: ${error.message}`);
    }
  }

  async updateFeeStructure(id, data) {
    try {
      const structure = await feeStructureRepository.update(id, data);
      return {
        success: true,
        message: "Fee structure updated successfully",
        data: structure,
      };
    } catch (error) {
      throw new Error(`Failed to update fee structure: ${error.message}`);
    }
  }

  async deleteFeeStructure(id) {
    try {
      await feeStructureRepository.delete(id);
      return {
        success: true,
        message: "Fee structure deleted successfully",
      };
    } catch (error) {
      throw new Error(`Failed to delete fee structure: ${error.message}`);
    }
  }

  // === STUDENT FEES MANAGEMENT ===

  async getStudentDues(studentId) {
    try {
      // Get student info
      const student = await Student.findById(studentId);
      if (!student) {
        throw new Error("Student not found");
      }

      // Get student fees
      const studentFee = await studentFeeRepository.findByStudentId(studentId);
      if (!studentFee) {
        return {
          success: true,
          message: "No fee structure assigned",
          data: {
            totalDue: 0,
            totalPenalty: 0,
            pendingInstallments: [],
            installments: [],
          },
        };
      }

      // Calculate dues
      const dues = await this.calculatePenalties(studentFee);

      return {
        success: true,
        data: {
          studentFee,
          dues,
          student: {
            name: student.student?.firstName + " " + student.student?.lastName,
            admissionNumber: student.admissionNumber,
            className: student.class?.className,
            section: student.class?.section,
          },
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch student dues: ${error.message}`);
    }
  }

  async calculatePenalties(studentFee) {
    try {
      const today = new Date();
      const penalties = [];

      studentFee.installments?.forEach((installment) => {
        const dueDate = new Date(installment.dueDate);
        let penalty = installment.penalty || 0;

        // Calculate late penalty: 1% per month
        if (today > dueDate && installment.status !== "paid") {
          const monthsDue = Math.floor(
            (today - dueDate) / (1000 * 60 * 60 * 24 * 30)
          );
          const latePenalty = installment.amount * (0.01 * monthsDue);
          penalty = Math.max(penalty, latePenalty);
        }

        penalties.push({
          installmentNo: installment.installmentNo,
          amount: installment.amount,
          penalty,
          total: installment.amount + penalty,
          dueDate: installment.dueDate,
          status: installment.status,
          daysOverdue: today > dueDate ? Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)) : 0,
        });
      });

      const totalDue = penalties.reduce((sum, p) => sum + p.amount, 0);
      const totalPenalty = penalties.reduce((sum, p) => sum + p.penalty, 0);

      return {
        totalDue,
        totalPenalty,
        totalWithPenalty: totalDue + totalPenalty,
        penalties,
      };
    } catch (error) {
      throw new Error(`Failed to calculate penalties: ${error.message}`);
    }
  }

  // === PAYMENT PROCESSING ===

  async processPayment(paymentData) {
    try {
      const { studentId, amount, paymentMethod } = paymentData;

      // Validate student
      const student = await Student.findById(studentId);
      if (!student) {
        throw new Error("Student not found");
      }

      // Get student fees
      const studentFee = await studentFeeRepository.findByStudentId(studentId);
      if (!studentFee) {
        throw new Error("No fee structure found for student");
      }

      // Calculate current dues
      const dues = await this.calculatePenalties(studentFee);
      if (amount > dues.totalWithPenalty) {
        throw new Error(
          `Payment amount exceeds due amount of ₹${dues.totalWithPenalty}`
        );
      }

      // Generate receipt number
      const receiptNumber = await paymentRepository.generateReceiptNumber();

      // Create payment record
      const payment = await paymentRepository.create({
        studentId,
        admissionNumber: student.admissionNumber,
        studentName: `${student.student?.firstName} ${student.student?.lastName}`,
        className: student.class?.className,
        section: student.class?.section,
        amount,
        paymentMethod,
        receiptNumber,
        status: "completed",
        paymentDate: new Date(),
        academicYear: studentFee.academicYear,
        totalAmount: studentFee.totalAmount,
        ...paymentData,
      });

      // Update student fees
      const updatedFee = {
        paidAmount: (studentFee.paidAmount || 0) + amount,
        remainingAmount: studentFee.totalAmount - ((studentFee.paidAmount || 0) + amount),
      };

      await studentFeeRepository.update(studentId, updatedFee);

      // Generate receipt
      const receipt = await receiptRepository.create({
        receiptNo: receiptNumber,
        studentId,
        paymentId: payment._id,
        amount,
        paymentMethod,
        date: new Date(),
        status: "generated",
        downloadUrl: `/api/fees/receipts/download/${payment._id}`,
      });

      return {
        success: true,
        message: "Payment processed successfully",
        data: {
          payment,
          receipt,
          receiptNumber,
        },
      };
    } catch (error) {
      throw new Error(`Payment processing failed: ${error.message}`);
    }
  }

  async getPaymentHistory(studentId) {
    try {
      const payments = await paymentRepository.findByStudentId(studentId, {
        status: "completed",
      });

      return {
        success: true,
        data: payments,
        count: payments.length,
      };
    } catch (error) {
      throw new Error(`Failed to fetch payment history: ${error.message}`);
    }
  }

  // === RECEIPT GENERATION ===

  async generateReceiptPDF(paymentId) {
    try {
      const payment = await paymentRepository.findById(paymentId);
      if (!payment) {
        throw new Error("Payment not found");
      }

      const studentFee = await studentFeeRepository.findByStudentId(
        payment.studentId
      );

      return {
        success: true,
        data: {
          receiptNumber: payment.receiptNumber,
          studentName: payment.studentName,
          admissionNumber: payment.admissionNumber,
          className: payment.className,
          section: payment.section,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paymentDate: payment.paymentDate,
          academicYear: payment.academicYear,
          transactionId: payment.transactionId,
          totalFee: studentFee?.totalAmount,
          paidAmount: studentFee?.paidAmount,
          remainingAmount: studentFee?.remainingAmount,
        },
      };
    } catch (error) {
      throw new Error(`Failed to generate receipt: ${error.message}`);
    }
  }

  async getReceipts(studentId) {
    try {
      const receipts = await receiptRepository.findByStudentId(studentId);
      return {
        success: true,
        data: receipts,
        count: receipts.length,
      };
    } catch (error) {
      throw new Error(`Failed to fetch receipts: ${error.message}`);
    }
  }

  // === ANALYTICS ===

  async getAnalytics(academicYear) {
    try {
      const totalRevenue = await analyticsRepository.getTotalRevenue({
        academicYear,
      });
      const totalDues = await analyticsRepository.getTotalDues({ academicYear });
      const paymentTrends = await analyticsRepository.getPaymentTrends(
        academicYear
      );
      const classWiseCollection =
        await analyticsRepository.getClassWiseCollection(academicYear);
      const paymentMethods =
        await analyticsRepository.getPaymentMethodStats(academicYear);

      return {
        success: true,
        data: {
          totalRevenue,
          totalDues,
          collectionPercentage: totalRevenue && totalDues
            ? ((totalRevenue / (totalRevenue + totalDues)) * 100).toFixed(2)
            : 0,
          paymentTrends,
          classWiseCollection,
          paymentMethods,
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch analytics: ${error.message}`);
    }
  }

  // === EXPORT FUNCTIONS ===

  async exportPaymentsCSV(academicYear) {
    try {
      const payments = await Payment.find({
        academicYear,
        status: "completed",
      }).sort("-paymentDate");

      let csv = "Receipt No,Student Name,Admission No,Amount,Method,Date\n";
      payments.forEach((payment) => {
        csv += `${payment.receiptNumber},"${payment.studentName}",${payment.admissionNumber},${payment.amount},${payment.paymentMethod},"${payment.paymentDate.toLocaleDateString()}"\n`;
      });

      return { success: true, data: csv };
    } catch (error) {
      throw new Error(`Failed to export payments: ${error.message}`);
    }
  }
}

export const feeService = new FeeService();
