// controllers/principalController.js - Principal Portal (Read-Only Overview)
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Attendance from "../models/Attendance.js";
import Payment from "../models/Payment.js";
import StudentFee from "../models/StudentFee.js";
const StudentFeeModel = StudentFee.default || StudentFee;
import Exam from "../models/Exam.js";
import Vehicle from "../models/Vehicle.js";
import Route from "../models/Route.js";
import Driver from "../models/Driver.js";
import Announcement from "../models/Announcement.js";
import asyncHandler from "../utils/asyncHandler.js";
import mongoose from "mongoose";

// New modules for Principal
import Timetable from "../models/Timetable.js";
import TeacherPermission from "../models/TeacherPermission.js";
import PermissionTemplate from "../models/PermissionTemplate.js";
import PermissionAuditLog from "../models/PermissionAuditLog.js";
import Class from "../models/Class.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Subject from "../models/Subject.js";
import { cleanupDuplicateClassesData } from "../utils/classDeduplication.js";
import {
  validateStrictClassName,
  getClassDisplayInfo,
  normalizeClassName,
  normalizeClassNameForComparison,
  parseClassOrder,
} from "../utils/classNaming.js";

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

async function resolveTeacherId(teacherInput) {
  if (!teacherInput) return null;

  if (isObjectId(teacherInput)) {
    const byId = await Teacher.findById(teacherInput).select("_id");
    if (byId?._id) return byId._id;
  }

  const teacherCode = String(teacherInput).trim();
  const byEmployeeId = await Teacher.findOne({ employeeId: teacherCode }).select("_id");
  if (byEmployeeId?._id) return byEmployeeId._id;

  return null;
}

async function resolveClassId(classInput, academicYear) {
  if (!classInput) return null;

  if (isObjectId(classInput)) {
    const byId = await Class.findById(classInput).select("_id");
    if (byId?._id) return byId._id;
  }

  const classLabel = String(classInput).trim();
  const normalizedClassLabel = normalizeClassName(classLabel);
  const query = {
    $or: [
      { name: normalizedClassLabel },
      { name: { $regex: `^${classLabel}$`, $options: "i" } },
      { className: { $regex: `^${classLabel}$`, $options: "i" } },
    ],
  };

  if (academicYear) {
    query.academicYear = academicYear;
  }

  const byExactName = await Class.findOne(query).select("_id");

  return byExactName?._id || null;
}

async function resolveSubjectId(subjectInput, academicYear) {
  if (!subjectInput) return null;

  if (isObjectId(subjectInput)) {
    const byId = await Subject.findById(subjectInput).select("_id");
    if (byId?._id) return byId._id;
  }

  const subjectCode = String(subjectInput).trim().toUpperCase();
  const subjectName = String(subjectInput).trim();

  const byCode = await Subject.findOne({ subjectCode, $or: [{ academicYear }, { academicYear: { $exists: false } }] }).select("_id");
  if (byCode?._id) return byCode._id;

  const byName = await Subject.findOne({
    subjectName: { $regex: `^${subjectName}$`, $options: "i" },
    $or: [{ academicYear }, { academicYear: { $exists: false } }]
  }).select("_id");

  return byName?._id || null;
}

// @desc    Get dashboard statistics
// @route   GET /api/principal/dashboard
export const getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [
    totalStudents,
    totalTeachers,
    presentToday,
    monthlyCollectionAgg,
    pendingFeesAgg,
    activeExams
  ] = await Promise.all([
    Student.countDocuments({ status: "active" }),
    Teacher.countDocuments(),
    Attendance.countDocuments({ date: { $gte: startOfDay, $lte: endOfDay }, status: "present" }),
    Payment.aggregate([
      { $match: { createdAt: { $gte: startOfMonth, $lte: endOfMonth }, status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    StudentFee.aggregate([
      { $match: { $expr: { $gt: ["$totalAmount", "$paidAmount"] } } },
      { $group: { _id: null, total: { $sum: { $subtract: ["$totalAmount", "$paidAmount"] } } } }
    ]),
    Exam.countDocuments({ status: "active" })
  ]);

  const attendanceRate = totalStudents > 0 ? ((presentToday / totalStudents) * 100).toFixed(1) : "0";

  res.json({
    success: true,
    data: {
      totalStudents,
      totalTeachers,
      todayAttendance: { present: presentToday, total: totalStudents, rate: attendanceRate },
      feeCollection: {
        monthly: monthlyCollectionAgg[0]?.total || 0,
        pending: pendingFeesAgg[0]?.total || 0
      },
      activeExams
    }
  });
});

// @desc    Get students summary (paginated, read-only)
// @route   GET /api/principal/students
export const getStudentsSummary = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, class: cls, section } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const query = {};
  if (search) {
    query.$or = [
      { "student.firstName": { $regex: search, $options: "i" } },
      { "student.lastName": { $regex: search, $options: "i" } },
      { admissionNumber: { $regex: search, $options: "i" } }
    ];
  }
  if (cls) query["class.className"] = cls;
  if (section) query["class.section"] = section;

  const [students, total, classWise] = await Promise.all([
    Student.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "attendances",
          localField: "_id",
          foreignField: "studentId",
          as: "attendanceRecords"
        }
      },
      {
        $lookup: {
          from: "feestructures",
          let: { admissionNumber: "$admissionNumber" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$admissionNumber", "$$admissionNumber"] }
              }
            }
          ],
          as: "feeData"
        }
      },
      {
        $addFields: {
          attendance: {
            $let: {
              vars: {
                totalDays: { $size: "$attendanceRecords" },
                presentDays: {
                  $sum: {
                    $map: {
                      input: "$attendanceRecords",
                      as: "rec",
                      in: {
                        $cond: [{ $eq: ["$$rec.status", "present"] }, 1, 0]
                      }
                    }
                  }
                }
              },
              in: {
                percentage: {
                  $cond: [
                    { $eq: ["$$totalDays", 0] },
                    0,
                    { $round: [{ $multiply: [{ $divide: ["$$presentDays", "$$totalDays"] }, 100] }, 1] }
                  ]
                },
                present: "$$presentDays",
                total: "$$totalDays"
              }
            }
          },
          fee: {
            $let: {
              vars: {
                feeStructure: { $arrayElemAt: ["$feeData", 0] }
              },
              in: {
                feeStatus: {
                  $cond: [
                    { $gt: ["$$feeStructure.totalDue", 0] },
                    "Due",
                    "Paid"
                  ]
                },
                balance: { $ifNull: ["$$feeStructure.totalDue", 0] }
              }
            }
          }
        }
      },
      {
        $project: {
          admissionNumber: 1,
          student: 1,
          class: 1,
          status: 1,
          transport: 1,
          attendance: 1,
          fee: 1,
          parents: 1
        }
      },
      { $sort: { "class.className": 1, "class.section": 1, "student.firstName": 1 } },
      { $skip: skip },
      { $limit: Number(limit) }
    ]),
    Student.countDocuments(query),
    Student.aggregate([
      { $group: { _id: { class: "$class.className", section: "$class.section" }, count: { $sum: 1 } } },
      { $sort: { "_id.class": 1, "_id.section": 1 } }
    ])
  ]);

  res.json({
    success: true,
    data: {
      students,
      classWise,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    }
  });
});

// @desc    Get teachers summary (read-only)
// @route   GET /api/principal/teachers
export const getTeachersSummary = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, department, status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const query = {};
  if (search) {
    query.$or = [
      { "personal.firstName": { $regex: search, $options: "i" } },
      { "personal.lastName": { $regex: search, $options: "i" } },
      { employeeId: { $regex: search, $options: "i" } }
    ];
  }
  if (department) query["professional.department"] = department;
  if (status && status !== "all") query.status = status;

  const [teachers, total, departmentWise] = await Promise.all([
    Teacher.find(query)
      .populate("user", "email phone")
      .select("employeeId personal contact professional department status")
      .skip(skip).limit(Number(limit))
      .sort({ "personal.firstName": 1 }),
    Teacher.countDocuments(query),
    Teacher.aggregate([
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
  ]);

  // Transform to match frontend format
  const transformedTeachers = teachers.map((teacher) => ({
    _id: teacher._id,
    employeeId: teacher.employeeId,
    personal: teacher.personal || { firstName: "", lastName: "", gender: "Male" },
    contact: {
      email: teacher.contact?.email || teacher.user?.email || "",
      phone: teacher.contact?.phone || teacher.user?.phone || "",
      address: teacher.personal?.address || "",
    },
    professional: {
      department: teacher.department || teacher.professional?.department || "",
      designation: teacher.professional?.designation || "Teacher",
      qualification: teacher.professional?.qualification || "",
      experience: teacher.professional?.experienceYears || 0,
      subjects: teacher.professional?.subjects || [],
    },
    status: teacher.status || "active",
  }));

  res.json({
    success: true,
    data: { 
      teachers: transformedTeachers, 
      departmentWise, 
      stats: {
        total,
        active: teachers.filter((t) => t.status === "active").length,
        onLeave: teachers.filter((t) => t.status === "on_leave").length,
      },
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    }
  });
});

// @desc    Get principal profile
// @route   GET /api/principal/profile
export const getPrincipalProfile = asyncHandler(async (req, res) => {
  const user = req.user || {};

  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name || "Principal",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "principal",
      designation: "Principal",
      linkedId: user.linkedId || null,
    },
  });
});

