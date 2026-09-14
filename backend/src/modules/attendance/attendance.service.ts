import { AttendanceStatus, MarkedBy, TenantRole, Prisma, AttendanceSource, Holiday } from '@prisma/client';
import prisma from '../../common/prisma/prisma.service';
import { AppError } from '../../common/middleware/error.middleware';

export class AttendanceService {
  private getTodayUtcDate(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private parseDateToUtc(dateStr: string | Date): Date {
    const d = new Date(dateStr);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private async findMatchingHoliday(companyId: string, targetDate: Date): Promise<Holiday | null> {
    const exact = await prisma.holiday.findFirst({
      where: { company_id: companyId, date: targetDate },
    });
    if (exact) return exact;

    const recurring = await prisma.holiday.findMany({
      where: { company_id: companyId, is_recurring_annually: true },
    });

    const targetMonth = targetDate.getUTCMonth();
    const targetDay = targetDate.getUTCDate();

    return (
      recurring.find((h) => {
        const d = new Date(h.date);
        return d.getUTCMonth() === targetMonth && d.getUTCDate() === targetDay;
      }) || null
    );
  }

  async punch(
    companyId: string,
    employeeId: string,
    action: 'check_in' | 'check_out' | 'toggle' = 'toggle',
    source: AttendanceSource = AttendanceSource.web,
    deviceId?: string
  ) {
    if (!employeeId) {
      throw new AppError(400, 'NO_EMPLOYEE_PROFILE', 'User account is not linked to an employee profile');
    }

    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, company_id: companyId },
    });
    if (!emp) {
      throw new AppError(404, 'NOT_FOUND', 'Employee record not found in this company');
    }
    if (emp.status !== 'active') {
      throw new AppError(403, 'EMPLOYEE_INACTIVE', `Cannot record attendance for ${emp.status} employee`);
    }

    if (source === AttendanceSource.biometric && deviceId) {
      const device = await prisma.device.findFirst({
        where: { id: deviceId, company_id: companyId },
      });
      if (!device) {
        throw new AppError(404, 'DEVICE_NOT_FOUND', 'Biometric device not found');
      }
      if (!device.is_active) {
        throw new AppError(400, 'DEVICE_INACTIVE', 'Biometric device is inactive');
      }
    }

    const todayDate = this.getTodayUtcDate();
    const now = new Date();

    let record = await prisma.attendance.findUnique({
      where: {
        employee_id_date: {
          employee_id: employeeId,
          date: todayDate,
        },
      },
    });

    if (action === 'toggle') {
      if (!record || !record.check_in_time) {
        // Check if there is an unclosed check-in on the previous day (night shift)
        const yesterdayDate = new Date(todayDate);
        yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
        const prevRecord = await prisma.attendance.findUnique({
          where: {
            employee_id_date: {
              employee_id: employeeId,
              date: yesterdayDate,
            },
          },
        });

        if (prevRecord && prevRecord.check_in_time && !prevRecord.check_out_time) {
          record = prevRecord;
          action = 'check_out';
        } else {
          action = 'check_in';
        }
      } else if (!record.check_out_time) {
        action = 'check_out';
      } else {
        // Already clocked in and out today; allow clock-out time update
        action = 'check_out';
      }
    }

    if (action === 'check_in') {
      if (record && record.check_in_time) {
        return {
          message: 'Already checked in for today',
          attendance: record,
        };
      }

      if (!record) {
        record = await prisma.attendance.create({
          data: {
            company_id: companyId,
            employee_id: employeeId,
            date: todayDate,
            check_in_time: now,
            status: AttendanceStatus.present,
            marked_by: MarkedBy.self,
            source,
            device_id: deviceId || null,
            worked_hours: 0,
          },
        });
      } else {
        record = await prisma.attendance.update({
          where: { id: record.id },
          data: {
            check_in_time: now,
            status: AttendanceStatus.present,
            marked_by: MarkedBy.self,
            source,
            device_id: deviceId || record.device_id,
          },
        });
      }

      return {
        message: 'Checked in successfully',
        attendance: record,
      };
    }

