import Assignment from "../models/Assignment.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import Class from "../models/Class.js";
import ClassAnnouncement from "../models/ClassAnnouncement.js";
import ClassSchedule from "../models/ClassSchedule.js";
import Student from "../models/Student.js";
import StudentPerformance from "../models/StudentPerformance.js";
import StudyMaterial from "../models/StudyMaterial.js";
import Subject from "../models/Subject.js";
import TeacherLesson from "../models/TeacherLesson.js";
import TeacherPermission from "../models/TeacherPermission.js";
import Timetable from "../models/Timetable.js";
import {
  buildCanonicalClassFields,
  getClassDisplayInfo,
  normalizeClassName,
  normalizeClassNameForComparison,
  normalizeClassSection,
} from "./classNaming.js";

const CLASS_REFERENCE_MODELS = [
  { label: "assignments", model: Assignment, fields: ["classId"] },
  { label: "assignmentSubmissions", model: AssignmentSubmission, fields: ["classId"] },
  { label: "classAnnouncements", model: ClassAnnouncement, fields: ["classId"] },
  { label: "classSchedules", model: ClassSchedule, fields: ["classId"] },
  { label: "studentPerformance", model: StudentPerformance, fields: ["classId"] },
  { label: "studyMaterials", model: StudyMaterial, fields: ["classId"] },
  { label: "teacherLessons", model: TeacherLesson, fields: ["classId"] },
];

const isTruthy = (value) => value !== undefined && value !== null && value !== "";

const pickPrimaryClassRecord = (classes) => {
  return [...classes].sort((left, right) => {
    const leftNormalized = normalizeClassName(left.name);
    const rightNormalized = normalizeClassName(right.name);

    const leftIsCanonical = left.name === leftNormalized ? 1 : 0;
    const rightIsCanonical = right.name === rightNormalized ? 1 : 0;
    if (leftIsCanonical !== rightIsCanonical) {
      return rightIsCanonical - leftIsCanonical;
    }

    const leftHasTeacher = left.classTeacher ? 1 : 0;
    const rightHasTeacher = right.classTeacher ? 1 : 0;
    if (leftHasTeacher !== rightHasTeacher) {
      return rightHasTeacher - leftHasTeacher;
    }

    const leftStudents = Number(left.studentCount || 0);
    const rightStudents = Number(right.studentCount || 0);
    if (leftStudents !== rightStudents) {
      return rightStudents - leftStudents;
    }

    const leftCreatedAt = new Date(left.createdAt || 0).getTime();
    const rightCreatedAt = new Date(right.createdAt || 0).getTime();
    return leftCreatedAt - rightCreatedAt;
  })[0];
};

const buildNormalizationPatch = (classDoc, groupClasses = []) => {
  const canonicalFields = buildCanonicalClassFields(classDoc);
  const patch = {};

  if (classDoc.name !== canonicalFields.name) {
    patch.name = canonicalFields.name;
  }
  if ((classDoc.section || null) !== canonicalFields.section) {
    patch.section = canonicalFields.section;
  }
  if ((classDoc.academicYear || "") !== canonicalFields.academicYear) {
    patch.academicYear = canonicalFields.academicYear;
  }
  if ((classDoc.classNumber ?? null) !== canonicalFields.classNumber) {
    patch.classNumber = canonicalFields.classNumber;
  }
  if (Number(classDoc.classOrder ?? 99) !== Number(canonicalFields.classOrder)) {
    patch.classOrder = canonicalFields.classOrder;
  }

  const bestRoomNumber = classDoc.roomNumber || groupClasses.find((item) => item.roomNumber)?.roomNumber || null;
  if ((classDoc.roomNumber || null) !== (bestRoomNumber || null)) {
    patch.roomNumber = bestRoomNumber;
  }

  const bestBuilding = classDoc.building || groupClasses.find((item) => item.building)?.building || null;
  if ((classDoc.building || null) !== (bestBuilding || null)) {
    patch.building = bestBuilding;
  }

  const bestFloor =
    isTruthy(classDoc.floor)
      ? classDoc.floor
      : groupClasses.find((item) => isTruthy(item.floor))?.floor ?? classDoc.floor;
  if (isTruthy(bestFloor) && Number(classDoc.floor) !== Number(bestFloor)) {
    patch.floor = bestFloor;
  }

  const highestCapacity = groupClasses.reduce(
    (max, item) => Math.max(max, Number(item.capacity || 0)),
    Number(classDoc.capacity || 0)
  );
  if (highestCapacity > 0 && Number(classDoc.capacity || 0) !== highestCapacity) {
    patch.capacity = highestCapacity;
  }

  const highestStudentCount = groupClasses.reduce(
    (max, item) => Math.max(max, Number(item.studentCount || 0)),
    Number(classDoc.studentCount || 0)
  );
  if (Number(classDoc.studentCount || 0) !== highestStudentCount) {
    patch.studentCount = highestStudentCount;
  }

  const replacementTeacher = classDoc.classTeacher || groupClasses.find((item) => item.classTeacher)?.classTeacher || null;
  if (String(classDoc.classTeacher || "") !== String(replacementTeacher || "")) {
    patch.classTeacher = replacementTeacher;
  }

  const activeStatus = classDoc.status === "active"
    ? classDoc.status
    : groupClasses.find((item) => item.status === "active")?.status || classDoc.status;
  if (activeStatus && classDoc.status !== activeStatus) {
    patch.status = activeStatus;
  }

  return patch;
};

