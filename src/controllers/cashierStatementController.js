// controllers/cashierStatementController.js - Cashier Transaction History & Statement
import Payment from "../models/Payment.js";
import Cashier from "../models/Cashier.js";
import ShiftSession from "../models/ShiftSession.js";
import Student from "../models/Student.js";
import asyncHandler from "../utils/asyncHandler.js";

const getCashierFromUser = async (userId) => {
  return Cashier.findOne({ $or: [{ user: userId }, { userId }], isDeleted: false });
};

const getCashierPaymentQuery = (userId, cashier) => {
  const paymentOwners = [{ collectedBy: userId }, { recordedBy: userId }];

  if (cashier?.employeeId) {
    paymentOwners.push({ cashierId: cashier.employeeId });
  }

  if (cashier?.firstName || cashier?.lastName) {
    paymentOwners.push({
      cashierName: `${cashier.firstName || ""} ${cashier.lastName || ""}`.trim(),
    });
  }

  return {
    $or: paymentOwners,
    status: { $nin: ["cancelled"] },
  };
};

const normalizePaymentMethod = (paymentMethod = "") => {
  const method = String(paymentMethod).toLowerCase();

  if (method === "bank-transfer") return "online";
  if (method === "card") return "online";

  return method || "cash";
};

const getStudentNames = (payment) => {
  const firstName =
    payment.studentId?.student?.firstName ||
    payment.studentId?.personal?.firstName ||
    payment.studentName?.split(" ")[0] ||
    "";
  const lastName =
    payment.studentId?.student?.lastName ||
    payment.studentId?.personal?.lastName ||
    payment.studentName?.split(" ").slice(1).join(" ") ||
    "";

  return { firstName, lastName };
};

const getStudentAcademicInfo = (payment) => ({
  class:
    payment.studentId?.class?.className ||
    payment.studentId?.academic?.class ||
    payment.className ||
    "",
  section:
    payment.studentId?.class?.section ||
    payment.studentId?.academic?.section ||
    payment.section ||
    "",
  admissionNumber:
    payment.studentId?.admissionNumber ||
    payment.studentId?.academic?.admissionNumber ||
    payment.admissionNumber ||
    "",
});

const getFeeDetails = (payment) => {
  const firstBreakdown = payment.breakdown?.[0];

  return {
    feeType: firstBreakdown?.name || "Fee Payment",
    feeCategory: firstBreakdown?.category || "General",
    discount: payment.discount || 0,
    fine: payment.lateFee || 0,
  };
};

const mapPaymentToStatementTransaction = (payment) => {
  const { firstName, lastName } = getStudentNames(payment);
  const academic = getStudentAcademicInfo(payment);

  return {
    _id: payment._id,
    receiptNumber: payment.receiptNumber || `REC-${payment._id.toString().slice(-6)}`,
    amount: payment.amount || payment.netAmount || payment.totalAmount || 0,
    paymentMethod: normalizePaymentMethod(payment.paymentMethod),
    paymentMode: payment.paymentMethod || "cash",
    status: payment.status,
    transactionDate: payment.paymentDate || payment.createdAt,
    studentId: {
      _id: payment.studentId?._id,
      personal: {
        firstName,
        lastName,
      },
      academic,
    },
    feeDetails: getFeeDetails(payment),
    cashier: {
      _id: payment.collectedBy || payment.recordedBy || null,
      name: payment.cashierName || payment.recordedByName || "Unknown",
      employeeId: payment.cashierId || "",
    },
    shiftId: payment.shiftId || null,
    upiId: payment.upiId,
    chequeNumber: payment.chequeNo,
    bankName: payment.bankName,
    remarks: payment.description,
  };
};

const getShiftQuery = (cashier, dateFrom, dateTo) => {
  const query = {};

  if (cashier?._id) {
    query.cashier = cashier._id;
  } else {
    query._id = null;
  }

  if (dateFrom || dateTo) {
    query.shiftDate = {};
    if (dateFrom) query.shiftDate.$gte = dateFrom;
    if (dateTo) query.shiftDate.$lte = dateTo;
  }

  return query;
};

