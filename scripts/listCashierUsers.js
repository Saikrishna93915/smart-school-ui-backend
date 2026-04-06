// listCashierUsers.js
// Run: node scripts/listCashierUsers.js
import mongoose from 'mongoose';
import User from '../src/models/User.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/school-erp';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const cashiers = await User.find({ role: 'cashier' });
  if (cashiers.length === 0) {
    console.log('No cashier users found.');
  } else {
    cashiers.forEach(user => {
      console.log(`Cashier: ${user.username} | Email: ${user.email} | Active: ${user.active} | Password Hash: ${user.password}`);
    });
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error listing cashier users:', err);
  mongoose.disconnect();
});
