// controllers/maintenanceRequestController.js - Maintenance Request Management
import asyncHandler from '../utils/asyncHandler.js';
import MaintenanceRequest from '../models/MaintenanceRequest.js';
import Driver from '../models/Driver.js';
import Vehicle from '../models/Vehicle.js';

// Helper function to get driver from user
const getDriverFromUser = async (userId) => {
  return Driver.findOne({ $or: [{ user: userId }, { userId }] });
};

// @desc    Submit maintenance request
// @route   POST /api/driver/maintenance-request
// @access  Private (Driver)
export const submitMaintenanceRequest = asyncHandler(async (req, res) => {
  const {
    vehicleId,
    issueType,
    priority,
    description,
    odometer,
    fuelLevel,
    estimatedCost,
    photos,
    documents
  } = req.body;

  // Validate required fields
  if (!issueType || !description) {
    return res.status(400).json({
      success: false,
      message: 'Issue type and description are required'
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

  // Determine if approval is required based on priority and estimated cost
  const approvalRequired = priority === 'critical' || 
                          priority === 'high' || 
                          (estimatedCost && estimatedCost > 5000);

  // Create maintenance request
  const maintenanceRequest = await MaintenanceRequest.create({
    vehicle: targetVehicleId,
    driver: driver._id,
    issueType,
    priority: priority || 'medium',
    description,
    odometerReading: odometer || vehicle.currentOdometer || 0,
    fuelLevel: fuelLevel || vehicle.currentFuel,
    estimatedCost: estimatedCost || 0,
    photos: photos || [],
    documents: documents || [],
    approvalRequired,
    status: approvalRequired ? 'pending' : 'approved',
    reportedBy: req.user._id,
    reportedAt: new Date()
  });

  // If critical priority, update vehicle status
  if (priority === 'critical' || priority === 'high') {
    await Vehicle.findByIdAndUpdate(targetVehicleId, {
      status: 'maintenance'
    });
  }

  // Populate the created request
  const populatedRequest = await MaintenanceRequest.findById(maintenanceRequest._id)
    .populate('vehicle', 'vehicleNo model registrationNo')
    .populate('driver', 'firstName lastName employeeId');

  res.status(201).json({
    success: true,
    message: 'Maintenance request submitted successfully',
    data: populatedRequest
  });
});

// @desc    Get driver's maintenance requests
// @route   GET /api/driver/maintenance-requests
// @access  Private (Driver)
export const getMaintenanceRequests = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, issueType, priority, status, fromDate, toDate } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const query = { driver: driver._id, isDeleted: false };

  if (issueType) {
    query.issueType = issueType;
  }

  if (priority) {
    query.priority = priority;
  }

  if (status) {
    query.status = status;
  }

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  const [requests, total] = await Promise.all([
    MaintenanceRequest.find(query)
      .populate('vehicle', 'vehicleNo model registrationNo')
      .populate('driver', 'firstName lastName employeeId phone')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    MaintenanceRequest.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      requests,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

// @desc    Get maintenance request by ID
// @route   GET /api/driver/maintenance-requests/:id
// @access  Private (Driver)
export const getMaintenanceRequestById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const request = await MaintenanceRequest.findOne({
    _id: id,
    driver: driver._id,
    isDeleted: false
  })
    .populate('vehicle', 'vehicleNo model registrationNo')
    .populate('driver', 'firstName lastName employeeId phone email')
    .populate('assignedTo', 'name email role')
    .populate('approvedBy', 'name email role');

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Maintenance request not found'
    });
  }

  res.json({
    success: true,
    data: request
  });
});

