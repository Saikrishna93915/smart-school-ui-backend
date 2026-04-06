import express from 'express';
import {
  getTimetable,
  createTimetable,
  updateTimetable,
  upsertSlot,
  deleteSlot,
  publishTimetable,
  getTeacherTimetable,
  getConflicts,
  cloneTimetable,
  getAllTimetables,
  getAllClasses,
  checkSlotConflicts
} from '../controllers/timetableController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/timetable/check-conflicts
 * @desc    Check for scheduling conflicts before assigning a slot
 * @access  Private
 */
router.post('/check-conflicts', checkSlotConflicts);

/**
 * @route   GET /api/timetable
 * @desc    Get all timetables (with filters)
 * @access  Private
 */
router.get('/', getAllTimetables);

/**
 * @route   GET /api/timetable/classes
 * @desc    Get all classes
 * @access  Private
 */
router.get('/classes', getAllClasses);

/**
 * @route   GET /api/timetable/conflicts
 * @desc    Get all conflicts
 * @access  Private (Admin)
 */
router.get('/conflicts', getConflicts);

/**
 * @route   GET /api/timetable/teacher/:teacherId
 * @desc    Get teacher's timetable
 * @access  Private
 */
router.get('/teacher/:teacherId', getTeacherTimetable);

/**
 * @route   GET /api/timetable/:classId/:sectionId
 * @desc    Get timetable for specific class/section
 * @access  Private
 */
router.get('/:classId/:sectionId', getTimetable);

/**
 * @route   POST /api/timetable
 * @desc    Create new timetable
 * @access  Private (Admin)
 */
router.post('/', createTimetable);

/**
 * @route   PUT /api/timetable/:id
 * @desc    Update timetable metadata
 * @access  Private (Admin)
 */
router.put('/:id', updateTimetable);

/**
 * @route   POST /api/timetable/:timetableId/slots
 * @desc    Create or update timetable slot
 * @access  Private (Admin)
 */
router.post('/:timetableId/slots', upsertSlot);

/**
 * @route   DELETE /api/timetable/slots/:slotId
 * @desc    Delete timetable slot
 * @access  Private (Admin)
 */
router.delete('/slots/:slotId', deleteSlot);

/**
 * @route   POST /api/timetable/:id/publish
 * @desc    Publish timetable
 * @access  Private (Admin)
 */
router.post('/:id/publish', publishTimetable);

/**
 * @route   POST /api/timetable/:id/clone
 * @desc    Clone timetable to another class/section
 * @access  Private (Admin)
 */
router.post('/:id/clone', cloneTimetable);

export default router;
