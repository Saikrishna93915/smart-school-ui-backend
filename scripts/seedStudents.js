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

const studentsData = [
  {
    admissionNumber: "ADM001",
    student: {
      firstName: "Aarav",
      lastName: "Sharma",
      gender: "Male",
      dob: new Date("2010-03-15"),
    },
    class: {
      className: "10",
      section: "A",
      academicYear: "2025-2026",
    },
    parents: {
      father: {
        name: "Rajesh Sharma",
        phone: "9876543210",
        email: "rajesh.sharma@email.com",
        occupation: "Engineer",
      },
      mother: {
        name: "Priya Sharma",
        phone: "9876543211",
        email: "priya.sharma@email.com",
        occupation: "Teacher",
      },
    },
    address: {
      street: "123 MG Road",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560001",
    },
    status: "active",
  },
  {
    admissionNumber: "ADM002",
    student: {
      firstName: "Ananya",
      lastName: "Patel",
      gender: "Female",
      dob: new Date("2010-07-22"),
    },
    class: {
      className: "10",
      section: "A",
      academicYear: "2025-2026",
    },
    parents: {
      father: {
        name: "Vikram Patel",
        phone: "9876543212",
        email: "vikram.patel@email.com",
        occupation: "Doctor",
      },
      mother: {
        name: "Sneha Patel",
        phone: "9876543213",
        email: "sneha.patel@email.com",
        occupation: "Consultant",
      },
    },
    address: {
      street: "456 Brigade Road",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560002",
    },
    status: "active",
  },
  {
    admissionNumber: "ADM003",
    student: {
      firstName: "Arjun",
      lastName: "Kumar",
      gender: "Male",
      dob: new Date("2010-05-10"),
    },
    class: {
      className: "10",
      section: "B",
      academicYear: "2025-2026",
    },
    parents: {
      father: {
        name: "Anil Kumar",
        phone: "9876543214",
        email: "anil.kumar@email.com",
        occupation: "Business Owner",
      },
      mother: {
        name: "Meera Kumar",
        phone: "9876543215",
        email: "meera.kumar@email.com",
        occupation: "Accountant",
      },
    },
    address: {
      street: "789 Commercial Street",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560003",
    },
    status: "active",
  },
  {
    admissionNumber: "ADM004",
    student: {
      firstName: "Divya",
      lastName: "Singh",
      gender: "Female",
      dob: new Date("2010-02-18"),
    },
    class: {
      className: "10",
      section: "B",
      academicYear: "2025-2026",
    },
    parents: {
      father: {
        name: "Manish Singh",
        phone: "9876543216",
        email: "manish.singh@email.com",
        occupation: "Lawyer",
      },
      mother: {
        name: "Nisha Singh",
        phone: "9876543217",
        email: "nisha.singh@email.com",
        occupation: "Home Maker",
      },
    },
    address: {
      street: "321 Indiranagar",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560004",
    },
    status: "active",
  },
  {
    admissionNumber: "ADM005",
    student: {
      firstName: "Esha",
      lastName: "Gupta",
      gender: "Female",
      dob: new Date("2010-08-25"),
    },
    class: {
      className: "9",
      section: "A",
      academicYear: "2025-2026",
    },
    parents: {
      father: {
        name: "Rohan Gupta",
        phone: "9876543218",
        email: "rohan.gupta@email.com",
        occupation: "IT Manager",
      },
      mother: {
        name: "Anjali Gupta",
        phone: "9876543219",
        email: "anjali.gupta@email.com",
        occupation: "Architect",
      },
    },
    address: {
      street: "654 Whitefield",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560005",
    },
    status: "active",
  },
  {
    admissionNumber: "ADM006",
    student: {
      firstName: "Fahad",
      lastName: "Khan",
      gender: "Male",
      dob: new Date("2010-09-12"),
    },
    class: {
      className: "9",
      section: "A",
      academicYear: "2025-2026",
    },
    parents: {
      father: {
        name: "Ahmed Khan",
        phone: "9876543220",
        email: "ahmed.khan@email.com",
        occupation: "Trader",
      },
      mother: {
        name: "Fatima Khan",
        phone: "9876543221",
        email: "fatima.khan@email.com",
        occupation: "Teacher",
      },
    },
    address: {
      street: "987 Koramangala",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560006",
    },
    status: "active",
  },
  {
    admissionNumber: "ADM007",
    student: {
      firstName: "Gowri",
      lastName: "Iyer",
      gender: "Female",
      dob: new Date("2010-04-30"),
    },
    class: {
      className: "9",
      section: "B",
      academicYear: "2025-2026",
    },
    parents: {
      father: {
        name: "Venkatesh Iyer",
        phone: "9876543222",
        email: "venkatesh.iyer@email.com",
        occupation: "Professor",
      },
      mother: {
        name: "Lakshmi Iyer",
        phone: "9876543223",
        email: "lakshmi.iyer@email.com",
        occupation: "Librarian",
      },
    },
    address: {
      street: "111 Jayanagar",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560007",
    },
    status: "active",
  },
  {
    admissionNumber: "ADM008",
    student: {
      firstName: "Harsh",
      lastName: "Verma",
      gender: "Male",
      dob: new Date("2010-06-08"),
    },
    class: {
      className: "9",
      section: "B",
      academicYear: "2025-2026",
    },
    parents: {
      father: {
        name: "Amit Verma",
        phone: "9876543224",
        email: "amit.verma@email.com",
        occupation: "Factory Owner",
      },
      mother: {
        name: "Kavya Verma",
        phone: "9876543225",
        email: "kavya.verma@email.com",
        occupation: "Designer",
      },
    },
    address: {
      street: "222 Bellandur",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560008",
    },
    status: "active",
  },
  {
    admissionNumber: "ADM009",
    student: {
      firstName: "Ishita",
      lastName: "Reddy",
      gender: "Female",
      dob: new Date("2010-01-20"),
    },
    class: {
      className: "8",
      section: "A",
      academicYear: "2025-2026",
    },
    parents: {
      father: {
        name: "Suresh Reddy",
        phone: "9876543226",
        email: "suresh.reddy@email.com",
        occupation: "Banker",
      },
      mother: {
        name: "Swapna Reddy",
        phone: "9876543227",
        email: "swapna.reddy@email.com",
        occupation: "Nurse",
      },
    },
    address: {
      street: "333 Marathahalli",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560009",
    },
    status: "active",
  },
  {
    admissionNumber: "ADM010",
    student: {
      firstName: "Jatin",
      lastName: "Joshi",
      gender: "Male",
      dob: new Date("2010-11-14"),
    },
    class: {
      className: "8",
      section: "A",
      academicYear: "2025-2026",
    },
    parents: {
      father: {
        name: "Prakash Joshi",
        phone: "9876543228",
        email: "prakash.joshi@email.com",
        occupation: "Software Developer",
      },
      mother: {
        name: "Pooja Joshi",
        phone: "9876543229",
        email: "pooja.joshi@email.com",
        occupation: "Content Writer",
      },
    },
    address: {
      street: "444 Sarjapur Road",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560010",
    },
    status: "active",
  },
];

async function seedStudents() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");

    // Clear existing students (optional - comment out to preserve data)
    // await Student.deleteMany({});
    // console.log("🗑️  Cleared existing students");

    // Insert new students
    const result = await Student.insertMany(studentsData);
    console.log(`\n✅ Successfully inserted ${result.length} students\n`);

    // Display created students
    result.forEach((student, index) => {
      console.log(
        `${index + 1}. ${student.student.firstName} ${student.student.lastName} (${student.admissionNumber}) - Class ${student.class.className}-${student.class.section}`
      );
    });

    console.log("\n📊 Student Seeding Complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding students:", error);
    process.exit(1);
  }
}

seedStudents();
