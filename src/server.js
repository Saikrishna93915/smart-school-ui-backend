import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import historyRoutes from './routes/historyRoutes.js';
import errorHandler from "./middlewares/errorHandler.js";

// Import scheduler service
import { startShiftAutoCloseScheduler } from "./services/shiftAutoCloseService.js"; // ADDED: Global error handler

/* =========================
   ROUTES IMPORTS
========================= */
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import studentAttendanceRoutes from "./routes/studentAttendanceRoutes.js"; // NEW: Student-specific attendance routes
import examRoutes from "./routes/examRoutes.js";
import studentSelfRoutes from "./routes/studentSelfRoutes.js";
import financeRouter from "./routes/financeRoutes.js";
import feesRoutes from "./routes/feesRoutes.js";
import collectionsRouter from "./routes/collectionsRouter.js";
import paymentRoutes from "./routes/paymentRoutes.js"; // NEW: Payment Management
import reportRoutes from './routes/reportRoutes.js';
import progressReportRoutes from './routes/progressReportRoutes.js';
import feeDefaultersRoutes from './routes/feeDefaultersRoutes.js';
import transportRoutes from "./routes/transportRoutes.js";
import settingsRoutesNew from "./routes/settingsRoutesNew.js"; // UPDATED SETTINGS ROUTES
import userManagementRoutes from "./routes/userManagementRoutes.js"; // ADDED USER MANAGEMENT ROUTES

// ==================== NEW ACADEMIC MODULE ROUTES ====================
import subjectRoutes from "./routes/subjectRoutes.js"; // NEW: Subject Management
import syllabusRoutes from "./routes/syllabusRoutes.js"; // NEW: Syllabus Management
import gradeScaleRoutes from "./routes/gradeScaleRoutes.js"; // Grade Scale Management
import diagnoseRoutes from "./routes/diagnoseRoutes.js"; // NEW: Diagnostics (troubleshooting)
import certificateRoutes from "./routes/certificateRoutes.js"; // NEW: Certificate Management

// ====================TEACHER MODULE ROUTES ====================
import teacherDashboardRoutes from "./routes/teacherDashboardRoutes.js"; // Teacher dashboard
import assignmentRoutes from "./routes/assignmentRoutes.js"; // Assignment management
import studyMaterialRoutes from "./routes/studyMaterialRoutes.js"; // Study materials
import performanceAnalyticsRoutes from "./routes/performanceAnalyticsRoutes.js"; // Performance analytics
import communicationRoutes from "./routes/communicationRoutes.js"; // Announcements & messaging
import classScheduleRoutes from "./routes/classScheduleRoutes.js"; // Class schedules
import teacherLessonRoutes from "./routes/teacherLessonRoutes.js"; // Lesson plans
import myClassesRoutes from "./routes/myClassesRoutes.js"; // My Classes management

// ==================== TIMETABLE MODULE ROUTES ====================
import timetableRoutes from "./routes/timetableRoutes.js"; // Timetable management
import timeSlotRoutes from "./routes/timeSlotRoutes.js"; // Time slot management

// ==================== DASHBOARD ROUTES ====================
import dashboardRoutes from "./routes/dashboardRoutes.js"; // Dashboard analytics
import activityRoutes from "./routes/activityRoutes.js"; // Activity tracking & logs

// ==================== NEW ROLE MODULE ROUTES ====================
import principalRoutes from "./routes/principalRoutes.js"; // Principal portal
import cashierRoutes from "./routes/cashierRoutes.js"; // Cashier portal
import cashierStatementRoutes from "./routes/cashierStatementRoutes.js"; // Cashier Statement/Transaction History
import feeFollowUpRoutes from "./routes/feeFollowUpRoutes.js"; // Fee Follow-up & Email Campaigns
import driverRoutes from "./routes/driverRoutes.js"; // Driver portal
import parentRoutes from "./routes/parentRoutes.js"; // Parent portal

/* =========================
   ENV & DB CONFIG
========================= */
dotenv.config();

/* =========================
   APP INITIALIZATION
========================= */
const app = express();
const server = http.createServer(app);

