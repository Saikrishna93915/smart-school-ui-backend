import GradeScale from '../models/GradeScale.js';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Get all grade scales
 * @route   GET /api/grade-scales
 * @access  Private
 */
export const getGradeScales = asyncHandler(async (req, res) => {
  const gradeScales = await GradeScale.find({}).sort({ isDefault: -1, createdAt: -1 });
  res.json({
    success: true,
    data: gradeScales,
    count: gradeScales.length
  });
});

/**
 * @desc    Get single grade scale
 * @route   GET /api/grade-scales/:id
 * @access  Private
 */
export const getGradeScale = asyncHandler(async (req, res) => {
  const gradeScale = await GradeScale.findById(req.params.id);
  if (!gradeScale) {
    return res.status(404).json({
      success: false,
      message: 'Grade scale not found'
    });
  }
  res.json({
    success: true,
    data: gradeScale
  });
});

/**
 * @desc    Create grade scale
 * @route   POST /api/grade-scales
 * @access  Private (Admin, Owner)
 */
export const createGradeScale = asyncHandler(async (req, res) => {
  const { name, description, grades, isDefault } = req.body;

  if (!name || !grades || !Array.isArray(grades) || grades.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Name and at least one grade entry are required'
    });
  }

  // Validate each grade entry
  for (const grade of grades) {
    if (!grade.grade || grade.minPercentage === undefined || grade.maxPercentage === undefined || grade.gradePoint === undefined || !grade.remark) {
      return res.status(400).json({
        success: false,
        message: `Each grade must have: grade, minPercentage, maxPercentage, gradePoint, and remark`
      });
    }
    if (grade.minPercentage > grade.maxPercentage) {
      return res.status(400).json({
        success: false,
        message: `minPercentage cannot be greater than maxPercentage for grade "${grade.grade}"`
      });
    }
  }

  // If isDefault is true, unset other defaults first
  if (isDefault) {
    await GradeScale.updateMany({ isDefault: true }, { isDefault: false });
  }

  const gradeScale = await GradeScale.create({
    name,
    description: description || '',
    grades,
    isDefault: isDefault || false,
    createdBy: req.user._id
  });

  const populated = await GradeScale.findById(gradeScale._id).populate('createdBy', 'name email');

  res.status(201).json({
    success: true,
    data: populated,
    message: 'Grade scale created successfully'
  });
});

/**
 * @desc    Update grade scale
 * @route   PUT /api/grade-scales/:id
 * @access  Private (Admin, Owner)
 */
export const updateGradeScale = asyncHandler(async (req, res) => {
  const { name, description, grades, isDefault } = req.body;

  const gradeScale = await GradeScale.findById(req.params.id);
  if (!gradeScale) {
    return res.status(404).json({
      success: false,
      message: 'Grade scale not found'
    });
  }

  if (grades && Array.isArray(grades)) {
    for (const grade of grades) {
      if (!grade.grade || grade.minPercentage === undefined || grade.maxPercentage === undefined || grade.gradePoint === undefined || !grade.remark) {
        return res.status(400).json({
          success: false,
          message: `Each grade must have: grade, minPercentage, maxPercentage, gradePoint, and remark`
        });
      }
      if (grade.minPercentage > grade.maxPercentage) {
        return res.status(400).json({
          success: false,
          message: `minPercentage cannot be greater than maxPercentage for grade "${grade.grade}"`
        });
      }
    }
    gradeScale.grades = grades;
  }

  if (name !== undefined) gradeScale.name = name;
  if (description !== undefined) gradeScale.description = description;
  if (isDefault !== undefined) {
    gradeScale.isDefault = isDefault;
    if (isDefault) {
      await GradeScale.updateMany({ isDefault: true, _id: { $ne: gradeScale._id } }, { isDefault: false });
    }
  }

  await gradeScale.save();

  const populated = await GradeScale.findById(gradeScale._id).populate('createdBy', 'name email');

  res.json({
    success: true,
    data: populated,
    message: 'Grade scale updated successfully'
  });
});

/**
 * @desc    Delete grade scale
 * @route   DELETE /api/grade-scales/:id
 * @access  Private (Admin, Owner)
 */
export const deleteGradeScale = asyncHandler(async (req, res) => {
  const gradeScale = await GradeScale.findById(req.params.id);
  if (!gradeScale) {
    return res.status(404).json({
      success: false,
      message: 'Grade scale not found'
    });
  }

  await gradeScale.deleteOne();

  res.json({
    success: true,
    message: 'Grade scale deleted successfully'
  });
});

export default {
  getGradeScales,
  getGradeScale,
  createGradeScale,
  updateGradeScale,
  deleteGradeScale
};
