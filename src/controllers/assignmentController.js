import Assignment from '../models/Assignment.js';
import AssignmentSubmission from '../models/AssignmentSubmission.js';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Create a new assignment
 * @route   POST /api/teacher/assignments
 * @access  Private (Teacher)
 */
export const createAssignment = asyncHandler(async (req, res) => {
  const {
    classId,
    sectionId,
    subjectId,
    title,
    description,
    instructions,
    dueDate,
    totalPoints,
    submissionType,
    allowLateSubmission,
    latePenalty
  } = req.body;

  // Validation
  if (!classId || !sectionId || !subjectId || !title || !dueDate) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields'
    });
  }

  const assignment = await Assignment.create({
    classId,
    sectionId,
    subjectId,
    teacherId: req.user._id,
    title,
    description,
    instructions,
    dueDate,
    totalPoints,
    submissionType,
    allowLateSubmission,
    latePenalty,
    status: 'draft'
  });

  res.status(201).json({
    success: true,
    message: 'Assignment created successfully',
    data: assignment
  });
});

/**
 * @desc    Get all assignments for a class
 * @route   GET /api/teacher/assignments/:classId
 * @access  Private (Teacher)
 */
export const getAssignmentsByClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const teacherId = req.user._id;

  const assignments = await Assignment.find({
    classId,
    teacherId
  })
    .populate('subjectId', 'subjectName subjectCode')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: assignments.length,
    data: assignments
  });
});

/**
 * @desc    Get a specific assignment with submissions
 * @route   GET /api/teacher/assignments/:id/submissions
 * @access  Private (Teacher)
 */
export const getAssignmentWithSubmissions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user._id;

  const assignment = await Assignment.findOne({
    _id: id,
    teacherId
  }).populate('subjectId', 'subjectName');

  if (!assignment) {
    return res.status(404).json({
      success: false,
      message: 'Assignment not found'
    });
  }

  const submissions = await AssignmentSubmission.find({
    assignmentId: id
  })
    .populate('studentId', 'name email')
    .select('studentId status obtainedPoints totalPoints submittedDate isLateSubmission');

  res.status(200).json({
    success: true,
    data: {
      assignment,
      submissions: {
        total: submissions.length,
        submitted: submissions.filter(s => s.status !== 'unsubmitted').length,
        graded: submissions.filter(s => s.status === 'graded').length,
        pending: submissions.filter(s => s.status === 'submitted').length,
        submissions
      }
    }
  });
});

/**
 * @desc    Update an assignment
 * @route   PUT /api/teacher/assignments/:id
 * @access  Private (Teacher)
 */
export const updateAssignment = asyncHandler(async (req, res) => {
  let assignment = await Assignment.findOne({
    _id: req.params.id,
    teacherId: req.user._id
  });

  if (!assignment) {
    return res.status(404).json({
      success: false,
      message: 'Assignment not found'
    });
  }

  // Only allow updates if not yet graded significantly
  if (assignment.gradeCount > 5) {
    return res.status(400).json({
      success: false,
      message: 'Cannot update assignment after significant grading'
    });
  }

  assignment = await Assignment.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    message: 'Assignment updated successfully',
    data: assignment
  });
});

/**
 * @desc    Publish an assignment
 * @route   PUT /api/teacher/assignments/:id/publish
 * @access  Private (Teacher)
 */
export const publishAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findOneAndUpdate(
    {
      _id: req.params.id,
      teacherId: req.user._id
    },
    { status: 'published' },
    { new: true }
  );

  if (!assignment) {
    return res.status(404).json({
      success: false,
      message: 'Assignment not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Assignment published successfully',
    data: assignment
  });
});

/**
 * @desc    Close assignment submissions
 * @route   PUT /api/teacher/assignments/:id/close
 * @access  Private (Teacher)
 */
