import Timetable from '../models/Timetable.js';
import TimetableSlot from '../models/TimetableSlot.js';
import TimeSlot from '../models/TimeSlot.js';
import Class from '../models/Class.js';
import Teacher from '../models/Teacher.js';
import User from '../models/User.js';
import conflictDetectionService from '../services/conflictDetectionService.js';
import asyncHandler from 'express-async-handler';

function normalizeClassToken(className) {
  if (!className) return '';

  const value = String(className).trim().toLowerCase();
  if (value === 'lkg' || value === 'ukg') return value;

  const numericMatch = value.match(/\d+/);
  if (numericMatch?.[0]) return numericMatch[0];

  return value.replace(/\s+/g, '');
}

function normalizeAcademicYear(academicYear) {
  if (!academicYear) return '';

  const value = String(academicYear).trim();
  const yearParts = value.match(/\d{2,4}/g);
  if (!yearParts || yearParts.length === 0) return value;

  let startYear = yearParts[0];
  let endYear = yearParts[1] || yearParts[0];

  if (startYear.length === 2) startYear = `20${startYear}`;
  if (endYear.length === 2 && startYear.length === 4) {
    endYear = `${startYear.slice(0, 2)}${endYear}`;
  }

  return `${startYear}-${endYear}`;
}

async function resolveTeacherUserId(teacherId) {
  if (!teacherId) return null;

  const teacher = await Teacher.findById(teacherId).select('user');
  if (teacher?.user) {
    return teacher.user;
  }

  const user = await User.findById(teacherId).select('_id');
  return user?._id || null;
}

async function resolveTeacherUserIdForSlot({ timetable, subjectId }) {
  // TeacherAssignment model removed - no longer resolves automatically
  return null;
}

/**
 * @desc    Get timetable for a specific class/section
 * @route   GET /api/timetable/:classId/:sectionId
 * @access  Private
 */
export const getTimetable = asyncHandler(async (req, res) => {
  const { classId, sectionId } = req.params;
  const { academicYearId, term = 'annual' } = req.query;

  const timetable = await Timetable.findOne({
    classId,
    sectionId,
    academicYearId,
    term,
    status: { $ne: 'archived' }
  })
    .populate('classId', 'className')
    .populate('createdBy', 'name email')
    .populate('publishedBy', 'name email')
    .sort({ version: -1 })
    .limit(1);

  if (!timetable) {
    return res.status(404).json({
      success: false,
      message: 'Timetable not found'
    });
  }

  const slotsForNormalization = await TimetableSlot.find({
    timetableId: timetable._id,
    isActive: true
  }).select('_id teacherId subjectId');

  for (const slot of slotsForNormalization) {
    if (slot.teacherId) {
      const normalizedTeacherId = await resolveTeacherUserId(slot.teacherId);
      if (normalizedTeacherId && String(normalizedTeacherId) !== String(slot.teacherId)) {
        await TimetableSlot.findByIdAndUpdate(slot._id, {
          teacherId: normalizedTeacherId,
          lastModifiedBy: req.user?._id
        });
      }
      continue;
    }

    if (slot.subjectId) {
      const resolvedTeacherId = await resolveTeacherUserIdForSlot({
        timetable,
        subjectId: slot.subjectId
      });

      if (resolvedTeacherId) {
        await TimetableSlot.findByIdAndUpdate(slot._id, {
          teacherId: resolvedTeacherId,
          lastModifiedBy: req.user?._id
        });
      }
    }
  }

  const slots = await TimetableSlot.find({
    timetableId: timetable._id,
    isActive: true
  })
    .populate('timeSlotId')
    .populate('subjectId', 'subjectName subjectCode')
    .populate('teacherId', 'name email')
    .populate('substituteTeacherId', 'name email')
    .sort({ dayOfWeek: 1, 'timeSlotId.displayOrder': 1 });

  res.json({
    success: true,
    data: {
      timetable,
      slots
    }
  });
});

/**
 * @desc    Create new timetable
 * @route   POST /api/timetable
 * @access  Private (Admin)
 */
