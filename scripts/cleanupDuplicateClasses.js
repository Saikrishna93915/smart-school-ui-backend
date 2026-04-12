import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import { cleanupDuplicateClassesData } from "../src/utils/classDeduplication.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const execute = process.argv.includes("--execute");

const printAnalysis = (result) => {
  console.log(`Total classes: ${result.totalClasses}`);
  console.log(`Unique class groups: ${result.uniqueGroups}`);
  console.log(`Duplicate groups: ${result.duplicateGroups}`);
  console.log(`Duplicate records: ${result.totalDuplicates}`);

  if (!result.analysis.length) {
    console.log("No duplicate classes found.");
    return;
  }

  console.log("");
  console.log("Duplicate groups:");

  for (const group of result.analysis) {
    console.log(`- ${group.normalizedClass} | Section: ${group.section} | Year: ${group.academicYear} | Records: ${group.count}`);

    for (const classDoc of group.classes) {
      const marker = classDoc.shouldKeep ? "KEEP" : "DROP";
      console.log(
        `  ${marker} ${classDoc.originalName} | students=${classDoc.studentCount} | status=${classDoc.status} | id=${classDoc.id}`
      );
    }
  }
};

const run = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/school_erp";
    await mongoose.connect(mongoUri);

    const result = await cleanupDuplicateClassesData({ execute });

    if (!execute) {
      console.log("Dry run complete.");
      printAnalysis(result);
      console.log("");
      console.log("Run again with --execute to normalize names, merge references, and delete duplicates.");
      return;
    }

    console.log("Cleanup complete.");
    console.log(`Updated classes: ${result.updatedCount}`);
    console.log(`Deleted duplicate classes: ${result.deletedCount}`);
    console.log(
      `Reference updates: teacherAssignmentsUpdated=${result.referenceSummary.teacherAssignmentsUpdated}, teacherAssignmentsDeleted=${result.referenceSummary.teacherAssignmentsDeleted}, teacherPermissions=${result.referenceSummary.teacherPermissions}, timetablesMoved=${result.referenceSummary.timetablesMoved}, timetablesDeleted=${result.referenceSummary.timetablesDeleted}`
    );
  } catch (error) {
    console.error("cleanupDuplicateClasses failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
