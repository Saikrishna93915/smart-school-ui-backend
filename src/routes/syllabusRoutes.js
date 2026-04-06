import express from "express";
import {
  createSyllabus,
  getAllSyllabus,
  getSyllabusById,
  getStudentSyllabus,
  updateSyllabus,
  updateChapterStatus,
  addChapter,
  deleteChapter,
  deleteSyllabus,
  getSyllabusStats
} from "../controllers/syllabusController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { authorize } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * GET /api/syllabus/student/my
 * Get syllabus for logged-in student (their class)
 * Access: Student only
 */
router.get("/student/my", authorize("student"), getStudentSyllabus);

/**
 * GET /api/syllabus/stats/:className/:section
 * Get syllabus statistics for a class
 * Access: Admin, Teacher
 */
router.get(
  "/stats/:className/:section", 
  authorize("admin", "owner", "teacher"), 
  getSyllabusStats
);

/**
 * GET /api/syllabus
 * Get all syllabus with filters
 * Access: All authenticated users (role-based filtering applied in controller)
 */
router.get("/", getAllSyllabus);

/**
 * POST /api/syllabus
 * Create new syllabus
 * Access: Admin, Teacher (only for assigned classes)
 */
router.post("/", authorize("admin", "owner", "teacher"), createSyllabus);

/**
 * GET /api/syllabus/:id
 * Get syllabus by ID
 * Access: All authenticated users
 */
router.get("/:id", getSyllabusById);

/**
 * PUT /api/syllabus/:id
 * Update syllabus (chapters, metadata)
 * Access: Admin, Teacher (only for assigned classes)
 */
router.put("/:id", authorize("admin", "owner", "teacher"), updateSyllabus);

/**
 * DELETE /api/syllabus/:id
 * Delete syllabus
 * Access: Admin only
 */
router.delete("/:id", authorize("admin", "owner"), deleteSyllabus);

/**
 * POST /api/syllabus/:id/chapter
 * Add new chapter to syllabus
 * Access: Admin, Teacher (only for assigned classes)
 */
router.post("/:id/chapter", authorize("admin", "owner", "teacher"), addChapter);

/**
 * PUT /api/syllabus/:id/chapter/:chapterId
 * Update chapter status/details
 * Access: Admin, Teacher (only for assigned classes)
 */
router.put(
  "/:id/chapter/:chapterId", 
  authorize("admin", "owner", "teacher"), 
  updateChapterStatus
);

/**
 * DELETE /api/syllabus/:id/chapter/:chapterId
 * Delete a chapter from syllabus
 * Access: Admin, Teacher (only for assigned classes)
 */
router.delete(
  "/:id/chapter/:chapterId", 
  authorize("admin", "owner", "teacher"), 
  deleteChapter
);

export default router;
