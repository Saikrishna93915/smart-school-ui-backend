/**
 * SETTINGS SERVICE
 * Business logic layer for settings management
 */

import settingsRepository from '../repositories/settingsRepository.js';
import { NotFoundError, ValidationError } from '../utils/ApiError.js';
import os from 'os';
import User from '../models/User.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';

class SettingsService {
  // ==================== DEFAULTS ====================
  
  #defaultSchool = {
    name: 'Silver Sand International School',
    code: 'SSIS-2024-001',
    email: 'info@silversand.edu',
    phone: '+91 11 2654 9876',
    address: {
      street: '123 Knowledge Park, Sector 62',
      city: 'Noida',
      state: 'Uttar Pradesh',
      country: 'India',
      pincode: '201309'
    },
    website: 'https://silversand.edu',
    motto: 'Excellence Through Innovation',
    establishedYear: 2005,
    principal: { name: 'Dr. Ramesh Kumar' },
    board: 'CBSE',
    medium: 'English',
    statistics: {
      totalStudents: 1248,
      totalStaff: 45,
      totalClasses: 36,
      totalSections: 48,
      totalSubjects: 18
    }
  };

  #defaultAcademicYear = (schoolId) => ({
    schoolId,
    year: '2024-2025',
    name: 'Academic Year 2024-2025',
    startDate: new Date('2024-04-01'),
    endDate: new Date('2025-03-31'),
    isCurrent: true,
    terms: [
      { name: 'Term 1', number: 1, startDate: new Date('2024-04-01'), endDate: new Date('2024-09-30'), status: 'active' },
      { name: 'Term 2', number: 2, startDate: new Date('2024-10-01'), endDate: new Date('2025-03-31'), status: 'upcoming' }
    ],
    sessions: [
      { name: 'April-September', type: 'regular', startDate: new Date('2024-04-01'), endDate: new Date('2024-09-30') },
      { name: 'October-March', type: 'regular', startDate: new Date('2024-10-01'), endDate: new Date('2025-03-31') }
    ],
    gradingSystem: { type: 'percentage', passingPercentage: 33, maxMarks: 100 },
    timetable: { classDuration: 45, periodsPerDay: 8 },
    status: 'active'
  });

  #defaultNotifications = [
    { name: 'Attendance Alerts', channels: ['email', 'sms', 'whatsapp'], enabled: true },
    { name: 'Fee Reminders', channels: ['email', 'sms'], enabled: true },
    { name: 'Exam Notifications', channels: ['email', 'whatsapp'], enabled: true },
    { name: 'AI Insights', channels: ['email'], enabled: true },
    { name: 'Emergency Alerts', channels: ['sms', 'whatsapp', 'voice'], enabled: true }
  ];

  // ==================== GET OR CREATE HELPERS ====================
  
  async getOrCreateSchool() {
    let school = await settingsRepository.getSchoolProfile();
    if (!school) {
      school = await settingsRepository.createSchoolProfile(this.#defaultSchool);
    }
    return school;
  }

  async getOrCreateAcademicYear(schoolId) {
    let academic = await settingsRepository.getCurrentAcademicYear(schoolId);
    if (!academic) {
      academic = await settingsRepository.createAcademicYear(this.#defaultAcademicYear(schoolId));
    }
    return academic;
  }

  // ==================== GET ALL SETTINGS ====================
  
  async getAllSettings(schoolId = null) {
    const school = await this.getOrCreateSchool();
    const effectiveSchoolId = schoolId || school._id;

    const [academic, notifications, security, billing, advanced, health] = await Promise.all([
      this.getOrCreateAcademicYear(effectiveSchoolId),
      settingsRepository.getNotificationSettings(effectiveSchoolId).catch(() => this.#defaultNotifications),
      settingsRepository.getSecuritySettings(effectiveSchoolId).catch(() => null),
      settingsRepository.getBillingPlan(effectiveSchoolId).catch(() => null),
      settingsRepository.getAdvancedSettings(effectiveSchoolId).catch(() => {}),
      settingsRepository.getSystemHealth(effectiveSchoolId).catch(() => null)
    ]);

    return {
      school,
      academic,
      notifications: notifications || this.#defaultNotifications,
      security: security || this.#getDefaultSecurity(),
      billing: billing || this.#getDefaultBilling(),
      advanced: advanced || {},
      systemHealth: this.#formatSystemHealth(health)
    };
  }

  // ==================== GET BY CATEGORY ====================
  
  async getSettingsByCategory(category, schoolId = null) {
    const school = await this.getOrCreateSchool();
    const effectiveSchoolId = schoolId || school._id;

    switch (category.toLowerCase()) {
      case 'school':
        return school;
      
      case 'academic':
        return await this.getOrCreateAcademicYear(effectiveSchoolId);
      
      case 'notifications':
        const notifications = await settingsRepository.getNotificationSettings(effectiveSchoolId);
        return notifications || this.#defaultNotifications;
      
      case 'security':
        const security = await settingsRepository.getSecuritySettings(effectiveSchoolId);
        return security || this.#getDefaultSecurity();
      
      case 'billing':
        const billing = await settingsRepository.getBillingPlan(effectiveSchoolId);
        return billing || this.#getDefaultBilling();
      
      case 'advanced':
        const advanced = await settingsRepository.getAdvancedSettings(effectiveSchoolId);
        return advanced || {};
      
      case 'health':
        const health = await settingsRepository.getSystemHealth(effectiveSchoolId);
        return await this.#formatSystemHealth(health);
      
      default:
        throw new ValidationError('Invalid category');
    }
  }

  // ==================== UPDATE METHODS ====================
  
  async updateSchoolProfile(data, schoolId = null) {
    const school = await this.getOrCreateSchool();
    const effectiveSchoolId = schoolId || school._id;
    
    return await settingsRepository.updateSchoolProfile(effectiveSchoolId, data);
  }

  async updateAcademicSettings(data, schoolId = null) {
    const school = await this.getOrCreateSchool();
    const effectiveSchoolId = schoolId || school._id;
    
    const current = await this.getOrCreateAcademicYear(effectiveSchoolId);
    return await settingsRepository.updateAcademicYear(current._id, data);
  }

  async updateNotificationSettings(data, schoolId = null) {
    const school = await this.getOrCreateSchool();
    const effectiveSchoolId = schoolId || school._id;
    
    return await settingsRepository.upsertNotificationSettings(effectiveSchoolId, data);
  }

  async updateSecuritySettings(data, schoolId = null) {
    const school = await this.getOrCreateSchool();
    const effectiveSchoolId = schoolId || school._id;
    
    return await settingsRepository.upsertSecuritySettings(effectiveSchoolId, data);
  }

  async updateBillingSettings(data, schoolId = null) {
    const school = await this.getOrCreateSchool();
    const effectiveSchoolId = schoolId || school._id;
    
    return await settingsRepository.upsertBillingPlan(effectiveSchoolId, data);
  }

  async updateAdvancedSettings(data, schoolId = null) {
    const school = await this.getOrCreateSchool();
    const effectiveSchoolId = schoolId || school._id;
    
    return await settingsRepository.upsertAdvancedSettings(effectiveSchoolId, data);
  }

  // ==================== SYSTEM HEALTH ====================
  
  async captureSystemHealthSnapshot(schoolId) {
    const totalMemory = os.totalmem() / (1024 ** 3);
    const freeMemory = os.freemem() / (1024 ** 3);
    const usedMemory = totalMemory - freeMemory;
    
    const healthData = {
      schoolId,
      timestamp: new Date(),
      uptime: ((process.uptime() / (24 * 60 * 60)) * 100).toFixed(2),
      responseTime: {
        average: 128,
        p95: 180,
        p99: 250,
        max: 500
      },
      resources: {
        cpu: {
          usage: Math.random() * 40 + 20,
          cores: os.cpus().length
        },
        memory: {
          total: Math.round(totalMemory),
          used: Math.round(usedMemory),
          free: Math.round(freeMemory),
          usage: Math.round((usedMemory / totalMemory) * 100)
        },
        storage: {
          usage: 45
        }
      },
      users: {
        active: 142,
        total: 1500,
        concurrent: 98
      }
    };

    return await settingsRepository.createSystemHealthSnapshot(healthData);
  }

  // ==================== PRIVATE HELPERS ====================
  
  #getDefaultSecurity() {
    return {
      authentication: {
        twoFactorEnabled: false,
        twoFactorMethod: 'none',
        sessionTimeout: 30
      },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        expiryDays: 90
      },
      loginSecurity: {
        maxFailedAttempts: 3,
        lockoutDuration: 15,
        ipWhitelist: []
      },
      apiSecurity: {
        rateLimit: { requests: 100, perMinutes: 1 },
        allowedOrigins: ['https://silversand.edu']
      }
    };
  }

  #getDefaultBilling() {
    return {
      currentPlan: {
        name: 'enterprise',
        displayName: 'Enterprise Plan',
        price: { amount: 24999, currency: 'INR', period: 'monthly' },
        status: 'active'
      },
      limits: {
        students: { max: 5000, current: 1248 },
        staff: { max: 200, current: 45 },
        storage: { max: 500, used: 250 }
      }
    };
  }

  async #formatSystemHealth(health) {
    // Get real counts from database
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ active: true });
    const totalStudents = await Student.countDocuments();
    const totalTeachers = await Teacher.countDocuments();

    // Calculate real system metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = ((usedMemory / totalMemory) * 100).toFixed(1);

    // CPU load average (last 1 minute) - convert to percentage
    const cpuLoad = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const cpuUsage = ((cpuLoad / cpuCount) * 100).toFixed(1);

    // System uptime
    const uptimeSeconds = os.uptime();
    const uptimeDays = (uptimeSeconds / 86400).toFixed(2);
    const uptime = uptimeDays >= 1 ? `${uptimeDays} days` : `${(uptimeSeconds / 3600).toFixed(1)} hours`;

    if (!health) {
      return {
        uptime: uptime,
        responseTime: '128ms',
        storage: '45%',
        memory: `${memoryUsage}%`,
        cpu: `${cpuUsage}%`,
        activeUsers: activeUsers,
        totalUsers: totalUsers,
        totalStudents: totalStudents,
        totalTeachers: totalTeachers
      };
    }

    return {
      uptime: health.uptime || uptime,
      responseTime: `${health.responseTime?.average || 128}ms`,
      storage: `${health.resources?.storage?.usage || 45}%`,
      memory: `${memoryUsage}%`,
      cpu: `${cpuUsage}%`,
      activeUsers: activeUsers,
      totalUsers: totalUsers,
      totalStudents: totalStudents,
      totalTeachers: totalTeachers
    };
  }
}

export default new SettingsService();
