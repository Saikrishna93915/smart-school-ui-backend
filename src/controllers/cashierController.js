// controllers/cashierController.js - Cashier Portal (Fee Collection)
import Payment from "../models/Payment.js";
import Receipt from "../models/Receipt.js";
import Student from "../models/Student.js";
import asyncHandler from "../utils/asyncHandler.js";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import ShiftSession from "../models/ShiftSession.js";
import Cashier from "../models/Cashier.js";
import { ReceiptService } from "../services/receiptService.js";
import {
  reversePaymentFromFeeStructure,
  reversePaymentFromShift,
} from "../services/cashierAccountingService.js";

// @desc    Get cashier dashboard stats
// @route   GET /api/cashier/dashboard
export const getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  
  // FIXED: Use UTC date ranges to match how dates are stored in MongoDB
  // When frontend sends "2026-03-16", it becomes 2026-03-16T00:00:00.000Z in UTC
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  
  // Create UTC date range for today (00:00:00 to 23:59:59.999 in UTC)
  const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  
  // Create UTC date range for current month
  const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  // FIXED: Use paymentDate instead of createdAt to match Payment History API
  // FIXED: Use correct status values - "completed" for receipts, "paid" for payments
  const [todayByMode, receiptCount, monthlyAgg, recentTransactions, weeklyAgg] = await Promise.all([
    Payment.aggregate([
      { $match: {
          paymentDate: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ["paid", "completed"] }
        }
      },
      { $group: { _id: "$paymentMethod", total: { $sum: { $ifNull: ["$amount", "$netAmount"] } }, count: { $sum: 1 } } }
    ]),
    Payment.countDocuments({ paymentDate: { $gte: startOfDay, $lte: endOfDay } }),
    Payment.aggregate([
      { $match: {
          paymentDate: { $gte: startOfMonth, $lte: endOfMonth },
          status: { $in: ["paid", "completed"] }
        }
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", "$netAmount"] } } } }
    ]),
    Payment.find({ status: { $in: ["paid", "completed"] } })
      .populate("studentId", "student class admissionNumber parents")
      .sort({ paymentDate: -1 })
      .limit(10)
      .select("receiptNumber amount paymentMethod paymentDate studentId"),
    Payment.aggregate([
      { $match: {
          paymentDate: { $gte: new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000) },
          status: { $in: ["paid", "completed"] }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" } },
          total: { $sum: { $ifNull: ["$amount", "$netAmount"] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);

  // FIXED: Use FeeStructure collection (same as Fee Defaulters page) instead of StudentFee model
  const db = mongoose.connection.db;
  const feeStructureCollection = db.collection('feestructures');
  const studentsCollection = db.collection('students');
  const paymentsCollection = db.collection('payments');

  // Build aggregation pipeline for pending dues (matching fee defaulters logic)
  const currentDate = new Date();
  const pendingDuesPipeline = [
    {
      $match: {
        totalDue: { $gt: 0 },
        status: { $ne: 'inactive' }
      }
    },
    {
      $lookup: {
        from: 'students',
        localField: 'admissionNumber',
        foreignField: 'admissionNumber',
        as: 'studentDetails'
      }
    },
    {
      $unwind: {
        path: '$studentDetails',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'payments',
        let: { admissionNumber: '$admissionNumber' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$admissionNumber', '$$admissionNumber'] },
                  { $in: ['$paymentType', ['installment', null, undefined]] },
                  { $gt: ['$dueAmount', 0] }
                ]
              }
            }
          },
          { $sort: { dueDate: 1 } }
        ],
        as: 'dueInstallments'
      }
    },
    {
      $lookup: {
        from: 'payments',
        let: { admissionNumber: '$admissionNumber' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$admissionNumber', '$$admissionNumber'] },
                  { $eq: ['$paymentType', 'receipt'] },
                  { $eq: ['$status', 'completed'] }
                ]
              }
            }
          },
          { $sort: { paymentDate: -1 } },
          { $limit: 1 }
        ],
        as: 'recentPayments'
      }
    },
    {
      $addFields: {
        daysOverdue: {
          $let: {
            vars: {
              earliestDue: {
                $arrayElemAt: ['$dueInstallments', 0]
              }
            },
            in: {
              $cond: {
                if: { $and: [
                  { $ne: ['$$earliestDue', null] },
                  { $ne: ['$$earliestDue.dueDate', null] }
                ] },
                then: {
                  $floor: {
                    $divide: [
                      { $subtract: [currentDate, '$$earliestDue.dueDate'] },
                      1000 * 60 * 60 * 24
                    ]
                  }
                },
                else: {
                  $floor: {
                    $divide: [
                      { $subtract: [currentDate, '$dueDate'] },
                      1000 * 60 * 60 * 24
                    ]
                  }
                }
              }
            }
          }
        },
        lastPaymentDate: {
          $cond: {
            if: { $gt: [{ $size: '$recentPayments' }, 0] },
            then: { $max: '$recentPayments.paymentDate' },
            else: null
          }
        }
      }
    },
    {
      $addFields: {
        priority: {
          $switch: {
            branches: [
              {
                case: {
                  $or: [
                    { $gt: ['$daysOverdue', 30] },
                    { $gt: ['$totalDue', 50000] }
                  ]
                },
                then: 1
              },
              {
                case: {
                  $or: [
                    { $and: [{ $gte: ['$daysOverdue', 15] }, { $lte: ['$daysOverdue', 30] }] },
                    { $and: [{ $gt: ['$totalDue', 20000] }, { $lte: ['$totalDue', 50000] }] }
                  ]
                },
                then: 2
              },
              {
                case: {
                  $or: [
                    { $and: [{ $gte: ['$daysOverdue', 7] }, { $lt: ['$daysOverdue', 15] }] },
                    { $and: [{ $gt: ['$totalDue', 5000] }, { $lte: ['$totalDue', 20000] }] }
                  ]
                },
                then: 3
              }
            ],
            default: 4
          }
        }
      }
    },
    {
      $addFields: {
        status: {
          $switch: {
            branches: [
              { case: { $eq: ['$priority', 1] }, then: 'Critical' },
              { case: { $eq: ['$priority', 2] }, then: 'High' },
              { case: { $eq: ['$priority', 3] }, then: 'Moderate' }
            ],
            default: 'Low'
          }
        }
      }
    },
    {
      $sort: { daysOverdue: -1 }
    },
    {
      $limit: 100
    },
    {
      $project: {
        studentId: '$admissionNumber',
        studentName: 1,
        admissionNumber: 1,
        className: 1,
        section: 1,
        totalFee: '$totalFee',
        totalPaid: '$totalPaid',
        pendingAmount: '$totalDue',
        dueDate: 1,
        daysOverdue: 1,
        status: 1,
        priority: 1,
        parentPhone: {
          $ifNull: [
            '$studentDetails.parents.father.phone',
            '$studentDetails.parents.mother.phone',
            'N/A'
          ]
        },
        lastPaymentDate: 1,
        lastPaymentAmount: {
          $cond: {
            if: { $gt: [{ $size: '$recentPayments' }, 0] },
            then: { $arrayElemAt: ['$recentPayments.netAmount', 0] },
            else: null
          }
        }
      }
    }
  ];

  const pendingDuesRaw = await feeStructureCollection.aggregate(pendingDuesPipeline).toArray();

  // Format pending dues for frontend
  const pendingDues = pendingDuesRaw.map(fee => ({
    studentId: fee.admissionNumber || "",
    studentName: fee.studentName || 
      `${fee.studentDetails?.student?.firstName || ''} ${fee.studentDetails?.student?.lastName || ''}`.trim() || "Unknown",
    admissionNumber: fee.admissionNumber || "",
    class: fee.className || "",
    section: fee.section || "",
    totalFee: fee.totalFee || 0,
    paidAmount: fee.totalPaid || 0,
    pendingAmount: fee.totalDue || 0,
    dueDate: fee.dueDate,
    daysOverdue: fee.daysOverdue || 0,
    parentPhone: fee.parentPhone || "N/A",
    lastPaymentDate: fee.lastPaymentDate,
    lastPaymentAmount: fee.lastPaymentAmount,
    status: fee.status || 'Low',
    priority: fee.priority || 4
  }));

  const todayTotal = todayByMode.reduce((sum, m) => sum + m.total, 0);
  const todayCount = todayByMode.reduce((sum, m) => sum + m.count, 0);

  // Transform recentTransactions to match frontend expected structure
  const formattedTransactions = recentTransactions.map(tx => ({
    _id: tx._id,
    receiptNumber: tx.receiptNumber,
    amount: tx.amount,
    paymentMethod: tx.paymentMethod,
    status: tx.status,
    paymentDate: tx.paymentDate,
    createdAt: tx.paymentDate,
    studentId: tx.studentId ? {
      personal: {
        firstName: tx.studentId.student?.firstName || "",
        lastName: tx.studentId.student?.lastName || ""
      },
      academic: {
        class: tx.studentId.class?.className || "",
        section: tx.studentId.class?.section || "",
        admissionNumber: tx.studentId.admissionNumber || ""
      },
      parents: {
        father: tx.studentId.parents?.father || null,
        mother: tx.studentId.parents?.mother || null
      }
    } : null
  }));

  // Calculate hourly collection from weekly trend
  const hourlyCollection = weeklyAgg.map(item => ({
    hour: new Date(item._id).getHours(),
    amount: item.total,
    count: item.count
  }));

  // Format method breakdown
  const methodBreakdown = {
    cash: todayByMode.find(m => m._id === 'cash') || { total: 0, count: 0 },
    online: todayByMode.find(m => m._id === 'online') || { total: 0, count: 0 },
    cheque: todayByMode.find(m => m._id === 'cheque') || { total: 0, count: 0 },
    dd: todayByMode.find(m => m._id === 'dd') || { total: 0, count: 0 },
    upi: todayByMode.find(m => m._id === 'upi') || { total: 0, count: 0 }
  };

  // Calculate daily target (assuming ₹50,000 default target)
  const dailyTarget = 50000;
  const targetAchieved = todayTotal;
  const targetPercentage = Math.min(100, Math.round((targetAchieved / dailyTarget) * 100));

  res.json({
    success: true,
    data: {
      todayTotal,
      receiptCount,
      pendingCount: pendingDues.length,
      monthlyTotal: monthlyAgg[0]?.total || 0,
      pendingDues,
      recentTransactions: formattedTransactions,
      hourlyCollection,
      methodBreakdown: {
        cash: { amount: methodBreakdown.cash.total || 0, count: methodBreakdown.cash.count || 0 },
        online: { amount: methodBreakdown.online.total || 0, count: methodBreakdown.online.count || 0 },
        cheque: { amount: methodBreakdown.cheque.total || 0, count: methodBreakdown.cheque.count || 0 },
        dd: { amount: methodBreakdown.dd.total || 0, count: methodBreakdown.dd.count || 0 },
        upi: { amount: methodBreakdown.upi.total || 0, count: methodBreakdown.upi.count || 0 }
      },
      target: {
        target: dailyTarget,
        achieved: targetAchieved,
        percentage: targetPercentage
      },
      averageTransaction: todayCount > 0 ? todayTotal / todayCount : 0,
      peakHour: hourlyCollection.length > 0 ? 
        hourlyCollection.reduce((max, h) => h.amount > max.amount ? h : max, hourlyCollection[0]).hour : 10,
      cashierName: req.user?.name || "Cashier",
      shiftStart: "09:00 AM",
      weeklyTrend: weeklyAgg
    }
  });
});

