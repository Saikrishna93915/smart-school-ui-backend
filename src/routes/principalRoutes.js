// routes/principalRoutes.js - Principal Portal Routes
import express from "express";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import {
  getDashboardStats,
  getStudentsSummary,
  getTeachersSummary,
  getAttendanceOverview,
  getFinanceOverview,
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
} from "../controllers/principalController.js";

const router = express.Router();

// All routes require authentication + principal/admin/owner role
router.use(protect);
router.use(authorize("principal", "admin", "owner"));

router.get("/dashboard", getDashboardStats);
router.get("/students", getStudentsSummary);
router.get("/teachers", getTeachersSummary);
router.get("/attendance", getAttendanceOverview);
router.get("/finance", getFinanceOverview);
router.get("/exams", getExamResults);
router.get("/transport", getTransportOverview);
router.get("/announcements", getAnnouncements);

// Announcement CRUD
router.post("/announcements", createAnnouncement);
router.put("/announcements/:id", updateAnnouncement);
router.delete("/announcements/:id", deleteAnnouncement);
router.put("/announcements/:id/pin", pinAnnouncement);
router.put("/announcements/:id/archive", archiveAnnouncement);

// Reports
router.get("/reports/types", getReportTypes);
router.post("/reports/generate", generateReport);
router.post("/reports/export/csv", exportReportCSV);
router.post("/reports/export/json", exportReportJSON);

export default router;
