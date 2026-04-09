// controllers/vehicleChecklistController.js - Vehicle Checklist Management
import asyncHandler from '../utils/asyncHandler.js';
import VehicleChecklist from '../models/VehicleChecklist.js';
import Vehicle from '../models/Vehicle.js';
import Driver from '../models/Driver.js';
import Trip from '../models/Trip.js';

// Helper function to get driver from user
const getDriverFromUser = async (userId) => {
  return Driver.findOne({ $or: [{ user: userId }, { userId }] });
};

// @desc    Submit vehicle checklist
// @route   POST /api/driver/vehicle-checklist
// @access  Private (Driver)
export const submitChecklist = asyncHandler(async (req, res) => {
  const {
    checklistType,
    vehicleId,
    tripId,
    odometerReading,
    fuelLevel,
    sections,
    overallStatus
  } = req.body;

  // Validate required fields
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Checklist sections are required'
    });
  }

  // Get driver
  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  // Get vehicle
  const targetVehicleId = vehicleId || driver.assignedVehicle;
  if (!targetVehicleId) {
    return res.status(400).json({
      success: false,
      message: 'No vehicle assigned. Please contact admin.'
    });
  }

  const vehicle = await Vehicle.findById(targetVehicleId);
  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found'
    });
  }

  // Validate trip if provided
  let trip = null;
  if (tripId) {
    trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }
  }

  // Calculate overall status if not provided
  let calculatedStatus = overallStatus;
  if (!calculatedStatus) {
    const allItems = sections.flatMap(section => section.items);
    const hasIssues = allItems.some(item => item.status === 'issue');
    const allCompleted = allItems.every(item => item.status !== null);
    
    if (!allCompleted) {
      calculatedStatus = 'pending';
    } else if (hasIssues) {
      calculatedStatus = 'fail';
    } else {
      calculatedStatus = 'pass';
    }
  }

  // Extract issues found
  const issuesFound = [];
  sections.forEach(section => {
    section.items.forEach(item => {
      if (item.status === 'issue' && item.notes) {
        issuesFound.push({
          item: item.label,
          description: item.notes,
          severity: 'medium', // Default severity
          actionRequired: 'Inspection required'
        });
      }
    });
  });

  // Create checklist
  const checklist = await VehicleChecklist.create({
    vehicle: targetVehicleId,
    driver: driver._id,
    trip: tripId || null,
    checklistType: checklistType || 'pre-trip',
    date: new Date(),
    odometerReading: odometerReading || vehicle.currentOdometer || 0,
    fuelLevel: fuelLevel || vehicle.currentFuel,
    sections,
    overallStatus: calculatedStatus,
    issuesFound,
    submittedBy: req.user._id
  });

  // If issues found and critical, update vehicle status
  if (calculatedStatus === 'fail' && issuesFound.length > 0) {
    const hasCriticalIssues = issuesFound.some(issue => 
      issue.severity === 'critical' || issue.severity === 'high'
    );
    
    if (hasCriticalIssues) {
      await Vehicle.findByIdAndUpdate(targetVehicleId, {
        status: 'maintenance'
      });
    }
  }

  res.status(201).json({
    success: true,
    message: 'Vehicle checklist submitted successfully',
    data: checklist
  });
});

// @desc    Get driver's checklists
// @route   GET /api/driver/vehicle-checklist/history
// @access  Private (Driver)
export const getChecklistHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, checklistType, status, fromDate, toDate } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const query = { driver: driver._id, isDeleted: false };

  if (checklistType) {
    query.checklistType = checklistType;
  }

  if (status) {
    query.overallStatus = status;
  }

  if (fromDate || toDate) {
    query.date = {};
    if (fromDate) query.date.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  const [checklists, total] = await Promise.all([
    VehicleChecklist.find(query)
      .populate('vehicle', 'vehicleNo model registrationNo')
      .populate('trip', 'tripId route tripType')
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit)),
    VehicleChecklist.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      checklists,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

// @desc    Get checklist by ID
// @route   GET /api/driver/vehicle-checklist/:id
// @access  Private (Driver)
export const getChecklistById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const checklist = await VehicleChecklist.findOne({
    _id: id,
    driver: driver._id,
    isDeleted: false
  })
    .populate('vehicle', 'vehicleNo model registrationNo')
    .populate('trip', 'tripId route tripType')
    .populate('submittedBy', 'name email');

  if (!checklist) {
    return res.status(404).json({
      success: false,
      message: 'Checklist not found'
    });
  }

  res.json({
    success: true,
    data: checklist
  });
});

