import ClassSchedule from '../models/ClassSchedule.js';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Create class schedule
 * @route   POST /api/teacher/schedule
 * @access  Private (Teacher)
 */
export const createSchedule = asyncHandler(async (req, res) => {
  const {
    classId,
    sectionId,
    subjectId,
    dayOfWeek,
    startTime,
    endTime,
    room,
    building,
    academicYear,
    semester,
    notes
  } = req.body;

  // Validation
  if (!classId || !sectionId || !subjectId || dayOfWeek === undefined || !startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields'
    });
  }

  // Validate dayOfWeek (0-6)
  if (dayOfWeek < 0 || dayOfWeek > 6) {
    return res.status(400).json({
      success: false,
      message: 'Invalid day of week. Must be 0-6'
    });
  }

  // Calculate duration
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const duration = (endHour - startHour) * 60 + (endMin - startMin);

  if (duration <= 0) {
    return res.status(400).json({
      success: false,
      message: 'End time must be after start time'
    });
  }

  // Day names mapping
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const schedule = await ClassSchedule.create({
    classId,
    sectionId,
    teacherId: req.user._id,
    subjectId,
    dayOfWeek,
    dayName: dayNames[dayOfWeek],
    startTime,
    endTime,
    duration,
    room,
    building,
    academicYear: academicYear || new Date().getFullYear(),
    semester: semester || '1',
    isActive: true,
    notes
  });

  res.status(201).json({
    success: true,
    message: 'Schedule created successfully',
    data: schedule
  });
});

/**
 * @desc    Get schedules for a class
 * @route   GET /api/teacher/schedule/:classId
 * @access  Private (Teacher)
 */
export const getSchedulesByClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { sectionId, academicYear, semester } = req.query;
  const teacherId = req.user._id;

  let query = {
    classId,
    teacherId,
    isActive: true
  };

  if (sectionId) query.sectionId = sectionId;
  if (academicYear) query.academicYear = parseInt(academicYear);
  if (semester) query.semester = semester;

  const schedules = await ClassSchedule.find(query)
    .populate('subjectId', 'subjectName subjectCode')
    .sort({ dayOfWeek: 1, startTime: 1 });

  // Group by day
  const groupedByDay = {
    Sunday: [],
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: []
  };

  schedules.forEach(schedule => {
    groupedByDay[schedule.dayName].push(schedule);
  });

  res.status(200).json({
    success: true,
    count: schedules.length,
    data: schedules,
    groupedByDay
  });
});

/**
 * @desc    Get today's schedule
 * @route   GET /api/teacher/schedule/today
 * @access  Private (Teacher)
 */
export const getTodaySchedule = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;
  const today = new Date().getDay(); // 0 = Sunday, 6 = Saturday

  const schedules = await ClassSchedule.find({
    teacherId,
    dayOfWeek: today,
    isActive: true
  })
    .populate('classId', 'className')
    .populate('sectionId', 'sectionName')
    .populate('subjectId', 'subjectName subjectCode')
    .sort({ startTime: 1 });

  res.status(200).json({
    success: true,
    count: schedules.length,
    data: schedules
  });
});

/**
 * @desc    Get weekly schedule
 * @route   GET /api/teacher/schedule/weekly
 * @access  Private (Teacher)
 */
export const getWeeklySchedule = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;

  const schedules = await ClassSchedule.find({
    teacherId,
    isActive: true
  })
    .populate('classId', 'className')
    .populate('sectionId', 'sectionName')
    .populate('subjectId', 'subjectName subjectCode')
    .sort({ dayOfWeek: 1, startTime: 1 });

  // Group by day
  const weeklySchedule = {
    Sunday: [],
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: []
  };

  schedules.forEach(schedule => {
    weeklySchedule[schedule.dayName].push({
      _id: schedule._id,
      class: schedule.classId?.className,
      section: schedule.sectionId?.sectionName,
      subject: schedule.subjectId?.subjectName,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      duration: schedule.duration,
      room: schedule.room,
      building: schedule.building
    });
  });

  res.status(200).json({
    success: true,
    data: weeklySchedule
  });
});

