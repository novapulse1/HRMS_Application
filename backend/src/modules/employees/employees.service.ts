import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  Prisma,
  TenantRole,
  EmploymentType,
  EmployeeStatus,
  PayType,
} from '@prisma/client';
import prisma from '../../common/prisma/prisma.service';
import { AppError } from '../../common/middleware/error.middleware';

export class EmployeesService {
  // --- Departments ---
  async listDepartments(companyId: string) {
    return prisma.department.findMany({
      where: { company_id: companyId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            employees: true,
            designations: true,
          },
        },
      },
    });
  }

  async createDepartment(companyId: string, name: string) {
    const existing = await prisma.department.findFirst({
      where: { company_id: companyId, name: { equals: name.trim(), mode: 'insensitive' } },
    });
    if (existing) {
      throw new AppError(400, 'DEPARTMENT_EXISTS', 'A department with this name already exists');
    }

    return prisma.department.create({
      data: {
        company_id: companyId,
        name: name.trim(),
      },
    });
  }

  // --- Designations ---
  async listDesignations(companyId: string, departmentId?: string) {
    return prisma.designation.findMany({
      where: {
        company_id: companyId,
        department_id: departmentId || undefined,
      },
      orderBy: { name: 'asc' },
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
    });
  }

  async createDesignation(companyId: string, data: { name: string; department_id?: string }) {
    if (data.department_id) {
      const dept = await prisma.department.findFirst({
        where: { id: data.department_id, company_id: companyId },
      });
      if (!dept) {
        throw new AppError(404, 'NOT_FOUND', 'Department not found in your company');
      }
    }

    return prisma.designation.create({
      data: {
        company_id: companyId,
        name: data.name.trim(),
        department_id: data.department_id || null,
      },
    });
  }

  // --- Employee Code Generator ---
  async getNextEmployeeCode(companyId: string): Promise<string> {
    return this.generateNextEmployeeCode(companyId);
  }

  private async generateNextEmployeeCode(companyId: string): Promise<string> {
    const lastEmployee = await prisma.employee.findFirst({
      where: { company_id: companyId },
      orderBy: { created_at: 'desc' },
      select: { employee_code: true },
    });

    if (!lastEmployee || !lastEmployee.employee_code) {
      return 'EMP-001';
    }

    const match = lastEmployee.employee_code.match(/(\d+)$/);
    if (!match) {
      return 'EMP-001';
    }

    const nextNumber = parseInt(match[1], 10) + 1;
    return `EMP-${nextNumber.toString().padStart(3, '0')}`;
  }

  // --- Employees CRUD ---
  async listEmployees(
    companyId: string,
    viewerRole: TenantRole,
    viewerEmployeeId?: string | null,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      department_id?: string;
      status?: EmployeeStatus;
      manager_id?: string;
    } = {}
  ) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const andConditions: Prisma.EmployeeWhereInput[] = [
      { company_id: companyId },
    ];

    // Employee Visibility Scope: sees nobody but self
    if (viewerRole === TenantRole.employee) {
      if (!viewerEmployeeId) {
        throw new AppError(403, 'FORBIDDEN', 'Employee record not linked to an employee profile');
      }
      andConditions.push({ id: viewerEmployeeId });
    } else if (viewerRole === TenantRole.manager) {
      // Manager Visibility Scope: direct reports only (manager_id match or self)
      if (!viewerEmployeeId) {
        throw new AppError(403, 'FORBIDDEN', 'Manager record not linked to an employee profile');
      }
      andConditions.push({
        OR: [
          { id: viewerEmployeeId }, // Self
          { manager_id: viewerEmployeeId }, // Direct reports
        ],
      });
    } else if (params.manager_id) {
      andConditions.push({ manager_id: params.manager_id });
    }

    if (params.search) {
      andConditions.push({
        OR: [
          { first_name: { contains: params.search, mode: 'insensitive' } },
          { last_name: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
          { employee_code: { contains: params.search, mode: 'insensitive' } },
        ],
      });
    }

    if (params.department_id) {
      andConditions.push({ department_id: params.department_id });
    }

    if (params.status) {
      andConditions.push({ status: params.status });
    }

    const where: Prisma.EmployeeWhereInput = {
      AND: andConditions,
    };

    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
          manager: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              employee_code: true,
            },
          },
          salary_structures: {
            orderBy: { effective_from: 'desc' },
            take: 1,
            select: {
              id: true,
              pay_type: true,
              base_amount: true,
              effective_from: true,
            },
          },
          shifts: {
            include: { shift: true },
            orderBy: { effective_from: 'desc' },
            take: 1,
          },
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              is_active: true,
              must_change_password: true,
              last_login_at: true,
            },
          },
        },
      }),
    ]);

    // Redact salary structure for non-admin viewers unless viewing own record
    const sanitizedEmployees = employees.map((emp) => {
      if (viewerRole !== TenantRole.company_admin && emp.id !== viewerEmployeeId) {
        return {
          ...emp,
          salary_structures: [],
        };
      }
      return emp;
    });

    return {
      employees: sanitizedEmployees,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getEmployeeById(
    companyId: string,
    employeeId: string,
    requester?: { role: TenantRole; employeeId?: string | null }
  ) {
    // SEC-01: Ownership and RBAC checks
    if (requester) {
      if (requester.role === TenantRole.employee && requester.employeeId !== employeeId) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied to this employee profile');
      }
    }

    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        company_id: companyId,
      },
      include: {
        department: true,
        designation: true,
        manager: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            employee_code: true,
            email: true,
          },
        },
        subordinates: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            employee_code: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            is_active: true,
            must_change_password: true,
            last_login_at: true,
          },
        },
        salary_structures: {
          orderBy: { effective_from: 'desc' },
          take: 1,
        },
        shifts: {
          include: { shift: true },
          orderBy: { effective_from: 'desc' },
          take: 1,
        },
        leave_balances: {
          where: { year: new Date().getFullYear() },
          include: { leave_type: true },
        },
      },
    });

    if (!employee) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found in this company');
    }

    // Manager role check: only self or direct reports
    if (requester && requester.role === TenantRole.manager) {
      if (requester.employeeId !== employeeId && employee.manager_id !== requester.employeeId) {
        throw new AppError(403, 'FORBIDDEN', 'Managers can only view their direct reports');
      }
    }

    // SEC-01: Redact sensitive financial data unless company_admin or employee viewing own profile
    if (requester && requester.role !== TenantRole.company_admin) {
      const isSelf = requester.employeeId === employeeId;
      if (requester.role === TenantRole.employee && isSelf) {
        // Employee views own profile: sees own bank details, but hide admin salary structures
        (employee as any).salary_structures = [];
      } else {
        // Manager viewing reports or self, or other non-admin roles: bank and salary are fully redacted
        (employee as any).bank_account_number = null;
        (employee as any).bank_ifsc = null;
        (employee as any).bank_name = null;
        (employee as any).salary_structures = [];
      }
    }

    return employee;
  }

  async createEmployee(
    companyId: string,
    data: {
      employee_code?: string;
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
      department_id?: string;
      designation_id?: string;
      manager_id?: string;
      date_of_joining?: string | Date;
      employment_type?: EmploymentType;
      bank_name?: string;
      bank_account_number?: string;
      bank_ifsc?: string;
      address?: string;
      pay_type?: PayType;
      base_amount?: number;
      effective_from?: string | Date;
    }
  ) {
    const cleanEmail = data.email.toLowerCase().trim();

    // Verify department and designation belong to the company
    if (data.department_id) {
      const dept = await prisma.department.findFirst({
        where: { id: data.department_id, company_id: companyId },
      });
      if (!dept) {
        throw new AppError(404, 'NOT_FOUND', 'Department not found in your company');
      }
    }

    if (data.designation_id) {
      const desig = await prisma.designation.findFirst({
        where: { id: data.designation_id, company_id: companyId },
      });
      if (!desig) {
        throw new AppError(404, 'NOT_FOUND', 'Designation not found in your company');
      }
    }

    if (data.manager_id) {
      const mgr = await prisma.employee.findFirst({
        where: { id: data.manager_id, company_id: companyId },
      });
      if (!mgr) {
        throw new AppError(404, 'NOT_FOUND', 'Assigned manager not found in your company');
      }
    }

    // Check custom employee code or auto-generate
    let finalEmployeeCode = data.employee_code?.trim().toUpperCase();
    if (finalEmployeeCode) {
      const existing = await prisma.employee.findFirst({
        where: { company_id: companyId, employee_code: finalEmployeeCode },
      });
      if (existing) {
        throw new AppError(
          409,
          'DUPLICATE_EMPLOYEE_CODE',
          `Employee ID "${finalEmployeeCode}" is already in use in your organization`
        );
      }
    } else {
      finalEmployeeCode = await this.generateNextEmployeeCode(companyId);
    }

    const joiningDate = data.date_of_joining ? new Date(data.date_of_joining) : new Date();

    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          company_id: companyId,
          employee_code: finalEmployeeCode,
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          email: cleanEmail,
          phone: data.phone,
          department_id: data.department_id || null,
          designation_id: data.designation_id || null,
          manager_id: data.manager_id || null,
          date_of_joining: joiningDate,
          employment_type: data.employment_type || EmploymentType.full_time,
          status: EmployeeStatus.active,
          bank_name: data.bank_name,
          bank_account_number: data.bank_account_number,
          bank_ifsc: data.bank_ifsc,
          address: data.address,
        },
      });

      // Auto-initialize leave balances for the current year based on company leave types
      const leaveTypes = await tx.leaveType.findMany({
        where: { company_id: companyId },
      });

      const currentYear = new Date().getFullYear();
      for (const lt of leaveTypes) {
        await tx.leaveBalance.create({
          data: {
            company_id: companyId,
            employee_id: created.id,
            leave_type_id: lt.id,
            year: currentYear,
            allocated: lt.default_annual_quota,
            used: 0,
            remaining: lt.default_annual_quota,
          },
        });
      }

      // If salary rate provided, automatically setup SalaryStructure for payroll
      if (data.base_amount && Number(data.base_amount) > 0) {
        const effectiveFrom = data.effective_from ? new Date(data.effective_from) : joiningDate;
        await tx.salaryStructure.create({
          data: {
            company_id: companyId,
            employee_id: created.id,
            pay_type: data.pay_type || PayType.monthly,
            base_amount: Number(data.base_amount),
            effective_from: effectiveFrom,
          },
        });
      }

      return created;
    });

    return employee;
  }

  async updateEmployee(
    companyId: string,
    employeeId: string,
    data: {
      first_name?: string;
      last_name?: string;
      phone?: string;
      department_id?: string | null;
      designation_id?: string | null;
      manager_id?: string | null;
      employment_type?: EmploymentType;
      status?: EmployeeStatus;
      bank_name?: string;
      bank_account_number?: string;
      bank_ifsc?: string;
      address?: string;
    }
  ) {
    const existing = await prisma.employee.findFirst({
      where: { id: employeeId, company_id: companyId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found in your company');
    }

    if (data.manager_id && data.manager_id === employeeId) {
      throw new AppError(400, 'INVALID_HIERARCHY', 'An employee cannot be their own manager');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: {
          ...data,
        },
      });

      if (data.status && existing.user_id) {
        const isUserActive = data.status === EmployeeStatus.active;
        await tx.user.update({
          where: { id: existing.user_id },
          data: { is_active: isUserActive },
        });
      }

      return updated;
    });
  }

  async deactivateEmployee(companyId: string, employeeId: string) {
    const existing = await prisma.employee.findFirst({
      where: { id: employeeId, company_id: companyId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found in your company');
    }

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: { status: EmployeeStatus.inactive },
      });

      // Deactivate user login account if linked
      if (existing.user_id) {
        await tx.user.update({
          where: { id: existing.user_id },
          data: { is_active: false },
        });
      }
    });

    return { message: 'Employee successfully deactivated' };
  }

  async inviteEmployee(
    companyId: string,
    employeeId: string,
    role: TenantRole = TenantRole.employee
  ) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, company_id: companyId },
    });

    if (!employee) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found in your company');
    }

    const temporaryPassword = crypto.randomBytes(10).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findFirst({
        where: { employee_id: employee.id },
      });

      if (user) {
        // Reset existing user credentials
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            password_hash: passwordHash,
            role: user.role === TenantRole.company_admin ? user.role : (role || user.role),
            must_change_password: process.env.NODE_ENV === 'production',
            is_active: true,
          },
        });
      } else {
        // Verify email isn't globally taken
        const emailTaken = await tx.user.findUnique({
          where: { email: employee.email },
        });
        if (emailTaken) {
          throw new AppError(400, 'EMAIL_EXISTS', `Email ${employee.email} is already linked to a user account`);
        }

        user = await tx.user.create({
          data: {
            company_id: companyId,
            employee_id: employee.id,
            email: employee.email,
            password_hash: passwordHash,
            role,
            must_change_password: true,
            is_active: true,
          },
        });

        await tx.employee.update({
          where: { id: employee.id },
          data: { user_id: user.id },
        });
      }

      return {
        email: user.email,
        temporaryPassword,
        role: user.role,
        mustChangePassword: true,
      };
    });

    return result;
  }

  async getDirectoryAnalytics(companyId: string) {
    const [
      totalEmployees,
      statusCounts,
      deptCounts,
      employmentTypeCounts,
      allEmployees,
    ] = await Promise.all([
      prisma.employee.count({ where: { company_id: companyId } }),
      prisma.employee.groupBy({
        by: ['status'],
        where: { company_id: companyId },
        _count: { id: true },
      }),
      prisma.department.findMany({
        where: { company_id: companyId },
        select: {
          id: true,
          name: true,
          _count: { select: { employees: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.employee.groupBy({
        by: ['employment_type'],
        where: { company_id: companyId },
        _count: { id: true },
      }),
      prisma.employee.findMany({
        where: { company_id: companyId },
        select: { date_of_joining: true },
        orderBy: { date_of_joining: 'asc' },
      }),
    ]);

    const byStatus: Record<string, number> = {
      active: 0,
      inactive: 0,
      terminated: 0,
    };
    for (const s of statusCounts) {
      byStatus[s.status] = s._count.id;
    }

    const byType: Record<string, number> = {
      full_time: 0,
      part_time: 0,
      hourly: 0,
      contract: 0,
    };
    for (const t of employmentTypeCounts) {
      byType[t.employment_type] = t._count.id;
    }

    const departments = deptCounts.map((d) => ({
      id: d.id,
      name: d.name,
      count: d._count.employees,
    }));

    // Calculate monthly hiring trend for the last 6 months
    const monthsTrend: Array<{ month: string; hires: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const nextD = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
      const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });

      const hires = allEmployees.filter((emp) => {
        const joinDate = new Date(emp.date_of_joining);
        return joinDate >= d && joinDate < nextD;
      }).length;

      monthsTrend.push({ month: label, hires });
    }

    return {
      totalEmployees,
      byStatus,
      byType,
      departments,
      hiringTrend: monthsTrend,
    };
  }
}

export const employeesService = new EmployeesService();
