import User from '../models/User.js'; // Assuming the User model exports correctly

/**
 * Creates a new user entry in the database.
 * @param {object} userData - User data (name, email, passwordHash, role, phone).
 * @returns {Promise<User>}
 */
const createUser = async (userData) => {
  // Mongoose middleware handles password hashing when 'passwordHash' is set.
  const user = await User.create(userData);
  return user.toObject({ getters: true, virtuals: false });
};

/**
 * Retrieves a paginated list of users, optionally filtered by role and active status.
 * @param {object} filters - Query filters (role, active).
 * @param {number} page - Current page number.
 * @param {number} limit - Items per page.
 * @returns {Promise<{users: User[], totalCount: number, page: number, limit: number}>}
 */
const getUsersPaginated = async (filters, page, limit) => {
  const skip = (page - 1) * limit;

  const [users, totalCount] = await Promise.all([
    User.find(filters)
      .select('-passwordHash -refreshTokens') // Exclude sensitive fields
      .limit(limit)
      .skip(skip)
      .lean(),
    User.countDocuments(filters),
  ]);

  return { users, totalCount, page, limit };
};

/**
 * Finds a user by ID and updates specific fields.
 * @param {string} userId - ID of the user to update.
 * @param {object} updateData - Data to update.
 * @returns {Promise<User>}
 */
const updateUserById = async (userId, updateData) => {
  const user = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  ).select('-passwordHash -refreshTokens');
  return user;
};

/**
 * Performs a soft delete by setting the user's active status to false.
 * @param {string} userId - ID of the user to soft-delete.
 * @returns {Promise<User>}
 */
const softDeleteUser = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { active: false },
    { new: true }
  ).select('-passwordHash -refreshTokens');
  return user;
};

/**
 * Finds a user by ID.
 * @param {string} userId - ID of the user.
 * @returns {Promise<User>}
 */
const findUserById = async (userId) => {
    return await User.findById(userId).select('-passwordHash -refreshTokens');
};

export {
  createUser,
  getUsersPaginated,
  updateUserById,
  softDeleteUser,
  findUserById
};