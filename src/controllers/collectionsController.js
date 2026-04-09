// src/controllers/collectionsController.js
import asyncHandler from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Student from "../models/Student.js";

// @desc    Get all collections with filters
// @route   GET /api/finance/collections
// @access  Private (Admin/Finance)
export const getCollections = asyncHandler(async (req, res) => {
  try {
    console.log("📊 Getting collections with filters:", req.query);
    
    const {
      search,
      className,
      status,
      paymentMethod,
      startDate,
      endDate,
      collectedBy,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build match stage - EXACT matching for all filters
    const matchStage = {};

    // Base status filter (exclude cancelled)
    matchStage.status = { $ne: 'cancelled' };

    // CRITICAL: Normalize all filters to handle case and whitespace consistently
    const normalizedClassName = className ? className.trim() : '';
    const normalizedStatus = status ? status.trim().toLowerCase() : '';
    const normalizedPaymentMethod = paymentMethod ? paymentMethod.trim().toLowerCase().replace('_', '-') : '';

    // Class filter - EXACT string match (case-insensitive via aggregation)
    if (normalizedClassName && normalizedClassName !== 'all classes') {
      if (!matchStage.$and) matchStage.$and = [];
      matchStage.$and.push({
        $expr: {
          $eq: [
            { $toLower: { $ifNull: ['$className', ''] } },
            normalizedClassName.toLowerCase()
          ]
        }
      });
    }

    // Status filter - EXACT match with proper enum values
    if (normalizedStatus && normalizedStatus !== 'all status') {
      let statusFilter;
      if (normalizedStatus === 'completed') {
        statusFilter = 'completed';
      } else if (normalizedStatus === 'pending') {
        statusFilter = { $in: ['pending', 'partial'] };
      } else if (normalizedStatus === 'failed') {
        statusFilter = { $in: ['failed', 'cancelled'] };
      } else {
        statusFilter = normalizedStatus;
      }
      if (!matchStage.$and) matchStage.$and = [];
      matchStage.$and.push({ status: statusFilter });
    }

    // Payment method filter - EXACT match with normalization
    if (normalizedPaymentMethod && normalizedPaymentMethod !== 'all methods') {
      if (!matchStage.$and) matchStage.$and = [];
      matchStage.$and.push({
        $expr: {
          $eq: [
            { $toLower: { $ifNull: ['$paymentMethod', ''] } },
            normalizedPaymentMethod
          ]
        }
      });
    }

    // Date range filter
    if (startDate || endDate) {
      matchStage.paymentDate = {};
      if (startDate) {
        matchStage.paymentDate.$gte = new Date(startDate);
      }
      if (endDate) {
        matchStage.paymentDate.$lte = new Date(endDate);
      }
    }

    // Collected by filter - CRITICAL FIX: Use $and to avoid overwriting search filter
    if (collectedBy && collectedBy !== 'All Collectors') {
      if (!matchStage.$and) matchStage.$and = [];
      matchStage.$and.push({
        $or: [
          { recordedByName: { $regex: collectedBy, $options: 'i' } },
          { recordedBy: collectedBy }
        ]
      });
    }

    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');

    // Build pipeline
    const pipeline = [
      // Stage 1: Match conditions
      { $match: matchStage },

      // Stage 2: Lookup student details
      {
        $lookup: {
          from: 'students',
          localField: 'admissionNumber',
          foreignField: 'admissionNumber',
          as: 'studentDetails'
        }
      },
      {
        $unwind: {
          path: '$studentDetails',
          preserveNullAndEmptyArrays: true
        }
      },

      // Stage 3: Add computed fields
      {
        $addFields: {
          studentId: '$admissionNumber',
          fullName: {
            $cond: {
              if: { $ne: ['$studentName', null] },
              then: '$studentName',
              else: {
                $concat: [
                  { $ifNull: ['$studentDetails.student.firstName', ''] },
                  ' ',
                  { $ifNull: ['$studentDetails.student.lastName', ''] }
                ]
              }
            }
          },
          className: {
            $cond: {
              if: { $ne: ['$className', null] },
              then: '$className',
              else: { $ifNull: ['$studentDetails.className', 'N/A'] }
            }
          },
          section: {
            $cond: {
              if: { $ne: ['$section', null] },
              then: '$section',
              else: { $ifNull: ['$studentDetails.section', 'N/A'] }
            }
          },
          rollNo: { $ifNull: ['$studentDetails.rollNo', 'N/A'] },
          parentName: {
            $cond: {
              if: { $ne: ['$parentName', null] },
              then: '$parentName',
              else: {
                $ifNull: [
                  '$studentDetails.parents.father.name',
                  '$studentDetails.parents.mother.name',
                  'N/A'
                ]
              }
            }
          },
          parentPhone: {
            $cond: {
              if: { $ne: ['$parentPhone', null] },
              then: '$parentPhone',
              else: {
                $ifNull: [
                  '$studentDetails.parents.father.phone',
                  '$studentDetails.parents.mother.phone',
                  'N/A'
                ]
              }
            }
          },
          parentEmail: {
            $cond: {
              if: { $ne: ['$parentEmail', null] },
              then: '$parentEmail',
              else: {
                $ifNull: [
                  '$studentDetails.parents.father.email',
                  '$studentDetails.parents.mother.email',
                  'N/A'
                ]
              }
            }
          },
          // Format date for display
          formattedDate: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$paymentDate"
            }
          }
        }
      },

      // Stage 4: Project only needed fields
      {
        $project: {
          _id: 1,
          receiptNumber: 1,
          studentId: 1,
          studentName: '$fullName',
          className: 1,
          section: 1,
          rollNo: 1,
          parentName: 1,
          parentPhone: 1,
          parentEmail: 1,
          amount: { $ifNull: ['$netAmount', '$amount'] },
          totalAmount: 1,
          paidAmount: 1,
          dueAmount: 1,
          paymentMethod: 1,
          paymentDate: 1,
          formattedDate: 1,
          status: 1,
          description: 1,
          collectedBy: { $ifNull: ['$recordedByName', 'System'] },
          recordedBy: 1,
          createdAt: 1,
          updatedAt: 1,
          isDefaulterPayment: { $ifNull: ['$isDefaulterPayment', false] },
          notes: '$description'
        }
      }
    ];

    // Stage 5: Get total count
    const countPipeline = [...pipeline];
    countPipeline.push({ $count: 'total' });
    
    const countResult = await paymentsCollection.aggregate(countPipeline).toArray();
    const total = countResult[0]?.total || 0;

    // Stage 6: Add sorting - CRITICAL: Default to createdAt for proper ordering
    const sortStage = {};
    if (sortBy === 'createdAt') {
      sortStage.createdAt = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'paymentDate') {
      sortStage.paymentDate = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'amount') {
      sortStage.amount = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'studentName') {
      sortStage.studentName = sortOrder === 'asc' ? 1 : -1;
    } else {
      // CRITICAL: Default to createdAt descending (latest first)
      sortStage.createdAt = -1;
    }
    pipeline.push({ $sort: sortStage });

    // Stage 7: Add pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push(
      { $skip: skip },
      { $limit: parseInt(limit) }
    );

    console.log('🔍 Collections pipeline built');

    // Execute aggregation
    const collections = await paymentsCollection.aggregate(pipeline).toArray();

    // Calculate statistics
    const statsPipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: { $ifNull: ['$netAmount', '$amount', 0] } },
          totalCollections: { $sum: 1 },
          completedAmount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'completed'] },
                { $ifNull: ['$netAmount', '$amount', 0] },
                0
              ]
            }
          },
          completedCount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'completed'] },
                1,
                0
              ]
            }
          },
          pendingAmount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'pending'] },
                { $ifNull: ['$netAmount', '$amount', 0] },
                0
              ]
            }
          },
          pendingCount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'pending'] },
                1,
                0
              ]
            }
          }
        }
      }
    ];

    const statsResult = await paymentsCollection.aggregate(statsPipeline).toArray();
    const stats = statsResult[0] || {
      totalAmount: 0,
      totalCollections: 0,
      completedAmount: 0,
      completedCount: 0,
      pendingAmount: 0,
      pendingCount: 0
    };

    // Calculate success rate
    const successRate = stats.totalCollections > 0 
      ? (stats.completedCount / stats.totalCollections) * 100 
      : 0;

    // Get payment method distribution
    const methodPipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ['$netAmount', '$amount', 0] } }
        }
      },
      { $sort: { amount: -1 } }
    ];

    const methodDistribution = await paymentsCollection.aggregate(methodPipeline).toArray();

    // Get monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const trendPipeline = [
      {
        $match: {
          ...matchStage,
          paymentDate: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$paymentDate' }
          },
          amount: { $sum: { $ifNull: ['$netAmount', '$amount', 0] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const monthlyTrend = await paymentsCollection.aggregate(trendPipeline).toArray();

    console.log(`✅ Found ${collections.length} collections out of ${total} total`);

    res.status(200).json({
      success: true,
      collections,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      statistics: {
        totalAmount: stats.totalAmount,
        totalCollections: stats.totalCollections,
        completedAmount: stats.completedAmount,
        completedCount: stats.completedCount,
        pendingAmount: stats.pendingAmount,
        pendingCount: stats.pendingCount,
        successRate: Math.round(successRate * 100) / 100
      },
      distributions: {
        methodDistribution,
        monthlyTrend
      }
    });

  } catch (error) {
    console.error('❌ Get collections error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get unique class names for filter dropdown
// @route   GET /api/finance/collections/classes
// @access  Private (Admin/Finance)
export const getCollectionClasses = asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  const paymentsCollection = db.collection('payments');

  // Get unique class names using aggregation
  const classes = await paymentsCollection.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $group: { _id: '$className' } },
    { $sort: { _id: 1 } }
  ]).toArray();

  // Filter out null/empty class names and return clean array
  const uniqueClasses = classes
    .map(c => c._id)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  res.json({
    success: true,
    data: {
      classes: uniqueClasses
    }
  });
});