// @desc    Get daily collection report
// @route   GET /api/cashier/daily-report
export const getDailyCollectionReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const reportDate = date ? new Date(date) : new Date();
  
  // FIXED: Use UTC date ranges to match how dates are stored in MongoDB
  const year = reportDate.getUTCFullYear();
  const month = reportDate.getUTCMonth();
  const day = reportDate.getUTCDate();
  
  const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

  const prevDayStart = new Date(startOfDay); prevDayStart.setUTCDate(prevDayStart.getUTCDate() - 1);
  const prevDayEnd = new Date(endOfDay); prevDayEnd.setUTCDate(prevDayEnd.getUTCDate() - 1);

  const weekStart = new Date(startOfDay); weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
  const weekEnd = new Date(endOfDay);

  // FIXED: Use paymentDate instead of createdAt to match Payment History API
  // FIXED: Use correct status values - "completed" for receipts, "paid" for payments
  const [payments, prevDayPayments, weekPayments] = await Promise.all([
    Payment.find({
      paymentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ["paid", "completed"] }
    })
      .populate("studentId", "student class parents admissionNumber")
      .sort({ paymentDate: -1 }),
    Payment.find({
      paymentDate: { $gte: prevDayStart, $lte: prevDayEnd },
      status: { $in: ["paid", "completed"] }
    }),
    Payment.find({
      paymentDate: { $gte: weekStart, $lte: weekEnd },
      status: { $in: ["paid", "completed"] }
    })
  ]);

  const transactions = payments.map(p => ({
    _id: p._id,
    receiptNumber: p.receiptNumber || `REC-${p._id.toString().substring(0, 6)}`,
    amount: p.amount || p.totalAmount || 0,
    paymentMethod: p.paymentMethod ? p.paymentMethod.toLowerCase() : "other",
    status: p.status,
    paymentDate: p.paymentDate,
    createdAt: p.paymentDate, // Map paymentDate to createdAt for frontend compatibility
    studentId: p.studentId ? {
      personal: {
        firstName: p.studentId.student?.firstName || p.studentName?.split(" ")[0] || "",
        lastName: p.studentId.student?.lastName || p.studentName?.split(" ").slice(1).join(" ") || ""
      },
      academic: {
        class: p.studentId.class?.className || p.className || "",
        section: p.studentId.class?.section || p.section || "",
        admissionNumber: p.studentId.admissionNumber || p.admissionNumber || ""
      },
      parent: {
        fatherName: p.studentId.parents?.father?.name || "",
        motherName: p.studentId.parents?.mother?.name || ""
      }
    } : {
      personal: { firstName: p.studentName || "N/A", lastName: "" },
      academic: { class: p.className || "N/A", section: p.section || "", admissionNumber: p.admissionNumber || "N/A" },
      parent: {}
    },
    feeType: (p.breakdown || []).map(b => ({
      name: b.name,
      description: b.category || b.name,
      amount: b.amount
    })),
    receivedBy: { 
      _id: req.user?._id || "cashier1", 
      name: req.user?.name || "Nagendra Daddanala" 
    }
  }));

  const summary = {
    total: 0, cash: 0, online: 0, cheque: 0, dd: 0, upi: 0, other: 0,
    count: transactions.length, cashCount: 0, onlineCount: 0, chequeCount: 0, ddCount: 0, upiCount: 0, otherCount: 0,
    averageTransaction: 0, highestTransaction: 0, lowestTransaction: 0
  };

  const hourlyBreakdownMap = Array.from({ length: 24 }, (_, i) => ({ hour: i, amount: 0, count: 0 }));

  if (transactions.length > 0) {
    summary.lowestTransaction = transactions[0].amount;
  }

  transactions.forEach(tx => {
    const amount = tx.amount || 0;
    summary.total += amount;

    if (amount > summary.highestTransaction) summary.highestTransaction = amount;
    if (amount < summary.lowestTransaction) summary.lowestTransaction = amount;

    const method = tx.paymentMethod;
    if (method === "cash") { summary.cash += amount; summary.cashCount++; }
    else if (method === "online" || method === "neft") { summary.online += amount; summary.onlineCount++; }
    else if (method === "cheque") { summary.cheque += amount; summary.chequeCount++; }
    else if (method === "dd" || method === "demand draft") { summary.dd += amount; summary.ddCount++; }
    else if (method === "upi") { summary.upi += amount; summary.upiCount++; }
    else { summary.other += amount; summary.otherCount++; }

    const hour = new Date(tx.createdAt).getHours();
    hourlyBreakdownMap[hour].amount += amount;
    hourlyBreakdownMap[hour].count++;
  });

  summary.averageTransaction = summary.count > 0 ? summary.total / summary.count : 0;

  const paymentMethods = [
    { method: "cash", amount: summary.cash, count: summary.cashCount, percentage: summary.total ? (summary.cash / summary.total) * 100 : 0 },
    { method: "online", amount: summary.online, count: summary.onlineCount, percentage: summary.total ? (summary.online / summary.total) * 100 : 0 },
    { method: "cheque", amount: summary.cheque, count: summary.chequeCount, percentage: summary.total ? (summary.cheque / summary.total) * 100 : 0 },
    { method: "dd", amount: summary.dd, count: summary.ddCount, percentage: summary.total ? (summary.dd / summary.total) * 100 : 0 },
    { method: "upi", amount: summary.upi, count: summary.upiCount, percentage: summary.total ? (summary.upi / summary.total) * 100 : 0 },
  ];

  const prevTotal = prevDayPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const diff = summary.total - prevTotal;
  const percChange = prevTotal ? (diff / prevTotal) * 100 : 0;

  const weekTotal = weekPayments.reduce((acc, p) => acc + (p.amount || 0), 0) + summary.total;
  const daysInWeekSoFar = Math.max(1, startOfDay.getDay() + 1);

  res.json({
    success: true,
    data: {
      summary,
      payments: transactions,
      hourlyBreakdown: hourlyBreakdownMap.filter(h => h.count > 0 || h.amount > 0),
      paymentMethods,
      previousDayComparison: {
        date: prevDayStart.toISOString(),
        total: prevTotal,
        difference: diff,
        percentageChange: percChange
      },
      weekToDate: {
        total: weekTotal,
        average: weekTotal / daysInWeekSoFar
      }
    }
  });
});

