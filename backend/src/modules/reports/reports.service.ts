import prisma from '../../common/prisma/prisma.service';
import { AppError } from '../../common/middleware/error.middleware';

export class ReportsService {
  private formatCsvRow(fields: (string | number | boolean | null | undefined | { toString(): string })[]): string {
    return fields
      .map((val) => {
        if (val === null || val === undefined) return '""';
        let str = String(val);
        // SEC-05: Neutralize formula triggers in Excel/Calc: =, +, -, @, tab, CR
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(',');
  }

  async exportAttendanceCsv(companyId: string, month: number, year: number): Promise<{ csv: string; filename: string }> {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const records = await prisma.attendance.findMany({
      where: {
        company_id: companyId,
        date: { gte: startDate, lte: endDate },
      },
      include: {
        employee: {
          include: { department: true, designation: true },
        },
      },
      orderBy: [{ date: 'asc' }, { employee: { employee_code: 'asc' } }],
    });

    const headers = [
      'Employee Code',
      'Employee Name',
      'Department',
      'Designation',
      'Date',
      'Status',
      'Check In',
      'Check Out',
      'Worked Hours',
      'Overtime Hours',
      'Marked By',
    ];

    const rows = [this.formatCsvRow(headers)];

    for (const r of records) {
      rows.push(
        this.formatCsvRow([
          r.employee.employee_code,
          `${r.employee.first_name} ${r.employee.last_name}`,
          r.employee.department?.name || 'General',
          r.employee.designation?.name || 'Staff',
          new Date(r.date).toISOString().split('T')[0],
          r.status,
          r.check_in_time ? new Date(r.check_in_time).toISOString() : '',
          r.check_out_time ? new Date(r.check_out_time).toISOString() : '',
          r.worked_hours ?? 0,
          r.worked_hours > 8 ? r.worked_hours - 8 : 0,
          r.marked_by,
        ])
      );
    }

    return {
      csv: rows.join('\r\n'),
      filename: `Attendance-Report-${year}-${String(month).padStart(2, '0')}.csv`,
    };
  }

  async exportLeaveCsv(companyId: string, year: number): Promise<{ csv: string; filename: string }> {
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const records = await prisma.leaveRequest.findMany({
      where: {
        employee: { company_id: companyId },
        start_date: { gte: startDate, lte: endDate },
      },
      include: {
        employee: {
          include: { department: true },
        },
        leave_type: true,
        approver: { select: { email: true } },
      },
      orderBy: { applied_at: 'desc' },
    });

    const headers = [
      'Employee Code',
      'Employee Name',
      'Department',
      'Leave Type',
      'Paid Status',
      'Start Date',
      'End Date',
      'Total Days',
      'Status',
      'Reason',
      'Applied At',
      'Approver Email',
    ];

    const rows = [this.formatCsvRow(headers)];

    for (const r of records) {
      rows.push(
        this.formatCsvRow([
          r.employee.employee_code,
          `${r.employee.first_name} ${r.employee.last_name}`,
          r.employee.department?.name || 'General',
          r.leave_type.name,
          r.leave_type.is_paid ? 'Paid' : 'Unpaid',
          new Date(r.start_date).toISOString().split('T')[0],
          new Date(r.end_date).toISOString().split('T')[0],
          r.total_days,
          r.status,
          r.reason,
          new Date(r.applied_at).toISOString(),
          r.approver?.email || '',
        ])
      );
    }

    return {
      csv: rows.join('\r\n'),
      filename: `Leave-Report-${year}.csv`,
    };
  }

  async exportPayrollCsv(companyId: string, month: number, year: number): Promise<{ csv: string; filename: string }> {
    const run = await prisma.payrollRun.findUnique({
      where: {
        company_id_month_year: {
          company_id: companyId,
          month,
          year,
        },
      },
      include: {
        payslips: {
          include: {
            employee: {
              include: {
                department: true,
                designation: true,
                salary_structures: {
                  orderBy: { effective_from: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!run) {
      throw new AppError(404, 'NOT_FOUND', `No payroll run found for ${month}/${year}`);
    }

    const headers = [
      'Employee Code',
      'Employee Name',
      'Department',
      'Designation',
      'Pay Model',
      'Working Days',
      'Present Days',
      'Paid Leave Days',
      'Unpaid Leave Days',
      'Overtime Hours',
      'Overtime Amount ($)',
      'Gross Earnings ($)',
      'Total Deductions ($)',
      'Net Payable ($)',
      'Status',
    ];

    const rows = [this.formatCsvRow(headers)];

    for (const p of run.payslips) {
      const struct = p.employee.salary_structures[0];
      const deductions = (p.deductions_json as Record<string, number>) || {};
      const totalDed = Object.values(deductions).reduce((acc, v) => acc + (Number(v) || 0), 0);

      rows.push(
        this.formatCsvRow([
          p.employee.employee_code,
          `${p.employee.first_name} ${p.employee.last_name}`,
          p.employee.department?.name || 'General',
          p.employee.designation?.name || 'Staff',
          struct?.pay_type || 'monthly',
          p.working_days,
          p.present_days,
          p.paid_leave_days,
          p.unpaid_leave_days,
          p.overtime_hours,
          p.overtime_amount.toFixed(2),
          p.gross_amount.toFixed(2),
          totalDed.toFixed(2),
          p.net_amount.toFixed(2),
          p.status,
        ])
      );
    }

    return {
      csv: rows.join('\r\n'),
      filename: `Payroll-Report-${year}-${String(month).padStart(2, '0')}.csv`,
    };
  }
}

export const reportsService = new ReportsService();
