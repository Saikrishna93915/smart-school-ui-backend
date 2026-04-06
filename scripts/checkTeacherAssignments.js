import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../src/config/db.js';

dotenv.config();

const checkComputerAssignments = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Access the collection directly to avoid schema issues
    const db = mongoose.connection.db;
    const assignments = await db.collection('teacherassignments').find({
      className: '10th Class',
      section: 'A',
      academicYear: '2025-2026'
    }).toArray();

    if (assignments.length === 0) {
      console.log('❌ No assignments found for 10th Class Section A');
      mongoose.connection.close();
      return;
    }

    console.log(`📋 Found ${assignments.length} assignment(s) for 10th Class Section A:\n`);
    
    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i];
      const teacherDoc = await db.collection('users').findOne({ _id: a.teacherId });
      const subjectDoc = await db.collection('subjects').findOne({ _id: a.subjectId });
      
      const teacherName = teacherDoc?.name || 'Unknown Teacher';
      const subjectName = subjectDoc?.subjectName || 'Unknown Subject';
      
      console.log(`${i + 1}. Teacher: ${teacherName}`);
      console.log(`   Subject: ${subjectName}`);
      console.log(`   Active: ${a.isActive}`);
      console.log(`   ID: ${a._id}`);
      console.log(`   ---`);
    }

    mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    mongoose.connection.close();
  }
};

checkComputerAssignments();

