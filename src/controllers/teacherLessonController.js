import TeacherLesson from '../models/TeacherLesson.js';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Create a lesson plan
 * @route   POST /api/teacher/lessons
 * @access  Private (Teacher)
 */
export const createLesson = asyncHandler(async (req, res) => {
  const {
    classId,
    sectionId,
    subjectId,
    lessonTitle,
    chapterName,
    chapterNumber,
    topicName,
    syllabus,
    description,
    duration,
    lessonDate,
    learningOutcomes,
    keyPoints,
    teachingMethods,
    resources,
    preRequisites,
    assignments,
    materials,
    difficulty,
    notes
  } = req.body;

  // Validation
  if (!classId || !sectionId || !subjectId || !lessonTitle || !topicName) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields'
    });
  }

  const lesson = await TeacherLesson.create({
    classId,
    sectionId,
    subjectId,
    teacherId: req.user._id,
    lessonTitle,
    chapterName,
    chapterNumber,
    topicName,
    syllabus,
    description,
    duration: duration || 45,
    lessonDate: lessonDate || new Date(),
    learningOutcomes: learningOutcomes || [],
    keyPoints: keyPoints || [],
    teachingMethods: teachingMethods || [],
    resources: resources || [],
    preRequisites: preRequisites || [],
    assignments: assignments || [],
    materials: materials || [],
    difficulty: difficulty || 'intermediate',
    status: 'planned',
    notes
  });

  res.status(201).json({
    success: true,
    message: 'Lesson created successfully',
    data: lesson
  });
});

/**
 * @desc    Get lessons for a class
 * @route   GET /api/teacher/lessons/:classId
 * @access  Private (Teacher)
 */
export const getLessonsByClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { sectionId, chapterName, status } = req.query;
  const teacherId = req.user._id;

  let query = {
    classId,
    teacherId
  };

  if (sectionId) query.sectionId = sectionId;
  if (chapterName) query.chapterName = chapterName;
  if (status) query.status = status;

  const lessons = await TeacherLesson.find(query)
    .populate('subjectId', 'subjectName subjectCode')
    .populate('assignments', 'title dueDate totalPoints')
    .populate('materials', 'title materialType')
    .sort({ lessonDate: -1 });

  res.status(200).json({
    success: true,
    count: lessons.length,
    data: lessons
  });
});

/**
 * @desc    Get lesson by ID
 * @route   GET /api/teacher/lessons/:id
 * @access  Private (Teacher)
 */
export const getLessonById = asyncHandler(async (req, res) => {
  const lesson = await TeacherLesson.findById(req.params.id)
    .populate('subjectId', 'subjectName subjectCode')
    .populate('assignments', 'title dueDate totalPoints')
    .populate('materials', 'title materialType')
    .populate('classId', 'className')
    .populate('sectionId', 'sectionName');

  if (!lesson) {
    return res.status(404).json({
      success: false,
      message: 'Lesson not found'
    });
  }

  res.status(200).json({
    success: true,
    data: lesson
  });
});

/**
 * @desc    Update lesson plan
 * @route   PUT /api/teacher/lessons/:id
 * @access  Private (Teacher)
 */
export const updateLesson = asyncHandler(async (req, res) => {
  let lesson = await TeacherLesson.findOne({
    _id: req.params.id,
    teacherId: req.user._id
  });

  if (!lesson) {
    return res.status(404).json({
      success: false,
      message: 'Lesson not found'
    });
  }

  lesson = await TeacherLesson.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    message: 'Lesson updated successfully',
    data: lesson
  });
});

/**
 * @desc    Delete lesson
 * @route   DELETE /api/teacher/lessons/:id
 * @access  Private (Teacher)
 */
export const deleteLesson = asyncHandler(async (req, res) => {
  const lesson = await TeacherLesson.findOneAndDelete({
    _id: req.params.id,
    teacherId: req.user._id
  });

  if (!lesson) {
    return res.status(404).json({
      success: false,
      message: 'Lesson not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Lesson deleted successfully'
  });
});

/**
 * @desc    Mark lesson as in-progress
 * @route   PUT /api/teacher/lessons/:id/start
 * @access  Private (Teacher)
 */
export const startLesson = asyncHandler(async (req, res) => {
  const lesson = await TeacherLesson.findOneAndUpdate(
    {
      _id: req.params.id,
      teacherId: req.user._id
    },
    {
      status: 'in-progress'
    },
    { new: true }
  );

  if (!lesson) {
    return res.status(404).json({
      success: false,
      message: 'Lesson not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Lesson marked as in-progress',
    data: lesson
  });
});

/**
 * @desc    Mark lesson as completed
 * @route   PUT /api/teacher/lessons/:id/complete
 * @access  Private (Teacher)
 */
export const completeLesson = asyncHandler(async (req, res) => {
  const lesson = await TeacherLesson.findOneAndUpdate(
    {
      _id: req.params.id,
      teacherId: req.user._id
    },
    {
      status: 'completed'
    },
    { new: true }
  );

  if (!lesson) {
    return res.status(404).json({
      success: false,
      message: 'Lesson not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Lesson marked as completed',
    data: lesson
  });
});

/**
 * @desc    Add feedback to lesson
 * @route   PUT /api/teacher/lessons/:id/feedback
 * @access  Private
 */
export const addLessonFeedback = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid rating (1-5)'
    });
  }

  const lesson = await TeacherLesson.findById(req.params.id);

  if (!lesson) {
    return res.status(404).json({
      success: false,
      message: 'Lesson not found'
    });
  }

  // Add feedback
  if (!lesson.feedback) {
    lesson.feedback = {
      averageRating: rating,
      studentFeedback: []
    };
  } else {
    const currentFeedbacks = lesson.feedback.studentFeedback || [];
    const totalFeedbacks = currentFeedbacks.length + 1;
    const currentSum = lesson.feedback.averageRating * currentFeedbacks.length;
    lesson.feedback.averageRating = ((currentSum + rating) / totalFeedbacks).toFixed(2);
  }

  lesson.feedback.studentFeedback = lesson.feedback.studentFeedback || [];
  lesson.feedback.studentFeedback.push({
    userId: req.user._id,
    rating,
    comment: comment || ''
  });

  await lesson.save();

  res.status(200).json({
    success: true,
    message: 'Feedback added successfully',
    data: lesson
  });
});