export const createTimetable = asyncHandler(async (req, res) => {
  const {
    classId,
    sectionId,
    academicYearId,
    term = 'annual',
    effectiveFrom,
    effectiveTo,
    notes
  } = req.body;

  // Check if timetable already exists
  const existingCount = await Timetable.countDocuments({
    classId,
    sectionId,
    academicYearId,
    term
  });

  const timetable = await Timetable.create({
    classId,
    sectionId,
    academicYearId,
    term,
    version: existingCount + 1,
    effectiveFrom,
    effectiveTo,
    notes,
    createdBy: req.user._id,
    status: 'draft'
  });

  const populated = await Timetable.findById(timetable._id)
    .populate('classId', 'className')
    .populate('createdBy', 'name email');

  res.status(201).json({
    success: true,
    data: populated,
    message: 'Timetable created successfully'
  });
});

/**
 * @desc    Update timetable metadata
 * @route   PUT /api/timetable/:id
 * @access  Private (Admin)
 */
export const updateTimetable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const timetable = await Timetable.findById(id);

  if (!timetable) {
    return res.status(404).json({
      success: false,
      message: 'Timetable not found'
    });
  }

  // Prevent updating published timetables
  if (timetable.isPublished && !req.body.forceUpdate) {
    return res.status(400).json({
      success: false,
      message: 'Cannot update published timetable. Unpublish first or use forceUpdate flag.'
    });
  }

  // Update allowed fields
  const allowedFields = ['effectiveFrom', 'effectiveTo', 'notes', 'term'];
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      timetable[field] = updates[field];
    }
  });

  await timetable.save();

  const populated = await Timetable.findById(timetable._id)
    .populate('classId', 'className')
    .populate('createdBy', 'name email');

  res.json({
    success: true,
    data: populated,
    message: 'Timetable updated successfully'
  });
});

/**
 * @desc    Create or update a timetable slot
 * @route   POST/PUT /api/timetable/:timetableId/slots
 * @access  Private (Admin)
 */
export const upsertSlot = asyncHandler(async (req, res) => {
  const { timetableId } = req.params;
  const slotData = { ...req.body };

  // Verify timetable exists
  const timetable = await Timetable.findById(timetableId);
  if (!timetable) {
    return res.status(404).json({
      success: false,
      message: 'Timetable not found'
    });
  }

  if (slotData.teacherId) {
    const normalizedTeacherId = await resolveTeacherUserId(slotData.teacherId);
    if (normalizedTeacherId) {
      slotData.teacherId = normalizedTeacherId;
    }
  }

  if (!slotData.teacherId && slotData.subjectId) {
    const resolvedTeacherId = await resolveTeacherUserIdForSlot({
      timetable,
      subjectId: slotData.subjectId
    });

    if (resolvedTeacherId) {
      slotData.teacherId = resolvedTeacherId;
    }
  }

  // Find existing slot FIRST (to get its ID for conflict checking)
  // Prefer explicit currentSlotId from client when updating an existing slot.
  let existingSlot = null;
  if (slotData.currentSlotId) {
    existingSlot = await TimetableSlot.findOne({
      _id: slotData.currentSlotId,
      timetableId,
      isActive: true
    });
  }

  if (!existingSlot) {
    const query = {
      timetableId,
      dayOfWeek: slotData.dayOfWeek,
      timeSlotId: slotData.timeSlotId,
      splitGroup: slotData.splitGroup || null
    };
    existingSlot = await TimetableSlot.findOne(query);
  }

  // Check for conflicts (excluding the existing slot if updating)
  const conflictCheck = await conflictDetectionService.checkSlotConflict({
    ...slotData,
    timetableId,
    academicYearId: timetable.academicYearId,
    term: timetable.term
  }, existingSlot?._id);

  // If there are error-level conflicts, reject
  const hasErrorConflicts = conflictCheck.conflicts.some(c => c.severity === 'error');
  if (hasErrorConflicts && !slotData.ignoreConflicts) {
    return res.status(409).json({
      success: false,
      message: 'Slot has conflicts',
      conflicts: conflictCheck.conflicts.filter(c => c.severity === 'error')
    });
  }

  // Update or create slot
  let slot;

  if (existingSlot) {
    // Update existing slot
    Object.assign(existingSlot, {
      subjectId: slotData.subjectId,
      teacherId: slotData.teacherId,
      roomNumber: slotData.roomNumber,
      building: slotData.building,
      floor: slotData.floor,
      isLabSession: slotData.isLabSession || false,
      isSplitClass: slotData.isSplitClass || false,
      alternateWeek: slotData.alternateWeek || 'both',
      remarks: slotData.remarks,
      hasConflict: conflictCheck.hasConflict,
      conflictType: conflictCheck.hasConflict ? conflictCheck.conflicts[0].type : 'none',
      conflictDetails: conflictCheck.hasConflict ? conflictCheck.conflicts[0].message : null,
      lastModifiedBy: req.user._id
    });
    slot = await existingSlot.save();
  } else {
    // Create new slot
    slot = await TimetableSlot.create({
      ...slotData,
      timetableId,
      hasConflict: conflictCheck.hasConflict,
      conflictType: conflictCheck.hasConflict ? conflictCheck.conflicts[0].type : 'none',
      conflictDetails: conflictCheck.hasConflict ? conflictCheck.conflicts[0].message : null,
      createdBy: req.user._id
    });
  }

  // Update timetable stats
  await updateTimetableStats(timetableId);

  const populated = await TimetableSlot.findById(slot._id)
    .populate('timeSlotId')
    .populate('subjectId', 'subjectName subjectCode')
    .populate('teacherId', 'name email');

  res.status(200).json({
    success: true,
    data: populated,
    warnings: conflictCheck.conflicts.filter(c => c.severity === 'warning'),
    message: slot ? 'Slot updated successfully' : 'Slot created successfully'
  });
});