const buildGroupCollection = (classes) => {
  const groups = new Map();

  for (const classDoc of classes) {
    const canonicalName = normalizeClassName(classDoc.name);
    const section = normalizeClassSection(classDoc.section);
    const academicYear = String(classDoc.academicYear || "").trim();
    const key = `${normalizeClassNameForComparison(canonicalName)}|${section || ""}|${academicYear}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(classDoc);
  }

  return groups;
};

const buildAnalysisResponse = (groups) => {
  const analysis = [];
  let totalDuplicates = 0;

  for (const [key, groupClasses] of groups.entries()) {
    if (groupClasses.length <= 1) {
      continue;
    }

    const keeper = pickPrimaryClassRecord(groupClasses);
    totalDuplicates += groupClasses.length - 1;

    analysis.push({
      key,
      normalizedClass: normalizeClassName(keeper.name),
      section: keeper.section || "None",
      academicYear: keeper.academicYear,
      count: groupClasses.length,
      classes: groupClasses
        .slice()
        .sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0))
        .map((classDoc) => ({
          id: classDoc._id,
          originalName: classDoc.name,
          normalizedName: normalizeClassName(classDoc.name),
          studentCount: Number(classDoc.studentCount || 0),
          status: classDoc.status,
          createdAt: classDoc.createdAt,
          shouldKeep: String(classDoc._id) === String(keeper._id),
        })),
    });
  }

  return {
    uniqueGroups: groups.size,
    duplicateGroups: analysis.length,
    totalDuplicates,
    analysis,
  };
};

const buildCanonicalClassView = (classDoc) => {
  const canonicalFields = buildCanonicalClassFields(classDoc);
  const displayInfo = getClassDisplayInfo(canonicalFields.name);

  return {
    ...classDoc,
    ...canonicalFields,
    displayName: canonicalFields.section
      ? `${displayInfo.displayName}-${canonicalFields.section}`
      : displayInfo.displayName,
  };
};

const replacePermissionReferences = async (duplicateId, primaryId) => {
  const impactedPermissions = await TeacherPermission.find({
    $or: [
      { "permissions.classes": duplicateId },
      { "permissions.sections": duplicateId },
    ],
  }).lean();

  let updatedCount = 0;

  for (const permission of impactedPermissions) {
    const classes = Array.isArray(permission.permissions?.classes) ? permission.permissions.classes : [];
    const sections = Array.isArray(permission.permissions?.sections) ? permission.permissions.sections : [];

    const nextClasses = [];
    const classSet = new Set();
    for (const classId of classes) {
      const nextValue = String(classId) === String(duplicateId) ? primaryId : classId;
      const nextKey = String(nextValue);
      if (!classSet.has(nextKey)) {
        classSet.add(nextKey);
        nextClasses.push(nextValue);
      }
    }

    const nextSections = [];
    const sectionSet = new Set();
    for (const sectionId of sections) {
      const nextValue = String(sectionId) === String(duplicateId) ? primaryId : sectionId;
      const nextKey = String(nextValue);
      if (!sectionSet.has(nextKey)) {
        sectionSet.add(nextKey);
        nextSections.push(nextValue);
      }
    }

    await TeacherPermission.updateOne(
      { _id: permission._id },
      {
        $set: {
          "permissions.classes": nextClasses,
          "permissions.sections": nextSections,
        },
      }
    );

    updatedCount += 1;
  }

  return updatedCount;
};

const mergeTimetableReferences = async (duplicateId, primaryClass) => {
  const duplicateEntries = await Timetable.find({
    $or: [{ class: duplicateId }, { classId: duplicateId }],
  }).lean();

  let movedCount = 0;
  let deletedCount = 0;

  for (const entry of duplicateEntries) {
    const existingPrimary = await Timetable.findOne({
      _id: { $ne: entry._id },
      class: primaryClass._id,
      section: entry.section || primaryClass.section || null,
      day: entry.day,
      period: entry.period,
    }).select("_id");

    if (existingPrimary?._id) {
      await Timetable.deleteOne({ _id: entry._id });
      deletedCount += 1;
      continue;
    }

    const result = await Timetable.updateOne(
      { _id: entry._id },
      {
        $set: {
          class: primaryClass._id,
          classId: primaryClass._id,
          section: entry.section || primaryClass.section || null,
        },
      }
    );

    movedCount += Number(result.modifiedCount || 0);
  }

  return { movedCount, deletedCount };
};

// TeacherAssignment model removed - no-op stubs
const mergeTeacherAssignmentsForGroup = async (primaryClass, groupClasses) => {
  return { updatedCount: 0, deletedCount: 0 };
};

export const analyzeClassDuplicates = async () => {
  const allClasses = await Class.find({}).lean();
  const groups = buildGroupCollection(allClasses);
  const analysis = buildAnalysisResponse(groups);

  return {
    totalClasses: allClasses.length,
    groups,
    ...analysis,
  };
};

export const cleanupDuplicateClassesData = async ({ execute = false } = {}) => {
  const analysis = await analyzeClassDuplicates();

  if (!execute) {
    return {
      totalClasses: analysis.totalClasses,
      uniqueGroups: analysis.uniqueGroups,
      duplicateGroups: analysis.duplicateGroups,
      totalDuplicates: analysis.totalDuplicates,
      analysis: analysis.analysis,
    };
  }

  let updatedCount = 0;
  let deletedCount = 0;
  const updatedClasses = [];
  const deletedClasses = [];
  const referenceSummary = {
    teacherAssignmentsUpdated: 0,
    teacherAssignmentsDeleted: 0,
    teacherPermissions: 0,
    timetablesMoved: 0,
    timetablesDeleted: 0,
  };

  for (const groupClasses of analysis.groups.values()) {
    const primaryClass = pickPrimaryClassRecord(groupClasses);
    const relatedClasses = groupClasses.filter((classDoc) => String(classDoc._id) !== String(primaryClass._id));
    const primaryPatch = buildNormalizationPatch(primaryClass, relatedClasses);

    if (Object.keys(primaryPatch).length > 0) {
      await Class.updateOne({ _id: primaryClass._id }, { $set: primaryPatch });
      updatedClasses.push({
        id: primaryClass._id,
        oldName: primaryClass.name,
        newName: primaryPatch.name || primaryClass.name,
      });
      updatedCount += 1;
    }

    const normalizedPrimaryClass = buildCanonicalClassView({
      ...primaryClass,
      ...primaryPatch,
    });

    const teacherAssignmentSummary = await mergeTeacherAssignmentsForGroup(
      normalizedPrimaryClass,
      groupClasses
    );
    referenceSummary.teacherAssignmentsUpdated += teacherAssignmentSummary.updatedCount;
    referenceSummary.teacherAssignmentsDeleted += teacherAssignmentSummary.deletedCount;

    if (relatedClasses.length === 0) {
      continue;
    }

    for (const duplicateClass of relatedClasses) {
      for (const referenceConfig of CLASS_REFERENCE_MODELS) {
        for (const field of referenceConfig.fields) {
          await referenceConfig.model.updateMany(
            { [field]: duplicateClass._id },
            { $set: { [field]: normalizedPrimaryClass._id } }
          );
        }
      }

      const permissionUpdates = await replacePermissionReferences(
        duplicateClass._id,
        normalizedPrimaryClass._id
      );
      referenceSummary.teacherPermissions += permissionUpdates;

      const timetableSummary = await mergeTimetableReferences(
        duplicateClass._id,
        normalizedPrimaryClass
      );
      referenceSummary.timetablesMoved += timetableSummary.movedCount;
      referenceSummary.timetablesDeleted += timetableSummary.deletedCount;
    }

    const duplicateIds = relatedClasses.map((classDoc) => classDoc._id);
    if (duplicateIds.length > 0) {
      await Class.deleteMany({ _id: { $in: duplicateIds } });
      deletedCount += duplicateIds.length;

      for (const duplicateClass of relatedClasses) {
        deletedClasses.push({
          id: duplicateClass._id,
          name: duplicateClass.name,
          section: duplicateClass.section,
          reason: `Merged into ${normalizedPrimaryClass.displayName}`,
        });
      }
    }
  }

  return {
    totalClasses: analysis.totalClasses,
    uniqueGroups: analysis.uniqueGroups,
    duplicateGroups: analysis.duplicateGroups,
    totalDuplicates: analysis.totalDuplicates,
    analysis: analysis.analysis,
    updatedCount,
    deletedCount,
    updatedClasses,
    deletedClasses,
    referenceSummary,
  };
};
