import TimeSlot from '../models/TimeSlot.js';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Get all time slots
 * @route   GET /api/timeslots
 * @access  Private
 */
export const getTimeSlots = asyncHandler(async (req, res) => {
  const { academicYearId, slotType, isActive } = req.query;

  const query = {};
  if (academicYearId) query.academicYearId = academicYearId;
  if (slotType) query.slotType = slotType;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  try {
    const timeSlots = await TimeSlot.find(query).sort({ displayOrder: 1 });

    res.json({
      success: true,
      data: timeSlots || [],
      count: timeSlots?.length || 0
    });
  } catch (error) {
    console.error('Error fetching time slots:', error.message);
    res.json({
      success: true,
      data: [],
      count: 0,
      message: 'No time slots found. Please configure time slots first.'
    });
  }
});

/**
 * @desc    Create time slot
 * @route   POST /api/timeslots
 * @access  Private (Admin)
 */
export const createTimeSlot = asyncHandler(async (req, res) => {
  const {
    slotName,
    slotType,
    startTime,
    endTime,
    displayOrder,
    academicYearId,
    metadata
  } = req.body;

  // Check for overlapping time slots
  const existingSlot = await TimeSlot.findOne({
    academicYearId,
    displayOrder,
    isActive: true
  });

  if (existingSlot) {
    return res.status(400).json({
      success: false,
      message: 'A time slot with this display order already exists'
    });
  }

  const timeSlot = await TimeSlot.create({
    slotName,
    slotType,
    startTime,
    endTime,
    displayOrder,
    academicYearId,
    metadata
  });

  res.status(201).json({
    success: true,
    data: timeSlot,
    message: 'Time slot created successfully'
  });
});

/**
 * @desc    Update time slot
 * @route   PUT /api/timeslots/:id
 * @access  Private (Admin)
 */
export const updateTimeSlot = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const timeSlot = await TimeSlot.findById(id);

  if (!timeSlot) {
    return res.status(404).json({
      success: false,
      message: 'Time slot not found'
    });
  }

  // Update fields
  const allowedFields = ['slotName', 'slotType', 'startTime', 'endTime', 'displayOrder', 'isActive', 'metadata'];
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      timeSlot[field] = updates[field];
    }
  });

  await timeSlot.save();

  res.json({
    success: true,
    data: timeSlot,
    message: 'Time slot updated successfully'
  });
});

/**
 * @desc    Delete time slot
 * @route   DELETE /api/timeslots/:id
 * @access  Private (Admin)
 */
export const deleteTimeSlot = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const timeSlot = await TimeSlot.findById(id);

  if (!timeSlot) {
    return res.status(404).json({
      success: false,
      message: 'Time slot not found'
    });
  }

  // Soft delete
  timeSlot.isActive = false;
  await timeSlot.save();

  res.json({
    success: true,
    message: 'Time slot deleted successfully'
  });
});

/**
 * @desc    Bulk create time slots (for setting up school schedule)
 * @route   POST /api/timeslots/bulk
 * @access  Private (Admin)
 */
export const bulkCreateTimeSlots = asyncHandler(async (req, res) => {
  const { academicYearId, slots } = req.body;

  if (!Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Slots array is required'
    });
  }

  // Add academicYearId to each slot
  const slotsWithYear = slots.map(slot => ({
    ...slot,
    academicYearId
  }));

  const createdSlots = await TimeSlot.insertMany(slotsWithYear);

  res.status(201).json({
    success: true,
    data: createdSlots,
    count: createdSlots.length,
    message: `${createdSlots.length} time slots created successfully`
  });
});

/**
 * @desc    Reorder time slots
 * @route   PUT /api/timeslots/reorder
 * @access  Private (Admin)
 */
export const reorderTimeSlots = asyncHandler(async (req, res) => {
  const { slots } = req.body;
  // slots = [{ id, displayOrder }, ...]

  if (!Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Slots array is required'
    });
  }

  const updatePromises = slots.map(slot =>
    TimeSlot.findByIdAndUpdate(slot.id, { displayOrder: slot.displayOrder })
  );

  await Promise.all(updatePromises);

  res.json({
    success: true,
    message: 'Time slots reordered successfully'
  });
});

export default {
  getTimeSlots,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  bulkCreateTimeSlots,
  reorderTimeSlots
};