// @desc    Get attendance overview
// @route   GET /api/principal/attendance
export const getAttendanceOverview = asyncHandler(async (req, res) => {
  const { date, class: cls, section } = req.query;
  
  const today = new Date(date || Date.now());
  today.setHours(0, 0, 0, 0);
  const endToday = new Date(today);
  endToday.setHours(23, 59, 59, 999);

  const last7 = new Date(); last7.setDate(last7.getDate() - 7); last7.setHours(0, 0, 0, 0);
  const last30 = new Date(); last30.setDate(last30.getDate() - 30); last30.setHours(0, 0, 0, 0);

  const attendanceMatch = { date: { $gte: today, $lte: endToday } };
  if (cls) attendanceMatch.className = String(cls);
  if (section) attendanceMatch.section = String(section);

  const [weeklyAttendance, classWiseTodayRaw, lowAttendanceRaw, totalStudents, teachers] = await Promise.all([
    Attendance.aggregate([
      { $match: { date: { $gte: last7 } } },
      { $group: { 
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, 
          presentSessions: {
            $sum: {
              $add: [
                { $cond: [{ $eq: ["$sessions.morning", "present"] }, 1, 0] },
                { $cond: [{ $eq: ["$sessions.afternoon", "present"] }, 1, 0] }
              ]
            }
          },
          totalSessions: { $sum: 2 }
        } 
      },
      {
        $addFields: {
          present: "$presentSessions",
          total: "$totalSessions",
          percentage: {
            $round: [
              {
                $multiply: [
                  {
                    $cond: [
                      { $gt: ["$totalSessions", 0] },
                      { $divide: ["$presentSessions", "$totalSessions"] },
                      0
                    ]
                  },
                  100
                ]
              },
              1
            ]
          }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    Attendance.aggregate([
      { $match: attendanceMatch },
      {
        $group: {
          _id: { class: "$className", section: "$section" },
          present: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$sessions.morning", "present"] },
                    { $eq: ["$sessions.afternoon", "present"] }
                  ]
                },
                1,
                0
              ]
            }
          },
          absent: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$sessions.morning", "absent"] },
                    { $eq: ["$sessions.afternoon", "absent"] }
                  ]
                },
                1,
                0
              ]
            }
          },
          late: {
            $sum: {
              $cond: [
                {
                  $or: [
                    {
                      $and: [
                        { $eq: ["$sessions.morning", "present"] },
                        { $eq: ["$sessions.afternoon", "absent"] }
                      ]
                    },
                    {
                      $and: [
                        { $eq: ["$sessions.morning", "absent"] },
                        { $eq: ["$sessions.afternoon", "present"] }
                      ]
                    }
                  ]
                },
                1,
                0
              ]
            }
          },
          total: { $sum: 1 }
        }
      },
      { $sort: { "_id.class": 1, "_id.section": 1 } }
    ]),
    Attendance.aggregate([
      { $match: { date: { $gte: last30 } } },
      {
        $group: {
          _id: "$studentId",
          presentSessions: {
            $sum: {
              $add: [
                { $cond: [{ $eq: ["$sessions.morning", "present"] }, 1, 0] },
                { $cond: [{ $eq: ["$sessions.afternoon", "present"] }, 1, 0] }
              ]
            }
          },
          totalSessions: { $sum: 2 }
        }
      },
      {
        $addFields: {
          attendanceRatio: {
            $cond: [
              { $gt: ["$totalSessions", 0] },
              { $divide: ["$presentSessions", "$totalSessions"] },
              0
            ]
          }
        }
      },
      { $match: { attendanceRatio: { $lt: 0.75 } } },
      { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "student" } },
      { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $concat: [{ $ifNull: ["$student.student.firstName", ""] }, " ", { $ifNull: ["$student.student.lastName", ""] }] },
          class: "$student.class.className",
          section: "$student.class.section",
          attendanceRate: { $multiply: ["$attendanceRatio", 100] },
          present: "$presentSessions",
          total: "$totalSessions",
          parentPhone: { $ifNull: ["$student.parents.father.phone", "$student.parents.mother.phone", ""] }
        }
      },
      { $sort: { attendanceRate: 1 } },
      { $limit: 50 }
    ]),
    Student.countDocuments({ status: "active" }),
    Teacher.find({}).select("_id employeeId status personal professional contact").lean()
  ]);

  const classWiseToday = classWiseTodayRaw
    .filter((row) => row?._id?.class || row?._id?.section)
    .map((row) => {
      const total = Number(row.total || 0);
      const present = Number(row.present || 0);
      const absent = Number(row.absent || 0);
      const late = Number(row.late || 0);
      const percentage = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0;

      let status = "poor";
      if (percentage >= 90) status = "excellent";
      else if (percentage >= 80) status = "good";
      else if (percentage >= 75) status = "average";

      return {
        class: String(row._id?.class || "N/A"),
        section: String(row._id?.section || "N/A"),
        total,
        present,
        absent,
        late,
        leave: 0,
        percentage,
        teacher: "",
        status,
      };
    });

  const teacherWise = teachers.map((teacher) => {
    const firstName = teacher.personal?.firstName || "";
    const lastName = teacher.personal?.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim() || teacher.employeeId || "Teacher";

    let mappedStatus = "present";
    if (teacher.status === "on_leave") mappedStatus = "leave";
    else if (teacher.status === "inactive") mappedStatus = "absent";

    return {
      teacherId: String(teacher._id),
      name: fullName,
      department: teacher.professional?.department || "General",
      status: mappedStatus,
      subject: Array.isArray(teacher.professional?.subjects) && teacher.professional.subjects.length > 0
        ? String(teacher.professional.subjects[0])
        : (teacher.professional?.designation || "Teacher"),
      checkInTime: "",
      checkOutTime: "",
      lateMinutes: 0,
      contact: {
        phone: teacher.contact?.phone || "",
        email: teacher.contact?.email || "",
      },
    };
  });

  const lowAttendance = lowAttendanceRaw.map((student) => {
    const attendanceRate = Number((student.attendanceRate || 0).toFixed ? student.attendanceRate.toFixed(1) : student.attendanceRate || 0);
    return {
      studentId: String(student._id || ""),
      name: (student.name || "").trim() || "Student",
      class: String(student.class || "N/A"),
      section: String(student.section || "N/A"),
      attendanceRate,
      totalDays: Number(student.total || 0),
      presentDays: Number(student.present || 0),
      absentDays: Math.max(Number(student.total || 0) - Number(student.present || 0), 0),
      parentPhone: student.parentPhone || "",
      parentEmail: "",
      lastAttendance: today.toISOString(),
      trend: "stable",
      consecutiveAbsences: 0,
      parentNotified: false,
      lastNotificationDate: null,
    };
  });

  // Calculate today's stats from classWise data
  const todayStats = classWiseToday.reduce((acc, curr) => {
    acc.present += curr.present || 0;
    acc.absent += curr.absent || 0;
    acc.late += curr.late || 0;
    acc.leave += curr.leave || 0;
    acc.total += curr.total || 0;
    return acc;
  }, { present: 0, absent: 0, late: 0, leave: 0, total: 0 });

  res.json({
    success: true,
    data: {
      stats: {
        totalStudents: totalStudents,
        presentToday: todayStats.present,
        absentToday: todayStats.absent,
        lateToday: todayStats.late,
        onLeaveToday: todayStats.leave,
        percentage: todayStats.total > 0 ? Number(((todayStats.present / todayStats.total) * 100).toFixed(1)) : 0,
        teacherPresent: teacherWise.filter((t) => t.status === "present").length,
        teacherAbsent: teacherWise.filter((t) => t.status === "absent").length,
        teacherLate: teacherWise.filter((t) => t.status === "late").length,
        teacherLeave: teacherWise.filter((t) => t.status === "leave").length,
        classesAbove90: classWiseToday.filter((c) => c.percentage >= 90).length,
        classesBelow75: classWiseToday.filter((c) => c.percentage < 75).length,
      },
      classWiseToday,
      weeklyAttendance,
      lowAttendance,
      teacherWise,
      lastUpdated: new Date().toISOString(),
    }
  });
});

