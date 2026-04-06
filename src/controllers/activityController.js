import Attendance from "../models/Attendance.js";
import FeeStructure from "../models/FeeStructure.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
import Exam from "../models/Exam.js";
import Teacher from "../models/Teacher.js";
import ApiResponse from "../utils/ApiResponse.js";

/**
 * @desc    Get recent activities across the system with filtering
 * @route   GET /api/activities/recent
 * @access  Private (Admin/Owner)
 */
export const getRecentActivities = async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const type = req.query.type || 'all'; // all, attendance, fee, admission, exam, teacher, vehicle
  const days = parseInt(req.query.days) || 7;
  const feeSort = req.query.feeSort || 'highest'; // highest or lowest
  const activities = [];

  try {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 1. Class-Level Attendance Activities
    if (type === 'all' || type === 'attendance') {
      const attendanceByClass = await Attendance.aggregate([
        {
          $match: {
            date: { $gte: cutoffDate },
            updatedAt: { $exists: true }
          }
        },
        {
          $group: {
            _id: {
              className: '$className',
              section: '$section',
              date: '$date'
            },
            count: { $sum: 1 },
            lastUpdated: { $max: '$updatedAt' }
          }
        },
        { $sort: { lastUpdated: -1 } },
        { $limit: Math.ceil(limit / 4) }
      ]);

      for (const record of attendanceByClass) {
        const timeAgo = getTimeAgo(record.lastUpdated);
        activities.push({
          id: `attendance-${record._id.className}-${record._id.section}-${record._id.date}`,
          user: 'Teacher',
          action: 'marked attendance for',
          target: `${record._id.className}-${record._id.section} (${record.count} students)`,
          time: timeAgo,
          type: 'attendance',
          timestamp: record.lastUpdated,
          metadata: {
            className: record._id.className,
            section: record._id.section,
            studentCount: record.count
          }
        });
      }
    }

    // 2. Fee Payment Activities
    if (type === 'all' || type === 'fee') {
      const feeSortOrder = feeSort === 'highest' ? -1 : 1;
      // Look for fee records updated recently with actual amounts (exclude ₹0)
      const recentFeeUpdates = await FeeStructure.find({
        updatedAt: { $gte: cutoffDate },
        $or: [
          { totalPaid: { $gt: 0 } },  // Paid some fee
          { totalDue: { $gt: 0 } }     // Has due amount
        ]
      })
        .sort({ totalDue: feeSortOrder, totalPaid: feeSortOrder, updatedAt: -1 })
        .limit(Math.ceil(limit / 5))
        .lean();

      for (const fee of recentFeeUpdates) {
        const studentName = fee.studentName || 'Unknown Student';
        const className = fee.className || 'N/A';
        const section = fee.section || 'N/A';
        const rollNumber = fee.admissionNumber || 'N/A';
        const amountDue = fee.totalDue || 0;
        const amountPaid = fee.totalPaid || 0;
        
        // Show the amount due or paid (whichever is higher)
        const displayAmount = amountDue > 0 ? amountDue : amountPaid;
        const action = amountPaid > 0 ? 'paid fee amount' : 'fee due for';
        const timeAgo = getTimeAgo(fee.updatedAt);
        
        activities.push({
          id: `fee-${fee._id}`,
          user: amountPaid > 0 ? 'Parent/Admin' : 'Admin',
          action: action,
          target: `${studentName} (Roll: ${rollNumber}) - ${className}-${section} - ₹${displayAmount}`,
          time: timeAgo,
          type: 'fee',
          timestamp: fee.updatedAt,
          metadata: {
            studentName,
            rollNumber,
            className,
            section,
            amountDue: amountDue,
            amountPaid: amountPaid,
            admissionNumber: fee.admissionNumber,
            displayAmount: displayAmount
          }
        });
      }
    }

    // 3. Student Admissions
    if (type === 'all' || type === 'admission') {
      const recentStudents = await Student.find({
        createdAt: { $gte: cutoffDate }
      })
        .sort({ createdAt: -1 })
        .limit(Math.ceil(limit / 5))
        .lean();

      for (const student of recentStudents) {
        const timeAgo = getTimeAgo(student.createdAt);
        activities.push({
          id: `admission-${student._id}`,
          user: 'Admin',
          action: 'admitted new student',
          target: `${student.name} in ${student.className}-${student.section}`,
          time: timeAgo,
          type: 'admission',
          timestamp: student.createdAt,
          metadata: {
            studentName: student.name,
            className: student.className,
            section: student.section,
            admissionNumber: student.admissionNumber
          }
        });
      }
    }

    // 4. Teacher Activities
    if (type === 'all' || type === 'teacher') {
      const recentTeachers = await Teacher.find({
        $or: [
          { createdAt: { $gte: cutoffDate } },
          { updatedAt: { $gte: cutoffDate } }
        ]
      })
        .sort({ updatedAt: -1 })
        .limit(Math.ceil(limit / 6))
        .lean();

      for (const teacher of recentTeachers) {
        const isNew = teacher.createdAt >= cutoffDate;
        const timeAgo = getTimeAgo(isNew ? teacher.createdAt : teacher.updatedAt);
        const subjects = teacher.subjects?.join(', ') || 'N/A';
        
        activities.push({
          id: `teacher-${teacher._id}`,
          user: 'Admin',
          action: isNew ? 'added new teacher' : 'updated teacher profile',
          target: `${teacher.name} (${subjects})`,
          time: timeAgo,
          type: 'teacher',
          timestamp: isNew ? teacher.createdAt : teacher.updatedAt,
          metadata: {
            teacherName: teacher.name,
            subjects: teacher.subjects,
            qualification: teacher.qualification
          }
        });
      }
    }

    // 5. Exam Schedules
    if (type === 'all' || type === 'exam') {
      const recentExams = await Exam.find({
        createdAt: { $gte: cutoffDate }
      })
        .sort({ createdAt: -1 })
        .limit(Math.ceil(limit / 6))
        .lean();

      for (const exam of recentExams) {
        const timeAgo = getTimeAgo(exam.createdAt);
        activities.push({
          id: `exam-${exam._id}`,
          user: 'Admin',
          action: 'scheduled exam',
          target: `${exam.examName} for ${exam.className}-${exam.section} on ${new Date(exam.date).toLocaleDateString()}`,
          time: timeAgo,
          type: 'exam',
          timestamp: exam.createdAt,
          metadata: {
            examName: exam.examName,
            className: exam.className,
            section: exam.section,
            date: exam.date
          }
        });
      }
    }

    // 6. User Management Activities
    if (type === 'all' || type === 'user') {
      const recentUsers = await User.find({
        createdAt: { $gte: cutoffDate }
      })
        .sort({ createdAt: -1 })
        .limit(Math.ceil(limit / 6))
        .select('name role createdAt')
        .lean();

      for (const user of recentUsers) {
        const timeAgo = getTimeAgo(user.createdAt);
        activities.push({
          id: `user-${user._id}`,
          user: 'Admin',
          action: 'created user account',
          target: `${user.name} (${user.role})`,
          time: timeAgo,
          type: 'user',
          timestamp: user.createdAt,
          metadata: {
            userName: user.name,
            role: user.role
          }
        });
      }
    }

    // Sort all activities by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, limit);

    // Remove timestamp before sending (used for sorting only)
    const cleanedActivities = limitedActivities.map(({ timestamp, ...rest }) => rest);

    res.json(
      ApiResponse.success('Recent activities fetched successfully', {
        activities: cleanedActivities,
        total: cleanedActivities.length,
        filters: {
          type,
          days,
          limit,
          feeSort
        }
      })
    );
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json(
      ApiResponse.error('Failed to fetch recent activities', 500)
    );
  }
};

