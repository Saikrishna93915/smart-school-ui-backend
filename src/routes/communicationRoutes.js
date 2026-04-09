import express from 'express';
import {
  createAnnouncement,
  getAnnouncementsByClass,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  addCommentToAnnouncement,
  toggleAnnouncementLike,
  getAnnouncementStats,
  getAnnouncementEngagement
} from '../controllers/communicationController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/teacher/announcements
 * @desc    Create an announcement
 * @access  Private (Teacher)
 */
router.post('/', createAnnouncement);

/**
 * @route   GET /api/teacher/announcements/:classId
 * @desc    Get all announcements for a class
 * @access  Private (Teacher)
 * @query   type - Filter by announcement type (general, academic, event, exam, assignment, emergency)
 * @query   priority - Filter by priority (normal, high, urgent)
 * @query   includeScheduled - Include scheduled announcements (true/false)
 */
router.get('/:classId', getAnnouncementsByClass);

/**
 * @route   GET /api/teacher/announcements-stats/:classId
 * @desc    Get announcements statistics
 * @access  Private (Teacher)
 */
router.get('/:classId/stats', getAnnouncementStats);

/**
 * @route   GET /api/teacher/announcements/:classId/:announcementId
 * @desc    Get a specific announcement (increments views)
 * @access  Private
 */
router.get('/:classId/:announcementId', getAnnouncementById);

/**
 * @route   GET /api/teacher/announcements/:id/engagement
 * @desc    Get engagement report for an announcement
 * @access  Private (Teacher)
 */
router.get('/:id/engagement', getAnnouncementEngagement);

/**
 * @route   PUT /api/teacher/announcements/:id
 * @desc    Update an announcement
 * @access  Private (Teacher)
 */
router.put('/:id', updateAnnouncement);

/**
 * @route   PUT /api/teacher/announcements/:id/publish
 * @desc    Publish a scheduled announcement
 * @access  Private (Teacher)
 */
router.put('/:id/publish', publishAnnouncement);

/**
 * @route   PUT /api/teacher/announcements/:id/archive
 * @desc    Archive an announcement
 * @access  Private (Teacher)
 */
router.put('/:id/archive', archiveAnnouncement);

/**
 * @route   PUT /api/teacher/announcements/:id/comment
 * @desc    Add comment to announcement
 * @access  Private
 */
router.put('/:id/comment', addCommentToAnnouncement);

/**
 * @route   PUT /api/teacher/announcements/:id/like
 * @desc    Like/Unlike an announcement
 * @access  Private
 */
router.put('/:id/like', toggleAnnouncementLike);

/**
 * @route   DELETE /api/teacher/announcements/:id
 * @desc    Delete an announcement
 * @access  Private (Teacher)
 */
router.delete('/:id', deleteAnnouncement);

export default router;