/**
 * @desc    Get lessons by chapter
 * @route   GET /api/teacher/lessons/chapter/:classId/:chapterName
 * @access  Private (Teacher)
 */
export const getLessonsByChapter = asyncHandler(async (req, res) => {
  const { classId, chapterName } = req.params;
  const teacherId = req.user._id;

  const lessons = await TeacherLesson.find({
    classId,
    chapterName,
    teacherId
  })
    .populate('subjectId', 'subjectName subjectCode')
    .sort({ lessonDate: 1 });

  const summary = {
    totalLessons: lessons.length,
    completedLessons: lessons.filter(l => l.status === 'completed').length,
    inProgressLessons: lessons.filter(l => l.status === 'in-progress').length,
    plannedLessons: lessons.filter(l => l.status === 'planned').length,
    totalDuration: lessons.reduce((sum, l) => sum + l.duration, 0),
    lessons
  };

  res.status(200).json({
    success: true,
    data: summary
  });
});

/**
 * @desc    Get upcoming lessons
 * @route   GET /api/teacher/lessons/upcoming/:classId
 * @access  Private (Teacher)
 */
export const getUpcomingLessons = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { days = 30 } = req.query;
  const teacherId = req.user._id;

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + parseInt(days));

  const lessons = await TeacherLesson.find({
    classId,
    teacherId,
    lessonDate: {
      $gte: today,
      $lte: endDate
    },
    status: { $ne: 'completed' }
  })
    .populate('subjectId', 'subjectName subjectCode')
    .sort({ lessonDate: 1 });

  res.status(200).json({
    success: true,
    count: lessons.length,
    data: lessons
  });
});

/**
 * @desc    Get lesson statistics for a class
 * @route   GET /api/teacher/lessons-stats/:classId
 * @access  Private (Teacher)
 */
export const getLessonStats = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const teacherId = req.user._id;

  const lessons = await TeacherLesson.find({
    classId,
    teacherId
  });

  const stats = {
    totalLessons: lessons.length,
    completedLessons: lessons.filter(l => l.status === 'completed').length,
    inProgressLessons: lessons.filter(l => l.status === 'in-progress').length,
    plannedLessons: lessons.filter(l => l.status === 'planned').length,
    totalDuration: lessons.reduce((sum, l) => sum + l.duration, 0),
    averageDuration: (lessons.reduce((sum, l) => sum + l.duration, 0) / lessons.length).toFixed(0),
    byDifficulty: {
      beginner: lessons.filter(l => l.difficulty === 'beginner').length,
      intermediate: lessons.filter(l => l.difficulty === 'intermediate').length,
      advanced: lessons.filter(l => l.difficulty === 'advanced').length
    },
    lessonsWithResources: lessons.filter(l => l.resources.length > 0).length,
    lessonsWithAssignments: lessons.filter(l => l.assignments.length > 0).length,
    averageFeedback: lessons.reduce((sum, l) => sum + (l.feedback?.averageRating || 0), 0) / lessons.length
  };

  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * @desc    Link assignment to lesson
 * @route   PUT /api/teacher/lessons/:id/link-assignment/:assignmentId
 * @access  Private (Teacher)
 */
export const linkAssignmentToLesson = asyncHandler(async (req, res) => {
  const { id, assignmentId } = req.params;

  const lesson = await TeacherLesson.findOneAndUpdate(
    {
      _id: id,
      teacherId: req.user._id
    },
    {
      $addToSet: { assignments: assignmentId }
    },
    { new: true }
  );

  if (!lesson) {
    return res.status(404).json({
      success: false,
      message: 'Lesson not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Assignment linked successfully',
    data: lesson
  });
});

/**
 * @desc    Link material to lesson
 * @route   PUT /api/teacher/lessons/:id/link-material/:materialId
 * @access  Private (Teacher)
 */
export const linkMaterialToLesson = asyncHandler(async (req, res) => {
  const { id, materialId } = req.params;

  const lesson = await TeacherLesson.findOneAndUpdate(
    {
      _id: id,
      teacherId: req.user._id
    },
    {
      $addToSet: { materials: materialId }
    },
    { new: true }
  );

  if (!lesson) {
    return res.status(404).json({
      success: false,
      message: 'Lesson not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Material linked successfully',
    data: lesson
  });
});

export default {
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
};
