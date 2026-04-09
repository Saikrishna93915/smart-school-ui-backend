import express from "express";
import { diagnoseSyllabusIssues, diagnoseCurrentStudent, listAllStudents } from "../controllers/diagnosticsController.js";
import { fixStudentLink, fixAllStudentLinks } from "../controllers/fixController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { authorize } from "../middlewares/roleMiddleware.js";

const router = express.Router();

/**
 * DIAGNOSTIC ROUTES - View database state
 */

/**
 * GET /api/diagnose/syllabus
 * Full diagnostic report (admin only)
 */
router.get("/syllabus", protect, authorize("admin", "owner"), diagnoseSyllabusIssues);

/**
 * GET /api/diagnose/student/me
 * Current student diagnostic info
 */
router.get("/student/me", protect, authorize("student"), diagnoseCurrentStudent);

/**
 * GET /api/diagnose/students/list
 * List all students and their user account status (admin only)
 */
router.get("/students/list", protect, authorize("admin", "owner"), listAllStudents);

/**
 * FIX ROUTES - Repair database links
 */

/**
 * POST /api/diagnose/fix-student-link/:admissionNumber
 * Link a specific student user to their student record
 */
router.post("/fix-student-link/:admissionNumber", protect, authorize("admin", "owner"), fixStudentLink);

/**
 * POST /api/diagnose/fix-all-links
 * Auto-fix ALL student users that are not linked (admin only)
 */
router.post("/fix-all-links", protect, authorize("admin", "owner"), fixAllStudentLinks);

export default router;