// @desc    Get collection details
// @route   GET /api/finance/collections/:receiptNumber
// @access  Private (Admin/Finance)
export const getCollectionDetails = asyncHandler(async (req, res) => {
  try {
    const { receiptNumber } = req.params;

    console.log(`🔍 Getting collection details for: ${receiptNumber}`);

    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');
    const studentsCollection = db.collection('students');

    // Get payment
    const payment = await paymentsCollection.findOne({
      receiptNumber,
      paymentType: { $in: ['receipt', 'payment', 'installment'] }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    // Get student details
    const student = await studentsCollection.findOne({
      admissionNumber: payment.admissionNumber
    });

    // Get related payments (if any)
    const relatedPayments = await paymentsCollection.find({
      admissionNumber: payment.admissionNumber,
      paymentType: { $in: ['receipt', 'payment'] },
      _id: { $ne: payment._id }
    }).sort({ paymentDate: -1 }).limit(5).toArray();

    // Get due installments (if any)
    const dueInstallments = await paymentsCollection.find({
      admissionNumber: payment.admissionNumber,
      paymentType: { $in: ['installment', null, undefined] },
      dueAmount: { $gt: 0 }
    }).toArray();

    const response = {
      success: true,
      collection: {
        _id: payment._id,
        receiptNumber: payment.receiptNumber,
        studentId: payment.admissionNumber,
        studentName: payment.studentName || 
                    (student ? `${student.student?.firstName || ''} ${student.student?.lastName || ''}`.trim() : 'Unknown'),
        className: payment.className || student?.className || 'Unknown',
        section: payment.section || student?.section || 'N/A',
        rollNo: student?.rollNo || 'N/A',
        parentName: payment.parentName || 
                   student?.parents?.father?.name || 
                   student?.parents?.mother?.name || 
                   'N/A',
        parentPhone: payment.parentPhone || 
                    student?.parents?.father?.phone || 
                    student?.parents?.mother?.phone || 
                    'N/A',
        parentEmail: payment.parentEmail || 
                    student?.parents?.father?.email || 
                    student?.parents?.mother?.email || 
                    'N/A',
        address: student?.address || 'N/A',
        amount: payment.netAmount || payment.amount || 0,
        totalAmount: payment.totalAmount || payment.amount || 0,
        paidAmount: payment.paidAmount || payment.amount || 0,
        dueAmount: payment.dueAmount || 0,
        paymentMethod: payment.paymentMethod || 'cash',
        paymentDate: payment.paymentDate || payment.createdAt,
        status: payment.status || 'completed',
        description: payment.description || '',
        collectedBy: payment.recordedByName || 'System',
        recordedById: payment.recordedBy,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        isDefaulterPayment: payment.isDefaulterPayment || false,
        notes: payment.description || '',
        relatedPayments: relatedPayments.map(p => ({
          receiptNumber: p.receiptNumber,
          amount: p.netAmount || p.amount || 0,
          paymentDate: p.paymentDate || p.createdAt,
          paymentMethod: p.paymentMethod || 'cash',
          status: p.status || 'completed'
        })),
        dueInstallments: dueInstallments.map(i => ({
          componentName: i.componentName || 'Fee Installment',
          totalAmount: i.totalAmount || i.amount || 0,
          paidAmount: i.paidAmount || 0,
          dueAmount: i.dueAmount || 0,
          dueDate: i.dueDate || i.createdAt,
          status: i.status || 'pending'
        }))
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Get collection details error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Update collection status
// @route   PUT /api/finance/collections/:receiptNumber/status
// @access  Private (Admin/Finance)
export const updateCollectionStatus = asyncHandler(async (req, res) => {
  try {
    const { receiptNumber } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const validStatuses = ['completed', 'pending', 'failed', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');

    // Get current payment
    const payment = await paymentsCollection.findOne({ receiptNumber });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    // Prepare update data
    const updateData = {
      status,
      updatedAt: new Date()
    };

    // Add notes if provided
    if (notes) {
      updateData.description = notes;
      updateData.statusNotes = notes;
    }

    // If marking as refunded, also mark related due payments and log the action
    if (status === 'refunded') {
      // CRITICAL: Log refund action for audit trail
      console.log(`⚠️ REFUND: Receipt ${receiptNumber} (₹${payment.amount}) refunded by ${req.user.name} (${req.user.role}). Admission: ${payment.admissionNumber}`);

      // Find related installments and mark as pending
      await paymentsCollection.updateMany(
        {
          admissionNumber: payment.admissionNumber,
          paymentType: { $in: ['installment', null, undefined] },
          receiptNumber: { $ne: receiptNumber }
        },
        {
          $set: {
            status: 'pending',
            updatedAt: new Date()
          }
        }
      );

      updateData.refundedAt = new Date();
      updateData.refundedBy = req.user._id;
      updateData.refundedByName = req.user.name || req.user.username;
    }

    // Update payment
    const result = await paymentsCollection.updateOne(
      { receiptNumber },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update collection status'
      });
    }

    // Get updated payment
    const updatedPayment = await paymentsCollection.findOne({ receiptNumber });

    res.status(200).json({
      success: true,
      message: `Collection status updated to ${status}`,
      collection: updatedPayment
    });

  } catch (error) {
    console.error('❌ Update collection status error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Export collections to CSV
// @route   GET /api/finance/collections/export
// @access  Private (Admin/Finance)
export const exportCollections = asyncHandler(async (req, res) => {
  try {
    console.log("📤 Exporting collections");
    
    const {
      search,
      className,
      status,
      paymentMethod,
      startDate,
      endDate
    } = req.query;

    // Build match stage
    const matchStage = {
      paymentType: { $in: ['receipt', 'payment', 'installment', null, undefined] },
      status: { $ne: 'cancelled' }
    };

    if (search && search.trim()) {
      matchStage.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
        { receiptNumber: { $regex: search, $options: 'i' } }
      ];
    }

    if (className && className !== 'All Classes') {
      matchStage.className = className;
    }

    if (status && status !== 'All Status') {
      if (status === 'completed') {
        matchStage.status = 'completed';
      } else if (status === 'pending') {
        matchStage.$or = [
          { status: 'pending' },
          { status: 'partial' }
        ];
      } else if (status === 'failed') {
        matchStage.$or = [
          { status: 'failed' },
          { status: 'cancelled' }
        ];
      }
    }

    if (paymentMethod && paymentMethod !== 'All Methods') {
      matchStage.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      matchStage.paymentDate = {};
      if (startDate) {
        matchStage.paymentDate.$gte = new Date(startDate);
      }
      if (endDate) {
        matchStage.paymentDate.$lte = new Date(endDate);
      }
    }

    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');

    // Get collections with minimal data for export
    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'students',
          localField: 'admissionNumber',
          foreignField: 'admissionNumber',
          as: 'studentDetails'
        }
      },
      {
        $unwind: {
          path: '$studentDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          receiptNumber: 1,
          admissionNumber: 1,
          studentName: 1,
          className: 1,
          section: 1,
          rollNo: '$studentDetails.rollNo',
          parentName: {
            $ifNull: [
              '$parentName',
              '$studentDetails.parents.father.name',
              '$studentDetails.parents.mother.name',
              'N/A'
            ]
          },
          parentPhone: {
            $ifNull: [
              '$parentPhone',
              '$studentDetails.parents.father.phone',
              '$studentDetails.parents.mother.phone',
              'N/A'
            ]
          },
          amount: { $ifNull: ['$netAmount', '$amount'] },
          paymentMethod: 1,
          paymentDate: 1,
          status: 1,
          collectedBy: { $ifNull: ['$recordedByName', 'System'] },
          description: 1
        }
      },
      { $sort: { paymentDate: -1 } }
    ];

    const collections = await paymentsCollection.aggregate(pipeline).toArray();

    if (collections.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No collections found to export'
      });
    }

    // Generate CSV content
    const headers = [
      'Receipt Number',
      'Admission Number',
      'Student Name',
      'Class',
      'Section',
      'Roll No',
      'Parent Name',
      'Parent Phone',
      'Amount',
      'Payment Method',
      'Payment Date',
      'Status',
      'Collected By',
      'Description'
    ];

    const rows = collections.map(collection => [
      collection.receiptNumber || '',
      collection.admissionNumber || '',
      collection.studentName || '',
      collection.className || '',
      collection.section || '',
      collection.rollNo || '',
      collection.parentName || '',
      collection.parentPhone || '',
      collection.amount || 0,
      collection.paymentMethod || '',
      collection.paymentDate ? new Date(collection.paymentDate).toISOString().split('T')[0] : '',
      collection.status || '',
      collection.collectedBy || '',
      collection.description || ''
    ]);

    // CRITICAL: CSV injection prevention - sanitize fields starting with =, +, -, @
    const sanitizeCSV = (val) => {
      const str = String(val).replace(/"/g, '""');
      // Prevent CSV injection (Excel formula execution)
      if (/^[=+\-@]/.test(str)) return "'" + str;
      return str;
    };

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${sanitizeCSV(cell)}"`).join(','))
      .join('\n');

    // Set response headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=collections-${new Date().toISOString().split('T')[0]}.csv`);
    
    console.log(`✅ Export API: Exported ${collections.length} collections`);
    
    res.status(200).send(csvContent);

  } catch (error) {
    console.error('❌ Export collections error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get collections statistics
// @route   GET /api/finance/collections/statistics
// @access  Private (Admin/Finance)
export const getCollectionsStatistics = asyncHandler(async (req, res) => {
  try {
    console.log("📈 Getting collections statistics");

    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');

    // Overall statistics
    const overallPipeline = [
      {
        $match: {
          paymentType: { $in: ['receipt', 'payment', 'installment', null, undefined] },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: { $ifNull: ['$netAmount', '$amount', 0] } },
          totalCollections: { $sum: 1 },
          avgAmount: { $avg: { $ifNull: ['$netAmount', '$amount', 0] } }
        }
      }
    ];

    const overallResult = await paymentsCollection.aggregate(overallPipeline).toArray();

    // Today's collections
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayPipeline = [
      {
        $match: {
          paymentType: { $in: ['receipt', 'payment'] },
          status: 'completed',
          paymentDate: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          amount: { $sum: { $ifNull: ['$netAmount', '$amount', 0] } },
          count: { $sum: 1 }
        }
      }
    ];

    const todayResult = await paymentsCollection.aggregate(todayPipeline).toArray();

    // This month's collections
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const monthPipeline = [
      {
        $match: {
          paymentType: { $in: ['receipt', 'payment'] },
          status: 'completed',
          paymentDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          amount: { $sum: { $ifNull: ['$netAmount', '$amount', 0] } },
          count: { $sum: 1 }
        }
      }
    ];

    const monthResult = await paymentsCollection.aggregate(monthPipeline).toArray();

    // Weekly trend (last 4 weeks)
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const weeklyPipeline = [
      {
        $match: {
          paymentType: { $in: ['receipt', 'payment'] },
          status: 'completed',
          paymentDate: { $gte: fourWeeksAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%W', date: '$paymentDate' }
          },
          amount: { $sum: { $ifNull: ['$netAmount', '$amount', 0] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 4 }
    ];

    const weeklyTrend = await paymentsCollection.aggregate(weeklyPipeline).toArray();

    // Top collectors
    const collectorsPipeline = [
      {
        $match: {
          paymentType: { $in: ['receipt', 'payment'] },
          status: 'completed',
          recordedByName: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$recordedByName',
          amount: { $sum: { $ifNull: ['$netAmount', '$amount', 0] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { amount: -1 } },
      { $limit: 5 }
    ];

    const topCollectors = await paymentsCollection.aggregate(collectorsPipeline).toArray();

    res.status(200).json({
      success: true,
      statistics: {
        overall: overallResult[0] || {
          totalAmount: 0,
          totalCollections: 0,
          avgAmount: 0
        },
        today: todayResult[0] || {
          amount: 0,
          count: 0
        },
        thisMonth: monthResult[0] || {
          amount: 0,
          count: 0
        },
        weeklyTrend,
        topCollectors,
        successRate: overallResult[0]?.totalCollections > 0 
          ? (todayResult[0]?.count || 0) / overallResult[0].totalCollections * 100 
          : 0
      }
    });

  } catch (error) {
    console.error('❌ Get collections statistics error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Print/Download receipt
// @route   GET /api/finance/collections/:receiptNumber/receipt
// @access  Private (Admin/Finance)
export const downloadReceipt = asyncHandler(async (req, res) => {
  try {
    const { receiptNumber } = req.params;
    const { format = 'pdf' } = req.query;

    console.log(`🖨️ Generating receipt for: ${receiptNumber} in ${format} format`);

    // Get collection details
    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');
    const studentsCollection = db.collection('students');

    const payment = await paymentsCollection.findOne({ receiptNumber });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    const student = await studentsCollection.findOne({
      admissionNumber: payment.admissionNumber
    });

    // Prepare receipt data
    const receiptData = {
      receiptNumber: payment.receiptNumber,
      date: new Date(payment.paymentDate || payment.createdAt).toLocaleDateString(),
      time: new Date(payment.paymentDate || payment.createdAt).toLocaleTimeString(),
      student: {
        name: payment.studentName || 
              (student ? `${student.student?.firstName || ''} ${student.student?.lastName || ''}`.trim() : 'Unknown'),
        admissionNumber: payment.admissionNumber,
        className: payment.className || student?.className || 'Unknown',
        section: payment.section || student?.section || 'N/A',
        rollNo: student?.rollNo || 'N/A'
      },
      parent: {
        name: payment.parentName || 
              student?.parents?.father?.name || 
              student?.parents?.mother?.name || 
              'N/A'
      },
      payment: {
        amount: payment.netAmount || payment.amount || 0,
        method: payment.paymentMethod || 'Cash',
        description: payment.description || 'Fee Payment',
        status: payment.status || 'completed'
      },
      collectedBy: payment.recordedByName || 'System',
      school: {
        name: 'Smart School',
        address: '123 Education Street, Knowledge City',
        phone: '+91 9876543210',
        email: 'accounts@smartschool.edu'
      }
    };

    if (format === 'json') {
      // Return JSON data
      res.status(200).json({
        success: true,
        receipt: receiptData
      });
    } else if (format === 'html') {
      // Generate HTML receipt
      const htmlReceipt = generateHTMLReceipt(receiptData);
      
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename=receipt-${receiptNumber}.html`);
      res.status(200).send(htmlReceipt);
    } else {
      // For PDF, return data that frontend can use to generate PDF
      res.status(200).json({
        success: true,
        receipt: receiptData,
        message: 'Use this data to generate PDF on frontend'
      });
    }

  } catch (error) {
    console.error('❌ Download receipt error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Helper function to generate HTML receipt
const generateHTMLReceipt = (data) => {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Receipt - ${data.receiptNumber}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .receipt { border: 2px solid #000; padding: 30px; max-width: 600px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
        .school-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .receipt-title { font-size: 20px; margin: 20px 0; }
        .section { margin-bottom: 20px; }
        .section-title { font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .label { font-weight: bold; }
        .amount { font-size: 18px; font-weight: bold; text-align: right; margin: 20px 0; }
        .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #666; }
        .signature { margin-top: 40px; border-top: 1px solid #000; padding-top: 20px; text-align: right; }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            <div class="school-name">${data.school.name}</div>
            <div>${data.school.address}</div>
            <div>Phone: ${data.school.phone} | Email: ${data.school.email}</div>
        </div>
        
        <div class="receipt-title">FEE PAYMENT RECEIPT</div>
        
        <div class="section">
            <div class="section-title">Receipt Information</div>
            <div class="row">
                <span class="label">Receipt No:</span>
                <span>${data.receiptNumber}</span>
            </div>
            <div class="row">
                <span class="label">Date:</span>
                <span>${data.date}</span>
            </div>
            <div class="row">
                <span class="label">Time:</span>
                <span>${data.time}</span>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Student Information</div>
            <div class="row">
                <span class="label">Student Name:</span>
                <span>${data.student.name}</span>
            </div>
            <div class="row">
                <span class="label">Admission No:</span>
                <span>${data.student.admissionNumber}</span>
            </div>
            <div class="row">
                <span class="label">Class:</span>
                <span>${data.student.className} - ${data.student.section}</span>
            </div>
            <div class="row">
                <span class="label">Roll No:</span>
                <span>${data.student.rollNo}</span>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Payment Information</div>
            <div class="row">
                <span class="label">Payment Method:</span>
                <span>${data.payment.method}</span>
            </div>
            <div class="row">
                <span class="label">Description:</span>
                <span>${data.payment.description}</span>
            </div>
            <div class="row">
                <span class="label">Status:</span>
                <span>${data.payment.status.toUpperCase()}</span>
            </div>
        </div>
        
        <div class="amount">
            Amount Paid: ₹${data.payment.amount.toLocaleString('en-IN')}
        </div>
        
        <div class="signature">
            <div>Collected By: ${data.collectedBy}</div>
            <div style="margin-top: 30px;">Authorized Signature</div>
        </div>
        
        <div class="footer">
            This is a computer generated receipt. No signature required.<br>
            ${data.school.name} | ${data.school.address}
        </div>
    </div>
</body>
</html>
  `;
};