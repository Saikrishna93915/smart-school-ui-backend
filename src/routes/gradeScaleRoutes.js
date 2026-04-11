import express from 'express';
import {
  getGradeScales,
  getGradeScale,
  createGradeScale,
  updateGradeScale,
  deleteGradeScale
} from '../controllers/gradeScaleController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All grade scale routes require authentication
router.use(protect);

// Public read access for all authenticated users
router.get('/', getGradeScales);
router.get('/:id', getGradeScale);

// Only admin/owner can create, update, delete
router.post('/', authorize('admin', 'owner'), createGradeScale);
router.put('/:id', authorize('admin', 'owner'), updateGradeScale);
router.delete('/:id', authorize('admin', 'owner'), deleteGradeScale);

export default router;
