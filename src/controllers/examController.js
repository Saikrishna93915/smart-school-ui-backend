// backend/controllers/examController.js

import Exam from "../models/Exam.js";
import Submission from "../models/Submission.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
import ProctoringLog from "../models/ProctoringLog.js";
import ExcelJS from "exceljs";

/*
 |------------------------------------------------------------
 | Helper – normalize class name (extract number only)
 |------------------------------------------------------------
*/
function normalizeClassName(value = "") {
  const match = value.toString().match(/\d+/);
  return match ? match[0] : value.toString().trim();
}

/*
 |------------------------------------------------------------
 | Helper – calculate exam status based on current date/time
 |------------------------------------------------------------
*/
function calculateExamStatus(exam) {
  // If exam is draft, it stays draft
  if (exam.status === 'draft') {
    return 'draft';
  }

  // If manually set to archived, keep it
  if (exam.status === 'archived') {
    return 'archived';
  }

  const now = new Date();
  
  // Get exam date (try both fields)
  const examDateString = exam.examDate || exam.date;
  if (!examDateString) {
    return exam.status || 'scheduled';
  }

  const examDate = new Date(examDateString);
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const examDateOnly = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate());
  
  // Check if exam is today
  const isToday = todayDate.getTime() === examDateOnly.getTime();
  
  // If exam date is in the future, it's scheduled
  if (examDateOnly > todayDate) {
    return 'scheduled';
  }

  // If exam date is in the past, it's completed
  if (examDateOnly < todayDate) {
    return 'completed';
  }

  // If exam is today, check the time
  if (isToday) {
    const startTime = exam.startTime || '00:00';
    const endTime = exam.endTime || '23:59';
    
    // Parse time (format: "HH:MM" or "HH:MM:SS")
    const parseTime = (timeStr) => {
      const parts = timeStr.split(':');
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      return { hours, minutes };
    };

    const start = parseTime(startTime);
    const end = parseTime(endTime);
    
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;

    // If current time is before start time
    if (currentMinutes < startMinutes) {
      return 'scheduled';
    }

    // If current time is between start and end time
    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return 'ongoing';
    }

    // If current time is after end time
    if (currentMinutes > endMinutes) {
      return 'completed';
    }
  }

  // Default fallback
  return exam.status || 'scheduled';
}

function getAllQuestionsFromExam(exam) {
  if (!exam?.subjectGroups || !Array.isArray(exam.subjectGroups)) {
    return [];
  }

  return exam.subjectGroups.flatMap((group) =>
    Array.isArray(group?.questions) ? group.questions : []
  );
}

function normalizeSubmittedAnswers(answers = []) {
  if (!Array.isArray(answers)) {
    return [];
  }

  return answers.map((answer) => {
    const rawAnswer = answer?.rawAnswer ?? answer?.answer;
    const normalized = {
      questionId: String(answer?.questionId || ""),
      rawAnswer,
      selectedOptions: [],
      textAnswer: "",
      codeAnswer: "",
      marksAwarded: 0,
    };

    if (Array.isArray(rawAnswer)) {
      normalized.selectedOptions = rawAnswer
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
      normalized.textAnswer = rawAnswer.join(",");
      return normalized;
    }

    if (typeof rawAnswer === "number") {
      normalized.selectedOptions = [rawAnswer];
      normalized.textAnswer = String(rawAnswer);
      return normalized;
    }

    if (typeof rawAnswer === "boolean") {
      normalized.textAnswer = rawAnswer ? "true" : "false";
      return normalized;
    }

    if (typeof rawAnswer === "string") {
      normalized.textAnswer = rawAnswer;
      return normalized;
    }

    if (typeof answer?.textAnswer === "string") {
      normalized.textAnswer = answer.textAnswer;
    }

    if (Array.isArray(answer?.selectedOptions)) {
      normalized.selectedOptions = answer.selectedOptions
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
    }

    if (typeof answer?.codeAnswer === "string") {
      normalized.codeAnswer = answer.codeAnswer;
    }

    return normalized;
  });
}

function isSameOptionSet(a = [], b = []) {
  if (a.length !== b.length) {
    return false;
  }

  const left = [...a].sort((x, y) => x - y);
  const right = [...b].sort((x, y) => x - y);
  return left.every((value, index) => value === right[index]);
}

