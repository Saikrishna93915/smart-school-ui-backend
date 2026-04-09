// controllers/feeFollowUpController.js - Fee Follow-up & Bulk Email Controller
import Student from '../models/Student.js';
import Payment from '../models/Payment.js';
import { sendPaymentConfirmationEmail, sendFeeReminderEmail, sendBulkFeeReminders } from '../services/paymentEmailService.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Get students with pending fees for follow-up
// @route   GET /api/cashier/follow-ups/pending
// @access  Private (Cashier/Admin)
export const getPendingFeeStudents = asyncHandler(async (req, res) => {
  const { 
    class: className, 
    section, 
    minDue, 
    maxDue,
    daysOverdue,
    page = 1,
    limit = 50 
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  // Build query for students with pending fees
  const query = { 
    'fee.pendingAmount': { $gt: 0 }
  };

  if (className) query['academic.class'] = className;
  if (section) query['academic.section'] = section;

  // Find students with pending fees
  const students = await Student.find(query)
    .select('personal academic parentInfo fee')
    .skip(skip)
    .limit(Number(limit))
    .sort({ 'fee.pendingAmount': -1 });

  const total = await Student.countDocuments(query);

  // Format response
  const studentsWithFees = students.map(student => ({
    student: {
      _id: student._id,
      name: `${student.personal?.firstName || ''} ${student.personal?.lastName || ''}`,
      admissionNumber: student.academic?.admissionNumber,
      class: student.academic?.class,
      section: student.academic?.section,
      email: student.personal?.email || student.parentInfo?.email,
      phone: student.personal?.phone || student.parentInfo?.phone
    },
    pendingFee: {
      totalFee: student.fee?.totalFee || 0,
      paidAmount: student.fee?.paidAmount || 0,
      pendingAmount: student.fee?.pendingAmount || 0,
      dueDate: student.fee?.dueDate,
      feeType: student.fee?.feeType,
      daysOverdue: student.fee?.dueDate ? 
        Math.floor((new Date() - new Date(student.fee.dueDate)) / (1000 * 60 * 60 * 24)) : 0
    }
  }));

  res.json({
    success: true,
    data: {
      students: studentsWithFees,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

// @desc    Send single fee reminder email
// @route   POST /api/cashier/follow-ups/send-reminder
// @access  Private (Cashier/Admin)
export const sendSingleReminder = asyncHandler(async (req, res) => {
  const { studentId, reminderType = 'first' } = req.body;

  const student = await Student.findById(studentId)
    .populate('academic.class');

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  if (!student.fee || student.fee.pendingAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'No pending fees for this student'
    });
  }

  const result = await sendFeeReminderEmail(student, student.fee, reminderType);

  if (result.success) {
    res.json({
      success: true,
      message: 'Reminder email sent successfully',
      data: result
    });
  } else {
    res.status(500).json({
      success: false,
      message: result.error || 'Failed to send email'
    });
  }
});

// @desc    Send bulk fee reminder emails
// @route   POST /api/cashier/follow-ups/send-bulk
// @access  Private (Cashier/Admin)
export const sendBulkReminders = asyncHandler(async (req, res) => {
  const { studentIds, reminderType = 'first' } = req.body;

  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide student IDs'
    });
  }

  // Get students with pending fees
  const students = await Student.find({ 
    _id: { $in: studentIds },
    'fee.pendingAmount': { $gt: 0 }
  }).populate('academic.class');

  if (students.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No students with pending fees found'
    });
  }

  const studentsWithFees = students.map(student => ({
    student,
    pendingFee: student.fee
  }));

  const result = await sendBulkFeeReminders(studentsWithFees, reminderType);

  res.json({
    success: true,
    message: `Bulk email campaign completed: ${result.success} sent, ${result.failed} failed`,
    data: result
  });
});

// @desc    Send payment confirmation email (manual trigger)
// @route   POST /api/cashier/follow-ups/send-payment-confirmation
// @access  Private (Cashier/Admin)
export const sendPaymentConfirmation = asyncHandler(async (req, res) => {
  const { paymentId } = req.body;

  const payment = await Payment.findById(paymentId)
    .populate('studentId');

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  const result = await sendPaymentConfirmationEmail(payment);

  if (result.success) {
    res.json({
      success: true,
      message: 'Payment confirmation email sent successfully',
      data: result
    });
  } else {
    res.status(500).json({
      success: false,
      message: result.error || 'Failed to send email'
    });
  }
});

// @desc    Get email campaign statistics
// @route   GET /api/cashier/follow-ups/stats
// @access  Private (Cashier/Admin)
export const getFollowUpStats = asyncHandler(async (req, res) => {
  const totalPending = await Student.countDocuments({ 'fee.pendingAmount': { $gt: 0 } });
  const totalOverdue = await Student.countDocuments({ 
    'fee.pendingAmount': { $gt: 0 },
    'fee.dueDate': { $lt: new Date() }
  });

  res.json({
    success: true,
    data: {
      totalPending,
      totalOverdue,
      totalAmount: 'Calculate from fee collections'
    }
  });
});
