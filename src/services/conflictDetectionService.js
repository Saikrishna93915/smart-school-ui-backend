import mongoose from 'mongoose';
import TimetableSlot from '../models/TimetableSlot.js';
import Timetable from '../models/Timetable.js';
import TeacherAvailability from '../models/TeacherAvailability.js';
import Teacher from '../models/Teacher.js';
import User from '../models/User.js';

/**
 * Conflict Detection Service
 * Comprehensive conflict checking for timetable scheduling
 */
class ConflictDetectionService {
  
  /**
   * Check for teacher conflicts (double booking)
   * Ensures a teacher isn't assigned to multiple classes at the same time
   */
  async checkTeacherConflicts(slots) {
    const conflicts = [];
    const teacherSlotMap = new Map();

    for (const slot of slots) {
      if (!slot.teacherId) continue;

      const key = `${slot.teacherId}-${slot.dayOfWeek}-${slot.timeSlotId}`;
      
      if (teacherSlotMap.has(key)) {
        const existingSlot = teacherSlotMap.get(key);
        conflicts.push({
          type: 'teacher_clash',
          severity: 'error',
          message: `Teacher is assigned to multiple classes at the same time`,
          slotId: slot.id || slot._id,
          details: {
            teacherId: slot.teacherId,
            dayOfWeek: slot.dayOfWeek,
            timeSlotId: slot.timeSlotId,
            conflictingSlots: [existingSlot, slot]
          }
        });
        
        // Mark both slots as having conflict
        if (slot._id) {
          await TimetableSlot.findByIdAndUpdate(slot._id, {
            hasConflict: true,
            conflictType: 'teacher_clash',
            conflictDetails: 'Teacher double-booked'
          });
        }
      } else {
        teacherSlotMap.set(key, slot);
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      severity: conflicts.length > 0 ? 'error' : 'none'
    };
  }

  /**
   * Check for class conflicts (double booking)
   * Ensures a class doesn't have multiple subjects at the same time
   */
  async checkClassConflicts(slots) {
    const conflicts = [];
    const classSlotMap = new Map();

    for (const slot of slots) {
      // Skip if split class and checking different groups
      const key = slot.isSplitClass 
        ? `${slot.timetableId}-${slot.dayOfWeek}-${slot.timeSlotId}-${slot.splitGroup}`
        : `${slot.timetableId}-${slot.dayOfWeek}-${slot.timeSlotId}`;
      
      if (classSlotMap.has(key)) {
        conflicts.push({
          type: 'class_double_booking',
          severity: 'error',
          message: `Class has multiple subjects scheduled at the same time`,
          slotId: slot.id || slot._id,
          details: {
            timetableId: slot.timetableId,
            dayOfWeek: slot.dayOfWeek,
            timeSlotId: slot.timeSlotId,
            splitGroup: slot.splitGroup
          }
        });
        
        if (slot._id) {
          await TimetableSlot.findByIdAndUpdate(slot._id, {
            hasConflict: true,
            conflictType: 'double_booking',
            conflictDetails: 'Multiple subjects at same time'
          });
        }
      } else {
        classSlotMap.set(key, slot);
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      severity: conflicts.length > 0 ? 'error' : 'none'
    };
  }

  /**
   * Check for room conflicts
   * Ensures a room isn't booked for multiple classes simultaneously
   */
  async checkRoomConflicts(slots) {
    const conflicts = [];
    const roomSlotMap = new Map();

    for (const slot of slots) {
      if (!slot.roomNumber) continue;

      const key = `${slot.roomNumber}-${slot.dayOfWeek}-${slot.timeSlotId}`;
      
      if (roomSlotMap.has(key)) {
        const existingSlot = roomSlotMap.get(key);
        conflicts.push({
          type: 'room_clash',
          severity: 'warning',
          message: `Room is assigned to multiple classes at the same time`,
          slotId: slot.id || slot._id,
          details: {
            roomNumber: slot.roomNumber,
            dayOfWeek: slot.dayOfWeek,
            timeSlotId: slot.timeSlotId,
            conflictingSlots: [existingSlot, slot]
          }
        });
      } else {
        roomSlotMap.set(key, slot);
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      severity: conflicts.length > 0 ? 'warning' : 'none'
    };
  }

  /**
   * Check teacher availability
   */
  async checkTeacherAvailability(teacherId, dayOfWeek, timeSlotId, academicYearId, term = 'annual') {
    try {
      const availability = await TeacherAvailability.findOne({
        teacherId,
        dayOfWeek,
        timeSlotId,
        academicYearId,
        term
      });

      return availability ? availability.isAvailable : true;
    } catch (error) {
      console.error('Error checking teacher availability:', error);
      return true; // Default to available if error
    }
  }

  /**
   * Check teacher workload (hours per week)
   */
  async checkTeacherWorkload(teacherId, academicYearId) {
    try {
      // Get teacher's max workload
      const teacher = await User.findById(teacherId);
      const maxWorkload = teacher?.maxWorkloadHours || 30;

      // Count current timetable slots for this teacher
      const slots = await TimetableSlot.find({
        teacherId,
        isActive: true
      }).populate({
        path: 'timetableId',
        match: { academicYearId, isPublished: true }
      }).populate('timeSlotId');

      // Filter out null timetables (from match)
      const validSlots = slots.filter(s => s.timetableId);

      // Calculate total hours
      const totalMinutes = validSlots.reduce((sum, slot) => {
        return sum + (slot.timeSlotId?.durationMinutes || 0);
      }, 0);

      const currentWorkloadHours = Math.round(totalMinutes / 60 * 10) / 10; // Round to 1 decimal

      return {
        withinLimit: currentWorkloadHours <= maxWorkload,
        currentWorkload: currentWorkloadHours,
        maxWorkload,
        totalSlots: validSlots.length,
        availableHours: Math.max(0, maxWorkload - currentWorkloadHours)
      };
    } catch (error) {
      console.error('Error checking teacher workload:', error);
      return {
        withinLimit: true,
        currentWorkload: 0,
        maxWorkload: 30,
        totalSlots: 0,
        availableHours: 30
      };
    }
  }

  /**
   * Comprehensive conflict check for a single slot
   */
  async checkSlotConflict(slotData, excludeSlotId = null) {
    const conflicts = [];

    try {
      console.log('🔍 checkSlotConflict service - excludeSlotId:', excludeSlotId, 'type:', typeof excludeSlotId);
      
      // Convert excludeSlotId to MongoDB ObjectId to ensure proper comparison
      let normalizedExcludeId = null;
      if (excludeSlotId) {
        // If it's a string, convert to ObjectId; if already ObjectId, use as-is
        try {
          normalizedExcludeId = typeof excludeSlotId === 'string' 
            ? new mongoose.Types.ObjectId(excludeSlotId)
            : excludeSlotId;
          console.log('✅ Normalized excludeSlotId to ObjectId:', normalizedExcludeId.toString());
        } catch (conversionError) {
          console.error('❌ Failed to convert excludeSlotId to ObjectId:', conversionError.message);
          normalizedExcludeId = excludeSlotId;
        }
      }
      
      // Check for existing slot at same time (class double booking)
      const classConflictQuery = {
        timetableId: slotData.timetableId,
        dayOfWeek: slotData.dayOfWeek,
        timeSlotId: slotData.timeSlotId,
        isActive: true
      };

      if (slotData.isSplitClass) {
        classConflictQuery.splitGroup = slotData.splitGroup;
      }

      if (normalizedExcludeId) {
        classConflictQuery._id = { $ne: normalizedExcludeId };
        console.log('✅ Class conflict query will exclude:', normalizedExcludeId.toString());
      }

      const existingClassSlot = await TimetableSlot.findOne(classConflictQuery);
      console.log('🔍 Class conflict check - Found slot:', existingClassSlot ? existingClassSlot._id.toString() : 'none');
      
      if (existingClassSlot) {
        conflicts.push({
          type: 'class_double_booking',
          severity: 'error',
          message: 'Class already has a subject assigned at this time',
          details: { existingSlot: existingClassSlot }
        });
      }

      // Check teacher conflicts if teacher is assigned
      if (slotData.teacherId) {
        const teacherConflictQuery = {
          teacherId: slotData.teacherId,
          dayOfWeek: slotData.dayOfWeek,
          timeSlotId: slotData.timeSlotId,
          isActive: true
        };

        if (normalizedExcludeId) {
          teacherConflictQuery._id = { $ne: normalizedExcludeId };
          console.log('✅ Teacher conflict query will exclude:', normalizedExcludeId.toString());
        }

        const existingTeacherSlot = await TimetableSlot.findOne(teacherConflictQuery)
          .populate('timetableId');
        
        if (existingTeacherSlot) {
          conflicts.push({
            type: 'teacher_clash',
            severity: 'error',
            message: 'Teacher is already assigned to another class at this time',
            details: { existingSlot: existingTeacherSlot }
          });
        }

        // No qualification/availability/workload checks in slot assignment flow.
        // Allowed validations here: class double booking, teacher clash, room clash.
      }

      // Check room conflicts if room is assigned
      if (slotData.roomNumber) {
        const roomConflictQuery = {
          roomNumber: slotData.roomNumber,
          dayOfWeek: slotData.dayOfWeek,
          timeSlotId: slotData.timeSlotId,
          isActive: true
        };

        if (normalizedExcludeId) {
          roomConflictQuery._id = { $ne: normalizedExcludeId };
          console.log('✅ Room conflict query will exclude:', normalizedExcludeId.toString());
        }

        const existingRoomSlot = await TimetableSlot.findOne(roomConflictQuery);
        console.log('🔍 Room conflict check - Found slot:', existingRoomSlot ? existingRoomSlot._id.toString() : 'none');
        
        if (existingRoomSlot) {
          conflicts.push({
            type: 'room_clash',
            severity: 'warning',
            message: 'Room is already assigned to another class at this time',
            details: { existingSlot: existingRoomSlot }
          });
        }
      }

    } catch (error) {
      console.error('Error in checkSlotConflict:', error);
      conflicts.push({
        type: 'error',
        severity: 'error',
        message: 'Error checking conflicts',
        details: { error: error.message }
      });
    }

    const hasConflict = conflicts.length > 0;
    const severity = conflicts.some(c => c.severity === 'error') ? 'error' : 
                     conflicts.some(c => c.severity === 'warning') ? 'warning' : 'none';

    return {
      hasConflict,
      conflicts,
      severity,
      conflictCount: conflicts.length
    };
  }

  /**
   * Comprehensive check for entire timetable
   */
  async comprehensiveCheck(timetableId) {
    try {
      const slots = await TimetableSlot.find({
        timetableId,
        isActive: true
      }).populate('timeSlotId')
        .populate('teacherId')
        .populate('subjectId');

      const results = {
        isValid: true,
        teacherConflicts: [],
        classConflicts: [],
        roomConflicts: [],
        workloadIssues: [],
        availabilityIssues: [],
        totalIssues: 0
      };

      // Check teacher conflicts
      const teacherCheck = await this.checkTeacherConflicts(slots);
      results.teacherConflicts = teacherCheck.conflicts;

      // Check class conflicts
      const classCheck = await this.checkClassConflicts(slots);
      results.classConflicts = classCheck.conflicts;

      // Check room conflicts
      const roomCheck = await this.checkRoomConflicts(slots);
      results.roomConflicts = roomCheck.conflicts;

      // Check each slot individually for detailed issues
      const uniqueTeachers = [...new Set(slots.map(s => s.teacherId).filter(Boolean))];
      const timetable = await Timetable.findById(timetableId);

      for (const slot of slots) {
        if (slot.teacherId && slot.subjectId) {
          // Availability check
          const isAvailable = await this.checkTeacherAvailability(
            slot.teacherId,
            slot.dayOfWeek,
            slot.timeSlotId,
            timetable.academicYearId,
            timetable.term
          );
          if (!isAvailable) {
            results.availabilityIssues.push({
              slotId: slot._id,
              teacherId: slot.teacherId,
              message: `Teacher unavailable at this time`
            });
          }
        }
      }

      // Workload checks for each teacher
      for (const teacherId of uniqueTeachers) {
        const workload = await this.checkTeacherWorkload(teacherId, timetable.academicYearId);
        if (!workload.withinLimit) {
          results.workloadIssues.push({
            teacherId,
            currentWorkload: workload.currentWorkload,
            maxWorkload: workload.maxWorkload,
            message: `Teacher workload exceeds limit`
          });
        }
      }

      results.totalIssues = 
        results.teacherConflicts.length +
        results.classConflicts.length +
        results.roomConflicts.length +
        results.workloadIssues.length +
        results.availabilityIssues.length;

      results.isValid = results.totalIssues === 0;

      return results;
    } catch (error) {
      console.error('Error in comprehensiveCheck:', error);
      throw error;
    }
  }

  /**
   * Get all conflicts for a specific academic year
   */
  async getAllConflicts(filters = {}) {
    try {
      const query = {
        hasConflict: true,
        isActive: true,
        conflictType: { $ne: 'qualification_mismatch' }
      };

      if (filters.academicYearId) {
        const timetables = await Timetable.find({
          academicYearId: filters.academicYearId
        }).select('_id');
        query.timetableId = { $in: timetables.map(t => t._id) };
      }

      if (filters.teacherId) {
        query.teacherId = filters.teacherId;
      }

      const conflicts = await TimetableSlot.find(query)
        .populate('timetableId')
        .populate('teacherId', 'name email')
        .populate('subjectId', 'subjectName subjectCode')
        .populate('timeSlotId')
        .sort({ dayOfWeek: 1, 'timeSlotId.displayOrder': 1 });

      return conflicts;
    } catch (error) {
      console.error('Error getting all conflicts:', error);
      throw error;
    }
  }
}

export default new ConflictDetectionService();
