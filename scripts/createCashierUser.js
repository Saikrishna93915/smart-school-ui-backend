// createCashierUser.js
// Run: node scripts/createCashierUser.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/school_erp';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const username = 'cashier@school.com';
  const password = 'Cashier@123';
  const role = 'cashier';

  // If user exists, reset credentials to known-good values.
  const existing = await User.findOne({ username, role });
  if (existing) {
    existing.name = 'Cashier User';
    existing.email = username;
    existing.password = password;
    existing.phone = '9000000010';
    existing.forcePasswordChange = true;
    existing.active = true;
    await existing.save();
    console.log('Cashier user already existed. Password has been reset.');
    await mongoose.disconnect();
    return;
  }

  const user = new User({
    name: 'Cashier User',
    username,
    email: username,
    password,
    role,
    phone: '9000000010',
    forcePasswordChange: true,
    active: true,
  });

  await user.save();
  console.log('Cashier user created successfully.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error creating cashier user:', err);
  mongoose.disconnect();
});
