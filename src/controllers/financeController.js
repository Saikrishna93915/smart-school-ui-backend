// src/controllers/financeController.js - COMPLETELY REWRITTEN WITH PROPER PAYMENT LOGIC
import asyncHandler from "../utils/asyncHandler.js";
import Payment from "../models/Payment.js";
import FeeStructure from "../models/FeeStructure.js";
import Receipt from "../models/Receipt.js";
import Student from "../models/Student.js";
import mongoose from "mongoose";
import crypto from "crypto";
import { convertToWords } from "../utils/numberToWords.js";
import { getConfig, getSchoolName, getConfigsByCategory } from "../services/configService.js";

const normalizeReceiptNumber = (value = '') => {
  let normalized = decodeURIComponent(String(value)).trim();

  if (normalized.length % 2 === 0) {
    const half = normalized.length / 2;
    if (normalized.slice(0, half) === normalized.slice(half)) {
      normalized = normalized.slice(0, half);
    }
  }

  const standardMatch = normalized.match(/(REC-\d+-\d+|CREDIT-\d+-\d+|INST-\d+-\d+)/i);
  if (standardMatch?.[1]) {
    return standardMatch[1];
  }

  return normalized;
};

// @desc    Search students for payment
// @route   GET /api/finance/students/search
// @access  Private (Admin/Finance)
export const searchStudents = asyncHandler(async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(200).json({
        success: true,
        students: [],
      });
    }

    const escapedQuery = String(query).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const normalizedSpaceRegex = escapedQuery.replace(/\s+/g, "\\s+");

    const students = await Student.find({
      status: "active",
      $or: [
        { "student.firstName": { $regex: escapedQuery, $options: "i" } },
        { "student.lastName": { $regex: escapedQuery, $options: "i" } },
        {
          $expr: {
            $regexMatch: {
              input: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ["$student.firstName", ""] },
                      " ",
                      { $ifNull: ["$student.lastName", ""] },
                    ],
                  },
                },
              },
              regex: normalizedSpaceRegex,
              options: "i",
            },
          },
        },
        {
          $expr: {
            $regexMatch: {
              input: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ["$student.lastName", ""] },
                      " ",
                      { $ifNull: ["$student.firstName", ""] },
                    ],
                  },
                },
              },
              regex: normalizedSpaceRegex,
              options: "i",
            },
          },
        },
        { admissionNumber: { $regex: escapedQuery, $options: "i" } },
        { "class.className": { $regex: escapedQuery, $options: "i" } },
        { "parents.father.name": { $regex: escapedQuery, $options: "i" } },
        { "parents.mother.name": { $regex: escapedQuery, $options: "i" } },
        { "parents.father.phone": { $regex: escapedQuery, $options: "i" } },
      ],
    })
      .select("_id admissionNumber student class parents transport")
      .limit(20);

    res.status(200).json({
      success: true,
      students,
    });
  } catch (error) {
    console.error("Search students error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get student fee details - IMPROVED VERSION
// @route   GET /api/finance/students/:admissionNumber/fee-details
// @access  Private (Admin/Finance)
export const getStudentFeeDetails = asyncHandler(async (req, res) => {
  try {
    const { admissionNumber } = req.params;

    console.log(`🎯 Fetching fee details for: ${admissionNumber}`);

    // 1. Find student
    const student = await Student.findOne({ admissionNumber });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    console.log(`✅ Student: ${student.student.firstName} ${student.student.lastName}`);

    // 2. Get payments using direct MongoDB
    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');
    const feeStructureCollection = db.collection('feestructures');

    // Existing fee structure may already carry due/paid totals even when installments are absent.
    let feeStructure = await feeStructureCollection.findOne({
      admissionNumber: admissionNumber
    });
    
    // Get all payments, sorted by type (fee installments first, then receipts)
    const rawPayments = await paymentsCollection.find({ 
      admissionNumber: admissionNumber 
    }).sort({ paymentType: 1, createdAt: 1 }).toArray();

    console.log(`💰 Found ${rawPayments.length} payment record(s)`);

    // 3. Calculate CORRECT totals
    let totalFeeAmount = 0;    // Total fee assigned
    let totalPaidAmount = 0;   // Total amount paid
    let totalDueAmount = 0;    // Total still due
    
    // Separate fee installments from receipts
    const feeInstallments = rawPayments.filter(p => p.paymentType === 'installment' || !p.paymentType);
    const paymentReceipts = rawPayments.filter(p => p.paymentType === 'receipt');
    const creditNotes = rawPayments.filter(p => p.paymentType === 'credit');

    console.log(`📊 Breakdown: ${feeInstallments.length} installments, ${paymentReceipts.length} receipts, ${creditNotes.length} credits`);

    const toNumber = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    };

    // Calculate from fee installments only
    feeInstallments.forEach((payment, index) => {
      const amount = toNumber(payment.totalAmount || payment.amount);
      const paid = toNumber(payment.paidAmount);
      const due = toNumber(payment.dueAmount);
      
      console.log(`   Installment ${index + 1}: Total=₹${amount}, Paid=₹${paid}, Due=₹${due}, Status=${payment.status}`);
      
      totalFeeAmount += amount;
      totalPaidAmount += paid;
      totalDueAmount += due;
    });

    console.log(`📊 Totals: Fee=₹${totalFeeAmount}, Paid=₹${totalPaidAmount}, Due=₹${totalDueAmount}`);

    // If installment records are absent but fee structure exists, use fee structure totals.
    if (feeInstallments.length === 0 && feeStructure) {
      totalFeeAmount = toNumber(feeStructure.totalFee);
      totalPaidAmount = toNumber(feeStructure.totalPaid);
      totalDueAmount = toNumber(feeStructure.totalDue);
      console.log(`📌 Using FeeStructure totals (no installments): Fee=₹${totalFeeAmount}, Paid=₹${totalPaidAmount}, Due=₹${totalDueAmount}`);
    }

    // 4. Get or create fee structure

    if (!feeStructure) {
      console.log(`📝 Creating new fee structure from data`);

      const className = student.class?.className || '';
      const classNameParts = className.split('-');
      const cleanClassName = classNameParts[0] || className;
      const defaultSection = await getConfig('academic.defaultSection', 'A');
      const section = classNameParts[1] || student.class?.section || defaultSection;
      
      feeStructure = {
        admissionNumber: student.admissionNumber,
        studentId: student._id,
        studentName: `${student.student.firstName} ${student.student.lastName}`,
        className: cleanClassName,
        section: section,
        academicYear: new Date().getFullYear().toString(),
        totalFee: totalFeeAmount,
        totalPaid: totalPaidAmount,
        totalDue: totalDueAmount,
        feeComponents: feeInstallments.map(payment => ({
          componentName: payment.componentName || 'Annual Fee',
          amount: payment.totalAmount || 0,
          paidAmount: payment.paidAmount || 0,
          dueAmount: payment.dueAmount || 0,
          status: payment.status || 'pending',
          dueDate: payment.dueDate || payment.createdAt,
          paymentId: payment._id.toString()
        })),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await feeStructureCollection.insertOne(feeStructure);
    }

    // 5. Format due payments for response
    let duePayments = feeInstallments
      .filter(p => toNumber(p.dueAmount) > 0)
      .map(payment => ({
        _id: payment._id.toString(),
        componentName: payment.componentName || 'Annual Fee',
        totalAmount: toNumber(payment.totalAmount || payment.amount),
        paidAmount: toNumber(payment.paidAmount),
        dueAmount: toNumber(payment.dueAmount),
        dueDate: payment.dueDate || payment.createdAt,
        status: payment.status || 'pending'
      }));

    // Fallback: use fee structure components when no installment records are present.
    if (duePayments.length === 0 && feeInstallments.length === 0 && feeStructure?.feeComponents?.length) {
      duePayments = feeStructure.feeComponents
        .map((component, index) => {
          const componentAmount = toNumber(component.amount);
          const componentPaid = toNumber(component.paidAmount);
          const componentDue = component.dueAmount !== undefined
            ? toNumber(component.dueAmount)
            : Math.max(0, componentAmount - componentPaid);

          return {
            _id: `FEECOMP-${index}`,
            componentName: component.componentName || `Fee Component ${index + 1}`,
            totalAmount: componentAmount,
            paidAmount: componentPaid,
            dueAmount: componentDue,
            dueDate: component.dueDate || feeStructure.updatedAt || feeStructure.createdAt,
            status: component.status || (componentDue > 0 ? 'pending' : 'completed')
          };
        })
        .filter(component => component.dueAmount > 0);
    }

    // 6. Format payment history (receipts only)
    const paymentHistory = paymentReceipts.map(payment => ({
      _id: payment._id.toString(),
      receiptNumber: payment.receiptNumber,
      paymentDate: payment.paymentDate || payment.createdAt,
      amount: payment.amount || 0,
      netAmount: payment.netAmount || payment.amount || 0,
      paymentMethod: payment.paymentMethod || 'cash',
      status: payment.status || 'completed',
      appliedToPayments: payment.appliedToPayments || []
    }));

    // 7. Check for available credit
    const availableCredit = creditNotes.reduce((sum, credit) => sum + (credit.creditAmount || 0), 0);

    // 8. Prepare FINAL response
    const response = {
      success: true,
      student: {
        _id: student._id,
        admissionNumber: student.admissionNumber,
        name: `${student.student.firstName} ${student.student.lastName}`,
        class: student.class,
        parents: student.parents,
        transport: student.transport || "no",
      },
      feeStructure: feeStructure,
      duePayments: duePayments,
      paymentHistory: paymentHistory,
      summary: {
        totalFee: totalFeeAmount,
        totalPaid: totalPaidAmount,
        totalDue: totalDueAmount,
        availableCredit: availableCredit,
        feeInstallmentsCount: feeInstallments.length,
        receiptCount: paymentReceipts.length,
        duePaymentsCount: duePayments.length
      }
    };

    console.log(`🎉 SUCCESS! Fee: ₹${totalFeeAmount}, Paid: ₹${totalPaidAmount}, Due: ₹${totalDueAmount}`);
    
    res.status(200).json(response);

  } catch (error) {
    console.error("Get student fee details error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Record a new payment - COMPLETELY REWRITTEN WITH PROPER LOGIC
// @route   POST /api/finance/payments/record
// @access  Private (Admin/Finance)
export const recordPayment = asyncHandler(async (req, res) => {
  try {
    console.log("📝 Record payment request received:", req.body);
    
    const {
      admissionNumber,
      paymentDate,
      paymentMethod,
      referenceNo,
      transactionId,
      bankName,
      chequeNo,
      chequeDate,
      utrNo,
      upiId,
      amount,
      discount,
      discountReason,
      lateFee,
      lateFeeReason,
      netAmount,
      description,
      feesPaid,
      sendReceipt,
      sendSMS,
      sendEmail,
    } = req.body;

    // Validate required fields
    if (!admissionNumber || !amount) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing: admissionNumber, amount",
      });
    }

    // Get student details
    const student = await Student.findOne({ admissionNumber });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    console.log("✅ Student found:", student._id);

    // Parse class info
    const className = student.class?.className || 'Unknown';
    const section = student.class?.section || 'A';

    // SECURITY: Generate unique receipt number using crypto UUID instead of Math.random
    const timestamp = Date.now();
    const uniqueId = crypto.randomUUID().split('-')[0]; // First 8 chars of UUID
    const receiptNumber = `REC-${timestamp}-${uniqueId}`;

    console.log("📄 Generated receipt number:", receiptNumber);

    // Calculate net amount
    const paymentAmount = parseFloat(amount);
    const discountAmount = parseFloat(discount || 0);
    const lateFeeAmount = parseFloat(lateFee || 0);
    const calculatedNetAmount = netAmount || (paymentAmount - discountAmount + lateFeeAmount);

    // ==============================================
    // **CRITICAL PART: Process payment against existing dues**
    // ==============================================
    
    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');
    
    console.log("🔍 Checking for existing due payments...");
    
    // Get all due payments (installments with due > 0)
    const duePayments = await paymentsCollection.find({
      admissionNumber: admissionNumber,
      paymentType: { $in: ['installment', undefined] }, // Include old records without type
      $or: [
        { dueAmount: { $gt: 0 } },
        { status: { $in: ['pending', 'partial', 'due'] } }
      ]
    }).sort({ createdAt: 1, dueDate: 1 }).toArray(); // Oldest first

    console.log(`📊 Found ${duePayments.length} due payments to process`);
    
    let remainingAmount = calculatedNetAmount;
    let appliedToPayments = [];
    let processedPaymentIds = [];
    let usedFeeStructureFallback = false;

    // Apply payment to due payments (FIFO - First In First Out)
    for (const duePayment of duePayments) {
      if (remainingAmount <= 0) break;
      
      const paymentId = duePayment._id;
      const totalAmount = duePayment.totalAmount || duePayment.amount || 0;
      const currentPaid = duePayment.paidAmount || 0;
      const currentDue = duePayment.dueAmount || (totalAmount - currentPaid);
      
      if (currentDue <= 0) continue; // Skip already paid payments
      
      const amountToApply = Math.min(remainingAmount, currentDue);
      const newPaidAmount = currentPaid + amountToApply;
      const newDueAmount = Math.max(0, totalAmount - newPaidAmount);
      const newStatus = newDueAmount === 0 ? 'completed' : 
                       (newPaidAmount > 0 ? 'partial' : 'pending');
      
      // Update the due payment record
      await paymentsCollection.updateOne(
        { _id: paymentId },
        {
          $set: {
            paidAmount: newPaidAmount,
            dueAmount: newDueAmount,
            status: newStatus,
            updatedAt: new Date(),
            lastPaymentDate: new Date(),
            lastPaymentReceipt: receiptNumber
          },
          $push: {
            paymentHistory: {
              receiptNumber: receiptNumber,
              amount: amountToApply,
              date: new Date(),
              paymentMethod: paymentMethod || 'cash'
            }
          }
        }
      );
      
      remainingAmount -= amountToApply;
      appliedToPayments.push({
        paymentId: paymentId.toString(),
        componentName: duePayment.componentName || 'Fee Installment',
        originalDue: currentDue,
        amountApplied: amountToApply,
        newDue: newDueAmount,
        status: newStatus
      });
      
      processedPaymentIds.push(paymentId.toString());
      
      console.log(`✅ Applied ₹${amountToApply} to payment ${paymentId}. New due: ₹${newDueAmount}`);
    }

    // Fallback path: if no installment-level dues exist, apply payment directly on fee structure due.
    if (appliedToPayments.length === 0 && remainingAmount > 0) {
      const feeStructureCollection = db.collection('feestructures');
      const feeStructure = await feeStructureCollection.findOne({ admissionNumber });

      if (feeStructure && Number(feeStructure.totalDue || 0) > 0) {
        const structureDue = Number(feeStructure.totalDue || 0);
        const structurePaid = Number(feeStructure.totalPaid || 0);
        const structureTotal = Number(feeStructure.totalFee || 0);

        const amountToApply = Math.min(remainingAmount, structureDue);
        const newDue = Math.max(0, structureDue - amountToApply);
        const newPaid = structurePaid + amountToApply;

        await feeStructureCollection.updateOne(
          { _id: feeStructure._id },
          {
            $set: {
              totalPaid: newPaid,
              totalDue: newDue,
              overallStatus: newDue === 0 ? 'paid' : 'pending',
              updatedAt: new Date(),
            },
          }
        );

        appliedToPayments.push({
          paymentId: `FEESTRUCTURE:${feeStructure._id.toString()}`,
          componentName: 'Outstanding Fee Balance',
          originalDue: structureDue,
          amountApplied: amountToApply,
          newDue,
          status: newDue === 0 ? 'completed' : 'partial',
        });

        processedPaymentIds.push(`FEESTRUCTURE:${feeStructure._id.toString()}`);
        remainingAmount -= amountToApply;
        usedFeeStructureFallback = true;

        console.log(`✅ Applied ₹${amountToApply} to FeeStructure due. New due: ₹${newDue}, totalFee: ₹${structureTotal}`);
      }
    }

    // ==============================================
    // **Handle remaining amount (overpayment)**
    // ==============================================
    let creditNote = null;
    if (remainingAmount > 0) {
      console.log(`💰 Remaining amount after paying dues: ₹${remainingAmount}`);
      
      // Create a credit note for future payments
      const creditNoteNumber = `CREDIT-${timestamp}-${random}`;
      creditNote = {
        receiptNumber: creditNoteNumber,
        admissionNumber: admissionNumber,
        studentId: student._id,
        studentName: `${student.student.firstName} ${student.student.lastName}`,
        className: className,
        section: section,
        parentName: student.parents.father.name,
        parentPhone: student.parents.father.phone,
        parentEmail: student.parents.father.email || undefined,
        
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentMethod: paymentMethod || "cash",
        
        amount: 0, // Credit notes don't have amount
        totalAmount: 0,
        paidAmount: 0,
        dueAmount: 0,
        
        creditAmount: remainingAmount,
        creditReason: 'Overpayment',
        originalReceipt: receiptNumber,
        
        description: `Credit from payment ${receiptNumber}`,
        status: 'active',
        paymentType: 'credit',
        
        recordedBy: req.user._id,
        recordedByName: req.user.name || req.user.username || "System",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await paymentsCollection.insertOne(creditNote);
      console.log(`💳 Created credit note ${creditNoteNumber}: ₹${remainingAmount}`);
    }

    // ==============================================
    // **Create the payment receipt record**
    // ==============================================
    const receiptData = {
      receiptNumber,
      admissionNumber,
      studentId: student._id,
      studentName: `${student.student.firstName} ${student.student.lastName}`,
      className,
      section,
      parentName: student.parents.father.name,
      parentPhone: student.parents.father.phone,
      parentEmail: student.parents.father.email || undefined,

      // Payment details
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMethod: paymentMethod || "cash",
      referenceNo: referenceNo || undefined,
      transactionId: transactionId || undefined,
      bankName: bankName || undefined,
      chequeNo: chequeNo || undefined,
      chequeDate: chequeDate ? new Date(chequeDate) : undefined,
      utrNo: utrNo || undefined,
      upiId: upiId || undefined,

      // Amount details
      amount: paymentAmount,
      totalAmount: paymentAmount,
      paidAmount: paymentAmount, // Full amount was paid
      dueAmount: 0, // No due for receipt
      
      discount: discountAmount,
      discountReason: discountReason || undefined,
      lateFee: lateFeeAmount,
      lateFeeReason: lateFeeReason || undefined,
      netAmount: calculatedNetAmount,

      // Payment allocation
      appliedToPayments: appliedToPayments,
      processedPaymentIds: processedPaymentIds,
      creditNoteCreated: creditNote ? creditNote.receiptNumber : null,
      remainingAmount: remainingAmount, // For credit note
      
      feesPaid: feesPaid || [],
      description: description || `Payment for ${appliedToPayments.length} due payment(s)`,

      // Receipt settings
      sendReceipt: sendReceipt !== undefined ? sendReceipt : true,
      sendSMS: sendSMS !== undefined ? sendSMS : true,
      sendEmail: sendEmail !== undefined ? sendEmail : true,
      printed: false,

      // Metadata
      recordedBy: req.user._id,
      recordedByName: req.user.name || req.user.username || "System",
      
      // Cashier Information (who collected the payment)
      collectedBy: req.user._id,
      cashierName: req.user.name || "Unknown",
      cashierId: req.user.employeeId || req.user._id.toString(),
      
      status: 'completed',
      paymentType: 'receipt', // This is a receipt, not a fee installment
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log("💾 Saving payment receipt...");
    
    // Save the receipt
    const result = await paymentsCollection.insertOne(receiptData);
    const paymentId = result.insertedId;
    
    console.log("✅ Payment receipt saved:", paymentId);
    
    const payment = { ...receiptData, _id: paymentId };

    // Recalculate from installments only when installment records exist.
    if (!usedFeeStructureFallback) {
      await updateFeeStructure(payment);
    }

    // Generate receipt document
    const receipt = await generateReceipt(payment);

    // Send notifications if enabled
    if (sendEmail && student.parents.father.email) {
      await simulateEmailReceipt(receipt, student.parents.father.email);
    }
    if (sendSMS && student.parents.father.phone) {
      await simulateSMSNotification(receipt, student.parents.father.phone);
    }

    console.log("✅ Payment process completed successfully");

    return res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: {
        payment,
        receipt,
        appliedToPayments: appliedToPayments,
        creditNote: creditNote,
        summary: {
          totalAmount: paymentAmount,
          amountApplied: paymentAmount - remainingAmount,
          creditCreated: remainingAmount,
          paymentsUpdated: appliedToPayments.length
        }
      },
    });

  } catch (error) {
    console.error("❌ Record payment error:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate receipt number. Please try again.",
      });
    }
    
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to record payment",
    });
  }
});

