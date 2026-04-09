import asyncHandler from "../utils/asyncHandler.js";
import Payment from "../models/Payment.js";
import Student from "../models/Student.js";
import FeeStructure from "../models/FeeStructure.js";
import User from "../models/User.js";
import { generatePDFReport, generateExcelReport, generateCSVReport } from "../utils/reportGenerators.js";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Generate financial report
// @route   POST /api/reports/generate
// @access  Private (Admin/Finance)
export const generateReport = asyncHandler(async (req, res) => {
  try {
    const {
      reportType,
      format,
      startDate,
      endDate,
      className,
      section,
      paymentMethod,
      status,
      includeCharts,
      includeDetails,
      includeSummary,
      includeRecommendations,
      emailRecipients,
      schedule
    } = req.body;

    console.log('📊 Generating report with parameters:', {
      reportType,
      format,
      startDate,
      endDate,
      className,
      section,
      paymentMethod,
      status
    });

    // Build filter object based on request parameters
    const filter = {};

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

    // Class filter
    if (className && className !== 'All Classes') {
      filter.className = className;
    }

    // Section filter
    if (section && section !== 'All Sections') {
      filter.section = section;
    }

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'All Methods') {
      filter.paymentMethod = paymentMethod;
    }

    // Status filter
    if (status && status !== 'All Status') {
      filter.status = status;
    }

    // For collection reports, default to completed payments unless user explicitly picks status
    if (reportType === 'collection' && !filter.status) {
      filter.status = 'completed';
    }

    console.log('🔍 Report filter:', filter);

    let reportData;
    let fileName;
    let filePath;

    // Generate report based on type
    switch (reportType) {
      case 'collection':
        reportData = await generateCollectionReport(filter, {
          includeCharts,
          includeDetails,
          includeSummary,
          includeRecommendations
        });
        fileName = `collection-report-${Date.now()}`;
        break;

      case 'defaulter':
        reportData = await generateDefaulterReport(filter, {
          includeDetails,
          includeSummary,
          includeRecommendations
        });
        fileName = `defaulter-report-${Date.now()}`;
        break;

      case 'payment-methods':
        reportData = await generatePaymentMethodReport(filter, {
          includeCharts,
          includeDetails
        });
        fileName = `payment-methods-report-${Date.now()}`;
        break;

      case 'monthly-trend':
        reportData = await generateMonthlyTrendReport(filter, {
          includeCharts,
          includeSummary
        });
        fileName = `monthly-trend-report-${Date.now()}`;
        break;

      case 'audit':
        reportData = await generateAuditReport(filter, {
          includeDetails
        });
        fileName = `audit-report-${Date.now()}`;
        break;

      case 'annual':
        reportData = await generateAnnualReport(filter, {
          includeCharts,
          includeDetails,
          includeSummary,
          includeRecommendations
        });
        fileName = `annual-report-${Date.now()}`;
        break;

      case 'student-performance':
        reportData = await generateStudentPerformanceReport(filter, {
          includeCharts,
          includeDetails,
          includeSummary,
          includeRecommendations
        });
        fileName = `student-performance-report-${Date.now()}`;
        break;

      case 'forecast':
        reportData = await generateForecastReport(filter, {
          includeCharts,
          includeDetails,
          includeSummary,
          includeRecommendations
        });
        fileName = `forecast-report-${Date.now()}`;
        break;

      default:
        throw new Error('Invalid report type');
    }

    // Generate file based on format
    switch (format) {
      case 'pdf':
        filePath = await generatePDFReport(reportData, fileName);
        break;

      case 'excel':
        filePath = await generateExcelReport(reportData, fileName);
        break;

      case 'csv':
        filePath = await generateCSVReport(reportData, fileName);
        break;

      default:
        throw new Error('Invalid format');
    }

    // Read file and send as response
    const fileContent = fs.readFileSync(filePath);

    // Set response headers based on format
    const contentType = {
      'pdf': 'application/pdf',
      'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'csv': 'text/csv'
    }[format];

    const fileExtension = {
      'pdf': 'pdf',
      'excel': 'xlsx',
      'csv': 'csv'
    }[format];

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.${fileExtension}"`);
    
    // Delete temp file after sending
    res.on('finish', () => {
      fs.unlinkSync(filePath);
    });

    res.status(200).send(fileContent);

  } catch (error) {
    console.error('❌ Generate report error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get report statistics
// @route   GET /api/reports/statistics
// @access  Private (Admin/Finance)
// @desc    Get report statistics
// @route   GET /api/reports/statistics
// @access  Private (Admin/Finance)
export const getReportStatistics = asyncHandler(async (req, res) => {
    try {
      console.log('📈 Getting report statistics');
  
      // Get total reports generated (mock data for now)
      const totalReports = 148;
      const mostUsedFormat = 'PDF';
      const avgReportSize = 2.8;
      const timeSaved = 45;
  
      // Get recent report activity - SIMPLIFIED: Don't use aggregation for now
      // Instead, get raw payments and process in JavaScript
      const payments = await Payment.find({
        paymentDate: { $exists: true, $ne: null }
      })
      .select('paymentDate netAmount')
      .limit(1000)
      .lean();
  
      // Process in JavaScript to avoid MongoDB aggregation issues
      const recentActivity = [];
      const dateMap = new Map();
      
      payments.forEach(payment => {
        if (payment.paymentDate) {
          try {
            let date;
            // Handle both Date objects and string dates
            if (payment.paymentDate instanceof Date) {
              date = payment.paymentDate;
            } else if (typeof payment.paymentDate === 'string') {
              date = new Date(payment.paymentDate);
            } else {
              return; // Skip invalid dates
            }
            
            // Check if date is valid
            if (isNaN(date.getTime())) return;
            
            const dateStr = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
            
            if (!dateMap.has(dateStr)) {
              dateMap.set(dateStr, { transactions: 0, amount: 0 });
            }
            
            const dayData = dateMap.get(dateStr);
            dayData.transactions += 1;
            dayData.amount += payment.netAmount || 0;
          } catch (error) {
            console.log('Error processing payment date:', payment.paymentDate);
          }
        }
      });
  
      // Convert map to array and sort
      dateMap.forEach((value, key) => {
        recentActivity.push({
          _id: key,
          transactions: value.transactions,
          amount: value.amount
        });
      });
  
      // Sort by date descending and limit to 7
      recentActivity.sort((a, b) => b._id.localeCompare(a._id));
      const limitedActivity = recentActivity.slice(0, 7);
  
      console.log('📊 Recent activity found:', limitedActivity.length, 'days');
  
      res.status(200).json({
        success: true,
        data: {
          totalReports,
          mostUsedFormat,
          avgReportSize,
          timeSaved,
          recentActivity: limitedActivity
        }
      });
  
    } catch (error) {
      console.error('❌ Get report statistics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

// @desc    Get quick report (collection summary)
// @route   GET /api/reports/quick/collection
// @access  Private (Admin/Finance)
export const getQuickCollectionReport = asyncHandler(async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const filter = {
      paymentDate: { $gte: startOfMonth },
      status: 'completed'
    };

    const collectionData = await generateCollectionReport(filter, {
      includeCharts: false,
      includeDetails: true,
      includeSummary: true,
      includeRecommendations: false
    });

    res.status(200).json({
      success: true,
      data: collectionData
    });

  } catch (error) {
    console.error('❌ Quick collection report error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get quick report (defaulters)
// @route   GET /api/reports/quick/defaulters
// @access  Private (Admin/Finance)
export const getQuickDefaulterReport = asyncHandler(async (req, res) => {
  try {
    const defaulterData = await generateDefaulterReport({}, {
      includeDetails: true,
      includeSummary: false,
      includeRecommendations: true
    });

    res.status(200).json({
      success: true,
      data: defaulterData
    });

  } catch (error) {
    console.error('❌ Quick defaulter report error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get recent reports
// @route   GET /api/reports/recent
// @access  Private (Admin/Finance)
export const getRecentReports = asyncHandler(async (req, res) => {
  try {
    // Mock data for recent reports
    const recentReports = [
      {
        id: 1,
        name: 'Collection Report Nov 2024',
        date: '2024-11-30',
        size: '3.2 MB',
        type: 'pdf',
        status: 'success',
        url: '/reports/collection-nov-2024.pdf'
      },
      {
        id: 2,
        name: 'Defaulter Analysis',
        date: '2024-11-25',
        size: '1.8 MB',
        type: 'excel',
        status: 'success',
        url: '/reports/defaulter-analysis.xlsx'
      },
      {
        id: 3,
        name: 'Annual Financial Summary',
        date: '2024-10-31',
        size: '5.1 MB',
        type: 'pdf',
        status: 'success',
        url: '/reports/annual-summary.pdf'
      },
      {
        id: 4,
        name: 'Payment Methods Q3',
        date: '2024-10-15',
        size: '2.4 MB',
        type: 'csv',
        status: 'success',
        url: '/reports/payment-methods-q3.csv'
      },
      {
        id: 5,
        name: 'Monthly Trend Report',
        date: '2024-09-30',
        size: '2.9 MB',
        type: 'pdf',
        status: 'success',
        url: '/reports/monthly-trend.pdf'
      }
    ];

    res.status(200).json({
      success: true,
      data: recentReports
    });

  } catch (error) {
    console.error('❌ Get recent reports error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Helper functions for different report types

const generateCollectionReport = async (filter, options) => {
  try {
    // Get payments data
    const payments = await Payment.find(filter)
      .sort({ paymentDate: -1 })
      .limit(1000)
      .lean();

    // Calculate summary statistics
    const summaryResult = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$netAmount' },
          totalTransactions: { $sum: 1 },
          completedPayments: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          avgTransaction: { $avg: '$netAmount' }
        }
      }
    ]);

    const summary = summaryResult[0] || {
      totalAmount: 0,
      totalTransactions: 0,
      completedPayments: 0,
      avgTransaction: 0
    };

    // Get daily trend
    const dailyTrend = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' }
          },
          amount: { $sum: '$netAmount' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]);

    // Get class-wise distribution
    const classDistribution = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$className',
          amount: { $sum: '$netAmount' },
          count: { $sum: 1 },
          students: { $addToSet: '$studentName' }
        }
      },
      { $sort: { amount: -1 } }
    ]);

    const reportData = {
      reportType: 'collection',
      generatedAt: new Date().toISOString(),
      summary: {
        totalAmount: summary.totalAmount,
        totalTransactions: summary.totalTransactions,
        completedPayments: summary.completedPayments,
        successRate: summary.totalTransactions > 0 
          ? (summary.completedPayments / summary.totalTransactions) * 100 
          : 0,
        avgTransaction: summary.avgTransaction
      },
      dailyTrend: dailyTrend.map(item => ({
        date: item._id,
        amount: item.amount,
        transactions: item.transactions
      })),
      classDistribution: classDistribution.map(item => ({
        className: item._id,
        amount: item.amount,
        count: item.count,
        studentCount: item.students.length
      })),
      samplePayments: payments.slice(0, 10), // Include sample data
      filterApplied: filter,
      options: options
    };

    return reportData;
  } catch (error) {
    console.error('Generate collection report error:', error);
    throw error;
  }
};

const generateDefaulterReport = async (filter, options) => {
  try {
    // Get all students
    const students = await Student.find({ active: true })
      .select('admissionNumber studentName className section guardianPhone guardianEmail')
      .lean();

    // Get payments for each student
    const defaulterData = [];

    for (const student of students) {
      const payments = await Payment.find({
        admissionNumber: student.admissionNumber,
        status: { $ne: 'completed' }
      }).lean();

      if (payments.length > 0) {
        const totalDue = payments.reduce((sum, payment) => sum + payment.netAmount, 0);
        const pendingCount = payments.filter(p => p.status === 'pending').length;
        const overdueCount = payments.filter(p => p.status === 'overdue').length;

        defaulterData.push({
          admissionNumber: student.admissionNumber,
          studentName: student.studentName,
          className: student.className,
          section: student.section,
          guardianPhone: student.guardianPhone,
          guardianEmail: student.guardianEmail,
          totalDue,
          pendingCount,
          overdueCount,
          payments: payments.map(p => ({
            receiptNumber: p.receiptNumber,
            amount: p.netAmount,
            dueDate: p.paymentDate,
            status: p.status,
            overdueDays: p.overdueDays || 0
          }))
        });
      }
    }

    // Sort by total due (descending)
    defaulterData.sort((a, b) => b.totalDue - a.totalDue);

    const reportData = {
      reportType: 'defaulter',
      generatedAt: new Date().toISOString(),
      totalDefaulters: defaulterData.length,
      totalDueAmount: defaulterData.reduce((sum, student) => sum + student.totalDue, 0),
      defaulters: defaulterData,
      recommendations: options.includeRecommendations ? [
        'Send SMS reminders to top 10 defaulters',
        'Schedule parent meetings for high due amounts',
        'Offer installment plans for large outstanding amounts',
        'Consider temporary fee waiver for long-standing defaulters'
      ] : [],
      filterApplied: filter,
      options: options
    };

    return reportData;
  } catch (error) {
    console.error('Generate defaulter report error:', error);
    throw error;
  }
};

const generatePaymentMethodReport = async (filter, options) => {
  try {
    // Get payment method distribution
    const methodDistribution = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$paymentMethod',
          totalAmount: { $sum: '$netAmount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$netAmount' },
          successRate: {
            $avg: { $cond: [{ $eq: ['$status', 'completed'] }, 100, 0] }
          }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Get trend by month
    const monthlyTrend = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            month: { $month: '$paymentDate' },
            method: '$paymentMethod'
          },
          amount: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.month': 1 } }
    ]);

    const reportData = {
      reportType: 'payment-methods',
      generatedAt: new Date().toISOString(),
      methodDistribution: methodDistribution.map(method => ({
        method: method._id,
        totalAmount: method.totalAmount,
        count: method.count,
        avgAmount: method.avgAmount,
        successRate: method.successRate,
        percentage: 100 // Will be calculated later
      })),
      monthlyTrend,
      filterApplied: filter,
      options: options
    };

    return reportData;
  } catch (error) {
    console.error('Generate payment method report error:', error);
    throw error;
  }
};

const generateMonthlyTrendReport = async (filter, options) => {
  try {
    const monthlyData = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' }
          },
          amount: { $sum: '$netAmount' },
          transactions: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    const reportData = {
      reportType: 'monthly-trend',
      generatedAt: new Date().toISOString(),
      monthlyData: monthlyData.map(item => ({
        year: item._id.year,
        month: item._id.month,
        amount: item.amount,
        transactions: item.transactions,
        completed: item.completed,
        pending: item.pending,
        successRate: item.transactions > 0 ? (item.completed / item.transactions) * 100 : 0
      })),
      filterApplied: filter,
      options: options
    };

    return reportData;
  } catch (error) {
    console.error('Generate monthly trend report error:', error);
    throw error;
  }
};

const generateAuditReport = async (filter, options) => {
  try {
    // Get all payments with full details
    const payments = await Payment.find(filter)
      .sort({ paymentDate: -1 })
      .populate('recordedBy', 'name email username')
      .lean();

    // Get audit summary
    const auditSummary = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$recordedBy',
          totalAmount: { $sum: '$netAmount' },
          count: { $sum: 1 },
          methods: { $addToSet: '$paymentMethod' }
        }
      }
    ]);

    const reportData = {
      reportType: 'audit',
      generatedAt: new Date().toISOString(),
      totalRecords: payments.length,
      auditSummary,
      detailedRecords: payments.map(payment => ({
        receiptNumber: payment.receiptNumber,
        studentName: payment.studentName,
        admissionNumber: payment.admissionNumber,
        amount: payment.netAmount,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        date: payment.paymentDate,
        recordedBy: payment.recordedBy?.name || 'Unknown',
        transactionId: payment.transactionId || 'N/A',
        reference: payment.referenceNo || 'N/A'
      })),
      filterApplied: filter,
      options: options
    };

    return reportData;
  } catch (error) {
    console.error('Generate audit report error:', error);
    throw error;
  }
};

