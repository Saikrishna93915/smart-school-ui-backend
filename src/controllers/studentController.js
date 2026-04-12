import Student from "../models/Student.js";
import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import FeeStructure from "../models/FeeStructure.js";
import mongoose from "mongoose";
import { generateDefaultPassword, getNextSequenceNumber } from "../utils/passwordGenerator.js";
import { ensureFeeStructureForStudent, ensureFeeStructuresForStudents } from "../utils/feeStructureHelper.js";

const createStudentUser = async (student) => {
  try {
    const exists = await User.findOne({
      username: student.admissionNumber
    });

    if (!exists) {
      // Generate default student password (S@001, S@002, etc.)
      const sequenceNumber = await getNextSequenceNumber(User, 'student');
      const defaultPassword = generateDefaultPassword('student', sequenceNumber);

      await User.create({
        name: `${student.student.firstName} ${student.student.lastName || ""}`,
        username: student.admissionNumber,
        email: student.student.email || undefined,
        phone: student.student.phone || undefined,
        password: defaultPassword,
        role: "student",
        linkedId: student._id,
        forcePasswordChange: true,
        active: true
      });

      console.log(`✅ Student user created with password: ${defaultPassword}`);
    }
  } catch (error) {
    console.error("Student login creation failed:", error.message);
  }
};

/**
 * Create parent user account when a student is added/registered
 */
const createParentUser = async (parentData, studentId = null) => {
  try {
    if (!parentData || !parentData.email) {
      console.log("ℹ️ No parent email provided, skipping parent account creation");
      return null;
    }

    const parentEmail = parentData.email.toLowerCase().trim();

    // Check if parent already exists
    const existingParent = await User.findOne({
      $or: [
        { email: parentEmail },
        { phone: parentData.phone }
      ],
      role: "parent"
    });

    if (existingParent) {
      console.log(`ℹ️ Parent account already exists: ${existingParent._id}`);
      // Link this student to existing parent if studentId provided
      if (studentId && !existingParent.children?.map(String).includes(String(studentId))) {
        await User.findByIdAndUpdate(existingParent._id, {
          $push: { children: studentId },
          $setOnInsert: { linkedId: existingParent.linkedId || studentId }
        });
      }
      return existingParent;
    }

    // Generate default parent password (P@001, P@002, etc.)
    const sequenceNumber = await getNextSequenceNumber(User, 'parent');
    const defaultPassword = generateDefaultPassword('parent', sequenceNumber);

    const parentUser = await User.create({
      name: parentData.name || "Parent Account",
      username: parentEmail,
      email: parentEmail,
      phone: parentData.phone || "",
      password: defaultPassword,
      role: "parent",
      linkedId: studentId, // Link to primary child
      children: studentId ? [studentId] : [], // Track all children
      forcePasswordChange: true,
      active: true
    });

    console.log(`✅ Parent user created with password: ${defaultPassword}`);
    return parentUser;
  } catch (error) {
    console.error("Parent account creation failed:", error.message);
    // Don't throw - continue without parent account
    return null;
  }
};

export const createStudent = async (req, res) => {
  if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      message: "Invalid request body. Expected a single Student JSON object."
    });
  }

  try {
    const exists = await Student.findOne({
      admissionNumber: req.body.admissionNumber,
      status: { $ne: "deleted" }
    });

    if (exists) {
      return res.status(400).json({
        message: `Admission number '${req.body.admissionNumber}' already exists.`
      });
    }

    const student = await Student.create({
      ...req.body,
      status: "active",
      createdBy: req.user.id
    });

    // Create student user account
    await createStudentUser(student);
    await ensureFeeStructureForStudent(student);

    // Create parent user accounts if parent details provided
    const parentData = {
      father: null,
      mother: null
    };

    if (req.body.parents?.father?.email) {
      parentData.father = await createParentUser({
        name: req.body.parents.father.name,
        email: req.body.parents.father.email,
        phone: req.body.parents.father.phone
      }, student._id);
    }

    if (req.body.parents?.mother?.email) {
      parentData.mother = await createParentUser({
        name: req.body.parents.mother.name,
        email: req.body.parents.mother.email,
        phone: req.body.parents.mother.phone
      }, student._id);
    }

    res.status(201).json({
      success: true,
      message: "Student created successfully",
      student,
      parentAccounts: {
        fatherCreated: !!parentData.father,
        motherCreated: !!parentData.mother,
        note: "Parent accounts have been created with default passwords. Share credentials with parents."
      }
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Student validation failed.",
        errors: Object.values(error.errors).map(v => v.message)
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        message: "Duplicate admission number."
      });
    }

    res.status(500).json({
      message: "Server error during student creation."
    });
  }
};

