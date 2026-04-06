import mongoose from "mongoose";
import Student from "../src/models/Student.js";
import FeeStructure from "../src/models/FeeStructure.js";

const MONGO_URI = "mongodb://127.0.0.1:27017/school_erp";

// Fee structure by class (LKG to 10th)
const classFeeMapping = {
  "LKG": 20000,
  "UKG": 22000,
  "1": 24000,
  "2": 25000,
  "3": 26000,
  "4": 28000,
  "5": 30000,
  "6": 32000,
  "7": 34000,
  "8": 36000,
  "9": 38000,
  "10": 40000
};

// Indian first names by gender
const indianFirstNames = {
  Male: [
    "Aarav", "Aditya", "Arjun", "Rohit", "Rahul",
    "Vikram", "Ajay", "Sanjay", "Nikhil", "Karan",
    "Harsh", "Jatin", "Abhishek", "Anant", "Siddharth"
  ],
  Female: [
    "Ananya", "Divya", "Esha", "Gowri", "Ishita",
    "Isha", "Jasmine", "Kavya", "Laxmi", "Meera",
    "Natasha", "Ola", "Priya", "Riya", "Sneha"
  ]
};

// Indian last names
const indianLastNames = [
  "Sharma", "Patel", "Kumar", "Singh", "Gupta",
  "Khan", "Iyer", "Verma", "Reddy", "Joshi",
  "Nair", "Mishra", "Rao", "Desai", "Chopra",
  "Malhotra", "Menon", "Sinha", "Bhat", "Pillai"
];

// Indian parent names
const indianParentNames = [
  "Rajesh", "Amit", "Anil", "Manish", "Suresh",
  "Prakash", "Venkatesh", "Ahmed", "Mohammad", "Ali",
  "Priya", "Anjali", "Swapna", "Nisha", "Kavya",
  "Meera", "Lakshmi", "Fatima", "Sneha", "Pooja"
];

const occupations = [
  "Engineer", "Doctor", "Lawyer", "Teacher", "Consultant",
  "Business Owner", "Accountant", "Banker", "Nurse", "Architect",
  "Factory Owner", "Trader", "Professor", "Software Developer",
  "Home Maker", "Librarian", "Designer", "Content Writer"
];

