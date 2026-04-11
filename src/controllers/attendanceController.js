import Attendance from '../models/Attendance.js';
import Student from '../models/Student.js';
import Holiday from '../models/Holiday.js';

/**
 * Helper: Generates a UTC date range for a single day.
 */
const getDayRange = (dateString) => {
  const date = new Date(dateString);
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
};

/* =========================================================
   GET STUDENTS WITH ATTENDANCE STATUS
   Route: GET /api/admin/attendance/by-class
========================================================= */
export const getAttendanceByClass = async (req, res) => {
  try {
    const { className, section, date } = req.query;

    if (!className || !date) {
      return res.status(400).json({ message: "Class and Date are required." });
    }

    const { start, end } = getDayRange(date);

    const attendanceQuery = {
      date: { $gte: start, $lte: end }
    };

    if (className !== 'all') {
      attendanceQuery.className = className;
    }

    if (section && section !== 'all' && section.trim() !== "") {
      attendanceQuery.section = section;
    }

    const attendanceRecords = await Attendance.find(attendanceQuery).lean();
    res.status(200).json(attendanceRecords);
  } catch (error) {
    console.error("❌ Fetch Attendance Failed:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/* =========================================================
   MARK ATTENDANCE (BULK UPSERT)
   Route: POST /api/admin/attendance/mark
========================================================= */
export const markAttendance = async (req, res) => {
  try {
    const { date, className, section, attendance } = req.body;

    if (!date || !attendance || !Array.isArray(attendance)) {
      return res.status(400).json({ message: "Invalid payload. Attendance array required." });
    }

    const attendanceDate = new Date(date);
    attendanceDate.setUTCHours(0, 0, 0, 0);

    const normalizeSessionValue = (value) => {
      if (value === true || value === 'true' || value === 'present') return 'present';
      if (value === false || value === 'false' || value === 'absent') return 'absent';
      return undefined;
    };

    const bulkOps = attendance.map((record) => {
      const updateFields = {
        studentId: record.studentId,
        date: attendanceDate,
        className: record.className || className,
        section: record.section || section,
        markedBy: req.user._id,
        markedRole: req.user.role || 'admin'
      };

      if (record.morning !== undefined && record.morning !== null) {
        const morningValue = normalizeSessionValue(record.morning);
        if (morningValue) updateFields["sessions.morning"] = morningValue;
      }
      if (record.afternoon !== undefined && record.afternoon !== null) {
        const afternoonValue = normalizeSessionValue(record.afternoon);
        if (afternoonValue) updateFields["sessions.afternoon"] = afternoonValue;
      }

      return {
        updateOne: {
          filter: { studentId: record.studentId, date: attendanceDate },
          update: { $set: updateFields },
          upsert: true
        }
      };
    });

    if (bulkOps.length > 0) {
      const result = await Attendance.bulkWrite(bulkOps);
      console.log(`✅ Bulk Save Success: ${result.modifiedCount} modified`);
    }

    res.status(200).json({ message: "Attendance saved successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   MARK A DAY AS A HOLIDAY
   Route: POST /api/admin/attendance/mark-holiday
========================================================= */
export const markHoliday = async (req, res) => {
  try {
    const { date, reason } = req.body;
    const holidayDate = new Date(date);
    holidayDate.setUTCHours(0, 0, 0, 0);

    await Holiday.findOneAndUpdate(
      { date: holidayDate },
      { reason },
      { upsert: true, new: true }
    );
    res.status(200).json({ message: "Holiday marked successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   CHECK IF DATE IS A HOLIDAY (NEW - FIXES SYNTAX ERROR)
   Route: GET /api/admin/attendance/holiday-status
========================================================= */
export const getHolidayStatus = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "Date required" });

    const holidayDate = new Date(date);
    holidayDate.setUTCHours(0, 0, 0, 0);

    const holiday = await Holiday.findOne({ date: holidayDate });

    if (holiday) {
      return res.status(200).json({ isHoliday: true, reason: holiday.reason });
    }

    res.status(200).json({ isHoliday: false, reason: "" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   CALCULATE WORKING DAYS IN A MONTH
   Route: GET /api/admin/attendance/working-days
========================================================= */
export const getWorkingDaysCount = async (req, res) => {
  try {
    const { month, year } = req.query; 
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const holidays = await Holiday.find({
      date: { $gte: startDate, $lte: endDate }
    });

    let workingDays = 0;
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const isSunday = (dayOfWeek === 0);
      const isHoliday = holidays.some(h => h.date.getTime() === d.getTime());

      if (!isSunday && !isHoliday) {
        workingDays++;
      }
    }

    res.status(200).json({ workingDays });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   GET CLASS-WISE ATTENDANCE PERCENTAGE
   Route: GET /api/admin/attendance/class-wise
========================================================= */
export const getClassWiseAttendance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const presentValues = ["present", "true", true];

    // Use provided dates or default to last 30 days
    let start, end;
    if (endDate) {
      end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
    } else {
      end = new Date();
      end.setUTCHours(23, 59, 59, 999);
    }

    if (startDate) {
      start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
    } else {
      start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 30);
      start.setUTCHours(0, 0, 0, 0);
    }

    // Aggregate attendance by class
    const attendanceStats = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            className: "$className",
            section: "$section"
          },
          totalSessions: {
            $sum: {
              $add: [
                { $cond: [{ $in: ["$sessions.morning", presentValues] }, 1, 0] },
                { $cond: [{ $in: ["$sessions.afternoon", presentValues] }, 1, 0] }
              ]
            }
          },
          presentSessions: {
            $sum: {
              $add: [
                { $cond: [{ $eq: ["$sessions.morning", "present"] }, 1, 0] },
                { $cond: [{ $eq: ["$sessions.afternoon", "present"] }, 1, 0] }
              ]
            }
          },
          totalStudents: { $addToSet: "$studentId" }
        }
      },
      {
        $project: {
          className: "$_id.className",
          section: "$_id.section",
          totalSessions: 1,
          presentSessions: 1,
          totalStudents: { $size: "$totalStudents" },
          attendancePercentage: {
            $cond: [
              { $gt: ["$totalSessions", 0] },
              { $round: [{ $multiply: [{ $divide: ["$presentSessions", "$totalSessions"] }, 100] }, 1] },
              0
            ]
          }
        }
      },
      { $sort: { className: 1, section: 1 } }
    ]);

    // Get total student count per class from Student model
    const studentCounts = await Student.aggregate([
      { $match: { status: { $in: ["active", "inactive"] }, "class.className": { $ne: null } } },
      {
        $group: {
          _id: {
            className: "$class.className",
            section: "$class.section"
          },
          totalEnrolled: { $sum: 1 }
        }
      }
    ]);

    const studentMap = {};
    studentCounts.forEach(sc => {
      const key = `${sc._id.className}-${sc._id.section}`;
      studentMap[key] = sc.totalEnrolled;
    });

    const result = attendanceStats.map(stat => ({
      className: stat.className,
      section: stat.section,
      attendancePercentage: stat.attendancePercentage,
      presentSessions: stat.presentSessions,
      totalSessions: stat.totalSessions,
      totalEnrolled: studentMap[`${stat.className}-${stat.section}`] || stat.totalStudents
    }));

    // Compute overall stats
    const overallPresent = result.reduce((sum, r) => sum + r.presentSessions, 0);
    const overallTotal = result.reduce((sum, r) => sum + r.totalSessions, 0);
    const overallPercentage = overallTotal > 0 ? ((overallPresent / overallTotal) * 100).toFixed(1) : 0;

    res.status(200).json({
      success: true,
      data: result,
      summary: {
        totalClasses: result.length,
        overallAttendancePercentage: Number(overallPercentage),
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error("❌ Class-wise Attendance Failed:", error);
    res.status(500).json({ message: "Failed to fetch class-wise attendance.", error: error.message });
  }
};

/* =========================================================
   GET ATTENDANCE SUMMARY
   Route: GET /api/admin/attendance/summary
========================================================= */
export const getAttendanceSummary = async (req, res) => {
  try {
    const { className, section, date } = req.query;
    const presentValues = ["present", "true", true];

    if (!className || !date) {
      return res.status(400).json({ message: "Class and Date are required." });
    }

    const { start, end } = getDayRange(date);
    const studentQuery = { status: { $ne: "deleted" } };
    
    if (className !== 'all') {
      const classRegex = new RegExp(`^${className}`, 'i');
      if (section && section !== 'all' && section.trim() !== "") {
        studentQuery["class.className"] = className;
        studentQuery["class.section"] = section;
      } else {
        studentQuery["class.className"] = classRegex;
      }
    }

    const totalStudents = await Student.countDocuments(studentQuery);
    if (totalStudents === 0) {
      return res.status(200).json({ totalStudents: 0, present: 0, halfDay: 0, absent: 0, attendancePercentage: 0 });
    }

    const matchStage = { date: { $gte: start, $lte: end } };
    if (className !== 'all') matchStage.className = className;
    if (section && section !== 'all' && section.trim() !== "") matchStage.section = section;

    const stats = await Attendance.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          fullDayPresent: {
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $in: ["$sessions.morning", presentValues] },
                    { $in: ["$sessions.afternoon", presentValues] }
                  ] 
                }, 1, 0
              ] 
            }
          },
          halfDayPresent: {
            $sum: {
              $cond: [
                { 
                  $or: [
                    { 
                      $and: [
                        { $in: ["$sessions.morning", presentValues] },
                        { $not: [{ $in: ["$sessions.afternoon", presentValues] }] }
                      ] 
                    },
                    { 
                      $and: [
                        { $in: ["$sessions.afternoon", presentValues] },
                        { $not: [{ $in: ["$sessions.morning", presentValues] }] }
                      ] 
                    }
                  ]
                }, 1, 0
              ]
            }
          }
        }
      }
    ]);

    const data = stats[0] || { fullDayPresent: 0, halfDayPresent: 0 };
    const absent = Math.max(0, totalStudents - (data.fullDayPresent + data.halfDayPresent));
    const score = data.fullDayPresent + (data.halfDayPresent * 0.5);
    const percentage = ((score / totalStudents) * 100).toFixed(1);

    res.status(200).json({
      totalStudents,
      present: data.fullDayPresent,
      halfDay: data.halfDayPresent,
      absent,
      attendancePercentage: Number(percentage)
    });

  } catch (error) {
    res.status(500).json({ message: "Failed to fetch summary." });
  }
};