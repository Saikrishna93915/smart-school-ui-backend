import asyncHandler from "../utils/asyncHandler.js";
import Payment from "../models/Payment.js";
import mongoose from "mongoose";

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

// @desc    Get payment history with filters
// @route   GET /api/history/payments
// @access  Private (Admin/Finance)
export const getPaymentHistory = asyncHandler(async (req, res) => {
  try {
    console.log("📊 Getting payment history with filters:", req.query);
    
    const {
      search,
      paymentMethod,
      status,
      startDate,
      endDate,
      className,
      includeCredits = 'false',
      page = 1,
      limit = 20,
      sortBy = 'paymentDate',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    // By default, exclude credit notes from payment history
    const shouldIncludeCredits = String(includeCredits).toLowerCase() === 'true';
    if (!shouldIncludeCredits) {
      filter.paymentType = { $ne: 'credit' };
      filter.receiptNumber = { $not: /^CREDIT-/i };
    }

    // Search filter
    if (search && search.trim()) {
      filter.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
        { receiptNumber: { $regex: search, $options: 'i' } },
        { parentName: { $regex: search, $options: 'i' } },
        { parentPhone: { $regex: search, $options: 'i' } },
        { transactionId: { $regex: search, $options: 'i' } },
      ];
    }

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'All Methods') {
      filter.paymentMethod = paymentMethod;
    }

    // Status filter
    if (status && status !== 'All Status') {
      filter.status = status;
    }

    // Class filter
    if (className && className !== 'All Classes') {
      filter.className = className;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.paymentDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.paymentDate.$lte = end;
      }
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    console.log('🔍 History Filter:', JSON.stringify(filter, null, 2));

    // Get payments with pagination
    const payments = await Payment.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('recordedBy', 'name username email')
      .lean();

    // Get total count
    const total = await Payment.countDocuments(filter);

    // Calculate summary statistics
    const summaryResult = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$netAmount' },
          totalTransactions: { $sum: 1 },
          completedPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);

    const summary = summaryResult[0] || {
      totalAmount: 0,
      totalTransactions: 0,
      completedPayments: 0
    };

    const successRate = summary.totalTransactions > 0 
      ? (summary.completedPayments / summary.totalTransactions) * 100 
      : 0;
    
    const avgTransaction = summary.totalTransactions > 0 
      ? summary.totalAmount / summary.totalTransactions 
      : 0;

    // Get payment method distribution
    const methodDistribution = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$netAmount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get weekly trend (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weeklyTrend = await Payment.aggregate([
      {
        $match: {
          ...filter,
          paymentDate: { $gte: oneWeekAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' }
          },
          amount: { $sum: '$netAmount' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format weekly trend for frontend
    const formattedWeeklyTrend = weeklyTrend.map(item => {
      const date = new Date(item._id);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      return {
        day: dayName,
        amount: item.amount,
        transactions: item.transactions,
        date: item._id
      };
    });

    console.log(`✅ History API: Found ${payments.length} payments`);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        summary: {
          totalAmount: summary.totalAmount,
          totalTransactions: summary.totalTransactions,
          completedPayments: summary.completedPayments,
          successRate: Number(successRate.toFixed(1)),
          avgTransaction: Number(avgTransaction.toFixed(2))
        },
        methodDistribution,
        weeklyTrend: formattedWeeklyTrend
      }
    });

  } catch (error) {
    console.error('❌ Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get payment statistics for dashboard
// @route   GET /api/history/statistics
// @access  Private (Admin/Finance)
export const getPaymentStatistics = asyncHandler(async (req, res) => {
  try {
    console.log("📈 Getting payment statistics");
    
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Today's statistics
    const todayStats = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfDay },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // This month's statistics
    const monthStats = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfMonth },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // This year's statistics
    const yearStats = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfYear },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Payment methods breakdown for current month
    const methodBreakdown = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfMonth },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          totalAmount: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Class-wise collection for current month
    const classBreakdown = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfMonth },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$className',
          totalAmount: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Status distribution for current month
    const statusDistribution = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$netAmount' }
        }
      }
    ]);

    console.log("✅ Statistics API: Success");

    res.status(200).json({
      success: true,
      data: {
        today: {
          totalAmount: todayStats[0]?.totalAmount || 0,
          count: todayStats[0]?.count || 0
        },
        thisMonth: {
          totalAmount: monthStats[0]?.totalAmount || 0,
          count: monthStats[0]?.count || 0
        },
        thisYear: {
          totalAmount: yearStats[0]?.totalAmount || 0,
          count: yearStats[0]?.count || 0
        },
        methodBreakdown,
        classBreakdown,
        statusDistribution
      }
    });

  } catch (error) {
    console.error('❌ Get payment statistics error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Export payment history to CSV
// @route   GET /api/history/export
// @access  Private (Admin/Finance)
export const exportPaymentHistory = asyncHandler(async (req, res) => {
  try {
    console.log("📤 Exporting payment history");
    
    const {
      search,
      paymentMethod,
      status,
      startDate,
      endDate,
      className
    } = req.query;

    const filter = {};

    // Apply filters
    if (search && search.trim()) {
      filter.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
        { receiptNumber: { $regex: search, $options: 'i' } },
        { parentName: { $regex: search, $options: 'i' } }
      ];
    }

    if (paymentMethod && paymentMethod !== 'All Methods') {
      filter.paymentMethod = paymentMethod;
    }

    if (status && status !== 'All Status') {
      filter.status = status;
    }

    if (className && className !== 'All Classes') {
      filter.className = className;
    }

    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.paymentDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.paymentDate.$lte = end;
      }
    }

    // Get all payments matching filters
    const payments = await Payment.find(filter)
      .sort({ paymentDate: -1 })
      .populate('recordedBy', 'name')
      .lean();

    // Generate CSV content
    const headers = [
      'Receipt Number',
      'Student Name',
      'Admission Number',
      'Class',
      'Section',
      'Amount',
      'Discount',
      'Late Fee',
      'Net Amount',
      'Payment Method',
      'Transaction ID',
      'Payment Date',
      'Status',
      'Parent Name',
      'Parent Phone',
      'Collected By',
      'Reference No',
      'Bank Name',
      'Cheque No',
      'UTR No',
      'Description'
    ];

    const rows = payments.map(payment => [
      payment.receiptNumber,
      payment.studentName,
      payment.admissionNumber,
      payment.className,
      payment.section,
      payment.amount,
      payment.discount,
      payment.lateFee,
      payment.netAmount,
      payment.paymentMethod,
      payment.transactionId || '',
      new Date(payment.paymentDate).toLocaleDateString('en-IN'),
      payment.status,
      payment.parentName,
      payment.parentPhone,
      payment.recordedByName || payment.recordedBy?.name || '',
      payment.referenceNo || '',
      payment.bankName || '',
      payment.chequeNo || '',
      payment.utrNo || '',
      payment.description || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=payment-history-${new Date().toISOString().split('T')[0]}.csv`);
    
    console.log(`✅ Export API: Exported ${payments.length} records`);
    
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('❌ Export payment history error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get receipt by receipt number
// @route   GET /api/history/receipt/:receiptNumber
// @access  Private (Admin/Finance)
export const getReceiptByNumber = asyncHandler(async (req, res) => {
  try {
    const receiptNumber = normalizeReceiptNumber(req.params.receiptNumber);

    console.log(`🔍 Looking for receipt: ${receiptNumber}`);

    const payment = await Payment.findOne({ receiptNumber })
      .populate('studentId', 'admissionNumber student class')
      .populate('recordedBy', 'name email username');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});