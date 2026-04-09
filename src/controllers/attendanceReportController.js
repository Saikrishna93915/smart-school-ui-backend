import Attendance from '../models/Attendance.js';
import Student from '../models/Student.js';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';

export const generateAttendanceReport = async (req, res) => {
    try {
        const { class: className, section, reportType = 'day', startDate, endDate } = req.query;

        // Validate required params
        if (!className || !section || !reportType || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: class, section, reportType, startDate, endDate'
            });
        }

        // Validate report type
        const validTypes = ['day', 'week', 'month', 'year'];
        if (!validTypes.includes(reportType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reportType. Must be: day, week, month, or year'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        // Route to appropriate report generator
        let report;
        switch (reportType) {
            case 'day':
                report = await generateDayReport(className, section, startDate);
                break;
            case 'week':
                report = await generateWeekReport(className, section, start, end);
                break;
            case 'month':
                report = await generateMonthReport(className, section, start, end);
                break;
            case 'year':
                report = await generateYearReport(className, section, start, end);
                break;
        }

        res.json({
            success: true,
            reportType,
            dateRange: { startDate, endDate },
            data: report
        });

    } catch (error) {
        console.error('Error generating attendance report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate report',
            error: error.message
        });
    }
};

// 📅 DAY REPORT: Detailed session view
const generateDayReport = async (className, section, dateStr) => {
    try {
        const date = new Date(dateStr);
        
        // Get students
        const query = { 'class.className': className };
        if (section !== 'all') {
            query['class.section'] = section;
        }
        
        const students = await Student.find(query)
            .select('admissionNumber student class')
            .lean();

        if (students.length === 0) {
            return { totalRecords: 0, students: [], stats: { present: 0, absent: 0, pending: 0, rate: 0 } };
        }

        const attendanceRecords = await Attendance.find({
            studentId: { $in: students.map(s => s._id) },
            date: {
                $gte: startOfDay(date),
                $lte: endOfDay(date)
            }
        }).lean();

        const attendanceMap = new Map(attendanceRecords.map(r => [r.studentId.toString(), r]));

        const studentRecords = students.map(student => {
            const attendance = attendanceMap.get(student._id.toString()) || {
                morning: null,
                afternoon: null
            };

            return {
                id: student.admissionNumber,
                name: `${student.student.firstName} ${student.student.lastName}`,
                class: student.class.className,
                section: student.class.section,
                morning: attendance.morning === null ? 'Pending' : attendance.morning ? 'Present' : 'Absent',
                afternoon: attendance.afternoon === null ? 'Pending' : attendance.afternoon ? 'Present' : 'Absent',
                fullDay: calculateFullDayStatus(attendance.morning, attendance.afternoon)
            };
        });

        // Calculate stats
        let present = 0, absent = 0, pending = 0;
        studentRecords.forEach(rec => {
            if (rec.fullDay === 'Present') present++;
            else if (rec.fullDay === 'Absent') absent++;
            else if (rec.fullDay === 'Pending') pending++;
        });

        return {
            date: dateStr,
            totalRecords: students.length,
            students: studentRecords,
            stats: {
                present,
                absent,
                pending,
                rate: students.length > 0 ? Math.round((present / students.length) * 100) : 0
            }
        };

    } catch (error) {
        console.error('Error in generateDayReport:', error);
        throw error;
    }
};

