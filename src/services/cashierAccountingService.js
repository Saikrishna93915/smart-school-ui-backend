import Cashier from "../models/Cashier.js";
import FeeStructure from "../models/FeeStructure.js";
import ShiftSession from "../models/ShiftSession.js";

export const getCashierByUserId = (userId, session = null) => {
  const query = Cashier.findOne({
    $or: [{ user: userId }, { userId }],
    isDeleted: false,
  });

  return session ? query.session(session) : query;
};

export const getTodayShiftKey = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

export const getOpenShiftForCashier = (cashierId, session = null) => {
  const query = ShiftSession.findOne({
    cashier: cashierId,
    shiftDate: getTodayShiftKey(),
    status: "open",
  });

  return session ? query.session(session) : query;
};

export const getPaymentAmount = (payment) =>
  Number(payment?.amount ?? payment?.netAmount ?? payment?.totalAmount ?? 0);

const getNormalizedMethod = (paymentMethod = "") => {
  const method = String(paymentMethod).toLowerCase();

  if (method === "bank-transfer" || method === "card") return "online";
  if (method === "dd") return "cheque";

  return method;
};

export const applyPaymentToFeeStructure = async (payment, session = null) => {
  const feeStructure = await FeeStructure.findOne({
    $or: [
      { studentId: payment.studentId },
      { admissionNumber: payment.admissionNumber },
    ],
  }).session(session);

  if (!feeStructure) {
    return null;
  }

  const paymentAmount = Number(payment.netAmount ?? payment.amount ?? 0);
  feeStructure.totalPaid = Number(feeStructure.totalPaid || 0) + paymentAmount;

  if (Array.isArray(payment.feesPaid) && payment.feesPaid.length > 0) {
    for (const paidFee of payment.feesPaid) {
      const componentName = paidFee.feeType || paidFee.name;
      const componentAmount = Number(paidFee.amount || 0);
      const component = feeStructure.feeComponents.find(
        (item) => item.componentName === componentName
      );

      if (component) {
        component.paidAmount = Number(component.paidAmount || 0) + componentAmount;
        if (component.paidAmount >= component.amount) {
          component.status = "paid";
        } else if (component.paidAmount > 0) {
          component.status = "partial";
        }
      }
    }
  }

  await feeStructure.save({ session });
  return feeStructure;
};

export const reversePaymentFromFeeStructure = async (payment, session = null) => {
  const feeStructure = await FeeStructure.findOne({
    $or: [
      { studentId: payment.studentId },
      { admissionNumber: payment.admissionNumber },
    ],
  }).session(session);

  if (!feeStructure) {
    return null;
  }

  const paymentAmount = Number(payment.netAmount ?? payment.amount ?? 0);
  feeStructure.totalPaid = Math.max(
    0,
    Number(feeStructure.totalPaid || 0) - paymentAmount
  );

  if (Array.isArray(payment.feesPaid) && payment.feesPaid.length > 0) {
    for (const paidFee of payment.feesPaid) {
      const componentName = paidFee.feeType || paidFee.name;
      const componentAmount = Number(paidFee.amount || 0);
      const component = feeStructure.feeComponents.find(
        (item) => item.componentName === componentName
      );

      if (component) {
        component.paidAmount = Math.max(
          0,
          Number(component.paidAmount || 0) - componentAmount
        );

        if (component.paidAmount <= 0) {
          component.status = "pending";
        } else if (component.paidAmount < component.amount) {
          component.status = "partial";
        } else {
          component.status = "paid";
        }
      }
    }
  }

  await feeStructure.save({ session });
  return feeStructure;
};

export const addPaymentToShift = async (shift, payment, session = null) => {
  if (!shift) return null;

  const amount = getPaymentAmount(payment);
  const method = getNormalizedMethod(payment.paymentMethod);

  shift.transactions = shift.transactions || {
    count: 0,
    totalAmount: 0,
    cash: 0,
    online: 0,
    upi: 0,
    cheque: 0,
  };

  shift.transactions.count = Number(shift.transactions.count || 0) + 1;
  shift.transactions.totalAmount =
    Number(shift.transactions.totalAmount || 0) + amount;

  if (method === "cash") {
    shift.transactions.cash = Number(shift.transactions.cash || 0) + amount;
  } else if (method === "upi") {
    shift.transactions.upi = Number(shift.transactions.upi || 0) + amount;
  } else if (method === "cheque") {
    shift.transactions.cheque = Number(shift.transactions.cheque || 0) + amount;
  } else {
    shift.transactions.online = Number(shift.transactions.online || 0) + amount;
  }

  await shift.save({ session });
  return shift;
};

export const reversePaymentFromShift = async (shift, payment, session = null) => {
  if (!shift) return null;

  const amount = getPaymentAmount(payment);
  const method = getNormalizedMethod(payment.paymentMethod);

  shift.transactions = shift.transactions || {
    count: 0,
    totalAmount: 0,
    cash: 0,
    online: 0,
    upi: 0,
    cheque: 0,
  };

  shift.transactions.count = Math.max(0, Number(shift.transactions.count || 0) - 1);
  shift.transactions.totalAmount = Math.max(
    0,
    Number(shift.transactions.totalAmount || 0) - amount
  );

  if (method === "cash") {
    shift.transactions.cash = Math.max(
      0,
      Number(shift.transactions.cash || 0) - amount
    );
  } else if (method === "upi") {
    shift.transactions.upi = Math.max(
      0,
      Number(shift.transactions.upi || 0) - amount
    );
  } else if (method === "cheque") {
    shift.transactions.cheque = Math.max(
      0,
      Number(shift.transactions.cheque || 0) - amount
    );
  } else {
    shift.transactions.online = Math.max(
      0,
      Number(shift.transactions.online || 0) - amount
    );
  }

  await shift.save({ session });
  return shift;
};
