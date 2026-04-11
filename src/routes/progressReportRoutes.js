import express from 'express';
import {
  createExamCycle,
  updateExamCycle,
  getExamCycles,
  upsertStudentMarks,
  verifyMarksForClass,
  saveClassTeacherRemark,
  publishExamResults,
  getStudentProgressReport,
  getClassExamSummary
} from '../controllers/progressReportController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/exam-cycles', authorize('admin', 'owner'), createExamCycle);
router.put('/exam-cycles/:examCycleId', authorize('admin', 'owner'), updateExamCycle);
router.get('/exam-cycles', authorize('admin', 'owner', 'teacher'), getExamCycles);

router.post('/marks/upsert', authorize('admin', 'owner', 'teacher'), upsertStudentMarks);
router.post('/marks/verify', authorize('admin', 'owner', 'teacher'), verifyMarksForClass);
router.post('/class-teacher/remarks', authorize('admin', 'owner', 'teacher'), saveClassTeacherRemark);

router.post('/exam-cycles/:examCycleId/publish', authorize('admin', 'owner'), publishExamResults);

router.get('/students/:studentId/report', authorize('admin', 'owner', 'teacher', 'student', 'parent'), getStudentProgressReport);
router.get('/class-summary', authorize('admin', 'owner', 'teacher'), getClassExamSummary);

export default router;