// @desc    Get finance overview (read-only)
// @route   GET /api/principal/finance
export const getFinanceOverview = asyncHandler(async (req, res) => {
  const { academicYear } = req.query;

  const financeToday = new Date(); financeToday.setHours(0, 0, 0, 0);
  const endFinanceToday = new Date(); endFinanceToday.setHours(23, 59, 59, 999);
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const thisMonthStart = new Date(); thisMonthStart.setDate(1); thisMonthStart.setHours(0, 0, 0, 0);
  const lastMonthStart = new Date(); lastMonthStart.setMonth(lastMonthStart.getMonth() - 1); lastMonthStart.setDate(1); lastMonthStart.setHours(0, 0, 0, 0);

  const [monthlyRevenue, topDefaulters, totalExpected, totalCollected, thisMonthCollection, lastMonthCollection, todayCollection] = await Promise.all([
    Payment.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: { $in: ["paid", "completed"] } } },
      { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]),
    StudentFee.aggregate([
      { $match: { $expr: { $gt: ["$totalAmount", "$paidAmount"] } } },
      { $lookup: { from: "students", localField: "studentId", foreignField: "_id", as: "student" } },
      { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          studentName: { $concat: [{ $ifNull: ["$student.personal.firstName", ""] }, " ", { $ifNull: ["$student.personal.lastName", ""] }] },
          admissionNumber: "$student.admissionNumber",
          className: "$student.academic.class",
          section: "$student.academic.section",
          parentName: { $ifNull: ["$student.parents.father.name", ""] },
          parentPhone: { $ifNull: ["$student.parents.father.phone", "$student.parents.mother.phone", ""] },
          totalAmount: 1,
          paidAmount: 1,
          pendingAmount: { $subtract: ["$totalAmount", "$paidAmount"] }
        }
      },
      { $sort: { pendingAmount: -1 } },
      { $limit: 20 }
    ]),
    StudentFee.aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
    Payment.aggregate([{ $match: { status: { $in: ["paid", "completed"] } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Payment.aggregate([
      { $match: { createdAt: { $gte: thisMonthStart }, status: { $in: ["paid", "completed"] } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
    ]),
    Payment.aggregate([
      { $match: { createdAt: { $gte: lastMonthStart, $lt: thisMonthStart }, status: { $in: ["paid", "completed"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Payment.aggregate([
      { $match: { createdAt: { $gte: financeToday, $lte: endFinanceToday }, status: { $in: ["paid", "completed"] } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 }, cash: { $sum: { $cond: [{ $eq: ["$paymentMethod", "cash"] }, "$amount", 0] } }, online: { $sum: { $cond: [{ $eq: ["$paymentMethod", "online"] }, "$amount", 0] } } } }
    ])
  ]);

  const expected = totalExpected[0]?.total || 0;
  const collected = totalCollected[0]?.total || 0;
  const thisMonth = thisMonthCollection[0]?.total || 0;
  const lastMonth = lastMonthCollection[0]?.total || 0;
  const today = todayCollection[0] || { total: 0, count: 0, cash: 0, online: 0 };

  const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;
  const target = expected / 12; // Monthly target
  const achievement = target > 0 ? (thisMonth / target) * 100 : 0;

  res.json({
    success: true,
    data: {
      monthlyRevenue,
      topDefaulters,
      totals: { expected, collected, pending: expected - collected, collectionRate: expected > 0 ? ((collected / expected) * 100).toFixed(1) : "0" },
      monthly: { thisMonth, lastMonth, growth: growth.toFixed(1), target, achievement: achievement.toFixed(1) },
      today: { total: today.total, count: today.count, cash: today.cash, online: today.online }
    }
  });
});

// @desc    Get exam results overview
// @route   GET /api/principal/exams
export const getExamResults = asyncHandler(async (req, res) => {
  const { type, class: cls, status } = req.query;
  
  const query = {};
  if (type) query.type = type;
  if (cls) query.class = cls;
  if (status) query.status = status;

  const exams = await Exam.find(query)
    .populate("createdBy", "name email")
    .select("name type class section date status duration totalMarks createdBy createdAt")
    .sort({ date: -1 })
    .limit(50)
    .lean();

  res.json({ success: true, data: exams });
});

// @desc    Get transport overview
// @route   GET /api/principal/transport
export const getTransportOverview = asyncHandler(async (req, res) => {
  const [vehicles, routes, studentsUsingTransport, drivers] = await Promise.all([
    Vehicle.find().select("vehicleNumber model capacity status currentStatus lastMaintenance"),
    Route.find().select("routeName startTime endTime status"),
    Student.countDocuments({ "transport.isApplied": true }),
    Driver.find({ status: "active" }).select("firstName lastName phone assignedVehicle status")
  ]);

  res.json({
    success: true,
    data: {
      vehicles,
      routes,
      drivers,
      studentsUsingTransport,
      stats: {
        totalVehicles: vehicles.length,
        activeVehicles: vehicles.filter(v => v.status === "active").length,
        totalRoutes: routes.length,
        activeRoutes: routes.filter(r => r.status === "active").length
      }
    }
  });
});

// @desc    Get available report types
// @route   GET /api/principal/reports/types
export const getReportTypes = asyncHandler(async (req, res) => {
  const reportTypes = [
    { id: "student-list", name: "Student List", category: "students" },
    { id: "student-attendance", name: "Student Attendance", category: "students" },
    { id: "student-fees", name: "Student Fee Report", category: "students" },
    { id: "teacher-list", name: "Teacher List", category: "teachers" },
    { id: "teacher-attendance", name: "Teacher Attendance", category: "teachers" },
    { id: "finance-collection", name: "Fee Collection Report", category: "finance" },
    { id: "finance-defaulters", name: "Fee Defaulters Report", category: "finance" },
    { id: "attendance-daily", name: "Daily Attendance Report", category: "attendance" },
    { id: "attendance-monthly", name: "Monthly Attendance Report", category: "attendance" },
    { id: "exam-results", name: "Exam Results Report", category: "exams" },
    { id: "exam-analysis", name: "Exam Performance Analysis", category: "exams" },
    { id: "transport-students", name: "Transport Users Report", category: "transport" },
    { id: "transport-routes", name: "Transport Routes Report", category: "transport" }
  ];

  res.json({ success: true, data: reportTypes });
});

// @desc    Generate custom report
// @route   POST /api/principal/reports/generate
export const generateReport = asyncHandler(async (req, res) => {
  const { reportType, startDate, endDate, class: cls, section, department } = req.body;

  let reportData = {};

  switch (reportType) {
    case "student-list":
      const query = {};
      if (cls) query["academic.class"] = cls;
      if (section) query["academic.section"] = section;
      
      const students = await Student.find(query)
        .select("admissionNumber personal academic parents status")
        .sort({ "academic.class": 1, "personal.firstName": 1 })
        .lean();
      
      reportData = {
        title: "Student List Report",
        headers: ["Admission No", "Name", "Class", "Section", "Parent Name", "Phone", "Status"],
        rows: students.map(s => [
          s.admissionNumber,
          `${s.personal.firstName} ${s.personal.lastName}`,
          s.academic.class,
          s.academic.section,
          `${s.parents.father.name}`,
          s.parents.father.phone,
          s.status
        ])
      };
      break;

    case "student-attendance":
      const attendanceQuery = {};
      if (startDate && endDate) {
        attendanceQuery.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }
      
      const attendance = await Attendance.aggregate([
        { $match: attendanceQuery },
        { $lookup: { from: "students", localField: "studentId", foreignField: "_id", as: "student" } },
        { $unwind: "$student" },
        { $group: { _id: "$studentId", studentName: { $first: "$student.personal.firstName" }, class: { $first: "$student.academic.class" }, section: { $first: "$student.academic.section" }, present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } }, total: { $sum: 1 } } },
        { $project: { studentName: 1, class: 1, section: 1, present: 1, total: 1, percentage: { $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 1] } } }
      ]);
      
      reportData = {
        title: "Student Attendance Report",
        headers: ["Student Name", "Class", "Section", "Present", "Total Days", "Percentage"],
        rows: attendance.map(a => [a.studentName, a.class, a.section, a.present, a.total, `${a.percentage}%`])
      };
      break;

    case "finance-collection":
      const paymentQuery = {};
      if (startDate && endDate) {
        paymentQuery.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }
      
      const collections = await Payment.aggregate([
        { $match: { ...paymentQuery, status: { $in: ["paid", "completed"] } } },
        { $group: { _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      reportData = {
        title: "Fee Collection Report",
        headers: ["Date", "Total Collected", "Number of Payments"],
        rows: collections.map(c => [c._id, `₹${c.total.toLocaleString()}`, c.count])
      };
      break;

    case "finance-defaulters":
      const defaulters = await StudentFee.aggregate([
        { $match: { $expr: { $gt: ["$totalAmount", "$paidAmount"] } } },
        { $lookup: { from: "students", localField: "studentId", foreignField: "_id", as: "student" } },
        { $unwind: "$student" },
        { $project: { studentName: { $concat: ["$student.personal.firstName", " ", "$student.personal.lastName"] }, class: "$student.academic.class", section: "$student.academic.section", totalAmount: 1, paidAmount: 1, pendingAmount: { $subtract: ["$totalAmount", "$paidAmount"] } } },
        { $sort: { pendingAmount: -1 } }
      ]);
      
      reportData = {
        title: "Fee Defaulters Report",
        headers: ["Student Name", "Class", "Section", "Total Fee", "Paid", "Pending"],
        rows: defaulters.map(d => [d.studentName, d.class, d.section, `₹${d.totalAmount}`, `₹${d.paidAmount}`, `₹${d.pendingAmount}`])
      };
      break;

    case "teacher-list":
      const teacherQuery = {};
      if (department) teacherQuery.department = department;
      
      const teachers = await Teacher.find(teacherQuery)
        .select("employeeId personal contact professional department status")
        .sort({ "personal.firstName": 1 })
        .lean();
      
      reportData = {
        title: "Teacher List Report",
        headers: ["Employee ID", "Name", "Department", "Phone", "Email", "Status"],
        rows: teachers.map(t => [
          t.employeeId,
          `${t.personal.firstName} ${t.personal.lastName}`,
          t.department,
          t.contact.phone,
          t.contact.email,
          t.status
        ])
      };
      break;

    case "exam-results":
      const examQuery = {};
      if (cls) examQuery.class = cls;
      
      const exams = await Exam.find(examQuery)
        .select("name type class section date status totalMarks")
        .sort({ date: -1 })
        .lean();
      
      reportData = {
        title: "Exam Results Report",
        headers: ["Exam Name", "Type", "Class", "Section", "Date", "Status", "Total Marks"],
        rows: exams.map(e => [e.name, e.type, e.class, e.section, new Date(e.date).toLocaleDateString(), e.status, e.totalMarks])
      };
      break;

    default:
      return res.status(400).json({ success: false, message: "Invalid report type" });
  }

  res.json({ success: true, data: reportData });
});

// @desc    Export report to CSV
// @route   POST /api/principal/reports/export/csv
export const exportReportCSV = asyncHandler(async (req, res) => {
  const { headers, rows } = req.body;

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=report.csv");
  res.send(csvContent);
});

// @desc    Export report to JSON
// @route   POST /api/principal/reports/export/json
export const exportReportJSON = asyncHandler(async (req, res) => {
  const { title, headers, rows } = req.body;

  const jsonData = {
    reportTitle: title,
    generatedAt: new Date().toISOString(),
    headers,
    data: rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    })
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=report.json");
  res.json(jsonData);
});

// @desc    Get announcements (read-only)
// @route   GET /api/principal/announcements
export const getAnnouncements = asyncHandler(async (req, res) => {
  const { type, status, audience, pinned, featured, search } = req.query;
  
  const query = {};
  if (type) query.type = type;
  if (status) query.status = status;
  if (audience) query["audience.type"] = audience;
  if (pinned) query.pinned = pinned === "true";
  if (featured) query.featured = featured === "true";
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { content: { $regex: search, $options: "i" } }
    ];
  }

  const announcements = await Announcement.find(query)
    .populate("createdBy", "name email")
    .sort({ createdAt: -1, pinned: -1 })
    .limit(100)
    .lean();

  res.json({ success: true, data: announcements });
});

// @desc    Create new announcement
// @route   POST /api/principal/announcements
export const createAnnouncement = asyncHandler(async (req, res) => {
  const { title, content, type, priority, audience, channels, scheduledFor, expiresAt, pinned, featured } = req.body;

  const announcement = await Announcement.create({
    title,
    content,
    type,
    priority,
    audience,
    channels,
    scheduledFor,
    expiresAt,
    pinned: pinned || false,
    featured: featured || false,
    createdBy: req.user._id,
    status: scheduledFor ? "scheduled" : "published"
  });

  res.status(201).json({ success: true, data: announcement });
});

// @desc    Update announcement
// @route   PUT /api/principal/announcements/:id
export const updateAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!announcement) {
    return res.status(404).json({ success: false, message: "Announcement not found" });
  }

  res.json({ success: true, data: announcement });
});

// @desc    Delete announcement
// @route   DELETE /api/principal/announcements/:id
export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);

  if (!announcement) {
    return res.status(404).json({ success: false, message: "Announcement not found" });
  }

  res.json({ success: true, message: "Announcement deleted successfully" });
});