/**
 * @desc    Delete a timetable slot
 * @route   DELETE /api/timetable/slots/:slotId
 * @access  Private (Admin)
 */
export const deleteSlot = asyncHandler(async (req, res) => {
  const { slotId } = req.params;

  const slot = await TimetableSlot.findById(slotId);
  if (!slot) {
    return res.status(404).json({
      success: false,
      message: 'Slot not found'
    });
  }

  const timetableId = slot.timetableId;

  // Soft delete
  slot.isActive = false;
  await slot.save();

  // Update timetable stats
  await updateTimetableStats(timetableId);

  res.json({
    success: true,
    message: 'Slot deleted successfully'
  });
});

/**
 * @desc    Publish timetable
 * @route   POST /api/timetable/:id/publish
 * @access  Private (Admin)
 */
export const publishTimetable = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const timetable = await Timetable.findById(id);
  if (!timetable) {
    return res.status(404).json({
      success: false,
      message: 'Timetable not found'
    });
  }

  // Final conflict check
  const conflictCheck = await conflictDetectionService.comprehensiveCheck(id);
  
  if (!conflictCheck.isValid && !req.body.forcePublish) {
    return res.status(409).json({
      success: false,
      message: 'Cannot publish timetable with unresolved conflicts',
      conflicts: conflictCheck,
      hint: 'Fix conflicts or use forcePublish flag to override'
    });
  }

  // Unpublish other versions
  await Timetable.updateMany(
    {
      classId: timetable.classId,
      sectionId: timetable.sectionId,
      academicYearId: timetable.academicYearId,
      term: timetable.term,
      _id: { $ne: id }
    },
    {
      isPublished: false,
      status: 'archived'
    }
  );

  // Publish this version
  await timetable.publish(req.user._id);

  res.json({
    success: true,
    data: timetable,
    warnings: conflictCheck.isValid ? [] : conflictCheck,
    message: 'Timetable published successfully'
  });
});

/**
 * @desc    Get teacher's timetable
 * @route   GET /api/timetable/teacher/:teacherId
 * @access  Private
 */
export const getTeacherTimetable = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  const { academicYearId, term = 'annual' } = req.query;

  // Get all published timetables for this academic year
  const timetables = await Timetable.find({
    academicYearId,
    term,
    isPublished: true
  }).select('_id');

  const timetableIds = timetables.map(t => t._id);

  // Get all slots for this teacher
  const slots = await TimetableSlot.find({
    timetableId: { $in: timetableIds },
    teacherId,
    isActive: true
  })
    .populate('timeSlotId')
    .populate('subjectId', 'subjectName subjectCode')
    .populate({
      path: 'timetableId',
      populate: [
        { path: 'classId', select: 'className' }
      ]
    })
    .sort({ dayOfWeek: 1, 'timeSlotId.displayOrder': 1 });

  // Group by day
  const groupedByDay = slots.reduce((acc, slot) => {
    const day = slot.dayName;
    if (!acc[day]) acc[day] = [];
    acc[day].push(slot);
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      slots,
      groupedByDay,
      totalPeriods: slots.length
    }
  });
});

