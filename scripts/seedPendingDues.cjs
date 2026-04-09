// Script to seed test StudentFee records with pending dues (CommonJS)
const mongoose = require('mongoose');
const StudentFee = require('../src/models/StudentFee');
const Student = require('../src/models/Student');

async function seed() {
  await mongoose.connect('mongodb://localhost:27017/school-erp');

  // Find a student or create one
  let student = await Student.findOne();
  if (!student) {
    student = await Student.create({
      admissionNumber: 'ADM2026001',
      student: { firstName: 'Test', lastName: 'Student', gender: 'Male' },
      class: { className: '10', section: 'A', academicYear: '2025-2026' },
      parents: { father: { name: 'Father', phone: '9999999999' }, mother: { name: 'Mother', phone: '8888888888' } }
    });
  }

  // Create a StudentFee record with pending dues
  await StudentFee.create({
    studentId: student._id,
    admissionNumber: student.admissionNumber,
    academicYear: '2025-2026',
    className: student.class.className,
    section: student.class.section,
    feeStructureId: new mongoose.Types.ObjectId(),
    totalFeeAmount: 10000,
    totalPaid: 2000,
    totalDue: 8000,
    discountAmount: 0,
    lateFeeAmount: 0,
    feeItems: [],
    payments: [{
      receiptNumber: 'REC-20260316-001',
      amount: 2000,
      paymentDate: new Date(),
      paymentMethod: 'cash',
      status: 'completed'
    }],
    paymentHistory: [{
      date: new Date(),
      amount: 2000,
      description: 'Initial payment',
      receiptNumber: 'REC-20260316-001'
    }],
    status: 'partial',
    dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    reminders: [],
    createdAt: new Date(),
    updatedAt: new Date()
  });

  console.log('Seeded pending dues record.');
  await mongoose.disconnect();
}

seed();
