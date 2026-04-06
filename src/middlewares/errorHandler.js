/**
 * GLOBAL ERROR HANDLER MIDDLEWARE
 * Centralized error handling with proper logging and response formatting
 */

import { ApiError } from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Log error details
  console.error('❌ Error occurred:', {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Convert non-ApiError to ApiError
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    error = new ApiError(statusCode, message, false, error.stack);
  }

  // Mongoose validation error
  if (error.name === 'ValidationError' && error.errors) {
    const validationErrors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));
    
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Validation failed',
      errors: validationErrors,
      timestamp: new Date().toISOString()
    });
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return res.status(409).json({
      success: false,
      statusCode: 409,
      message: `${field} already exists`,
      timestamp: new Date().toISOString()
    });
  }

  // Mongoose cast error
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: `Invalid ${error.path}: ${error.value}`,
      timestamp: new Date().toISOString()
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json(ApiResponse.unauthorized('Invalid token'));
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json(ApiResponse.unauthorized('Token expired'));
  }

  // Send error response
  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    timestamp: error.timestamp
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  // Include validation errors if present
  if (error.errors) {
    response.errors = error.errors;
  }

  res.status(error.statusCode).json(response);
};

// Handle unhandled promise rejections
export const unhandledRejectionHandler = (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  throw new ApiError(500, 'Unhandled promise rejection', false);
};

// Handle uncaught exceptions
export const uncaughtExceptionHandler = (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
};

export default errorHandler;