// @desc    Get cashier receipts (paginated)
// @route   GET /api/cashier/receipts
export const getCashierReceipts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    fromDate,
    toDate,
    class: cls,
    section,
    paymentMethod,
    search,
    status,
    minAmount,
    maxAmount,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const cashier = await Cashier.findOne({
    $or: [{ user: req.user._id }, { userId: req.user._id }],
    isDeleted: false,
  });

  const query = {
    $or: [{ collectedBy: req.user._id }, { recordedBy: req.user._id }],
  };

  if (cashier?.employeeId) {
    query.$or.push({ cashierId: cashier.employeeId });
  }

  if (fromDate || toDate) {
    query.paymentDate = {};

    if (fromDate) {
      const fromDateObj = new Date(fromDate);
      query.paymentDate.$gte = new Date(
        Date.UTC(
          fromDateObj.getUTCFullYear(),
          fromDateObj.getUTCMonth(),
          fromDateObj.getUTCDate(),
          0,
          0,
          0,
          0
        )
      );
    }

    if (toDate) {
      const toDateObj = new Date(toDate);
      query.paymentDate.$lte = new Date(
        Date.UTC(
          toDateObj.getUTCFullYear(),
          toDateObj.getUTCMonth(),
          toDateObj.getUTCDate(),
          23,
          59,
          59,
          999
        )
      );
    }
  }

  if (paymentMethod && paymentMethod !== "all") query.paymentMethod = paymentMethod;

  if (status && status !== "all") {
    query.status = status === "void" ? "cancelled" : status;
  } else {
    query.status = { $in: ["paid", "completed", "cancelled"] };
  }

  if (minAmount || maxAmount) {
    query.amount = {};
    if (minAmount) query.amount.$gte = Number(minAmount);
    if (maxAmount) query.amount.$lte = Number(maxAmount);
  }

  // Search or filter by student
  if (search || cls || section) {
    const studentQuery = {};
    if (search) {
      studentQuery.$or = [
        { "student.firstName": { $regex: search, $options: "i" } },
        { "student.lastName": { $regex: search, $options: "i" } },
        { admissionNumber: { $regex: search, $options: "i" } }
      ];
    }
    if (cls) studentQuery["class.className"] = cls;
    if (section) studentQuery["class.section"] = section;

    const students = await Student.find(studentQuery).select("_id");
    query.studentId = { $in: students.map(s => s._id) };
  }

  const sortField = ["receiptNumber", "createdAt", "amount", "paymentDate"].includes(String(sortBy))
    ? (sortBy === "createdAt" ? "paymentDate" : String(sortBy))
    : "paymentDate";
  const sortDirection = sortOrder === "asc" ? 1 : -1;

  const [payments, total, todayStats, weekStats, monthStats, overallStats] = await Promise.all([
    Payment.find(query)
      .populate("studentId", "student class parents admissionNumber")
      .sort({ [sortField]: sortDirection, createdAt: sortDirection })
      .skip(skip)
      .limit(Number(limit)),
    Payment.countDocuments(query),
    Payment.aggregate([
      {
        $match: {
          ...query,
          paymentDate: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      },
      { $group: { _id: null, totalCount: { $sum: 1 }, totalAmount: { $sum: { $ifNull: ["$amount", "$netAmount"] } } } },
    ]),
    Payment.aggregate([
      {
        $match: {
          ...query,
          paymentDate: {
            $gte: new Date(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).setHours(0, 0, 0, 0)),
            $lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      },
      { $group: { _id: null, totalCount: { $sum: 1 }, totalAmount: { $sum: { $ifNull: ["$amount", "$netAmount"] } } } },
    ]),
    Payment.aggregate([
      {
        $match: {
          ...query,
          paymentDate: {
            $gte: new Date(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
            $lte: new Date(),
          },
        },
      },
      { $group: { _id: null, totalCount: { $sum: 1 }, totalAmount: { $sum: { $ifNull: ["$amount", "$netAmount"] } } } },
    ]),
    Payment.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ["$amount", "$netAmount"] } },
          averageAmount: { $avg: { $ifNull: ["$amount", "$netAmount"] } },
          cashTotal: {
            $sum: { $cond: [{ $eq: ["$paymentMethod", "cash"] }, { $ifNull: ["$amount", "$netAmount"] }, 0] },
          },
          onlineTotal: {
            $sum: { $cond: [{ $in: ["$paymentMethod", ["online", "card", "bank-transfer"]] }, { $ifNull: ["$amount", "$netAmount"] }, 0] },
          },
          chequeTotal: {
            $sum: { $cond: [{ $in: ["$paymentMethod", ["cheque", "dd"]] }, { $ifNull: ["$amount", "$netAmount"] }, 0] },
          },
          upiTotal: {
            $sum: { $cond: [{ $eq: ["$paymentMethod", "upi"] }, { $ifNull: ["$amount", "$netAmount"] }, 0] },
          },
          voidCount: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
          voidAmount: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, { $ifNull: ["$amount", "$netAmount"] }, 0] },
          },
        },
      },
    ]),
  ]);

  const formattedReceipts = payments.map(p => ({
    _id: p._id,
    receiptNumber: p.receiptNumber || `REC-${p._id.toString().substring(0, 6)}`,
    amount: p.amount || p.totalAmount || 0,
    paymentMethod: p.paymentMethod ? p.paymentMethod.toLowerCase() : "other",
    status: p.status,
    createdAt: p.createdAt,
    studentId: p.studentId ? {
      personal: {
        firstName: p.studentId.student?.firstName || p.studentName?.split(" ")[0] || "",
        lastName: p.studentId.student?.lastName || p.studentName?.split(" ").slice(1).join(" ") || ""
      },
      academic: {
        class: p.studentId.class?.className || p.className || "",
        section: p.studentId.class?.section || p.section || "",
        admissionNumber: p.studentId.admissionNumber || p.admissionNumber || ""
      },
      parent: {
        fatherName: p.studentId.parents?.father?.name || "",
        motherName: p.studentId.parents?.mother?.name || ""
      }
    } : {
      personal: { firstName: p.studentName || "N/A", lastName: "" },
      academic: { class: p.className || "N/A", section: p.section || "", admissionNumber: p.admissionNumber || "N/A" },
      parent: {}
    },
    feeType: (p.breakdown || []).map(b => ({
      name: b.name,
      description: b.category || b.name,
      amount: b.amount
    })),
    receivedBy: { 
      _id: p.collectedBy || p.recordedBy || "cashier1", 
      name: p.cashierName || p.recordedByName || "Unknown" 
    }
  }));

  res.json({
    success: true,
    data: {
      receipts: formattedReceipts,
      stats: {
        totalCount: overallStats[0]?.totalCount || 0,
        totalAmount: overallStats[0]?.totalAmount || 0,
        cashTotal: overallStats[0]?.cashTotal || 0,
        onlineTotal: overallStats[0]?.onlineTotal || 0,
        chequeTotal: overallStats[0]?.chequeTotal || 0,
        upiTotal: overallStats[0]?.upiTotal || 0,
        averageAmount: overallStats[0]?.averageAmount || 0,
        todayCount: todayStats[0]?.totalCount || 0,
        todayAmount: todayStats[0]?.totalAmount || 0,
        thisWeekCount: weekStats[0]?.totalCount || 0,
        thisWeekAmount: weekStats[0]?.totalAmount || 0,
        thisMonthCount: monthStats[0]?.totalCount || 0,
        thisMonthAmount: monthStats[0]?.totalAmount || 0,
        voidCount: overallStats[0]?.voidCount || 0,
        voidAmount: overallStats[0]?.voidAmount || 0,
      },
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    }
  });
});