// @desc    Pin/unpin announcement
// @route   PUT /api/principal/announcements/:id/pin
export const pinAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findByIdAndUpdate(
    req.params.id,
    { pinned: req.body.pinned },
    { new: true }
  );

  if (!announcement) {
    return res.status(404).json({ success: false, message: "Announcement not found" });
  }

  res.json({ success: true, data: announcement });
});

// @desc    Archive announcement
// @route   PUT /api/principal/announcements/:id/archive
export const archiveAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findByIdAndUpdate(
    req.params.id,
    { status: "archived" },
    { new: true }
  );

  if (!announcement) {
    return res.status(404).json({ success: false, message: "Announcement not found" });
  }

  res.json({ success: true, data: announcement });
});

// ==========================================
// NEW MODULES - Teacher Assignment, Timetable, Permissions, Class Management, Leave Approval
// @desc    Assign class teacher to class
// @route   POST /api/principal/class-teacher/assign
export const assignClassTeacher = asyncHandler(async (req, res) => {
  const { classId, teacherId, academicYear, notes = "" } = req.body;
  const actor = resolveActorName(req.user);

  const resolvedTeacherId = await resolveTeacherId(teacherId);
  const resolvedClassId = await resolveClassId(classId, academicYear);

  if (!resolvedClassId || !resolvedTeacherId || !academicYear) {
    return res.status(400).json({ success: false, message: "classId, teacherId and academicYear are required" });
  }

  const cls = await Class.findById(resolvedClassId);
  if (!cls) {
    return res.status(404).json({ success: false, message: "Class not found" });
  }

  const existingClassTeacher = cls.classTeacher || null;

  if (existingClassTeacher && String(existingClassTeacher) === String(resolvedTeacherId)) {
    return res.status(409).json({
      success: false,
      message: "This teacher is already assigned as class teacher for this class.",
    });
  }

  // Check if teacher is already class teacher for another class via Class model
  const teacherOtherClass = await Class.findOne({
    classTeacher: resolvedTeacherId,
    _id: { $ne: resolvedClassId },
  }).lean();

  if (teacherOtherClass) {
    const conflictDisplay = getClassDisplayInfo(teacherOtherClass.name || teacherOtherClass.className || "");
    return res.status(409).json({
      success: false,
      message:
        `This teacher is already assigned as class teacher for ` +
        `${conflictDisplay.displayName}${teacherOtherClass.section ? `-${teacherOtherClass.section}` : ""}. ` +
        `One teacher can be class teacher for only one active class at a time.`,
    });
  }

  applyClassTeacherState(cls, resolvedTeacherId, actor, notes || "Assigned via class teacher management");
  cls.updatedBy = actor;
  await cls.save();

  res.status(201).json({ success: true, data: { classId: cls._id, classTeacher: resolvedTeacherId }, message: "Class teacher assigned successfully" });
});

// @desc    Transfer class teacher
// @route   PUT /api/principal/class-teacher/transfer/:classId
export const transferClassTeacher = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { newTeacherId, academicYear, reason = "" } = req.body;
  const actor = resolveActorName(req.user);

  const resolvedTeacherId = await resolveTeacherId(newTeacherId);
  const resolvedClassId = await resolveClassId(classId, academicYear);

  if (!resolvedTeacherId || !resolvedClassId || !academicYear) {
    return res.status(400).json({ success: false, message: "newTeacherId and academicYear are required" });
  }

  const cls = await Class.findById(resolvedClassId);
  if (!cls) {
    return res.status(404).json({ success: false, message: "Class not found" });
  }

  // Check if teacher is already class teacher for another class via Class model
  const teacherOtherClass = await Class.findOne({
    classTeacher: resolvedTeacherId,
    _id: { $ne: resolvedClassId },
  }).lean();

  if (teacherOtherClass) {
    const conflictDisplay = getClassDisplayInfo(teacherOtherClass.name || teacherOtherClass.className || "");
    return res.status(409).json({
      success: false,
      message:
        `This teacher is already assigned as class teacher for ` +
        `${conflictDisplay.displayName}${teacherOtherClass.section ? `-${teacherOtherClass.section}` : ""}. ` +
        `One teacher can be class teacher for only one active class at a time.`,
    });
  }

  if (!cls.classTeacher) {
    return res.status(409).json({
      success: false,
      message: "No active class teacher exists to transfer",
    });
  }

  applyClassTeacherState(cls, resolvedTeacherId, actor, reason || "Class teacher transfer");
  cls.updatedBy = actor;
  await cls.save();

  res.json({ success: true, data: { classId: cls._id, classTeacher: resolvedTeacherId }, message: "Class teacher transferred successfully" });
});

// @desc    Get class teacher by class
// @route   GET /api/principal/class-teacher/class/:classId
export const getClassTeacherByClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;

  const cls = await Class.findById(classId)
    .populate("classTeacher", "name email employeeId contact professional")
    .lean();

  if (!cls) {
    return res.status(404).json({ success: false, message: "Class not found" });
  }

  res.json({
    success: true,
    data: {
      class: cls,
      classTeacher: cls.classTeacher || null,
    },
  });
});

// @desc    Get class timetable
// @route   GET /api/principal/timetable
export const getClassTimetable = asyncHandler(async (req, res) => {
  const { classId, sectionId, teacherId } = req.query;

  const query = {};
  if (classId) query.class = classId;
  if (sectionId) query.section = sectionId;
  if (teacherId) query.teacher = teacherId;

  const timetable = await Timetable.find(query)
    .populate("subject", "name")
    .populate("teacher", "name email")
    .populate("class", "name section")
    .lean();

  res.json({ success: true, data: timetable });
});

// @desc    Save/update timetable
// @route   POST /api/principal/timetable
export const saveTimetable = asyncHandler(async (req, res) => {
  const { classId, sectionId, academicYear, term, schedule } = req.body;

  console.log('💾 Saving timetable:', { classId, sectionId, entries: schedule.length });

  // Delete existing timetable for this class
  await Timetable.deleteMany({
    $or: [
      { class: classId, section: sectionId || null },
      {
        classId,
        sectionId: sectionId || null,
        academicYearId: academicYear || null,
        term: term || null,
      },
    ],
  });

  // Create new entries - handle both ObjectId and string subject/teacher IDs
  const entries = schedule.map((entry) => {
    const entryData = {
      class: classId,
      classId,
      section: sectionId || null,
      sectionId: sectionId || null,
      academicYearId: academicYear || null,
      term: term || null,
      version: `${entry.day}-${entry.period}`,
      day: entry.day,
      period: entry.period,
      startTime: entry.startTime,
      endTime: entry.endTime,
    };

    // Handle subject ID - can be ObjectId or string
    if (entry.subjectId) {
      entryData.subject = entry.subjectId;
    }

    // Handle teacher ID - can be ObjectId or string
    if (entry.teacherId) {
      entryData.teacher = entry.teacherId;
    }

    // Handle optional room number
    if (entry.roomNo) {
      entryData.roomNo = entry.roomNo;
    }

    return entryData;
  });

  console.log('💾 Inserting entries:', entries.length);

  const timetable = await Timetable.insertMany(entries);

  console.log('✅ Timetable saved:', timetable.length, 'entries');

  res.status(201).json({ success: true, data: timetable, message: 'Timetable saved successfully' });
});

// ==================== COMPREHENSIVE PERMISSION MANAGEMENT ====================

