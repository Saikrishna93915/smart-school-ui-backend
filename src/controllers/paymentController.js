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

    // Get cashier details (who is recording the payment)
    const cashier = await Cashier.findOne({ 
      $or: [{ user: req.user._id }, { userId: req.user._id }]
    }).session(session);

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
      paymentMethod,
      amount: parseFloat(amount),
      discount: parseFloat(discount) || 0,
      lateFee: parseFloat(lateFee) || 0,
      netAmount: parseFloat(netAmount) || parseFloat(amount),
      
      referenceNo,
      transactionId,
      bankName,
      chequeNo,
      upiId,
      
      feesPaid: feesPaid || [],
      recordedBy: req.user._id,
      cashierName: cashier ? `${cashier.firstName} ${cashier.lastName}` : req.user.name,
      cashierId: cashier?._id,
      
      status: 'completed',
      paymentType: 'installment'
    };

    paymentData.receiptNumber = receiptNumber;
    paymentData.cashierId = cashier?.employeeId;
    paymentData.status = 'completed';

    const openShift = cashier ? await getOpenShiftForCashier(cashier._id, session) : null;
    if (openShift) {
      paymentData.shiftId = openShift._id;
    }

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
