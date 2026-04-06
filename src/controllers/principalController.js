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

  const [weeklyAttendance, classWiseToday, lowAttendance, totalStudents] = await Promise.all([
    Attendance.aggregate([
      { $match: { date: { $gte: last7 } } },
      { $group: { 
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, 
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          total: { $sum: 1 }
        } 
      },
      { $addFields: { percentage: { $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 1] } } },
      { $sort: { _id: 1 } }
    ]),
    Attendance.aggregate([
      { $match: { date: { $gte: today, $lte: endToday } } },
      { $lookup: { from: "students", localField: "studentId", foreignField: "_id", as: "student" } },
      { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { class: "$student.academic.class", section: "$student.academic.section" },
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          total: { $sum: 1 }
        }
      },
      { $sort: { "_id.class": 1, "_id.section": 1 } }
    ]),
    Attendance.aggregate([
      { $match: { date: { $gte: last30 } } },
      { $group: { _id: "$studentId", present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } }, total: { $sum: 1 } } },
      { $match: { $expr: { $lt: [{ $divide: ["$present", "$total"] }, 0.75] } } },
      { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "student" } },
      { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $concat: [{ $ifNull: ["$student.personal.firstName", ""] }, " ", { $ifNull: ["$student.personal.lastName", ""] }] },
          class: "$student.academic.class",
          section: "$student.academic.section",
          attendanceRate: { $multiply: [{ $divide: ["$present", "$total"] }, 100] },
          present: 1,
          total: 1,
          parentPhone: { $ifNull: ["$student.parents.father.phone", "$student.parents.mother.phone", ""] }
        }
      },
      { $sort: { attendanceRate: 1 } },
      { $limit: 50 }
    ]),
    Student.countDocuments({ status: "active" })
  ]);

  // Calculate today's stats from classWise data
  const todayStats = classWiseToday.reduce((acc, curr) => {
    acc.present += curr.present || 0;
    acc.absent += curr.absent || 0;
    acc.total += curr.total || 0;
    return acc;
  }, { present: 0, absent: 0, total: 0 });

  res.json({
    success: true,
    data: {
      stats: {
        totalStudents: totalStudents,
        presentToday: todayStats.present,
        absentToday: todayStats.absent,
        onLeaveToday: totalStudents - todayStats.present - todayStats.absent,
        percentage: todayStats.total > 0 ? Math.round((todayStats.present / todayStats.total) * 100) : 0,
      },
      classWiseToday,
      weeklyAttendance,
      lowAttendance,
      teacherWise: [] // Can be added later if teacher attendance is tracked
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
