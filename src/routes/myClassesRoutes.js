import express from 'express';
import {
  getMyClasses,
  getClassDetails,
  getClassSections,
  getSectionStudents,
  getClassPerformanceSummary,
  getClassAssignmentSummary,
  getClassScheduleSummary,
  getClassesOverview
} from '../controllers/myClassesController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/teacher/classes
 * @desc    Get all classes assigned to teacher
 * @access  Private (Teacher)
 */
router.get('/', getMyClasses);

/**
 * @route   GET /api/teacher/classes/overview
 * @desc    Get quick overview of all classes with statistics
 * @access  Private (Teacher)
 */
router.get('/overview', getClassesOverview);

/**
 * @route   GET /api/teacher/classes/:classId
 * @desc    Get detailed information for a class
 * @access  Private (Teacher)
 */
router.get('/:classId', getClassDetails);

/**
 * @route   GET /api/teacher/classes/:classId/sections
 * @desc    Get all sections in a class
 * @access  Private (Teacher)
 */
router.get('/:classId/sections', getClassSections);

/**
 * @route   GET /api/teacher/classes/:classId/sections/:sectionId/students
 * @desc    Get students in a section
 * @access  Private (Teacher)
 */
router.get('/:classId/sections/:sectionId/students', getSectionStudents);

/**
 * @route   GET /api/teacher/classes/:classId/performance-summary
 * @desc    Get class performance summary
 * @access  Private (Teacher)
 * @query   subjectId - Optional filter by subject
 */
router.get('/:classId/performance-summary', getClassPerformanceSummary);

/**
 * @route   GET /api/teacher/classes/:classId/assignments-summary
 * @desc    Get class assignment statistics
 * @access  Private (Teacher)
 */
router.get('/:classId/assignments-summary', getClassAssignmentSummary);

/**
 * @route   GET /api/teacher/classes/:classId/schedule-summary
 * @desc    Get class schedule summary
 * @access  Private (Teacher)
 */
router.get('/:classId/schedule-summary', getClassScheduleSummary);

export default router;