/**
 * @desc    Get all conflicts
 * @route   GET /api/timetable/conflicts
 * @access  Private (Admin)
 */
export const getConflicts = asyncHandler(async (req, res) => {
  const { academicYearId, classId, teacherId } = req.query;

  try {
    const conflicts = await conflictDetectionService.getAllConflicts({
      academicYearId,
      classId,
      teacherId
    });

    res.json({
      success: true,
      data: conflicts || [],
      count: conflicts?.length || 0
    });
  } catch (error) {
    console.error('Error fetching conflicts:', error.message);
    res.json({
      success: true,
      data: [],
      count: 0
    });
  }
});

/**
 * @desc    Clone timetable to another class/section
 * @route   POST /api/timetable/:id/clone
 * @access  Private (Admin)
 */
export const cloneTimetable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { targetClassId, targetSectionId, academicYearId } = req.body;

  const sourceTimetable = await Timetable.findById(id);
  if (!sourceTimetable) {
    return res.status(404).json({
      success: false,
      message: 'Source timetable not found'
    });
  }

  // Create new timetable
  const newTimetable = await Timetable.create({
    classId: targetClassId || sourceTimetable.classId,
    sectionId: targetSectionId || sourceTimetable.sectionId,
    academicYearId: academicYearId || sourceTimetable.academicYearId,
    term: sourceTimetable.term,
    version: 1,
    effectiveFrom: sourceTimetable.effectiveFrom,
    effectiveTo: sourceTimetable.effectiveTo,
    createdBy: req.user._id,
    status: 'draft',
    notes: `Cloned from ${sourceTimetable.classId}-${sourceTimetable.sectionId}`
  });

  // Clone all slots
  const sourceSlots = await TimetableSlot.find({
    timetableId: id,
    isActive: true
  });

  const clonedSlots = await Promise.all(
    sourceSlots.map(slot => 
      TimetableSlot.create({
        timetableId: newTimetable._id,
        dayOfWeek: slot.dayOfWeek,
        dayName: slot.dayName,
        timeSlotId: slot.timeSlotId,
        subjectId: slot.subjectId,
        teacherId: slot.teacherId,
        roomNumber: slot.roomNumber,
        building: slot.building,
        floor: slot.floor,
        isLabSession: slot.isLabSession,
        isSplitClass: slot.isSplitClass,
        splitGroup: slot.splitGroup,
        alternateWeek: slot.alternateWeek,
        remarks: slot.remarks,
        createdBy: req.user._id
      })
    )
  );

  // Update stats
  await updateTimetableStats(newTimetable._id);

  // Run conflict check on cloned timetable
  const conflictCheck = await conflictDetectionService.comprehensiveCheck(newTimetable._id);

  res.status(201).json({
    success: true,
    data: {
      timetable: newTimetable,
      slotsCloned: clonedSlots.length,
      conflicts: conflictCheck
    },
    message: 'Timetable cloned successfully'
  });
});

/**
 * @desc    Get all timetables (with filters)
 * @route   GET /api/timetable
 * @access  Private
 */
export const getAllTimetables = asyncHandler(async (req, res) => {
  const {
    academicYearId,
    classId,
    status,
    isPublished,
    page = 1,
    limit = 20
  } = req.query;

  const query = {};
  if (academicYearId) query.academicYearId = academicYearId;
  if (classId) query.classId = classId;
  if (status) query.status = status;
  if (isPublished !== undefined) query.isPublished = isPublished === 'true';

  const skip = (parseInt(page) - 1) * parseInt(limit);

  try {
    const [timetables, total] = await Promise.all([
      Timetable.find(query)
        .populate('classId', 'className')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Timetable.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: timetables || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)) || 1
      }
    });
  } catch (error) {
    console.error('Error fetching timetables:', error.message);
    res.json({
      success: true,
      data: [],
      pagination: {
        page: 1,
        limit: parseInt(limit),
        total: 0,
        pages: 1
      }
    });
  }
});

/**
 * Helper function to update timetable statistics
 */