function evaluateNormalizedAnswers(exam, normalizedAnswers = []) {
  const questions = getAllQuestionsFromExam(exam);
  const questionMap = new Map(
    questions.map((question) => [String(question?._id), question])
  );

  console.log('=== EVALUATING ANSWERS ===');
  console.log('Total questions available:', questions.length);
  console.log('Answers to evaluate:', normalizedAnswers.length);

  let totalMarksObtained = 0;
  let hasSubjectiveQuestions = false;

  const evaluatedAnswers = normalizedAnswers.map((answer) => {
    const question = questionMap.get(String(answer.questionId));
    if (!question) {
      console.log('⚠️ Question not found for ID:', answer.questionId);
      return answer;
    }

    const questionType = String(question.type || "").toLowerCase();
    const maxMarks = Number(question.marks || 0);
    let marksAwarded = 0;

    console.log(`Evaluating Q(${answer.questionId}): Type=${questionType}, Max=${maxMarks}`);

    if (["long", "code", "match"].includes(questionType)) {
      hasSubjectiveQuestions = true;
      console.log('  → Subjective, needs manual review');
    } else if (questionType === "mcq") {
      const submittedOption = answer.selectedOptions?.[0] ?? Number(answer.rawAnswer);
      if (Number.isFinite(submittedOption) && submittedOption === Number(question.correctAnswer)) {
        marksAwarded = maxMarks;
        console.log(`  ✓ Correct! Submitted=${submittedOption}, Expected=${question.correctAnswer}, Marks=${marksAwarded}`);
      } else {
        console.log(`  ✗ Wrong! Submitted=${submittedOption}, Expected=${question.correctAnswer}`);
      }
    } else if (questionType === "multi-correct") {
      const submittedOptions =
        answer.selectedOptions?.length > 0
          ? answer.selectedOptions
          : Array.isArray(answer.rawAnswer)
          ? answer.rawAnswer.map((value) => Number(value)).filter((value) => Number.isFinite(value))
          : [];
      const expectedOptions = Array.isArray(question.correctAnswers)
        ? question.correctAnswers.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : [];

      if (isSameOptionSet(submittedOptions, expectedOptions)) {
        marksAwarded = maxMarks;
        console.log(`  ✓ Correct! Submitted=${JSON.stringify(submittedOptions)}, Expected=${JSON.stringify(expectedOptions)}`);
      } else {
        console.log(`  ✗ Wrong! Submitted=${JSON.stringify(submittedOptions)}, Expected=${JSON.stringify(expectedOptions)}`);
      }
    } else if (questionType === "truefalse") {
      const submitted = String(answer.textAnswer || answer.rawAnswer || "").trim().toLowerCase();
      const expected = String(question.correctAnswer ?? "").trim().toLowerCase();
      if (submitted && expected && submitted === expected) {
        marksAwarded = maxMarks;
        console.log(`  ✓ Correct! Submitted="${submitted}", Expected="${expected}"`);
      } else {
        console.log(`  ✗ Wrong! Submitted="${submitted}", Expected="${expected}"`);
      }
    } else if (questionType === "fillblank" || questionType === "short") {
      const submitted = String(answer.textAnswer || answer.rawAnswer || "").trim().toLowerCase();
      const expected = String(question.correctAnswer ?? "").trim().toLowerCase();

      if (!expected) {
        hasSubjectiveQuestions = true;
        console.log('  → No correct answer defined, needs manual review');
      } else if (submitted && submitted === expected) {
        marksAwarded = maxMarks;
        console.log(`  ✓ Correct! Submitted="${submitted}", Expected="${expected}"`);
      } else {
        console.log(`  ✗ Wrong! Submitted="${submitted}", Expected="${expected}"`);
      }
    } else {
      hasSubjectiveQuestions = true;
      console.log(`  → Unknown type "${questionType}", needs manual review`);
    }

    totalMarksObtained += marksAwarded;

    return {
      ...answer,
      marksAwarded,
    };
  });

  console.log('Total marks obtained:', totalMarksObtained);
  console.log('Final status:', hasSubjectiveQuestions ? 'submitted' : 'evaluated');
  console.log('==========================');

  return {
    answers: evaluatedAnswers,
    totalMarksObtained,
    status: hasSubjectiveQuestions ? "submitted" : "evaluated",
  };
}

/*
 |------------------------------------------------------------
 | CREATE EXAM (Teacher)
 |------------------------------------------------------------
*/
export const createExam = async (req, res) => {
  try {
    console.log('Creating exam with data:', req.body);
    
    const normalizedClass = normalizeClassName(req.body.className);

    const examData = {
      ...req.body,
      className: normalizedClass,
      section: req.body.section || '',
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: req.body.status || 'draft',
    };

    const exam = await Exam.create(examData);
    
    console.log('Exam created successfully:', exam._id);

    return res.status(201).json({
      success: true,
      message: "Exam created successfully",
      data: exam
    });

  } catch (error) {
    console.error("❌ createExam error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Error creating exam",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/*
 |------------------------------------------------------------
 | TEACHER – LIST EXAMS
 |------------------------------------------------------------
*/
export const getExams = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role?.toLowerCase() === "teacher") {
      filter.createdBy = req.user._id;
    }

    const exams = await Exam.find(filter).sort({ createdAt: -1 });

    // Calculate real-time status for each exam
    const examsWithStatus = exams.map(exam => {
      const examObj = exam.toObject();
      examObj.calculatedStatus = calculateExamStatus(examObj);
      return examObj;
    });

    return res.json({
      success: true,
      message: "Exams fetched successfully",
      data: examsWithStatus
    });

  } catch (error) {
    console.error("getExams error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching exams"
    });
  }
};

/*
 |------------------------------------------------------------
 | STUDENT — GET MY EXAMS
 |------------------------------------------------------------
*/
export const getMyExams = async (req, res) => {
  try {
    if (req.user.role?.toLowerCase() !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access this endpoint"
      });
    }

    // find student via userId or linkedId
    const student =
      await Student.findOne({ userId: req.user._id }) ||
      await Student.findById(req.user.linkedId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found"
      });
    }

    // read class + section from multiple possible schema structures
    const rawClass =
      student.class?.className ||
      student.assignedClass?.className ||
      student.className ||
      "";

    const section =
      student.class?.section ||
      student.assignedClass?.section ||
      student.section ||
      req.user.section ||
      "";

    // normalize class
    const className = normalizeClassName(rawClass);

    if (!className || !section) {
      return res.status(400).json({
        success: false,
        message: "Student class/section missing"
      });
    }

    // find exams matching class & section
    const exams = await Exam.find({
      status: { $in: ["scheduled", "ongoing", "completed", "draft"] },
      $or: [
        { className, section },
        {
          classTargets: {
            $elemMatch: {
              className,
              sections: section
            }
          }
        }
      ]
    }).sort({ createdAt: -1 });

    // Calculate real-time status for each exam
    const examsWithStatus = exams.map(exam => {
      const examObj = exam.toObject();
      examObj.calculatedStatus = calculateExamStatus(examObj);
      return examObj;
    });

    return res.status(200).json({
      success: true,
      message: "Exams fetched successfully",
      data: examsWithStatus
    });

  } catch (error) {
    console.error("getMyExams error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching exams"
    });
  }
};

/*
 |------------------------------------------------------------
 | GET SINGLE EXAM
 |------------------------------------------------------------
*/
export const getExamById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const exam = await Exam.findById(id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    return res.json({
      success: true,
      message: "Exam fetched successfully",
      data: exam
    });

  } catch (error) {
    console.error("getExamById error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching exam"
    });
  }
};