// @desc    Update maintenance request (add notes, update status)
// @route   PUT /api/driver/maintenance-requests/:id
// @access  Private (Driver/Admin)
export const updateMaintenanceRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    description,
    driverNotes,
    followUpNotes,
    status
  } = req.body;

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const request = await MaintenanceRequest.findOne({
    _id: id,
    driver: driver._id,
    isDeleted: false
  });

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Maintenance request not found'
    });
  }

  // Only allow updates if request is not completed/cancelled
  if (request.status === 'completed' || request.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      message: 'Cannot update completed/cancelled maintenance requests'
    });
  }

  // Update fields based on role
  if (description !== undefined) request.description = description;
  if (driverNotes !== undefined) request.driverNotes = driverNotes;
  if (followUpNotes !== undefined) request.followUpNotes = followUpNotes;
  
  // Status updates - drivers can only update to certain statuses
  if (status !== undefined) {
    if (req.user.role === 'driver' && !['pending', 'on_hold'].includes(status)) {
      return res.status(403).json({
        success: false,
        message: 'Drivers can only update status to pending or on_hold'
      });
    }
    request.status = status;
  }

  await request.save();

  const updatedRequest = await MaintenanceRequest.findById(request._id)
    .populate('vehicle', 'vehicleNo model')
    .populate('driver', 'firstName lastName employeeId');

  res.json({
    success: true,
    message: 'Maintenance request updated successfully',
    data: updatedRequest
  });
});

// @desc    Get maintenance statistics for driver
// @route   GET /api/driver/maintenance-requests/stats
// @access  Private (Driver)
export const getMaintenanceStats = asyncHandler(async (req, res) => {
  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalRequests, pendingRequests, inProgressRequests, completedRequests, monthlyRequests] = await Promise.all([
    MaintenanceRequest.countDocuments({ driver: driver._id, isDeleted: false }),
    MaintenanceRequest.countDocuments({ 
      driver: driver._id, 
      status: 'pending',
      isDeleted: false 
    }),
    MaintenanceRequest.countDocuments({ 
      driver: driver._id, 
      status: 'in_progress',
      isDeleted: false 
    }),
    MaintenanceRequest.countDocuments({ 
      driver: driver._id, 
      status: 'completed',
      isDeleted: false 
    }),
    MaintenanceRequest.countDocuments({ 
      driver: driver._id,
      createdAt: { $gte: startOfMonth },
      isDeleted: false 
    })
  ]);

  // Get priority breakdown
  const priorityBreakdown = await MaintenanceRequest.aggregate([
    { 
      $match: { 
        driver: driver._id, 
        isDeleted: false 
      } 
    },
    { 
      $group: { 
        _id: '$priority', 
        count: { $sum: 1 } 
      } 
    }
  ]);

  // Get issue type breakdown
  const issueTypeBreakdown = await MaintenanceRequest.aggregate([
    { 
      $match: { 
        driver: driver._id, 
        isDeleted: false 
      } 
    },
    { 
      $group: { 
        _id: '$issueType', 
        count: { $sum: 1 } 
      } 
    }
  ]);

  // Calculate total cost
  const costData = await MaintenanceRequest.aggregate([
    { 
      $match: { 
        driver: driver._id, 
        status: 'completed',
        isDeleted: false 
      } 
    },
    { 
      $group: { 
        _id: null, 
        totalCost: { $sum: '$actualCost' },
        estimatedCost: { $sum: '$estimatedCost' }
      } 
    }
  ]);

  res.json({
    success: true,
    data: {
      total: totalRequests,
      pending: pendingRequests,
      inProgress: inProgressRequests,
      completed: completedRequests,
      monthly: monthlyRequests,
      priorityBreakdown,
      issueTypeBreakdown,
      totalCost: costData[0]?.totalCost || 0,
      totalEstimatedCost: costData[0]?.estimatedCost || 0
    }
  });
});

