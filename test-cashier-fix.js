// Test script to verify cashier dashboard API
import mongoose from 'mongoose';

const MONGO_URI = 'mongodb://127.0.0.1:27017/school_erp';

async function testDashboardData() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const feeStructureCollection = db.collection('feestructures');

    // Test 1: Count documents with totalDue > 0
    console.log('\n📊 Test 1: Counting pending dues...');
    const pendingCount = await feeStructureCollection.countDocuments({ 
      totalDue: { $gt: 0 },
      status: { $ne: 'inactive' }
    });
    console.log(`✅ Found ${pendingCount} students with pending dues`);

    // Test 2: Get total pending amount
    console.log('\n💰 Test 2: Calculating total pending amount...');
    const totalPending = await feeStructureCollection.aggregate([
      { $match: { totalDue: { $gt: 0 }, status: { $ne: 'inactive' } } },
      { $group: { _id: null, total: { $sum: '$totalDue' } } }
    ]).toArray();
    
    console.log(`✅ Total pending amount: ₹${totalPending[0]?.total || 0}`);

    // Test 3: Sample pending dues
    console.log('\n📋 Test 3: Sample pending dues (first 5)...');
    const sampleDues = await feeStructureCollection.find({ 
      totalDue: { $gt: 0 },
      status: { $ne: 'inactive' }
    })
    .limit(5)
    .project({ 
      studentName: 1, 
      admissionNumber: 1, 
      className: 1, 
      totalDue: 1,
      totalFee: 1,
      totalPaid: 1
    })
    .toArray();

    console.table(sampleDues.map(d => ({
      Name: d.studentName,
      'Admission No': d.admissionNumber,
      Class: d.className,
      'Total Fee': d.totalFee,
      'Paid': d.totalPaid,
      'Pending': d.totalDue
    })));

    // Test 4: Check collection names
    console.log('\n📁 Test 4: Available collections...');
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name).join(', '));

    await mongoose.connection.close();
    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testDashboardData();
