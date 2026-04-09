// controllers/incidentReportController.js - Incident Reporting Management
import asyncHandler from '../utils/asyncHandler.js';
import IncidentReport from '../models/IncidentReport.js';
import Driver from '../models/Driver.js';
import Vehicle from '../models/Vehicle.js';
import Student from '../models/Student.js';

// Helper function to get driver from user
const getDriverFromUser = async (userId) => {
  return Driver.findOne({ $or: [{ user: userId }, { userId }] });
};

// @desc    Submit incident report
// @route   POST /api/driver/incident-report
// @access  Private (Driver)
export const submitIncidentReport = asyncHandler(async (req, res) => {
  const {
    type,
    severity,
    location,
    incidentDate,
    incidentTime,
    description,
    studentsInvolved,
    witnesses,
    immediateAction,
    reportedTo,
    estimatedDamage,
    photos,
    documents
  } = req.body;

  // Validate required fields
  if (!type || !description || !location) {
    return res.status(400).json({
      success: false,
      message: 'Type, description, and location are required'
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

  // Get vehicle if on trip
  const vehicle = driver.assignedVehicle ? 
    await Vehicle.findById(driver.assignedVehicle) : null;

  // Process students involved
  const processedStudents = [];
  if (studentsInvolved && Array.isArray(studentsInvolved)) {
    for (const student of studentsInvolved) {
      let studentRecord = null;
      if (student.studentId) {
        studentRecord = await Student.findById(student.studentId);
      }
      
      processedStudents.push({
        student: studentRecord?._id || null,
        name: student.name || studentRecord?.personal?.firstName || 'Unknown',
        className: student.className || studentRecord?.academic?.class || '',
        section: student.section || studentRecord?.academic?.section || '',
        injury: student.injury || '',
        actionTaken: student.actionTaken || ''
      });
    }
  }

  // Create incident report
  const incidentReport = await IncidentReport.create({
    vehicle: vehicle?._id || null,
    driver: driver._id,
    type,
    severity: severity || 'medium',
    location,
    incidentDate: incidentDate ? new Date(incidentDate) : new Date(),
    incidentTime: incidentTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    description,
    studentsInvolved: processedStudents,
    witnesses: witnesses || [],
    immediateAction: immediateAction || '',
    reportedTo: reportedTo || {
      police: false,
      parents: false,
      insurance: false,
      rto: false
    },
    estimatedDamage: estimatedDamage || 0,
    photos: photos || [],
    documents: documents || [],
    reportedBy: req.user._id,
    status: 'pending'
  });

  // Populate the created report
  const populatedReport = await IncidentReport.findById(incidentReport._id)
    .populate('vehicle', 'vehicleNo model')
    .populate('driver', 'firstName lastName employeeId')
    .populate('studentsInvolved.student', 'personal.firstName personal.lastName academic.class');

  res.status(201).json({
    success: true,
    message: 'Incident report submitted successfully',
    data: populatedReport
  });
});

// @desc    Get driver's incident reports
// @route   GET /api/driver/incident-reports
// @access  Private (Driver)
export const getIncidentReports = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type, severity, status, fromDate, toDate } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const query = { driver: driver._id, isDeleted: false };

  if (type) {
    query.type = type;
  }

  if (severity) {
    query.severity = severity;
  }

  if (status) {
    query.status = status;
  }

  if (fromDate || toDate) {
    query.incidentDate = {};
    if (fromDate) query.incidentDate.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      query.incidentDate.$lte = end;
    }
  }

  const [reports, total] = await Promise.all([
    IncidentReport.find(query)
      .populate('vehicle', 'vehicleNo model registrationNo')
      .populate('driver', 'firstName lastName employeeId phone')
      .populate('studentsInvolved.student', 'personal.firstName personal.lastName academic.class academic.section')
      .sort({ incidentDate: -1 })
      .skip(skip)
      .limit(Number(limit)),
    IncidentReport.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      reports,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

// @desc    Get incident report by ID
// @route   GET /api/driver/incident-reports/:id
// @access  Private (Driver)
export const getIncidentReportById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const report = await IncidentReport.findOne({
    _id: id,
    driver: driver._id,
    isDeleted: false
  })
    .populate('vehicle', 'vehicleNo model registrationNo')
    .populate('driver', 'firstName lastName employeeId phone email')
    .populate('studentsInvolved.student', 'personal.* academic.*')
    .populate('reportedBy', 'name email role');

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Incident report not found'
    });
  }

  res.json({
    success: true,
    data: report
  });
});