// @desc    Get pending checklists for vehicle
// @route   GET /api/driver/vehicle-checklist/pending
// @access  Private (Driver)
export const getPendingChecklists = asyncHandler(async (req, res) => {
  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if there's a checklist submitted today
  const existingChecklist = await VehicleChecklist.findOne({
    driver: driver._id,
    vehicle: driver.assignedVehicle,
    date: { $gte: today },
    isDeleted: false
  });

  const hasSubmittedToday = !!existingChecklist;

  res.json({
    success: true,
    data: {
      hasSubmittedToday,
      lastChecklist: existingChecklist
    }
  });
});

// @desc    Get checklist statistics for driver
// @route   GET /api/driver/vehicle-checklist/stats
// @access  Private (Driver)
export const getChecklistStats = asyncHandler(async (req, res) => {
  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalChecklists, passedChecklists, failedChecklists, issuesCount] = await Promise.all([
    VehicleChecklist.countDocuments({ driver: driver._id, isDeleted: false }),
    VehicleChecklist.countDocuments({ 
      driver: driver._id, 
      overallStatus: 'pass',
      isDeleted: false 
    }),
    VehicleChecklist.countDocuments({ 
      driver: driver._id, 
      overallStatus: 'fail',
      isDeleted: false 
    }),
    VehicleChecklist.aggregate([
      { 
        $match: { 
          driver: driver._id, 
          isDeleted: false,
          date: { $gte: startOfMonth }
        } 
      },
      { 
        $group: { 
          _id: null, 
          totalIssues: { $sum: { $size: '$issuesFound' } } 
        } 
      }
    ])
  ]);

  res.json({
    success: true,
    data: {
      total: totalChecklists,
      passed: passedChecklists,
      failed: failedChecklists,
      passRate: totalChecklists > 0 ? ((passedChecklists / totalChecklists) * 100).toFixed(2) : 0,
      monthlyIssues: issuesCount[0]?.totalIssues || 0
    }
  });
});

// @desc    Update checklist (add notes, review)
// @route   PUT /api/driver/vehicle-checklist/:id
// @access  Private (Driver/Admin)
export const updateChecklist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reviewNotes, overallStatus } = req.body;

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const checklist = await VehicleChecklist.findOne({
    _id: id,
    driver: driver._id,
    isDeleted: false
  });

  if (!checklist) {
    return res.status(404).json({
      success: false,
      message: 'Checklist not found'
    });
  }

  // Update fields
  if (reviewNotes !== undefined) {
    checklist.reviewNotes = reviewNotes;
  }

  if (overallStatus !== undefined) {
    checklist.overallStatus = overallStatus;
  }

  await checklist.save();

  res.json({
    success: true,
    message: 'Checklist updated successfully',
    data: checklist
  });
});

// @desc    Delete checklist (soft delete)
// @route   DELETE /api/driver/vehicle-checklist/:id
// @access  Private (Admin)
export const deleteChecklist = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const checklist = await VehicleChecklist.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true }
  );

  if (!checklist) {
    return res.status(404).json({
      success: false,
      message: 'Checklist not found'
    });
  }

  res.json({
    success: true,
    message: 'Checklist deleted successfully'
  });
});

export default {
  submitChecklist,
  getChecklistHistory,
  getChecklistById,
  getPendingChecklists,
  getChecklistStats,
  updateChecklist,
  deleteChecklist
};
