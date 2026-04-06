// Script to sync StudentFee with FeeStructure for pending dues
const mongoose = require('mongoose');
const StudentFee = require('../src/models/StudentFee');
const FeeStructure = require('../src/models/FeeStructure.cjs');
const Student = require('../src/models/Student');

async function sync() {
  await mongoose.connect('mongodb://localhost:27017/school-erp');

  const feeStructures = await FeeStructure.find({ totalDue: { $gt: 0 } });

  for (const fee of feeStructures) {
    const student = await Student.findById(fee.studentId);
    if (!student) continue;

    // Find or create StudentFee
    let studentFee = await StudentFee.findOne({ studentId: student._id });
    if (!studentFee) {
      studentFee = new StudentFee({
        studentId: student._id,
        admissionNumber: student.admissionNumber,
        academicYear: student.class.academicYear,
        className: student.class.className,
        section: student.class.section,
        feeStructureId: fee._id,
        totalFeeAmount: fee.totalFee,
        totalPaid: fee.totalPaid,
        totalDue: fee.totalDue,
        discountAmount: fee.discountAmount || 0,
        lateFeeAmount: fee.lateFeeAmount || 0,
        feeItems: [],
        payments: [],
        paymentHistory: [],
        status: fee.totalDue > 0 ? 'partial' : 'paid',
        dueDate: fee.dueDate || new Date(),
        reminders: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      studentFee.totalFeeAmount = fee.totalFee;
      studentFee.totalPaid = fee.totalPaid;
      studentFee.totalDue = fee.totalDue;
      studentFee.discountAmount = fee.discountAmount || 0;
      studentFee.lateFeeAmount = fee.lateFeeAmount || 0;
      studentFee.status = fee.totalDue > 0 ? 'partial' : 'paid';
      studentFee.dueDate = fee.dueDate || new Date();
      studentFee.updatedAt = new Date();
    }
    await studentFee.save();
  }

  console.log('Synced StudentFee with FeeStructure for pending dues.');
  await mongoose.disconnect();
}

sync();
