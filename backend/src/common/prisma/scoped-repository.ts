import { Prisma } from '@prisma/client';
import prisma from './prisma.service';

/**
 * TenantScopedPrisma helper guarantees that all tenant-level operations
 * automatically inject the authenticated companyId into every query.
 */
export class TenantScopedPrisma {
  constructor(public readonly companyId: string) {
    if (!companyId) {
      throw new Error('TenantScopedPrisma requires a valid companyId');
    }
  }

  get raw() {
    return prisma;
  }

  // Employees
  get employees() {
    const companyId = this.companyId;
    return {
      findMany: (args: Prisma.EmployeeFindManyArgs = {}) =>
        prisma.employee.findMany({
          ...args,
          where: { ...(args.where || {}), company_id: companyId },
        }),
      findFirst: (args: Prisma.EmployeeFindFirstArgs = {}) =>
        prisma.employee.findFirst({
          ...args,
          where: { ...(args.where || {}), company_id: companyId },
        }),
      findUnique: (id: string, include?: Prisma.EmployeeInclude) =>
        prisma.employee.findFirst({
          where: { id, company_id: companyId },
          include,
        }),
      create: (data: Omit<Prisma.EmployeeUncheckedCreateInput, 'company_id'>) =>
        prisma.employee.create({
          data: {
            ...data,
            company_id: companyId,
          },
        }),
      update: (id: string, data: Prisma.EmployeeUpdateInput | Prisma.EmployeeUncheckedUpdateInput) =>
        prisma.employee.updateMany({
          where: { id, company_id: companyId },
          data,
        }),
      count: (args: Prisma.EmployeeCountArgs = {}) =>
        prisma.employee.count({
          ...args,
          where: { ...(args.where || {}), company_id: companyId },
        }),
    };
  }

  // Departments
  get departments() {
    const companyId = this.companyId;
    return {
      findMany: (args: Prisma.DepartmentFindManyArgs = {}) =>
        prisma.department.findMany({
          ...args,
          where: { ...(args.where || {}), company_id: companyId },
        }),
      findFirst: (args: Prisma.DepartmentFindFirstArgs = {}) =>
        prisma.department.findFirst({
          ...args,
          where: { ...(args.where || {}), company_id: companyId },
        }),
      create: (data: Omit<Prisma.DepartmentUncheckedCreateInput, 'company_id'>) =>
        prisma.department.create({
          data: { ...data, company_id: companyId },
        }),
    };
  }

  // Designations
  get designations() {
    const companyId = this.companyId;
    return {
      findMany: (args: Prisma.DesignationFindManyArgs = {}) =>
        prisma.designation.findMany({
          ...args,
          where: { ...(args.where || {}), company_id: companyId },
        }),
      create: (data: Omit<Prisma.DesignationUncheckedCreateInput, 'company_id'>) =>
        prisma.designation.create({
          data: { ...data, company_id: companyId },
        }),
    };
  }

  // Attendance
  get attendance() {
    const companyId = this.companyId;
    return {
      findMany: (args: Prisma.AttendanceFindManyArgs = {}) =>
        prisma.attendance.findMany({
          ...args,
          where: { ...(args.where || {}), company_id: companyId },
        }),
      findFirst: (args: Prisma.AttendanceFindFirstArgs = {}) =>
        prisma.attendance.findFirst({
          ...args,
          where: { ...(args.where || {}), company_id: companyId },
        }),
      create: (data: Omit<Prisma.AttendanceUncheckedCreateInput, 'company_id'>) =>
        prisma.attendance.create({
          data: { ...data, company_id: companyId },
        }),
    };
  }

  // Leave Types & Requests
  get leave() {
    const companyId = this.companyId;
    return {
      findTypes: (args: Prisma.LeaveTypeFindManyArgs = {}) =>
        prisma.leaveType.findMany({
          ...args,
          where: { ...(args.where || {}), company_id: companyId },
        }),
      createType: (data: Omit<Prisma.LeaveTypeUncheckedCreateInput, 'company_id'>) =>
        prisma.leaveType.create({
          data: { ...data, company_id: companyId },
        }),
      findRequests: (args: Prisma.LeaveRequestFindManyArgs = {}) =>
        prisma.leaveRequest.findMany({
          ...args,
          where: {
            ...(args.where || {}),
            employee: { company_id: companyId },
          },
        }),
    };
  }

  // Payroll Runs & Payslips
  get payroll() {
    const companyId = this.companyId;
    return {
      findRuns: (args: Prisma.PayrollRunFindManyArgs = {}) =>
        prisma.payrollRun.findMany({
          ...args,
          where: { ...(args.where || {}), company_id: companyId },
        }),
      findRun: (id: string, include?: Prisma.PayrollRunInclude) =>
        prisma.payrollRun.findFirst({
          where: { id, company_id: companyId },
          include,
        }),
      findPayslips: (args: Prisma.PayslipFindManyArgs = {}) =>
        prisma.payslip.findMany({
          ...args,
          where: {
            ...(args.where || {}),
            payroll_run: { company_id: companyId },
          },
        }),
      findPayslip: (id: string) =>
        prisma.payslip.findFirst({
          where: {
            id,
            payroll_run: { company_id: companyId },
          },
          include: {
            employee: true,
            payroll_run: true,
          },
        }),
    };
  }

  // Company Settings
  get settings() {
    const companyId = this.companyId;
    return {
      get: () =>
        prisma.companySettings.findUnique({
          where: { company_id: companyId },
        }),
      upsert: (
        data: Omit<Prisma.CompanySettingsUncheckedCreateInput, 'company_id'>
      ) =>
        prisma.companySettings.upsert({
          where: { company_id: companyId },
          create: { ...data, company_id: companyId },
          update: data,
        }),
    };
  }
}

export function getScopedPrisma(companyId: string): TenantScopedPrisma {
  return new TenantScopedPrisma(companyId);
}
