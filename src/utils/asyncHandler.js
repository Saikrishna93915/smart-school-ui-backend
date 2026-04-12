export default function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      if (typeof next === "function") {
        next(error);
        return;
      }

      // Fallback guard: handle errors gracefully even if next is unavailable.
      const statusCode = Number(error?.statusCode) || 500;
      const message = error?.message || "Internal server error";

      if (res && !res.headersSent && typeof res.status === "function") {
        res.status(statusCode).json({
          success: false,
          statusCode,
          message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      throw error;
    });
  };
}