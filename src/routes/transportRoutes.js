// routes/transportRoutes.js
import express from "express";
import {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  updateVehicleLocation,
  updateFuelLevel,
  assignDriver,
  getVehicleStats,
  deleteVehicle,
  getAllDrivers,
  createDriver,
  updateDriver,
  getDriverStats,
  getAllRoutes,
  createRoute,
  updateRoute,
  getRouteStats,
  getAllMaintenance,
  createMaintenance,
  updateMaintenanceStatus,
  getMaintenanceStats,
  getAllFuelLogs,
  createFuelLog,
  getFuelStats,
  getAllCleaners,
  getCleanerById,
  assignCleanerToVehicle,
  getDashboardStats,
  generateReport,
  getVehicleByNumber,
  getVehiclesByStatus,
  getMaintenanceByVehicle,
  getFuelLogsByVehicle
} from "../controllers/transportController.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// =================== VEHICLE ROUTES ===================
router.get("/vehicles", protect, getAllVehicles);
router.get("/vehicles/:id", protect, getVehicleById);
router.post("/vehicles", protect, authorize("admin", "owner"), createVehicle);
router.put("/vehicles/:id", protect, authorize("admin", "owner"), updateVehicle);
router.patch("/vehicles/:id/location", protect, authorize("admin", "owner", "driver"), updateVehicleLocation);
router.patch("/vehicles/:id/fuel", protect, authorize("admin", "owner"), updateFuelLevel);
router.post("/vehicles/:id/assign-driver", protect, authorize("admin", "owner"), assignDriver);
router.get("/vehicles-stats", protect, getVehicleStats);
router.delete("/vehicles/:id", protect, authorize("admin", "owner"), deleteVehicle);
router.get("/vehicles/number/:vehicleNo", protect, getVehicleByNumber);
router.get("/vehicles/status/:status", protect, getVehiclesByStatus);

// =================== DRIVER ROUTES ===================
router.get("/drivers", protect, getAllDrivers);
router.post("/drivers", protect, authorize("admin", "owner"), createDriver);
router.put("/drivers/:id", protect, authorize("admin", "owner"), updateDriver);
router.get("/drivers-stats", protect, getDriverStats);

// =================== ROUTE ROUTES ===================
router.get("/routes", protect, getAllRoutes);
router.post("/routes", protect, authorize("admin", "owner"), createRoute);
router.put("/routes/:id", protect, authorize("admin", "owner"), updateRoute);
router.get("/routes-stats", protect, getRouteStats);

// =================== MAINTENANCE ROUTES ===================
router.get("/maintenance", protect, getAllMaintenance);
router.post("/maintenance", protect, authorize("admin", "owner"), createMaintenance);
router.patch("/maintenance/:id/status", protect, authorize("admin", "owner"), updateMaintenanceStatus);
router.get("/maintenance-stats", protect, getMaintenanceStats);
router.get("/maintenance/vehicle/:vehicleId", protect, getMaintenanceByVehicle);

// =================== FUEL LOG ROUTES ===================
router.get("/fuel-logs", protect, getAllFuelLogs);
router.post("/fuel-logs", protect, authorize("admin", "owner"), createFuelLog);
router.get("/fuel-stats", protect, getFuelStats);
router.get("/fuel-logs/vehicle/:vehicleId", protect, getFuelLogsByVehicle);

// =================== CLEANER ROUTES ===================
router.get("/cleaners", protect, getAllCleaners);
router.get("/cleaners/:id", protect, getCleanerById);
router.post("/cleaners/assign", protect, authorize("admin", "owner"), assignCleanerToVehicle);

// =================== DASHBOARD & REPORTS ===================
router.get("/dashboard-stats", protect, getDashboardStats);
router.post("/reports/generate", protect, authorize("admin", "owner"), generateReport);

// Health check for transport module
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Transport module is running",
    timestamp: new Date().toISOString()
  });
});

export default router;