import express from 'express';
import {
  createCertificate,
  getCertificates,
  getCertificateById,
  verifyCertificate,
  approveCertificate,
  rejectCertificate,
  updateCertificate,
  deleteCertificate,
  cancelCertificate,
  getCertificateStats,
  getTemplates,
  bulkIssueCertificates
} from '../controllers/certificateController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';

const router = express.Router();

// All routes require authentication except verify
// Verify route is public for QR code scanning
router.get('/verify/:certificateId', verifyCertificate);

// Apply authentication for all other routes
router.use(protect);

/**
 * @route   POST /api/certificates
 * @desc    Create a new certificate
 * @access  Admin, Teacher
 */
router.post('/', authorize('admin', 'owner', 'teacher'), createCertificate);

/**
 * @route   POST /api/certificates/bulk
 * @desc    Bulk issue certificates
 * @access  Admin
 */
router.post('/bulk', authorize('admin', 'owner'), bulkIssueCertificates);

/**
 * @route   GET /api/certificates/stats
 * @desc    Get certificate statistics
 * @access  Admin, Teacher
 */
router.get('/stats', authorize('admin', 'owner', 'teacher'), getCertificateStats);

/**
 * @route   GET /api/certificates/templates
 * @desc    Get certificate templates
 * @access  All authenticated users
 */
router.get('/templates', getTemplates);

/**
 * @route   GET /api/certificates
 * @desc    Get all certificates with filters
 * @access  Admin, Teacher
 */
router.get('/', authorize('admin', 'owner', 'teacher'), getCertificates);

/**
 * @route   GET /api/certificates/:id
 * @desc    Get certificate by ID
 * @access  Admin, Teacher, Student (own)
 */
router.get('/:id', getCertificateById);

/**
 * @route   PUT /api/certificates/:id
 * @desc    Update certificate
 * @access  Admin, Teacher
 */
router.put('/:id', authorize('admin', 'owner', 'teacher'), updateCertificate);

/**
 * @route   PUT /api/certificates/:id/approve
 * @desc    Approve a certificate
 * @access  Admin, Teacher
 */
router.put('/:id/approve', authorize('admin', 'owner', 'teacher'), approveCertificate);

/**
 * @route   PUT /api/certificates/:id/reject
 * @desc    Reject a certificate
 * @access  Admin, Teacher
 */
router.put('/:id/reject', authorize('admin', 'owner', 'teacher'), rejectCertificate);

/**
 * @route   PUT /api/certificates/:id/cancel
 * @desc    Cancel a certificate
 * @access  Admin
 */
router.put('/:id/cancel', authorize('admin', 'owner'), cancelCertificate);

/**
 * @route   DELETE /api/certificates/:id
 * @desc    Delete a certificate
 * @access  Admin
 */
router.delete('/:id', authorize('admin', 'owner'), deleteCertificate);

export default router;