// SECURITY: Restrict CORS to known origins only
const allowedOrigins = [
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://schoolerp1.netlify.app",
  process.env.FRONTEND_URL,
  // SECURITY: Uncomment tunnel URLs only during development
  // /^https:\/\/[\w-]+\.incl\.devtunnels\.ms$/,
  // /^https:\/\/[\w-]+\.tunnel\.cloudflare\.com$/,
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  return allowedOrigins.some((allowedOrigin) => {
    if (typeof allowedOrigin === "string") {
      return origin === allowedOrigin;
    }

    if (allowedOrigin instanceof RegExp) {
      return allowedOrigin.test(origin);
    }

    return false;
  });
};

/* =========================
   SOCKET.IO CONFIGURATION (for real-time transport updates)
========================= */
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ Socket.IO CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  },
  pingTimeout: 60000,
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  // Join vehicle room for real-time tracking
  socket.on("join-vehicle", (vehicleId) => {
    socket.join(`vehicle-${vehicleId}`);
    console.log(`🚗 Socket ${socket.id} joined vehicle-${vehicleId}`);
  });

  // ADDED: Join settings room for real-time settings updates
  socket.on("join-settings", (schoolId) => {
    socket.join(`settings-${schoolId}`);
    console.log(`⚙️ Socket ${socket.id} joined settings-${schoolId}`);
  });

  // Leave vehicle room
  socket.on("leave-vehicle", (vehicleId) => {
    socket.leave(`vehicle-${vehicleId}`);
  });

  // Join driver room
  socket.on("join-driver", (driverId) => {
    socket.join(`driver-${driverId}`);
  });

  // Handle location updates from vehicles
  socket.on("vehicle-location-update", (data) => {
    const { vehicleId, location } = data;
    // Broadcast to all clients tracking this vehicle
    io.to(`vehicle-${vehicleId}`).emit("location-update", {
      vehicleId,
      location,
      timestamp: new Date().toISOString(),
    });
  });

  // ADDED: Handle settings updates
  socket.on("settings-updated", (data) => {
    const { schoolId, category, changes } = data;
    // Broadcast to all clients monitoring settings
    io.to(`settings-${schoolId}`).emit("settings-changed", {
      category,
      changes,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle fuel updates
  socket.on("vehicle-fuel-update", (data) => {
    const { vehicleId, fuelLevel } = data;
    io.to(`vehicle-${vehicleId}`).emit("fuel-update", {
      vehicleId,
      fuelLevel,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle maintenance alerts
  socket.on("maintenance-alert", (data) => {
    const { vehicleId, issue, priority } = data;
    // Broadcast to admin dashboard
    io.emit("maintenance-notification", {
      vehicleId,
      issue,
      priority,
      timestamp: new Date().toISOString(),
    });
  });

  // ADDED: Handle backup progress
  socket.on("backup-progress", (data) => {
    const { schoolId, progress, status } = data;
    io.to(`settings-${schoolId}`).emit("backup-status", {
      progress,
      status,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// Make io accessible in routes
app.set("io", io);

/* =========================
   BODY PARSER
========================= */
// SECURITY: Limit body size to prevent DoS attacks
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* =========================
   CORS
========================= */
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

/* =========================
   LOGGER
========================= */
app.use(morgan("dev"));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

/* =========================
   API ROUTES
========================= */
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/students", studentRoutes);
app.use("/api/admin/teachers", teacherRoutes);
app.use("/api/admin/attendance", attendanceRoutes);
app.use("/api/attendance", studentAttendanceRoutes); // NEW: Student-specific attendance endpoints
app.use("/api/exams", examRoutes);
app.use("/api/student", studentSelfRoutes);

// ==================== FINANCE MODULE ROUTES ====================
app.use("/api/finance", financeRouter);
app.use("/api/fees", feesRoutes);
app.use("/api/finance/collections", collectionsRouter);
app.use("/api/finance/payments", paymentRoutes); // NEW: Payment Management
app.use("/api/finance/fee-defaulters", feeDefaultersRoutes);

// ==================== TRANSPORT MODULE ROUTES ====================
app.use("/api/transport", transportRoutes);

// ==================== ACADEMIC MODULE ROUTES (NEW) ====================
app.use("/api/subjects", subjectRoutes); // Subject CRUD
app.use("/api/syllabus", syllabusRoutes); // Syllabus management
app.use("/api/grade-scales", gradeScaleRoutes); // Grade Scale Management
app.use("/api/certificates", certificateRoutes); // Certificate management

// ==================== TEACHER MODULE ROUTES ====================
app.use("/api/teacher/dashboard", teacherDashboardRoutes); // Teacher dashboard
app.use("/api/teacher/assignments", assignmentRoutes); // Assignment management
app.use("/api/teacher/materials", studyMaterialRoutes); // Study materials
app.use("/api/teacher/analytics", performanceAnalyticsRoutes); // Performance analytics
app.use("/api/teacher/announcements", communicationRoutes); // Announcements & messaging
app.use("/api/teacher/schedule", classScheduleRoutes); // Class schedules
app.use("/api/teacher/lessons", teacherLessonRoutes); // Lesson plans
app.use("/api/teacher/classes", myClassesRoutes); // My Classes management

// ==================== TIMETABLE MODULE ROUTES ====================
app.use("/api/timetable", timetableRoutes); // Timetable management & scheduling
app.use("/api/timeslots", timeSlotRoutes); // Time slot configuration

// ==================== DIAGNOSTIC ROUTES ====================
app.use("/api/diagnose", diagnoseRoutes); // Troubleshooting & diagnostics

// ==================== DASHBOARD ROUTES ====================
app.use("/api/dashboard", dashboardRoutes); // Admin dashboard analytics
app.use("/api/activities", activityRoutes); // Activity tracking & recent logs

// ==================== SETTINGS MODULE ROUTES ====================
app.use("/api/settings", settingsRoutesNew); // UPDATED SETTINGS ROUTES WITH REAL IMPLEMENTATION
app.use("/api/admin/users", userManagementRoutes); // USER MANAGEMENT ROUTES

// ==================== OTHER ROUTES ====================
app.use('/api/history', historyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/progress-reports', progressReportRoutes);

// ==================== NEW ROLE PORTAL ROUTES ====================
app.use("/api/principal", principalRoutes); // Principal read-only overview
app.use("/api/cashier", cashierRoutes);     // Cashier fee collection
app.use("/api/cashier", cashierStatementRoutes); // Cashier transaction history & statement (all routes prefixed with /statement)
app.use("/api/cashier/follow-ups", feeFollowUpRoutes); // Fee follow-up & bulk emails
app.use("/api/driver", driverRoutes);       // Driver trip management
app.use("/api/parent", parentRoutes);       // Parent portal

/* =========================
   HEALTH ROUTES
========================= */
app.get("/", (req, res) => {
  res.json({
    message: "Smart School Management System API",
    version: "1.0.0",
    modules: {
      auth: "active",
      admin: "active",
      finance: "active",
      transport: "active",
      settings: "active", // ADDED SETTINGS MODULE
      reports: "active",
      academics: "active"
    },
    socket: io.engine.clientsCount > 0 ? "connected" : "idle",
    documentation: "Check /api-docs for endpoint details"
  });
});

app.get("/health", (req, res) => {
  const healthCheck = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: "connected",
    socket: {
      connections: io.engine.clientsCount,
      status: "active"
    }
  };

  res.status(200).json(healthCheck);
});

// API Documentation endpoint
app.get("/api-docs", (req, res) => {
  res.json({
    message: "API Documentation",
    endpoints: {
      auth: {
        login: "POST /api/auth/login",
        register: "POST /api/auth/register",
        profile: "GET /api/auth/profile"
      },
      settings: { // ADDED SETTINGS DOCUMENTATION
        getAll: "GET /api/settings",
        getByCategory: "GET /api/settings/:category",
        updateSchool: "PUT /api/settings/school",
        updateAcademic: "PUT /api/settings/academic",
        updateNotifications: "PUT /api/settings/notifications",
        updateSecurity: "PUT /api/settings/security",
        updateBilling: "PUT /api/settings/billing",
        updateAdvanced: "PUT /api/settings/advanced",
        createBackup: "POST /api/settings/backup",
        exportData: "POST /api/settings/export",
        getHealth: "GET /api/settings/health"
      },
      transport: {
        vehicles: {
          getAll: "GET /api/transport/vehicles",
          getOne: "GET /api/transport/vehicles/:id",
          create: "POST /api/transport/vehicles",
          update: "PUT /api/transport/vehicles/:id",
          delete: "DELETE /api/transport/vehicles/:id",
          stats: "GET /api/transport/vehicles-stats"
        },
        drivers: {
          getAll: "GET /api/transport/drivers",
          create: "POST /api/transport/drivers",
          update: "PUT /api/transport/drivers/:id",
          stats: "GET /api/transport/drivers-stats"
        },
        routes: {
          getAll: "GET /api/transport/routes",
          create: "POST /api/transport/routes",
          stats: "GET /api/transport/routes-stats"
        },
        maintenance: {
          getAll: "GET /api/transport/maintenance",
          create: "POST /api/transport/maintenance",
          update: "PATCH /api/transport/maintenance/:id/status",
          stats: "GET /api/transport/maintenance-stats"
        },
        fuel: {
          getAll: "GET /api/transport/fuel-logs",
          create: "POST /api/transport/fuel-logs",
          stats: "GET /api/transport/fuel-stats"
        },
        dashboard: "GET /api/transport/dashboard-stats",
        reports: "POST /api/transport/reports/generate"
      },
      finance: {
        payments: "GET /api/finance",
        collections: "GET /api/finance/collections",
        feeDefaulters: "GET /api/finance/fee-defaulters"
      }
    }
  });
});

/* =========================
   GLOBAL ERROR HANDLER (PRODUCTION GRADE)
========================= */
app.use(errorHandler);

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

// Initialize database and start server
const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ Database connected");
    
    // Start the shift auto-close scheduler
    startShiftAutoCloseScheduler();
    
    server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║  🚀 SMART SCHOOL MANAGEMENT SYSTEM                                      ║
║                                                                          ║
║  🌐 Server: http://localhost:${PORT}                                    ║
║  📅 Started: ${new Date().toLocaleString()}                             ║
║  📊 Environment: ${process.env.NODE_ENV || "development"}               ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  📡 ACTIVE MODULES:                                                     ║
║                                                                          ║
║  🔑  Auth:        http://localhost:${PORT}/api/auth                    ║
║  👨‍💼  Admin:       http://localhost:${PORT}/api/admin                  ║
║  💰  Finance:     http://localhost:${PORT}/api/finance                 ║
║  🚌  Transport:   http://localhost:${PORT}/api/transport               ║
║  ⚙️   Settings:    http://localhost:${PORT}/api/settings               ║
║  📊  Reports:     http://localhost:${PORT}/api/reports                 ║
║  📚  Academics:   http://localhost:${PORT}/api/admin/students          ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  ⚙️  SETTINGS MODULE ENDPOINTS:                                         ║
║                                                                          ║
║  • School Profile:    PUT /api/settings/school                          ║
║  • Academic:         PUT /api/settings/academic                        ║
║  • Notifications:    PUT /api/settings/notifications                   ║
║  • Security:         PUT /api/settings/security                        ║
║  • Billing:          PUT /api/settings/billing                         ║
║  • Advanced:         PUT /api/settings/advanced                        ║
║  • System Health:    GET /api/settings/health                          ║
║  • Backup:           POST /api/settings/backup                         ║
║  • Export:           POST /api/settings/export                         ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  🚌 TRANSPORT MODULE ENDPOINTS:                                         ║
║                                                                          ║
║  • Vehicles:       http://localhost:${PORT}/api/transport/vehicles      ║
║  • Drivers:        http://localhost:${PORT}/api/transport/drivers       ║
║  • Routes:         http://localhost:${PORT}/api/transport/routes        ║
║  • Maintenance:    http://localhost:${PORT}/api/transport/maintenance   ║
║  • Dashboard:      http://localhost:${PORT}/api/transport/dashboard-stats║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  📡 REAL-TIME FEATURES:                                                 ║
║                                                                          ║
║  • Socket.IO:      Vehicle & Settings tracking enabled                 ║
║  • Live Updates:   Location, fuel, maintenance, settings alerts        ║
║  • Health Check:   http://localhost:${PORT}/health                      ║
║  • API Docs:       http://localhost:${PORT}/api-docs                    ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
  `);
    });
    
  } catch (error) {
    console.error("❌ Startup failed:", error);
    process.exit(1);
  }
};

startServer();

// ==================== GLOBAL ERROR HANDLERS ====================
// CRITICAL: Prevent unhandled rejections from crashing the server
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit - log and continue
});

// CRITICAL: Prevent uncaught exceptions from crashing the server
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error.message);
  console.error(error.stack);
  // Gracefully shutdown and restart
  server.close(() => {
    process.exit(1);
  });
  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error("❌ Forced shutdown after timeout");
    process.exit(1);
  }, 5000);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down...");
  server.close(() => {
    process.exit(0);
  });
});

export { app, server, io };