/*
 |------------------------------------------------------------
 | UPDATE EXAM
 |------------------------------------------------------------
*/
export const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    
    const exam = await Exam.findByIdAndUpdate(
      id,
      {
        ...req.body,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    return res.json({
      success: true,
      message: "Exam updated successfully",
      data: exam
    });

  } catch (error) {
    console.error("updateExam error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error updating exam"
    });
  }
};

/*
 |------------------------------------------------------------
 | DELETE EXAM
 |------------------------------------------------------------
*/
export const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    
    const exam = await Exam.findByIdAndDelete(id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    return res.json({
      success: true,
      message: "Exam deleted successfully",
      data: exam
    });

  } catch (error) {
    console.error("deleteExam error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error deleting exam"
    });
  }
};

/*
 |------------------------------------------------------------
 | UPDATE EXAM STATUS
 |------------------------------------------------------------
*/
export const updateExamStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const exam = await Exam.findByIdAndUpdate(
      id,
      {
        status,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    return res.json({
      success: true,
      message: "Exam status updated successfully",
      data: exam
    });

  } catch (error) {
    console.error("updateExamStatus error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error updating exam status"
    });
  }
};

/*
 |------------------------------------------------------------
 | SUBMIT EXAM
 |------------------------------------------------------------
*/
export const submitExam = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    const normalizedAnswers = normalizeSubmittedAnswers(req.body.answers || []);
    const evaluation = evaluateNormalizedAnswers(exam, normalizedAnswers);

    const existingFinalized = await Submission.findOne({
      exam: examId,
      student: req.user._id,
      status: { $in: ["submitted", "evaluated"] }
    }).sort({ updatedAt: -1 });

    if (existingFinalized) {
      return res.json({
        success: true,
        message: "Exam already submitted",
        data: existingFinalized
      });
    }

    const submissionPayload = {
      answers: evaluation.answers,
      totalMarksObtained: evaluation.totalMarksObtained,
      status: evaluation.status,
      submittedAt: new Date(),
      evaluatedAt: evaluation.status === "evaluated" ? new Date() : undefined,
      progress: {
        timeRemaining: 0,
        lastSavedAt: new Date()
      }
    };

    let submission = await Submission.findOneAndUpdate(
      {
        exam: examId,
        student: req.user._id,
        status: "in-progress"
      },
      {
        $set: submissionPayload
      },
      {
        new: true
      }
    );

    if (!submission) {
      submission = await Submission.create({
        exam: examId,
        student: req.user._id,
        ...submissionPayload
      });
    }

    return res.json({
      success: true,
      message: "Exam submitted successfully",
      data: submission
    });

  } catch (error) {
    console.error("submitExam error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not submit exam"
    });
  }
};

/*
 |------------------------------------------------------------
 | SAVE EXAM PROGRESS (Auto-save)
 |------------------------------------------------------------
*/
export const saveExamProgress = async (req, res) => {
  try {
    const { examId, answers = [], timeRemaining } = req.body || {};

    if (!examId) {
      return res.status(400).json({
        success: false,
        message: "examId is required"
      });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    const existingFinalized = await Submission.findOne({
      exam: examId,
      student: req.user._id,
      status: { $in: ["submitted", "evaluated"] }
    });

    if (existingFinalized) {
      return res.json({
        success: true,
        message: "Exam already submitted. Progress save ignored.",
        data: existingFinalized
      });
    }

    const normalizedAnswers = normalizeSubmittedAnswers(answers);

    const submission = await Submission.findOneAndUpdate(
      {
        exam: examId,
        student: req.user._id,
        status: "in-progress"
      },
      {
        $set: {
          exam: examId,
          student: req.user._id,
          answers: normalizedAnswers,
          status: "in-progress",
          progress: {
            timeRemaining: Number.isFinite(Number(timeRemaining)) ? Number(timeRemaining) : undefined,
            lastSavedAt: new Date()
          }
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    return res.json({
      success: true,
      message: "Exam progress saved",
      data: {
        submissionId: submission._id,
        status: submission.status,
        savedAt: submission?.progress?.lastSavedAt || new Date()
      }
    });
  } catch (error) {
    console.error("saveExamProgress error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not save exam progress"
    });
  }
};

/*
 |------------------------------------------------------------
 | EVALUATE EXAM (Auto-evaluate MCQ)
 |------------------------------------------------------------
*/
export const evaluateExam = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    const submissions = await Submission.find({ exam: examId });

    // Auto-evaluate each submission
    for (let submission of submissions) {
      let totalMarks = 0;
      
      // If exam has questions array
      if (exam.questions && Array.isArray(exam.questions)) {
        exam.questions.forEach(question => {
          const answer = submission.answers.find(
            ans => ans.questionId === question._id.toString()
          );
          
          if (answer && answer.answer === question.correctAnswer) {
            totalMarks += question.marks || 0;
          }
        });
      }
      
      // Update submission
      submission.totalMarksObtained = totalMarks;
      submission.status = "evaluated";
      submission.evaluatedAt = new Date();
      await submission.save();
    }

    return res.json({
      success: true,
      message: "Exam evaluated successfully",
      data: {
        evaluatedCount: submissions.length
      }
    });

  } catch (error) {
    console.error("evaluateExam error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not evaluate exam"
    });
  }
};

/*
 |------------------------------------------------------------
 | GET EXAM SUBMISSIONS
 |------------------------------------------------------------
*/
export const getSubmissions = async (req, res) => {
  try {
    const { examId } = req.params;
    
    const submissions = await Submission.find({ exam: examId })
      .populate('student', 'name email rollNumber')
      .sort({ submittedAt: -1 });

    return res.json({
      success: true,
      message: "Submissions fetched successfully",
      data: submissions
    });

  } catch (error) {
    console.error("getSubmissions error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching submissions"
    });
  }
};

/*
 |------------------------------------------------------------
 | GET MY SUBMISSIONS (Student)
 |------------------------------------------------------------
*/
export const getMySubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user._id })
      .populate('exam')  // Populate full exam object including subjectGroups
      .sort({ submittedAt: -1 });

    return res.json({
      success: true,
      message: "Your submissions fetched successfully",
      data: submissions
    });

  } catch (error) {
    console.error("getMySubmissions error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching your submissions"
    });
  }
};

