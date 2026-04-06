import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TeacherAssignment from '../src/models/TeacherAssignment.js';
import Teacher from '../src/models/Teacher.js';
import User from '../src/models/User.js';
import Subject from '../src/models/Subject.js';
import connectDB from '../src/config/db.js';

dotenv.config();

const fixTeacherAssignments = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB');

    // Find Aswin Raj teacher
    const aswinUser = await User.findOne({
      $or: [
        { 'personal.firstName': 'Aswin', 'personal.lastName': 'Raj' },
        { name: { $regex: 'Aswin', $options: 'i' } }
      ]
    });

    if (!aswinUser) {
      console.log('❌ Aswin Raj not found in User collection');
      console.log('\n📋 Available teachers:');
      const allUsers = await User.find({ role: 'teacher' }).select('name personal');
      allUsers.slice(0, 5).forEach(u => {
        console.log(`  - ${u.name || u.personal?.firstName} ${u.personal?.lastName}`);
      });
      mongoose.connection.close();
      return;
    }

    console.log(`✅ Found teacher: ${aswinUser.name}`);
    const teacherId = aswinUser._id;

    // Find Computer subject for 10th Class
    const computerSubject = await Subject.findOne({
      subjectName: 'Computer',
      className: '10th Class'
    });

    if (!computerSubject) {
      console.log('❌ Computer subject not found for 10th Class');
      console.log('\n📋 Available subjects for 10th Class:');
      const tenthSubjects = await Subject.find({ className: '10th Class' });
      tenthSubjects.slice(0, 5).forEach(s => {
        console.log(`  - ${s.subjectName}`);
      });
      mongoose.connection.close();
      return;
    }

    console.log(`✅ Found subject: ${computerSubject.subjectName}`);
    const subjectId = computerSubject._id;

    // Check if assignment already exists
    const existingAssignment = await TeacherAssignment.findOne({
      teacherId,
      subjectId,
      className: '10th Class',
      section: 'A'
    });

    if (existingAssignment) {
      console.log('⚠️  Assignment already exists!');
      console.log(existingAssignment);
      mongoose.connection.close();
      return;
    }

    // Find admin user for assignedBy
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('❌ Admin user not found');
      mongoose.connection.close();
      return;
    }

    // Create assignment
    const assignment = await TeacherAssignment.create({
      teacherId,
      className: '10th Class',
      section: 'A',
      subjectId,
      academicYear: '2025-2026',
      isActive: true,
      assignedBy: adminUser._id
    });

    console.log('\n✅ Teacher Assignment Created Successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Teacher: ${aswinUser.name}`);
    console.log(`Subject: ${computerSubject.subjectName}`);
    console.log(`Class: 10th Class Section A`);
    console.log(`Academic Year: 2025-2026`);
    console.log(`Active: ${assignment.isActive}`);
    console.log(`Assignment ID: ${assignment._id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n🎯 The qualification_mismatch warning should now disappear!');

    mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    mongoose.connection.close();
  }
};

fixTeacherAssignments();