const generateAnnualReport = async (filter, options) => {
  try {
    const currentYear = new Date().getFullYear();
    const yearFilter = {
      ...filter,
      paymentDate: {
        $gte: new Date(`${currentYear}-01-01`),
        $lte: new Date(`${currentYear}-12-31`)
      }
    };

    // Get monthly data for current year
    const monthlyData = await Payment.aggregate([
      { $match: yearFilter },
      {
        $group: {
          _id: { $month: '$paymentDate' },
          amount: { $sum: '$netAmount' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get yearly comparison (last 3 years)
    const yearlyComparison = await Payment.aggregate([
      {
        $group: {
          _id: { $year: '$paymentDate' },
          amount: { $sum: '$netAmount' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 3 }
    ]);

    // Get category distribution
    const categoryDistribution = await Payment.aggregate([
      { $match: yearFilter },
      {
        $group: {
          _id: '$paymentMethod',
          amount: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { amount: -1 } }
    ]);

    const reportData = {
      reportType: 'annual',
      generatedAt: new Date().toISOString(),
      year: currentYear,
      totalAmount: monthlyData.reduce((sum, month) => sum + month.amount, 0),
      totalTransactions: monthlyData.reduce((sum, month) => sum + month.transactions, 0),
      monthlyData,
      yearlyComparison,
      categoryDistribution,
      recommendations: options.includeRecommendations ? [
        `Total collection for ${currentYear}: ₹${monthlyData.reduce((sum, month) => sum + month.amount, 0).toLocaleString('en-IN')}`,
        'Implement digital payment incentives',
        'Introduce early payment discounts',
        'Optimize fee structure based on payment patterns'
      ] : [],
      filterApplied: filter,
      options: options
    };

    return reportData;
  } catch (error) {
    console.error('Generate annual report error:', error);
    throw error;
  }
};

const generateStudentPerformanceReport = async (filter, options) => {
  try {
    const performanceData = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$studentId',
          studentName: { $first: '$studentName' },
          className: { $first: '$className' },
          totalPaid: { $sum: '$netAmount' },
          paymentCount: { $sum: 1 },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          latestPaymentDate: { $max: '$paymentDate' }
        }
      },
      { $sort: { totalPaid: -1 } },
      { $limit: 200 }
    ]);

    const enriched = performanceData.map((item) => ({
      ...item,
      paymentConsistency: item.paymentCount > 0 ? Number(((item.completedCount / item.paymentCount) * 100).toFixed(1)) : 0,
      riskCategory:
        item.paymentCount === 0
          ? 'high'
          : item.completedCount / item.paymentCount >= 0.9
          ? 'low'
          : item.completedCount / item.paymentCount >= 0.7
          ? 'medium'
          : 'high'
    }));

    const reportData = {
      reportType: 'student-performance',
      generatedAt: new Date().toISOString(),
      summary: {
        totalAmount: enriched.reduce((sum, item) => sum + (item.totalPaid || 0), 0),
        totalTransactions: enriched.reduce((sum, item) => sum + (item.paymentCount || 0), 0),
        successRate: enriched.length
          ? enriched.reduce((sum, item) => sum + (item.paymentConsistency || 0), 0) / enriched.length
          : 0,
      },
      details: enriched,
      recommendations: options.includeRecommendations
        ? [
            'Follow up with high-risk students for pending payments.',
            'Introduce reminders for low-consistency accounts.',
            'Recognize consistent fee payers to improve compliance.'
          ]
        : [],
      filterApplied: filter,
      options,
    };

    return reportData;
  } catch (error) {
    console.error('Generate student performance report error:', error);
    throw error;
  }
};

const generateForecastReport = async (filter, options) => {
  try {
    const historical = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' }
          },
          amount: { $sum: '$netAmount' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    const normalizedHistory = historical.map((item) => ({
      period: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      amount: item.amount || 0,
      transactions: item.transactions || 0,
    }));

    const averageAmount = normalizedHistory.length
      ? normalizedHistory.reduce((sum, item) => sum + item.amount, 0) / normalizedHistory.length
      : 0;
    const averageTransactions = normalizedHistory.length
      ? normalizedHistory.reduce((sum, item) => sum + item.transactions, 0) / normalizedHistory.length
      : 0;

    const growthFactor = normalizedHistory.length >= 2
      ? (normalizedHistory[normalizedHistory.length - 1].amount || 0) /
        Math.max(normalizedHistory[0].amount || 1, 1)
      : 1;

    const projected = Array.from({ length: 3 }, (_, index) => {
      const monthOffset = index + 1;
      const projectedAmount = averageAmount * (1 + (growthFactor - 1) * (monthOffset / 6));
      const projectedTransactions = Math.round(
        averageTransactions * (1 + (growthFactor - 1) * (monthOffset / 8))
      );
      return {
        monthOffset,
        amount: Math.max(0, Math.round(projectedAmount)),
        transactions: Math.max(0, projectedTransactions),
      };
    });

    const reportData = {
      reportType: 'forecast',
      generatedAt: new Date().toISOString(),
      summary: {
        totalAmount: normalizedHistory.reduce((sum, item) => sum + item.amount, 0),
        totalTransactions: normalizedHistory.reduce((sum, item) => sum + item.transactions, 0),
        successRate: 100,
      },
      historical: normalizedHistory,
      forecast: projected,
      recommendations: options.includeRecommendations
        ? [
            'Increase reminders before due dates to stabilize monthly cash flow.',
            'Expand digital payment options to improve forecast reliability.',
            'Track class-wise collection variance for better planning.'
          ]
        : [],
      filterApplied: filter,
      options,
    };

    return reportData;
  } catch (error) {
    console.error('Generate forecast report error:', error);
    throw error;
  }
};