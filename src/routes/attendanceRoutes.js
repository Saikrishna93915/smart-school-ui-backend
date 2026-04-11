import express from 'express';
import {
    markAttendance,
    getAttendanceByClass,
    getAttendanceSummary,
    getClassWiseAttendance,
    markHoliday,
    getHolidayStatus,
    getWorkingDaysCount
} from '../controllers/attendanceController.js';
import { generateAttendanceReport } from '../controllers/attendanceReportController.js';

// ✅ Import existing security middlewares
import { protect } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';

const router = express.Router();

/**
 * ATTENDANCE RECORDING ROUTES
 */

// Route: POST /api/admin/attendance/mark
// Marks or updates student attendance for a specific session (FN/AF)
router.post('/mark', protect, authorize('admin', 'owner', 'teacher'), markAttendance);

// Route: GET /api/admin/attendance/by-class
// Fetches attendance records to populate the management grid
router.get('/by-class', protect, authorize('admin', 'owner', 'teacher'), getAttendanceByClass);

// Route: GET /api/admin/attendance/summary
// Fetches daily statistics (Present, Absent, Half-Day) for the dashboard
router.get('/summary', protect, authorize('admin', 'owner', 'teacher'), getAttendanceSummary);

// Route: GET /api/admin/attendance/class-wise
// Fetches class-wise attendance percentage for admin overview
router.get('/class-wise', protect, authorize('admin', 'owner'), getClassWiseAttendance);


/**
 * HOLIDAY & CALENDAR MANAGEMENT ROUTES
 */

// Route: POST /api/admin/attendance/mark-holiday
// Declares a specific date as a non-working holiday
router.post('/mark-holiday', protect, authorize('admin', 'owner', 'teacher'), markHoliday);

// Route: GET /api/admin/attendance/holiday-status
// Checks if a date is a holiday or Sunday to lock the frontend UI
router.get('/holiday-status', protect, authorize('admin', 'owner', 'teacher'), getHolidayStatus);

// Route: GET /api/admin/attendance/working-days
// Calculates total non-holiday/non-Sunday days for a month or year
router.get('/working-days', protect, authorize('admin', 'owner', 'teacher'), getWorkingDaysCount);

/**
 * ATTENDANCE REPORTING ROUTES
 */

// Route: GET /api/admin/attendance/report
// Generates professional attendance reports (day/week/month/year)
// Query params: class, section, reportType (day|week|month|year), startDate, endDate
router.get('/report', protect, authorize('admin', 'owner', 'teacher'), generateAttendanceReport);

export default router;