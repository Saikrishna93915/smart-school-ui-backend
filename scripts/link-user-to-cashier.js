// Link user to cashier profile - Run this once
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User = (await import('../src/models/User.js')).default;
const Cashier = (await import('../src/models/Cashier.js')).default;

const linkUserToCashier = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/school_erp');
    console.log('✅ MongoDB Connected');

    // Find the user by email
    const user = await User.findOne({ email: 'nagendra@school.com' });
    
    if (!user) {
      console.log('❌ User not found. Please check the email.');
      process.exit(1);
    }

    console.log('📄 Found user:', user.email, user.role);

    // Check if cashier already exists
    const existingCashier = await Cashier.findOne({ 
      $or: [{ user: user._id }, { userId: user._id }] 
    });

    if (existingCashier) {
      console.log('✅ Cashier profile already exists for this user');
      console.log('Cashier ID:', existingCashier._id);
      console.log('Employee ID:', existingCashier.employeeId);
      process.exit(0);
    }

    // Create cashier profile
    const cashier = await Cashier.create({
      employeeId: 'EMP' + Date.now(),
      firstName: user.name?.split(' ')[0] || 'Cashier',
      lastName: user.name?.split(' ')[1] || 'User',
      email: user.email,
      phone: user.phone || '9876543210',
      branch: 'Main Branch',
      shiftTiming: 'full-day',
      status: 'active',
      user: user._id,
      userId: user._id,
      permissions: {
        canCollectFees: true,
        canIssueReceipts: true,
        canVoidTransactions: false,
        canRefund: false,
        dailyLimit: 100000
      }
    });

    console.log('✅ Cashier profile created successfully!');
    console.log('Cashier ID:', cashier._id);
    console.log('Employee ID:', cashier.employeeId);
    console.log('Name:', cashier.firstName, cashier.lastName);
    console.log('Email:', cashier.email);

    // Update user role if needed
    if (user.role !== 'cashier') {
      user.role = 'cashier';
      await user.save();
      console.log('🔄 User role updated to: cashier');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

linkUserToCashier();
