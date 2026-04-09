import express from 'express';
import {
  getTimeSlots,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  bulkCreateTimeSlots,
  reorderTimeSlots
} from '../controllers/timeSlotController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/timeslots
 * @desc    Get all time slots
 * @access  Private
 */
router.get('/', getTimeSlots);

/**
 * @route   POST /api/timeslots
 * @desc    Create time slot
 * @access  Private (Admin)
 */
router.post('/', createTimeSlot);

/**
 * @route   POST /api/timeslots/bulk
 * @desc    Bulk create time slots
 * @access  Private (Admin)
 */
router.post('/bulk', bulkCreateTimeSlots);

/**
 * @route   PUT /api/timeslots/reorder
 * @desc    Reorder time slots
 * @access  Private (Admin)
 */
router.put('/reorder', reorderTimeSlots);

/**
 * @route   PUT /api/timeslots/:id
 * @desc    Update time slot
 * @access  Private (Admin)
 */
router.put('/:id', updateTimeSlot);

/**
 * @route   DELETE /api/timeslots/:id
 * @desc    Delete time slot
 * @access  Private (Admin)
 */
router.delete('/:id', deleteTimeSlot);

export default router;
