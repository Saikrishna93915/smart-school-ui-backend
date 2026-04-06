/**
 * CUSTOM ERROR CLASSES
 * Structured error handling for the application
 */

class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class ValidationError extends ApiError {
  constructor(message, errors = []) {
    super(400, message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

class AuthenticationError extends ApiError {
  constructor(message = 'Authentication failed') {
    super(401, message);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends ApiError {
  constructor(message = 'Insufficient permissions') {
    super(403, message);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends ApiError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends ApiError {
  constructor(message = 'Resource already exists') {
    super(409, message);
    this.name = 'ConflictError';
  }
}

class RateLimitError extends ApiError {
  constructor(message = 'Too many requests') {
    super(429, message);
    this.name = 'RateLimitError';
  }
}

class DatabaseError extends ApiError {
  constructor(message = 'Database operation failed') {
    super(500, message, false);
    this.name = 'DatabaseError';
  }
}

export {
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError
};