// @desc    Get all teacher permissions with full details
// @route   GET /api/principal/teacher-permissions
export const getTeacherPermissions = asyncHandler(async (req, res) => {
  // Get all teachers with nested data
  const allTeachers = await Teacher.find()
    .populate("user", "email")
    .lean();

  // Get all existing permission records
  const existingPermissions = await TeacherPermission.find()
    .populate("teacher")
    .populate("permissions.classes", "name section")
    .populate("permissions.subjects", "name code")
    .populate("lastUpdatedBy", "name email")
    .lean();

  // Create a map of existing permissions by teacher ID
  const permissionMap = {};
  existingPermissions.forEach(perm => {
    if (perm.teacher && perm.teacher._id) {
      permissionMap[perm.teacher._id] = perm;
    }
  });

  // Helper function to extract teacher name
  const getTeacherName = (teacher) => {
    if (!teacher) return "Unknown";
    // Try different name fields
    if (teacher.name) return teacher.name;
    if (teacher.fullName) return teacher.fullName;
    if (teacher.personal?.firstName) {
      const firstName = teacher.personal.firstName || "";
      const lastName = teacher.personal.lastName || "";
      return `${firstName} ${lastName}`.trim() || "Unknown";
    }
    return "Unknown";
  };

  // Helper function to extract email
  const getTeacherEmail = (teacher) => {
    if (!teacher) return "";
    if (teacher.email) return teacher.email;
    if (teacher.contact?.email) return teacher.contact.email;
    if (teacher.user?.email) return teacher.user.email;
    return "";
  };

  // Helper function to extract department
  const getTeacherDepartment = (teacher) => {
    if (!teacher) return "";
    if (teacher.department) return teacher.department;
    if (teacher.professional?.department) return teacher.professional.department;
    return "";
  };

  // For teachers without permission records, create default records in response
  const result = allTeachers.map(teacher => {
    if (permissionMap[teacher._id]) {
      // Ensure teacher object has proper name structure
      const perm = permissionMap[teacher._id];
      if (perm.teacher && !perm.teacher.name) {
        perm.teacher.name = getTeacherName(perm.teacher);
        perm.teacher.department = getTeacherDepartment(perm.teacher);
        perm.teacher.email = getTeacherEmail(perm.teacher);
      }
      return perm;
    }
    
    // Return default permission structure for teachers without records
    return {
      _id: null,
      teacher: {
        _id: teacher._id,
        name: getTeacherName(teacher),
        email: getTeacherEmail(teacher),
        employeeId: teacher.employeeId,
        department: getTeacherDepartment(teacher),
        designation: teacher.professional?.designation || "",
        qualification: teacher.professional?.qualification || "",
        experience: teacher.professional?.experienceYears || 0,
        status: teacher.status || "active",
        photo: teacher.photo || "",
      },
      permissions: {
        classes: [],
        sections: [],
        subjects: [],
        canTakeExams: false,
        canEnterMarks: false,
        canViewAttendance: false,
        canManageStudents: false,
        canCreateReports: false,
        canManageAnnouncements: false,
        canAccessAnalytics: false,
        canManageTimetable: false,
        canApproveLeave: false,
        canManageLibrary: false,
      },
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  res.json({ success: true, data: result });
});

// @desc    Get permission statistics and analytics
// @route   GET /api/principal/teacher-permissions/stats
export const getPermissionStats = asyncHandler(async (req, res) => {
  const [
    allTeachers,
    allPermissions,
    templates,
    auditLogs
  ] = await Promise.all([
    Teacher.countDocuments({ status: "active" }),
    TeacherPermission.countDocuments({ status: "active" }),
    PermissionTemplate.find({ type: "system" }),
    PermissionAuditLog.find().sort({ createdAt: -1 }).limit(100)
  ]);

  // Calculate permission statistics
  const permissions = await TeacherPermission.find()
    .populate("teacher", "department")
    .lean();

  const permissionCoverage = {
    canTakeExams: 0,
    canEnterMarks: 0,
    canViewAttendance: 0,
    canManageStudents: 0,
    canCreateReports: 0,
    canAccessAnalytics: 0,
  };

  let fullAccessCount = 0;
  let limitedAccessCount = 0;

  permissions.forEach(perm => {
    const p = perm.permissions;
    Object.keys(permissionCoverage).forEach(key => {
      if (p[key]) permissionCoverage[key]++;
    });

    const enabledCount = Object.values(p).filter(v => v === true).length;
    if (enabledCount >= 8) fullAccessCount++;
    else if (enabledCount > 0) limitedAccessCount++;
  });

  const stats = {
    totalTeachers: allTeachers,
    activeTeachers: allTeachers,
    teachersWithFullAccess: fullAccessCount,
    teachersWithLimitedAccess: limitedAccessCount,
    averagePermissionsPerTeacher: permissions.length > 0 ? allPermissions / allTeachers : 0,
    permissionCoverage,
    mostGrantedPermissions: Object.entries(permissionCoverage)
      .map(([name, count]) => ({
        name: name.replace(/^can/, ""),
        count,
        percentage: allTeachers > 0 ? parseFloat(((count / allTeachers) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => b.count - a.count),
    departmentBreakdown: [],
    roleBreakdown: [],
    templateUsage: templates.map(t => ({
      templateId: t._id,
      templateName: t.name,
      usageCount: t.usageCount
    }))
  };

  res.json({ success: true, data: stats });
});

// @desc    Create permission template
// @route   POST /api/principal/teacher-permissions/templates
export const createPermissionTemplate = asyncHandler(async (req, res) => {
  const { name, description, permissions, category } = req.body;

  const template = new PermissionTemplate({
    name,
    description,
    permissions,
    category: category || "teaching",
    type: "custom",
    createdBy: req.user?._id,
    status: "active"
  });

  await template.save();
  res.status(201).json({ success: true, data: template });
});

// @desc    Get permission templates
// @route   GET /api/principal/teacher-permissions/templates
export const getPermissionTemplates = asyncHandler(async (req, res) => {
  try {
    const templates = await PermissionTemplate.find({ status: "active" })
      .populate("createdBy", "name email")
      .lean();
    res.json({ success: true, data: templates || [] });
  } catch (error) {
    // Return empty array if PermissionTemplate collection doesn't exist yet
    res.json({ success: true, data: [] });
  }
});

// @desc    Apply template to multiple teachers
// @route   POST /api/principal/teacher-permissions/templates/apply
export const applyPermissionTemplate = asyncHandler(async (req, res) => {
  const { templateId, teacherIds, reason } = req.body;

  const template = await PermissionTemplate.findById(templateId);
  if (!template) {
    return res.status(404).json({ success: false, message: "Template not found" });
  }

  const updateResults = [];
  const adminUser = req.user || { _id: null, name: "System", email: "system@school.edu" };

  for (const teacherId of teacherIds) {
    try {
      const teacher = await Teacher.findById(teacherId);
      if (!teacher) continue;

      const previousPerm = await TeacherPermission.findOne({ teacher: teacherId });
      const oldValue = previousPerm?.permissions || {};

      const permission = await TeacherPermission.findOneAndUpdate(
        { teacher: teacherId },
        {
          teacher: teacherId,
          permissions: template.permissions,
          appliedTemplate: {
            id: template._id,
            name: template.name,
            appliedAt: new Date()
          },
          lastUpdatedBy: adminUser._id,
          status: "active"
        },
        { upsert: true, new: true }
      );

      // Log audit
      await PermissionAuditLog.create({
        adminId: adminUser._id,
        adminName: adminUser.name,
        adminRole: req.user?.role || "Principal",
        teacherId,
        teacherName: teacher.name,
        teacherDepartment: teacher.department,
        action: "template_apply",
        resource: "all",
        permission: template.name,
        oldValue,
        newValue: template.permissions,
        reason,
        ipAddress: req.ip,
        status: "success"
      });

      updateResults.push({ teacherId, success: true });
    } catch (error) {
      updateResults.push({ teacherId, success: false, error: error.message });
    }
  }

  // Update template usage count
  template.usageCount = (template.usageCount || 0) + teacherIds.length;
  await template.save();

  res.json({ success: true, data: updateResults, message: "Template applied successfully" });
});

// @desc    Bulk update permissions
// @route   POST /api/principal/teacher-permissions/bulk
export const bulkUpdatePermissions = asyncHandler(async (req, res) => {
  const { teacherIds, action, permission, reason } = req.body;

  const updateResults = [];
  const adminUser = req.user || { _id: null, name: "System", email: "system@school.edu" };

  for (const teacherId of teacherIds) {
    try {
      const teacher = await Teacher.findById(teacherId);
      if (!teacher) continue;

      const previousPerm = await TeacherPermission.findOne({ teacher: teacherId });
      const oldValue = previousPerm?.permissions || {};

      let newValue = { ...oldValue };
      if (action === "grant") {
        newValue[permission] = true;
      } else if (action === "revoke") {
        newValue[permission] = false;
      }

      const updated = await TeacherPermission.findOneAndUpdate(
        { teacher: teacherId },
        {
          teacher: teacherId,
          permissions: newValue,
          lastUpdatedBy: adminUser._id,
          status: "active"
        },
        { upsert: true, new: true }
      );

      // Log audit
      await PermissionAuditLog.create({
        adminId: adminUser._id,
        adminName: adminUser.name,
        adminRole: req.user?.role || "Principal",
        teacherId,
        teacherName: teacher.name,
        teacherDepartment: teacher.department,
        action: action === "grant" ? "grant" : "revoke",
        resource: "permission",
        permission,
        oldValue: oldValue[permission],
        newValue: newValue[permission],
        reason,
        ipAddress: req.ip,
        status: "success"
      });

      updateResults.push({ teacherId, success: true });
    } catch (error) {
      updateResults.push({ teacherId, success: false, error: error.message });
    }
  }

  res.json({ success: true, data: updateResults, message: "Permissions updated successfully" });
});

// @desc    Get audit logs
// @route   GET /api/principal/teacher-permissions/audit-logs
export const getPermissionAuditLogs = asyncHandler(async (req, res) => {
  try {
    const { teacherId, action, limit = 100 } = req.query;

    const query = {};
    if (teacherId) query.teacherId = teacherId;
    if (action) query.action = action;

    const logs = await PermissionAuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("adminId", "name email")
      .populate("teacherId", "name email")
      .lean();

    res.json({ success: true, data: logs || [] });
  } catch (error) {
    // Return empty array if PermissionAuditLog collection doesn't exist yet
    res.json({ success: true, data: [] });
  }
});

// @desc    Get teacher permissions by teacher ID
// @route   GET /api/principal/teacher-permissions/:teacherId
export const getTeacherPermissionById = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;

  const permission = await TeacherPermission.findOne({ teacher: teacherId })
    .populate("teacher", "name email employeeId department designation")
    .populate("permissions.classes", "name section")
    .populate("permissions.subjects", "name code")
    .populate("lastUpdatedBy", "name email");

  if (!permission) {
    return res.status(404).json({ success: false, message: "Permission record not found" });
  }

  res.json({ success: true, data: permission });
});

// @desc    Update teacher permissions with audit
// @route   PUT /api/principal/teacher-permissions/:teacherId
export const updateTeacherPermissions = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  const { permissions, reason } = req.body;

  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    return res.status(404).json({ success: false, message: "Teacher not found" });
  }

  const previousPerm = await TeacherPermission.findOne({ teacher: teacherId });
  const oldValue = previousPerm?.permissions || {};

  const teacherPermission = await TeacherPermission.findOneAndUpdate(
    { teacher: teacherId },
    {
      teacher: teacherId,
      permissions,
      lastUpdatedBy: req.user?._id,
      status: "active"
    },
    { upsert: true, new: true }
  ).populate("teacher", "name email department");

  // Log audit
  const adminUser = req.user || { _id: null, name: "System", email: "system@school.edu" };
  await PermissionAuditLog.create({
    adminId: adminUser._id,
    adminName: adminUser.name,
    adminRole: req.user?.role || "Principal",
    teacherId,
    teacherName: teacher.name,
    teacherDepartment: teacher.department,
    action: "modify",
    resource: "all",
    permission: "multiple",
    oldValue,
    newValue: permissions,
    reason: reason || "Manual update",
    ipAddress: req.ip,
    status: "success"
  });

  res.json({ success: true, data: teacherPermission, message: "Permissions updated successfully" });
});

const DEFAULT_WORKING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const resolveActorName = (user) => {
  return user?.name || user?.fullName || user?.email || String(user?._id || "system");
};

const normalizeTeacherView = (teacherDoc) => {
  if (!teacherDoc) return null;

  // Handle both populated and non-populated teacher references
  const teacherObj = teacherDoc?.toObject ? teacherDoc.toObject() : teacherDoc;
  
  const firstName = teacherObj?.personal?.firstName || "";
  const lastName = teacherObj?.personal?.lastName || "";
  const fullName = teacherObj?.name || `${firstName} ${lastName}`.trim() || teacherObj?.employeeId || "Unknown Teacher";

  return {
    _id: String(teacherObj._id || teacherObj),
    name: fullName,
    email: teacherObj?.email || teacherObj?.contact?.email || "",
    department: teacherObj?.department || teacherObj?.professional?.department || "General",
    phone: teacherObj?.phone || teacherObj?.contact?.phone || "",
  };
};

const formatClassRecord = (classDoc) => {
  try {
    const classObj = classDoc?.toObject ? classDoc.toObject() : classDoc;
    const section = classObj?.section || null;
    const displayInfo = getClassDisplayInfo(classObj?.name || classObj?.className);
    const normalizedClassName = displayInfo.displayName;
    const capacity = Number(classObj.capacity ?? 40);
    const studentCount = Number(classObj.studentCount ?? 0);

    return {
      _id: String(classObj._id),
      name: normalizedClassName || classObj?.name || classObj?.className || "Unnamed Class",
      section,
      displayName: section ? `${normalizedClassName}-${section}` : normalizedClassName,
      displayInfo: {
        className: normalizedClassName,
        classNumber: displayInfo.classNumber,
        romanNumeral: displayInfo.romanNumeral,
        gradeLevel: displayInfo.gradeLevel,
      },
      classOrder: Number(classObj.classOrder ?? parseClassOrder(normalizedClassName)),
      capacity,
      studentCount,
      availableSeats: Math.max(0, capacity - studentCount),
      classTeacher: normalizeTeacherView(classObj.classTeacher),
      classTeacherId: classObj.classTeacher ? String(classObj.classTeacher._id || classObj.classTeacher) : null,
      classTeacherAssignedAt: classObj.classTeacherAssignedAt || null,
      classTeacherAssignedBy: classObj.classTeacherAssignedBy || null,
      academicYear: classObj.academicYear,
      term: classObj.term || "annual",
      roomNumber: classObj.roomNumber || null,
      building: classObj.building || null,
      floor: Number(classObj.floor ?? 1),
      timetableId: classObj.timetableId || null,
      workingDays: Array.isArray(classObj.workingDays) && classObj.workingDays.length > 0
        ? classObj.workingDays
        : DEFAULT_WORKING_DAYS,
      periodsPerDay: Number(classObj.periodsPerDay ?? 8),
      status: classObj.status || "active",
      isComposite: Boolean(classObj.isComposite),
      createdAt: classObj.createdAt,
      updatedAt: classObj.updatedAt,
      createdBy: classObj.createdBy || "system",
      updatedBy: classObj.updatedBy || "system",
    };
  } catch (error) {
    console.error("Error formatting class record:", error);
    return null;
  }
};

const getClassAssignmentSnapshot = (classDoc) => {
  const classObj = classDoc?.toObject ? classDoc.toObject() : classDoc;
  const rawName = String(classObj?.name || classObj?.className || "").trim();
  
  // Use the new Roman numeral display format
  const displayInfo = getClassDisplayInfo(rawName);
  const className = displayInfo.displayName;

  return {
    className,
    classNumber: displayInfo.classNumber,
    romanNumeral: displayInfo.romanNumeral,
    section: classObj?.section ? String(classObj.section).trim().toUpperCase() : null,
  };
};

const applyClassTeacherState = (classDoc, nextTeacherId, actor, reason = "Updated by principal") => {
  if (!classDoc) return false;

  if (!Array.isArray(classDoc.classTeacherHistory)) {
    classDoc.classTeacherHistory = [];
  }

  const previousTeacherId = classDoc.classTeacher ? String(classDoc.classTeacher) : null;
  const normalizedNextTeacherId = nextTeacherId ? String(nextTeacherId) : null;

  if (previousTeacherId === normalizedNextTeacherId) {
    return false;
  }

  const now = new Date();
  const activeHistory = classDoc.classTeacherHistory.find((entry) => entry.status === "active" && !entry.assignedTo);

  if (activeHistory) {
    activeHistory.assignedTo = now;
    activeHistory.status = normalizedNextTeacherId ? "transferred" : "ended";
  }

  if (normalizedNextTeacherId) {
    classDoc.classTeacherHistory.push({
      teacher: normalizedNextTeacherId,
      assignedFrom: now,
      assignedBy: actor,
      reason,
      status: "active",
    });
  }

  classDoc.classTeacher = normalizedNextTeacherId || null;
  classDoc.classTeacherAssignedAt = normalizedNextTeacherId ? now : null;
  classDoc.classTeacherAssignedBy = normalizedNextTeacherId ? actor : null;

  return true;
};

const findTeacherClassConflict = async ({ teacherId, academicYear, excludeClassId = null }) => {
  if (!teacherId || !academicYear) return null;

  const query = {
    classTeacher: teacherId,
    academicYear: String(academicYear).trim(),
    status: { $nin: ["archived", "inactive"] },
  };

  if (excludeClassId) {
    query._id = { $ne: excludeClassId };
  }

  return Class.findOne(query).select("_id name section academicYear").lean();
};

const buildClassFilters = (query) => {
  const {
    search,
    academicYear,
    status,
    classTeacher,
    hasTeacher,
    building,
    classRange,
  } = query;

  const filters = {};

  if (search) {
    const searchRegex = new RegExp(String(search).trim(), "i");
    filters.$or = [
      { name: searchRegex },
      { section: searchRegex },
      { roomNumber: searchRegex },
      { building: searchRegex },
    ];
  }

  if (academicYear && academicYear !== "all") {
    filters.academicYear = academicYear;
  }

  if (status && status !== "all") {
    filters.status = status;
  }

  if (building && building !== "all") {
    filters.building = building;
  }

  const teacherFilter = hasTeacher || classTeacher;
  if (teacherFilter === "assigned") {
    filters.classTeacher = { $ne: null };
  } else if (teacherFilter === "unassigned") {
    filters.classTeacher = null;
  }

  if (classRange && classRange !== "all" && String(classRange).includes("-")) {
    const [minRaw, maxRaw] = String(classRange).split("-");
    const min = Number(minRaw);
    const max = Number(maxRaw);

    if (!Number.isNaN(min) && !Number.isNaN(max)) {
      filters.classOrder = { $gte: min, $lte: max };
    }
  }

  return filters;
};

// @desc    Get all classes
// @route   GET /api/principal/classes
export const getClasses = asyncHandler(async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Number(req.query.limit || 200));
    const skip = (page - 1) * limit;

    const filters = buildClassFilters(req.query);

    const [classes, total] = await Promise.all([
      Class.find(filters)
        .populate("classTeacher", "name email department phone personal.firstName personal.lastName contact.email contact.phone professional.department employeeId")
        .sort({ classOrder: 1, name: 1, section: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Class.countDocuments(filters),
    ]);

    const formatted = classes.map(formatClassRecord).filter(record => record !== null);

    res.json({
      success: true,
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Error in getClasses:", error);
    throw error;
  }
});

// @desc    Create new class
// @route   POST /api/principal/classes
export const createClass = asyncHandler(async (req, res) => {
  const actor = resolveActorName(req.user);
  const {
    name,
    section,
    capacity,
    studentCount,
    classTeacherId,
    academicYear,
    term,
    roomNumber,
    building,
    floor,
    timetableId,
    periodsPerDay,
    workingDays,
    status,
    isComposite,
  } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, message: "Class name is required" });
  }

  const strictNameCheck = validateStrictClassName(String(name).trim());
  if (!strictNameCheck.isValid) {
    return res.status(400).json({ success: false, message: strictNameCheck.message });
  }

  if (!academicYear || !String(academicYear).trim()) {
    return res.status(400).json({ success: false, message: "Academic year is required" });
  }

  const normalizedName = strictNameCheck.normalizedName || normalizeClassName(String(name).trim());
  const normalizedSection = section ? String(section).trim().toUpperCase() : null;
  const normalizedAcademicYear = String(academicYear).trim();

  // Normalize class name for duplicate detection
  // "9th Class" and "CLASS 9" will both normalize to "CLASS_9"
  const normalizedClassName = normalizeClassNameForComparison(normalizedName);

  // Check for duplicates using normalized class name
  const allClasses = await Class.find({
    academicYear: normalizedAcademicYear,
    section: normalizedSection || null,
  }).select("name section academicYear");

  // Check if any existing class has the same normalized name
  const duplicate = allClasses.find(cls => {
    const existingNormalizedName = normalizeClassNameForComparison(cls.name);
    return existingNormalizedName === normalizedClassName;
  });

  if (duplicate) {
    const displayInfo = getClassDisplayInfo(duplicate.name);
    return res.status(409).json({
      success: false,
      message: `Class ${displayInfo.displayName}${normalizedSection ? `-${normalizedSection}` : ""} already exists for ${normalizedAcademicYear}. Cannot create duplicate classes with the same class number.`,
      duplicateClassId: duplicate._id,
      duplicateClassName: duplicate.name,
    });
  }

  let classTeacher = null;
  if (classTeacherId) {
    const teacherExists = await Teacher.findById(classTeacherId).select("_id");
    if (!teacherExists) {
      return res.status(400).json({ success: false, message: "Invalid class teacher ID" });
    }

    const teacherConflict = await findTeacherClassConflict({
      teacherId: teacherExists._id,
      academicYear: normalizedAcademicYear,
    });

    if (teacherConflict) {
      const conflictDisplay = getClassDisplayInfo(teacherConflict.name || "");
      return res.status(409).json({
        success: false,
        message:
          `This teacher is already assigned as class teacher for ` +
          `${conflictDisplay.displayName}${teacherConflict.section ? `-${teacherConflict.section}` : ""} ` +
          `in ${teacherConflict.academicYear}. One teacher can be class teacher for only one active class at a time.`,
      });
    }

    classTeacher = teacherExists._id;
  }

  let classData;
  try {
    classData = await Class.create({
      name: normalizedName,
      section: normalizedSection,
      classOrder: parseClassOrder(normalizedName),
      capacity: Number(capacity) > 0 ? Number(capacity) : 40,
      studentCount: Number(studentCount) >= 0 ? Number(studentCount) : 0,
      classTeacher,
      classTeacherAssignedAt: classTeacher ? new Date() : null,
      classTeacherAssignedBy: classTeacher ? actor : null,
      classTeacherHistory: classTeacher
        ? [{ teacher: classTeacher, assignedFrom: new Date(), assignedBy: actor, status: "active" }]
        : [],
      academicYear: String(academicYear).trim(),
      term: ["term1", "term2", "annual"].includes(term) ? term : "annual",
      roomNumber: roomNumber || null,
      building: building || null,
      floor: Number.isFinite(Number(floor)) ? Number(floor) : 1,
      timetableId: timetableId || null,
      periodsPerDay: Number(periodsPerDay) > 0 ? Number(periodsPerDay) : 8,
      workingDays: Array.isArray(workingDays) && workingDays.length > 0 ? workingDays : DEFAULT_WORKING_DAYS,
      status: ["active", "inactive", "archived", "upcoming"].includes(status) ? status : "active",
      isComposite: Boolean(isComposite),
      createdBy: actor,
      updatedBy: actor,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: `Class ${normalizedName}${normalizedSection ? `-${normalizedSection}` : ""} already exists for ${academicYear}`,
      });
    }

    throw error;
  }

  const created = await Class.findById(classData._id)
    .populate("classTeacher", "name email department phone personal.firstName personal.lastName contact.email contact.phone professional.department employeeId");

  res.status(201).json({ 
    success: true, 
    data: formatClassRecord(created),
    message: "Class created successfully"
  });
});

