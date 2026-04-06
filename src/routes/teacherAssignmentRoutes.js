import express from "express";
import {
  createTeacherAssignment,
  getAllTeacherAssignments,
  getMyAssignments,
  getAssignmentsByTeacher,
  getAssignmentsByClass,
  updateTeacherAssignment,
  deleteTeacherAssignment,
  bulkAssignTeacher
} from "../controllers/teacherAssignmentController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { authorize } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * GET /api/teacher-assignments/my
 * Get assignments for logged-in teacher
 * Access: Teacher only
 */
router.get("/my", authorize("teacher"), getMyAssignments);

/**
 * GET /api/teacher-assignments
 * Get all teacher assignments with filters
 * Access: Admin only
 */
router.get("/", authorize("admin", "owner"), getAllTeacherAssignments);

/**
 * POST /api/teacher-assignments
 * Create a new teacher assignment
 * Access: Admin only
 */
router.post("/", authorize("admin", "owner"), createTeacherAssignment);

/**
 * POST /api/teacher-assignments/bulk
 * Bulk assign subjects to a teacher
 * Access: Admin only
 */
router.post("/bulk", authorize("admin", "owner"), bulkAssignTeacher);

/**
 * GET /api/teacher-assignments/teacher/:teacherId
 * Get all assignments for a specific teacher
 * Access: Admin
 */
router.get("/teacher/:teacherId", authorize("admin", "owner"), getAssignmentsByTeacher);

/**
 * GET /api/teacher-assignments/class/:className/section/:section
 * Get all teachers assigned to a class-section
 * Access: Admin, Teacher, Student (for viewing their teachers)
 */
router.get(
  "/class/:className/section/:section", 
  authorize("admin", "owner", "teacher", "student"), 
  getAssignmentsByClass
);

/**
 * PUT /api/teacher-assignments/:id
 * Update a teacher assignment
 * Access: Admin only
 */
router.put("/:id", authorize("admin", "owner"), updateTeacherAssignment);

/**
 * DELETE /api/teacher-assignments/:id
 * Delete/deactivate a teacher assignment
 * Access: Admin only
 */
router.delete("/:id", authorize("admin", "owner"), deleteTeacherAssignment);

export default router;
