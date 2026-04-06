// controllers/paymentController.js - Payment Recording & Management
import Payment from '../models/Payment.js';
import Student from '../models/Student.js';
import FeeStructure from '../models/FeeStructure.js';
import Receipt from '../models/Receipt.js';
import Cashier from '../models/Cashier.js';
import ShiftSession from '../models/ShiftSession.js';
import asyncHandler from '../utils/asyncHandler.js';
import mongoose from 'mongoose';
import {
  applyPaymentToFeeStructure,
  reversePaymentFromFeeStructure,
  addPaymentToShift,
  reversePaymentFromShift,
  getOpenShiftForCashier,
} from '../services/cashierAccountingService.js';

// ==================== PAYMENT VALIDATION HELPERS ====================

/**
 * Validate payment method-specific required fields and formats
 * UTR/Transaction Reference is MANDATORY for ALL payment methods EXCEPT cash
 * Transaction ID is MANDATORY for UPI, Card, and Online payments
 */
function validatePaymentMethodDetails(method, body) {
  const errors = [];

  // Cash payments: No reference number required
  if (method === 'cash') {
    return null;
  }

  // ALL non-cash payments require UTR/Transaction Reference (12-35 chars)
  if (!body.utrNo || body.utrNo.trim() === '') {
    errors.push('Transaction Reference Number (UTR/RRN) is required for all non-cash payments');
  } else if (!/^[A-Za-z0-9]{12,35}$/.test(body.utrNo.trim())) {
    errors.push('Transaction Reference Number must be 12-35 alphanumeric characters');
  }

  // Payment method-specific validations
  switch (method) {
    case 'upi':
      // UPI requires BOTH UTR (from bank) + Transaction ID (from app)
      if (!body.transactionId || body.transactionId.trim() === '') {
        errors.push('Transaction ID (App Reference) is required for UPI payments');
      } else if (!/^[A-Za-z0-9]{12,35}$/.test(body.transactionId.trim())) {
        errors.push('Transaction ID must be 12-35 alphanumeric characters');
      }

      if (!body.upiId || body.upiId.trim() === '') {
        errors.push('UPI ID is required for UPI payments');
      } else if (!/^[\w.-]+@[\w]+$/.test(body.upiId)) {
        errors.push('Invalid UPI ID format. Example: username@paytm or 9876543210@paytm');
      }
      break;

    case 'bank-transfer':
      if (!body.bankName || body.bankName.trim() === '') {
        errors.push('Bank name is required for bank transfer payments');
      } else if (!/^[a-zA-Z\s]{2,50}$/.test(body.bankName.trim())) {
        errors.push('Bank name must be 2-50 alphabetic characters');
      }

      if (!body.ifscCode || body.ifscCode.trim() === '') {
        errors.push('IFSC code is required for bank transfer payments');
      } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(body.ifscCode.trim().toUpperCase())) {
        errors.push('Invalid IFSC code format. Example: SBIN0001234 (4 letters + 0 + 6 alphanumeric)');
      }

      if (body.accountNumber && body.accountNumber.trim() !== '') {
        if (!/^\d{9,18}$/.test(body.accountNumber.trim())) {
          errors.push('Account number must be 9-18 digits');
        }
      }
      break;

    case 'cheque':
      if (!body.chequeNo || body.chequeNo.trim() === '') {
        errors.push('Cheque number is required for cheque payments');
      } else if (!/^\d{6,9}$/.test(body.chequeNo.trim())) {
        errors.push('Cheque number must be 6-9 digits');
      }

      if (!body.bankName || body.bankName.trim() === '') {
        errors.push('Bank name is required for cheque payments');
      } else if (!/^[a-zA-Z\s]{2,50}$/.test(body.bankName.trim())) {
        errors.push('Bank name must be 2-50 alphabetic characters');
      }

      if (!body.chequeDate) {
        errors.push('Cheque date is required for cheque payments');
      } else {
        const chequeDate = new Date(body.chequeDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (chequeDate > today) {
          errors.push('Cheque date cannot be in the future');
        }
      }

      if (body.ifscCode && body.ifscCode.trim() !== '') {
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(body.ifscCode.trim().toUpperCase())) {
          errors.push('Invalid IFSC code format. Example: SBIN0001234');
        }
      }
      break;

    case 'card':
      // Card requires BOTH UTR (from bank) + Transaction ID (from gateway)
      if (!body.transactionId || body.transactionId.trim() === '') {
        errors.push('Transaction ID (Gateway Reference) is required for card payments');
      } else if (!/^[A-Za-z0-9]{12,35}$/.test(body.transactionId.trim())) {
        errors.push('Transaction ID must be 12-35 alphanumeric characters');
      }

      if (!body.cardLast4 || body.cardLast4.trim() === '') {
        errors.push('Last 4 digits of card are required for card payments');
      } else if (!/^\d{4}$/.test(body.cardLast4.trim())) {
        errors.push('Card last 4 digits must be exactly 4 digits');
      }
      break;

    case 'online':
      // Online requires BOTH UTR (from bank) + Transaction ID (from gateway)
      if (!body.transactionId || body.transactionId.trim() === '') {
        errors.push('Transaction ID (Gateway Reference) is required for online payments');
      } else if (!/^[A-Za-z0-9]{12,35}$/.test(body.transactionId.trim())) {
        errors.push('Transaction ID must be 12-35 alphanumeric characters');
      }

      if (!body.referenceNo || body.referenceNo.trim() === '') {
        errors.push('Payment Gateway/Platform name is required for online payments');
      }
      break;

    default:
      errors.push(`Invalid payment method: ${method}`);
  }

  return errors.length > 0 ? errors.join('. ') : null;
}

