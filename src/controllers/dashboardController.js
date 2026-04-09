import asyncHandler from "../utils/asyncHandler.js";
import Payment from "../models/Payment.js";
import FeeStructure from "../models/FeeStructure.js";
import Attendance from "../models/Attendance.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
import Teacher from "../models/Teacher.js";

/**
 * @desc    Get complete dashboard data with fees and attendance
 * @route   GET /api/dashboard/admin-summary
 * @access  Private (Admin/Owner)
 */
export const getAdminDashboardSummary = asyncHandler(async (req, res) => {
  try {
    const { month, year } = req.query;
    const presentValues = ["present", "true", true];
    const absentValues = ["absent", "false", false];
    
    // Get current month/year if not specified
    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();

    // ==================== STUDENTS & USER STATS ====================
    const totalStudents = await Student.countDocuments({ status: "active" });
    const totalTeachers = await Teacher.countDocuments();
    const totalUsers = await User.countDocuments({ active: true });
    const totalActiveUsers = await User.countDocuments({ active: true, lastLogin: { $exists: true } });

    // ==================== FEE COLLECTION STATS ====================
    // Total collected this month
    const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const endOfMonth = new Date(targetYear, targetMonth, 0);

    const monthlyCollections = await Payment.aggregate([
      {
        $match: {
          status: { $in: ["completed", "paid"] },
          paymentDate: {
            $gte: startOfMonth,
            $lte: endOfMonth,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: "$netAmount" },
          totalTransactions: { $sum: 1 },
          averagePerTransaction: { $avg: "$netAmount" },
        },
      },
    ]);

    // Total fees vs collected - Use simpler approach without $lookup
    // First, get all payment data aggregated by studentId
    const paymentsByStudent = await Payment.aggregate([
      {
        $match: {
          status: { $in: ["completed", "paid"] }
        }
      },
      {
        $group: {
          _id: "$studentId",
          totalPaid: { $sum: "$netAmount" }
        }
      }
    ]);

    // Create a map of studentId -> totalPaid for quick lookup
    const paymentMap = {};
    paymentsByStudent.forEach(p => {
      paymentMap[p._id?.toString()] = p.totalPaid;
    });

    // Now get fee structure and calculate paid/unpaid using the payment map
    const allFeeStructures = await FeeStructure.find({});
    
    let totalFeeAmount = 0;
    let totalPaidAmount = 0;

    allFeeStructures.forEach(fee => {
      totalFeeAmount += fee.totalFee || 0;
      const studentIdStr = fee.studentId?.toString();
      const paidAmount = paymentMap[studentIdStr] || 0;
      totalPaidAmount += paidAmount;
    });

    const feeStats = [{
      totalFeeAmount: totalFeeAmount,
      totalPaidAmount: totalPaidAmount,
      totalDueAmount: Math.max(0, totalFeeAmount - totalPaidAmount)
    }];

    // Defaulters (pending dues > 0)
    const defaulters = await FeeStructure.countDocuments({
      totalDue: { $gt: 0 },
    });

    // Fee collection by class - simpler approach without $lookup
    // Group fee structures by class and calculate paid amounts
    const feeByClassMap = {};

    allFeeStructures.forEach(fee => {
      const className = fee.className || "Unknown";
      const studentIdStr = fee.studentId?.toString();
      const paidAmount = paymentMap[studentIdStr] || 0;
      const unpaidAmount = Math.max(0, (fee.totalFee || 0) - paidAmount);

      if (!feeByClassMap[className]) {
        feeByClassMap[className] = {
          className: className,
          totalFee: 0,
          paid: 0,
          unpaid: 0,
          studentCount: 0,
          totalAmount: 0
        };
      }

      feeByClassMap[className].totalFee += fee.totalFee || 0;
      feeByClassMap[className].paid += paidAmount;
      feeByClassMap[className].unpaid += unpaidAmount;
      feeByClassMap[className].studentCount += 1;
      feeByClassMap[className].totalAmount += (fee.totalFee || 0);
    });

    // Convert to array and sort
    const feeByClass = Object.values(feeByClassMap).sort((a, b) => b.totalAmount - a.totalAmount);

    // ==================== ATTENDANCE STATS ====================
    // Today's attendance
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrowStart = new Date(today);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

    const todayAttendance = await Attendance.aggregate([
      {
        $match: {
          date: {
            $gte: today,
            $lt: tomorrowStart,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalMarked: { $sum: 1 },
          presentCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $in: ["$sessions.morning", presentValues] },
                    { $in: ["$sessions.afternoon", presentValues] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          absentCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$sessions.morning", absentValues] },
                    { $in: ["$sessions.afternoon", absentValues] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Monthly attendance trend (last 7 days)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const attendanceTrend = await Attendance.aggregate([
      {
        $match: {
          date: {
            $gte: sevenDaysAgo,
            $lt: tomorrowStart,
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          totalMarked: { $sum: 1 },
          present: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $in: ["$sessions.morning", presentValues] },
                    { $in: ["$sessions.afternoon", presentValues] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          absent: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$sessions.morning", absentValues] },
                    { $in: ["$sessions.afternoon", absentValues] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Attendance by class - today
    const attendanceByClass = await Attendance.aggregate([
      {
        $match: {
          date: {
            $gte: today,
            $lt: tomorrowStart,
          },
        },
      },
      {
        $group: {
          _id: "$className",
          total: { $sum: 1 },
          present: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $in: ["$sessions.morning", presentValues] },
                    { $in: ["$sessions.afternoon", presentValues] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $addFields: {
          percentage: {
            $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 1],
          },
        },
      },
      { $sort: { percentage: -1 } },
    ]);

    // ==================== AT-RISK STUDENTS ====================
    // Students with low attendance (< 75%)
    const attendancePercentage = await Attendance.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(targetYear, targetMonth - 1, 1),
          },
        },
      },
      {
        $group: {
          _id: "$studentId",
          totalDays: { $sum: 1 },
          presentDays: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $in: ["$sessions.morning", presentValues] },
                    { $in: ["$sessions.afternoon", presentValues] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $addFields: {
          percentage: {
            $round: [{ $multiply: [{ $divide: ["$presentDays", "$totalDays"] }, 100] }, 1],
          },
        },
      },
      {
        $match: {
          percentage: { $lt: 75 },
        },
      },
    ]);

    const lowAttendanceStudents = attendancePercentage.length;

    // ==================== COMBINE RESPONSE ====================
    res.status(200).json({
      success: true,
      data: {
        // Overview Stats
        overview: {
          totalStudents,
          totalTeachers,
          totalUsers,
          activeUsers: totalActiveUsers,
          defaulters,
          lowAttendanceStudents,
        },

        // Fee Collection Data
        fees: {
          monthly: monthlyCollections[0] || {
            totalCollected: 0,
            totalTransactions: 0,
            averagePerTransaction: 0,
          },
          overall: feeStats[0] || {
            totalFeeAmount: 0,
            totalPaidAmount: 0,
            totalDueAmount: 0,
          },
          byClass: feeByClass,
        },

        // Attendance Data
        attendance: {
          today: todayAttendance[0] || {
            totalMarked: 0,
            presentCount: 0,
            absentCount: 0,
          },
          trend: attendanceTrend,
          byClass: attendanceByClass,
        },

        // Metadata
        meta: {
          month: targetMonth,
          year: targetYear,
          generatedAt: new Date(),
        },
      },
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @desc    Get fee collection chart data
 * @route   GET /api/dashboard/fee-collection
 * @access  Private (Admin/Owner)
 */
export const getFeeCollectionChart = asyncHandler(async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const data = await Payment.aggregate([
      {
        $match: {
          status: { $in: ["completed", "paid"] },
          paymentDate: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" } },
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @desc    Get attendance chart data
 * @route   GET /api/dashboard/attendance-stats
 * @access  Private (Admin/Owner)
 */
export const getAttendanceStats = asyncHandler(async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const presentValues = ["present", "true", true];
    const absentValues = ["absent", "false", false];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const data = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          total: { $sum: 1 },
          present: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $in: ["$sessions.morning", presentValues] },
                    { $in: ["$sessions.afternoon", presentValues] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          absent: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$sessions.morning", absentValues] },
                    { $in: ["$sessions.afternoon", absentValues] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $addFields: {
          percentage: {
            $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 1],
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
