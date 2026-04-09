/**
 * SETTINGS REPOSITORY
 * Data access layer for settings-related operations
 */

import School from '../models/School.js';
import AcademicYear from '../models/AcademicYear.js';
import SecuritySetting from '../models/SecuritySetting.js';
import BillingPlan from '../models/BillingPlan.js';
import Setting from '../models/Setting.js';
import SystemHealth from '../models/SystemHealth.js';
import { DatabaseError, NotFoundError } from '../utils/ApiError.js';

class SettingsRepository {
  // ==================== SCHOOL PROFILE ====================
  
  async getSchoolProfile(schoolId = null) {
    try {
      const query = schoolId ? { _id: schoolId } : {};
      const school = await School.findOne(query).lean();
      return school;
    } catch (error) {
      throw new DatabaseError(`Failed to fetch school profile: ${error.message}`);
    }
  }

  async createSchoolProfile(data) {
    try {
      const school = await School.create(data);
      return school.toObject();
    } catch (error) {
      throw new DatabaseError(`Failed to create school profile: ${error.message}`);
    }
  }

  async updateSchoolProfile(schoolId, data) {
    try {
      const school = await School.findByIdAndUpdate(
        schoolId,
        { $set: data },
        { new: true, runValidators: true }
      ).lean();
      
      if (!school) {
        throw new NotFoundError('School profile');
      }
      
      return school;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError(`Failed to update school profile: ${error.message}`);
    }
  }

  // ==================== ACADEMIC SETTINGS ====================
  
  async getCurrentAcademicYear(schoolId) {
    try {
      const academicYear = await AcademicYear.findOne({
        schoolId,
        isCurrent: true
      }).lean();
      
      return academicYear;
    } catch (error) {
      throw new DatabaseError(`Failed to fetch academic year: ${error.message}`);
    }
  }

  async createAcademicYear(data) {
    try {
      const academicYear = await AcademicYear.create(data);
      return academicYear.toObject();
    } catch (error) {
      throw new DatabaseError(`Failed to create academic year: ${error.message}`);
    }
  }

  async updateAcademicYear(academicYearId, data) {
    try {
      const academicYear = await AcademicYear.findByIdAndUpdate(
        academicYearId,
        { $set: data },
        { new: true, runValidators: true }
      ).lean();
      
      if (!academicYear) {
        throw new NotFoundError('Academic year');
      }
      
      return academicYear;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError(`Failed to update academic year: ${error.message}`);
    }
  }

  // ==================== SECURITY SETTINGS ====================
  
  async getSecuritySettings(schoolId) {
    try {
      const security = await SecuritySetting.findOne({ schoolId })
        .select('-apiSecurity.apiKeyHash')
        .lean();
      
      return security;
    } catch (error) {
      throw new DatabaseError(`Failed to fetch security settings: ${error.message}`);
    }
  }

  async upsertSecuritySettings(schoolId, data) {
    try {
      const security = await SecuritySetting.findOneAndUpdate(
        { schoolId },
        { $set: { ...data, schoolId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).select('-apiSecurity.apiKeyHash').lean();
      
      return security;
    } catch (error) {
      throw new DatabaseError(`Failed to update security settings: ${error.message}`);
    }
  }

  // ==================== BILLING SETTINGS ====================
  
  async getBillingPlan(schoolId) {
    try {
      const billing = await BillingPlan.findOne({ schoolId }).lean();
      return billing;
    } catch (error) {
      throw new DatabaseError(`Failed to fetch billing plan: ${error.message}`);
    }
  }

  async upsertBillingPlan(schoolId, data) {
    try {
      const billing = await BillingPlan.findOneAndUpdate(
        { schoolId },
        { $set: { ...data, schoolId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();
      
      return billing;
    } catch (error) {
      throw new DatabaseError(`Failed to update billing plan: ${error.message}`);
    }
  }

  // ==================== NOTIFICATION SETTINGS ====================
  
  async getNotificationSettings(schoolId) {
    try {
      const notification = await Setting.findOne({
        schoolId,
        type: 'notification',
        key: 'root'
      }).lean();
      
      return notification?.value || null;
    } catch (error) {
      throw new DatabaseError(`Failed to fetch notification settings: ${error.message}`);
    }
  }

  async upsertNotificationSettings(schoolId, data) {
    try {
      const notification = await Setting.findOneAndUpdate(
        { schoolId, type: 'notification', key: 'root' },
        {
          $set: {
            schoolId,
            type: 'notification',
            category: 'communication',
            key: 'root',
            value: data,
            dataType: 'array',
            group: 'general'
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();
      
      return notification.value;
    } catch (error) {
      throw new DatabaseError(`Failed to update notification settings: ${error.message}`);
    }
  }

  // ==================== ADVANCED SETTINGS ====================
  
  async getAdvancedSettings(schoolId) {
    try {
      const advanced = await Setting.findOne({
        schoolId,
        type: 'advanced',
        key: 'root'
      }).lean();
      
      return advanced?.value || null;
    } catch (error) {
      throw new DatabaseError(`Failed to fetch advanced settings: ${error.message}`);
    }
  }

  async upsertAdvancedSettings(schoolId, data) {
    try {
      const advanced = await Setting.findOneAndUpdate(
        { schoolId, type: 'advanced', key: 'root' },
        {
          $set: {
            schoolId,
            type: 'advanced',
            category: 'system',
            key: 'root',
            value: data,
            dataType: 'object',
            group: 'advanced'
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();
      
      return advanced.value;
    } catch (error) {
      throw new DatabaseError(`Failed to update advanced settings: ${error.message}`);
    }
  }

  // ==================== SYSTEM HEALTH ====================
  
  async getSystemHealth(schoolId) {
    try {
      const health = await SystemHealth.findOne({ schoolId })
        .sort({ timestamp: -1 })
        .lean();
      
      return health;
    } catch (error) {
      throw new DatabaseError(`Failed to fetch system health: ${error.message}`);
    }
  }

  async createSystemHealthSnapshot(data) {
    try {
      const health = await SystemHealth.create(data);
      return health.toObject();
    } catch (error) {
      throw new DatabaseError(`Failed to create health snapshot: ${error.message}`);
    }
  }
}

export default new SettingsRepository();
