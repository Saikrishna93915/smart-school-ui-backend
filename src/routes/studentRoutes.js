import express from "express";
import {
  createStudent,
  createBulkStudents, // <--- NEW: Import the new bulk controller function
  getStudents,
  getStudentById,
  updateStudent,
  updateStudentStatus,
  softDeleteStudent,
  getByAdmissionNumber
} from "../controllers/studentController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { authorize } from "../middlewares/roleMiddleware.js";
import { requireClassTeacherAccess } from "../middlewares/classTeacherAccess.js";

const router = express.Router();

// Apply authentication for all student routes
router.use(protect);

// Primary CRUD Routes
router.get("/", authorize("admin", "owner", "teacher"), requireClassTeacherAccess(), getStudents);
router.post("/", authorize("admin", "owner"), createStudent); // Handles single student insert

// Bulk Insert Route (MUST use this endpoint for the array of students)
router.post("/bulk", authorize("admin", "owner"), createBulkStudents); // <--- NEW BULK ROUTE

// Specific Query and ID Routes
router.get("/by-admission/:admissionNumber", authorize("admin", "owner", "teacher"), requireClassTeacherAccess(), getByAdmissionNumber);

router.get("/:id", authorize("admin", "owner", "teacher"), requireClassTeacherAccess(), getStudentById);
router.put("/:id", authorize("admin", "owner"), updateStudent);
router.put("/:id/status", authorize("admin", "owner"), updateStudentStatus);
router.delete("/:id", authorize("admin", "owner"), softDeleteStudent);

export default router;