/**
 * @desc    Get top fee defaulters
 * @route   GET /api/activities/top-defaulters
 * @access  Private (Admin/Owner)
 */
export const getTopDefaulters = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  try {
    const defaulters = await FeeStructure.find({
      dueAmount: { $gt: 0 }
    })
      .sort({ dueAmount: -1 })
      .limit(limit)
      .populate('studentId', 'name className section fatherName')
      .lean();

    const formattedDefaulters = defaulters.map((fee) => ({
      id: fee._id.toString(),
      studentName: fee.studentId?.name || 'Unknown',
      fatherName: fee.studentId?.fatherName || 'N/A',
      className: fee.studentId?.className || fee.className,
      section: fee.studentId?.section || fee.section,
      dueAmount: fee.dueAmount,
      totalAmount: fee.totalAmount,
      paidAmount: fee.totalPaid || 0,
      dueDate: fee.dueDate
    }));

    res.json(
      ApiResponse.success('Top fee defaulters fetched successfully', {
        defaulters: formattedDefaulters,
        total: formattedDefaulters.length
      })
    );
  } catch (error) {
    console.error('Error fetching top defaulters:', error);
    res.status(500).json(
      ApiResponse.error('Failed to fetch top defaulters', 500)
    );
  }
};

// Helper function to calculate time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  if (seconds < 60) return `${seconds} sec ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) > 1 ? 's' : ''} ago`;
 if (seconds < 2592000) return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) > 1 ? 's' : ''} ago`;
  return `${Math.floor(seconds / 2592000)} month${Math.floor(seconds / 2592000) > 1 ? 's' : ''} ago`;
}

export default {
  getRecentActivities,
  getTopDefaulters
};
