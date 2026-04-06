import Certificate from '../models/Certificate.js';
import Student from '../models/Student.js';
import User from '../models/User.js';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs/promises';

/**
 * Create a new certificate request
 * POST /api/certificates
 */
export const createCertificate = async (req, res) => {
  try {
    const {
      studentId,
      certificateType,
      class: className,
      section,
      academicYear,
      purpose,
      issueDate,
      validUntil,
      additionalNotes,
      percentage,
      attendance
    } = req.body;

    // Validate student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    // Generate certificate ID
    const certificateId = await Certificate.generateCertificateId();

    // Create certificate
    const certificate = new Certificate({
      certificateId,
      studentId: student._id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      admissionNumber: student.admissionNumber,
      certificateType,
      class: className,
      section,
      academicYear,
      purpose,
      issueDate: issueDate || new Date(),
      validUntil,
      additionalNotes,
      percentage,
      attendance,
      requestedBy: req.user?.id,
      status: req.user?.role === 'admin' ? 'Approved' : 'Pending',
      schoolId: req.user?.schoolId
    });

    // Generate QR Code
    const qrData = certificate.verificationUrl;
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    certificate.qrCode = qrCodeDataUrl;

    // If admin creates, auto-approve
    if (req.user?.role === 'admin') {
      certificate.approvedBy = req.user.id;
      certificate.approvedAt = new Date();
      certificate.status = 'Issued';
      certificate.isVerified = true;
    }

    await certificate.save();

    // Populate student details
    await certificate.populate('studentId', 'name admissionNumber rollNumber class');
    await certificate.populate('requestedBy', 'name role');

    res.status(201).json({
      success: true,
      message: 'Certificate created successfully',
      data: certificate
    });

  } catch (error) {
    console.error('Error creating certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create certificate',
      error: error.message
    });
  }
};

/**
 * Get all certificates with filters
 * GET /api/certificates
 */
export const getCertificates = async (req, res) => {
  try {
    const {
      status,
      certificateType,
      studentId,
      academicYear,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (status) query.status = status;
    if (certificateType) query.certificateType = certificateType;
    if (studentId) query.studentId = studentId;
    if (academicYear) query.academicYear = academicYear;
    
    if (search) {
      query.$or = [
        { certificateId: new RegExp(search, 'i') },
        { studentName: new RegExp(search, 'i') },
        { rollNumber: new RegExp(search, 'i') },
        { admissionNumber: new RegExp(search, 'i') }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Execute query
    const [certificates, total] = await Promise.all([
      Certificate.find(query)
        .populate('studentId', 'name admissionNumber rollNumber class section')
        .populate('requestedBy', 'name role')
        .populate('approvedBy', 'name role')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Certificate.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: certificates,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch certificates',
      error: error.message
    });
  }
};

/**
 * Get certificate by ID
 * GET /api/certificates/:id
 */
export const getCertificateById = async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id)
      .populate('studentId', 'name admissionNumber rollNumber class section fatherName motherName dateOfBirth')
      .populate('requestedBy', 'name role email')
      .populate('approvedBy', 'name role email');

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    res.json({
      success: true,
      data: certificate
    });

  } catch (error) {
    console.error('Error fetching certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch certificate',
      error: error.message
    });
  }
};

/**
 * Verify certificate by certificate ID
 * GET /api/certificates/verify/:certificateId
 */
