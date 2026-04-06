// routes/driverRoutes.js - Complete Driver Portal Routes
import express from "express";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import {
  // Profile & Dashboard
  getMyProfile,
  getDriverDashboard,
  getMyTodaySchedule,
  getMyStudents,
  
  // Trip Management
  startTrip,
  endTrip,
  markStudentBoarded,
  getMyTripsHistory,
  
  // Vehicle & Fuel
  getMyVehicle,
  logFuel,
  getFuelLogs,
  
  // Routes
  getAssignedRoutes,
  getRouteDetails,
} from "../controllers/driverController.js";

import {
  submitChecklist,
  getChecklistHistory,
  getChecklistById,
  getPendingChecklists,
  getChecklistStats,
  updateChecklist,
} from "../controllers/vehicleChecklistController.js";

import {
  submitIncidentReport,
  getIncidentReports,
  getIncidentReportById,
  updateIncidentReport,
  getIncidentStats,
  addWitness,
} from "../controllers/incidentReportController.js";

import {
  submitMaintenanceRequest,
  getMaintenanceRequests,
  getMaintenanceRequestById,
  updateMaintenanceRequest,
  getMaintenanceStats,
  addPhoto,
} from "../controllers/maintenanceRequestController.js";

const router = express.Router();

// ============================================================================
// MIDDLEWARE - All routes require authentication + driver/admin/owner role
// ============================================================================
router.use(protect);
router.use(authorize("driver", "admin", "owner"));

// ============================================================================
// DASHBOARD & PROFILE ROUTES
// ============================================================================

// @route   GET /api/driver/dashboard
// @desc    Get driver dashboard with stats, active trip, vehicle info
router.get("/dashboard", getDriverDashboard);

// @route   GET /api/driver/profile
// @desc    Get driver complete profile with assigned route
router.get("/profile", getMyProfile);

// @route   GET /api/driver/today-schedule
// @desc    Get today's scheduled trips
router.get("/today-schedule", getMyTodaySchedule);

// @route   GET /api/driver/my-students
// @desc    Get students assigned to driver's route
router.get("/my-students", getMyStudents);

// ============================================================================
// TRIP MANAGEMENT ROUTES
// ============================================================================

// @route   POST /api/driver/start-trip
// @desc    Start a new trip (scheduled or unscheduled)
router.post("/start-trip", startTrip);

// @route   POST /api/driver/end-trip/:tripId
// @desc    End an active trip
router.post("/end-trip/:tripId", endTrip);

// @route   POST /api/driver/mark-student/:tripId/:studentId
// @desc    Mark student as boarded/dropped
router.post("/mark-student/:tripId/:studentId", markStudentBoarded);

// @route   GET /api/driver/trip-history
// @desc    Get driver's trip history with pagination and filters
router.get("/trip-history", getMyTripsHistory);

// ============================================================================
// VEHICLE & FUEL MANAGEMENT ROUTES
// ============================================================================

// @route   GET /api/driver/my-vehicle
// @desc    Get driver's assigned vehicle details
router.get("/my-vehicle", getMyVehicle);

// @route   POST /api/driver/fuel-log
// @desc    Log a fuel purchase
router.post("/fuel-log", logFuel);

// @route   GET /api/driver/fuel-logs
// @desc    Get fuel logs history
router.get("/fuel-logs", getFuelLogs);

// ============================================================================
// ROUTE & NAVIGATION ROUTES
// ============================================================================

// @route   GET /api/driver/assigned-routes
// @desc    Get all routes assigned to the driver
router.get("/assigned-routes", getAssignedRoutes);

// @route   GET /api/driver/route/:routeId
// @desc    Get detailed information about a specific route
router.get("/route/:routeId", getRouteDetails);

// ============================================================================
// VEHICLE CHECKLIST ROUTES
// ============================================================================

// @route   POST /api/driver/vehicle-checklist
// @desc    Submit a pre-trip/post-trip vehicle checklist
router.post("/vehicle-checklist", submitChecklist);

// @route   GET /api/driver/vehicle-checklist/history
// @desc    Get driver's checklist history with filters
router.get("/vehicle-checklist/history", getChecklistHistory);

// @route   GET /api/driver/vehicle-checklist/:id
// @desc    Get a specific checklist by ID
router.get("/vehicle-checklist/:id", getChecklistById);

// @route   GET /api/driver/vehicle-checklist/pending
// @desc    Check if there are pending checklists for today
router.get("/vehicle-checklist/pending", getPendingChecklists);

// @route   GET /api/driver/vehicle-checklist/stats
// @desc    Get checklist statistics for the driver
router.get("/vehicle-checklist/stats", getChecklistStats);

// @route   PUT /api/driver/vehicle-checklist/:id
// @desc    Update a checklist (add notes, review)
router.put("/vehicle-checklist/:id", updateChecklist);

// ============================================================================
// INCIDENT REPORTING ROUTES
// ============================================================================

// @route   POST /api/driver/incident-report
// @desc    Submit a new incident report
router.post("/incident-report", submitIncidentReport);

// @route   GET /api/driver/incident-reports
// @desc    Get driver's incident reports with filters
router.get("/incident-reports", getIncidentReports);

// @route   GET /api/driver/incident-reports/:id
// @desc    Get a specific incident report by ID
router.get("/incident-reports/:id", getIncidentReportById);

// @route   PUT /api/driver/incident-reports/:id
// @desc    Update an incident report (add notes, update status)
router.put("/incident-reports/:id", updateIncidentReport);

// @route   POST /api/driver/incident-reports/:id/witnesses
// @desc    Add a witness to an incident report
router.post("/incident-reports/:id/witnesses", addWitness);

// @route   GET /api/driver/incident-reports/stats
// @desc    Get incident statistics for the driver
router.get("/incident-reports/stats", getIncidentStats);

// ============================================================================
// MAINTENANCE REQUEST ROUTES
// ============================================================================

// @route   POST /api/driver/maintenance-request
// @desc    Submit a new maintenance request
router.post("/maintenance-request", submitMaintenanceRequest);

// @route   GET /api/driver/maintenance-requests
// @desc    Get driver's maintenance requests with filters
router.get("/maintenance-requests", getMaintenanceRequests);

// @route   GET /api/driver/maintenance-requests/:id
// @desc    Get a specific maintenance request by ID
router.get("/maintenance-requests/:id", getMaintenanceRequestById);

// @route   PUT /api/driver/maintenance-requests/:id
// @desc    Update a maintenance request (add notes, update status)
router.put("/maintenance-requests/:id", updateMaintenanceRequest);

// @route   POST /api/driver/maintenance-requests/:id/photos
// @desc    Add a photo to a maintenance request
router.post("/maintenance-requests/:id/photos", addPhoto);

// @route   GET /api/driver/maintenance-requests/stats
// @desc    Get maintenance statistics for the driver
router.get("/maintenance-requests/stats", getMaintenanceStats);

// ============================================================================
// EXPORT ROUTER
// ============================================================================

export default router;