// @desc    Create a fee installment (for initial fee assignment)
// @route   POST /api/finance/payments/create-installment
// @access  Private (Admin/Finance)
export const createFeeInstallment = asyncHandler(async (req, res) => {
  try {
    const {
      admissionNumber,
      componentName,
      totalAmount,
      dueDate,
      academicYear,
      description
    } = req.body;

    // Validate
    if (!admissionNumber || !componentName || !totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing: admissionNumber, componentName, totalAmount",
      });
    }

    // Get student
    const student = await Student.findOne({ admissionNumber });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const className = student.class?.className || 'Unknown';
    const section = student.class?.section || 'A';

    // SECURITY: Generate installment ID using crypto UUID instead of Math.random
    const installmentNumber = `INST-${Date.now()}-${crypto.randomUUID().split('-')[0]}`;

    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');

    const installmentData = {
      installmentNumber,
      admissionNumber,
      studentId: student._id,
      studentName: `${student.student.firstName} ${student.student.lastName}`,
      className,
      section,
      parentName: student.parents.father.name,
      parentPhone: student.parents.father.phone,

      componentName,
      totalAmount: parseFloat(totalAmount),
      paidAmount: 0,
      dueAmount: parseFloat(totalAmount),
      
      dueDate: dueDate ? new Date(dueDate) : new Date(),
      academicYear: academicYear || new Date().getFullYear().toString(),
      description: description || `${componentName} installment`,
      
      status: 'pending',
      paymentType: 'installment',
      
      recordedBy: req.user._id,
      recordedByName: req.user.name || req.user.username || "System",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await paymentsCollection.insertOne(installmentData);
    const installmentId = result.insertedId;

    // Update fee structure
    await updateFeeStructure({
      admissionNumber,
      studentId: student._id,
      studentName: `${student.student.firstName} ${student.student.lastName}`,
      className,
      section,
      totalAmount: parseFloat(totalAmount),
      paidAmount: 0,
      dueAmount: parseFloat(totalAmount)
    });

    console.log("✅ Fee installment created:", installmentNumber);

    res.status(201).json({
      success: true,
      message: "Fee installment created successfully",
      data: {
        installment: { ...installmentData, _id: installmentId }
      }
    });

  } catch (error) {
    console.error("Create fee installment error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get payment by receipt number
// @route   GET /api/finance/payments/receipt/:receiptNumber
// @access  Private (Admin/Finance)
export const getPaymentByReceipt = asyncHandler(async (req, res) => {
  try {
    const receiptNumber = normalizeReceiptNumber(req.params.receiptNumber);

    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');
    
    const payment = await paymentsCollection.findOne({ receiptNumber });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Get student details
    const student = await Student.findById(payment.studentId)
      .select("admissionNumber student class parents");

    // Get receipt
    const receipt = await Receipt.findOne({ receiptNumber });

    // If payment was applied to other payments, get their details
    let appliedPaymentsDetails = [];
    if (payment.appliedToPayments && payment.appliedToPayments.length > 0) {
      const appliedIds = payment.appliedToPayments.map(p => new mongoose.Types.ObjectId(p.paymentId));
      appliedPaymentsDetails = await paymentsCollection.find({
        _id: { $in: appliedIds }
      }).toArray();
    }

    res.status(200).json({
      success: true,
      payment: {
        ...payment,
        _id: payment._id.toString(),
        student: student
      },
      receipt,
      appliedPaymentsDetails: appliedPaymentsDetails.map(p => ({
        _id: p._id.toString(),
        componentName: p.componentName,
        amountApplied: payment.appliedToPayments?.find(ap => ap.paymentId === p._id.toString())?.amountApplied || 0
      }))
    });
  } catch (error) {
    console.error("Get payment by receipt error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get all payments with filters
// @route   GET /api/finance/payments
// @access  Private (Admin/Finance)
export const getAllPayments = asyncHandler(async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      paymentMethod,
      className,
      status,
      paymentType,
      admissionNumber,
      page = 1,
      limit = 20,
    } = req.query;

    // Build filter
    const filter = {};

    // Date filter
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    // Other filters
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (className) filter.className = className;
    if (status) filter.status = status;
    if (paymentType) filter.paymentType = paymentType;
    if (admissionNumber) filter.admissionNumber = admissionNumber;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');
    
    const payments = await paymentsCollection.find(filter)
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await paymentsCollection.countDocuments(filter);

    // Format response
    const formattedPayments = payments.map(payment => ({
      _id: payment._id.toString(),
      receiptNumber: payment.receiptNumber,
      studentName: payment.studentName,
      admissionNumber: payment.admissionNumber,
      className: payment.className,
      section: payment.section,
      paymentDate: payment.paymentDate,
      amount: payment.amount,
      netAmount: payment.netAmount,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      paymentType: payment.paymentType || 'receipt',
      totalAmount: payment.totalAmount || payment.amount,
      paidAmount: payment.paidAmount || 0,
      dueAmount: payment.dueAmount || 0
    }));

    res.status(200).json({
      success: true,
      payments: formattedPayments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get all payments error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get payment summary for dashboard
// @route   GET /api/finance/payments/summary
// @access  Private (Admin/Finance)
export const getPaymentSummary = asyncHandler(async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');

    // Today's receipts (actual payments)
    const todayPayments = await paymentsCollection.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfDay },
          status: "completed",
          paymentType: "receipt"
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    // This month's receipts
    const monthPayments = await paymentsCollection.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfMonth },
          status: "completed",
          paymentType: "receipt"
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    // Total outstanding (due payments)
    const totalOutstanding = await paymentsCollection.aggregate([
      {
        $match: {
          paymentType: { $in: ['installment', undefined] },
          dueAmount: { $gt: 0 }
        },
      },
      {
        $group: {
          _id: null,
          totalDue: { $sum: "$dueAmount" },
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    // Payment methods breakdown
    const methodBreakdown = await paymentsCollection.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfMonth },
          status: "completed",
          paymentType: "receipt"
        },
      },
      {
        $group: {
          _id: "$paymentMethod",
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]).toArray();

    // Class-wise collection
    const classBreakdown = await paymentsCollection.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfMonth },
          status: "completed",
          paymentType: "receipt"
        },
      },
      {
        $group: {
          _id: "$className",
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]).toArray();

    res.status(200).json({
      success: true,
      today: {
        totalAmount: todayPayments[0]?.totalAmount || 0,
        count: todayPayments[0]?.count || 0,
      },
      thisMonth: {
        totalAmount: monthPayments[0]?.totalAmount || 0,
        count: monthPayments[0]?.count || 0,
      },
      outstanding: {
        totalDue: totalOutstanding[0]?.totalDue || 0,
        count: totalOutstanding[0]?.count || 0,
      },
      methodBreakdown,
      classBreakdown,
    });
  } catch (error) {
    console.error("Get payment summary error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Fix payment calculations for a student
// @route   POST /api/finance/payments/fix-student/:admissionNumber
// @access  Private (Admin/Finance)
export const fixStudentPayments = asyncHandler(async (req, res) => {
  try {
    const { admissionNumber } = req.params;
    
    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');
    
    // Get all payments for this student
    const allPayments = await paymentsCollection.find({
      admissionNumber: admissionNumber
    }).sort({ createdAt: 1 }).toArray();
    
    console.log(`🔧 Fixing ${allPayments.length} payments for ${admissionNumber}`);
    
    let corrections = [];
    
    // Fix each payment record
    for (const payment of allPayments) {
      const originalAmount = payment.totalAmount || payment.amount || 0;
      const originalPaid = payment.paidAmount || 0;
      const originalDue = payment.dueAmount || 0;
      
      // Determine payment type if not set
      let paymentType = payment.paymentType;
      if (!paymentType) {
        paymentType = payment.receiptNumber?.startsWith('REC-') ? 'receipt' : 
                     payment.receiptNumber?.startsWith('INST-') ? 'installment' :
                     payment.receiptNumber?.startsWith('CREDIT-') ? 'credit' :
                     'installment'; // default
      }
      
      let newDue = originalDue;
      let newStatus = payment.status;
      
      if (paymentType === 'receipt') {
        // Receipts should have dueAmount = 0
        newDue = 0;
        newStatus = 'completed';
      } else if (paymentType === 'installment') {
        // Installments: due = total - paid
        newDue = Math.max(0, originalAmount - originalPaid);
        newStatus = newDue === 0 ? 'completed' : 
                   (originalPaid > 0 ? 'partial' : 'pending');
      } else if (paymentType === 'credit') {
        // Credits: no due
        newDue = 0;
        newStatus = 'active';
      }
      
      // Update if needed
      if (payment.dueAmount !== newDue || payment.status !== newStatus || payment.paymentType !== paymentType) {
        await paymentsCollection.updateOne(
          { _id: payment._id },
          {
            $set: {
              dueAmount: newDue,
              status: newStatus,
              paymentType: paymentType,
              updatedAt: new Date()
            }
          }
        );
        
        corrections.push({
          paymentId: payment._id.toString(),
          receiptNumber: payment.receiptNumber,
          action: 'Recalculated',
          oldDue: originalDue,
          newDue: newDue,
          oldStatus: payment.status,
          newStatus: newStatus,
          paymentType: paymentType
        });
      }
    }
    
    // Recalculate fee structure
    const student = await Student.findOne({ admissionNumber });
    if (student) {
      await updateFeeStructure({
        admissionNumber,
        studentId: student._id,
        studentName: `${student.student.firstName} ${student.student.lastName}`,
        className: student.class?.className || 'Unknown',
        section: student.class?.section || 'A'
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Fixed ${corrections.length} payment records`,
      corrections: corrections
    });
    
  } catch (error) {
    console.error("Fix student payments error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

// Helper function to update fee structure with correct totals
const updateFeeStructure = async (paymentData) => {
  try {
    const { admissionNumber, studentId, studentName, className, section } = paymentData;
    
    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');
    const feeStructureCollection = db.collection('feestructures');
    
    // Get all installment payments for this student
    const installmentPayments = await paymentsCollection.find({
      admissionNumber: admissionNumber,
      paymentType: { $in: ['installment', undefined] }
    }).toArray();

    const existingFeeStructure = await feeStructureCollection.findOne({
      admissionNumber: admissionNumber,
    });

    // If no installment rows exist, preserve existing fee structure totals.
    if (installmentPayments.length === 0 && existingFeeStructure) {
      await feeStructureCollection.updateOne(
        { _id: existingFeeStructure._id },
        { $set: { updatedAt: new Date() } }
      );
      return existingFeeStructure;
    }
    
    // Calculate totals from installments only
    let totalFee = 0;
    let totalPaid = 0;
    let totalDue = 0;
    
    installmentPayments.forEach(payment => {
      totalFee += payment.totalAmount || payment.amount || 0;
      totalPaid += payment.paidAmount || 0;
      totalDue += payment.dueAmount || 0;
    });
    
    // Parse class name
    const classNameParts = (className || '').split('-');
    const cleanClassName = classNameParts[0] || className || 'Unknown';
    const cleanSection = classNameParts[1] || section || 'A';
    
    // Find or create fee structure
    let feeStructure = existingFeeStructure;
    
    const feeStructureData = {
      admissionNumber: admissionNumber,
      studentId: studentId,
      studentName: studentName,
      className: cleanClassName,
      section: cleanSection,
      academicYear: new Date().getFullYear().toString(),
      totalFee: totalFee,
      totalPaid: totalPaid,
      totalDue: totalDue,
      feeComponents: installmentPayments.map(payment => ({
        paymentId: payment._id.toString(),
        componentName: payment.componentName || 'Fee Installment',
        amount: payment.totalAmount || payment.amount || 0,
        paidAmount: payment.paidAmount || 0,
        dueAmount: payment.dueAmount || 0,
        status: payment.status || 'pending',
        dueDate: payment.dueDate || payment.createdAt
      })),
      updatedAt: new Date()
    };
    
    if (feeStructure) {
      await feeStructureCollection.updateOne(
        { _id: feeStructure._id },
        { $set: feeStructureData }
      );
      console.log("✅ Fee structure updated");
    } else {
      feeStructureData.createdAt = new Date();
      await feeStructureCollection.insertOne(feeStructureData);
      console.log("✅ Fee structure created");
    }
    
    return feeStructureData;
  } catch (error) {
    console.error("Error updating fee structure:", error.message);
    throw error;
  }
};

// Helper function to generate receipt
const generateReceipt = async (payment) => {
  try {
    const amountInWords = convertToWords(payment.netAmount || payment.amount || 0);

    const receiptData = {
      receiptNumber: payment.receiptNumber,
      paymentId: payment._id,

      studentDetails: {
        name: payment.studentName,
        admissionNumber: payment.admissionNumber,
        className: payment.className,
        section: payment.section,
        parentName: payment.parentName,
        parentPhone: payment.parentPhone,
        parentEmail: payment.parentEmail,
      },

      paymentDetails: {
        date: payment.paymentDate,
        method: payment.paymentMethod,
        reference: payment.referenceNo,
        bankName: payment.bankName,
        chequeNo: payment.chequeNo,
        transactionId: payment.transactionId,
      },

      amountDetails: {
        totalAmount: payment.amount,
        discount: payment.discount,
        discountReason: payment.discountReason,
        lateFee: payment.lateFee,
        lateFeeReason: payment.lateFeeReason,
        netAmount: payment.netAmount || payment.amount,
        amountInWords: amountInWords,
      },

      feesBreakdown: payment.feesPaid || [],
      appliedPayments: payment.appliedToPayments || [],
      
      schoolDetails: {
        name: "PMC Tech School",
        address: "Hosur - Krishnagiri Highways, Nallaganakothapalli, Near Koneripalli (PO), Hosur, Krishnagiri District, Tamil Nadu - 635 117",
        phone: "+91 XXXXXXXXXX",
        email: "office@pmctechschool.com",
      },
      
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const receipt = await Receipt.create(receiptData);
    
    console.log("✅ Receipt generated:", receipt.receiptNumber);
    return receipt;
  } catch (error) {
    console.error("Error generating receipt:", error.message);
    // Return minimal receipt object
    return {
      receiptNumber: payment.receiptNumber,
      paymentId: payment._id,
      studentDetails: {
        name: payment.studentName,
        admissionNumber: payment.admissionNumber,
      },
      _id: new mongoose.Types.ObjectId(),
    };
  }
};

// Helper function to simulate email receipt
const simulateEmailReceipt = async (receipt, email) => {
  if (!email) return;
  
  console.log(`📧 Email receipt sent to ${email} for receipt ${receipt.receiptNumber}`);

  try {
    if (receipt && receipt.save) {
      receipt.emailed = true;
      receipt.emailedAt = new Date();
      receipt.emailTo = email;
      await receipt.save();
    }
  } catch (error) {
    console.error("Error updating email status:", error.message);
  }
};

// Helper function to simulate SMS notification
const simulateSMSNotification = async (receipt, phone) => {
  if (!phone) return;
  
  console.log(`📱 SMS sent to ${phone} for receipt ${receipt.receiptNumber}`);

  try {
    if (receipt && receipt.save) {
      receipt.smsSent = true;
      receipt.smsSentAt = new Date();
      receipt.smsTo = phone;
      await receipt.save();
    }
  } catch (error) {
    console.error("Error updating SMS status:", error.message);
  }
};