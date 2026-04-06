import express from "express";
import {
  createSubject,
  getAllSubjects,
  getSubjectsByClass,
  getSubjectById,
  updateSubject,
  deleteSubject,
  bulkCreateSubjects,
  getClassesWithSubjects
} from "../controllers/subjectController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { authorize } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * GET /api/subjects/classes/list
 * Get all unique classes that have subjects
 * Access: All authenticated users
 */
router.get("/classes/list", getClassesWithSubjects);

/**
 * GET /api/subjects
 * Get all subjects with filters
 * Access: All authenticated users
 */
router.get("/", getAllSubjects);

/**
 * POST /api/subjects
 * Create a new subject
 * Access: Admin only
 */
router.post("/", authorize("admin", "owner"), createSubject);

/**
 * POST /api/subjects/bulk
 * Bulk create subjects for a class
 * Access: Admin only
 */
router.post("/bulk", authorize("admin", "owner"), bulkCreateSubjects);

/**
 * GET /api/subjects/class/:className
 * Get all subjects for a specific class
 * Access: All authenticated users
 */
router.get("/class/:className", getSubjectsByClass);

/**
 * GET /api/subjects/:id
 * Get subject by ID
 * Access: All authenticated users
 */
router.get("/:id", getSubjectById);

/**
 * PUT /api/subjects/:id
 * Update a subject
 * Access: Admin only
 */
router.put("/:id", authorize("admin", "owner"), updateSubject);

/**
 * DELETE /api/subjects/:id
 * Delete/deactivate a subject
 * Access: Admin only
 */
router.delete("/:id", authorize("admin", "owner"), deleteSubject);

export default router;
