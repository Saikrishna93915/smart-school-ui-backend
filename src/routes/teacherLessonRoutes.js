import express from 'express';
import {
  createLesson,
  getLessonsByClass,
  getLessonById,
  updateLesson,
  deleteLesson,
  startLesson,
  completeLesson,
  addLessonFeedback,
  getLessonsByChapter,
  getUpcomingLessons,
  getLessonStats,
  linkAssignmentToLesson,
  linkMaterialToLesson
} from '../controllers/teacherLessonController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/teacher/lessons
 * @desc    Create a lesson plan
 * @access  Private (Teacher)
 */
router.post('/', createLesson);

/**
 * @route   GET /api/teacher/lessons/:classId
 * @desc    Get all lessons for a class
 * @access  Private (Teacher)
 * @query   sectionId - Filter by section
 * @query   chapterName - Filter by chapter
 * @query   status - Filter by status (planned, in-progress, completed)
 */
router.get('/:classId', getLessonsByClass);

/**
 * @route   GET /api/teacher/lessons-stats/:classId
 * @desc    Get lesson statistics for a class
 * @access  Private (Teacher)
 */
router.get('/:classId/stats', getLessonStats);

/**
 * @route   GET /api/teacher/lessons/upcoming/:classId
 * @desc    Get upcoming lessons
 * @access  Private (Teacher)
 * @query   days - Number of days to look ahead (default: 30)
 */
router.get('/:classId/upcoming', getUpcomingLessons);

/**
 * @route   GET /api/teacher/lessons/chapter/:classId/:chapterName
 * @desc    Get lessons by chapter
 * @access  Private (Teacher)
 */
router.get('/:classId/chapter/:chapterName', getLessonsByChapter);

/**
 * @route   GET /api/teacher/lessons/:id
 * @desc    Get a specific lesson
 * @access  Private (Teacher)
 */
router.get('/:id', getLessonById);

/**
 * @route   PUT /api/teacher/lessons/:id
 * @desc    Update a lesson plan
 * @access  Private (Teacher)
 */
router.put('/:id', updateLesson);

/**
 * @route   PUT /api/teacher/lessons/:id/start
 * @desc    Mark lesson as in-progress
 * @access  Private (Teacher)
 */
router.put('/:id/start', startLesson);

/**
 * @route   PUT /api/teacher/lessons/:id/complete
 * @desc    Mark lesson as completed
 * @access  Private (Teacher)
 */
router.put('/:id/complete', completeLesson);

/**
 * @route   PUT /api/teacher/lessons/:id/feedback
 * @desc    Add feedback to lesson
 * @access  Private
 */
router.put('/:id/feedback', addLessonFeedback);

/**
 * @route   PUT /api/teacher/lessons/:id/link-assignment/:assignmentId
 * @desc    Link assignment to lesson
 * @access  Private (Teacher)
 */
router.put('/:id/link-assignment/:assignmentId', linkAssignmentToLesson);

/**
 * @route   PUT /api/teacher/lessons/:id/link-material/:materialId
 * @desc    Link material to lesson
 * @access  Private (Teacher)
 */
router.put('/:id/link-material/:materialId', linkMaterialToLesson);

/**
 * @route   DELETE /api/teacher/lessons/:id
 * @desc    Delete a lesson
 * @access  Private (Teacher)
 */
router.delete('/:id', deleteLesson);

export default router;
