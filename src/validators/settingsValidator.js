/**
 * SETTINGS VALIDATION SCHEMAS
 * Input validation using custom validator (Zod-like pattern)
 */

const validateSchoolProfile = (data) => {
  const errors = [];

  // Required fields
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 3) {
    errors.push({ field: 'name', message: 'School name must be at least 3 characters' });
  }

  if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) {
    errors.push({ field: 'email', message: 'Valid email is required' });
  }

  if (!data.phone || data.phone.trim().length < 10) {
    errors.push({ field: 'phone', message: 'Valid phone number is required' });
  }

  // Optional fields with validation
  if (data.website && !/^https?:\/\/.+/.test(data.website)) {
    errors.push({ field: 'website', message: 'Website must be a valid URL' });
  }

  if (data.establishedYear && (data.establishedYear < 1800 || data.establishedYear > new Date().getFullYear())) {
    errors.push({ field: 'establishedYear', message: 'Invalid established year' });
  }

  if (data.board && !['CBSE', 'ICSE', 'State', 'IB', 'IGCSE', 'NIOS', 'Other'].includes(data.board)) {
    errors.push({ field: 'board', message: 'Invalid board selection' });
  }

  if (data.medium && !['English', 'Hindi', 'Both', 'Regional'].includes(data.medium)) {
    errors.push({ field: 'medium', message: 'Invalid medium selection' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateAcademicSettings = (data) => {
  const errors = [];

  if (!data.year || !/^\d{4}-\d{4}$/.test(data.year)) {
    errors.push({ field: 'year', message: 'Academic year must be in format YYYY-YYYY' });
  }

  if (!data.startDate || isNaN(Date.parse(data.startDate))) {
    errors.push({ field: 'startDate', message: 'Valid start date is required' });
  }

  if (!data.endDate || isNaN(Date.parse(data.endDate))) {
    errors.push({ field: 'endDate', message: 'Valid end date is required' });
  }

  if (data.startDate && data.endDate && new Date(data.startDate) >= new Date(data.endDate)) {
    errors.push({ field: 'dates', message: 'Start date must be before end date' });
  }

  if (data.terms && (!Array.isArray(data.terms) || data.terms.length === 0)) {
    errors.push({ field: 'terms', message: 'At least one term is required' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateSecuritySettings = (data) => {
  const errors = [];

  if (data.authentication) {
    if (data.authentication.sessionTimeout !== undefined) {
      const timeout = Number(data.authentication.sessionTimeout);
      if (isNaN(timeout) || timeout < 5 || timeout > 1440) {
        errors.push({ field: 'sessionTimeout', message: 'Session timeout must be between 5 and 1440 minutes' });
      }
    }

    if (data.authentication.twoFactorMethod && 
        !['email', 'sms', 'authenticator', 'none'].includes(data.authentication.twoFactorMethod)) {
      errors.push({ field: 'twoFactorMethod', message: 'Invalid two-factor method' });
    }
  }

  if (data.passwordPolicy) {
    if (data.passwordPolicy.minLength !== undefined) {
      const minLength = Number(data.passwordPolicy.minLength);
      if (isNaN(minLength) || minLength < 6 || minLength > 32) {
        errors.push({ field: 'minLength', message: 'Password minimum length must be between 6 and 32' });
      }
    }

    if (data.passwordPolicy.expiryDays !== undefined) {
      const expiryDays = Number(data.passwordPolicy.expiryDays);
      if (isNaN(expiryDays) || expiryDays < 0 || expiryDays > 365) {
        errors.push({ field: 'expiryDays', message: 'Password expiry must be between 0 and 365 days' });
      }
    }
  }

  if (data.loginSecurity) {
    if (data.loginSecurity.maxFailedAttempts !== undefined) {
      const attempts = Number(data.loginSecurity.maxFailedAttempts);
      if (isNaN(attempts) || attempts < 1 || attempts > 10) {
        errors.push({ field: 'maxFailedAttempts', message: 'Max failed attempts must be between 1 and 10' });
      }
    }

    if (data.loginSecurity.ipWhitelist && !Array.isArray(data.loginSecurity.ipWhitelist)) {
      errors.push({ field: 'ipWhitelist', message: 'IP whitelist must be an array' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateNotificationSettings = (data) => {
  const errors = [];

  if (!Array.isArray(data)) {
    errors.push({ field: 'notifications', message: 'Notifications must be an array' });
    return { isValid: false, errors };
  }

  data.forEach((notification, index) => {
    if (!notification.name || typeof notification.name !== 'string') {
      errors.push({ field: `notifications[${index}].name`, message: 'Notification name is required' });
    }

    if (!notification.channels || !Array.isArray(notification.channels) || notification.channels.length === 0) {
      errors.push({ field: `notifications[${index}].channels`, message: 'At least one channel is required' });
    }

    if (notification.channels) {
      const validChannels = ['email', 'sms', 'whatsapp', 'push', 'in_app', 'voice'];
      const invalidChannels = notification.channels.filter(ch => !validChannels.includes(ch));
      if (invalidChannels.length > 0) {
        errors.push({ 
          field: `notifications[${index}].channels`, 
          message: `Invalid channels: ${invalidChannels.join(', ')}` 
        });
      }
    }

    if (notification.enabled !== undefined && typeof notification.enabled !== 'boolean') {
      errors.push({ field: `notifications[${index}].enabled`, message: 'Enabled must be a boolean' });
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

export {
  validateSchoolProfile,
  validateAcademicSettings,
  validateSecuritySettings,
  validateNotificationSettings
};