// @desc    Add photo to maintenance request
// @route   POST /api/driver/maintenance-requests/:id/photos
// @access  Private (Driver)
export const addPhoto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { url, caption } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      message: 'Photo URL is required'
    });
  }

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const request = await MaintenanceRequest.findOne({
    _id: id,
    driver: driver._id,
    isDeleted: false
  });

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Maintenance request not found'
    });
  }

  request.photos.push({
    url,
    caption: caption || '',
    uploadedAt: new Date()
  });

  await request.save();

  res.json({
    success: true,
    message: 'Photo added successfully',
    data: request
  });
});

// @desc    Approve maintenance request (Admin only)
// @route   POST /api/driver/maintenance-requests/:id/approve
// @access  Private (Admin)
export const approveRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes, assignedTo, assignedGarage, estimatedCost } = req.body;

  const request = await MaintenanceRequest.findOne({
    _id: id,
    isDeleted: false
  });

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Maintenance request not found'
    });
  }

  await request.approve(req.user._id, notes);

  if (assignedTo) request.assignedTo = assignedTo;
  if (assignedGarage) request.assignedGarage = assignedGarage;
  if (estimatedCost) request.estimatedCost = estimatedCost;

  await request.save();

  const updatedRequest = await MaintenanceRequest.findById(request._id)
    .populate('vehicle', 'vehicleNo model')
    .populate('driver', 'firstName lastName employeeId')
    .populate('assignedTo', 'name email role');

  res.json({
    success: true,
    message: 'Maintenance request approved successfully',
    data: updatedRequest
  });
});

// @desc    Reject maintenance request (Admin only)
// @route   POST /api/driver/maintenance-requests/:id/reject
// @access  Private (Admin)
export const rejectRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: 'Rejection reason is required'
    });
  }

  const request = await MaintenanceRequest.findOne({
    _id: id,
    isDeleted: false
  });

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Maintenance request not found'
    });
  }

  await request.reject(reason, req.user._id);

  const updatedRequest = await MaintenanceRequest.findById(request._id)
    .populate('vehicle', 'vehicleNo model')
    .populate('driver', 'firstName lastName employeeId');

  res.json({
    success: true,
    message: 'Maintenance request rejected',
    data: updatedRequest
  });
});

// @desc    Complete maintenance request (Admin/Mechanic)
// @route   POST /api/driver/maintenance-requests/:id/complete
// @access  Private (Admin/Mechanic)
export const completeRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    workPerformed,
    actualCost,
    partsReplaced,
    mechanicNotes,
    qualityCheckPassed
  } = req.body;

  const request = await MaintenanceRequest.findOne({
    _id: id,
    isDeleted: false
  });

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Maintenance request not found'
    });
  }

  await request.complete(workPerformed, actualCost, req.user._id);

  if (partsReplaced) request.partsReplaced = partsReplaced;
  if (mechanicNotes) request.mechanicNotes = mechanicNotes;
  if (qualityCheckPassed !== undefined) {
    request.qualityCheck.passed = qualityCheckPassed;
  }

  await request.save();

  // Update vehicle status back to active
  await Vehicle.findByIdAndUpdate(request.vehicle, {
    status: 'active'
  });

  const updatedRequest = await MaintenanceRequest.findById(request._id)
    .populate('vehicle', 'vehicleNo model')
    .populate('driver', 'firstName lastName employeeId');

  res.json({
    success: true,
    message: 'Maintenance request completed successfully',
    data: updatedRequest
  });
});

// @desc    Delete maintenance request (soft delete - Admin only)
// @route   DELETE /api/driver/maintenance-requests/:id
// @access  Private (Admin)
export const deleteMaintenanceRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const request = await MaintenanceRequest.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true }
  );

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Maintenance request not found'
    });
  }

  res.json({
    success: true,
    message: 'Maintenance request deleted successfully'
  });
});

export default {
  submitMaintenanceRequest,
  getMaintenanceRequests,
  getMaintenanceRequestById,
  updateMaintenanceRequest,
  getMaintenanceStats,
  addPhoto,
  approveRequest,
  rejectRequest,
  completeRequest,
  deleteMaintenanceRequest
};