export const createBulkStudents = async (req, res) => {
  const studentsToInsert = req.body;

  if (!Array.isArray(studentsToInsert) || studentsToInsert.length === 0) {
    return res.status(400).json({
      message: "Invalid request body. Expected a non-empty array."
    });
  }

  const documentsWithDefaults = studentsToInsert.map(doc => ({
    ...doc,
    status: "active",
    createdBy: req.user.id
  }));

  try {
    const insertedStudents = await Student.insertMany(documentsWithDefaults, {
      ordered: true
    });

    for (const student of insertedStudents) {
      await createStudentUser(student);
      await ensureFeeStructureForStudent(student);
    }

    res.status(201).json({
      success: true,
      message: "Students created successfully",
      count: insertedStudents.length
    });
  } catch (error) {
    res.status(400).json({
      message: "Bulk insert failed"
    });
  }
};

export const getStudents = async (req, res) => {
  try {
    const activeStudents = await Student.find(
      { status: { $ne: "deleted" } },
      "_id admissionNumber student class transport"
    ).lean();

    await ensureFeeStructuresForStudents(activeStudents);

    const students = await Student.aggregate([
      { $match: { status: { $ne: "deleted" } } },
      {
        $lookup: {
          from: "attendances",
          localField: "_id",
          foreignField: "studentId",
          as: "attendanceRecords"
        }
      },
      {
        $lookup: {
          from: "feestructures",
          let: { studentId: "$_id", admissionNumber: "$admissionNumber" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$studentId", "$$studentId"] },
                    { $eq: ["$admissionNumber", "$$admissionNumber"] }
                  ]
                }
              }
            }
          ],
          as: "feeData"
        }
      },
      {
        $addFields: {
          attendance: {
            $let: {
              vars: {
                totalSessions: { $multiply: [{ $size: "$attendanceRecords" }, 2] },
                presentCount: {
                  $sum: {
                    $map: {
                      input: "$attendanceRecords",
                      as: "rec",
                      in: {
                        $add: [
                          {
                            $cond: [
                              {
                                $or: [
                                  { $eq: ["$$rec.sessions.morning", "present"] },
                                  { $eq: ["$$rec.sessions.morning", true] },
                                  { $eq: ["$$rec.sessions.morning", "true"] }
                                ]
                              },
                              1,
                              0
                            ]
                          },
                          {
                            $cond: [
                              {
                                $or: [
                                  { $eq: ["$$rec.sessions.afternoon", "present"] },
                                  { $eq: ["$$rec.sessions.afternoon", true] },
                                  { $eq: ["$$rec.sessions.afternoon", "true"] }
                                ]
                              },
                              1,
                              0
                            ]
                          }
                        ]
                      }
                    }
                  }
                }
              },
              in: {
                $cond: [
                  { $eq: ["$$totalSessions", 0] },
                  0,
                  {
                    $round: [
                      {
                        $multiply: [
                          { $divide: ["$$presentCount", "$$totalSessions"] },
                          100
                        ]
                      },
                      0
                    ]
                  }
                ]
              }
            }
          },
        }
      },
      {
        $addFields: {
          feeRecord: { $first: "$feeData" }
        }
      },
      {
        $addFields: {
          transport: {
            $cond: [
              { $and: [{ $ne: ["$transport", null] }, { $ne: ["$transport", ""] }] },
              "$transport",
              {
                $cond: [
                  { $ne: ["$feeRecord", null] },
                  {
                    $cond: [
                      {
                        $or: [
                          { $eq: [{ $ifNull: ["$feeRecord.transportOpted", false] }, true] },
                          { $gt: [{ $ifNull: ["$feeRecord.transportFee", 0] }, 0] },
                          {
                            $gt: [
                              {
                                $size: {
                                  $filter: {
                                    input: { $ifNull: ["$feeRecord.feeComponents", []] },
                                    as: "comp",
                                    cond: { $eq: ["$$comp.componentName", "Transport Fee"] }
                                  }
                                }
                              },
                              0
                            ]
                          }
                        ]
                      },
                      "yes",
                      "no"
                    ]
                  },
                  "no"
                ]
              }
            ]
          },
          feeBalance: {
            $cond: {
              if: { $ne: ["$feeRecord", null] },
              then: { $ifNull: ["$feeRecord.totalDue", 0] },
              else: null
            }
          },
          feeStatus: {
            $cond: [
              { $eq: ["$feeRecord", null] },
              "pending",
              {
                $cond: [
                  { $lte: [{ $ifNull: ["$feeRecord.totalDue", 0] }, 0] },
                  "paid",
                  "pending"
                ]
              }
            ]
          }
        }
      },
      { $project: { attendanceRecords: 0, feeData: 0, feeRecord: 0 } },
      { $sort: { createdAt: -1 } }
    ]);

    console.log(
      "Student fee balances:",
      students.map((student) => ({
        admissionNumber: student.admissionNumber,
        feeBalance: student.feeBalance,
        feeStatus: student.feeStatus,
      }))
    );

    res.json(students);
  } catch (error) {
    console.error("❌ Error in getStudents:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const studentRecord = await Student.findOne({
      _id: req.params.id,
      status: { $ne: "deleted" }
    }).lean();

    if (studentRecord) {
      await ensureFeeStructureForStudent(studentRecord);
    }

    const student = await Student.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.params.id),
          status: { $ne: "deleted" }
        }
      },
      {
        $lookup: {
          from: "attendances",
          localField: "_id",
          foreignField: "studentId",
          as: "attendanceRecords"
        }
      },
      {
        $lookup: {
          from: "feestructures",
          let: { studentId: "$_id", admissionNumber: "$admissionNumber" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$studentId", "$$studentId"] },
                    { $eq: ["$admissionNumber", "$$admissionNumber"] }
                  ]
                }
              }
            }
          ],
          as: "feeData"
        }
      },
      {
        $addFields: {
          attendance: {
            $let: {
              vars: {
                totalSessions: { $multiply: [{ $size: "$attendanceRecords" }, 2] },
                presentCount: {
                  $sum: {
                    $map: {
                      input: "$attendanceRecords",
                      as: "rec",
                      in: {
                        $add: [
                          {
                            $cond: [
                              {
                                $or: [
                                  { $eq: ["$$rec.sessions.morning", "present"] },
                                  { $eq: ["$$rec.sessions.morning", true] },
                                  { $eq: ["$$rec.sessions.morning", "true"] }
                                ]
                              },
                              1,
                              0
                            ]
                          },
                          {
                            $cond: [
                              {
                                $or: [
                                  { $eq: ["$$rec.sessions.afternoon", "present"] },
                                  { $eq: ["$$rec.sessions.afternoon", true] },
                                  { $eq: ["$$rec.sessions.afternoon", "true"] }
                                ]
                              },
                              1,
                              0
                            ]
                          }
                        ]
                      }
                    }
                  }
                }
              },
              in: {
                $cond: [
                  { $eq: ["$$totalSessions", 0] },
                  0,
                  {
                    $round: [
                      {
                        $multiply: [
                          { $divide: ["$$presentCount", "$$totalSessions"] },
                          100
                        ]
                      },
                      0
                    ]
                  }
                ]
              }
            }
          },
        }
      },
      {
        $addFields: {
          feeRecord: { $first: "$feeData" }
        }
      },
      {
        $addFields: {
          transport: {
            $cond: [
              { $and: [{ $ne: ["$transport", null] }, { $ne: ["$transport", ""] }] },
              "$transport",
              {
                $cond: [
                  { $ne: ["$feeRecord", null] },
                  {
                    $cond: [
                      {
                        $or: [
                          { $eq: [{ $ifNull: ["$feeRecord.transportOpted", false] }, true] },
                          { $gt: [{ $ifNull: ["$feeRecord.transportFee", 0] }, 0] },
                          {
                            $gt: [
                              {
                                $size: {
                                  $filter: {
                                    input: { $ifNull: ["$feeRecord.feeComponents", []] },
                                    as: "comp",
                                    cond: { $eq: ["$$comp.componentName", "Transport Fee"] }
                                  }
                                }
                              },
                              0
                            ]
                          }
                        ]
                      },
                      "yes",
                      "no"
                    ]
                  },
                  "no"
                ]
              }
            ]
          },
          feeBalance: {
            $cond: {
              if: { $ne: ["$feeRecord", null] },
              then: { $ifNull: ["$feeRecord.totalDue", 0] },
              else: null
            }
          },
          feeStatus: {
            $cond: [
              { $eq: ["$feeRecord", null] },
              "pending",
              {
                $cond: [
                  { $lte: [{ $ifNull: ["$feeRecord.totalDue", 0] }, 0] },
                  "paid",
                  "pending"
                ]
              }
            ]
          }
        }
      },
      { $project: { attendanceRecords: 0, feeData: 0, feeRecord: 0 } }
    ]);

    if (!student.length) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json(student[0]);
  } catch (error) {
    console.error("❌ Error in getStudentById:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getByAdmissionNumber = async (req, res) => {
  try {
    const studentRecord = await Student.findOne({
      admissionNumber: req.params.admissionNumber,
      status: { $ne: "deleted" }
    }).lean();

    if (studentRecord) {
      await ensureFeeStructureForStudent(studentRecord);
    }

    const student = await Student.aggregate([
      {
        $match: {
          admissionNumber: req.params.admissionNumber,
          status: { $ne: "deleted" }
        }
      },
      {
        $lookup: {
          from: "attendances",
          localField: "_id",
          foreignField: "studentId",
          as: "attendanceRecords"
        }
      },
      {
        $lookup: {
          from: "feestructures",
          let: { studentId: "$_id", admissionNumber: "$admissionNumber" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$studentId", "$$studentId"] },
                    { $eq: ["$admissionNumber", "$$admissionNumber"] }
                  ]
                }
              }
            }
          ],
          as: "feeData"
        }
      },
      {
        $addFields: {
          attendance: {
            $let: {
              vars: {
                totalSessions: { $multiply: [{ $size: "$attendanceRecords" }, 2] },
                presentCount: {
                  $sum: {
                    $map: {
                      input: "$attendanceRecords",
                      as: "rec",
                      in: {
                        $add: [
                          {
                            $cond: [
                              {
                                $or: [
                                  { $eq: ["$$rec.sessions.morning", "present"] },
                                  { $eq: ["$$rec.sessions.morning", true] },
                                  { $eq: ["$$rec.sessions.morning", "true"] }
                                ]
                              },
                              1,
                              0
                            ]
                          },
                          {
                            $cond: [
                              {
                                $or: [
                                  { $eq: ["$$rec.sessions.afternoon", "present"] },
                                  { $eq: ["$$rec.sessions.afternoon", true] },
                                  { $eq: ["$$rec.sessions.afternoon", "true"] }
                                ]
                              },
                              1,
                              0
                            ]
                          }
                        ]
                      }
                    }
                  }
                }
              },
              in: {
                $cond: [
                  { $eq: ["$$totalSessions", 0] },
                  0,
                  {
                    $round: [
                      {
                        $multiply: [
                          { $divide: ["$$presentCount", "$$totalSessions"] },
                          100
                        ]
                      },
                      0
                    ]
                  }
                ]
              }
            }
          },
        }
      },
      {
        $addFields: {
          feeRecord: { $first: "$feeData" }
        }
      },
      {
        $addFields: {
          transport: {
            $cond: [
              { $and: [{ $ne: ["$transport", null] }, { $ne: ["$transport", ""] }] },
              "$transport",
              {
                $cond: [
                  { $ne: ["$feeRecord", null] },
                  {
                    $cond: [
                      {
                        $or: [
                          { $eq: [{ $ifNull: ["$feeRecord.transportOpted", false] }, true] },
                          { $gt: [{ $ifNull: ["$feeRecord.transportFee", 0] }, 0] },
                          {
                            $gt: [
                              {
                                $size: {
                                  $filter: {
                                    input: { $ifNull: ["$feeRecord.feeComponents", []] },
                                    as: "comp",
                                    cond: { $eq: ["$$comp.componentName", "Transport Fee"] }
                                  }
                                }
                              },
                              0
                            ]
                          }
                        ]
                      },
                      "yes",
                      "no"
                    ]
                  },
                  "no"
                ]
              }
            ]
          },
          feeBalance: {
            $cond: {
              if: { $ne: ["$feeRecord", null] },
              then: { $ifNull: ["$feeRecord.totalDue", 0] },
              else: null
            }
          },
          feeStatus: {
            $cond: [
              { $eq: ["$feeRecord", null] },
              "pending",
              {
                $cond: [
                  { $lte: [{ $ifNull: ["$feeRecord.totalDue", 0] }, 0] },
                  "paid",
                  "pending"
                ]
              }
            ]
          }
        }
      },
      { $project: { attendanceRecords: 0, feeData: 0, feeRecord: 0 } }
    ]);

    if (!student.length) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json(student[0]);
  } catch (error) {
    console.error("❌ Error in getByAdmissionNumber:", error);
    res.status(500).json({ message: error.message });
  }
};

