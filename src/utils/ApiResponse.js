/**
 * CENTRALIZED API RESPONSE HELPER
 * Standardized response format for all API endpoints
 */

class ApiResponse {
  constructor(statusCode, message, data = null, meta = null) {
    this.success = statusCode >= 200 && statusCode < 300;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.meta = meta;
    this.timestamp = new Date().toISOString();
  }

  static success(message = 'Success', data = null, meta = null) {
    return new ApiResponse(200, message, data, meta);
  }

  static created(message = 'Resource created successfully', data = null) {
    return new ApiResponse(201, message, data);
  }

  static noContent(message = 'No content') {
    return new ApiResponse(204, message);
  }

  static badRequest(message = 'Bad request') {
    return new ApiResponse(400, message);
  }

  static unauthorized(message = 'Unauthorized access') {
    return new ApiResponse(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiResponse(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiResponse(404, message);
  }

  static conflict(message = 'Resource conflict') {
    return new ApiResponse(409, message);
  }

  static internalError(message = 'Internal server error') {
    return new ApiResponse(500, message);
  }

  static paginated(message, data, pagination) {
    return new ApiResponse(200, message, data, {
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrev: pagination.page > 1
      }
    });
  }
}

export default ApiResponse;
