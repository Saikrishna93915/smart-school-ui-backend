// routes/principalRoutes.js - Principal Portal Routes
import express from "express";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import {
  getDashboardStats,
  getPrincipalProfile,
  getStudentsSummary,
  getTeachersSummary,
  getAttendanceOverview,
  getExamResults,
  getTransportOverview,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  pinAnnouncement,
  archiveAnnouncement,
  getReportTypes,
  generateReport,
  exportReportCSV,
  exportReportJSON,
  // New modules
  assignClassTeacher,
  transferClassTeacher,
  getClassTeacherByClass,
  getClassTimetable,
  saveTimetable,
  getTeacherPermissions,
  getPermissionStats,
  getTeacherPermissionById,
  updateTeacherPermissions,
  createPermissionTemplate,
  getPermissionTemplates,
  applyPermissionTemplate,
  bulkUpdatePermissions,
  getPermissionAuditLogs,
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  archiveClass,
  restoreClass,
  getClassTeacherHistory,
  getClassStatistics,
  getClassCapacityReport,
  cleanupDuplicateClasses,
  getLeaveRequests,
  updateLeaveRequest,
} from "../controllers/principalController.js";

const router = express.Router();

// All routes require authentication + principal/admin/owner role
router.use(protect);
router.use(authorize("principal", "admin", "owner"));

router.get("/dashboard", getDashboardStats);
router.get("/profile", getPrincipalProfile);
router.get("/students", getStudentsSummary);
router.get("/teachers", getTeachersSummary);
router.get("/attendance", getAttendanceOverview);
router.get("/exams", getExamResults);
router.get("/transport", getTransportOverview);
router.get("/announcements", getAnnouncements);

// Announcement CRUD
router.post("/announcements", createAnnouncement);
router.put("/announcements/:id/pin", pinAnnouncement);
router.put("/announcements/:id/archive", archiveAnnouncement);
router.put("/announcements/:id", updateAnnouncement);
router.delete("/announcements/:id", deleteAnnouncement);

// Class Teacher Management
router.post("/class-teacher/assign", assignClassTeacher);
router.put("/class-teacher/transfer/:classId", transferClassTeacher);
router.get("/class-teacher/class/:classId", getClassTeacherByClass);

// Timetable Management
router.get("/timetable", getClassTimetable);
router.post("/timetable", saveTimetable);

// Teacher Permissions - IMPORTANT: Specific routes MUST come before :teacherId route
router.get("/teacher-permissions/stats", getPermissionStats);

// Permission Templates - Define BEFORE :teacherId route
router.get("/teacher-permissions/templates", getPermissionTemplates);
router.post("/teacher-permissions/templates", createPermissionTemplate);
router.post("/teacher-permissions/templates/apply", applyPermissionTemplate);

// Bulk Permissions - Define BEFORE :teacherId route
router.post("/teacher-permissions/bulk", bulkUpdatePermissions);

// Permission Audit Logs - Define BEFORE :teacherId route
router.get("/teacher-permissions/audit-logs", getPermissionAuditLogs);

// Generic permission routes - MUST come LAST
router.get("/teacher-permissions", getTeacherPermissions);
router.get("/teacher-permissions/:teacherId", getTeacherPermissionById);
router.put("/teacher-permissions/:teacherId", updateTeacherPermissions);

// Class Management
router.get("/classes/stats", getClassStatistics);
router.get("/classes/capacity-report", getClassCapacityReport);
router.post("/classes/cleanup-duplicates", cleanupDuplicateClasses);
router.get("/classes", getClasses);
router.get("/classes/:id/history", getClassTeacherHistory);
router.post("/classes", createClass);
router.put("/classes/:id", updateClass);
router.patch("/classes/:id/archive", archiveClass);
router.patch("/classes/:id/restore", restoreClass);
router.delete("/classes/:id", deleteClass);

// Leave Approval
router.get("/leave-requests", getLeaveRequests);
router.put("/leave-requests/:id", updateLeaveRequest);

// Reports
router.get("/reports/types", getReportTypes);
router.post("/reports/generate", generateReport);
router.post("/reports/export/csv", exportReportCSV);
router.post("/reports/export/json", exportReportJSON);

export default router;