// Function to generate random student
function generateStudent(admissionNumber, className, section, index) {
  const gender = Math.random() > 0.5 ? "Male" : "Female";
  const firstName = indianFirstNames[gender][Math.floor(Math.random() * indianFirstNames[gender].length)];
  const lastName = indianLastNames[Math.floor(Math.random() * indianLastNames.length)];

  const fatherName = indianParentNames[Math.floor(Math.random() * indianParentNames.length)];
  const motherName = indianParentNames[Math.floor(Math.random() * indianParentNames.length)];

  const fatherOccupation = occupations[Math.floor(Math.random() * occupations.length)];
  const motherOccupation = occupations[Math.floor(Math.random() * occupations.length)];

  // Calculate birth year based on class
  let birthYear;
  if (className === "LKG") {
    birthYear = 2020;
  } else if (className === "UKG") {
    birthYear = 2019;
  } else {
    birthYear = 2018 - parseInt(className);
  }

  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;

  return {
    admissionNumber,
    student: {
      firstName,
      lastName,
      gender,
      dob: new Date(birthYear, month - 1, day)
    },
    class: {
      className,
      section,
      academicYear: "2025-2026"
    },
    parents: {
      father: {
        name: `${fatherName} ${lastName}`,
        phone: `98${String(Math.floor(Math.random() * 999999999)).padStart(9, '0')}`,
        email: `${fatherName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
        occupation: fatherOccupation
      },
      mother: {
        name: `${motherName} ${lastName}`,
        phone: `98${String(Math.floor(Math.random() * 999999999)).padStart(9, '0')}`,
        email: `${motherName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
        occupation: motherOccupation
      }
    },
    address: {
      street: `${Math.floor(Math.random() * 1000)} ${["MG Road", "Brigade Road", "Commercial Street", "Indiranagar", "Whitefield", "Koramangala", "Jayanagar", "Bellandur", "Marathahalli", "Sarjapur Road"][Math.floor(Math.random() * 10)]}`,
      city: "Bangalore",
      state: "Karnataka",
      pincode: `56000${Math.floor(Math.random() * 10)}`
    },
    status: "active"
  };
}

// Function to generate fee structure
async function generateFeeStructure(student, classNum) {
  const totalFee = classFeeMapping[classNum];
  const dueDate = new Date(2026, 5, 30); // June 30, 2026

  return {
    admissionNumber: student.admissionNumber,
    studentId: student._id,
    studentName: `${student.student.firstName} ${student.student.lastName}`,
    className: classNum,
    section: student.class.section,
    academicYear: "2025-2026",

    feeComponents: [
      {
        componentName: "Tuition Fee",
        amount: totalFee * 0.70,
        dueDate,
        isMandatory: true,
        isRecurring: true,
        frequency: "yearly",
        status: "pending",
        paidAmount: 0
      },
      {
        componentName: "Development Fee",
        amount: totalFee * 0.15,
        dueDate,
        isMandatory: true,
        isRecurring: false,
        frequency: "one-time",
        status: "pending",
        paidAmount: 0
      },
      {
        componentName: "Library Fee",
        amount: totalFee * 0.10,
        dueDate,
        isMandatory: true,
        isRecurring: false,
        frequency: "one-time",
        status: "pending",
        paidAmount: 0
      },
      {
        componentName: "Activity Fee",
        amount: totalFee * 0.05,
        dueDate,
        isMandatory: false,
        isRecurring: false,
        frequency: "one-time",
        status: "pending",
        paidAmount: 0
      }
    ],

    transportOpted: Math.random() > 0.6 ? true : false,
    transportFee: Math.random() > 0.6 ? 2000 : 0,

    totalFee: totalFee,
    totalPaid: 0,
    totalDue: totalFee,
    discountApplied: 0,
    status: "pending",
    dueDate
  };
}

async function seedStudentsWithFees() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected\n");

    const classes = ["LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    const sections = ["A", "B", "C", "D"];

    let totalStudentsCreated = 0;
    let totalFeesCreated = 0;

    // Clear existing data (optional - comment out to preserve data)
    // await Student.deleteMany({});
    // await FeeStructure.deleteMany({});
    // console.log("🗑️  Cleared existing data\n");

    console.log("📚 STARTING BULK SEEDING...\n");
    console.log("Classes: 12 (LKG, UKG, 1-10)");
    console.log("Sections per class: 4 (A, B, C, D)");
    console.log("Students per section: 12-15");
    console.log("================================================\n");

    // Create students for each class and section
    for (const classNum of classes) {
      console.log(`\n📖 CLASS ${classNum}`);
      console.log("-".repeat(50));

      for (const section of sections) {
        const studentsPerSection = Math.floor(Math.random() * 4) + 12; // 12-15 students
        const classStudents = [];

        for (let i = 1; i <= studentsPerSection; i++) {
          const admissionNumber = `${classNum}-${section}-${String(i).padStart(3, '0')}`;

          // Generate student
          const studentData = generateStudent(admissionNumber, classNum, section, i);
          const createdStudent = await Student.create(studentData);

          // Generate and create fee structure
          const feeData = await generateFeeStructure(createdStudent, classNum);
          await FeeStructure.create(feeData);

          classStudents.push({
            name: `${studentData.student.firstName} ${studentData.student.lastName}`,
            admissionNumber
          });

          totalStudentsCreated++;
          totalFeesCreated++;
        }

        console.log(`  Section ${section}: ${studentsPerSection} students ✅`);
      }
    }

    console.log("\n\n" + "=".repeat(50));
    console.log("✅ SEEDING COMPLETE!");
    console.log("=".repeat(50));
    console.log(`📊 Total Students Created: ${totalStudentsCreated}`);
    console.log(`💰 Total Fee Records Created: ${totalFeesCreated}`);
    console.log(`📚 Classes: ${classes.length}`);
    console.log(`📍 Sections per class: ${sections.length}`);
    console.log(`👨‍🎓 Average students per section: ${Math.round(totalStudentsCreated / (classes.length * sections.length))}`);
    console.log("=".repeat(50) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding students:", error);
    process.exit(1);
  }
}

seedStudentsWithFees();
