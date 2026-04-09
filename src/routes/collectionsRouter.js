// src/routes/collectionsRouter.js
import express from 'express';
import {
  getCollections,
  getCollectionDetails,
  updateCollectionStatus,
  exportCollections,
  getCollectionsStatistics,
  getCollectionClasses,
  downloadReceipt
} from '../controllers/collectionsController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Collections routes
router.route('/')
  .get(protect, authorize('admin', 'finance', 'cashier', 'accountant', 'owner', 'principal'), getCollections);

router.route('/export')
  .get(protect, authorize('admin', 'finance', 'cashier', 'accountant', 'owner', 'principal'), exportCollections);

router.route('/statistics')
  .get(protect, authorize('admin', 'finance', 'cashier', 'accountant', 'owner', 'principal'), getCollectionsStatistics);

// CRITICAL: Get unique class names - MUST be before /:receiptNumber route
router.route('/classes')
  .get(protect, authorize('admin', 'finance', 'cashier', 'accountant', 'owner', 'principal'), getCollectionClasses);

router.route('/:receiptNumber')
  .get(protect, authorize('admin', 'finance', 'cashier', 'accountant', 'owner', 'principal'), getCollectionDetails);

router.route('/:receiptNumber/status')
  .put(protect, authorize('admin', 'finance', 'cashier', 'accountant', 'owner'), updateCollectionStatus);

router.route('/:receiptNumber/receipt')
  .get(protect, authorize('admin', 'finance', 'cashier', 'accountant', 'owner', 'principal'), downloadReceipt);

export default router;