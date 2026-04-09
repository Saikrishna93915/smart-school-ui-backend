import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Subject from '../src/models/Subject.js';
import connectDB from '../src/config/db.js';

dotenv.config();

const checkSubjects = async () => {
  try {
    await connectDB();
    
    const allSubjects = await Subject.find({}).limit(10);
    console.log('Total subjects in DB:', await Subject.countDocuments());
    console.log('\nFirst 10 subjects:');
    allSubjects.forEach(sub => {
      console.log(`- Class: "${sub.className}", Subject: "${sub.subjectName}", Academic Year: "${sub.academicYear}", Active: ${sub.isActive}`);
    });
    
    // Check specifically for LKG
    const lkgSubjects = await Subject.find({ className: 'LKG' });
    console.log(`\nLKG subjects found: ${lkgSubjects.length}`);
    if (lkgSubjects.length > 0) {
      console.log('LKG subjects:', lkgSubjects.map(s => s.subjectName));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
};

checkSubjects();