/*
 |------------------------------------------------------------
 | GET SUBMISSION BY ID
 |------------------------------------------------------------
*/
export const getSubmissionById = async (req, res) => {
  try {
    const { submissionId } = req.params;
    
    const submission = await Submission.findById(submissionId)
      .populate('exam', 'name subject className section questions')
      .populate('student', 'name email rollNumber');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found"
      });
    }

    return res.json({
      success: true,
      message: "Submission fetched successfully",
      data: submission
    });

  } catch (error) {
    console.error("getSubmissionById error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching submission"
    });
  }
};

/*
 |------------------------------------------------------------
 | GET EXAM ANALYTICS (ENHANCED WITH DRILL-DOWN DATA)
 |------------------------------------------------------------
*/
export const getExamAnalytics = async (req, res) => {
  try {
    const { examId } = req.params;
    
    // Find the exam
    const exam = await Exam.findById(examId);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    // Get all submissions for this exam
    const submissions = await Submission.find({ exam: examId })
      .populate('student', 'name email linkedId')
      .sort({ totalMarksObtained: -1 }); // Sort by marks descending for ranking

    // Get student profiles for additional information
    const studentIds = submissions
      .map(sub => sub.student?.linkedId)
      .filter(Boolean);

    const studentProfiles = await Student.find({ _id: { $in: studentIds } })
      .select('student class admissionNumber');
    
    const studentProfileMap = new Map(
      studentProfiles.map(profile => [String(profile._id), profile])
    );

    // Calculate total marks from exam structure
    let examTotalMarks = exam.totalMarks || 100;
    if (exam.subjectGroups && exam.subjectGroups.length > 0) {
      examTotalMarks = exam.subjectGroups.reduce((sum, group) => 
        sum + (group.totalMarks || 0), 0
      );
    }

    // Calculate passing marks (40% default if not specified)
    const passingMarks = exam.passingMarks || examTotalMarks * 0.4;

    // Process each submission with detailed student info
    const studentResults = submissions.map((submission, index) => {
      const user = submission.student;
      const studentProfile = user?.linkedId ? studentProfileMap.get(String(user.linkedId)) : null;

      const studentName = studentProfile?.student?.firstName || studentProfile?.student?.lastName
        ? `${studentProfile?.student?.firstName || ""} ${studentProfile?.student?.lastName || ""}`.trim()
        : user?.name || "Unknown Student";

      const marksObtained = Number(submission.totalMarksObtained || 0);
      const percentage = examTotalMarks > 0 ? (marksObtained / examTotalMarks) * 100 : 0;
      const status = marksObtained >= passingMarks ? 'passed' : 'failed';

      // Calculate time taken if available
      let timeTaken = null;
      if (submission.submittedAt && submission.createdAt) {
        const timeInMs = new Date(submission.submittedAt) - new Date(submission.createdAt);
        timeTaken = Math.round(timeInMs / (1000 * 60)); // Convert to minutes
      }

      return {
        studentId: user?._id,
        name: studentName,
        admissionNumber: studentProfile?.admissionNumber || 'N/A',
        className: studentProfile?.class?.className || exam.className || 'N/A',
        section: studentProfile?.class?.section || exam.section || 'N/A',
        marksObtained,
        totalMarks: examTotalMarks,
        percentage: Math.round(percentage * 100) / 100,
        rank: index + 1, // Since we sorted by marks descending
        status: submission.status === 'evaluated' ? status : 'pending',
        submittedAt: submission.submittedAt || submission.createdAt,
        timeTaken,
        answers: submission.answers || []
      };
    });

    // Calculate summary statistics
    const totalStudents = studentResults.length;
    const submittedCount = studentResults.length;
    
    const totalMarksSum = studentResults.reduce((sum, s) => sum + s.marksObtained, 0);
    const averageScore = totalStudents > 0 ? totalMarksSum / totalStudents : 0;
    
    const highestScore = totalStudents > 0 
      ? Math.max(...studentResults.map(s => s.marksObtained)) 
      : 0;
    
    const lowestScore = totalStudents > 0 
      ? Math.min(...studentResults.map(s => s.marksObtained)) 
      : 0;

    const passCount = studentResults.filter(s => s.status === 'passed').length;
    const failCount = studentResults.filter(s => s.status === 'failed').length;
    const passPercentage = totalStudents > 0 ? (passCount / totalStudents) * 100 : 0;

    const proctoringLogs = await ProctoringLog.find({ exam: examId })
      .select('student violationType timestamp')
      .lean();

    const proctoringByStudent = new Map();
    const violationTotals = {};

    proctoringLogs.forEach((log) => {
      const sid = log.student?.toString();
      if (!sid) return;

      if (!proctoringByStudent.has(sid)) {
        proctoringByStudent.set(sid, {
          totalViolations: 0,
          violations: {}
        });
      }

      const studentViolations = proctoringByStudent.get(sid);
      const type = log.violationType || 'other';

      studentViolations.totalViolations += 1;
      studentViolations.violations[type] = (studentViolations.violations[type] || 0) + 1;
      violationTotals[type] = (violationTotals[type] || 0) + 1;
    });

    const enrichedStudentResults = studentResults.map((result) => {
      const studentProctoring = proctoringByStudent.get(String(result.studentId)) || {
        totalViolations: 0,
        violations: {}
      };

      return {
        ...result,
        proctoring: studentProctoring
      };
    });

    // Prepare response data
    const analyticsData = {
      exam: {
        _id: exam._id,
        name: exam.name,
        subject: exam.subject || 'N/A',
        className: exam.className || 'N/A',
        section: exam.section || 'N/A',
        status: exam.status,
        scheduledDate: exam.examDate || exam.date,
        startTime: exam.startTime || 'N/A',
        endTime: exam.endTime || 'N/A',
        duration: exam.duration || exam.durationMinutes || 0,
        totalMarks: examTotalMarks,
        passingMarks: Math.round(passingMarks),
        instructions: exam.instructions || [],
        createdBy: exam.createdBy,
        createdAt: exam.createdAt
      },
      submissions: enrichedStudentResults,
      totalStudents,
      submittedCount,
      averageScore: Math.round(averageScore * 100) / 100,
      highestScore,
      lowestScore,
      passCount,
      failCount,
      passPercentage: Math.round(passPercentage * 100) / 100,
      absentCount: 0, // Can be calculated if we have enrolled students data
      proctoringSummary: {
        totalViolations: proctoringLogs.length,
        byType: violationTotals,
        studentsWithViolations: Array.from(proctoringByStudent.keys()).length
      }
    };

    return res.json({
      success: true,
      message: "Exam analytics fetched successfully",
      data: analyticsData
    });

  } catch (error) {
    console.error("getExamAnalytics error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching exam analytics",
      error: error.message
    });
  }
};

