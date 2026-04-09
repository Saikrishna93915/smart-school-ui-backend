/**
 * Seed Script: Initialize Timetable Data with Time Slots and Sample Schedules
 * Run: node scripts/seedTimetable.js
 * 
 * This script will:
 * 1. Create standard school day time slots (8 periods + breaks)
 * 2. Create sample timetables for Classes 1-10
 * 3. Populate timetable slots with subject-teacher assignments
 * 4. Demonstrate conflict detection (optional - can be enabled)
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../src/config/db.js";
import TimeSlot from "../src/models/TimeSlot.js";
import Timetable from "../src/models/Timetable.js";
import TimetableSlot from "../src/models/TimetableSlot.js";
import TeacherAvailability from "../src/models/TeacherAvailability.js";
import Class from "../src/models/Class.js";
import Subject from "../src/models/Subject.js";
import TeacherAssignment from "../src/models/TeacherAssignment.js";
import User from "../src/models/User.js";

dotenv.config();

// Academic Year Configuration
const ACADEMIC_YEAR = "2025-26";
const TERM = "term1";

// Standard School Day Time Slots
const timeSlots = [
  {
    slotName: "Period 1",
    slotType: "period",
    startTime: "08:00",
    endTime: "08:45",
    displayOrder: 1,
  },
  {
    slotName: "Period 2",
    slotType: "period",
    startTime: "08:50",
    endTime: "09:35",
    displayOrder: 2,
  },
  {
    slotName: "Short Break",
    slotType: "break",
    startTime: "09:35",
    endTime: "09:50",
    displayOrder: 3,
  },
  {
    slotName: "Period 3",
    slotType: "period",
    startTime: "09:50",
    endTime: "10:35",
    displayOrder: 4,
  },
  {
    slotName: "Period 4",
    slotType: "period",
    startTime: "10:40",
    endTime: "11:25",
    displayOrder: 5,
  },
  {
    slotName: "Lunch Break",
    slotType: "lunch",
    startTime: "11:25",
    endTime: "12:10",
    displayOrder: 6,
  },
  {
    slotName: "Period 5",
    slotType: "period",
    startTime: "12:10",
    endTime: "12:55",
    displayOrder: 7,
  },
  {
    slotName: "Period 6",
    slotType: "period",
    startTime: "13:00",
    endTime: "13:45",
    displayOrder: 8,
  },
  {
    slotName: "Period 7",
    slotType: "period",
    startTime: "13:50",
    endTime: "14:35",
    displayOrder: 9,
  },
  {
    slotName: "Period 8",
    slotType: "period",
    startTime: "14:40",
    endTime: "15:25",
    displayOrder: 10,
  },
];

// Days of week mapping
const DAYS = {
  MONDAY: { dayOfWeek: 1, dayName: "Monday" },
  TUESDAY: { dayOfWeek: 2, dayName: "Tuesday" },
  WEDNESDAY: { dayOfWeek: 3, dayName: "Wednesday" },
  THURSDAY: { dayOfWeek: 4, dayName: "Thursday" },
  FRIDAY: { dayOfWeek: 5, dayName: "Friday" },
  SATURDAY: { dayOfWeek: 6, dayName: "Saturday" },
};

/**
 * Clear existing timetable data
 */
async function clearExistingData() {
  console.log("\n🗑️  Clearing existing timetable data...");
  
  const deleteResults = await Promise.all([
    TimeSlot.deleteMany({ academicYearId: ACADEMIC_YEAR }),
    Timetable.deleteMany({ academicYearId: ACADEMIC_YEAR }),
    TimetableSlot.deleteMany({}),
    TeacherAvailability.deleteMany({ academicYearId: ACADEMIC_YEAR }),
  ]);

  console.log(`   ✓ Deleted ${deleteResults[0].deletedCount} time slots`);
  console.log(`   ✓ Deleted ${deleteResults[1].deletedCount} timetables`);
  console.log(`   ✓ Deleted ${deleteResults[2].deletedCount} timetable slots`);
  console.log(`   ✓ Deleted ${deleteResults[3].deletedCount} teacher availabilities`);
}

/**
 * Create time slots for the school day
 */
async function createTimeSlots() {
  console.log("\n⏰ Creating time slots...");
  
  const slotsToCreate = timeSlots.map(slot => ({
    ...slot,
    academicYearId: ACADEMIC_YEAR,
    isActive: true,
  }));

  const createdSlots = await TimeSlot.insertMany(slotsToCreate);
  console.log(`   ✓ Created ${createdSlots.length} time slots`);
  
  return createdSlots;
}

/**
 * Get teaching periods (exclude breaks)
 */
function getTeachingPeriods(allSlots) {
  return allSlots.filter(slot => slot.slotType === "period");
}

/**
 * Create timetables for classes
 */