// 📅 WEEK REPORT: Compact 7-column format
const generateWeekReport = async (className, section, startDate, endDate) => {
    try {
        const query = { 'class.className': className };
        if (section !== 'all') {
            query['class.section'] = section;
        }

        const students = await Student.find(query)
            .select('admissionNumber student class')
            .lean();

        if (students.length === 0) {
            return { totalRecords: 0, students: [], totalWorkingDays: 0, stats: { rate: 0 } };
        }

        const studentIds = students.map(s => s._id);

        // Get all attendance for date range
        const attendanceRecords = await Attendance.find({
            studentId: { $in: studentIds },
            date: {
                $gte: startOfDay(startDate),
                $lte: endOfDay(endDate)
            }
        }).lean();

        // Group by date
        const dateMap = new Map();
        attendanceRecords.forEach(record => {
            const dateStr = format(new Date(record.date), 'yyyy-MM-dd');
            if (!dateMap.has(dateStr)) {
                dateMap.set(dateStr, []);
            }
            dateMap.get(dateStr).push(record);
        });

        const dates = Array.from(dateMap.keys()).sort();
        const dayHeaders = dates.map(d => format(parseISO(d), 'EEE MM/dd'));

        // Build student rows
        const studentRecords = students.map(student => {
            const row = {
                id: student.admissionNumber,
                name: `${student.student.firstName} ${student.student.lastName}`,
                days: {}
            };

            let studentPresent = 0;

            dates.forEach(dateStr => {
                const dayAttendances = dateMap.get(dateStr) || [];
                const att = dayAttendances.find(a => a.studentId.toString() === student._id.toString());

                const status = att
                    ? calculateFullDayStatus(att.morning, att.afternoon)
                    : 'Pending';

                // Abbreviate for compact view
                let abbr = 'P';
                if (status === 'Absent') abbr = 'A';
                else if (status === 'Pending') abbr = '-';
                else if (status === 'Partial') abbr = 'L';
                else if (status === 'Present') {
                    abbr = 'P';
                    studentPresent++;
                }

                row.days[dateStr] = abbr;
            });

            row.percentage = dates.length > 0 ? Math.round((studentPresent / dates.length) * 100) : 0;

            return row;
        });

        // Overall stats
        let totalPresent = 0;
        studentRecords.forEach(rec => {
            totalPresent += Object.values(rec.days).filter(d => d === 'P').length;
        });

        return {
            dateRange: { startDate: format(startDate, 'yyyy-MM-dd'), endDate: format(endDate, 'yyyy-MM-dd') },
            totalWorkingDays: dates.length,
            dayHeaders,
            totalRecords: students.length,
            students: studentRecords,
            stats: {
                totalPresent,
                rate: (students.length * dates.length) > 0 
                    ? Math.round((totalPresent / (students.length * dates.length)) * 100) 
                    : 0
            }
        };

    } catch (error) {
        console.error('Error in generateWeekReport:', error);
        throw error;
    }
};

// 📅 MONTH REPORT: Summary only
const generateMonthReport = async (className, section, startDate, endDate) => {
    try {
        const query = { 'class.className': className };
        if (section !== 'all') {
            query['class.section'] = section;
        }

        const students = await Student.find(query)
            .select('admissionNumber student class')
            .lean();

        if (students.length === 0) {
            return { totalRecords: 0, students: [], stats: { workingDays: 0 } };
        }

        const studentIds = students.map(s => s._id);

        const attendanceRecords = await Attendance.find({
            studentId: { $in: studentIds },
            date: {
                $gte: startOfDay(startDate),
                $lte: endOfDay(endDate)
            }
        }).lean();

        // Count unique dates (working days)
        const uniqueDates = new Set(
            attendanceRecords.map(r => format(new Date(r.date), 'yyyy-MM-dd'))
        );
        const workingDays = uniqueDates.size;

        // Aggregate per student
        const studentMap = new Map();
        students.forEach(s => {
            studentMap.set(s._id.toString(), {
                id: s.admissionNumber,
                name: `${s.student.firstName} ${s.student.lastName}`,
                present: 0,
                absent: 0,
                leave: 0,
                pending: 0
            });
        });

        attendanceRecords.forEach(att => {
            const studentKey = att.studentId.toString();
            const rec = studentMap.get(studentKey);
            if (rec) {
                const status = calculateFullDayStatus(att.morning, att.afternoon);
                if (status === 'Present') rec.present++;
                else if (status === 'Absent') rec.absent++;
                else if (status === 'Partial') rec.leave++;
                else rec.pending++;
            }
        });

        const studentRecords = Array.from(studentMap.values()).map(rec => ({
            ...rec,
            rate: workingDays > 0 ? Math.round((rec.present / workingDays) * 100) : 0
        }));

        let totalPresent = 0, totalAbsent = 0, totalLeave = 0;
        studentRecords.forEach(rec => {
            totalPresent += rec.present;
            totalAbsent += rec.absent;
            totalLeave += rec.leave;
        });

        return {
            dateRange: { startDate: format(startDate, 'yyyy-MM-dd'), endDate: format(endDate, 'yyyy-MM-dd') },
            workingDays,
            totalRecords: students.length,
            students: studentRecords,
            stats: {
                workingDays,
                totalPresent,
                totalAbsent,
                totalLeave,
                overallRate: (students.length * workingDays) > 0
                    ? Math.round((totalPresent / (students.length * workingDays)) * 100)
                    : 0
            }
        };

    } catch (error) {
        console.error('Error in generateMonthReport:', error);
        throw error;
    }
};

