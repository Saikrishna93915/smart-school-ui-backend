import dotenv from 'dotenv';
import connectDB from '../src/config/db.js';
import TimetableSlot from '../src/models/TimetableSlot.js';
import Teacher from '../src/models/Teacher.js';
import User from '../src/models/User.js';

dotenv.config();

async function resolveTeacherUserId(teacherId) {
  if (!teacherId) return null;

  const teacher = await Teacher.findById(teacherId).select('user');
  if (teacher?.user) {
    return teacher.user;
  }

  const user = await User.findById(teacherId).select('_id');
  return user?._id || null;
}

const run = async () => {
  await connectDB();

  const slots = await TimetableSlot.find({
    isActive: true,
    teacherId: { $ne: null }
  }).select('_id teacherId');

  let updatedCount = 0;
  let skippedCount = 0;

  for (const slot of slots) {
    const normalizedTeacherId = await resolveTeacherUserId(slot.teacherId);

    if (!normalizedTeacherId) {
      skippedCount += 1;
      continue;
    }

    if (String(normalizedTeacherId) !== String(slot.teacherId)) {
      await TimetableSlot.findByIdAndUpdate(slot._id, {
        teacherId: normalizedTeacherId
      });
      updatedCount += 1;
    }
  }

  console.log('Timetable teacher reference migration completed:');
  console.log({
    totalSlots: slots.length,
    updatedCount,
    skippedCount,
    unchangedCount: slots.length - updatedCount - skippedCount
  });

  process.exit(0);
};

run().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