// @desc    Void transaction
// @route   POST /api/cashier/transactions/:id/void
export const voidTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let payment = await Payment.findById(id).session(session);
    let receipt = null;

    if (!payment) {
      receipt = await Receipt.findById(id).session(session);
      if (receipt?.paymentId) {
        payment = await Payment.findById(receipt.paymentId).session(session);
      }
    } else {
      receipt = await Receipt.findOne({ paymentId: payment._id }).session(session);
    }

    if (!payment) {
      await session.abortTransaction();
      res.status(404);
      throw new Error("Transaction not found");
    }

    if (payment.status === "cancelled") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Transaction is already cancelled",
      });
    }

    payment.status = "cancelled";
    payment.voidReason = reason || "Voided by cashier";
    payment.voidedBy = req.user._id;
    payment.voidedAt = new Date();

    await reversePaymentFromFeeStructure(payment, session);

    if (payment.shiftId) {
      const shift = await ShiftSession.findById(payment.shiftId).session(session);
      if (shift) {
        await reversePaymentFromShift(shift, payment, session);
      }
    }

    await payment.save({ session });

    if (receipt) {
      receipt.status = "cancelled";
      receipt.remarks = reason || "Voided by cashier";
      await receipt.save({ session });
    }

    await session.commitTransaction();
    res.json({ success: true, message: "Transaction voided successfully", data: payment });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// @desc    Mark receipt as printed and save to C: Drive