/*
 |------------------------------------------------------------
 | GET LIVE ANALYTICS OVERVIEW (Teacher/Admin)
 |------------------------------------------------------------
*/
export const getAnalyticsOverview = async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase();
    if (!["admin", "owner", "teacher", "student"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized for analytics overview"
      });
    }

    let filter = {};
    let submissionFilter = {};

    // Determine filter based on role
    if (role === "teacher") {
      filter = { createdBy: req.user._id };
    } else if (role === "student") {
      // Students only see their own submissions
      submissionFilter = { student: req.user._id };
    }
    // admin and owner see all exams

    const exams = await Exam.find(filter).sort({ createdAt: -1 });

    const examIds = exams.map((exam) => exam._id);
    const baseSubmissionFilter = { exam: { $in: examIds }, ...submissionFilter };
    const submissions = await Submission.find(baseSubmissionFilter).sort({ createdAt: -1 });

    const userIds = Array.from(
      new Set(
        submissions
          .map((submission) => String(submission.student))
          .filter(Boolean)
      )
    );

    const users = await User.find({ _id: { $in: userIds } }).select("name linkedId email");
    const userById = new Map(users.map((user) => [String(user._id), user]));

    const linkedStudentIds = users
      .map((user) => user.linkedId)
      .filter(Boolean);

    const studentProfiles = await Student.find({ _id: { $in: linkedStudentIds } }).select("student class admissionNumber");
    const studentById = new Map(studentProfiles.map((student) => [String(student._id), student]));

    const examById = new Map(exams.map((exam) => [String(exam._id), exam]));

    const detailedSubmissions = submissions.map((submission) => {
      const exam = examById.get(String(submission.exam));
      const user = userById.get(String(submission.student));
      const student = user?.linkedId ? studentById.get(String(user.linkedId)) : null;

      const studentName =
        student?.student?.firstName || student?.student?.lastName
          ? `${student?.student?.firstName || ""} ${student?.student?.lastName || ""}`.trim()
          : user?.name || "Unknown Student";

      const className = student?.class?.className || exam?.className || "-";
      const section = student?.class?.section || exam?.section || "-";

      return {
        submissionId: submission._id,
        examId: exam?._id,
        examName: exam?.name || "Unknown Exam",
        subject: exam?.subject || "-",
        studentId: submission.student,
        studentName,
        admissionNumber: student?.admissionNumber || "-",
        className,
        section,
        marksObtained: Number(submission.totalMarksObtained || 0),
        status: submission.status,
        submittedAt: submission.submittedAt || submission.createdAt,
        evaluatedAt: submission.evaluatedAt || null,
      };
    });

    const totalSubmissions = detailedSubmissions.length;
    const totalMarks = detailedSubmissions.reduce((sum, item) => sum + item.marksObtained, 0);
    const averageMarks = totalSubmissions > 0 ? Number((totalMarks / totalSubmissions).toFixed(2)) : 0;
    const highestMarks = totalSubmissions > 0 ? Math.max(...detailedSubmissions.map((item) => item.marksObtained)) : 0;
    const lowestMarks = totalSubmissions > 0 ? Math.min(...detailedSubmissions.map((item) => item.marksObtained)) : 0;

    const classMap = new Map();
    detailedSubmissions.forEach((item) => {
      const key = `${item.className}-${item.section}`;
      const existing = classMap.get(key) || {
        className: item.className,
        section: item.section,
        submissions: 0,
        totalMarks: 0,
      };
      existing.submissions += 1;
      existing.totalMarks += item.marksObtained;
      classMap.set(key, existing);
    });

    const classPerformance = Array.from(classMap.values()).map((entry) => ({
      className: entry.className,
      section: entry.section,
      submissions: entry.submissions,
      averageMarks: entry.submissions > 0 ? Number((entry.totalMarks / entry.submissions).toFixed(2)) : 0,
    }));

    const examSummary = exams.map((exam) => {
      const examSubmissions = detailedSubmissions.filter((item) => String(item.examId) === String(exam._id));
      const examTotalMarks = examSubmissions.reduce((sum, item) => sum + item.marksObtained, 0);
      const averageMarks = examSubmissions.length > 0 ? Number((examTotalMarks / examSubmissions.length).toFixed(2)) : 0;

      // Calculate total marks from exam structure
      let totalMarks = exam.totalMarks || 100;
      if (exam.subjectGroups && exam.subjectGroups.length > 0) {
        totalMarks = exam.subjectGroups.reduce((sum, group) => sum + (group.totalMarks || 0), 0);
      }

      // Calculate passing marks (40% default if not specified)
      const passingMarks = exam.passingMarks || totalMarks * 0.4;

      // Calculate pass/fail counts
      const passCount = examSubmissions.filter(s => s.marksObtained >= passingMarks).length;
      const failCount = examSubmissions.filter(s => s.marksObtained < passingMarks).length;
      const passPercentage = examSubmissions.length > 0 ? (passCount / examSubmissions.length) * 100 : 0;

      // Get highest and lowest marks for this exam
      const marks = examSubmissions.map(s => s.marksObtained);
      const highestMarks = marks.length > 0 ? Math.max(...marks) : 0;
      const lowestMarks = marks.length > 0 ? Math.min(...marks) : 0;

      return {
        examId: exam._id,
        examName: exam.name,
        subject: exam.subject || 'N/A',
        className: exam.className || 'N/A',
        section: exam.section || 'N/A',
        status: exam.status,
        scheduledDate: exam.examDate || exam.date,
        startTime: exam.startTime || 'N/A',
        endTime: exam.endTime || 'N/A',
        duration: exam.duration || exam.durationMinutes || 0,
        totalStudents: examSubmissions.length,
        submittedCount: examSubmissions.length,
        averageMarks,
        totalMarks,
        passingMarks: Math.round(passingMarks),
        highestMarks,
        lowestMarks,
        passCount,
        failCount,
        passPercentage: Math.round(passPercentage * 100) / 100,
        absentCount: 0 // Can be calculated if we have enrolled students data
      };
    });

    return res.json({
      success: true,
      message: "Live analytics overview fetched successfully",
      data: {
        summary: {
          examsCount: exams.length,
          submissionsCount: totalSubmissions,
          averageMarks,
          highestMarks,
          lowestMarks,
        },
        classPerformance,
        examSummary,
        recentSubmissions: detailedSubmissions.slice(0, 200),
      }
    });
  } catch (error) {
    console.error("getAnalyticsOverview error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching analytics overview"
    });
  }
};

