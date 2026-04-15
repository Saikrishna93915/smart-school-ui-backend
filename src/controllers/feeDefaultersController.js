// src/controllers/feeDefaultersController.js - FIXED VERSION
import asyncHandler from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import FeeStructure from "../models/FeeStructure.js";
import Student from "../models/Student.js";
import { getDefaulterThresholds } from "../services/configService.js";

// @desc    Get fee defaulters with advanced filters
// @route   GET /api/finance/fee-defaulters
// @access  Private (Admin/Finance)
export const getFeeDefaulters = asyncHandler(async (req, res) => {
  try {
    console.log("📊 Getting fee defaulters with filters:", req.query);
    
    const {
      search,
      className,
      status,
      priority,
      daysOverdue,
      minAmount,
      maxAmount,
      page = 1,
      limit = 20,
      sortBy = 'daysOverdue',
      sortOrder = 'desc'
    } = req.query;

    // Get current date for overdue calculation
    const currentDate = new Date();
    
    // Direct MongoDB query for performance
    const db = mongoose.connection.db;
    const feeStructureCollection = db.collection('feestructures');

    // Build base pipeline
    const pipeline = [];

    // Step 1: Lookup fee structures with due amounts
    pipeline.push({
      $match: {
        totalDue: { $gt: 0 },
        status: { $ne: 'inactive' }
      }
    });

    // Step 2: Lookup student details
    pipeline.push({
      $lookup: {
        from: 'students',
        localField: 'admissionNumber',
        foreignField: 'admissionNumber',
        as: 'studentDetails'
      }
    });

    pipeline.push({
      $unwind: {
        path: '$studentDetails',
        preserveNullAndEmptyArrays: true
      }
    });

    // Step 3: Lookup due installments
    pipeline.push({
      $lookup: {
        from: 'payments',
        let: { admissionNumber: '$admissionNumber' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$admissionNumber', '$$admissionNumber'] },
                  { $in: ['$paymentType', ['installment', null, undefined]] },
                  { $gt: ['$dueAmount', 0] }
                ]
              }
            }
          },
          { $sort: { dueDate: 1 } }
        ],
        as: 'dueInstallments'
      }
    });

    // Step 4: Lookup recent payments
    pipeline.push({
      $lookup: {
        from: 'payments',
        let: { admissionNumber: '$admissionNumber' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$admissionNumber', '$$admissionNumber'] },
                  { $eq: ['$paymentType', 'receipt'] },
                  { $eq: ['$status', 'completed'] }
                ]
              }
            }
          },
          { $sort: { paymentDate: -1 } },
          { $limit: 5 }
        ],
        as: 'recentPayments'
      }
    });

    // Step 5: Calculate overdue days and priority - FIXED $cond syntax
    pipeline.push({
      $addFields: {
        // Calculate days overdue based on earliest due installment
        daysOverdue: {
          $let: {
            vars: {
              earliestDue: {
                $arrayElemAt: [
                  { $sortArray: { input: '$dueInstallments', sortBy: { dueDate: 1 } } },
                  0
                ]
              }
            },
            in: {
              $cond: {
                if: { $and: [
                  { $ne: ['$$earliestDue', null] },
                  { $ne: ['$$earliestDue.dueDate', null] }
                ] },
                then: {
                  $floor: {
                    $divide: [
                      { $subtract: [currentDate, '$$earliestDue.dueDate'] },
                      1000 * 60 * 60 * 24
                    ]
                  }
                },
                else: 0
              }
            }
          }
        },
        // Get latest payment date
        lastPaymentDate: {
          $cond: {
            if: { $gt: [{ $size: '$recentPayments' }, 0] },
            then: { $max: '$recentPayments.paymentDate' },
            else: null
          }
        },
        // Count reminders sent
        remindersSent: {
          $size: {
            $filter: {
              input: '$recentPayments',
              as: 'payment',
              cond: { $eq: ['$$payment.isReminder', true] }
            }
          }
        }
      }
    });

    // Get dynamic thresholds from database
    const thresholds = await getDefaulterThresholds();

    // Step 6: Calculate priority based on days overdue and amount due - FIXED $cond syntax
    pipeline.push({
      $addFields: {
        priority: {
          $switch: {
            branches: [
              {
                case: {
                  $or: [
                    { $gt: ['$daysOverdue', 30] },
                    { $gt: ['$totalDue', thresholds.critical] }
                  ]
                },
                then: 1 // Critical
              },
              {
                case: {
                  $or: [
                    { $and: [{ $gte: ['$daysOverdue', 15] }, { $lte: ['$daysOverdue', 30] }] },
                    { $and: [{ $gt: ['$totalDue', thresholds.high] }, { $lte: ['$totalDue', thresholds.critical] }] }
                  ]
                },
                then: 2 // High
              },
              {
                case: {
                  $or: [
                    { $and: [{ $gte: ['$daysOverdue', 7] }, { $lt: ['$daysOverdue', 15] }] },
                    { $and: [{ $gt: ['$totalDue', thresholds.moderate] }, { $lte: ['$totalDue', thresholds.high] }] }
                  ]
                },
                then: 3 // Moderate
              }
            ],
            default: 4 // Low
          }
        }
      }
    });

    // Step 7: Calculate status from priority - FIXED $cond syntax
    pipeline.push({
      $addFields: {
        status: {
          $switch: {
            branches: [
              { case: { $eq: ['$priority', 1] }, then: 'Critical' },
              { case: { $eq: ['$priority', 2] }, then: 'High' },
              { case: { $eq: ['$priority', 3] }, then: 'Moderate' }
            ],
            default: 'Low'
          }
        }
      }
    });

    // Step 8: Apply filters
    const matchStage = {};

    // Search filter
    if (search && search.trim()) {
      matchStage.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
        { 'studentDetails.student.firstName': { $regex: search, $options: 'i' } },
        { 'studentDetails.student.lastName': { $regex: search, $options: 'i' } },
        { 'studentDetails.parents.father.name': { $regex: search, $options: 'i' } },
        { 'studentDetails.parents.mother.name': { $regex: search, $options: 'i' } },
        { 'studentDetails.parents.father.phone': { $regex: search, $options: 'i' } }
      ];
    }

    // Class filter
    if (className && className !== 'All Classes') {
      matchStage.className = className;
    }

    // Status filter
    if (status && status !== 'All Status') {
      matchStage.status = status;
    }

    // Priority filter
    if (priority && priority !== 'All Priorities') {
      const priorityNum = parseInt(priority);
      if (!isNaN(priorityNum)) {
        matchStage.priority = priorityNum;
      }
    }

    // Days overdue filter
    if (daysOverdue) {
      if (daysOverdue === '0-15 days') {
        matchStage.daysOverdue = { $gte: 0, $lte: 15 };
      } else if (daysOverdue === '16-30 days') {
        matchStage.daysOverdue = { $gte: 16, $lte: 30 };
      } else if (daysOverdue === '31-45 days') {
        matchStage.daysOverdue = { $gte: 31, $lte: 45 };
      } else if (daysOverdue === '45+ days') {
        matchStage.daysOverdue = { $gte: 45 };
      }
    }

    // Amount range filter
    if (minAmount) {
      matchStage.totalDue = { ...matchStage.totalDue, $gte: parseFloat(minAmount) };
    }
    if (maxAmount) {
      matchStage.totalDue = { ...matchStage.totalDue, $lte: parseFloat(maxAmount) };
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Step 9: Get total count for pagination
    const countPipeline = [...pipeline];
    countPipeline.push({ $count: 'total' });
    
    const countResult = await feeStructureCollection.aggregate(countPipeline).toArray();
    const total = countResult[0]?.total || 0;

    // Step 10: Add sorting
    const sortStage = {};
    if (sortBy === 'daysOverdue') {
      sortStage.daysOverdue = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'totalDue') {
      sortStage.totalDue = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'priority') {
      sortStage.priority = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortStage.studentName = 1;
    }
    pipeline.push({ $sort: sortStage });

    // Step 11: Add pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push(
      { $skip: skip },
      { $limit: parseInt(limit) }
    );

    // Step 12: Final projection
    pipeline.push({
      $project: {
        studentId: '$admissionNumber',
        studentName: 1,
        admissionNumber: 1,
        className: 1,
        section: 1,
        rollNo: { $ifNull: ['$studentDetails.rollNo', 'N/A'] },
        parentName: { 
          $ifNull: [
            '$studentDetails.parents.father.name',
            '$studentDetails.parents.mother.name',
            'N/A'
          ]
        },
        parentPhone: { 
          $ifNull: [
            '$studentDetails.parents.father.phone',
            '$studentDetails.parents.mother.phone',
            'N/A'
          ]
        },
        parentEmail: { 
          $ifNull: [
            '$studentDetails.parents.father.email',
            '$studentDetails.parents.mother.email',
            'N/A'
          ]
        },
        amount: '$totalDue',
        totalFee: 1,
        totalPaid: 1,
        totalDue: 1,
        daysOverdue: 1,
        status: 1,
        priority: 1,
        remindersSent: 1,
        lastPaymentDate: 1,
        lastContact: { 
          $cond: {
            if: { $ne: ['$lastPaymentDate', null] },
            then: { $dateToString: { format: '%Y-%m-%d', date: '$lastPaymentDate' } },
            else: 'No contact yet'
          }
        },
        dueInstallments: {
          $map: {
            input: '$dueInstallments',
            as: 'installment',
            in: {
              componentName: { $ifNull: ['$$installment.componentName', 'Fee Installment'] },
              amount: { $ifNull: ['$$installment.totalAmount', 0] },
              paidAmount: { $ifNull: ['$$installment.paidAmount', 0] },
              dueAmount: { $ifNull: ['$$installment.dueAmount', 0] },
              dueDate: { $ifNull: ['$$installment.dueDate', '$$installment.createdAt'] },
              status: { $ifNull: ['$$installment.status', 'pending'] }
            }
          }
        },
        recentPayments: {
          $map: {
            input: '$recentPayments',
            as: 'payment',
            in: {
              receiptNumber: '$$payment.receiptNumber',
              amount: { $ifNull: ['$$payment.netAmount', '$$payment.amount', 0] },
              paymentDate: '$$payment.paymentDate',
              paymentMethod: { $ifNull: ['$$payment.paymentMethod', 'cash'] }
            }
          }
        },
        notes: {
          $switch: {
            branches: [
              { case: { $gt: ['$daysOverdue', 30] }, then: 'Long overdue. Requires immediate follow-up.' },
              { case: { $gt: ['$daysOverdue', 15] }, then: 'Multiple reminders may be needed.' },
              { case: { $gt: ['$daysOverdue', 7] }, then: 'First reminder sent. Monitor for payment.' },
              { case: { $gt: ['$totalDue', 50000] }, then: 'Large amount due. Schedule personal meeting.' }
            ],
            default: 'New overdue. Standard reminder procedure.'
          }
        }
      }
    });

    console.log('🔍 Fee defaulters pipeline built');

    // Execute aggregation
    const defaulters = await feeStructureCollection.aggregate(pipeline).toArray();

    console.log(`✅ Found ${defaulters.length} defaulters out of ${total} total`);

    // Calculate summary statistics
    const summaryPipeline = [
      { $match: { totalDue: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalDue' },
          totalDefaulters: { $sum: 1 },
          avgDaysOverdue: { $avg: '$daysOverdue' },
          criticalCount: {
            $sum: {
              $cond: [
                { $eq: ['$priority', 1] },
                1,
                0
              ]
            }
          },
          highCount: {
            $sum: {
              $cond: [
                { $eq: ['$priority', 2] },
                1,
                0
              ]
            }
          },
          moderateCount: {
            $sum: {
              $cond: [
                { $eq: ['$priority', 3] },
                1,
                0
              ]
            }
          }
        }
      }
    ];

    const summaryResult = await feeStructureCollection.aggregate(summaryPipeline).toArray();
    const summary = summaryResult[0] || {
      totalAmount: 0,
      totalDefaulters: 0,
      avgDaysOverdue: 0,
      criticalCount: 0,
      highCount: 0,
      moderateCount: 0
    };

    // Get distribution by overdue days
    const distributionPipeline = [
      { $match: { totalDue: { $gt: 0 } } },
      {
        $bucket: {
          groupBy: '$daysOverdue',
          boundaries: [0, 15, 30, 45, 1000],
          default: '45+',
          output: {
            count: { $sum: 1 },
            amount: { $sum: '$totalDue' }
          }
        }
      }
    ];

    const distributionResult = await feeStructureCollection.aggregate(distributionPipeline).toArray();
    
    // Format distribution data
    const overdueDistribution = distributionResult.map(item => {
      let range = '0-15 days';
      if (item._id === 45) range = '45+ days';
      else if (item._id === 30) range = '31-45 days';
      else if (item._id === 15) range = '16-30 days';
      
      return {
        range,
        count: item.count || 0,
        amount: item.amount || 0
      };
    });

    // Get class-wise distribution
    const classWisePipeline = [
      { $match: { totalDue: { $gt: 0 } } },
      {
        $group: {
          _id: '$className',
          count: { $sum: 1 },
          amount: { $sum: '$totalDue' }
        }
      },
      { $sort: { amount: -1 } }
    ];

    const classWiseResult = await feeStructureCollection.aggregate(classWisePipeline).toArray();
    const classWiseDistribution = classWiseResult.map(item => ({
      class: item._id || 'Unknown',
      count: item.count || 0,
      amount: item.amount || 0
    }));

    res.status(200).json({
      success: true,
      defaulters,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      summary: {
        totalAmount: summary.totalAmount || 0,
        totalDefaulters: summary.totalDefaulters || 0,
        avgDaysOverdue: Math.round(summary.avgDaysOverdue || 0),
        criticalCount: summary.criticalCount || 0,
        highCount: summary.highCount || 0,
        moderateCount: summary.moderateCount || 0,
        recoveryRate: 78,
      },
      distributions: {
        overdueDistribution,
        classWiseDistribution
      }
    });

  } catch (error) {
    console.error('❌ Get fee defaulters error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Send reminders to defaulters
// @route   POST /api/finance/fee-defaulters/send-reminders
// @access  Private (Admin/Finance)
export const sendReminders = asyncHandler(async (req, res) => {
  try {
    const { defaulters, message, method = 'sms' } = req.body;

    if (!defaulters || !Array.isArray(defaulters) || defaulters.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select defaulters to send reminders'
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reminder message is required'
      });
    }

    console.log(`📧 Sending ${method} reminders to ${defaulters.length} defaulters`);

    const db = mongoose.connection.db;
    const studentsCollection = db.collection('students');
    const notificationsCollection = db.collection('notifications');
    
    const results = [];
    const errors = [];

    for (const admissionNumber of defaulters) {
      try {
        // Get student details
        const student = await studentsCollection.findOne({ admissionNumber });
        
        if (!student) {
          errors.push({
            admissionNumber,
            error: 'Student not found'
          });
          continue;
        }

        // Extract parent info with fallbacks
        const fatherPhone = student.parents?.father?.phone;
        const motherPhone = student.parents?.mother?.phone;
        const fatherEmail = student.parents?.father?.email;
        const motherEmail = student.parents?.mother?.email;
        
        const parentPhone = fatherPhone || motherPhone || 'N/A';
        const parentEmail = fatherEmail || motherEmail || 'N/A';
        
        const studentName = student.name || 
                          (student.student ? `${student.student.firstName || ''} ${student.student.lastName || ''}`.trim() : 'Unknown Student');

        // Create notification record
        const notification = {
          type: 'fee_reminder',
          method,
          recipient: method === 'sms' ? parentPhone : parentEmail,
          studentName,
          admissionNumber,
          className: student.class?.className || student.className || 'Unknown',
          amount: req.body.amount || 0,
          message,
          status: 'pending',
          scheduledAt: new Date(),
          createdBy: req.user._id,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await notificationsCollection.insertOne(notification);

        console.log(`✅ ${method.toUpperCase()} reminder queued for ${studentName} (${admissionNumber})`);
        
        results.push({
          admissionNumber,
          studentName,
          contact: method === 'sms' ? parentPhone : parentEmail,
          status: 'queued'
        });

      } catch (error) {
        errors.push({
          admissionNumber,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Reminders queued for ${results.length} defaulters`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Send reminders error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get defaulter details - FIXED VERSION
// @route   GET /api/finance/fee-defaulters/:admissionNumber
// @access  Private (Admin/Finance)
export const getDefaulterDetails = asyncHandler(async (req, res) => {
  try {
    const { admissionNumber } = req.params;

    console.log(`🔍 Getting defaulter details for: ${admissionNumber}`);

    const db = mongoose.connection.db;
    const feeStructureCollection = db.collection('feestructures');
    const paymentsCollection = db.collection('payments');
    const studentsCollection = db.collection('students');

    // Get student details
    const student = await studentsCollection.findOne({ admissionNumber });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get fee structure
    const feeStructure = await feeStructureCollection.findOne({ admissionNumber });
    
    if (!feeStructure) {
      // If no fee structure exists, check if student has due payments directly
      const dueInstallments = await paymentsCollection.find({
        admissionNumber,
        paymentType: { $in: ['installment', null, undefined] },
        dueAmount: { $gt: 0 }
      }).sort({ dueDate: 1 }).toArray();

      if (dueInstallments.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No outstanding fees found for this student'
        });
      }

      // Calculate totals from due installments
      const totalDue = dueInstallments.reduce((sum, inst) => sum + (inst.dueAmount || 0), 0);
      const totalFee = dueInstallments.reduce((sum, inst) => sum + (inst.totalAmount || inst.amount || 0), 0);
      const totalPaid = dueInstallments.reduce((sum, inst) => sum + (inst.paidAmount || 0), 0);

      // Create a temporary fee structure
      const tempFeeStructure = {
        totalFee,
        totalPaid,
        totalDue,
        admissionNumber,
        studentName: student.name || 
                    (student.student ? `${student.student.firstName || ''} ${student.student.lastName || ''}`.trim() : 'Unknown'),
        className: student.class?.className || student.className || 'Unknown',
        section: student.class?.section || 'A'
      };

      // Use temporary structure
      const studentName = tempFeeStructure.studentName;
      const className = tempFeeStructure.className;
      const section = tempFeeStructure.section;
      const daysOverdue = calculateDaysOverdue(dueInstallments);
      const priority = calculatePriority(daysOverdue, totalDue);
      const status = ['Critical', 'High', 'Moderate', 'Low'][priority - 1];

      // Get payment history
      const paymentHistory = await paymentsCollection.find({
        admissionNumber,
        paymentType: 'receipt',
        status: 'completed'
      }).sort({ paymentDate: -1 }).limit(10).toArray();

      // Get communication history
      const notifications = await db.collection('notifications').find({
        admissionNumber,
        type: 'fee_reminder'
      }).sort({ createdAt: -1 }).limit(5).toArray();

      const response = {
        success: true,
        defaulter: {
          studentId: admissionNumber,
          studentName,
          admissionNumber,
          className,
          section,
          rollNo: student.rollNo || 'N/A',
          parentName: student.parents?.father?.name || student.parents?.mother?.name || 'N/A',
          parentPhone: student.parents?.father?.phone || student.parents?.mother?.phone || 'N/A',
          parentEmail: student.parents?.father?.email || student.parents?.mother?.email || 'N/A',
          address: student.address || 'N/A',
          totalFee,
          totalPaid,
          totalDue,
          daysOverdue,
          status,
          priority,
          dueInstallments: dueInstallments.map(installment => ({
            componentName: installment.componentName || 'Fee Installment',
            totalAmount: installment.totalAmount || installment.amount || 0,
            paidAmount: installment.paidAmount || 0,
            dueAmount: installment.dueAmount || 0,
            dueDate: installment.dueDate || installment.createdAt,
            status: installment.status || 'pending'
          })),
          paymentHistory: paymentHistory.map(payment => ({
            receiptNumber: payment.receiptNumber,
            amount: payment.netAmount || payment.amount || 0,
            paymentDate: payment.paymentDate || payment.createdAt,
            paymentMethod: payment.paymentMethod || 'cash',
            description: payment.description || ''
          })),
          communicationHistory: notifications.map(notif => ({
            type: notif.method,
            message: notif.message,
            sentAt: notif.createdAt,
            status: notif.status,
            recipient: notif.recipient
          })),
          lastPaymentDate: paymentHistory.length > 0 ? paymentHistory[0].paymentDate : null,
          remindersSent: notifications.length,
          notes: generateDefaulterNotes(daysOverdue, totalDue)
        }
      };

      return res.status(200).json(response);
    }

    // Original code for when fee structure exists...
    const dueInstallments = await paymentsCollection.find({
      admissionNumber,
      paymentType: { $in: ['installment', null, undefined] },
      dueAmount: { $gt: 0 }
    }).sort({ dueDate: 1 }).toArray();

    // Get payment history
    const paymentHistory = await paymentsCollection.find({
      admissionNumber,
      paymentType: 'receipt',
      status: 'completed'
    }).sort({ paymentDate: -1 }).limit(10).toArray();

    // Get communication history
    const notifications = await db.collection('notifications').find({
      admissionNumber,
      type: 'fee_reminder'
    }).sort({ createdAt: -1 }).limit(5).toArray();

    // Calculate overdue days
    const daysOverdue = calculateDaysOverdue(dueInstallments);

    // Calculate priority
    const priority = calculatePriority(daysOverdue, feeStructure.totalDue);
    const status = ['Critical', 'High', 'Moderate', 'Low'][priority - 1];

    const response = {
      success: true,
      defaulter: {
        studentId: admissionNumber,
        studentName: feeStructure.studentName || student.name || 
                    (student.student ? `${student.student.firstName || ''} ${student.student.lastName || ''}`.trim() : 'Unknown'),
        admissionNumber,
        className: feeStructure.className || student.class?.className || student.className || 'Unknown',
        section: feeStructure.section || student.class?.section || 'A',
        rollNo: student.rollNo || 'N/A',
        parentName: student.parents?.father?.name || student.parents?.mother?.name || 'N/A',
        parentPhone: student.parents?.father?.phone || student.parents?.mother?.phone || 'N/A',
        parentEmail: student.parents?.father?.email || student.parents?.mother?.email || 'N/A',
        address: student.address || 'N/A',
        totalFee: feeStructure.totalFee || 0,
        totalPaid: feeStructure.totalPaid || 0,
        totalDue: feeStructure.totalDue || 0,
        daysOverdue,
        status,
        priority,
        dueInstallments: dueInstallments.map(installment => ({
          componentName: installment.componentName || 'Fee Installment',
          totalAmount: installment.totalAmount || installment.amount || 0,
          paidAmount: installment.paidAmount || 0,
          dueAmount: installment.dueAmount || 0,
          dueDate: installment.dueDate || installment.createdAt,
          status: installment.status || 'pending'
        })),
        paymentHistory: paymentHistory.map(payment => ({
          receiptNumber: payment.receiptNumber,
          amount: payment.netAmount || payment.amount || 0,
          paymentDate: payment.paymentDate || payment.createdAt,
          paymentMethod: payment.paymentMethod || 'cash',
          description: payment.description || ''
        })),
        communicationHistory: notifications.map(notif => ({
          type: notif.method,
          message: notif.message,
          sentAt: notif.createdAt,
          status: notif.status,
          recipient: notif.recipient
        })),
        lastPaymentDate: paymentHistory.length > 0 ? paymentHistory[0].paymentDate : null,
        remindersSent: notifications.length,
        notes: generateDefaulterNotes(daysOverdue, feeStructure.totalDue)
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Get defaulter details error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Update defaulter notes - FIXED VERSION
// @route   PUT /api/finance/fee-defaulters/:admissionNumber/notes
// @access  Private (Admin/Finance)
export const updateDefaulterNotes = asyncHandler(async (req, res) => {
  try {
    const { admissionNumber } = req.params;
    const { notes, actionTaken, followUpDate } = req.body;

    const db = mongoose.connection.db;
    const feeStructureCollection = db.collection('feestructures');

    // First check if fee structure exists
    let feeStructure = await feeStructureCollection.findOne({ admissionNumber });

    if (!feeStructure) {
      // If no fee structure exists, create one with basic info
      const studentsCollection = db.collection('students');
      const student = await studentsCollection.findOne({ admissionNumber });
      
      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found'
        });
      }

      // Create a basic fee structure
      feeStructure = {
        admissionNumber,
        studentName: student.name || 
                    (student.student ? `${student.student.firstName || ''} ${student.student.lastName || ''}`.trim() : 'Unknown Student'),
        className: student.class?.className || student.className || 'Unknown',
        section: student.class?.section || 'A',
        totalFee: 0,
        totalPaid: 0,
        totalDue: 0,
        notes,
        actionTaken,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await feeStructureCollection.insertOne(feeStructure);
      
      return res.status(201).json({
        success: true,
        message: 'Defaulter record created and notes updated successfully'
      });
    }

    // Update existing fee structure with notes
    const result = await feeStructureCollection.updateOne(
      { admissionNumber },
      {
        $set: {
          notes,
          actionTaken,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          updatedAt: new Date()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Defaulter notes updated successfully'
    });

  } catch (error) {
    console.error('❌ Update defaulter notes error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Export fee defaulters to CSV - FIXED VERSION
// @route   GET /api/finance/fee-defaulters/export
// @access  Private (Admin/Finance)
export const exportFeeDefaulters = asyncHandler(async (req, res) => {
  try {
    console.log("📤 Exporting fee defaulters");
    
    const {
      search,
      className,
      status,
      priority,
      daysOverdue
    } = req.query;

    // Build filter for export
    const db = mongoose.connection.db;
    const feeStructureCollection = db.collection('feestructures');
    const studentsCollection = db.collection('students');

    // Simple query without complex aggregation
    const matchStage = { totalDue: { $gt: 0 } };

    if (search && search.trim()) {
      matchStage.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } }
      ];
    }

    if (className && className !== 'All Classes') {
      matchStage.className = className;
    }

    // Get fee structures
    const feeStructures = await feeStructureCollection.find(matchStage).toArray();

    if (feeStructures.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No fee defaulters found to export'
      });
    }

    // Get student details for each fee structure
    const defaulters = [];
    for (const feeStructure of feeStructures) {
      const student = await studentsCollection.findOne({ 
        admissionNumber: feeStructure.admissionNumber 
      });

      // Calculate simple days overdue
      const paymentsCollection = db.collection('payments');
      const dueInstallment = await paymentsCollection.findOne({
        admissionNumber: feeStructure.admissionNumber,
        dueAmount: { $gt: 0 }
      }, { sort: { dueDate: 1 } });

      let daysOverdueCalc = 0;
      if (dueInstallment && dueInstallment.dueDate) {
        const diffTime = new Date() - new Date(dueInstallment.dueDate);
        daysOverdueCalc = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      // Calculate priority
      let priorityLevel = 'Low';
      if (daysOverdueCalc > 30 || feeStructure.totalDue > 50000) {
        priorityLevel = 'Critical';
      } else if ((daysOverdueCalc >= 15 && daysOverdueCalc <= 30) || 
                 (feeStructure.totalDue > 20000 && feeStructure.totalDue <= 50000)) {
        priorityLevel = 'High';
      } else if ((daysOverdueCalc >= 7 && daysOverdueCalc < 15) || 
                 (feeStructure.totalDue > 5000 && feeStructure.totalDue <= 20000)) {
        priorityLevel = 'Moderate';
      }

      defaulters.push({
        admissionNumber: feeStructure.admissionNumber,
        studentName: feeStructure.studentName,
        className: feeStructure.className,
        section: feeStructure.section || 'A',
        parentName: student?.parents?.father?.name || student?.parents?.mother?.name || 'N/A',
        parentPhone: student?.parents?.father?.phone || student?.parents?.mother?.phone || 'N/A',
        totalFee: feeStructure.totalFee || 0,
        totalPaid: feeStructure.totalPaid || 0,
        totalDue: feeStructure.totalDue || 0,
        daysOverdue: daysOverdueCalc,
        priority: priorityLevel
      });
    }

    // Generate CSV content
    const headers = [
      'Admission Number',
      'Student Name',
      'Class',
      'Section',
      'Parent Name',
      'Parent Phone',
      'Total Fee',
      'Total Paid',
      'Total Due',
      'Days Overdue',
      'Priority'
    ];

    const rows = defaulters.map(defaulter => [
      defaulter.admissionNumber,
      defaulter.studentName,
      defaulter.className,
      defaulter.section,
      defaulter.parentName,
      defaulter.parentPhone,
      defaulter.totalFee,
      defaulter.totalPaid,
      defaulter.totalDue,
      defaulter.daysOverdue,
      defaulter.priority
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // Set response headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=fee-defaulters-${new Date().toISOString().split('T')[0]}.csv`);
    
    console.log(`✅ Export API: Exported ${defaulters.length} defaulters`);
    
    res.status(200).send(csvContent);

  } catch (error) {
    console.error('❌ Export fee defaulters error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get fee defaulters statistics - FIXED VERSION
// @route   GET /api/finance/fee-defaulters/statistics
// @access  Private (Admin/Finance)
export const getFeeDefaultersStatistics = asyncHandler(async (req, res) => {
  try {
    console.log("📈 Getting fee defaulters statistics");

    const db = mongoose.connection.db;
    const feeStructureCollection = db.collection('feestructures');

    // Overall statistics - SIMPLIFIED
    const overallStats = await feeStructureCollection.aggregate([
      { $match: { totalDue: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalDue' },
          totalDefaulters: { $sum: 1 },
          avgDue: { $avg: '$totalDue' }
        }
      }
    ]).toArray();

    // Priority-wise statistics - SIMPLIFIED
    const priorityStats = await feeStructureCollection.aggregate([
      { $match: { totalDue: { $gt: 0 } } },
      {
        $addFields: {
          priority: {
            $switch: {
              branches: [
                { case: { $gt: ['$totalDue', 50000] }, then: 'Critical' },
                { case: { $and: [{ $gt: ['$totalDue', 20000] }, { $lte: ['$totalDue', 50000] }] }, then: 'High' },
                { case: { $and: [{ $gt: ['$totalDue', 5000] }, { $lte: ['$totalDue', 20000] }] }, then: 'Moderate' }
              ],
              default: 'Low'
            }
          }
        }
      },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalDue' }
        }
      }
    ]).toArray();

    // Class-wise statistics
    const classStats = await feeStructureCollection.aggregate([
      { $match: { totalDue: { $gt: 0 } } },
      {
        $group: {
          _id: '$className',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalDue' }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 }
    ]).toArray();

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await feeStructureCollection.aggregate([
      {
        $match: {
          totalDue: { $gt: 0 },
          updatedAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$updatedAt' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalDue' }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    // Calculate recovery rate (this would need historical data)
    const recoveryRate = 78; // This should be calculated from payment history

    res.status(200).json({
      success: true,
      statistics: {
        overall: overallStats[0] || {
          totalAmount: 0,
          totalDefaulters: 0,
          avgDue: 0
        },
        priority: priorityStats,
        class: classStats,
        monthlyTrend,
        recoveryRate
      }
    });

  } catch (error) {
    console.error('❌ Get fee defaulters statistics error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Mark payment as received from defaulter - FIXED VERSION
// @route   POST /api/finance/fee-defaulters/:admissionNumber/mark-paid
// @access  Private (Admin/Finance)
export const markDefaulterPaid = asyncHandler(async (req, res) => {
  try {
    const { admissionNumber } = req.params;
    const { amount, paymentMethod, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    const db = mongoose.connection.db;
    const feeStructureCollection = db.collection('feestructures');
    const studentsCollection = db.collection('students');
    const paymentsCollection = db.collection('payments');

    // Get student details
    const student = await studentsCollection.findOne({ admissionNumber });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if student has due payments
    const duePayments = await paymentsCollection.find({
      admissionNumber,
      paymentType: { $in: ['installment', null, undefined] },
      dueAmount: { $gt: 0 }
    }).toArray();

    if (duePayments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No outstanding payments found for this student'
      });
    }

    // Calculate total due
    const totalDue = duePayments.reduce((sum, payment) => sum + (payment.dueAmount || 0), 0);

    // Check if amount is valid
    if (amount > totalDue) {
      return res.status(400).json({
        success: false,
        message: `Amount exceeds total due (₹${totalDue})`
      });
    }

    // Generate receipt number
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const receiptNumber = `REC-${timestamp}-${random}`;

    // Extract student info
    const studentName = student.name || 
                       (student.student ? `${student.student.firstName || ''} ${student.student.lastName || ''}`.trim() : 'Unknown Student');
    const className = student.class?.className || student.className || 'Unknown';
    const section = student.class?.section || 'A';
    const parentName = student.parents?.father?.name || student.parents?.mother?.name || 'N/A';
    const parentPhone = student.parents?.father?.phone || student.parents?.mother?.phone || 'N/A';

    // Create payment record
    const paymentData = {
      receiptNumber,
      admissionNumber,
      studentId: student._id,
      studentName,
      className,
      section,
      parentName,
      parentPhone,
      parentEmail: student.parents?.father?.email || student.parents?.mother?.email || undefined,
      paymentDate: new Date(),
      paymentMethod: paymentMethod || 'cash',
      amount: parseFloat(amount),
      netAmount: parseFloat(amount),
      totalAmount: parseFloat(amount),
      paidAmount: parseFloat(amount),
      dueAmount: 0,
      status: 'completed',
      paymentType: 'receipt',
      description: `Payment received from defaulter. ${notes || ''}`,
      isDefaulterPayment: true,
      recordedBy: req.user._id,
      recordedByName: req.user.name || req.user.username || 'System',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save payment
    await paymentsCollection.insertOne(paymentData);

    // Update due payments
    let remainingAmount = parseFloat(amount);
    for (const duePayment of duePayments) {
      if (remainingAmount <= 0) break;
      
      const currentDue = duePayment.dueAmount || 0;
      if (currentDue <= 0) continue;
      
      const amountToApply = Math.min(remainingAmount, currentDue);
      const newPaidAmount = (duePayment.paidAmount || 0) + amountToApply;
      const newDueAmount = Math.max(0, (duePayment.totalAmount || duePayment.amount || 0) - newPaidAmount);
      const newStatus = newDueAmount === 0 ? 'completed' : 'partial';
      
      await paymentsCollection.updateOne(
        { _id: duePayment._id },
        {
          $set: {
            paidAmount: newPaidAmount,
            dueAmount: newDueAmount,
            status: newStatus,
            updatedAt: new Date(),
            lastPaymentDate: new Date(),
            lastPaymentReceipt: receiptNumber
          }
        }
      );
      
      remainingAmount -= amountToApply;
    }

    // Update or create fee structure
    const feeStructure = await feeStructureCollection.findOne({ admissionNumber });
    
    if (feeStructure) {
      const newTotalPaid = (feeStructure.totalPaid || 0) + parseFloat(amount);
      const newTotalDue = Math.max(0, (feeStructure.totalFee || 0) - newTotalPaid);

      await feeStructureCollection.updateOne(
        { _id: feeStructure._id },
        {
          $set: {
            totalPaid: newTotalPaid,
            totalDue: newTotalDue,
            updatedAt: new Date(),
            lastPaymentDate: new Date(),
            lastPaymentReceipt: receiptNumber
          }
        }
      );
    } else {
      // Create new fee structure
      const newFeeStructure = {
        admissionNumber,
        studentName,
        className,
        section,
        totalFee: totalDue,
        totalPaid: parseFloat(amount),
        totalDue: totalDue - parseFloat(amount),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await feeStructureCollection.insertOne(newFeeStructure);
    }

    console.log(`✅ Marked defaulter ${admissionNumber} as paid: ₹${amount}`);

    res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        receiptNumber,
        amount,
        previousDue: totalDue,
        newDue: totalDue - parseFloat(amount),
        studentName
      }
    });

  } catch (error) {
    console.error('❌ Mark defaulter paid error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Helper functions
const calculateDaysOverdue = (dueInstallments) => {
  if (!dueInstallments || dueInstallments.length === 0) return 0;
  
  const earliestDue = dueInstallments[0].dueDate;
  if (!earliestDue) return 0;
  
  const diffTime = new Date() - new Date(earliestDue);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

const calculatePriority = (daysOverdue, totalDue) => {
  if (daysOverdue > 30 || totalDue > 50000) {
    return 1; // Critical
  } else if ((daysOverdue >= 15 && daysOverdue <= 30) || 
             (totalDue > 20000 && totalDue <= 50000)) {
    return 2; // High
  } else if ((daysOverdue >= 7 && daysOverdue < 15) || 
             (totalDue > 5000 && totalDue <= 20000)) {
    return 3; // Moderate
  }
  return 4; // Low
};

const generateDefaulterNotes = (daysOverdue, totalDue) => {
  if (daysOverdue > 30) {
    return 'Long overdue. Requires immediate follow-up and possible escalation.';
  } else if (daysOverdue > 15) {
    return 'Multiple reminders may be needed. Consider phone call follow-up.';
  } else if (daysOverdue > 7) {
    return 'First reminder sent. Monitor for payment.';
  } else if (totalDue > 50000) {
    return 'Large amount due. Schedule personal meeting if possible.';
  } else {
    return 'New overdue. Standard reminder procedure.';
  }
};