export const verifyCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;

    const certificate = await Certificate.findOne({ certificateId })
      .populate('studentId', 'name admissionNumber rollNumber class section')
      .populate('approvedBy', 'name role');

    if (!certificate) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: 'Certificate not found'
      });
    }

    // Check if certificate is valid
    const isValid = certificate.status === 'Issued' && 
                   certificate.isVerified &&
                   (!certificate.validUntil || new Date(certificate.validUntil) >= new Date());

    // Update verification count
    certificate.verificationCount += 1;
    certificate.lastVerifiedAt = new Date();
    await certificate.save();

    res.json({
      success: true,
      verified: isValid,
      data: {
        certificateId: certificate.certificateId,
        studentName: certificate.studentName,
        certificateType: certificate.certificateType,
        class: certificate.fullClass,
        academicYear: certificate.academicYear,
        issueDate: certificate.issueDate,
        validUntil: certificate.validUntil,
        status: certificate.status,
        isVerified: certificate.isVerified,
        approvedBy: certificate.approvedBy?.name,
        verificationCount: certificate.verificationCount
      }
    });

  } catch (error) {
    console.error('Error verifying certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify certificate',
      error: error.message
    });
  }
};

/**
 * Approve certificate
 * PUT /api/certificates/:id/approve
 */
export const approveCertificate = async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    if (certificate.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Certificate is already ${certificate.status.toLowerCase()}`
      });
    }

    certificate.status = 'Issued';
    certificate.approvedBy = req.user?.id;
    certificate.approvedAt = new Date();
    certificate.isVerified = true;

    await certificate.save();
    await certificate.populate('approvedBy', 'name role');

    res.json({
      success: true,
      message: 'Certificate approved successfully',
      data: certificate
    });

  } catch (error) {
    console.error('Error approving certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve certificate',
      error: error.message
    });
  }
};

/**
 * Reject certificate
 * PUT /api/certificates/:id/reject
 */
export const rejectCertificate = async (req, res) => {
  try {
    const { reason } = req.body;
    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    if (certificate.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Certificate is already ${certificate.status.toLowerCase()}`
      });
    }

    certificate.status = 'Rejected';
    certificate.rejectionReason = reason;
    certificate.approvedBy = req.user?.id;
    certificate.approvedAt = new Date();

    await certificate.save();

    res.json({
      success: true,
      message: 'Certificate rejected successfully',
      data: certificate
    });

  } catch (error) {
    console.error('Error rejecting certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject certificate',
      error: error.message
    });
  }
};

/**
 * Update certificate
 * PUT /api/certificates/:id
 */
export const updateCertificate = async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    // Only allow updates if certificate is pending
    if (certificate.status !== 'Pending' && certificate.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update issued or rejected certificate'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'purpose', 'additionalNotes', 'validUntil', 
      'percentage', 'attendance', 'certificateText'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        certificate[field] = req.body[field];
      }
    });

    await certificate.save();

    res.json({
      success: true,
      message: 'Certificate updated successfully',
      data: certificate
    });

  } catch (error) {
    console.error('Error updating certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update certificate',
      error: error.message
    });
  }
};

/**
 * Delete certificate
 * DELETE /api/certificates/:id
 */
export const deleteCertificate = async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    // Only allow deletion if certificate is pending or rejected
    if (certificate.status === 'Issued') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete issued certificate. Cancel it instead.'
      });
    }

    await certificate.deleteOne();

    res.json({
      success: true,
      message: 'Certificate deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete certificate',
      error: error.message
    });
  }
};

/**
 * Cancel certificate
 * PUT /api/certificates/:id/cancel
 */
export const cancelCertificate = async (req, res) => {
  try {
    const { reason } = req.body;
    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    certificate.status = 'Cancelled';
    certificate.rejectionReason = reason;
    certificate.isVerified = false;

    await certificate.save();

    res.json({
      success: true,
      message: 'Certificate cancelled successfully',
      data: certificate
    });

  } catch (error) {
    console.error('Error cancelling certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel certificate',
      error: error.message
    });
  }
};

/**
 * Get certificate statistics
 * GET /api/certificates/stats
 */