/*
 |------------------------------------------------------------
 | GET CLASS PERFORMANCE
 |------------------------------------------------------------
*/
export const getClassPerformance = async (req, res) => {
  try {
    const { className, section } = req.params;
    
    const exams = await Exam.find({ className, section, status: 'completed' });
    
    const performanceData = await Promise.all(
      exams.map(async (exam) => {
        const submissions = await Submission.find({ exam: exam._id });
        
        let totalScore = 0;
        let highestScore = 0;
        let lowestScore = Infinity;
        
        submissions.forEach(sub => {
          if (sub.totalMarksObtained !== undefined) {
            totalScore += sub.totalMarksObtained;
            highestScore = Math.max(highestScore, sub.totalMarksObtained);
            lowestScore = Math.min(lowestScore, sub.totalMarksObtained);
          }
        });
        
        const averageScore = submissions.length > 0 ? totalScore / submissions.length : 0;
        
        return {
          examId: exam._id,
          examName: exam.name,
          subject: exam.subject,
          totalStudents: submissions.length,
          averageScore: Math.round(averageScore * 100) / 100,
          highestScore: highestScore === -Infinity ? 0 : highestScore,
          lowestScore: lowestScore === Infinity ? 0 : lowestScore
        };
      })
    );

    return res.json({
      success: true,
      message: "Class performance fetched successfully",
      data: performanceData
    });

  } catch (error) {
    console.error("getClassPerformance error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching class performance"
    });
  }
};

/*
 |------------------------------------------------------------
 | PUBLISH RESULTS
 |------------------------------------------------------------
*/
export const publishResults = async (req, res) => {
  try {
    const { examId } = req.params;
    
    const exam = await Exam.findByIdAndUpdate(
      examId,
      {
        resultsPublished: true,
        resultsPublishedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    return res.json({
      success: true,
      message: "Results published successfully",
      data: exam
    });

  } catch (error) {
    console.error("publishResults error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error publishing results"
    });
  }
};

/*
 |------------------------------------------------------------
 | LOG PROCTORING VIOLATION
 |------------------------------------------------------------
*/
export const logProctoringViolation = async (req, res) => {
  try {
    const { examId, violationType, description, metadata } = req.body;
    const studentId = req.user?._id;

    if (!examId || !violationType) {
      return res.status(400).json({
        success: false,
        message: "examId and violationType are required"
      });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    const submission = await Submission.findOne({
      exam: examId,
      student: studentId
    });

    const proctoringLog = new ProctoringLog({
      exam: examId,
      student: studentId,
      submission: submission?._id,
      violationType,
      description,
      metadata,
      timestamp: new Date()
    });

    await proctoringLog.save();

    return res.status(201).json({
      success: true,
      message: "Proctoring violation logged successfully",
      data: proctoringLog
    });
  } catch (error) {
    console.error("logProctoringViolation error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error logging proctoring violation",
      error: error.message
    });
  }
};

/*
 |------------------------------------------------------------
 | GET PROCTORING LOGS FOR AN EXAM
 |------------------------------------------------------------
*/
export const getProctoringLogs = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    const logs = await ProctoringLog.find({ exam: examId })
      .populate("student", "name email")
      .sort({ timestamp: -1 });

    const violationsByStudent = {};

    logs.forEach((log) => {
      const sid = log.student?._id?.toString();
      if (!sid) return;

      if (!violationsByStudent[sid]) {
        violationsByStudent[sid] = {
          studentId: sid,
          studentName: log.student?.name || "Unknown",
          violations: {},
          totalViolations: 0
        };
      }

      const type = log.violationType;
      violationsByStudent[sid].violations[type] =
        (violationsByStudent[sid].violations[type] || 0) + 1;
      violationsByStudent[sid].totalViolations += 1;
    });

    return res.json({
      success: true,
      message: "Proctoring logs fetched successfully",
      data: {
        logs,
        summary: Object.values(violationsByStudent)
      }
    });
  } catch (error) {
    console.error("getProctoringLogs error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching proctoring logs",
      error: error.message
    });
  }
};