export const updateStudent = async (req, res) => {
  const updateData = { ...req.body };
  delete updateData.status;

  try {
    // Get the current student to check if transport status changed
    const currentStudent = await Student.findById(req.params.id);
    
    if (!currentStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    const transportChanged = updateData.transport && updateData.transport !== currentStudent.transport;

    // Update the student
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: "deleted" } },
      updateData,
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // If transport status changed, update the fee structure
    if (transportChanged) {
      try {
        const transportOpted = updateData.transport === 'yes';
        
        // Find and update the fee structure for this student
        const feeStructure = await FeeStructure.findOne({
          $or: [
            { studentId: student._id },
            { admissionNumber: student.admissionNumber }
          ]
        });

        if (feeStructure) {
          // Update transport status in fee structure
          if (transportOpted && !feeStructure.transportOpted) {
            // Adding transport - need to add transport fee
            const transportFeeAmount = feeStructure.transportFee || 0;
            feeStructure.transportOpted = true;
            feeStructure.totalFee = feeStructure.totalFee + transportFeeAmount;
            feeStructure.totalDue = feeStructure.totalDue + transportFeeAmount;
            
            // Add transport fee component if it doesn't exist
            const hasTransportComponent = feeStructure.feeComponents.some(
              c => c.componentName === 'Transport Fee'
            );
            if (!hasTransportComponent && transportFeeAmount > 0) {
              feeStructure.feeComponents.push({
                componentName: 'Transport Fee',
                amount: transportFeeAmount,
                dueDate: new Date(),
                isMandatory: true,
                isRecurring: true,
                frequency: 'yearly',
                status: 'pending',
                paidAmount: 0
              });
            }
          } else if (!transportOpted && feeStructure.transportOpted) {
            // Removing transport - need to subtract transport fee
            const transportFeeAmount = feeStructure.transportFee || 0;
            feeStructure.transportOpted = false;
            feeStructure.totalFee = Math.max(0, feeStructure.totalFee - transportFeeAmount);
            feeStructure.totalDue = Math.max(0, feeStructure.totalDue - transportFeeAmount);
            
            // Remove transport fee component
            feeStructure.feeComponents = feeStructure.feeComponents.filter(
              c => c.componentName !== 'Transport Fee'
            );
          }
          
          await feeStructure.save();
          console.log('✓ Fee structure updated for transport change:', student._id);
        }
      } catch (feeError) {
        console.error('Warning: Could not update fee structure for transport change:', feeError.message);
        // Don't fail the student update if fee sync fails
      }
    }

    res.json({ 
      message: "Student updated successfully", 
      student,
      ...(transportChanged && { transportSynced: true })
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateStudentStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        message: "Status must be 'active' or 'inactive'"
      });
    }

    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: "deleted" } },
      { status },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ message: "Student status updated successfully", student });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const softDeleteStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: "deleted" } },
      { status: "deleted" },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
