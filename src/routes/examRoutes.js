import express from "express";
import {
  createExam,
  getExams,
  getExamById,
  updateExam,
  deleteExam,
  updateExamStatus,
  submitExam,
  evaluateExam,
  getMyExams,
  getSubmissions,
  getMySubmissions,
  getSubmissionById,
  getExamAnalytics,
  getClassPerformance,
  publishResults,
  getAnalyticsOverview,
  saveExamProgress,
  logProctoringViolation,
  getProctoringLogs,
  exportExamAnalytics,
  getMyResults,
  getExamResults
} from "../controllers/examController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// create exam
router.post("/", protect, createExam);

// admin / teacher list exams
router.get("/", protect, getExams);

// ⭐ student get only their exams
router.get("/my-exams", protect, getMyExams);

// analytics overview for exam dashboard
router.get("/analytics/overview", protect, getAnalyticsOverview);

// student submissions
router.get("/my-submissions", protect, getMySubmissions);
router.get("/submissions/:submissionId", protect, getSubmissionById);
router.post("/save-progress", protect, saveExamProgress);
router.post("/proctoring/log", protect, logProctoringViolation);
router.get("/:examId/proctoring-logs", protect, getProctoringLogs);

// exam/class analytics
router.get("/:examId/analytics", protect, getExamAnalytics);
router.get("/:examId/analytics/export", protect, exportExamAnalytics);
router.get("/:examId/my-results", protect, getMyResults);
router.get("/:examId/results", protect, getExamResults);
router.get("/performance/:className/:section", protect, getClassPerformance);
router.post("/:examId/publish-results", protect, publishResults);

// update / delete exam
router.put("/:id", protect, updateExam);
router.patch("/:id/status", protect, updateExamStatus);
router.delete("/:id", protect, deleteExam);

// get single exam
router.get("/:id", protect, getExamById);

// student submit exam
router.post("/:examId/submit", protect, submitExam);

// teacher get submissions for an exam
router.get("/:examId/submissions", protect, getSubmissions);

// teacher evaluate exam
router.post("/:examId/evaluate", protect, evaluateExam);

export default router;