export const closeAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findOneAndUpdate(
    {
      _id: req.params.id,
      teacherId: req.user._id
    },
    { status: 'closed' },
    { new: true }
  );

  if (!assignment) {
    return res.status(404).json({
      success: false,
      message: 'Assignment not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Assignment closed successfully',
    data: assignment
  });
});

/**
 * @desc    Delete an assignment
 * @route   DELETE /api/teacher/assignments/:id
 * @access  Private (Teacher)
 */
export const deleteAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findOneAndDelete({
    _id: req.params.id,
    teacherId: req.user._id,
    status: 'draft' // Only allow deletion of draft assignments
  });

  if (!assignment) {
    return res.status(404).json({
      success: false,
      message: 'Assignment not found or cannot be deleted'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Assignment deleted successfully'
  });
});

/**
 * @desc    Grade an assignment submission
 * @route   PUT /api/teacher/assignments/:assignmentId/submissions/:submissionId/grade
 * @access  Private (Teacher)
 */
export const gradeSubmission = asyncHandler(async (req, res) => {
  const { assignmentId, submissionId } = req.params;
  const { obtainedPoints, feedback, gradeLevel, rubricScores } = req.body;

  const submission = await AssignmentSubmission.findOne({
    _id: submissionId,
    assignmentId
  });

  if (!submission) {
    return res.status(404).json({
      success: false,
      message: 'Submission not found'
    });
  }

  // Calculate percentage
  const percentage = (obtainedPoints / submission.totalPoints) * 100;

  // Determine grade level
  let finalGrade = gradeLevel;
  if (!finalGrade) {
    if (percentage >= 90) finalGrade = 'A';
    else if (percentage >= 80) finalGrade = 'B';
    else if (percentage >= 70) finalGrade = 'C';
    else if (percentage >= 60) finalGrade = 'D';
    else finalGrade = 'F';
  }

  submission.obtainedPoints = obtainedPoints;
  submission.percentage = Math.round(percentage);
  submission.gradeLevel = finalGrade;
  submission.feedback = feedback;
  submission.rubricScores = rubricScores;
  submission.status = 'graded';
  submission.gradedDate = new Date();
  submission.gradedBy = req.user._id;

  await submission.save();

  // Update assignment grade count
  await Assignment.findByIdAndUpdate(assignmentId, {
    $inc: { gradeCount: 1 }
  });

  res.status(200).json({
    success: true,
    message: 'Submission graded successfully',
    data: submission
  });
});

/**
 * @desc    Get grading summary for an assignment
 * @route   GET /api/teacher/assignments/:id/grading-summary
 * @access  Private (Teacher)
 */
export const getGradingSummary = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const submissions = await AssignmentSubmission.find({
    assignmentId: id
  })
    .select('status obtainedPoints totalPoints percentage gradeLevel');

  const summary = {
    total: submissions.length,
    submitted: submissions.filter(s => s.status === 'submitted' || s.status === 'graded').length,
    graded: submissions.filter(s => s.status === 'graded').length,
    pending: submissions.filter(s => s.status === 'submitted').length,
    averageScore: Math.round(
      submissions
        .filter(s => s.status === 'graded')
        .reduce((sum, s) => sum + s.percentage, 0) / submissions.filter(s => s.status === 'graded').length || 0
    ),
    gradeDistribution: {
      A: submissions.filter(s => s.gradeLevel === 'A').length,
      B: submissions.filter(s => s.gradeLevel === 'B').length,
      C: submissions.filter(s => s.gradeLevel === 'C').length,
      D: submissions.filter(s => s.gradeLevel === 'D').length,
      F: submissions.filter(s => s.gradeLevel === 'F').length
    }
  };

  res.status(200).json({
    success: true,
    data: summary
  });
});

export default {
  createAssignment,
  getAssignmentsByClass,
  getAssignmentWithSubmissions,
  updateAssignment,
  publishAssignment,
  closeAssignment,
  deleteAssignment,
  gradeSubmission,
  getGradingSummary
};
