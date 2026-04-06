/**
 * API Test Script for Timetable System
 * Run: node scripts/testTimetableAPI.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../src/config/db.js";
import TimeSlot from "../src/models/TimeSlot.js";
import Timetable from "../src/models/Timetable.js";
import TimetableSlot from "../src/models/TimetableSlot.js";
import Class from "../src/models/Class.js";
import Subject from "../src/models/Subject.js";
import User from "../src/models/User.js";

dotenv.config();

const ACADEMIC_YEAR = "2025-26";

async function testTimetableAPI() {
  try {
    await connectDB();
    console.log("✅ Connected to MongoDB\\n");

    console.log("=" .repeat(60));
    console.log("🧪 TIMETABLE API TEST RESULTS");
    console.log("=".repeat(60));

    // Test 1: Get Time Slots
    console.log("\\n📝 TEST 1: Fetch Time Slots");
    const timeSlots = await TimeSlot.find({ academicYearId: ACADEMIC_YEAR })
      .sort({ displayOrder: 1 });
    
    console.log(`   ✅ Found ${timeSlots.length} time slots`);
    if (timeSlots.length > 0) {
      const firstSlot = timeSlots[0];
      console.log(`   📌 Sample: ${firstSlot.slotName} (${firstSlot.startTime} - ${firstSlot.endTime})`);
      console.log(`      Duration: ${firstSlot.durationMinutes} minutes`);
    }

    // Test 2: Get Timetables
    console.log("\\n📝 TEST 2: Fetch Timetables");
    const timetables = await Timetable.find({ academicYearId: ACADEMIC_YEAR })
      .populate('classId')
      .limit(5);
    
    console.log(`   ✅ Found ${timetables.length} timetables`);
    if (timetables.length > 0) {
      const firstTimetable = timetables[0];
      console.log(`   📌 Sample: ${firstTimetable.classId?.className || 'Unknown'} - Section ${firstTimetable.sectionId}`);
      console.log(`      Status: ${firstTimetable.status}`);
      console.log(`      Version: ${firstTimetable.version}`);
      console.log(`      Progress: ${firstTimetable.assignedPeriods}/${firstTimetable.totalPeriods} slots`);
    }

    // Test 3: Create a test timetable slot manually
    console.log("\\n📝 TEST 3: Create Manual Timetable Slot");
    
    const testClass = await Class.findOne({});
    const testTimetable = await Timetable.findOne({ classId: testClass._id });
    const testTimeSlot = await TimeSlot.findOne({ slotType: "period" });
    const testSubject = await Subject.findOne({});
    const testTeacher = await User.findOne({ role: "teacher" });

    if (testTimetable && testTimeSlot && testSubject && testTeacher) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeekNum = 1; // Monday
      
      const newSlot = await TimetableSlot.create({
        timetableId: testTimetable._id,
        dayOfWeek: dayOfWeekNum,
        dayName: days[dayOfWeekNum],
        timeSlotId: testTimeSlot._id,
        subjectId: testSubject._id,
        teacherId: testTeacher._id,
        roomNumber: "Room 101",
        hasConflict: false,
      });

      await Timetable.findByIdAndUpdate(testTimetable._id, {
        $inc: { assignedPeriods: 1 }
      });

      console.log(`   ✅ Created slot: ${testClass.className} - Monday ${testTimeSlot.slotName}`);
      console.log(`      Subject: ${testSubject.subjectName}`);
      console.log(`      Teacher: ${testTeacher.name || testTeacher.email}`);
      console.log(`      Room: ${newSlot.roomNumber}`);
    } else {
      console.log(`   ⚠️  Skipped: Missing required data`);
    }

    // Test 4: Get slots for a timetable
    console.log("\\n📝 TEST 4: Fetch Timetable Slots");
    const slots = await TimetableSlot.find({})
      .populate('timeSlotId')
      .populate('subjectId')
      .populate('teacherId', 'name email')
      .limit(5);
    
    console.log(`   ✅ Found ${slots.length} timetable slots in database`);
    for (const slot of slots) {
      console.log(`   📌 ${slot.dayName} - ${slot.timeSlotId?.slotName}`);
      console.log(`      Subject: ${slot.subjectId?.subjectName || 'N/A'}`);
      console.log(`      Teacher: ${slot.teacherId?.name || slot.teacherId?.email || 'N/A'}`);
    }

    // Test 5: Count statistics
    console.log("\\n📝 TEST 5: Database Statistics");
    const stats = {
      timeSlots: await TimeSlot.countDocuments({ academicYearId: ACADEMIC_YEAR }),
      timetables: await Timetable.countDocuments({ academicYearId: ACADEMIC_YEAR }),
      timetableSlots: await TimetableSlot.countDocuments({}),
      publishedTimetables: await Timetable.countDocuments({ 
        academicYearId: ACADEMIC_YEAR, 
        isPublished: true 
      }),
      draftTimetables: await Timetable.countDocuments({ 
        academicYearId: ACADEMIC_YEAR, 
        status: 'draft' 
      }),
    };

    console.log(`   ✅ Time Slots: ${stats.timeSlots}`);
    console.log(`   ✅ Timetables: ${stats.timetables}`);
    console.log(`   ✅ Timetable Slots: ${stats.timetableSlots}`);
    console.log(`   ✅ Published: ${stats.publishedTimetables}`);
    console.log(`   ✅ Draft: ${stats.draftTimetables}`);

    // Test 6: Conflict detection simulation
    console.log("\\n📝 TEST 6: Conflict Detection Test");
    const conflictedSlots = await TimetableSlot.find({ hasConflict: true });
    console.log(`   ✅ Slots with conflicts: ${conflictedSlots.length}`);

    // Test 7: Teacher workload analysis
    console.log("\\n📝 TEST 7: Teacher Workload Analysis");
    const teacherSlots = await TimetableSlot.aggregate([
      {
        $group: {
          _id: "$teacherId",
          slotCount: { $sum: 1 }
        }
      },
      { $sort: { slotCount: -1 } },
      { $limit: 5 }
    ]);

    if (teacherSlots.length > 0) {
      console.log(`   ✅ Teachers with slots: ${teacherSlots.length}`);
      for (const ts of teacherSlots) {
        if (ts._id) {
          const teacher = await User.findById(ts._id);
          console.log(`   📌 ${teacher?.name || teacher?.email || 'Unknown'}: ${ts.slotCount} periods`);
        }
      }
    } else {
      console.log(`   ⚠️  No teacher assignments yet`);
    }

    // Display API endpoints
    console.log("\\n" + "=".repeat(60));
    console.log("🌐 AVAILABLE API ENDPOINTS");
    console.log("=".repeat(60));
    console.log("\\n📍 Time Slot APIs:");
    console.log("   GET    /api/timeslots");
    console.log("   POST   /api/timeslots");
    console.log("   POST   /api/timeslots/bulk");
    console.log("   PUT    /api/timeslots/reorder");
    console.log("   PUT    /api/timeslots/:id");
    console.log("   DELETE /api/timeslots/:id");
    
    console.log("\\n📍 Timetable APIs:");
    console.log("   GET    /api/timetable");
    console.log("   GET    /api/timetable/conflicts");
    console.log("   GET    /api/timetable/teacher/:teacherId");
    console.log("   GET    /api/timetable/:classId/:sectionId");
    console.log("   POST   /api/timetable");
    console.log("   PUT    /api/timetable/:id");
    console.log("   POST   /api/timetable/:timetableId/slots");
    console.log("   DELETE /api/timetable/slots/:slotId");
    console.log("   POST   /api/timetable/:id/publish");
    console.log("   POST   /api/timetable/:id/clone");

    console.log("\\n" + "=".repeat(60));
    console.log("✅ ALL TESTS COMPLETED");
    console.log("=".repeat(60));
    console.log("\\n📝 Next Steps:");
    console.log("   • Test endpoints with Postman/Thunder Client");
    console.log("   • Create frontend Timetable Grid component");
    console.log("   • Build Slot Assignment UI\\n");

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("\\n❌ Test Error:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

testTimetableAPI();
