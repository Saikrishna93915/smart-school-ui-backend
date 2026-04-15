/**
 * PASSWORD GENERATOR UTILITY
 * Generates default passwords based on user role from database configuration
 */

import { getDefaultPassword } from '../services/configService.js';

/**
 * Generate default password for a user
 * Format: Retrieved from database configuration
 */
export const generateDefaultPassword = async (role, sequenceNumber = 1) => {
  // DYNAMIC: Fetch from database instead of hardcoded
  const password = await getDefaultPassword(role.toLowerCase());
  
  return password || `${role.charAt(0).toUpperCase() + role.slice(1)}@123`; // Fallback if not configured
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
export const isDefaultPassword = async (password, role) => {
  // DYNAMIC: Fetch from database instead of hardcoded
  const defaultPwd = await getDefaultPassword(role.toLowerCase());
  
  if (!defaultPwd) return false;
  return password === defaultPwd;
};

export default {
  generateDefaultPassword,
  getNextSequenceNumber,
  isDefaultPassword
};