async function createTimetables(classes, adminUser) {
  console.log("\n📋 Creating timetables...");
  
  const timetablesToCreate = [];
  const today = new Date();
  const sixMonthsLater = new Date();
  sixMonthsLater.setMonth(today.getMonth() + 6);
  
  for (const cls of classes) {
    // Create timetable for Section A (most classes have it)
    timetablesToCreate.push({
      classId: cls._id,
      sectionId: "A",
      academicYearId: ACADEMIC_YEAR,
      term: TERM,
      version: 1,
      status: "draft",
      isPublished: false,
      totalPeriods: 48, // 8 periods x 6 days
      assignedPeriods: 0,
      notes: `Timetable for ${cls.className} - Section A`,
      effectiveFrom: today,
      effectiveTo: sixMonthsLater,
      createdBy: adminUser._id,
    });

    // Create for Section B if class has it
    if (cls.sections && cls.sections.includes("B")) {
      timetablesToCreate.push({
        classId: cls._id,
        sectionId: "B",
        academicYearId: ACADEMIC_YEAR,
        term: TERM,
        version: 1,
        status: "draft",
        isPublished: false,
        totalPeriods: 48,
        assignedPeriods: 0,
        notes: `Timetable for ${cls.className} - Section B`,
        effectiveFrom: today,
        effectiveTo: sixMonthsLater,
        createdBy: adminUser._id,
      });
    }
  }

  const createdTimetables = await Timetable.insertMany(timetablesToCreate);
  console.log(`   ✓ Created ${createdTimetables.length} timetables`);
  
  return createdTimetables;
}

/**
 * Get teacher assignment for a subject in a class
 */
async function getTeacherForSubject(classId, subjectId) {
  const assignment = await TeacherAssignment.findOne({
    classId,
    subjectId,
    academicYearId: ACADEMIC_YEAR,
  }).populate('teacherId');
  
  return assignment?.teacherId?._id || null;
}

/**
 * Create weekly schedule template
 * Returns array of {dayOfWeek, periodIndex, subjectIndex}
 */
function generateWeeklySchedule(subjectsCount) {
  const schedule = [];
  const periodsPerDay = 8;
  const daysOfWeek = [1, 2, 3, 4, 5, 6]; // Monday to Saturday
  
  // Simple round-robin distribution
  let subjectIndex = 0;
  
  for (const day of daysOfWeek) {
    for (let period = 0; period < periodsPerDay; period++) {
      // Skip last period on Saturday for activities/sports
      if (day === 6 && period === 7) {
        continue;
      }
      
      schedule.push({
        dayOfWeek: day,
        periodIndex: period,
        subjectIndex: subjectIndex % subjectsCount,
      });
      
      subjectIndex++;
    }
  }
  
  return schedule;
}

/**
 * Populate timetable slots for a timetable
 */
async function populateTimetableSlots(timetable, teachingPeriods, classObj) {
  console.log(`\n   📝 Populating slots for ${classObj.className} - Section ${timetable.sectionId}...`);
  
  // Get subjects for this class
  const subjects = await Subject.find({
    classId: classObj._id,
  }).limit(8); // Get up to 8 subjects
  
  if (subjects.length === 0) {
    console.log(`      ⚠️  No subjects found for ${classObj.className}`);
    return [];
  }
  
  // Generate weekly schedule
  const schedule = generateWeeklySchedule(subjects.length);
  
  const slotsToCreate = [];
  let successCount = 0;
  let skipCount = 0;
  
  for (const entry of schedule) {
    const subject = subjects[entry.subjectIndex];
    const timeSlot = teachingPeriods[entry.periodIndex];
    
    if (!timeSlot) continue;
    
    // Get teacher for this subject
    const teacherId = await getTeacherForSubject(classObj._id, subject._id);
    
    if (!teacherId) {
      skipCount++;
      continue; // Skip if no teacher assigned
    }
    
    slotsToCreate.push({
      timetableId: timetable._id,
      dayOfWeek: entry.dayOfWeek,
      timeSlotId: timeSlot._id,
      subjectId: subject._id,
      teacherId: teacherId,
      roomNumber: `Room ${Math.floor(100 + Math.random() * 200)}`,
      isLabSession: subject.subjectName === "Computer",
      hasConflict: false,
      isActive: true,
    });
    
    successCount++;
    
    // Limit to prevent too many slots
    if (slotsToCreate.length >= 40) break;
  }
  
  if (slotsToCreate.length > 0) {
    const createdSlots = await TimetableSlot.insertMany(slotsToCreate);
    
    // Update timetable stats
    await Timetable.findByIdAndUpdate(timetable._id, {
      assignedPeriods: createdSlots.length,
    });
    
    console.log(`      ✓ Created ${createdSlots.length} slots (${skipCount} skipped - no teacher)`);
    return createdSlots;
  }
  
  console.log(`      ⚠️  No slots created (no teacher assignments found)`);
  return [];
}

/**
 * Create sample teacher unavailability
 */
