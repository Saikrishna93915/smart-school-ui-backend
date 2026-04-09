/**
 * PASSWORD GENERATOR UTILITY
 * Generates default passwords based on user role and sequential counter
 */

/**
 * Generate default password for a user
 * Format:
 * - Teacher: Teacher@123
 * - Parent: Parent@123
 * - Student: Student@123
 * - Owner: Owner@123
 * - Admin: Admin@123
 */
export const generateDefaultPassword = (role, sequenceNumber = 1) => {
  const defaultPasswords = {
    teacher: 'Teacher@123',
    parent: 'Parent@123',
    student: 'Student@123',
    owner: 'Owner@123',
    admin: 'Admin@123',
    cashier: 'Cashier@123',
    principal: 'Principal@123',
    driver: 'Driver@123'
  };

  return defaultPasswords[role.toLowerCase()] || `${role.charAt(0).toUpperCase() + role.slice(1)}@123`;
};

/**
 * Get the next sequence number for a role
 * This should be called before creating a user to get the next available number
 */
export const getNextSequenceNumber = async (User, role) => {
  try {
    const rolePrefixes = {
      teacher: 'T',
      parent: 'P',
      student: 'S',
      owner: 'O',
      admin: 'A',
      cashier: 'C',
      principal: 'PR',
      driver: 'D'
    };

    const prefix = rolePrefixes[role.toLowerCase()] || 'U';
    
    // Count existing users with this role
    const count = await User.countDocuments({ role: role.toLowerCase() });
    
    return count + 1;
  } catch (error) {
    console.error('Error getting next sequence number:', error);
    return 1;
  }
};

/**
 * Verify if a password is a default password for a role
 */
export const isDefaultPassword = (password, role) => {
  const defaultPasswords = {
    teacher: 'Teacher@123',
    parent: 'Parent@123',
    student: 'Student@123',
    owner: 'Owner@123',
    admin: 'Admin@123',
    cashier: 'Cashier@123',
    principal: 'Principal@123',
    driver: 'Driver@123'
  };

  const expectedPassword = defaultPasswords[role.toLowerCase()] || `${role.charAt(0).toUpperCase() + role.slice(1)}@123`;
  return password === expectedPassword;
};

export default {
  generateDefaultPassword,
  getNextSequenceNumber,
  isDefaultPassword
};
