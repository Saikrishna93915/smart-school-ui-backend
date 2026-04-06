/**
 * User Management Routes
 * Routes for admin to manage teachers, parents, owners, and students
 */

import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  resetUserPasswordToDefault,
  deactivateUser,
  deleteUser,
  getUserStats,
  bulkCreateUsers
} from '../controllers/userManagementController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';

const router = express.Router();

// Apply authentication and authorization to all routes
router.use(protect);
router.use(authorize('admin', 'owner'));

/**
 * GET: User stats
 */
router.get('/stats', getUserStats);

/**
 * GET: All users by role
 * Query: ?role=teacher&search=john
 */
router.get('/', getAllUsers);

/**
 * GET: User by ID
 */
router.get('/:id', getUserById);

/**
 * POST: Create new user
 * Body: { name, email, phone, role, linkedId? }
 */
router.post('/', createUser);

/**
 * POST: Bulk create users
 * Body: { users: [{ name, email, phone, role }] }
 */
router.post('/bulk/import', bulkCreateUsers);

/**
 * PUT: Update user details
 * Body: { name?, email?, phone?, active? }
 */
router.put('/:id', updateUser);

/**
 * PUT: Reset user password to default
 */
router.put('/:id/reset-password', resetUserPasswordToDefault);

/**
 * DELETE: Deactivate user (soft delete)
 */
router.delete('/:id/deactivate', deactivateUser);

/**
 * DELETE: Permanently delete user
 */
router.delete('/:id', authorize('admin'), deleteUser); // Only admin can permanently delete

export default router;