async function createTeacherAvailability(teachers, teachingPeriods) {
  console.log("\n🚫 Creating sample teacher unavailability...");
  
  if (teachers.length === 0 || teachingPeriods.length === 0) {
    console.log("   ⚠️  No teachers or periods available");
    return;
  }
  
  const unavailabilities = [];
  
  // Pick random teacher and make them unavailable on Wednesday Period 1
  const randomTeacher = teachers[Math.floor(Math.random() * teachers.length)];
  const period1 = teachingPeriods[0];
  
  unavailabilities.push({
    teacherId: randomTeacher._id,
    dayOfWeek: 3, // Wednesday
    timeSlotId: period1._id,
    academicYearId: ACADEMIC_YEAR,
    term: TERM,
    isAvailable: false,
    unavailabilityType: "training",
    reason: "Teacher Training Session",
    isPermanent: false,
    isRecurring: true,
  });
  
  if (unavailabilities.length > 0) {
    await TeacherAvailability.insertMany(unavailabilities);
    console.log(`   ✓ Created ${unavailabilities.length} teacher unavailability records`);
  }
}

/**
 * Display summary report
 */
async function displaySummary() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 TIMETABLE SEED SUMMARY");
  console.log("=".repeat(60));
  
  const timeSlotCount = await TimeSlot.countDocuments({ academicYearId: ACADEMIC_YEAR });
  const timetableCount = await Timetable.countDocuments({ academicYearId: ACADEMIC_YEAR });
  const slotCount = await TimetableSlot.countDocuments({});
  const availabilityCount = await TeacherAvailability.countDocuments({ academicYearId: ACADEMIC_YEAR });
  
  console.log(`\nAcademic Year: ${ACADEMIC_YEAR}`);
  console.log(`Term: ${TERM}`);
  console.log(`\n✅ Time Slots Created: ${timeSlotCount}`);
  console.log(`✅ Timetables Created: ${timetableCount}`);
  console.log(`✅ Timetable Slots Assigned: ${slotCount}`);
  console.log(`✅ Teacher Unavailabilities: ${availabilityCount}`);
  
  // Show sample timetables
  const sampleTimetables = await Timetable.find({ academicYearId: ACADEMIC_YEAR })
    .populate('classId')
    .limit(5);
  
  console.log(`\n📋 Sample Timetables:`);
  for (const tt of sampleTimetables) {
    const completion = Math.round((tt.assignedPeriods / tt.totalPeriods) * 100);
    console.log(`   • ${tt.classId?.className || 'Unknown Class'} - Section ${tt.sectionId}: ${tt.assignedPeriods}/${tt.totalPeriods} slots (${completion}%)`);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Timetable seeding completed successfully!");
  console.log("=".repeat(60));
  
  console.log("\n📝 Next Steps:");
  console.log("   1. Test API: GET http://localhost:8080/api/timeslots");
  console.log("   2. View Timetables: GET http://localhost:8080/api/timetable");
  console.log("   3. Check conflicts: GET http://localhost:8080/api/timetable/conflicts");
  console.log("\n");
}

/**
 * Main execution function
 */
async function seedTimetable() {
  try {
    // Connect to database
    await connectDB();
    console.log("✅ Connected to MongoDB");
    
    // Step 1: Clear existing data
    await clearExistingData();
    
    // Step 2: Create time slots
    const allTimeSlots = await createTimeSlots();
    const teachingPeriods = getTeachingPeriods(allTimeSlots);
    
    // Step 3: Get existing classes
    console.log("\n🏫 Fetching classes...");
    const classes = await Class.find({}).limit(10);
    
    if (classes.length === 0) {
      console.log("❌ No classes found. Please run seedClasses.js first.");
      process.exit(1);
    }
    
    console.log(`   ✓ Found ${classes.length} classes`);
    
    // Step 3.5: Get admin user for createdBy
    console.log("\n👤 Finding admin user...");
    let adminUser = await User.findOne({ role: "owner" });
    if (!adminUser) {
      adminUser = await User.findOne({ role: "admin" });
    }
    if (!adminUser) {
      console.log("   ⚠️  No admin user found, using first user");
      adminUser = await User.findOne({});
    }
    if (!adminUser) {
      console.log("❌ No users found. Please run seedOwner.js first.");
      process.exit(1);
    }
    console.log(`   ✓ Using user: ${adminUser.name || adminUser.email}`);
    
    // Step 4: Create timetables
    const timetables = await createTimetables(classes, adminUser);
    
    // Step 5: Populate timetable slots
    console.log("\n📚 Populating timetable slots...");
    let totalSlots = 0;
    
    for (const timetable of timetables) {
      const classObj = classes.find(c => c._id.toString() === timetable.classId.toString());
      if (classObj) {
        const slots = await populateTimetableSlots(timetable, teachingPeriods, classObj);
        totalSlots += slots.length;
      }
    }
    
    console.log(`\n   ✓ Total slots created: ${totalSlots}`);
    
    // Step 6: Create sample teacher unavailability
    const teachers = await User.find({ role: "teacher" }).limit(5);
    await createTeacherAvailability(teachers, teachingPeriods);
    
    // Step 7: Display summary
    await displaySummary();
    
    // Disconnect
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
    
  } catch (error) {
    console.error("\n❌ Error seeding timetable:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the seed script
seedTimetable();