// @desc    Get cashier's transaction history (statement)
// @route   GET /api/cashier/statement
// @access  Private (Cashier/Admin/Owner)
export const getCashierStatement = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 100,
    search,
    paymentMethod,
    status,
    dateFrom,
    dateTo,
  } = req.query;

  const cashier = await getCashierFromUser(req.user._id);
  const query = getCashierPaymentQuery(req.user._id, cashier);

  if (search) {
    const students = await Student.find({
      $or: [
        { "student.firstName": { $regex: search, $options: "i" } },
        { "student.lastName": { $regex: search, $options: "i" } },
        { admissionNumber: { $regex: search, $options: "i" } },
      ],
    }).distinct("_id");

    query.$and = [
      {
        $or: [
          { receiptNumber: { $regex: search, $options: "i" } },
          { studentId: { $in: students } },
          { studentName: { $regex: search, $options: "i" } },
          { admissionNumber: { $regex: search, $options: "i" } },
        ],
      },
    ];
  }

  if (paymentMethod && paymentMethod !== "all") {
    if (paymentMethod === "online") {
      query.paymentMethod = { $in: ["online", "bank-transfer", "card"] };
    } else {
      query.paymentMethod = paymentMethod;
    }
  }

  if (status && status !== "all") {
    query.status = status;
  }

  if (dateFrom || dateTo) {
    query.paymentDate = {};
    if (dateFrom) query.paymentDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      query.paymentDate.$lte = endDate;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [payments, total, summary] = await Promise.all([
    Payment.find(query)
      .populate("studentId", "student personal class academic admissionNumber")
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Payment.countDocuments(query),
    Payment.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: { $ifNull: ["$amount", "$netAmount"] } },
          cashAmount: {
            $sum: {
              $cond: [{ $eq: ["$paymentMethod", "cash"] }, { $ifNull: ["$amount", "$netAmount"] }, 0],
            },
          },
          onlineAmount: {
            $sum: {
              $cond: [
                { $in: ["$paymentMethod", ["online", "upi", "bank-transfer", "card"]] },
                { $ifNull: ["$amount", "$netAmount"] },
                0,
              ],
            },
          },
          chequeAmount: {
            $sum: {
              $cond: [
                { $in: ["$paymentMethod", ["cheque", "dd"]] },
                { $ifNull: ["$amount", "$netAmount"] },
                0,
              ],
            },
          },
          totalCount: { $sum: 1 },
          completedCount: {
            $sum: { $cond: [{ $in: ["$status", ["completed", "paid"]] }, 1, 0] },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          refundedCount: {
            $sum: { $cond: [{ $eq: ["$status", "refunded"] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      transactions: payments.map(mapPaymentToStatementTransaction),
      summary: summary[0] || {
        totalAmount: 0,
        cashAmount: 0,
        onlineAmount: 0,
        chequeAmount: 0,
        totalCount: 0,
        completedCount: 0,
        pendingCount: 0,
        refundedCount: 0,
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

// @desc    Get transaction details by ID
// @route   GET /api/cashier/statement/:transactionId
// @access  Private (Cashier/Admin/Owner)
export const getTransactionDetails = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const cashier = await getCashierFromUser(req.user._id);
  const ownershipQuery = getCashierPaymentQuery(req.user._id, cashier);

  const transaction = await Payment.findOne({
    _id: transactionId,
    ...ownershipQuery,
  }).populate("studentId", "student personal class academic admissionNumber");

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: "Transaction not found",
    });
  }

  res.json({
    success: true,
    data: { transaction: mapPaymentToStatementTransaction(transaction) },
  });
});

// @desc    Get cashier's shift sessions
// @route   GET /api/cashier/statement/shifts
// @access  Private (Cashier/Admin/Owner)
export const getCashierShifts = asyncHandler(async (req, res) => {
  const { limit = 50, dateFrom, dateTo } = req.query;
  const cashier = await getCashierFromUser(req.user._id);

  if (!cashier) {
    return res.json({
      success: true,
      data: { shifts: [] },
    });
  }

  const shifts = await ShiftSession.find(getShiftQuery(cashier, dateFrom, dateTo))
    .sort({ shiftDate: -1, openingTime: -1 })
    .limit(Number(limit))
    .populate("cashier", "firstName lastName employeeId");

  res.json({
    success: true,
    data: { shifts },
  });
});

// @desc    Get current open shift
// @route   GET /api/cashier/statement/shift/current
// @access  Private (Cashier/Admin/Owner)
export const getCurrentShift = asyncHandler(async (req, res) => {
  const cashier = await getCashierFromUser(req.user._id);

  if (!cashier) {
    return res.json({
      success: true,
      data: { currentShift: null },
    });
  }

  const currentShift = await ShiftSession.getTodayOpenShift(cashier._id);

  res.json({
    success: true,
    data: { currentShift },
  });
});

// @desc    Open new shift
// @route   POST /api/cashier/statement/shift/open
// @access  Private (Cashier)
export const openShift = asyncHandler(async (req, res) => {
  const { openingBalance } = req.body;

  const cashier = await getCashierFromUser(req.user._id);
  if (!cashier) {
    return res.status(404).json({
      success: false,
      message: "Cashier profile not found",
    });
  }

  const existingOpenShift = await ShiftSession.getTodayOpenShift(cashier._id);

  if (existingOpenShift) {
    return res.status(400).json({
      success: false,
      message: "You already have an open shift for today. Please close it first.",
    });
  }

  const newShift = await ShiftSession.create({
    cashier: cashier._id,
    shiftDate: new Date().toISOString().split("T")[0],
    openingTime: new Date(),
    openingBalance: openingBalance || 0,
    status: "open",
    openedBy: req.user._id,
    transactions: {
      count: 0,
      totalAmount: 0,
      cash: 0,
      online: 0,
      upi: 0,
      cheque: 0,
    },
  });

  res.status(201).json({
    success: true,
    data: { shift: newShift },
  });
});

// @desc    Close current shift
// @route   POST /api/cashier/statement/shift/close/:shiftId
// @access  Private (Cashier)
export const closeShift = asyncHandler(async (req, res) => {
  const { shiftId } = req.params;
  const { closingBalance, cashInHand, notes, variance } = req.body;

  const cashier = await getCashierFromUser(req.user._id);
  if (!cashier) {
    return res.status(404).json({
      success: false,
      message: "Cashier profile not found",
    });
  }

  const shift = await ShiftSession.findOne({
    _id: shiftId,
    cashier: cashier._id,
  });

  if (!shift) {
    return res.status(404).json({
      success: false,
      message: "Shift not found",
    });
  }

  if (shift.status !== "open") {
    return res.status(400).json({
      success: false,
      message: "Shift is not open",
    });
  }

  shift.closingTime = new Date();
  shift.closingBalance = closingBalance || 0;
  shift.cashInHand = cashInHand || 0;
  shift.variance = variance ?? (Number(closingBalance || 0) - Number(cashInHand || 0));
  shift.notes = notes;
  shift.status = "closed";
  shift.closedBy = req.user._id;

  await shift.save();

  res.json({
    success: true,
    data: { shift },
  });
});

// @desc    Export cashier statement
// @route   POST /api/cashier/statement/export
// @access  Private (Cashier/Admin/Owner)
export const exportStatement = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, format = "csv" } = req.body;
  const cashier = await getCashierFromUser(req.user._id);
  const query = getCashierPaymentQuery(req.user._id, cashier);

  if (dateFrom || dateTo) {
    query.paymentDate = {};
    if (dateFrom) query.paymentDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      query.paymentDate.$lte = endDate;
    }
  }

  const payments = await Payment.find(query)
    .populate("studentId", "student personal class academic admissionNumber")
    .sort({ paymentDate: 1, createdAt: 1 });

  const transactions = payments.map(mapPaymentToStatementTransaction);

  if (format === "csv") {
    const csvRows = [
      ["Receipt No", "Date", "Student Name", "Class", "Admission No", "Fee Type", "Payment Method", "Amount", "Status"],
    ];

    transactions.forEach((tx) => {
      csvRows.push([
        tx.receiptNumber,
        new Date(tx.transactionDate).toLocaleDateString("en-IN"),
        `${tx.studentId.personal.firstName} ${tx.studentId.personal.lastName}`.trim(),
        `${tx.studentId.academic.class}-${tx.studentId.academic.section}`.replace(/-$/, ""),
        tx.studentId.academic.admissionNumber,
        tx.feeDetails.feeType,
        tx.paymentMethod,
        tx.amount,
        tx.status,
      ]);
    });

    const csvContent = csvRows.map((row) => row.join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=cashier_statement_${dateFrom || "all"}_to_${dateTo || "all"}.csv`
    );
    return res.send(csvContent);
  }

  res.json({
    success: true,
    data: {
      cashier: cashier
        ? {
            name: `${cashier.firstName} ${cashier.lastName}`.trim(),
            employeeId: cashier.employeeId,
          }
        : {
            name: req.user?.name || "Cashier",
            employeeId: "",
          },
      dateRange: { from: dateFrom, to: dateTo },
      transactions,
      summary: {
        totalTransactions: transactions.length,
        totalAmount: transactions.reduce((sum, tx) => sum + tx.amount, 0),
      },
    },
  });
});