    if (action === 'check_out') {
      if (!record || !record.check_in_time) {
        // Check for open unclosed check-in from yesterday (night shift crossing midnight)
        const yesterdayDate = new Date(todayDate);
        yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
        const prevRecord = await prisma.attendance.findUnique({
          where: {
            employee_id_date: {
              employee_id: employeeId,
              date: yesterdayDate,
            },
          },
        });

        if (prevRecord && prevRecord.check_in_time && !prevRecord.check_out_time) {
          record = prevRecord;
        } else {
          throw new AppError(400, 'NOT_CHECKED_IN', 'Cannot clock out before clocking in today');
        }
      }

      const diffMs = now.getTime() - new Date(record.check_in_time!).getTime();
      const workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

      // Fetch assigned shift for employee
      const assignedShift = await prisma.employeeShift.findFirst({
        where: {
          employee_id: employeeId,
          effective_from: { lte: todayDate },
          OR: [{ effective_to: null }, { effective_to: { gte: todayDate } }],
        },
        include: { shift: true },
        orderBy: { effective_from: 'desc' },
      });

      // Default expected duration: 8.0 hours
      let expectedHours = 8.0;
      if (assignedShift?.shift) {
        const [startH, startM] = assignedShift.shift.start_time.split(':').map(Number);
        const [endH, endM] = assignedShift.shift.end_time.split(':').map(Number);
        let startMinutes = startH * 60 + startM;
        let endMinutes = endH * 60 + endM;

        // Handle night shift crossing midnight
        if (assignedShift.shift.is_night_shift || endMinutes < startMinutes) {
          endMinutes += 24 * 60;
        }

        const shiftSpanHours = (endMinutes - startMinutes) / 60;
        // Exclude 1 hr standard meal break for shifts > 5 hrs
        expectedHours = shiftSpanHours > 5 ? shiftSpanHours - 1 : shiftSpanHours;
      }

      // Check Holiday (exact date or recurring annually)
      const holiday = await this.findMatchingHoliday(companyId, todayDate);

      let status: AttendanceStatus = AttendanceStatus.present;
      if (holiday) {
        status = AttendanceStatus.holiday;
      } else if (workedHours >= expectedHours * 0.9) {
        status = AttendanceStatus.present;
      } else if (workedHours >= expectedHours * 0.45) {
        status = AttendanceStatus.half_day;
      } else {
        status = AttendanceStatus.absent;
      }

      record = await prisma.attendance.update({
        where: { id: record.id },
        data: {
          check_out_time: now,
          worked_hours: workedHours,
          status,
        },
      });

      return {
        message: 'Checked out successfully',
        attendance: record,
      };
    }