/*
 |------------------------------------------------------------
 | GET MY EXAM RESULT
 |------------------------------------------------------------
*/
export const getMyResults = async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user?._id;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    const submission = await Submission.findOne({ exam: examId, student: userId })
      .populate("student", "name");

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Result not found for this exam"
      });
    }

    const allSubmissions = await Submission.find({ exam: examId }).select("totalMarksObtained");

    let totalMarks = exam.totalMarks || 0;
    if (!totalMarks && Array.isArray(exam.subjectGroups) && exam.subjectGroups.length > 0) {
      totalMarks = exam.subjectGroups.reduce((sum, group) => sum + (group.totalMarks || 0), 0);
    }
    if (!totalMarks) totalMarks = 100;

    const passingMarks = exam.passingMarks || totalMarks * 0.4;
    const obtainedMarks = Number(submission.totalMarksObtained || 0);
    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;

    const questions = Array.isArray(exam.subjectGroups)
      ? exam.subjectGroups.flatMap((group) => group.questions || [])
      : [];
    const totalQuestions = questions.length || (submission.answers?.length || 0);

    const answers = submission.answers || [];
    const correctAnswers = answers.filter((a) => Number(a.marksAwarded || 0) > 0).length;
    const incorrectAnswers = answers.filter((a) => Number(a.marksAwarded || 0) <= 0).length;
    const unansweredQuestions = Math.max(totalQuestions - answers.length, 0);

    let timeTaken = "N/A";
    if (submission.submittedAt && submission.createdAt) {
      const minutes = Math.max(0, Math.round((new Date(submission.submittedAt) - new Date(submission.createdAt)) / (1000 * 60)));
      timeTaken = `${minutes} min`;
    }

    const totalTimeMinutes = exam.duration || exam.durationMinutes || 0;
    const averageScore = allSubmissions.length
      ? allSubmissions.reduce((sum, s) => sum + Number(s.totalMarksObtained || 0), 0) / allSubmissions.length
      : 0;
    const highestScore = allSubmissions.length
      ? Math.max(...allSubmissions.map((s) => Number(s.totalMarksObtained || 0)))
      : obtainedMarks;

    return res.json({
      success: true,
      message: "Result fetched successfully",
      data: {
        examName: exam.name,
        studentName: submission.student?.name || req.user?.name || "Student",
        obtainedMarks,
        totalMarks,
        passingMarks,
        correctAnswers,
        incorrectAnswers,
        unansweredQuestions,
        totalQuestions,
        timeTaken,
        totalTime: `${totalTimeMinutes} min`,
        percentage: Math.round(percentage * 100) / 100,
        isPassed: obtainedMarks >= passingMarks,
        averageScore: Math.round(averageScore * 100) / 100,
        highestScore,
        negativeMarks: 0,
        questionAnalysis: [],
        subjectWiseMarks: [],
        classStatistics: {
          totalSubmissions: allSubmissions.length
        }
      }
    });
  } catch (error) {
    console.error("getMyResults error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching results",
      error: error.message
    });
  }
};

/*
 |------------------------------------------------------------
 | GET EXAM RESULTS SUMMARY (ADMIN/TEACHER)
 |------------------------------------------------------------
*/
export const getExamResults = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    const submissions = await Submission.find({ exam: examId })
      .populate("student", "name")
      .sort({ totalMarksObtained: -1 });

    let totalMarks = exam.totalMarks || 0;
    if (!totalMarks && Array.isArray(exam.subjectGroups) && exam.subjectGroups.length > 0) {
      totalMarks = exam.subjectGroups.reduce((sum, group) => sum + (group.totalMarks || 0), 0);
    }
    if (!totalMarks) totalMarks = 100;

    const passingMarks = exam.passingMarks || totalMarks * 0.4;
    const numericScores = submissions.map((s) => Number(s.totalMarksObtained || 0));
    const averageScore = numericScores.length
      ? numericScores.reduce((sum, score) => sum + score, 0) / numericScores.length
      : 0;
    const highestScore = numericScores.length ? Math.max(...numericScores) : 0;
    const lowestScore = numericScores.length ? Math.min(...numericScores) : 0;
    const passCount = numericScores.filter((score) => score >= passingMarks).length;
    const failCount = numericScores.filter((score) => score < passingMarks).length;
    const passPercentage = numericScores.length ? (passCount / numericScores.length) * 100 : 0;

    return res.json({
      success: true,
      message: "Exam results fetched successfully",
      data: {
        examId: exam._id,
        examName: exam.name,
        totalMarks,
        passingMarks,
        duration: exam.duration || exam.durationMinutes || 0,
        totalSubmissions: submissions.length,
        averageScore: Math.round(averageScore * 100) / 100,
        highestScore,
        lowestScore,
        passCount,
        failCount,
        passPercentage: Math.round(passPercentage * 100) / 100,
        results: submissions.map((s, index) => ({
          rank: index + 1,
          studentId: s.student?._id,
          studentName: s.student?.name || "Unknown",
          marksObtained: Number(s.totalMarksObtained || 0),
          submittedAt: s.submittedAt || s.createdAt,
          status: s.status
        }))
      }
    });
  } catch (error) {
    console.error("getExamResults error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching exam results",
      error: error.message
    });
  }
};