async function updateTimetableStats(timetableId) {
  const slots = await TimetableSlot.find({
    timetableId,
    isActive: true
  });

  const totalPeriods = slots.filter(s => s.timeSlotId?.slotType === 'period' || !s.timeSlotId).length;
  const assignedPeriods = slots.filter(s => s.subjectId && s.teacherId).length;
  const conflictedSlots = slots.filter(s => s.hasConflict).length;

  await Timetable.findByIdAndUpdate(timetableId, {
    totalPeriods,
    assignedPeriods,
    hasConflicts: conflictedSlots > 0,
    conflictCount: conflictedSlots
  });
}

/**
 * @desc    Check for conflicts on a slot without saving it
 * @route   POST /api/timetable/check-conflicts
 * @access  Private
 */
export const checkSlotConflicts = asyncHandler(async (req, res) => {
  const {
    timetableId,
    currentSlotId,
    dayOfWeek,
    timeSlotId,
    subjectId,
    teacherId,
    roomNumber,
    building,
    floor,
    isLabSession,
    isSplitClass,
    splitGroup,
    alternateWeek,
    remarks
  } = req.body;

  console.log('🔍 checkSlotConflicts - Received payload:', {
    currentSlotId,
    timetableId,
    dayOfWeek,
    timeSlotId,
    teacherId,
    roomNumber
  });

  // Verify timetable exists
  const timetable = await Timetable.findById(timetableId);
  if (!timetable) {
    return res.status(404).json({
      success: false,
      message: 'Timetable not found'
    });
  }

  const normalizedTeacherId = teacherId
    ? await resolveTeacherUserId(teacherId)
    : null;

  // Prepare slot data for conflict checking
  const slotData = {
    dayOfWeek,
    timeSlotId,
    subjectId,
    teacherId: normalizedTeacherId || teacherId || null,
    roomNumber,
    building,
    floor,
    isLabSession: isLabSession || false,
    isSplitClass: isSplitClass || false,
    splitGroup: splitGroup || null,
    alternateWeek: alternateWeek || 'both',
    remarks,
    timetableId,
    academicYearId: timetable.academicYearId,
    term: timetable.term
  };

  // Exclude the current slot so update actions don't conflict with themselves.
  // Prefer explicit currentSlotId; fallback to same timetable/day/time/split-group.
  let existingSlot = null;
  let excludeId = null;
  
  if (currentSlotId) {
    console.log('✅ Using explicit currentSlotId:', currentSlotId);
    existingSlot = await TimetableSlot.findOne({
      _id: currentSlotId,
      timetableId,
      isActive: true
    }).select('_id');
    if (existingSlot) {
      excludeId = currentSlotId;
      console.log('✅ Found existing slot by currentSlotId, will exclude:', excludeId);
    }
  }

  if (!existingSlot) {
    console.log('⚠️ No slot found by currentSlotId, trying fallback query...');
    existingSlot = await TimetableSlot.findOne({
      timetableId,
      dayOfWeek,
      timeSlotId,
      splitGroup: splitGroup || null,
      isActive: true
    }).select('_id');
    if (existingSlot) {
      excludeId = existingSlot._id;
      console.log('✅ Found slot by fallback, will exclude:', excludeId);
    }
  }

  console.log('🔍 checkSlotConflicts - Will exclude slot ID:', excludeId);

  const conflictCheck = await conflictDetectionService.checkSlotConflict(
    slotData,
    excludeId
  );
  
  console.log('✅ Conflict check result:', {
    hasConflict: conflictCheck.hasConflict,
    conflictCount: conflictCheck.conflictCount,
    conflicts: conflictCheck.conflicts.map(c => ({ type: c.type, message: c.message }))
  });

  // Return the conflicts found
  res.json({
    success: true,
    data: {
      hasConflict: conflictCheck.hasConflict,
      conflicts: conflictCheck.conflicts || []
    }
  });
});

/**
 * @desc    Get all classes for dropdown
 * @route   GET /api/timetable/classes
 * @access  Private
 */
export const getAllClasses = asyncHandler(async (req, res) => {
  try {
    const classes = await Class.find({}).sort({ className: 1 });

    res.json({
      success: true,
      count: classes.length,
      data: classes || []
    });
  } catch (error) {
    console.error('Error fetching classes:', error.message);
    res.json({
      success: true,
      count: 0,
      data: [],
      message: 'No classes found. Please add classes first.'
    });
  }
});

export default {
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
};
