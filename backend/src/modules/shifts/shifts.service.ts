import prisma from '../../common/prisma/prisma.service';
import { AppError } from '../../common/middleware/error.middleware';

export class ShiftsService {
  private parseDateToUtc(dateStr: string | Date): Date {
    const d = new Date(dateStr);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  // --- Shifts ---
  async listShifts(companyId: string) {
    return prisma.shift.findMany({
      where: { company_id: companyId },
      orderBy: { created_at: 'asc' },
      include: {
        _count: { select: { assignments: true } },
      },
    });
  }

  async createShift(
    companyId: string,
    data: {
      name: string;
      start_time: string;
      end_time: string;
      is_night_shift?: boolean;
    }
  ) {
    return prisma.shift.create({
      data: {
        company_id: companyId,
        name: data.name.trim(),
        start_time: data.start_time,
        end_time: data.end_time,
        is_night_shift: data.is_night_shift || false,
      },
    });
  }

  async updateShift(
    companyId: string,
    shiftId: string,
    data: {
      name?: string;
      start_time?: string;
      end_time?: string;
      is_night_shift?: boolean;
    }
  ) {
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, company_id: companyId },
    });
    if (!shift) {
      throw new AppError(404, 'NOT_FOUND', 'Shift not found');
    }

    return prisma.shift.update({
      where: { id: shiftId },
      data,
    });
  }

  async assignShift(
    companyId: string,
    data: {
      shift_id: string;
      employee_ids: string[];
      effective_from?: string | Date;
      effective_to?: string | Date | null;
    }
  ) {
    const shift = await prisma.shift.findFirst({
      where: { id: data.shift_id, company_id: companyId },
    });
    if (!shift) {
      throw new AppError(404, 'NOT_FOUND', 'Shift not found');
    }

    const effectiveFrom = data.effective_from ? this.parseDateToUtc(data.effective_from) : new Date();
    const effectiveTo = data.effective_to ? this.parseDateToUtc(data.effective_to) : null;

    const assignments = await prisma.$transaction(async (tx) => {
      const createdList = [];
      for (const empId of data.employee_ids) {
        // Verify employee belongs to company
        const emp = await tx.employee.findFirst({
          where: { id: empId, company_id: companyId },
        });
        if (!emp) continue;

        // Auto-close previous active/overlapping shift assignments to prevent conflicts
        const previousCloseDate = new Date(effectiveFrom.getTime() - 1000);
        await tx.employeeShift.updateMany({
          where: {
            employee_id: empId,
            effective_from: { lte: effectiveFrom },
            OR: [
              { effective_to: null },
              { effective_to: { gte: effectiveFrom } },
            ],
          },
          data: {
            effective_to: previousCloseDate,
          },
        });

        const assignment = await tx.employeeShift.create({
          data: {
            company_id: companyId,
            employee_id: empId,
            shift_id: data.shift_id,
            effective_from: effectiveFrom,
            effective_to: effectiveTo,
          },
        });
        createdList.push(assignment);
      }
      return createdList;
    });

    return {
      message: `Assigned shift to ${assignments.length} employee(s)`,
      assignments,
    };
  }

  // --- Holidays ---
  async listHolidays(companyId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();
    const startOfYear = new Date(Date.UTC(currentYear, 0, 1));
    const endOfYear = new Date(Date.UTC(currentYear, 11, 31));

    return prisma.holiday.findMany({
      where: {
        company_id: companyId,
        OR: [
          { is_recurring_annually: true },
          { date: { gte: startOfYear, lte: endOfYear } },
        ],
      },
      orderBy: { date: 'asc' },
    });
  }

  async createHoliday(
    companyId: string,
    data: {
      name: string;
      date: string;
      is_recurring_annually?: boolean;
    }
  ) {
    const dateUtc = this.parseDateToUtc(data.date);

    return prisma.holiday.create({
      data: {
        company_id: companyId,
        name: data.name.trim(),
        date: dateUtc,
        is_recurring_annually: data.is_recurring_annually || false,
      },
    });
  }

  async deleteHoliday(companyId: string, holidayId: string) {
    const holiday = await prisma.holiday.findFirst({
      where: { id: holidayId, company_id: companyId },
    });
    if (!holiday) {
      throw new AppError(404, 'NOT_FOUND', 'Holiday not found');
    }

    await prisma.holiday.delete({
      where: { id: holidayId },
    });

    return { message: 'Holiday deleted successfully' };
  }
}

export const shiftsService = new ShiftsService();
