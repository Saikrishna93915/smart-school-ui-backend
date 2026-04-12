const SPECIAL_CLASS_CANONICAL_NAMES = new Map([
  ["nursery", "NURSERY"],
  ["pre primary", "NURSERY"],
  ["pre-primary", "NURSERY"],
  ["lower kindergarten", "LKG"],
  ["lkg", "LKG"],
  ["upper kindergarten", "UKG"],
  ["ukg", "UKG"],
]);

const SPECIAL_CLASS_ORDER = {
  NURSERY: 0,
  LKG: 0.25,
  UKG: 0.5,
};

const ORDINAL_SUFFIX_RULES = {
  1: "st",
  2: "nd",
  3: "rd",
};

const normalizeWhitespace = (value) => String(value || "").trim().replace(/\s+/g, " ");

const toTitleCase = (value) =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const normalizeClassSection = (section) => {
  if (section === undefined || section === null) {
    return null;
  }

  const normalized = normalizeWhitespace(section).toUpperCase();
  return normalized || null;
};

export const normalizeAcademicYear = (academicYear) => normalizeWhitespace(academicYear);

export const extractClassNumber = (name) => {
  if (!name) return null;

  const normalized = normalizeWhitespace(name).toLowerCase();

  if (SPECIAL_CLASS_CANONICAL_NAMES.has(normalized)) {
    return null;
  }

  const patterns = [
    /^class\s*(\d+)(st|nd|rd|th)?$/,
    /^(\d+)(st|nd|rd|th)\s*class$/,
    /^(\d+)$/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return Number(match[1]);
    }
  }

  const fallbackMatch = normalized.match(/(\d+)/);
  return fallbackMatch ? Number(fallbackMatch[1]) : null;
};

export const getOrdinalSuffix = (value) => {
  const classNumber = Number(value);
  if (!Number.isFinite(classNumber)) return "th";

  const mod100 = classNumber % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return "th";
  }

  return ORDINAL_SUFFIX_RULES[classNumber % 10] || "th";
};

export const formatOrdinalClassName = (value) => {
  const classNumber = Number(value);
  if (!Number.isFinite(classNumber) || classNumber <= 0) {
    return "";
  }

  return `Class ${classNumber}${getOrdinalSuffix(classNumber)}`;
};

export const validateStrictClassName = (name, options = {}) => {
  const {
    minClass = 1,
    maxClass = 12,
    allowSpecialClasses = true,
  } = options;

  const trimmed = normalizeWhitespace(name);
  if (!trimmed) {
    return {
      isValid: false,
      message: "Class name is required",
      normalizedName: "",
    };
  }

  const lowered = trimmed.toLowerCase();
  const specialClassName = SPECIAL_CLASS_CANONICAL_NAMES.get(lowered);
  if (allowSpecialClasses && specialClassName) {
    return {
      isValid: true,
      message: "",
      normalizedName: specialClassName,
    };
  }

  const strictMatch = trimmed.match(/^Class\s+([1-9]|1[0-2])(st|nd|rd|th)$/i);
  if (!strictMatch) {
    const fallbackNumber = extractClassNumber(trimmed);
    const expectedExample = fallbackNumber ? formatOrdinalClassName(fallbackNumber) : "Class 1st";
    return {
      isValid: false,
      message: `Use class format like ${expectedExample} (Class + number + suffix).`,
      normalizedName: "",
    };
  }

  const classNumber = Number(strictMatch[1]);
  if (classNumber < minClass || classNumber > maxClass) {
    return {
      isValid: false,
      message: `Class number must be between ${minClass} and ${maxClass}`,
      normalizedName: "",
    };
  }

  const enteredSuffix = String(strictMatch[2] || "").toLowerCase();
  const expectedSuffix = getOrdinalSuffix(classNumber);

  if (enteredSuffix !== expectedSuffix) {
    const expectedName = formatOrdinalClassName(classNumber);
    return {
      isValid: false,
      message: `Invalid suffix for class ${classNumber}. Use ${expectedName}.`,
      normalizedName: "",
    };
  }

  return {
    isValid: true,
    message: "",
    normalizedName: formatOrdinalClassName(classNumber),
  };
};

export const normalizeClassName = (name) => {
  const trimmed = normalizeWhitespace(name);
  if (!trimmed) {
    return "";
  }

  const lowered = trimmed.toLowerCase();
  const specialClassName = SPECIAL_CLASS_CANONICAL_NAMES.get(lowered);
  if (specialClassName) {
    return specialClassName;
  }

  const classNumber = extractClassNumber(trimmed);
  if (classNumber) {
    return formatOrdinalClassName(classNumber);
  }

  if (lowered === "class") {
    return "Class";
  }

  return toTitleCase(trimmed);
};

export const normalizeClassNameForComparison = (name) => {
  const normalizedName = normalizeClassName(name);
  if (!normalizedName) {
    return "";
  }

  const classNumber = extractClassNumber(normalizedName);
  if (classNumber) {
    return `CLASS_${classNumber}`;
  }

  return normalizedName.toUpperCase().replace(/\s+/g, "_");
};

export const parseClassOrder = (name) => {
  const normalizedName = normalizeClassName(name);
  if (!normalizedName) {
    return 99;
  }

  const classNumber = extractClassNumber(normalizedName);
  if (classNumber) {
    return classNumber;
  }

  return SPECIAL_CLASS_ORDER[normalizedName] ?? 99;
};

export const getClassGradeLevel = (name) => {
  const normalizedName = normalizeClassName(name);
  const classNumber = extractClassNumber(normalizedName);

  if (normalizedName === "NURSERY" || normalizedName === "LKG" || normalizedName === "UKG") {
    return "kindergarten";
  }

  if (!classNumber) {
    return "unknown";
  }

  if (classNumber <= 5) return "primary";
  if (classNumber <= 8) return "middle";
  if (classNumber <= 10) return "secondary";
  return "senior";
};

export const getClassDisplayInfo = (name) => {
  const normalizedName = normalizeClassName(name);

  if (!normalizedName) {
    return {
      displayName: "Unknown",
      classNumber: null,
      romanNumeral: null,
      gradeLevel: "unknown",
    };
  }

  const classNumber = extractClassNumber(normalizedName);

  return {
    displayName: normalizedName,
    classNumber,
    romanNumeral: null,
    gradeLevel: getClassGradeLevel(normalizedName),
  };
};

export const buildCanonicalClassFields = (classLike = {}) => {
  const normalizedName = normalizeClassName(classLike.name);
  const section = normalizeClassSection(classLike.section);
  const academicYear = normalizeAcademicYear(classLike.academicYear);
  const classNumber = extractClassNumber(normalizedName);

  return {
    name: normalizedName,
    section,
    academicYear,
    classNumber,
    classOrder: parseClassOrder(normalizedName),
  };
};