/**
 * @desc    Get a specific schedule
 * @route   GET /api/teacher/schedule/:id
 * @access  Private (Teacher)
 */
export const getScheduleById = asyncHandler(async (req, res) => {
  const schedule = await ClassSchedule.findById(req.params.id)
    .populate('classId')
    .populate('sectionId')
    .populate('subjectId');

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'Schedule not found'
    });
  }

  res.status(200).json({
    success: true,
    data: schedule
  });
});

/**
 * @desc    Update class schedule
 * @route   PUT /api/teacher/schedule/:id
 * @access  Private (Teacher)
 */
export const updateSchedule = asyncHandler(async (req, res) => {
  let schedule = await ClassSchedule.findOne({
    _id: req.params.id,
    teacherId: req.user._id
  });

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'Schedule not found'
    });
  }

  // If time is being updated, recalculate duration
  if (req.body.startTime || req.body.endTime) {
    const startTime = req.body.startTime || schedule.startTime;
    const endTime = req.body.endTime || schedule.endTime;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const duration = (endHour - startHour) * 60 + (endMin - startMin);

    if (duration <= 0) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time'
      });
    }

    req.body.duration = duration;
  }

  schedule = await ClassSchedule.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    message: 'Schedule updated successfully',
    data: schedule
  });
});

/**
 * @desc    Delete class schedule
 * @route   DELETE /api/teacher/schedule/:id
 * @access  Private (Teacher)
 */
export const deleteSchedule = asyncHandler(async (req, res) => {
  const schedule = await ClassSchedule.findOneAndDelete({
    _id: req.params.id,
    teacherId: req.user._id
  });

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'Schedule not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Schedule deleted successfully'
  });
});

/**
 * @desc    Get schedule conflicts
 * @route   GET /api/teacher/schedule/conflicts/:classId/:sectionId
 * @access  Private (Teacher)
 */
export const checkScheduleConflicts = asyncHandler(async (req, res) => {
  const { classId, sectionId } = req.params;
  const { dayOfWeek, startTime, endTime } = req.query;

  if (!dayOfWeek || !startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: 'Please provide dayOfWeek, startTime, and endTime'
    });
  }

  const conflicts = await ClassSchedule.find({
    classId,
    sectionId,
    dayOfWeek: parseInt(dayOfWeek),
    isActive: true,
    $or: [
      {
        startTime: { $lt: endTime },
        endTime: { $gt: startTime }
      }
    ]
  });

  res.status(200).json({
    success: true,
    hasConflicts: conflicts.length > 0,
    conflictCount: conflicts.length,
    conflicts: conflicts || []
  });
});

/**
 * @desc    Get schedule summary for a class
 * @route   GET /api/teacher/schedule-summary/:classId
 * @access  Private (Teacher)
 */
export const getScheduleSummary = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const teacherId = req.user._id;

  const schedules = await ClassSchedule.find({
    classId,
    teacherId,
    isActive: true
  });

  const summary = {
    totalSessions: schedules.length,
    totalHours: (schedules.reduce((sum, s) => sum + s.duration, 0) / 60).toFixed(2),
    sessionsPerWeek: schedules.length,
    averageSessionDuration: (schedules.reduce((sum, s) => sum + s.duration, 0) / schedules.length).toFixed(0),
    rooms: [...new Set(schedules.map(s => s.room))],
    buildings: [...new Set(schedules.map(s => s.building))],
    daysOfWeek: [...new Set(schedules.map(s => s.dayName))]
  };

  res.status(200).json({
    success: true,
    data: summary
  });
});

export default {
  createSchedule,
  getSchedulesByClass,
  getTodaySchedule,
  getWeeklySchedule,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  checkScheduleConflicts,
  getScheduleSummary
};