// @desc    Record a new payment
// @route   POST /api/finance/payments/record
// @access  Private (Cashier/Admin)
export const recordPayment = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      admissionNumber,
      paymentDate,
      paymentMethod,
      amount,
      discount,
      lateFee,
      netAmount,
      feesPaid,
      referenceNo,
      transactionId,
      bankName,
      chequeNo,
      upiId,
      sendReceipt,
      sendSMS,
      sendEmail
    } = req.body;

    // Validate required fields
    if (!admissionNumber || !amount || !paymentMethod) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Admission number, amount, and payment method are required'
      });
    }

    // Validate amount is greater than 0
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than 0'
      });
    }

    // Validate amount doesn't exceed maximum (₹999,999)
    if (paymentAmount > 999999) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Payment amount cannot exceed ₹999,999'
      });
    }

    // Normalize payment method to lowercase
    const normalizedMethod = paymentMethod.toLowerCase().replace('_', '-');

    // Validate payment-method-specific required fields
    const validationErrors = validatePaymentMethodDetails(normalizedMethod, req.body);
    if (validationErrors) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: validationErrors
      });
    }

    // Get student details
    const student = await Student.findOne({
      $or: [
        { 'academic.admissionNumber': admissionNumber },
        { admissionNumber }
      ]
    }).session(session);

    if (!student) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // CRITICAL: Prevent overpayment - check if payment exceeds remaining due
    const feeStructure = await FeeStructure.findOne({
      admissionNumber: student.academic?.admissionNumber || admissionNumber
    }).session(session);

    if (feeStructure) {
      const totalFee = feeStructure.totalAmount || feeStructure.totalFee || 0;
      const alreadyPaid = feeStructure.totalPaid || 0;
      const remainingDue = totalFee - alreadyPaid;

      // Allow small overpayment (₹1 tolerance for rounding)
      if (paymentAmount > remainingDue + 1) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Payment amount (₹${paymentAmount}) exceeds remaining due amount (₹${remainingDue}). Total fee: ₹${totalFee}, Already paid: ₹${alreadyPaid}`
        });
      }
    }

    // Get cashier details (who is recording the payment)
    const cashier = await Cashier.findOne({
      $or: [{ user: req.user._id }, { userId: req.user._id }]
    }).session(session);

    // CRITICAL: Require open shift for payment recording (strict mode)
    const openShift = cashier ? await getOpenShiftForCashier(cashier._id, session) : null;
    if (!openShift) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'No open shift found. Please open a shift before recording payments.'
      });
    }

    // Generate receipt number
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const receiptNumber = `REC-${timestamp}-${random}`;

    // Create payment record
    const paymentData = {
      studentId: student._id,
      admissionNumber: student.academic?.admissionNumber || admissionNumber,
      studentName: `${student.personal?.firstName || ''} ${student.personal?.lastName || ''}`.trim(),
      className: student.academic?.class,
      section: student.academic?.section,
      parentName: student.parents?.father?.name || student.parents?.mother?.name,
      parentPhone: student.parents?.father?.phone || student.parents?.mother?.phone,
      parentEmail: student.parents?.father?.email || student.parents?.mother?.email,

      // Use IST time (UTC+5:30) for Indian timezone
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })),
      paymentMethod: normalizedMethod, // Use normalized method name
      amount: paymentAmount,
      discount: parseFloat(discount) || 0,
      lateFee: parseFloat(lateFee) || 0,
      netAmount: parseFloat(netAmount) || paymentAmount,

      referenceNo,
      transactionId,
      bankName,
      chequeNo,
      chequeDate: req.body.chequeDate,
      upiId,
      utrNo: req.body.utrNo,
      ifscCode: req.body.ifscCode,
      accountNumber: req.body.accountNumber,
      cardLast4: req.body.cardLast4,

      feesPaid: feesPaid || [],
      recordedBy: req.user._id,
      recordedByName: req.user.name || req.user.username || 'System',
      cashierName: cashier ? `${cashier.firstName} ${cashier.lastName}` : req.user.name,
      cashierId: cashier?._id,
      
      status: 'completed',
      paymentType: 'installment'
    };

    paymentData.receiptNumber = receiptNumber;
    paymentData.cashierId = cashier?.employeeId;
    paymentData.status = 'completed';

    // openShift is already declared above, just use it
    paymentData.shiftId = openShift._id;

    const payment = await Payment.create([paymentData], { session });
    const createdPayment = payment[0];

    await applyPaymentToFeeStructure(createdPayment, session);

    if (openShift) {
      await addPaymentToShift(openShift, createdPayment, session);
    }

    await student.save({ session });

    // Create receipt
    const receiptData = {
      receiptNumber,
      paymentId: createdPayment._id,
      studentDetails: {
        name: paymentData.studentName,
        admissionNumber: paymentData.admissionNumber,
        className: paymentData.className,
        section: paymentData.section,
        parentName: paymentData.parentName,
        parentPhone: paymentData.parentPhone,
        parentEmail: paymentData.parentEmail
      },
      paymentDetails: {
        date: paymentData.paymentDate,
        method: paymentData.paymentMethod,
        reference: paymentData.referenceNo,
        transactionId: paymentData.transactionId,
        bankName: paymentData.bankName,
        chequeNo: paymentData.chequeNo,
        upiId: paymentData.upiId
      },
      amountDetails: {
        totalAmount: paymentData.amount,
        discount: paymentData.discount,
        lateFee: paymentData.lateFee,
        netAmount: paymentData.netAmount
      },
      feesBreakdown: paymentData.feesPaid,
      recordedBy: req.user._id,
      cashierName: paymentData.cashierName,
      status: 'active'
    };

    await Receipt.create([receiptData], { session });

    await session.commitTransaction();

    // Send notifications (if enabled)
    if (sendEmail && paymentData.parentEmail) {
      // TODO: Implement email sending
      console.log(`📧 Email receipt to ${paymentData.parentEmail}`);
    }

    if (sendSMS && paymentData.parentPhone) {
      // TODO: Implement SMS sending
      console.log(`📱 SMS receipt to ${paymentData.parentPhone}`);
    }

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        payment: createdPayment,
        receipt: receiptData,
        receiptNumber
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Payment recording error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

// @desc    Get payment history
// @route   GET /api/finance/payments/history
// @access  Private (Cashier/Admin)
export const getPaymentHistory = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    fromDate,
    toDate,
    paymentMethod,
    status,
    search
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const query = {};

  if (fromDate || toDate) {
    query.paymentDate = {};
    if (fromDate) query.paymentDate.$gte = new Date(fromDate);
    if (toDate) {
      const toDateObj = new Date(toDate);
      toDateObj.setHours(23, 59, 59, 999);
      query.paymentDate.$lte = toDateObj;
    }
  }

  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (status) query.status = status;

  if (search) {
    query.$or = [
      { studentName: { $regex: search, $options: 'i' } },
      { admissionNumber: { $regex: search, $options: 'i' } },
      { receiptNumber: { $regex: search, $options: 'i' } }
    ];
  }

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Payment.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

// @desc    Get payment statistics
// @route   GET /api/finance/payments/statistics
// @access  Private (Cashier/Admin)
export const getPaymentStatistics = asyncHandler(async (req, res) => {
  const { fromDate, toDate } = req.query;

  const dateQuery = {};
  if (fromDate || toDate) {
    if (fromDate) dateQuery.$gte = new Date(fromDate);
    if (toDate) {
      const toDateObj = new Date(toDate);
      toDateObj.setHours(23, 59, 59, 999);
      dateQuery.$lte = toDateObj;
    }
    dateQuery.paymentDate = dateQuery;
  }

  const [
    totalCollection,
    totalPayments,
    methodBreakdown,
    todayCollection,
    monthCollection
  ] = await Promise.all([
    Payment.aggregate([
      { $match: dateQuery },
      { $group: { _id: null, total: { $sum: '$netAmount' } } }
    ]),
    Payment.countDocuments(dateQuery),
    Payment.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      }
    ]),
    Payment.aggregate([
      {
        $match: {
          paymentDate: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lte: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      },
      { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } }
    ]),
    Payment.aggregate([
      {
        $match: {
          paymentDate: {
            $gte: new Date(new Date().setDate(1)),
            $lte: new Date()
          }
        }
      },
      { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } }
    ])
  ]);

  res.json({
    success: true,
    data: {
      totalCollection: totalCollection[0]?.total || 0,
      totalPayments,
      methodBreakdown,
      todayCollection: todayCollection[0]?.total || 0,
      todayCount: todayCollection[0]?.count || 0,
      monthCollection: monthCollection[0]?.total || 0,
      monthCount: monthCollection[0]?.count || 0
    }
  });
});

// @desc    Get payment by ID
// @route   GET /api/finance/payments/:id
// @access  Private (Cashier/Admin)
export const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  res.json({
    success: true,
    data: { payment }
  });
});

// @desc    Void/cancel payment
// @route   POST /api/finance/payments/:id/void
// @access  Private (Admin only)
export const voidPayment = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  if (payment.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      message: 'Payment is already cancelled'
    });
  }

  payment.status = 'cancelled';
  payment.voidReason = reason;
  payment.voidedBy = req.user._id;
  payment.voidedAt = new Date();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await reversePaymentFromFeeStructure(payment, session);

    if (payment.shiftId) {
      const shift = await ShiftSession.findById(payment.shiftId).session(session);
      if (shift) {
        await reversePaymentFromShift(shift, payment, session);
      }
    }

    await payment.save({ session });

    await Receipt.findOneAndUpdate(
      { paymentId: payment._id },
      { status: 'cancelled' },
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  res.json({
    success: true,
    message: 'Payment voided successfully',
    data: { payment }
  });
});

// @desc    Get receipt by payment ID
// @route   GET /api/finance/receipts/payment/:paymentId
// @access  Private (Cashier/Admin)
export const getReceiptByPaymentId = asyncHandler(async (req, res) => {
  const receipt = await Receipt.findOne({ paymentId: req.params.paymentId })
    .populate('recordedBy', 'name email');

  if (!receipt) {
    return res.status(404).json({
      success: false,
      message: 'Receipt not found'
    });
  }

  res.json({
    success: true,
    data: { receipt }
  });
});

// @desc    Get receipt by receipt number
// @route   GET /api/finance/receipts/:receiptNumber
// @access  Private (Cashier/Admin)
export const getReceiptByNumber = asyncHandler(async (req, res) => {
  const receipt = await Receipt.findOne({ receiptNumber: req.params.receiptNumber })
    .populate('recordedBy', 'name email');

  if (!receipt) {
    return res.status(404).json({
      success: false,
      message: 'Receipt not found'
    });
  }

  res.json({
    success: true,
    data: { receipt }
  });
});

// @desc    Reprint receipt
// @route   POST /api/finance/receipts/:id/reprint
// @access  Private (Cashier/Admin)
export const reprintReceipt = asyncHandler(async (req, res) => {
  const receipt = await Receipt.findById(req.params.id);

  if (!receipt) {
    return res.status(404).json({
      success: false,
      message: 'Receipt not found'
    });
  }

  receipt.printCount = (receipt.printCount || 0) + 1;
  receipt.lastPrintedAt = new Date();

  await receipt.save();

  res.json({
    success: true,
    message: 'Receipt reprinted successfully',
    data: { receipt }
  });
});
