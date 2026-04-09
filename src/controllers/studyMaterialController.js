import StudyMaterial from '../models/StudyMaterial.js';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Upload study material
 * @route   POST /api/teacher/materials
 * @access  Private (Teacher)
 */
export const uploadStudyMaterial = asyncHandler(async (req, res) => {
  const {
    classId,
    sectionId,
    subjectId,
    title,
    description,
    chapterName,
    topicName,
    materialType,
    fileUrl,
    fileName,
    thumbnailUrl,
    duration,
    difficulty,
    tags,
    learningOutcomes
  } = req.body;

  // Validation
  if (!classId || !sectionId || !subjectId || !title || !materialType || !fileUrl) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields'
    });
  }

  const material = await StudyMaterial.create({
    classId,
    sectionId,
    subjectId,
    teacherId: req.user._id,
    title,
    description,
    chapterName,
    topicName,
    materialType,
    fileUrl,
    fileName,
    thumbnailUrl,
    duration,
    difficulty,
    tags: tags || [],
    learningOutcomes: learningOutcomes || [],
    status: 'published'
  });

  res.status(201).json({
    success: true,
    message: 'Study material uploaded successfully',
    data: material
  });
});

/**
 * @desc    Get materials for a class
 * @route   GET /api/teacher/materials/:classId
 * @access  Private (Teacher)
 */
export const getMaterialsByClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { materialType, subjectId } = req.query;
  const teacherId = req.user._id;

  let query = {
    classId,
    teacherId,
    status: 'published'
  };

  if (materialType) query.materialType = materialType;
  if (subjectId) query.subjectId = subjectId;

  const materials = await StudyMaterial.find(query)
    .populate('subjectId', 'subjectName subjectCode')
    .sort({ uploadedDate: -1 });

  res.status(200).json({
    success: true,
    count: materials.length,
    data: materials
  });
});

/**
 * @desc    Get a specific material
 * @route   GET /api/teacher/materials/:id
 * @access  Private (Teacher/Student)
 */
export const getMaterialById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const material = await StudyMaterial.findByIdAndUpdate(
    id,
    {
      $inc: { views: 1 }
    },
    { new: true }
  ).populate('teacherId', 'name email personal.firstName personal.lastName');

  if (!material) {
    return res.status(404).json({
      success: false,
      message: 'Material not found'
    });
  }

  res.status(200).json({
    success: true,
    data: material
  });
});

/**
 * @desc    Update study material
 * @route   PUT /api/teacher/materials/:id
 * @access  Private (Teacher)
 */
export const updateStudyMaterial = asyncHandler(async (req, res) => {
  let material = await StudyMaterial.findOne({
    _id: req.params.id,
    teacherId: req.user._id
  });

  if (!material) {
    return res.status(404).json({
      success: false,
      message: 'Material not found'
    });
  }

  material = await StudyMaterial.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    message: 'Material updated successfully',
    data: material
  });
});

/**
 * @desc    Delete study material
 * @route   DELETE /api/teacher/materials/:id
 * @access  Private (Teacher)
 */
export const deleteStudyMaterial = asyncHandler(async (req, res) => {
  const material = await StudyMaterial.findOneAndDelete({
    _id: req.params.id,
    teacherId: req.user._id
  });

  if (!material) {
    return res.status(404).json({
      success: false,
      message: 'Material not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Material deleted successfully'
  });
});

/**
 * @desc    Get materials by type (PDF, Video, etc.)
 * @route   GET /api/teacher/materials-by-type/:classId/:materialType
 * @access  Private (Teacher)
 */
export const getMaterialsByType = asyncHandler(async (req, res) => {
  const { classId, materialType } = req.params;
  const teacherId = req.user._id;

  const materials = await StudyMaterial.find({
    classId,
    teacherId,
    materialType,
    status: 'published'
  })
    .select('title description uploadedDate downloads views')
    .sort({ uploadedDate: -1 });

  const stats = {
    totalMaterials: materials.length,
    totalDownloads: materials.reduce((sum, m) => sum + m.downloads, 0),
    totalViews: materials.reduce((sum, m) => sum + m.views, 0)
  };

  res.status(200).json({
    success: true,
    data: {
      materials,
      statistics: stats
    }
  });
});

/**
 * @desc    Track material download
 * @route   PUT /api/teacher/materials/:id/download
 * @access  Private
 */
export const trackMaterialDownload = asyncHandler(async (req, res) => {
  const material = await StudyMaterial.findByIdAndUpdate(
    req.params.id,
    {
      $inc: { downloads: 1 }
    },
    { new: true }
  );

  if (!material) {
    return res.status(404).json({
      success: false,
      message: 'Material not found'
    });
  }

  res.status(200).json({
    success: true,
    data: material
  });
});

/**
 * @desc    Get materials library summary
 * @route   GET /api/teacher/materials-summary/:classId
 * @access  Private (Teacher)
 */
export const getMaterialsSummary = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const teacherId = req.user._id;

  const materials = await StudyMaterial.find({
    classId,
    teacherId,
    status: 'published'
  });

  const summary = {
    total: materials.length,
    byType: {
      pdf: materials.filter(m => m.materialType === 'pdf').length,
      video: materials.filter(m => m.materialType === 'video').length,
      document: materials.filter(m => m.materialType === 'document').length,
      worksheet: materials.filter(m => m.materialType === 'worksheet').length,
      presentation: materials.filter(m => m.materialType === 'presentation').length,
      image: materials.filter(m => m.materialType === 'image').length,
      audio: materials.filter(m => m.materialType === 'audio').length
    },
    byDifficulty: {
      easy: materials.filter(m => m.difficulty === 'easy').length,
      medium: materials.filter(m => m.difficulty === 'medium').length,
      hard: materials.filter(m => m.difficulty === 'hard').length
    },
    totalDownloads: materials.reduce((sum, m) => sum + m.downloads, 0),
    totalViews: materials.reduce((sum, m) => sum + m.views, 0),
    topMaterials: materials
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 5)
      .map(m => ({
        _id: m._id,
        title: m.title,
        downloads: m.downloads,
        views: m.views
      }))
  };

  res.status(200).json({
    success: true,
    data: summary
  });
});

export default {
  uploadStudyMaterial,
  getMaterialsByClass,
  getMaterialById,
  updateStudyMaterial,
  deleteStudyMaterial,
  getMaterialsByType,
  trackMaterialDownload,
  getMaterialsSummary
};