// 📅 YEAR REPORT: Monthly summary
const generateYearReport = async (className, section, startDate, endDate) => {
    try {
        const query = { 'class.className': className };
        if (section !== 'all') {
            query['class.section'] = section;
        }

        const students = await Student.find(query)
            .select('admissionNumber student class')
            .lean();

        if (students.length === 0) {
            return { totalRecords: 0, monthSummary: [], studentSummary: [], stats: {} };
        }

        const studentIds = students.map(s => s._id);

        const attendanceRecords = await Attendance.find({
            studentId: { $in: studentIds },
            date: {
                $gte: startOfDay(startDate),
                $lte: endOfDay(endDate)
            }
        }).lean();

        // Monthly aggregation
        const monthMap = new Map();
        attendanceRecords.forEach(att => {
            const monthKey = format(new Date(att.date), 'yyyy-MM');
            if (!monthMap.has(monthKey)) {
                monthMap.set(monthKey, { present: 0, absent: 0, leave: 0, workingDays: new Set() });
            }
            
            const month = monthMap.get(monthKey);
            const status = calculateFullDayStatus(att.morning, att.afternoon);
            
            month.workingDays.add(format(new Date(att.date), 'yyyy-MM-dd'));
            
            if (status === 'Present') month.present++;
            else if (status === 'Absent') month.absent++;
            else if (status === 'Partial') month.leave++;
        });

        const monthSummary = Array.from(monthMap.entries()).map(([month, data]) => ({
            month: format(parseISO(month + '-01'), 'MMMM yyyy'),
            workingDays: data.workingDays.size,
            present: data.present,
            absent: data.absent,
            leave: data.leave,
            rate: data.workingDays.size > 0 
                ? Math.round((data.present / (data.workingDays.size * students.length)) * 100)
                : 0
        }));

        // Per-student yearly summary
        const studentMap = new Map();
        students.forEach(s => {
            studentMap.set(s._id.toString(), {
                id: s.admissionNumber,
                name: `${s.student.firstName} ${s.student.lastName}`,
                totalPresent: 0,
                totalAbsent: 0,
                totalLeave: 0
            });
        });

        attendanceRecords.forEach(att => {
            const studentKey = att.studentId.toString();
            const rec = studentMap.get(studentKey);
            if (rec) {
                const status = calculateFullDayStatus(att.morning, att.afternoon);
                if (status === 'Present') rec.totalPresent++;
                else if (status === 'Absent') rec.totalAbsent++;
                else if (status === 'Partial') rec.totalLeave++;
            }
        });

        const studentSummary = Array.from(studentMap.values()).map(rec => {
            const total = rec.totalPresent + rec.totalAbsent + rec.totalLeave;
            return {
                ...rec,
                totalDays: total,
                rate: total > 0 ? Math.round((rec.totalPresent / total) * 100) : 0
            };
        });

        // Overall stats
        const totalWorking = new Set(
            attendanceRecords.map(r => format(new Date(r.date), 'yyyy-MM-dd'))
        ).size;

        let overallPresent = 0;
        studentSummary.forEach(rec => {
            overallPresent += rec.totalPresent;
        });

        return {
            dateRange: { startDate: format(startDate, 'yyyy-MM-dd'), endDate: format(endDate, 'yyyy-MM-dd') },
            totalRecords: students.length,
            monthSummary,
            studentSummary,
            stats: {
                totalWorkingDays: totalWorking,
                totalRecords: attendanceRecords.length,
                overallRate: (students.length * totalWorking) > 0
                    ? Math.round((overallPresent / (students.length * totalWorking)) * 100)
                    : 0
            }
        };

    } catch (error) {
        console.error('Error in generateYearReport:', error);
        throw error;
    }
};

const calculateFullDayStatus = (morning, afternoon) => {
    if (morning === true && afternoon === true) return 'Present';
    if (morning === false && afternoon === false) return 'Absent';
    if ((morning === true || afternoon === true) && (morning === null || afternoon === null)) return 'Partial';
    if (morning === null && afternoon === null) return 'Pending';
    if ((morning === true && afternoon === false) || (morning === false && afternoon === true)) return 'Partial';
    return 'Pending';
};
