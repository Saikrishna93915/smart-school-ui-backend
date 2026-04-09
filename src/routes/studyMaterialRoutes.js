import express from 'express';
import {
  uploadStudyMaterial,
  getMaterialsByClass,
  getMaterialById,
  updateStudyMaterial,
  deleteStudyMaterial,
  getMaterialsByType,
  trackMaterialDownload,
  getMaterialsSummary
} from '../controllers/studyMaterialController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/teacher/materials
 * @desc    Upload a study material
 * @access  Private (Teacher)
 */
router.post('/', uploadStudyMaterial);

/**
 * @route   GET /api/teacher/materials/:classId
 * @desc    Get all materials for a class (with optional filters)
 * @access  Private (Teacher)
 * @query   materialType - Filter by material type (pdf, video, document, etc.)
 * @query   subjectId - Filter by subject
 */
router.get('/:classId', getMaterialsByClass);

/**
 * @route   GET /api/teacher/materials-summary/:classId
 * @desc    Get materials library summary with statistics
 * @access  Private (Teacher)
 */
router.get('/:classId/summary', getMaterialsSummary);

/**
 * @route   GET /api/teacher/materials-by-type/:classId/:materialType
 * @desc    Get materials grouped by type with statistics
 * @access  Private (Teacher)
 */
router.get('/:classId/type/:materialType', getMaterialsByType);

/**
 * @route   GET /api/teacher/materials/:id/view
 * @desc    Get a specific material (increments view count)
 * @access  Private
 */
router.get('/:id/view', getMaterialById);

/**
 * @route   PUT /api/teacher/materials/:id
 * @desc    Update a study material
 * @access  Private (Teacher)
 */
router.put('/:id', updateStudyMaterial);

/**
 * @route   PUT /api/teacher/materials/:id/download
 * @desc    Track material download
 * @access  Private
 */
router.put('/:id/download', trackMaterialDownload);

/**
 * @route   DELETE /api/teacher/materials/:id
 * @desc    Delete a study material
 * @access  Private (Teacher)
 */
router.delete('/:id', deleteStudyMaterial);

export default router;