// @desc    Update class
// @route   PUT /api/principal/classes/:id
export const updateClass = asyncHandler(async (req, res) => {
  const actor = resolveActorName(req.user);
  const classData = await Class.findById(req.params.id);

  if (!classData) {
    return res.status(404).json({ success: false, message: "Class not found" });
  }

  const previousAcademicYear = classData.academicYear;

  const {
    name,
    section,
    capacity,
    studentCount,
    classTeacherId,
    academicYear,
    term,
    roomNumber,
    building,
    floor,
    timetableId,
    periodsPerDay,
    workingDays,
    status,
    isComposite,
    classTeacherReason,
  } = req.body;

  const strictUpdateNameCheck =
    name !== undefined ? validateStrictClassName(String(name || "").trim()) : { isValid: true, message: "", normalizedName: classData.name };

  if (!strictUpdateNameCheck.isValid) {
    return res.status(400).json({ success: false, message: strictUpdateNameCheck.message });
  }

  const nextName =
    name !== undefined
      ? strictUpdateNameCheck.normalizedName || normalizeClassName(String(name || "").trim())
      : classData.name;
  const nextSection = section !== undefined ? (section ? String(section).trim().toUpperCase() : null) : classData.section;
  const nextAcademicYear =
    academicYear !== undefined ? String(academicYear || "").trim() : classData.academicYear;

  if (!nextName) {
    return res.status(400).json({ success: false, message: "Class name cannot be empty" });
  }

  if (!nextAcademicYear) {
    return res.status(400).json({ success: false, message: "Academic year is required" });
  }

  // Normalize class name for duplicate detection
  const normalizedNextName = normalizeClassNameForComparison(nextName);

  // Check for duplicates using normalized class name (excluding current class)
  const allClasses = await Class.find({
    _id: { $ne: classData._id },
    academicYear: nextAcademicYear,
    section: nextSection || null,
  }).select("name section academicYear");

  const duplicate = allClasses.find(cls => {
    const existingNormalizedName = normalizeClassNameForComparison(cls.name);
    return existingNormalizedName === normalizedNextName;
  });

  if (duplicate) {
    const displayInfo = getClassDisplayInfo(duplicate.name);
    return res.status(409).json({
      success: false,
      message: `Class ${displayInfo.displayName}${nextSection ? `-${nextSection}` : ""} already exists for ${nextAcademicYear}. Cannot have duplicate classes with the same class number.`,
      duplicateClassId: duplicate._id,
      duplicateClassName: duplicate.name,
    });
  }

  if (name !== undefined) {
    const normalizedName = strictUpdateNameCheck.normalizedName || normalizeClassName(String(name || "").trim());
    if (!normalizedName) {
      return res.status(400).json({ success: false, message: "Class name cannot be empty" });
    }

    classData.name = normalizedName;
    classData.classOrder = parseClassOrder(classData.name);
  }

  if (section !== undefined) classData.section = section ? String(section).trim().toUpperCase() : null;
  if (capacity !== undefined) classData.capacity = Math.max(1, Number(capacity) || 40);
  if (studentCount !== undefined) classData.studentCount = Math.max(0, Number(studentCount) || 0);
  if (academicYear !== undefined) classData.academicYear = nextAcademicYear;
  if (term !== undefined && ["term1", "term2", "annual"].includes(term)) classData.term = term;
  if (roomNumber !== undefined) classData.roomNumber = roomNumber || null;
  if (building !== undefined) classData.building = building || null;
  if (floor !== undefined) classData.floor = Number.isFinite(Number(floor)) ? Number(floor) : classData.floor;
  if (timetableId !== undefined) classData.timetableId = timetableId || null;
  if (periodsPerDay !== undefined) classData.periodsPerDay = Math.max(1, Number(periodsPerDay) || classData.periodsPerDay);
  if (Array.isArray(workingDays)) classData.workingDays = workingDays.length > 0 ? workingDays : DEFAULT_WORKING_DAYS;
  if (status !== undefined && ["active", "inactive", "archived", "upcoming"].includes(status)) classData.status = status;
  if (isComposite !== undefined) classData.isComposite = Boolean(isComposite);

  if (classTeacherId !== undefined) {
    const nextTeacherId = classTeacherId ? String(classTeacherId) : null;

    if (nextTeacherId && !isObjectId(nextTeacherId)) {
      return res.status(400).json({ success: false, message: "Invalid class teacher ID" });
    }

    if (nextTeacherId) {
      const teacherExists = await Teacher.findById(nextTeacherId).select("_id");
      if (!teacherExists) {
        return res.status(400).json({ success: false, message: "Invalid class teacher ID" });
      }

      const teacherConflict = await findTeacherClassConflict({
        teacherId: teacherExists._id,
        academicYear: nextAcademicYear,
        excludeClassId: classData._id,
      });

      if (teacherConflict) {
        const conflictDisplay = getClassDisplayInfo(teacherConflict.name || "");
        return res.status(409).json({
          success: false,
          message:
            `This teacher is already assigned as class teacher for ` +
            `${conflictDisplay.displayName}${teacherConflict.section ? `-${teacherConflict.section}` : ""} ` +
            `in ${teacherConflict.academicYear}. One teacher can be class teacher for only one active class at a time.`,
        });
      }
    }

    applyClassTeacherState(classData, nextTeacherId, actor, classTeacherReason || "Updated by principal");
  }

  if (classTeacherId === undefined && classData.classTeacher) {
    const teacherConflict = await findTeacherClassConflict({
      teacherId: classData.classTeacher,
      academicYear: classData.academicYear,
      excludeClassId: classData._id,
    });

    if (teacherConflict) {
      const conflictDisplay = getClassDisplayInfo(teacherConflict.name || "");
      return res.status(409).json({
        success: false,
        message:
          `This class teacher is already assigned to ` +
          `${conflictDisplay.displayName}${teacherConflict.section ? `-${teacherConflict.section}` : ""} ` +
          `in ${teacherConflict.academicYear}. One teacher can be class teacher for only one active class at a time.`,
      });
    }
  }

  classData.updatedBy = actor;

  try {
    await classData.save();
  } catch (error) {
    console.error("Error saving class update:", error);
    
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: `A class with the same name "${classData.name}", section "${classData.section || 'None'}", and academic year "${classData.academicYear}" already exists. Please use a different class name or section.`,
      });
    }
    
    if (error?.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    throw error;
  }
  const updated = await Class.findById(classData._id)
    .populate("classTeacher", "name email department phone personal.firstName personal.lastName contact.email contact.phone professional.department employeeId");

  res.json({ 
    success: true, 
    data: formatClassRecord(updated),
    message: "Class updated successfully"
  });
});