export const getCertificateStats = async (req, res) => {
  try {
    const { academicYear } = req.query;
    const query = academicYear ? { academicYear } : {};

    const [
      totalIssued,
      pending,
      approved,
      rejected,
      byType,
      recentCertificates
    ] = await Promise.all([
      Certificate.countDocuments({ ...query, status: 'Issued' }),
      Certificate.countDocuments({ ...query, status: 'Pending' }),
      Certificate.countDocuments({ ...query, status: 'Approved' }),
      Certificate.countDocuments({ ...query, status: 'Rejected' }),
      Certificate.aggregate([
        { $match: query },
        { $group: { _id: '$certificateType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Certificate.find(query)
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('studentId', 'name class')
        .select('certificateId certificateType status createdAt studentName')
    ]);

    const total = totalIssued + pending + approved + rejected;
    const verificationRate = total > 0 ? Math.round((totalIssued / total) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalIssued,
        pending,
        approved,
        rejected,
        total,
        verificationRate,
        certificateTypes: byType.length,
        byType,
        recentCertificates
      }
    });

  } catch (error) {
    console.error('Error fetching certificate stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch certificate statistics',
      error: error.message
    });
  }
};

/**
 * Get certificate templates
 * GET /api/certificates/templates
 */
export const getTemplates = async (req, res) => {
  try {
    const templates = [
      {
        type: 'Bonafide Certificate',
        description: 'Certifies that the student is currently enrolled',
        icon: 'FileCheck',
        template: 'This is to certify that {studentName} is a bonafide student of our institution.'
      },
      {
        type: 'Study Certificate',
        description: 'Certifies completion of a course or class',
        icon: 'GraduationCap',
        template: 'This is to certify that {studentName} has successfully completed {class}.'
      },
      {
        type: 'Character Certificate',
        description: 'Certifies good conduct and character',
        icon: 'ShieldCheck',
        template: 'This is to certify that {studentName} has maintained good conduct.'
      },
      {
        type: 'Transfer Certificate',
        description: 'Issued when student transfers to another school',
        icon: 'FileSignature',
        template: 'This is to certify that {studentName} studied in {class} and is eligible for transfer.'
      },
      {
        type: 'Attendance Certificate',
        description: 'Certifies attendance record',
        icon: 'CalendarDays',
        template: 'This is to certify that {studentName} maintained {attendance}% attendance.'
      },
      {
        type: 'Merit Certificate',
        description: 'Awarded for outstanding performance',
        icon: 'Award',
        template: 'This is to certify that {studentName} achieved outstanding performance with {percentage}%.'
      }
    ];

    res.json({
      success: true,
      data: templates
    });

  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates',
      error: error.message
    });
  }
};

/**
 * Bulk issue certificates
 * POST /api/certificates/bulk
 */
export const bulkIssueCertificates = async (req, res) => {
  try {
    const { studentIds, certificateType, academicYear, purpose } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Student IDs array is required'
      });
    }

    const students = await Student.find({ _id: { $in: studentIds } });
    
    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students found'
      });
    }

    const certificates = [];
    const errors = [];

    for (const student of students) {
      try {
        const certificateId = await Certificate.generateCertificateId();
        const verificationUrl = `${process.env.FRONTEND_URL || 'https://school.com'}/verify/${certificateId}`;
        const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl);

        const certificate = new Certificate({
          certificateId,
          studentId: student._id,
          studentName: student.name,
          rollNumber: student.rollNumber,
          admissionNumber: student.admissionNumber,
          certificateType,
          class: student.class,
          section: student.section,
          academicYear,
          purpose,
          requestedBy: req.user?.id,
          approvedBy: req.user?.id,
          approvedAt: new Date(),
          status: 'Issued',
          isVerified: true,
          qrCode: qrCodeDataUrl,
          verificationUrl
        });

        await certificate.save();
        certificates.push(certificate);
      } catch (error) {
        errors.push({
          studentId: student._id,
          studentName: student.name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `${certificates.length} certificates issued successfully`,
      data: {
        certificates,
        errors,
        total: studentIds.length,
        successful: certificates.length,
        failed: errors.length
      }
    });

  } catch (error) {
    console.error('Error bulk issuing certificates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk issue certificates',
      error: error.message
    });
  }
};
