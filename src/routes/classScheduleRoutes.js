import express from 'express';
import {
  createSchedule,
  getSchedulesByClass,
  getTodaySchedule,
  getWeeklySchedule,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  checkScheduleConflicts,
  getScheduleSummary
} from '../controllers/classScheduleController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/teacher/schedule
 * @desc    Create a class schedule entry
 * @access  Private (Teacher)
 */
router.post('/', createSchedule);

/**
 * @route   GET /api/teacher/schedule/today
 * @desc    Get today's schedule for the teacher
 * @access  Private (Teacher)
 */
router.get('/today', getTodaySchedule);

/**
 * @route   GET /api/teacher/schedule/weekly
 * @desc    Get weekly schedule for the teacher
 * @access  Private (Teacher)
 */
router.get('/weekly', getWeeklySchedule);

/**
 * @route   GET /api/teacher/schedule/:classId
 * @desc    Get all schedules for a class
 * @access  Private (Teacher)
 * @query   sectionId - Filter by section
 * @query   academicYear - Filter by academic year
 * @query   semester - Filter by semester
 */
router.get('/:classId', getSchedulesByClass);

/**
 * @route   GET /api/teacher/schedule-summary/:classId
 * @desc    Get schedule summary for a class
 * @access  Private (Teacher)
 */
router.get('/:classId/summary', getScheduleSummary);

/**
 * @route   GET /api/teacher/schedule/conflicts/:classId/:sectionId
 * @desc    Check for schedule conflicts
 * @access  Private (Teacher)
 * @query   dayOfWeek - Day of week (0-6)
 * @query   startTime - Start time (HH:mm)
 * @query   endTime - End time (HH:mm)
 */
router.get('/:classId/:sectionId/conflicts', checkScheduleConflicts);

/**
 * @route   GET /api/teacher/schedule/:id
 * @desc    Get a specific schedule entry
 * @access  Private (Teacher)
 */
router.get('/:id', getScheduleById);

/**
 * @route   PUT /api/teacher/schedule/:id
 * @desc    Update a schedule entry
 * @access  Private (Teacher)
 */
router.put('/:id', updateSchedule);

/**
 * @route   DELETE /api/teacher/schedule/:id
 * @desc    Delete a schedule entry
 * @access  Private (Teacher)
 */
router.delete('/:id', deleteSchedule);

export default router;