/*
 |------------------------------------------------------------
 | EXPORT EXAM ANALYTICS (CSV / EXCEL)
 |------------------------------------------------------------
*/
export const exportExamAnalytics = async (req, res) => {
  try {
    const { examId } = req.params;
    const requestedFormat = (req.query.format || "excel").toString().toLowerCase();
    const format = requestedFormat === "csv" ? "csv" : "excel";

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    const submissions = await Submission.find({ exam: examId })
      .populate("student", "name email linkedId")
      .sort({ totalMarksObtained: -1 });

    const studentIds = submissions
      .map((sub) => sub.student?.linkedId)
      .filter(Boolean);

    const studentProfiles = await Student.find({ _id: { $in: studentIds } })
      .select("student class admissionNumber");

    const studentProfileMap = new Map(
      studentProfiles.map((profile) => [String(profile._id), profile])
    );

    let examTotalMarks = exam.totalMarks || 100;
    if (exam.subjectGroups && exam.subjectGroups.length > 0) {
      examTotalMarks = exam.subjectGroups.reduce((sum, group) => sum + (group.totalMarks || 0), 0);
    }

    const passingMarks = exam.passingMarks || examTotalMarks * 0.4;

    const proctoringLogs = await ProctoringLog.find({ exam: examId })
      .select("student violationType")
      .lean();

    const proctoringByStudent = new Map();
    proctoringLogs.forEach((log) => {
      const sid = log.student?.toString();
      if (!sid) return;

      if (!proctoringByStudent.has(sid)) {
        proctoringByStudent.set(sid, {
          totalViolations: 0,
          violations: {}
        });
      }

      const studentViolations = proctoringByStudent.get(sid);
      const type = log.violationType || "other";
      studentViolations.totalViolations += 1;
      studentViolations.violations[type] = (studentViolations.violations[type] || 0) + 1;
    });

    const rows = submissions.map((submission, index) => {
      const user = submission.student;
      const studentProfile = user?.linkedId ? studentProfileMap.get(String(user.linkedId)) : null;

      const studentName = studentProfile?.student?.firstName || studentProfile?.student?.lastName
        ? `${studentProfile?.student?.firstName || ""} ${studentProfile?.student?.lastName || ""}`.trim()
        : user?.name || "Unknown Student";

      const marksObtained = Number(submission.totalMarksObtained || 0);
      const percentage = examTotalMarks > 0 ? (marksObtained / examTotalMarks) * 100 : 0;
      const status = marksObtained >= passingMarks ? "passed" : "failed";

      let timeTaken = null;
      if (submission.submittedAt && submission.createdAt) {
        const timeInMs = new Date(submission.submittedAt) - new Date(submission.createdAt);
        timeTaken = Math.round(timeInMs / (1000 * 60));
      }

      const studentProctoring = proctoringByStudent.get(String(user?._id)) || {
        totalViolations: 0,
        violations: {}
      };

      return {
        rank: index + 1,
        studentName,
        admissionNumber: studentProfile?.admissionNumber || "N/A",
        className: studentProfile?.class?.className || exam.className || "N/A",
        section: studentProfile?.class?.section || exam.section || "N/A",
        marksObtained,
        totalMarks: examTotalMarks,
        percentage: Math.round(percentage * 100) / 100,
        status: submission.status === "evaluated" ? status : "pending",
        submittedAt: submission.submittedAt || submission.createdAt,
        timeTaken,
        totalViolations: studentProctoring.totalViolations,
        tabSwitch: studentProctoring.violations.tab_switch || 0,
        windowBlur: studentProctoring.violations.window_blur || 0,
        fullscreenExit: studentProctoring.violations.fullscreen_exit || 0,
        copyAttempt: studentProctoring.violations.copy_attempt || 0,
        pasteAttempt: studentProctoring.violations.paste_attempt || 0,
        rightClick: studentProctoring.violations.right_click || 0,
        keyboardShortcut: studentProctoring.violations.keyboard_shortcut || 0,
        otherViolations: studentProctoring.violations.other || 0
      };
    });

    const safeExamName = (exam.name || "exam")
      .toString()
      .trim()
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .replace(/\s+/g, "_");
    const dateStamp = new Date().toISOString().split("T")[0];
    const baseFileName = `${safeExamName}_analytics_${dateStamp}`;

    if (format === "csv") {
      const headers = [
        "Rank",
        "Student Name",
        "Admission Number",
        "Class",
        "Section",
        "Marks Obtained",
        "Total Marks",
        "Percentage",
        "Status",
        "Submitted At",
        "Time Taken (min)",
        "Total Violations",
        "Tab Switch",
        "Window Blur",
        "Fullscreen Exit",
        "Copy Attempt",
        "Paste Attempt",
        "Right Click",
        "Keyboard Shortcut",
        "Other Violations"
      ];

      const escapeCsv = (value) => {
        const stringValue = value === null || value === undefined ? "" : String(value);
        if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      const csvRows = rows.map((row) => [
        row.rank,
        row.studentName,
        row.admissionNumber,
        row.className,
        row.section,
        row.marksObtained,
        row.totalMarks,
        row.percentage,
        row.status,
        row.submittedAt ? new Date(row.submittedAt).toISOString() : "",
        row.timeTaken ?? "",
        row.totalViolations,
        row.tabSwitch,
        row.windowBlur,
        row.fullscreenExit,
        row.copyAttempt,
        row.pasteAttempt,
        row.rightClick,
        row.keyboardShortcut,
        row.otherViolations
      ]);

      const csvContent = [
        headers.join(","),
        ...csvRows.map((line) => line.map(escapeCsv).join(","))
      ].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${baseFileName}.csv"`);
      return res.send(`\uFEFF${csvContent}`);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Exam Analytics");

    worksheet.columns = [
      { header: "Rank", key: "rank", width: 8 },
      { header: "Student Name", key: "studentName", width: 28 },
      { header: "Admission Number", key: "admissionNumber", width: 18 },
      { header: "Class", key: "className", width: 12 },
      { header: "Section", key: "section", width: 10 },
      { header: "Marks Obtained", key: "marksObtained", width: 14 },
      { header: "Total Marks", key: "totalMarks", width: 12 },
      { header: "Percentage", key: "percentage", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Submitted At", key: "submittedAt", width: 24 },
      { header: "Time Taken (min)", key: "timeTaken", width: 14 },
      { header: "Total Violations", key: "totalViolations", width: 14 },
      { header: "Tab Switch", key: "tabSwitch", width: 11 },
      { header: "Window Blur", key: "windowBlur", width: 11 },
      { header: "Fullscreen Exit", key: "fullscreenExit", width: 13 },
      { header: "Copy Attempt", key: "copyAttempt", width: 12 },
      { header: "Paste Attempt", key: "pasteAttempt", width: 12 },
      { header: "Right Click", key: "rightClick", width: 11 },
      { header: "Keyboard Shortcut", key: "keyboardShortcut", width: 15 },
      { header: "Other Violations", key: "otherViolations", width: 13 }
    ];

    rows.forEach((row) => {
      worksheet.addRow({
        ...row,
        submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : ""
      });
    });

    worksheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${baseFileName}.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("exportExamAnalytics error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error exporting exam analytics",
      error: error.message
    });
  }
};