// @desc    Delete class
// @route   DELETE /api/principal/classes/:id
export const deleteClass = asyncHandler(async (req, res) => {
  const classData = await Class.findById(req.params.id);

  if (!classData) {
    return res.status(404).json({ success: false, message: "Class not found" });
  }

  const forceDelete = String(req.query.force || "false") === "true";

  if (!forceDelete && Number(classData.studentCount || 0) > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete class with ${classData.studentCount} enrolled students. Archive it instead.`,
    });
  }

  await classData.deleteOne();

  res.json({ success: true, message: "Class deleted successfully" });
});

// @desc    Archive class
// @route   PATCH /api/principal/classes/:id/archive
export const archiveClass = asyncHandler(async (req, res) => {
  const actor = resolveActorName(req.user);

  const classData = await Class.findByIdAndUpdate(
    req.params.id,
    {
      status: "archived",
      updatedBy: actor,
    },
    { new: true, runValidators: true }
  ).populate("classTeacher", "name email department phone personal.firstName personal.lastName contact.email contact.phone professional.department employeeId");

  if (!classData) {
    return res.status(404).json({ success: false, message: "Class not found" });
  }

  res.json({ success: true, data: formatClassRecord(classData), message: "Class archived" });
});

// @desc    Restore class
// @route   PATCH /api/principal/classes/:id/restore
export const restoreClass = asyncHandler(async (req, res) => {
  const actor = resolveActorName(req.user);

  const classData = await Class.findByIdAndUpdate(
    req.params.id,
    {
      status: "active",
      updatedBy: actor,
    },
    { new: true, runValidators: true }
  ).populate("classTeacher", "name email department phone personal.firstName personal.lastName contact.email contact.phone professional.department employeeId");

  if (!classData) {
    return res.status(404).json({ success: false, message: "Class not found" });
  }

  res.json({ success: true, data: formatClassRecord(classData), message: "Class restored" });
});

// @desc    Get class teacher assignment history
// @route   GET /api/principal/classes/:id/history
export const getClassTeacherHistory = asyncHandler(async (req, res) => {
  const classData = await Class.findById(req.params.id)
    .populate("classTeacherHistory.teacher", "name email department phone personal.firstName personal.lastName contact.email contact.phone professional.department employeeId")
    .lean();

  if (!classData) {
    return res.status(404).json({ success: false, message: "Class not found" });
  }

  const history = (classData.classTeacherHistory || []).map((entry) => {
    const teacher = normalizeTeacherView(entry.teacher);
    return {
      _id: String(entry._id),
      classId: String(classData._id),
      className: normalizeClassName(classData.name),
      section: classData.section || "",
      teacherId: teacher?._id || null,
      teacherName: teacher?.name || "Unknown Teacher",
      teacherDepartment: teacher?.department || "General",
      assignedFrom: entry.assignedFrom,
      assignedTo: entry.assignedTo || null,
      assignedBy: entry.assignedBy || "system",
      reason: entry.reason || "",
      status: entry.status || "ended",
    };
  });

  res.json({ success: true, data: history });
});

// @desc    Get class statistics
// @route   GET /api/principal/classes/stats
export const getClassStatistics = asyncHandler(async (req, res) => {
  try {
    const filters = buildClassFilters(req.query);
    const classes = await Class.find(filters)
      .populate("classTeacher", "name email department phone personal.firstName personal.lastName contact.email contact.phone professional.department employeeId")
      .lean();

    const normalized = classes.map(formatClassRecord).filter(record => record !== null);

    const activeClasses = normalized.filter((c) => c.status === "active").length;
    const archivedClasses = normalized.filter((c) => c.status === "archived").length;
    const totalSections = normalized.filter((c) => c.section).length;
    const totalCapacity = normalized.reduce((sum, c) => sum + c.capacity, 0);
    const totalStudents = normalized.reduce((sum, c) => sum + c.studentCount, 0);
    const averageClassSize = normalized.length > 0 ? totalStudents / normalized.length : 0;
    const utilizationRate = totalCapacity > 0 ? (totalStudents / totalCapacity) * 100 : 0;
    const classesWithoutTeacher = normalized.filter((c) => !c.classTeacher && c.status === "active").length;
    const overCapacityClasses = normalized.filter((c) => c.studentCount > c.capacity).length;
    const underutilizedClasses = normalized.filter((c) => c.studentCount < c.capacity * 0.6).length;

    const byClassOrder = {};
    const byAcademicYear = {};
    const byBuilding = {};

    normalized.forEach((c) => {
      if (!byClassOrder[c.classOrder]) {
        byClassOrder[c.classOrder] = { count: 0, students: 0, capacity: 0 };
      }
      byClassOrder[c.classOrder].count += 1;
      byClassOrder[c.classOrder].students += c.studentCount;
      byClassOrder[c.classOrder].capacity += c.capacity;

      if (!byAcademicYear[c.academicYear]) {
        byAcademicYear[c.academicYear] = { count: 0, students: 0 };
      }
      byAcademicYear[c.academicYear].count += 1;
      byAcademicYear[c.academicYear].students += c.studentCount;

      if (c.building) {
        if (!byBuilding[c.building]) {
          byBuilding[c.building] = { count: 0, capacity: 0 };
        }
        byBuilding[c.building].count += 1;
        byBuilding[c.building].capacity += c.capacity;
      }
    });

    res.json({
      success: true,
      data: {
        totalClasses: normalized.length,
        activeClasses,
        archivedClasses,
        totalSections,
        totalCapacity,
        totalStudents,
        averageClassSize,
        utilizationRate,
        classesWithoutTeacher,
        overCapacityClasses,
        underutilizedClasses,
        byClassOrder,
        byAcademicYear,
        byBuilding,
      },
    });
  } catch (error) {
    console.error("Error in getClassStatistics:", error);
    throw error;
  }
});

// @desc    Get class capacity planning report
// @route   GET /api/principal/classes/capacity-report
export const getClassCapacityReport = asyncHandler(async (req, res) => {
  try {
    const filters = buildClassFilters(req.query);
    const classes = await Class.find(filters)
      .populate("classTeacher", "name email department phone personal.firstName personal.lastName contact.email contact.phone professional.department employeeId")
      .lean();

    const normalized = classes.map(formatClassRecord).filter(record => record !== null);
    const totalCapacity = normalized.reduce((sum, c) => sum + c.capacity, 0);
    const totalStudents = normalized.reduce((sum, c) => sum + c.studentCount, 0);
    const totalAvailableSeats = totalCapacity - totalStudents;
    const overallUtilization = totalCapacity > 0 ? (totalStudents / totalCapacity) * 100 : 0;
    const projectedEnrollment = totalStudents + Math.ceil(totalStudents * 0.1);

    const recommendations = [];
    normalized.forEach((c) => {
      const utilization = c.capacity > 0 ? (c.studentCount / c.capacity) * 100 : 0;
      if (utilization >= 95) {
        recommendations.push({
          classId: c._id,
          className: c.displayName,
          currentCapacity: c.capacity,
          suggestedCapacity: c.capacity + 5,
          reason: "Class is near full capacity. Consider increasing capacity.",
          priority: "high",
        });
      } else if (utilization <= 50) {
        recommendations.push({
          classId: c._id,
          className: c.displayName,
          currentCapacity: c.capacity,
          suggestedCapacity: Math.max(1, Math.floor(c.capacity * 0.7)),
          reason: "Class is underutilized. Consider reducing capacity or merging sections.",
          priority: "medium",
        });
      }
    });

    res.json({
      success: true,
      data: {
        overallUtilization,
        totalAvailableSeats,
        projectedEnrollment,
        needsExpansion: overallUtilization > 85,
        recommendations: recommendations.slice(0, 10),
      },
    });
  } catch (error) {
    console.error("Error in getClassCapacityReport:", error);
    throw error;
  }
});

// @desc    Analyze and fix duplicate classes
// @route   POST /api/principal/classes/cleanup-duplicates
export const cleanupDuplicateClasses = asyncHandler(async (req, res) => {
  try {
    const { execute } = req.body;
    const result = await cleanupDuplicateClassesData({ execute: Boolean(execute) });

    res.json({
      success: true,
      data: result,
      message: execute
        ? `Cleanup complete: Updated ${result.updatedCount} classes and deleted ${result.deletedCount} duplicates`
        : `Found ${result.duplicateGroups} duplicate groups with ${result.totalDuplicates} duplicate classes`,
    });

  } catch (error) {
    console.error("Error in cleanupDuplicateClasses:", error);
    throw error;
  }
});

// @desc    Get leave requests
// @route   GET /api/principal/leave-requests
export const getLeaveRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const query = {};
  if (status && status !== "all") {
    query.status = status;
  }

  const leaveRequests = await LeaveRequest.find(query)
    .populate("teacher", "name email department")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: leaveRequests });
});

// @desc    Update leave request (approve/reject)
// @route   PUT /api/principal/leave-requests/:id
export const updateLeaveRequest = asyncHandler(async (req, res) => {
  const { status, remarks } = req.body;

  const leaveRequest = await LeaveRequest.findByIdAndUpdate(
    req.params.id,
    { status, remarks },
    { new: true, runValidators: true }
  ).populate("teacher", "name email");

  if (!leaveRequest) {
    return res.status(404).json({ success: false, message: "Leave request not found" });
  }

  res.json({ success: true, data: leaveRequest });
});

