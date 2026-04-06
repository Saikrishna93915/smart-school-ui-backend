// src/controllers/studentAttendanceController.js
import Attendance from "../models/Attendance.js";
import Student from "../models/Student.js";
import User from "../models/User.js";

/**
 * Get current authenticated student's info
 * @route GET /api/attendance/student/me
 * @access Private (Student)
 */
export const getCurrentStudent = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user first
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find student using multiple approaches (same as studentSelfController)
    const student =
      (await Student.findById(user.linkedId)) ||
      (await Student.findOne({ userId: user._id })) ||
      (await Student.findOne({ admissionNumber: user.username.toUpperCase() }));

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found'
      });
    }

    // Extract name from student schema structure
    const fullName = `${student?.student?.firstName || ""} ${student?.student?.lastName || ""}`.trim();
    const firstName = student?.student?.firstName || student.firstName || user.firstName || '';
    const lastName = student?.student?.lastName || student.lastName || user.lastName || '';

    res.status(200).json({
      success: true,
      data: {
        _id: student._id,
        firstName: firstName,
        lastName: lastName,
        name: fullName,
        admissionNumber: student.admissionNumber,
        rollNumber: student.rollNumber,
        className: student?.class?.className || student.enrollmentId?.className || '',
        section: student?.class?.section || student.enrollmentId?.section || '',
        profilePic: student.profilePic,
        email: user.email,
        phone: student.phoneNumber || student.parents?.father?.phone
      }
    });
  } catch (error) {
    console.error('Error fetching student info:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student info',
      error: error.message
    });
  }
};

/**
 * Get student attendance records for date range
 * Students can only view their own attendance
 * @route GET /api/attendance/student/:studentId
 * @access Private (Student)
 * @query startDate (yyyy-MM-dd)
 * @query endDate (yyyy-MM-dd)
 */
export const getStudentAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate dates
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate query parameters are required (yyyy-MM-dd format)'
      });
    }

    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59Z');

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use yyyy-MM-dd'
      });
    }

    // Fetch attendance records
    const attendanceRecords = await Attendance.find({
      studentId: studentId,
      date: { $gte: start, $lte: end }
    })
      .select('date sessions markedAt markedBy')
      .sort({ date: 1 });

    // Transform response - convert string values to boolean
    const formattedRecords = attendanceRecords.map(record => {
      const morning = record.sessions?.morning === 'present';
      const afternoon = record.sessions?.afternoon === 'present';
      return {
        date: record.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
        morning: morning,
        afternoon: afternoon,
        status: determineStatus(morning, afternoon),
        markedAt: record.markedAt,
        markedBy: record.markedBy
      };
    });

    res.status(200).json({
      success: true,
      count: formattedRecords.length,
      data: formattedRecords
    });
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance records',
      error: error.message
    });
  }
};

/**
 * Get student monthly attendance summary
 * @route GET /api/attendance/student/:studentId/summary
 * @access Private (Student)
 * @query month (1-12)
 * @query year (YYYY)
 */
export const getStudentMonthlySummary = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { month, year } = req.query;

    // Validate month and year
    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'month and year query parameters are required'
      });
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: 'month must be between 1 and 12'
      });
    }

    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0);

    // Fetch attendance records for the month
    const attendanceRecords = await Attendance.find({
      studentId: studentId,
      date: { $gte: startDate, $lte: endDate }
    });

    // Calculate statistics
    let present = 0;
    let absent = 0;
    let partial = 0;
    let pending = 0;

    attendanceRecords.forEach(record => {
      const morning = record.sessions?.morning === 'present';
      const afternoon = record.sessions?.afternoon === 'present';
      
      if (record.sessions?.morning === 'absent' && record.sessions?.afternoon === 'absent') {
        absent++;
      } else if (record.sessions?.morning === 'present' && record.sessions?.afternoon === 'present') {
        present++;
      } else if (record.sessions?.morning === 'present' || record.sessions?.afternoon === 'present') {
        partial++;
      } else {
        pending++;
      }
    });

    const totalDays = attendanceRecords.length;
    const attendanceRate = totalDays > 0
      ? Math.round(((present + partial * 0.5) / totalDays) * 100)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        month: startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        totalDays,
        present,
        absent,
        partial,
        pending,
        attendanceRate
      }
    });
  } catch (error) {
    console.error('Error fetching monthly summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly summary',
      error: error.message
    });
  }
};

/**
 * Get student yearly attendance summary
 * @route GET /api/attendance/student/:studentId/yearly
 * @access Private (Student)
 * @query year (YYYY)
 */
export const getStudentYearlySummary = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({
        success: false,
        message: 'year query parameter is required'
      });
    }

    const yearNum = parseInt(year);
    const startDate = new Date(yearNum, 0, 1);
    const endDate = new Date(yearNum, 11, 31);

    // Fetch all attendance records for the year
    const attendanceRecords = await Attendance.find({
      studentId: studentId,
      date: { $gte: startDate, $lte: endDate }
    });

    // Group by month
    const monthlyData = {};
    for (let i = 0; i < 12; i++) {
      monthlyData[i] = {
        month: new Date(yearNum, i).toLocaleDateString('en-US', { month: 'long' }),
        present: 0,
        absent: 0,
        partial: 0,
        pending: 0,
        totalDays: 0
      };
    }

    // Calculate monthly statistics
    attendanceRecords.forEach(record => {
      const monthIndex = record.date.getMonth();
      const monthRecord = monthlyData[monthIndex];
      monthRecord.totalDays++;

      if (record.sessions?.morning === 'absent' && record.sessions?.afternoon === 'absent') {
        monthRecord.absent++;
      } else if (record.sessions?.morning === 'present' && record.sessions?.afternoon === 'present') {
        monthRecord.present++;
      } else if (record.sessions?.morning === 'present' || record.sessions?.afternoon === 'present') {
        monthRecord.partial++;
      } else {
        monthRecord.pending++;
      }
    });

    // Calculate attendance rates
    const months = Object.values(monthlyData).map(month => ({
      ...month,
      attendanceRate: month.totalDays > 0
        ? Math.round(((month.present + month.partial * 0.5) / month.totalDays) * 100)
        : 0
    }));

    res.status(200).json({
      success: true,
      data: {
        year: yearNum,
        totalDays: attendanceRecords.length,
        months
      }
    });
  } catch (error) {
    console.error('Error fetching yearly summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching yearly summary',
      error: error.message
    });
  }
};

// ============ HELPER FUNCTIONS ============

/**
 * Determine attendance status based on morning and afternoon values
 */
function determineStatus(morning, afternoon) {
  if (morning === null && afternoon === null) {
    return 'pending';
  } else if (morning && afternoon) {
    return 'present';
  } else if (!morning && !afternoon) {
    return 'absent';
  } else {
    return 'partial';
  }
}
