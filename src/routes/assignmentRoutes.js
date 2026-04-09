import express from 'express';
import {
  createAssignment,
  getAssignmentsByClass,
  getAssignmentWithSubmissions,
  updateAssignment,
  publishAssignment,
  closeAssignment,
  deleteAssignment,
  gradeSubmission,
  getGradingSummary
} from '../controllers/assignmentController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/teacher/assignments
 * @desc    Create a new assignment
 * @access  Private (Teacher)
 */
router.post('/', createAssignment);

/**
 * @route   GET /api/teacher/assignments/:classId
 * @desc    Get all assignments for a class
 * @access  Private (Teacher)
 */
router.get('/:classId', getAssignmentsByClass);

/**
 * @route   GET /api/teacher/assignments/:id/submissions
 * @desc    Get assignment details with all submissions
 * @access  Private (Teacher)
 */
router.get('/:id/submissions', getAssignmentWithSubmissions);

/**
 * @route   GET /api/teacher/assignments/:id/grading-summary
 * @desc    Get grading summary (total submitted, graded, average score, grade distribution)
 * @access  Private (Teacher)
 */
router.get('/:id/grading-summary', getGradingSummary);

/**
 * @route   PUT /api/teacher/assignments/:id
 * @desc    Update an assignment
 * @access  Private (Teacher)
 */
router.put('/:id', updateAssignment);

/**
 * @route   PUT /api/teacher/assignments/:id/publish
 * @desc    Publish an assignment (make it visible to students)
 * @access  Private (Teacher)
 */
router.put('/:id/publish', publishAssignment);

/**
 * @route   PUT /api/teacher/assignments/:id/close
 * @desc    Close an assignment (stop accepting submissions)
 * @access  Private (Teacher)
 */
router.put('/:id/close', closeAssignment);

/**
 * @route   PUT /api/teacher/assignments/:assignmentId/submissions/:submissionId/grade
 * @desc    Grade a student submission
 * @access  Private (Teacher)
 */
router.put('/:assignmentId/submissions/:submissionId/grade', gradeSubmission);

/**
 * @route   DELETE /api/teacher/assignments/:id
 * @desc    Delete an assignment (only draft assignments)
 * @access  Private (Teacher)
 */
router.delete('/:id', deleteAssignment);

export default router;
