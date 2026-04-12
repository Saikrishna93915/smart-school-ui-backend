import express from 'express';
import {
  createExamCycle,
  getExamCycles,
  upsertStudentMarks,
  verifyMarksForClass,
  saveClassTeacherRemark,
  publishExamResults,
  getStudentProgressReport,
  getClassExamSummary
} from '../controllers/progressReportController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { requireClassTeacherAccess } from '../middlewares/classTeacherAccess.js';

const router = express.Router();

router.use(protect);

router.post('/exam-cycles', authorize('admin', 'owner'), createExamCycle);
router.get('/exam-cycles', authorize('admin', 'owner', 'teacher'), getExamCycles);

router.post('/marks/upsert', authorize('admin', 'owner', 'teacher'), requireClassTeacherAccess(), upsertStudentMarks);
router.post('/marks/verify', authorize('admin', 'owner', 'teacher'), requireClassTeacherAccess(), verifyMarksForClass);
router.post('/class-teacher/remarks', authorize('admin', 'owner', 'teacher'), requireClassTeacherAccess(), saveClassTeacherRemark);

router.post('/exam-cycles/:examCycleId/publish', authorize('admin', 'owner'), publishExamResults);

router.get('/students/:studentId/report', authorize('admin', 'owner', 'teacher', 'student', 'parent'), getStudentProgressReport);
router.get('/class-summary', authorize('admin', 'owner', 'teacher'), getClassExamSummary);

export default router;
