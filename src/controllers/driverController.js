// controllers/driverController.js - Driver Portal (Trip & Vehicle Management)
import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import Route from "../models/Route.js";
import Trip from "../models/Trip.js";
import FuelLog from "../models/FuelLog.js";
import Student from "../models/Student.js";
import asyncHandler from "../utils/asyncHandler.js";

const getDriverFromUser = async (userId) => {
  try {
    const driver = await Driver.findOne({ $or: [{ user: userId }, { userId }] });
    return driver;
  } catch (error) {
    console.error('getDriverFromUser error:', error);
    throw error;
  }
};

// @desc    Get driver profile
// @route   GET /api/driver/profile
export const getMyProfile = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({ success: false, message: "Unauthorized: No user found" });
  }

  const driver = await Driver.findOne({ $or: [{ user: req.user._id }, { userId: req.user._id }] })
    .populate("user", "name email phone")
    .populate("assignedVehicle", "vehicleNo model capacity status");

  if (!driver) {
    return res.status(404).json({ success: false, message: "Driver profile not found" });
  }

  const route = await Route.findOne({ assignedDriver: driver._id }).select("name startTime endTime status");

  res.json({ success: true, data: { driver, route } });
});

// @desc    Get driver dashboard stats
// @route   GET /api/driver/dashboard
export const getDriverDashboard = asyncHandler(async (req, res) => {
  console.log('getDriverDashboard called, req.user:', req.user?._id);
  
  if (!req.user || !req.user._id) {
    return res.status(401).json({ success: false, message: "Unauthorized: No user found" });
  }

  console.log('Fetching driver for user:', req.user._id);
  const driver = await getDriverFromUser(req.user._id);
  console.log('Driver found:', driver?._id);
  
  if (!driver) {
    return res.status(404).json({ success: false, message: "Driver profile not found. Please contact admin to create your driver profile." });
  }

  try {
    console.log('Fetching dashboard data...');
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    console.log('Fetching vehicle...');
    const vehicle = await Vehicle.findOne({ $or: [{ currentDriver: driver._id }, { _id: driver.assignedVehicle }] })
      .select("vehicleNo model capacity status lastService insuranceExpiry");
    console.log('Vehicle:', vehicle?._id);
    
    console.log('Fetching route...');
    const route = await Route.findOne({ assignedDriver: driver._id }).select("name totalStops estimatedTime");
    console.log('Route:', route?._id);
    
    console.log('Fetching today trips...');
    const todayTrips = await Trip.find({ driver: driver._id, scheduledStart: { $gte: startOfDay, $lte: endOfDay } });
    console.log('Today trips:', todayTrips.length);
    
    console.log('Fetching monthly stats...');
    const monthlyStats = await Trip.aggregate([
      { $match: { driver: driver._id, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, totalTrips: { $sum: 1 }, totalDistance: { $sum: { $ifNull: ["$distanceCovered", 0] } } } }
    ]);
    console.log('Monthly stats:', monthlyStats);
    
    console.log('Fetching active trip...');
    const activeTrip = await Trip.findOne({ driver: driver._id, status: "in-progress" });
    console.log('Active trip:', activeTrip?._id);

    console.log('Fetching student count...');
    const studentCount = route ? await Student.countDocuments({ "transport.routeId": route._id }) : 0;
    console.log('Student count:', studentCount);

    res.json({
      success: true,
      data: {
        driver: { name: req.user.name, totalTrips: driver.totalTrips || 0 },
        vehicle,
        route,
        todayTrips,
        activeTrip,
        studentCount,
        monthlyStats: monthlyStats[0] || { totalTrips: 0, totalDistance: 0 }
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error loading dashboard: ${error.message}` 
    });
  }
});

// @desc    Get today's schedule
// @route   GET /api/driver/today-schedule
export const getMyTodaySchedule = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({ success: false, message: "Unauthorized: No user found" });
  }

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });

  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);

  const [trips, route] = await Promise.all([
    Trip.find({ driver: driver._id, scheduledStart: { $gte: startOfDay, $lte: endOfDay } }).sort({ scheduledStart: 1 }),
    Route.findOne({ assignedDriver: driver._id })
  ]);

  res.json({ success: true, data: { trips, route, date: now.toISOString().split("T")[0], hasTrips: trips.length > 0 } });
});

// @desc    Get my students
// @route   GET /api/driver/my-students
export const getMyStudents = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({ success: false, message: "Unauthorized: No user found" });
  }

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });

  const route = await Route.findOne({ assignedDriver: driver._id });
  if (!route) return res.json({ success: true, data: [] });

  const students = await Student.find({ "transport.routeId": route._id })
    .select("personal academic transport admissionNumber");

  res.json({ success: true, data: students });
});

// @desc    Start a trip
// @route   POST /api/driver/start-trip
export const startTrip = asyncHandler(async (req, res) => {
  const { tripId, actualStart, startOdometer, notes } = req.body;

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });

  const activeTrip = await Trip.findOne({ driver: driver._id, status: "in-progress" });
  if (activeTrip) {
    return res.status(400).json({ success: false, message: "You already have an active trip. End it first." });
  }

  let trip;
  if (tripId) {
    trip = await Trip.findById(tripId);
    if (!trip || String(trip.driver) !== String(driver._id)) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }
    trip.status = "in-progress";
    trip.actualStart = actualStart || new Date();
    trip.startOdometer = startOdometer || trip.startOdometer;
    await trip.save();
  } else {
    // Create an unscheduled trip if no tripId provided
    const route = await Route.findOne({ assignedDriver: driver._id });
    const vehicle = await Vehicle.findOne({ $or: [{ currentDriver: driver._id }, { _id: driver.assignedVehicle }] });
    
    if (!route || !vehicle) {
      return res.status(400).json({ success: false, message: "No route or vehicle assigned" });
    }

    trip = await Trip.create({
      driver: driver._id,
      vehicle: vehicle._id,
      route: route._id,
      tripType: "morning-pickup", // default
      scheduledStart: new Date(),
      scheduledEnd: new Date(new Date().getTime() + 60 * 60 * 1000), // +1 hour
      actualStart: actualStart || new Date(),
      startOdometer: startOdometer || 0,
      status: "in-progress",
      notes
    });
  }

  // Update vehicle status
  await Vehicle.findOneAndUpdate(
    { $or: [{ currentDriver: driver._id }, { _id: driver.assignedVehicle }] },
    { status: "on-route" }
  );

  res.status(200).json({ success: true, data: trip });
});

// @desc    End a trip
// @route   POST /api/driver/end-trip/:tripId
export const endTrip = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { actualEnd, endOdometer, notes } = req.body;

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });

  const trip = await Trip.findById(tripId);
  if (!trip || String(trip.driver) !== String(driver._id)) {
    return res.status(404).json({ success: false, message: "Trip not found" });
  }

  trip.actualEnd = actualEnd || new Date();
  trip.endOdometer = endOdometer || 0;
  trip.status = "completed";
  trip.notes = notes || trip.notes;
  await trip.save();

  // Update driver total trips
  await Driver.findByIdAndUpdate(driver._id, { $inc: { totalTrips: 1 } });

  // Reset vehicle status
  await Vehicle.findOneAndUpdate(
    { $or: [{ currentDriver: driver._id }, { _id: driver.assignedVehicle }] },
    { status: "active" }
  );

  res.json({ success: true, data: trip });
});

// @desc    Mark student boarded/absent
// @route   POST /api/driver/mark-student/:tripId/:studentId
export const markStudentBoarded = asyncHandler(async (req, res) => {
  const { tripId, studentId } = req.params;
  const { status, stopNo } = req.body; // boarded | dropped

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });

  const trip = await Trip.findById(tripId);
  if (!trip || String(trip.driver) !== String(driver._id)) {
    return res.status(404).json({ success: false, message: "Trip not found" });
  }

  if (!trip.students) trip.students = [];
  const idx = trip.students.findIndex(s => String(s.studentId) === studentId);

  if (idx >= 0) {
    if (status === 'boarded') {
      trip.students[idx].boarded = true;
      trip.students[idx].boardedAt = new Date();
    } else if (status === 'dropped') {
      trip.students[idx].dropped = true;
      trip.students[idx].droppedAt = new Date();
    }
  } else {
    // Add student to trip if not present
    trip.students.push({
      studentId,
      boardingStop: stopNo || 0,
      dropStop: 0,
      boarded: status === 'boarded',
      boardedAt: status === 'boarded' ? new Date() : null,
      dropped: status === 'dropped',
      droppedAt: status === 'dropped' ? new Date() : null
    });
  }

  // Update present students count
  trip.presentStudents = trip.students.filter(s => s.boarded).length;
  trip.totalStudents = trip.students.length;

  await trip.save();

  res.json({ success: true, data: trip.students });
});

// @desc    Log fuel
// @route   POST /api/driver/fuel-log
export const logFuel = asyncHandler(async (req, res) => {
  const { vehicleId, quantity, rate, totalCost, odometerReading, fuelType, fuelingStation } = req.body;

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });

  const targetVehicleId = vehicleId || driver.assignedVehicle;
  
  // Get previous reading
  const lastLog = await FuelLog.findOne({ vehicle: targetVehicleId }).sort({ odometerReading: -1 });
  const previousReading = lastLog ? lastLog.odometerReading : 0;

  const fuelLog = await FuelLog.create({
    vehicle: targetVehicleId,
    driver: driver._id,
    date: new Date(),
    fuelType: fuelType || 'diesel',
    quantity: quantity || 0,
    rate: rate || 0,
    totalCost: totalCost || (quantity * rate) || 0,
    odometerReading: odometerReading || 0,
    previousReading,
    fuelingStation: fuelingStation || "",
    recordedBy: req.user._id
  });

  res.status(201).json({ success: true, data: fuelLog });
});

// @desc    Get trip history
// @route   GET /api/driver/trip-history
export const getMyTripsHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, fromDate, toDate } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });

  const query = { driver: driver._id };
  if (fromDate) query.scheduledStart = { $gte: new Date(fromDate) };
  if (toDate) {
    const end = new Date(toDate); end.setHours(23, 59, 59, 999);
    query.scheduledStart = { ...query.scheduledStart, $lte: end };
  }

  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

  const [trips, total, monthlyStats] = await Promise.all([
    Trip.find(query)
      .populate("route", "name")
      .sort({ scheduledStart: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Trip.countDocuments(query),
    Trip.aggregate([
      { $match: { driver: driver._id, createdAt: { $gte: startOfMonth } } },
      {
        $group: {
          _id: null,
          totalTrips: { $sum: 1 },
          totalDistance: { $sum: { $ifNull: ["$distanceCovered", 0] } }
        }
      }
    ])
  ]);

  res.json({
    success: true,
    data: {
      trips,
      stats: monthlyStats[0] || { totalTrips: 0, totalDistance: 0 },
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    }
  });
});

// @desc    Get my vehicle
// @route   GET /api/driver/my-vehicle
export const getMyVehicle = asyncHandler(async (req, res) => {
  const driver = await getDriverFromUser(req.user._id);
  if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });

  const vehicle = await Vehicle.findOne({
    $or: [{ currentDriver: driver._id }, { _id: driver.assignedVehicle }]
  });

  if (!vehicle) return res.status(404).json({ success: false, message: "No vehicle assigned" });

  res.json({ success: true, data: { vehicle } });
});

// @desc    Get fuel logs
// @route   GET /api/driver/fuel-logs
export const getFuelLogs = asyncHandler(async (req, res) => {
  const driver = await getDriverFromUser(req.user._id);
  if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });

  const vehicleId = driver.assignedVehicle;
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

  const [fuelLogs, monthlyTotals] = await Promise.all([
    FuelLog.find({ $or: [{ vehicle: vehicleId }, { driver: driver._id }] })
      .sort({ date: -1 }).limit(50),
    FuelLog.aggregate([
      { $match: { $or: [{ vehicle: vehicleId }, { driver: driver._id }], createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, totalLiters: { $sum: "$quantity" }, totalAmount: { $sum: "$totalCost" } } }
    ])
  ]);

  res.json({
    success: true,
    data: { fuelLogs, monthlyTotals: monthlyTotals[0] || { totalLiters: 0, totalAmount: 0 } }
  });
});

// @desc    Get driver's assigned routes
// @route   GET /api/driver/assigned-routes
export const getAssignedRoutes = asyncHandler(async (req, res) => {
  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({ success: false, message: "Driver not found" });
  }

  const routes = await Route.find({ assignedDriver: driver._id })
    .populate("assignedVehicle", "vehicleNo model capacity")
    .select("routeNo name zone startPoint endPoint totalDistance estimatedTime stops schedule status");

  res.json({
    success: true,
    data: {
      routes,
      primaryRoute: routes[0] || null,
      totalRoutes: routes.length
    }
  });
});

// @desc    Get route details by ID
// @route   GET /api/driver/route/:routeId
export const getRouteDetails = asyncHandler(async (req, res) => {
  const { routeId } = req.params;
  
  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({ success: false, message: "Driver not found" });
  }

  const route = await Route.findOne({ 
    _id: routeId,
    assignedDriver: driver._id 
  })
    .populate("assignedVehicle", "vehicleNo model capacity fuelType")
    .populate("assignedDriver", "firstName lastName phone");

  if (!route) {
    return res.status(404).json({ 
      success: false, 
      message: "Route not found or not assigned to you" 
    });
  }

  // Get students on this route
  const students = await Student.find({ "transport.routeId": route._id })
    .select("personal.firstName personal.lastName personal.photo academic.class academic.section transport.pickupPoint transport.dropPoint");

  res.json({
    success: true,
    data: {
      route,
      students,
      totalStops: route.stops?.length || 0,
      totalStudents: students.length
    }
  });
});