// @route   POST /api/cashier/receipts/:id/print
export const markReceiptPrinted = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  let receipt = await Receipt.findById(id).populate("studentId");
  
  // if not found in Receipt, try Payment
  if (!receipt) {
    receipt = await Payment.findById(id).populate("studentId");
    if (!receipt) {
      res.status(404);
      throw new Error("Receipt not found");
    }
  }

  // Define slip folder inside C Drive
  const saveDir = 'C:\\CashierSlips';
  try {
    if (!fs.existsSync(saveDir)) {
      // Create folder recursively
      fs.mkdirSync(saveDir, { recursive: true });
    }
    
    // Create slip text content (for simplicity, storing as a text slip)
    // Detailed slips can also be generated as PDFs using libraries, but text is fine.
    const slipContent = `
=============================================
             FEE RECEIPT SLIP                
=============================================
Receipt ID : ${receipt.receiptNumber || receipt._id}
Date       : ${new Date(receipt.createdAt || Date.now()).toLocaleString('en-IN')}
Amount     : INR ${receipt.amount || receipt.amountDetails?.netAmount || 0}
Student ID : ${receipt.studentId ? (receipt.studentId.admissionNumber || receipt.studentId._id) : 'N/A'}
Status     : ${receipt.status}
=============================================
  CASHIER PORTAL - SAVED AUTOMATICALLY
=============================================
`;

    // Save strictly to local C: Drive
    const fileName = `Slip_${receipt.receiptNumber || receipt._id}.txt`;
    const filePath = path.join(saveDir, fileName);
    
    fs.writeFileSync(filePath, slipContent);
    
    console.log(`Slip saved to C Drive at: ${filePath}`);
  } catch (error) {
    console.error("Failed to save slip to C drive:", error);
    // Ignore error, but log it so backend continues properly
  }

  // Update DB flag
  if (receipt.printed !== undefined) {
    receipt.printed = true;
    receipt.printedAt = new Date();
    await receipt.save();
  }

  res.json({ success: true, message: "Receipt marked as printed and saved to local C Drive" });
});

// @desc    Email receipt
// @route   POST /api/cashier/receipts/:id/email
export const emailReceipt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  let receipt = await Receipt.findById(id);

  if (!receipt) {
    const payment = await Payment.findById(id);
    if (!payment?.receiptNumber) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found",
      });
    }

    receipt = await Receipt.findOne({ receiptNumber: payment.receiptNumber });
  }

  if (!receipt) {
    return res.status(404).json({
      success: false,
      message: "Receipt not found",
    });
  }

  await ReceiptService.sendEmailReceipt(receipt.receiptNumber, email);

  res.json({
    success: true,
    message: "Receipt emailed successfully",
  });
});
