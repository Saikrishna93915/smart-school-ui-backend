import asyncHandler from "../utils/asyncHandler.js";
import Payment from "../models/Payment.js";
import FeeStructure from "../models/FeeStructure.js";
import Receipt from "../models/Receipt.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
import FeeAudit from "../models/FeeAudit.js";
import { convertToWords } from "../utils/numberToWords.js";

// @desc    Get all fee structures
// @route   GET /api/finance/fees/structures
// @access  Private (Admin/Finance)
export const getAllFeeStructures = asyncHandler(async (req, res) => {
  try {
    const { className, status, page = 1, limit = 20 } = req.query;

    const filter = {};

    if (className) filter.className = className;
    if (status) filter.overallStatus = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const feeStructures = await FeeStructure.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort("className")
      .select("admissionNumber studentName className section totalFee totalPaid totalDue overallStatus");

    const total = await FeeStructure.countDocuments(filter);

    res.status(200).json({
      success: true,
      feeStructures,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get fee defaulters (students with pending dues)
// @route   GET /api/finance/fees/defaulters
// @access  Private (Admin/Finance)
export const getFeeDefaulters = asyncHandler(async (req, res) => {
  try {
    const { minDue = 0, className } = req.query;

    const filter = {
      totalDue: { $gt: parseFloat(minDue) },
    };

    if (className) filter.className = className;

    const defaulters = await FeeStructure.find(filter)
      .sort("-totalDue")
      .select("admissionNumber studentName className section totalFee totalPaid totalDue")
      .limit(100);

    // Calculate summary
    const totalDue = defaulters.reduce((sum, defaulter) => sum + defaulter.totalDue, 0);
    const totalFee = defaulters.reduce((sum, defaulter) => sum + defaulter.totalFee, 0);
    const totalPaid = defaulters.reduce((sum, defaulter) => sum + defaulter.totalPaid, 0);

    res.status(200).json({
      success: true,
      defaulters,
      summary: {
        totalDefaulters: defaulters.length,
        totalDue,
        totalFee,
        totalPaid,
        averageDue: defaulters.length > 0 ? totalDue / defaulters.length : 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Update fee structure for a student
// @route   PUT /api/finance/fees/structures/:admissionNumber
// @access  Private (Admin/Finance)
export const updateFeeStructureForStudent = asyncHandler(async (req, res) => {
  try {
    const { admissionNumber } = req.params;
    const { feeComponents, discountApplied, discountReason } = req.body;

    const feeStructure = await FeeStructure.findOne({ admissionNumber });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: "Fee structure not found",
      });
    }

    // Update fee components if provided
    if (feeComponents && Array.isArray(feeComponents)) {
      feeStructure.feeComponents = feeComponents;
    }

    // Update discount if provided
    if (discountApplied !== undefined) {
      feeStructure.discountApplied = parseFloat(discountApplied);
    }

    if (discountReason !== undefined) {
      feeStructure.discountReason = discountReason;
    }

    // Recalculate total fee
    feeStructure.totalFee = feeStructure.feeComponents.reduce(
      (sum, component) => sum + component.amount,
      0
    );

    // Add transport fee if opted
    if (feeStructure.transportOpted) {
      feeStructure.totalFee += feeStructure.transportFee;
    }

    await feeStructure.save();

    res.status(200).json({
      success: true,
      message: "Fee structure updated successfully",
      feeStructure,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Create fee structure for multiple students (bulk)
// @route   POST /api/finance/fees/structures/bulk
// @access  Private (Admin/Finance)
export const createBulkFeeStructures = asyncHandler(async (req, res) => {
  try {
    const { students, academicYear, feeTemplate } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Students array is required",
      });
    }

    const feeStructures = [];
    const errors = [];

    for (const studentData of students) {
      try {
        const student = await Student.findOne({
          admissionNumber: studentData.admissionNumber,
          status: "active",
        });

        if (student) {
          // Check if fee structure already exists
          const existing = await FeeStructure.findOne({
            admissionNumber: student.admissionNumber,
          });

          if (!existing) {
            const baseFee = feeTemplate?.baseFee || 15000;
            const transportFee = student.transport === "yes" ? (feeTemplate?.transportFee || 6000) : 0;
            const activityFee = feeTemplate?.activityFee || 3500;
            const examFee = feeTemplate?.examFee || 5000;
            const totalFee = baseFee + transportFee + activityFee + examFee;

            const feeStructure = await FeeStructure.create({
              admissionNumber: student.admissionNumber,
              studentId: student._id,
              studentName: `${student.student.firstName} ${student.student.lastName}`,
              className: student.class.className,
              section: student.class.section,
              academicYear: academicYear || "2024-2025",
              transportOpted: student.transport === "yes",
              transportFee: transportFee,
              feeComponents: [
                {
                  componentName: "Tuition Fee",
                  amount: baseFee,
                  dueDate: new Date("2024-12-15"),
                  isMandatory: true,
                  status: "pending",
                },
                ...(student.transport === "yes"
                  ? [
                      {
                        componentName: "Transport Fee",
                        amount: transportFee,
                        dueDate: new Date("2024-12-05"),
                        isMandatory: false,
                        status: "pending",
                      },
                    ]
                  : []),
                {
                  componentName: "Activity Fee",
                  amount: activityFee,
                  dueDate: new Date("2024-12-20"),
                  isMandatory: true,
                  status: "pending",
                },
                {
                  componentName: "Examination Fee",
                  amount: examFee,
                  dueDate: new Date("2024-12-10"),
                  isMandatory: true,
                  status: "pending",
                },
              ],
              totalFee: totalFee,
              totalPaid: 0,
              totalDue: totalFee,
            });

            feeStructures.push(feeStructure);
          }
        }
      } catch (error) {
        errors.push({
          admissionNumber: studentData.admissionNumber,
          error: error.message,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Fee structures created successfully",
      count: feeStructures.length,
      feeStructures,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get fee collection report
// @route   GET /api/finance/fees/reports/collection
// @access  Private (Admin/Finance)
export const getFeeCollectionReport = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    const matchStage = {
      status: "completed",
    };

    if (startDate || endDate) {
      matchStage.paymentDate = {};
      if (startDate) matchStage.paymentDate.$gte = new Date(startDate);
      if (endDate) matchStage.paymentDate.$lte = new Date(endDate);
    }

    let groupStage;
    if (groupBy === "day") {
      groupStage = {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" } },
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      };
    } else if (groupBy === "month") {
      groupStage = {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$paymentDate" } },
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      };
    } else if (groupBy === "class") {
      groupStage = {
        $group: {
          _id: "$className",
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      };
    } else {
      groupStage = {
        $group: {
          _id: "$paymentMethod",
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      };
    }

    const collectionReport = await Payment.aggregate([
      { $match: matchStage },
      groupStage,
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      collectionReport,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get fee summary for dashboard
// @route   GET /api/finance/fees/summary
// @access  Private (Admin/Finance)
export const getFeeSummary = asyncHandler(async (req, res) => {
  try {
    // Total fee collection
    const totalCollection = await Payment.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$netAmount" },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    // Total pending dues
    const pendingDues = await FeeStructure.aggregate([
      {
        $group: {
          _id: null,
          totalDue: { $sum: "$totalDue" },
          totalStudents: { $sum: 1 },
        },
      },
    ]);

    // Class-wise collection this month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const classWiseCollection = await Payment.aggregate([
      {
        $match: {
          status: "completed",
          paymentDate: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: "$className",
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    res.status(200).json({
      success: true,
      summary: {
        totalCollection: totalCollection[0]?.totalAmount || 0,
        totalTransactions: totalCollection[0]?.totalTransactions || 0,
        totalPendingDues: pendingDues[0]?.totalDue || 0,
        totalStudentsWithDues: pendingDues[0]?.totalStudents || 0,
      },
      classWiseCollection,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Create fee structure for a student
// @route   POST /api/fees/structure
// @access  Private (Admin)
export const createFeeStructure = asyncHandler(async (req, res) => {
  try {
    const {
      admissionNumber,
      studentId,
      studentName,
      className,
      section,
      academicYear,
      feeComponents,
      transportOpted,
      transportFee,
      totalFee,
      dueDate
    } = req.body;

    // Validate required fields
    if (!admissionNumber || !studentId || !className || !section) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: admissionNumber, studentId, className, section"
      });
    }

    // Check if fee structure already exists for this student
    const existingFee = await FeeStructure.findOne({
      admissionNumber,
      academicYear: academicYear || "2025-2026"
    });

    if (existingFee) {
      return res.status(400).json({
        success: false,
        message: "Fee structure already exists for this student in this academic year"
      });
    }

    // Create fee structure
    const hasTransportComponent = Array.isArray(feeComponents)
      ? feeComponents.some(component => component.componentName === "Transport Fee")
      : false;

    const transportComponentAmount = Array.isArray(feeComponents)
      ? feeComponents.find(component => component.componentName === "Transport Fee")?.amount
      : undefined;

    const feeStructure = await FeeStructure.create({
      admissionNumber,
      studentId,
      studentName: studentName || "",
      className,
      section,
      academicYear: academicYear || "2025-2026",
      feeComponents: feeComponents || [],
      transportOpted: hasTransportComponent || transportOpted || false,
      transportFee: transportComponentAmount ?? (transportFee || 0),
      totalFee: totalFee || 0,
      totalPaid: 0,
      totalDue: totalFee || 0,
      discountApplied: 0,
      status: 'pending',
      dueDate: dueDate || new Date(new Date().getFullYear(), 5, 30)
    });

    res.status(201).json({
      success: true,
      message: "Fee structure created successfully",
      data: feeStructure
    });
  } catch (error) {
    console.error("Fee structure creation error:", error);
    
    // Handle duplicate key error (compound index violation)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: `Fee structure already exists for student with admission number '${req.body.admissionNumber}' in academic year '${req.body.academicYear || "2025-2026"}'`
      });
    }
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || "Error creating fee structure"
    });
  }
});

// @desc    Get fee structure by student ID
// @route   GET /api/fees/structure/:studentId
// @access  Private
export const getFeeStructureByStudent = asyncHandler(async (req, res) => {
  try {
    const { studentId } = req.params;

    const feeStructure = await FeeStructure.findOne({ studentId });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: "Fee structure not found"
      });
    }

    res.status(200).json({
      success: true,
      data: feeStructure
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Update student fee structure with audit trail
// @route   PUT /api/finance/fees/update-student-fees/:admissionNumber
// @access  Private (Admin/Finance)
export const updateStudentFees = asyncHandler(async (req, res) => {
  try {
    const { admissionNumber } = req.params;
    const { 
      feeComponents, 
      reason, 
      notes, 
      actionType = "update" 
    } = req.body;

    console.log(`📝 Updating fees for ${admissionNumber}`);

    // 1. Find the student
    const student = await Student.findOne({ admissionNumber });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    // 2. Find existing fee structure
    let feeStructure = await FeeStructure.findOne({ admissionNumber });
    
    // Store previous fee structure for audit
    const previousFeeStructure = feeStructure ? {
      totalFee: feeStructure.totalFee,
      baseFee: feeStructure.feeComponents.find(c => c.componentName === 'Base Fee')?.amount || 0,
      activityFee: feeStructure.feeComponents.find(c => c.componentName === 'Activity Fee')?.amount || 0,
      examFee: feeStructure.feeComponents.find(c => c.componentName === 'Exam Fee')?.amount || 0,
      transportFee: feeStructure.feeComponents.find(c => c.componentName === 'Transport Fee')?.amount || 0,
      otherFees: feeStructure.feeComponents.find(c => c.componentName === 'Other Fees')?.amount || 0,
      feeComponents: feeStructure.feeComponents.map(c => ({
        componentName: c.componentName,
        amount: c.amount
      }))
    } : null;

    // 3. Calculate new totals
    const newTotalFee = feeComponents.reduce((sum, component) => sum + (component.amount || 0), 0);
    
    // Prepare new fee components with proper structure
    const formattedFeeComponents = feeComponents.map(component => ({
      componentName: component.componentName,
      amount: component.amount,
      dueDate: component.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isMandatory: component.isMandatory !== false,
      isRecurring: component.isRecurring || false,
      frequency: component.frequency || "one-time",
      status: component.status || "pending",
      paidAmount: component.paidAmount || 0
    }));

    // 4. Update or create fee structure
    if (feeStructure) {
      // Update existing fee structure
      feeStructure.feeComponents = formattedFeeComponents;
      feeStructure.totalFee = newTotalFee;
      feeStructure.totalDue = newTotalFee - feeStructure.totalPaid;
      
      // Update transport info if transport component exists
      const transportComponent = feeComponents.find(c => c.componentName === 'Transport Fee');
      if (transportComponent) {
        feeStructure.transportOpted = true;
        feeStructure.transportFee = transportComponent.amount;
      }
      
      await feeStructure.save();
      console.log(`✅ Fee structure updated for ${admissionNumber}`);
    } else {
      // Create new fee structure
      const className = student.class?.className || '';
      const section = student.class?.section || '';
      const academicYear = student.class?.academicYear || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1);
      
      feeStructure = new FeeStructure({
        admissionNumber,
        studentId: student._id,
        studentName: `${student.student.firstName} ${student.student.lastName}`,
        className,
        section,
        academicYear,
        feeComponents: formattedFeeComponents,
        totalFee: newTotalFee,
        totalPaid: 0,
        totalDue: newTotalFee,
        transportOpted: feeComponents.some(c => c.componentName === 'Transport Fee'),
        transportFee: feeComponents.find(c => c.componentName === 'Transport Fee')?.amount || 0,
        overallStatus: 'active'
      });
      
      await feeStructure.save();
      console.log(`✅ New fee structure created for ${admissionNumber}`);
    }

    // 5. Create new fee structure snapshot for audit
    const newFeeStructure = {
      totalFee: feeStructure.totalFee,
      baseFee: feeComponents.find(c => c.componentName === 'Base Fee')?.amount || 0,
      activityFee: feeComponents.find(c => c.componentName === 'Activity Fee')?.amount || 0,
      examFee: feeComponents.find(c => c.componentName === 'Exam Fee')?.amount || 0,
      transportFee: feeComponents.find(c => c.componentName === 'Transport Fee')?.amount || 0,
      otherFees: feeComponents.find(c => c.componentName === 'Other Fees')?.amount || 0,
      feeComponents: feeComponents.map(c => ({
        componentName: c.componentName,
        amount: c.amount
      }))
    };

    // 6. Calculate changes summary
    const totalFeeChange = previousFeeStructure ? 
      newFeeStructure.totalFee - previousFeeStructure.totalFee : 
      newFeeStructure.totalFee;
    
    const componentsChanged = [];
    if (previousFeeStructure) {
      feeComponents.forEach(newComp => {
        const oldComp = previousFeeStructure.feeComponents.find(c => c.componentName === newComp.componentName);
        if (!oldComp || oldComp.amount !== newComp.amount) {
          componentsChanged.push(newComp.componentName);
        }
      });
    } else {
      componentsChanged.push(...feeComponents.map(c => c.componentName));
    }

    const changesSummary = {
      totalFeeChange,
      componentsChanged,
      reason: reason || 'Standard fee update',
      adjustmentType: totalFeeChange > 0 ? 'increase' : totalFeeChange < 0 ? 'decrease' : 'no_change'
    };

    // 7. Log audit trail
    const auditData = {
      admissionNumber,
      studentId: student._id,
      studentName: `${student.student.firstName} ${student.student.lastName}`,
      className: student.class?.className || '',
      section: student.class?.section || '',
      academicYear: student.class?.academicYear || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
      actionType,
      previousFeeStructure: previousFeeStructure || undefined,
      newFeeStructure,
      changesSummary,
      reason: reason || 'Fee structure updated',
      notes: notes || '',
      performedBy: req.user._id,
      performedByName: req.user.name || req.user.username,
      performedByRole: req.user.role || 'admin',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      affectedFeeStructureId: feeStructure._id,
      approvalStatus: 'approved' // Auto-approve for now
    };

    await FeeAudit.logFeeChange(auditData);

    // 8. Return success response
    res.status(200).json({
      success: true,
      message: `Fee structure ${previousFeeStructure ? 'updated' : 'created'} successfully`,
      data: {
        feeStructure: {
          _id: feeStructure._id,
          admissionNumber: feeStructure.admissionNumber,
          studentName: feeStructure.studentName,
          className: feeStructure.className,
          section: feeStructure.section,
          totalFee: feeStructure.totalFee,
          totalPaid: feeStructure.totalPaid,
          totalDue: feeStructure.totalDue,
          feeComponents: feeStructure.feeComponents
        },
        changes: changesSummary,
        auditLogged: true
      }
    });

  } catch (error) {
    console.error("❌ Error updating student fees:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get fee change audit history for a student
// @route   GET /api/finance/fees/audit-history/:admissionNumber
// @access  Private (Admin/Finance)
export const getFeeAuditHistory = asyncHandler(async (req, res) => {
  try {
    const { admissionNumber } = req.params;
    const { limit = 50, skip = 0, actionType } = req.query;

    console.log(`📜 Fetching fee audit history for ${admissionNumber}`);

    // Get audit history
    const auditHistory = await FeeAudit.getStudentAuditHistory(admissionNumber, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      actionType
    });

    // Get total count
    const query = { admissionNumber };
    if (actionType) query.actionType = actionType;
    const totalCount = await FeeAudit.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        auditHistory: auditHistory.map(audit => ({
          id: audit._id,
          date: audit.createdAt,
          actionType: audit.actionType,
          previousTotal: audit.previousFeeStructure?.totalFee || 0,
          newTotal: audit.newFeeStructure?.totalFee || 0,
          change: audit.changesSummary?.totalFeeChange || 0,
          componentsChanged: audit.changesSummary?.componentsChanged || [],
          reason: audit.reason,
          notes: audit.notes,
          performedBy: {
            name: audit.performedByName,
            role: audit.performedByRole,
            user: audit.performedBy
          },
          approvalStatus: audit.approvalStatus,
          timestamp: audit.createdAt
        })),
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: (parseInt(skip) + auditHistory.length) < totalCount
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching audit history:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get fee structure for current student
// @route   GET /api/fees/my-fee-structure
// @access  Private (Student, Parent)
export const getMyFeeStructure = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    let student = null;

    if (req.user.role === 'parent') {
      // For parents: find student by linkedId or by children array
      const parentId = userId;
      const parentUser = await User.findById(parentId).lean();

      let studentIds = [];
      if (parentUser?.children && parentUser.children.length > 0) {
        studentIds = parentUser.children;
      } else if (parentUser?.linkedId) {
        studentIds = [parentUser.linkedId];
      } else {
        // Fallback: find students by parent email/phone
        const email = parentUser?.email?.toLowerCase();
        if (email) {
          const students = await Student.find({
            $or: [
              { "parents.father.email": email },
              { "parents.mother.email": email }
            ],
            status: { $ne: "deleted" }
          }).lean();
          studentIds = students.map(s => s._id);
        }
      }

      if (studentIds.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No children linked to this parent account"
        });
      }

      // Return fee structure for the first (or specified) child
      const feeStructures = await FeeStructure.find({ studentId: { $in: studentIds } }).lean();
      if (feeStructures.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No fee structure found for your children"
        });
      }

      // Return all children's fee data
      const students = await Student.find({ _id: { $in: studentIds } }).lean();

      const result = feeStructures.map(fs => {
        const stu = students.find(s => String(s._id) === String(fs.studentId));
        const totalFee = fs.totalFee || 0;
        const totalPaid = fs.totalPaid || 0;
        const totalDue = Math.max(0, totalFee - totalPaid - (fs.discountApplied || 0));
        return {
          ...fs,
          studentName: stu ? `${stu.student?.firstName || ''} ${stu.student?.lastName || ''}`.trim() : 'Unknown',
          className: stu?.class?.className || '',
          section: stu?.class?.section || '',
          summary: { totalFee, totalPaid, totalDue, paidPercentage: totalFee > 0 ? (totalPaid / totalFee) * 100 : 0, discount: fs.discountApplied || 0 }
        };
      });

      return res.status(200).json({ success: true, data: result.length === 1 ? result[0] : result });
    }

    // For students: find student by userId
    student = await Student.findOne({ userId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student profile not found" });
    }

    const feeStructure = await FeeStructure.findOne({ studentId: student._id });
    if (!feeStructure) {
      return res.status(404).json({ success: false, message: "Fee structure not found for this student" });
    }

    const totalFee = feeStructure.totalFee || 0;
    const totalPaid = feeStructure.totalPaid || 0;
    const totalDue = Math.max(0, totalFee - totalPaid - (feeStructure.discountApplied || 0));
    const paidPercentage = totalFee > 0 ? (totalPaid / totalFee) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        ...feeStructure.toObject(),
        summary: { totalFee, totalPaid, totalDue, paidPercentage, discount: feeStructure.discountApplied || 0 }
      }
    });
  } catch (error) {
    console.error("❌ Error fetching student fee structure:", error);
    res.status(500).json({ success: false, message: "Failed to fetch fee structure" });
  }
});

// ===========================
// PRODUCTION-LEVEL CONTROLLERS
// ===========================

// @desc    Process student payment
// @route   POST /api/fees/pay
// @access  Private (Student)
export const processStudentPayment = asyncHandler(async (req, res) => {
  try {
    const { studentId, amount, paymentMethod, transactionId, description } = req.body;

    // Validate input
    if (!studentId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Student ID, amount, and payment method are required",
      });
    }

    // Get student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Check student dues
    const studentDues = await FeeStructure.findOne({ studentId });
    if (!studentDues || studentDues.totalDue <= 0) {
      return res.status(400).json({
        success: false,
        message: "No pending dues for this student",
      });
    }

    if (amount > studentDues.totalDue) {
      return res.status(400).json({
        success: false,
        message: `Payment amount exceeds due amount of ₹${studentDues.totalDue}`,
      });
    }

    // Generate receipt number
    const lastPayment = await Payment.findOne().sort("-receiptNumber");
    const nextReceiptNo = lastPayment
      ? "REC" + (parseInt(lastPayment.receiptNumber.substring(3)) + 1)
      : `REC${new Date().getFullYear()}000001`;

    // Create payment
    const payment = await Payment.create({
      studentId,
      admissionNumber: student.admissionNumber,
      studentName: `${student.student?.firstName} ${student.student?.lastName}`,
      className: student.class?.className,
      section: student.class?.section,
      amount,
      paymentMethod,
      transactionId,
      receiptNumber: nextReceiptNo,
      status: "completed",
      paymentDate: new Date(),
      description,
    });

    // Update fee structure
    studentDues.totalPaid = (studentDues.totalPaid || 0) + amount;
    studentDues.totalDue = Math.max(0, studentDues.totalDue - amount);
    await studentDues.save();

    // Create receipt
    const receipt = await Receipt.create({
      receiptNo: nextReceiptNo,
      studentId,
      paymentId: payment._id,
      amount,
      paymentMethod,
      date: new Date(),
      status: "generated",
    });

    res.status(201).json({
      success: true,
      message: "Payment processed successfully",
      data: {
        payment,
        receipt,
        receiptNumber: nextReceiptNo,
      },
    });
  } catch (error) {
    console.error("Payment processing error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get student payment history
// @route   GET /api/fees/history/:studentId
// @access  Private (Student)
export const getPaymentHistory = asyncHandler(async (req, res) => {
  try {
    const { studentId } = req.params;

    const payments = await Payment.find({
      studentId,
      status: "completed",
    }).sort("-paymentDate");

    res.status(200).json({
      success: true,
      data: payments,
      count: payments.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Download receipt as PDF
// @route   GET /api/fees/receipts/download/:paymentId
// @access  Private (Student)
export const downloadReceiptPDF = asyncHandler(async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Return receipt data (for PDF generation, use pdfkit or similar)
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=receipt_${payment.receiptNumber}.json`
    );

    res.status(200).json({
      receiptNumber: payment.receiptNumber,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      studentName: payment.studentName,
      admissionNumber: payment.admissionNumber,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get fees analytics
// @route   GET /api/fees/analytics
// @access  Private (Admin/Accountant)
export const getFeesAnalytics = asyncHandler(async (req, res) => {
  try {
    const { academicYear } = req.query;

    // Total revenue
    const totalRevenue = await Payment.aggregate([
      { $match: { status: "completed", ...(academicYear && { academicYear }) } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Total dues
    const totalDues = await FeeStructure.aggregate([
      { $group: { _id: null, total: { $sum: "$totalDue" } } },
    ]);

    // Payment trend
    const paymentTrend = await Payment.aggregate([
      { $match: { status: "completed", ...(academicYear && { academicYear }) } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$paymentDate" } },
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: totalRevenue[0]?.total || 0,
        totalDues: totalDues[0]?.total || 0,
        collectionRate: totalRevenue[0]
          ? (
              (totalRevenue[0].total /
                (totalRevenue[0].total + (totalDues[0]?.total || 0))) *
              100
            ).toFixed(2)
          : 0,
        paymentTrend,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Export payments as CSV
// @route   GET /api/fees/export/csv
// @access  Private (Admin/Accountant)
export const exportPaymentsCSV = asyncHandler(async (req, res) => {
  try {
    const { academicYear } = req.query;

    const payments = await Payment.find({
      status: "completed",
      ...(academicYear && { academicYear }),
    }).sort("-paymentDate");

    let csv = "Receipt No,Student Name,Admission No,Amount,Method,Date\n";
    payments.forEach((payment) => {
      csv += `${payment.receiptNumber},"${payment.studentName}",${payment.admissionNumber},${payment.amount},${payment.paymentMethod},"${payment.paymentDate.toLocaleDateString()}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=payments${academicYear ? "_" + academicYear : ""}.csv`
    );

    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});