    throw new AppError(400, 'INVALID_ACTION', 'Invalid punch action');
  }

  async getTodayStatus(companyId: string, employeeId: string) {
    if (!employeeId) return null;

    const todayDate = this.getTodayUtcDate();
    const record = await prisma.attendance.findUnique({
      where: {
        employee_id_date: {
          employee_id: employeeId,
          date: todayDate,
        },
      },
    });

    return record;
  }

  async getTodayRoster(
    companyId: string,
    viewerRole: TenantRole,
    viewerEmployeeId?: string | null
  ) {
    const todayDate = this.getTodayUtcDate();
    const todayStr = todayDate.toISOString().split('T')[0];

    const whereEmployee: Prisma.EmployeeWhereInput = {
      company_id: companyId,
      status: 'active',
    };

    if (viewerRole === TenantRole.manager && viewerEmployeeId) {
      whereEmployee.OR = [
        { id: viewerEmployeeId },
        { manager_id: viewerEmployeeId },
      ];
    }

    const employees = await prisma.employee.findMany({
      where: whereEmployee,
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
      },
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
    });

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        company_id: companyId,
        date: todayDate,
        employee_id: { in: employees.map((e) => e.id) },
      },
    });

    const attendanceMap = new Map<string, typeof attendanceRecords[0]>();
    for (const a of attendanceRecords) {
      attendanceMap.set(a.employee_id, a);
    }

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        company_id: companyId,
        status: 'approved',
        start_date: { lte: todayDate },
        end_date: { gte: todayDate },
        employee_id: { in: employees.map((e) => e.id) },
      },
      include: {
        leave_type: { select: { name: true } },
      },
    });

    const leaveMap = new Map<string, string>();
    for (const l of leaves) {
      leaveMap.set(l.employee_id, l.leave_type?.name || 'Approved Leave');
    }

    const present: Array<{
      id: string;
      employee_code: string;
      name: string;
      email: string;
      department: string;
      designation: string;
      check_in_time: string | null;
      check_out_time: string | null;
      status: string;
      worked_hours: number;
    }> = [];

    const absent: Array<{
      id: string;
      employee_code: string;
      name: string;
      email: string;
      department: string;
      designation: string;
    }> = [];

    const onLeave: Array<{
      id: string;
      employee_code: string;
      name: string;
      email: string;
      department: string;
      designation: string;
      leave_type: string;
    }> = [];

    for (const emp of employees) {
      const att = attendanceMap.get(emp.id);
      const leaveType = leaveMap.get(emp.id);
      const name = `${emp.first_name} ${emp.last_name}`.trim();
      const department = emp.department?.name || 'General';
      const designation = emp.designation?.name || 'Staff';
      const email = emp.email;

      if (
        att &&
        (att.status === AttendanceStatus.present ||
          att.status === AttendanceStatus.half_day ||
          att.check_in_time)
      ) {
        present.push({
          id: emp.id,
          employee_code: emp.employee_code,
          name,
          email,
          department,
          designation,
          check_in_time: att.check_in_time ? att.check_in_time.toISOString() : null,
          check_out_time: att.check_out_time ? att.check_out_time.toISOString() : null,
          status: att.status,
          worked_hours: att.worked_hours,
        });
      } else if (leaveType || att?.status === AttendanceStatus.on_leave) {
        onLeave.push({
          id: emp.id,
          employee_code: emp.employee_code,
          name,
          email,
          department,
          designation,
          leave_type: leaveType || 'Approved Leave',
        });
      } else {
        absent.push({
          id: emp.id,
          employee_code: emp.employee_code,
          name,
          email,
          department,
          designation,
        });
      }
    }

    const totalEmployees = employees.length;
    const presentCount = present.length;
    const absentCount = absent.length;
    const onLeaveCount = onLeave.length;
    const attendanceRate = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;

    return {
      date: todayStr,
      totalEmployees,
      presentCount,
      absentCount,
      onLeaveCount,
      attendanceRate,
      present,
      absent,
      onLeave,
    };
  }

  async manualPunchOrCorrection(
    companyId: string,
    adminUserId: string,
    data: {
      employee_id: string;
      date: string;
      check_in_time?: string | null;
      check_out_time?: string | null;
      status: AttendanceStatus;
      worked_hours?: number;
    }
  ) {
    const emp = await prisma.employee.findFirst({
      where: { id: data.employee_id, company_id: companyId },
    });
    if (!emp) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found in your company');
    }

    const dateUtc = this.parseDateToUtc(data.date);

    let checkIn = data.check_in_time ? new Date(data.check_in_time) : null;
    let checkOut = data.check_out_time ? new Date(data.check_out_time) : null;
    let hours = data.worked_hours ?? 0;

    if (checkIn && checkOut && !data.worked_hours) {
      const diffMs = checkOut.getTime() - checkIn.getTime();
      hours = Math.max(0, Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100);
    }

    const [holiday, companySettings] = await Promise.all([
      this.findMatchingHoliday(companyId, dateUtc),
      prisma.companySettings.findUnique({
        where: { company_id: companyId },
      }),
    ]);

    let finalStatus = data.status;
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayOfWeek = dayNames[dateUtc.getUTCDay()];
    const workingDays = Array.isArray(companySettings?.working_days_json)
      ? (companySettings!.working_days_json as string[]).map((d) => d.toLowerCase())
      : ['mon', 'tue', 'wed', 'thu', 'fri'];
    const isWeekOff = !workingDays.includes(dayOfWeek);

    if (holiday && (data.status === AttendanceStatus.absent || (!checkIn && data.status !== AttendanceStatus.present))) {
      finalStatus = AttendanceStatus.holiday;
    } else if (isWeekOff && (data.status === AttendanceStatus.absent || (!checkIn && data.status !== AttendanceStatus.present))) {
      finalStatus = AttendanceStatus.week_off;
    }

    const record = await prisma.attendance.upsert({
      where: {
        employee_id_date: {
          employee_id: data.employee_id,
          date: dateUtc,
        },
      },
      create: {
        company_id: companyId,
        employee_id: data.employee_id,
        date: dateUtc,
        check_in_time: checkIn,
        check_out_time: checkOut,
        status: finalStatus,
        worked_hours: hours,
        marked_by: MarkedBy.admin,
      },
      update: {
        check_in_time: checkIn,
        check_out_time: checkOut,
        status: finalStatus,
        worked_hours: hours,
        marked_by: MarkedBy.admin,
      },
    });

    await prisma.auditLog.create({
      data: {
        company_id: companyId,
        user_id: adminUserId,
        action: 'MANUAL_ATTENDANCE_CORRECTION',
        entity_type: 'attendance',
        entity_id: record.id,
        new_value_json: {
          employeeId: data.employee_id,
          date: data.date,
          status: data.status,
          workedHours: hours,
        },
      },
    });

    return record;
  }

  async getAttendanceCalendar(
    companyId: string,
    viewerRole: TenantRole,
    viewerEmployeeId: string | null | undefined,
    params: {
      month: number;
      year: number;
      employee_id?: string;
      department_id?: string;
    }
  ) {
    const month = Number(params.month);
    const year = Number(params.year);

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    const where: Prisma.AttendanceWhereInput = {
      company_id: companyId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Role-based scoping
    if (viewerRole === TenantRole.employee) {
      if (!viewerEmployeeId) {
        throw new AppError(403, 'FORBIDDEN', 'No linked employee profile');
      }
      where.employee_id = viewerEmployeeId;
    } else if (viewerRole === TenantRole.manager) {
      if (!viewerEmployeeId) {
        throw new AppError(403, 'FORBIDDEN', 'No linked employee profile');
      }
      where.employee = {
        company_id: companyId,
        OR: [
          { id: viewerEmployeeId }, // Manager self
          { manager_id: viewerEmployeeId }, // Direct reports
        ],
      };
      if (params.employee_id) {
        where.employee_id = params.employee_id;
      }
    } else {
      // Company Admin
      if (params.employee_id) {
        where.employee_id = params.employee_id;
      }
      if (params.department_id) {
        where.employee = {
          company_id: companyId,
          department_id: params.department_id,
        };
      }
    }

    const records = await prisma.attendance.findMany({
      where,
      orderBy: [{ date: 'asc' }, { employee: { employee_code: 'asc' } }],
      include: {
        employee: {
          select: {
            id: true,
            employee_code: true,
            first_name: true,
            last_name: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } },
          },
        },
      },
    });

    return records;
  }

  async getMonthlySummary(
    companyId: string,
    employeeId: string,
    month: number,
    year: number
  ) {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    const records = await prisma.attendance.findMany({
      where: {
        company_id: companyId,
        employee_id: employeeId,
        date: { gte: startDate, lte: endDate },
      },
    });

    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let holidayDays = 0;
    let totalWorkedHours = 0;

    for (const r of records) {
      totalWorkedHours += r.worked_hours;
      switch (r.status) {
        case AttendanceStatus.present:
          presentDays += 1;
          break;
        case AttendanceStatus.half_day:
          halfDays += 1;
          break;
        case AttendanceStatus.absent:
          absentDays += 1;
          break;
        case AttendanceStatus.on_leave:
          leaveDays += 1;
          break;
        case AttendanceStatus.holiday:
          holidayDays += 1;
          break;
      }
    }

    return {
      month,
      year,
      totalRecords: records.length,
      presentDays,
      halfDays,
      absentDays,
      leaveDays,
      holidayDays,
      totalWorkedHours: Math.round(totalWorkedHours * 100) / 100,
    };
  }

  async getSourceDistribution(
    companyId: string,
    role: TenantRole,
    employeeId?: string,
    month?: number,
    year?: number
  ) {
    const now = new Date();
    const m = month || now.getUTCMonth() + 1;
    const y = year || now.getUTCFullYear();
    const startDate = new Date(Date.UTC(y, m - 1, 1));
    const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

    const where: Prisma.AttendanceWhereInput = {
      company_id: companyId,
      date: { gte: startDate, lte: endDate },
    };

    if (role === TenantRole.manager && employeeId) {
      where.employee = {
        OR: [
          { id: employeeId },
          { manager_id: employeeId },
        ],
      };
    } else if (role === TenantRole.employee && employeeId) {
      where.employee_id = employeeId;
    }

    const groups = await prisma.attendance.groupBy({
      by: ['source'],
      where,
      _count: { id: true },
    });

    const distribution: Record<string, number> = {
      web: 0,
      mobile: 0,
      biometric: 0,
    };

    let total = 0;
    for (const g of groups) {
      distribution[g.source] = g._count.id;
      total += g._count.id;
    }

    return {
      month: m,
      year: y,
      distribution,
      total,
    };
  }
}

export const attendanceService = new AttendanceService();
