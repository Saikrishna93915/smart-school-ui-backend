import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import connectDB from '../src/config/db.js';

dotenv.config();

const updateTeacherAssignment = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Find Aswin Raj
    const aswinUser = await User.findOne({
      $or: [
        { name: { $regex: 'Aswin', $options: 'i' } },
        { 'personal.firstName': 'Aswin' }
      ]
    });

    if (!aswinUser) {
      console.log('❌ Aswin Raj not found!');
      console.log('\n📋 Available teachers:');
      const teachers = await User.find({ role: 'teacher' });
      teachers.slice(0, 10).forEach(t => {
        console.log(`  - ${t.name}`);
      });
      mongoose.connection.close();
      return;
    }

    console.log(`✅ Found: ${aswinUser.name}`);
    console.log(`   ID: ${aswinUser._id}\n`);

    // Update the existing assignment
    const db = mongoose.connection.db;
    const result = await db.collection('teacherassignments').updateOne(
      {
        className: '10th Class',
        section: 'A',
        academicYear: '2025-2026'
      },
      {
        $set: {
          teacherId: aswinUser._id,
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount === 0) {
      console.log('⚠️  No assignments were updated');
      mongoose.connection.close();
      return;
    }

    console.log('✅ Assignment Updated Successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Teacher: ${aswinUser.name}`);
    console.log(`Subject: Computer`);
    console.log(`Class: 10th Class Section A`);
    console.log(`Academic Year: 2025-2026`);
    console.log(`Status: Active`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n🎯 Go back to Timetable and reload - qualification_mismatch should be gone!');

    mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    mongoose.connection.close();
  }
};

updateTeacherAssignment();