// @desc    Update incident report (add notes, update status)
// @route   PUT /api/driver/incident-reports/:id
// @access  Private (Driver/Admin)
export const updateIncidentReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    description,
    immediateAction,
    actionTaken,
    investigationNotes,
    status
  } = req.body;

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const report = await IncidentReport.findOne({
    _id: id,
    driver: driver._id,
    isDeleted: false
  });

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Incident report not found'
    });
  }

  // Only allow updates if report is still pending or under review
  if (report.status === 'resolved' || report.status === 'closed') {
    return res.status(400).json({
      success: false,
      message: 'Cannot update resolved/closed incident reports'
    });
  }

  // Update fields
  if (description !== undefined) report.description = description;
  if (immediateAction !== undefined) report.immediateAction = immediateAction;
  if (actionTaken !== undefined) report.actionTaken = actionTaken;
  if (investigationNotes !== undefined && req.user.role === 'admin') {
    report.investigationNotes = investigationNotes;
  }
  if (status !== undefined && req.user.role === 'admin') {
    report.status = status;
  }

  await report.save();

  const updatedReport = await IncidentReport.findById(report._id)
    .populate('vehicle', 'vehicleNo model')
    .populate('driver', 'firstName lastName employeeId');

  res.json({
    success: true,
    message: 'Incident report updated successfully',
    data: updatedReport
  });
});

// @desc    Get incident statistics for driver
// @route   GET /api/driver/incident-reports/stats
// @access  Private (Driver)
export const getIncidentStats = asyncHandler(async (req, res) => {
  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [totalReports, pendingReports, resolvedReports, monthlyReports, yearlyReports] = await Promise.all([
    IncidentReport.countDocuments({ driver: driver._id, isDeleted: false }),
    IncidentReport.countDocuments({ 
      driver: driver._id, 
      status: { $in: ['pending', 'under_review', 'investigating'] },
      isDeleted: false 
    }),
    IncidentReport.countDocuments({ 
      driver: driver._id, 
      status: { $in: ['resolved', 'closed'] },
      isDeleted: false 
    }),
    IncidentReport.countDocuments({ 
      driver: driver._id,
      incidentDate: { $gte: startOfMonth },
      isDeleted: false 
    }),
    IncidentReport.countDocuments({ 
      driver: driver._id,
      incidentDate: { $gte: startOfYear },
      isDeleted: false 
    })
  ]);

  // Get severity breakdown
  const severityBreakdown = await IncidentReport.aggregate([
    { 
      $match: { 
        driver: driver._id, 
        isDeleted: false 
      } 
    },
    { 
      $group: { 
        _id: '$severity', 
        count: { $sum: 1 } 
      } 
    }
  ]);

  // Get type breakdown for current year
  const typeBreakdown = await IncidentReport.aggregate([
    { 
      $match: { 
        driver: driver._id,
        incidentDate: { $gte: startOfYear },
        isDeleted: false 
      } 
    },
    { 
      $group: { 
        _id: '$type', 
        count: { $sum: 1 } 
      } 
    }
  ]);

  res.json({
    success: true,
    data: {
      total: totalReports,
      pending: pendingReports,
      resolved: resolvedReports,
      monthly: monthlyReports,
      yearly: yearlyReports,
      severityBreakdown,
      typeBreakdown
    }
  });
});

// @desc    Add witness to incident report
// @route   POST /api/driver/incident-reports/:id/witnesses
// @access  Private (Driver)
export const addWitness = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, contact, statement } = req.body;

  if (!name || !contact) {
    return res.status(400).json({
      success: false,
      message: 'Witness name and contact are required'
    });
  }

  const driver = await getDriverFromUser(req.user._id);
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found'
    });
  }

  const report = await IncidentReport.findOne({
    _id: id,
    driver: driver._id,
    isDeleted: false
  });

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Incident report not found'
    });
  }

  report.witnesses.push({ name, contact, statement: statement || '' });
  await report.save();

  res.json({
    success: true,
    message: 'Witness added successfully',
    data: report
  });
});

// @desc    Delete incident report (soft delete - Admin only)
// @route   DELETE /api/driver/incident-reports/:id
// @access  Private (Admin)
export const deleteIncidentReport = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const report = await IncidentReport.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true }
  );

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Incident report not found'
    });
  }

  res.json({
    success: true,
    message: 'Incident report deleted successfully'
  });
});

export default {
  submitIncidentReport,
  getIncidentReports,
  getIncidentReportById,
  updateIncidentReport,
  getIncidentStats,
  addWitness,
  deleteIncidentReport
};
