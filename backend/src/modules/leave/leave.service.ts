import {
  Prisma,
  TenantRole,
  LeaveStatus,
  AttendanceStatus,
  MarkedBy,
} from '@prisma/client';
import prisma from '../../common/prisma/prisma.service';
import { AppError } from '../../common/middleware/error.middleware';

export class LeaveService {
  private parseDateToUtc(dateStr: string | Date): Date {
    const d = new Date(dateStr);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  // --- Leave Types ---
  async listLeaveTypes(companyId: string) {
    return prisma.leaveType.findMany({
      where: { company_id: companyId },
      orderBy: { name: 'asc' },
    });
  }

  async createLeaveType(
    companyId: string,
    data: { name: string; is_paid: boolean; default_annual_quota: number }
  ) {
    const existing = await prisma.leaveType.findFirst({
      where: {
        company_id: companyId,
        name: { equals: data.name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new AppError(400, 'LEAVE_TYPE_EXISTS', 'Leave type with this name already exists');
    }

    const leaveType = await prisma.$transaction(async (tx) => {
      const created = await tx.leaveType.create({
        data: {
          company_id: companyId,
          name: data.name.trim(),
          is_paid: data.is_paid,
          default_annual_quota: data.default_annual_quota,
        },
      });

      // Initialize leave balances for all active company employees for current year
      const employees = await tx.employee.findMany({
        where: { company_id: companyId },
        select: { id: true },
      });

      const currentYear = new Date().getFullYear();
      for (const emp of employees) {
        await tx.leaveBalance.upsert({
          where: {
            employee_id_leave_type_id_year: {
              employee_id: emp.id,
              leave_type_id: created.id,
              year: currentYear,
            },
          },
          create: {
            company_id: companyId,
            employee_id: emp.id,
            leave_type_id: created.id,
            year: currentYear,
            allocated: new Prisma.Decimal(created.default_annual_quota),
            used: new Prisma.Decimal(0),
            remaining: new Prisma.Decimal(created.default_annual_quota),
          },
          update: {},
        });
      }

      return created;
    });

    return leaveType;
  }

  // --- Leave Balances ---
  async getEmployeeBalances(companyId: string, employeeId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();

    // Verify employee belongs to company
    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, company_id: companyId },
    });
    if (!emp) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found in your company');
    }

    // Auto-ensure balances exist for all company leave types
    const leaveTypes = await prisma.leaveType.findMany({
      where: { company_id: companyId },
    });

    for (const lt of leaveTypes) {
      await prisma.leaveBalance.upsert({
        where: {
          employee_id_leave_type_id_year: {
            employee_id: employeeId,
            leave_type_id: lt.id,
            year: currentYear,
          },
        },
        create: {
          company_id: companyId,
          employee_id: employeeId,
          leave_type_id: lt.id,
          year: currentYear,
          allocated: new Prisma.Decimal(lt.default_annual_quota),
          used: new Prisma.Decimal(0),
          remaining: new Prisma.Decimal(lt.default_annual_quota),
        },
        update: {},
      });
    }

    return prisma.leaveBalance.findMany({
      where: {
        company_id: companyId,
        employee_id: employeeId,
        year: currentYear,
      },
      include: {
        leave_type: true,
      },
      orderBy: { leave_type: { name: 'asc' } },
    });
  }

  // --- Apply Leave ---
  async applyLeave(
    companyId: string,
    employeeId: string,
    data: {
      leave_type_id: string;
      start_date: string;
      end_date: string;
      is_half_day?: boolean;
      reason: string;
    }
  ) {
    const startDateUtc = this.parseDateToUtc(data.start_date);
    const endDateUtc = this.parseDateToUtc(data.end_date);

    if (startDateUtc > endDateUtc) {
      throw new AppError(400, 'INVALID_DATES', 'End date cannot be earlier than start date');
    }

    let totalDays: Prisma.Decimal;
    if (data.is_half_day) {
      const startStr = data.start_date.split('T')[0];
      const endStr = data.end_date.split('T')[0];
      if (startStr !== endStr) {
        throw new AppError(400, 'HALF_DAY_SAME_DATE', 'Half-day leaves must start and end on the same date');
      }
      totalDays = new Prisma.Decimal(0.5);
    } else {
      const diffMs = endDateUtc.getTime() - startDateUtc.getTime();
      const numDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
      totalDays = new Prisma.Decimal(numDays);
    }

    // Verify leave type
    const leaveType = await prisma.leaveType.findFirst({
      where: { id: data.leave_type_id, company_id: companyId },
    });
    if (!leaveType) {
      throw new AppError(404, 'NOT_FOUND', 'Leave type not found');
    }

    // Quota Verification
    if (leaveType.is_paid) {
      const currentYear = startDateUtc.getUTCFullYear();
      const balance = await prisma.leaveBalance.findUnique({
        where: {
          employee_id_leave_type_id_year: {
            employee_id: employeeId,
            leave_type_id: leaveType.id,
            year: currentYear,
          },
        },
      });

      const remaining = balance
        ? new Prisma.Decimal(balance.remaining)
        : new Prisma.Decimal(leaveType.default_annual_quota);

      if (remaining.lessThan(totalDays)) {
        throw new AppError(
          400,
          'INSUFFICIENT_LEAVE_BALANCE',
          `Insufficient ${leaveType.name} balance. Available: ${remaining} day(s), Requested: ${totalDays} day(s). Apply for Unpaid Leave for extra days.`
        );
      }
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, company_id: companyId },
      include: { manager: { include: { user: true } } },
    });
    if (!employee) {
      throw new AppError(404, 'NOT_FOUND', 'Employee profile not found in your company');
    }
    if (employee.status !== 'active') {
      throw new AppError(403, 'EMPLOYEE_INACTIVE', `Cannot apply for leave for a ${employee.status} employee`);
    }

    // Check for overlapping active (pending or approved) leave requests
    const overlappingRequest = await prisma.leaveRequest.findFirst({
      where: {
        company_id: companyId,
        employee_id: employeeId,
        status: { in: [LeaveStatus.pending, LeaveStatus.approved] },
        start_date: { lte: endDateUtc },
        end_date: { gte: startDateUtc },
      },
    });

    if (overlappingRequest) {
      throw new AppError(
        400,
        'LEAVE_OVERLAP',
        'You already have an active leave request covering these dates'
      );
    }

    const request = await prisma.leaveRequest.create({
      data: {
        company_id: companyId,
        employee_id: employeeId,
        leave_type_id: data.leave_type_id,
        start_date: startDateUtc,
        end_date: endDateUtc,
        total_days: totalDays,
        is_half_day: Boolean(data.is_half_day),
        reason: data.reason.trim(),
        status: LeaveStatus.pending,
      },
      include: {
        leave_type: true,
        employee: true,
      },
    });

    // Notify manager if manager has a user account
    if (employee?.manager?.user) {
      await prisma.notification.create({
        data: {
          company_id: companyId,
          user_id: employee.manager.user.id,
          type: 'LEAVE_REQUEST',
          title: 'New Leave Request',
          message: `${employee.first_name} ${employee.last_name} applied for ${totalDays} day(s) of ${leaveType.name}.`,
        },
      });
    }

    return request;
  }

  // --- Cancel Leave Request (Self-cancel pending, or admin/manager cancel) ---
  async cancelLeaveRequest(
    companyId: string,
    caller: { userId: string; role: TenantRole; employeeId?: string | null },
    requestId: string
  ) {
    const leaveReq = await prisma.leaveRequest.findFirst({
      where: { id: requestId, company_id: companyId },
      include: { employee: true, leave_type: true },
    });

    if (!leaveReq) {
      throw new AppError(404, 'NOT_FOUND', 'Leave request not found');
    }

    // Regular employee can only cancel their own pending request
    if (caller.role === TenantRole.employee) {
      if (leaveReq.employee_id !== caller.employeeId) {
        throw new AppError(403, 'FORBIDDEN', 'Cannot cancel another employee’s leave request');
      }
      if (leaveReq.status !== LeaveStatus.pending) {
        throw new AppError(400, 'CANNOT_CANCEL', `Cannot cancel a leave request that is already ${leaveReq.status}`);
      }
    }

    return prisma.$transaction(async (tx) => {
      // If was approved, refund quota and clean up auto-generated attendance records
      if (leaveReq.status === LeaveStatus.approved) {
        if (leaveReq.leave_type.is_paid) {
          const year = new Date(leaveReq.start_date).getUTCFullYear();
          const balance = await tx.leaveBalance.findUnique({
            where: {
              employee_id_leave_type_id_year: {
                employee_id: leaveReq.employee_id,
                leave_type_id: leaveReq.leave_type_id,
                year,
              },
            },
          });
          if (balance) {
            const reqDays = new Prisma.Decimal(leaveReq.total_days);
            const newUsed = Prisma.Decimal.max(new Prisma.Decimal(0), Prisma.Decimal.sub(balance.used, reqDays));
            const newRemaining = Prisma.Decimal.add(balance.remaining, reqDays);

            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: {
                used: newUsed,
                remaining: newRemaining,
              },
            });
          }
        }

        // Remove auto-generated attendance records for this approved leave period
        const startUtc = this.parseDateToUtc(leaveReq.start_date);
        const endUtc = this.parseDateToUtc(leaveReq.end_date);
        await tx.attendance.deleteMany({
          where: {
            employee_id: leaveReq.employee_id,
            company_id: companyId,
            date: { gte: startUtc, lte: endUtc },
            status: { in: [AttendanceStatus.on_leave, AttendanceStatus.half_day] },
            check_in_time: null,
          },
        });
      }

      return tx.leaveRequest.update({
        where: { id: requestId },
        data: { status: LeaveStatus.rejected },
      });
    });
  }

  // --- Review Leave Request (Approve / Reject) ---
  async reviewLeaveRequest(
    companyId: string,
    approver: {
      userId: string;
      role: TenantRole;
      employeeId?: string | null;
    },
    requestId: string,
    action: 'approve' | 'reject'
  ) {
    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: { id: requestId, company_id: companyId },
      include: {
        employee: {
          include: { user: true },
        },
        leave_type: true,
      },
    });

    if (!leaveRequest) {
      throw new AppError(404, 'NOT_FOUND', 'Leave request not found');
    }

    if (leaveRequest.status !== LeaveStatus.pending) {
      throw new AppError(400, 'ALREADY_REVIEWED', `Leave request has already been ${leaveRequest.status}`);
    }

    // Role Approval Permissions Matrix
    if (approver.role === TenantRole.manager) {
      if (!approver.employeeId || leaveRequest.employee.manager_id !== approver.employeeId) {
        throw new AppError(403, 'FORBIDDEN', 'Managers can only approve leave for their direct reports');
      }
    } else if (approver.role !== TenantRole.company_admin) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions to review leave requests');
    }

    const nextStatus = action === 'approve' ? LeaveStatus.approved : LeaveStatus.rejected;

    const result = await prisma.$transaction(async (tx) => {
      // 1. If approved and leave type is paid, atomically deduct leave balance
      if (nextStatus === LeaveStatus.approved && leaveRequest.leave_type.is_paid) {
        const year = new Date(leaveRequest.start_date).getUTCFullYear();
        let balance = await tx.leaveBalance.findUnique({
          where: {
            employee_id_leave_type_id_year: {
              employee_id: leaveRequest.employee_id,
              leave_type_id: leaveRequest.leave_type_id,
              year,
            },
          },
        });

        // Auto-initialize balance record if employee has not yet initialized it
        if (!balance) {
          balance = await tx.leaveBalance.create({
            data: {
              company_id: companyId,
              employee_id: leaveRequest.employee_id,
              leave_type_id: leaveRequest.leave_type_id,
              year,
              allocated: new Prisma.Decimal(leaveRequest.leave_type.default_annual_quota),
              used: new Prisma.Decimal(0),
              remaining: new Prisma.Decimal(leaveRequest.leave_type.default_annual_quota),
            },
          });
        }

        const reqDays = new Prisma.Decimal(leaveRequest.total_days);
        if (new Prisma.Decimal(balance.remaining).lessThan(reqDays)) {
          throw new AppError(
            400,
            'INSUFFICIENT_BALANCE_ON_APPROVAL',
            'Employee has insufficient remaining leave balance to approve this request'
          );
        }

        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            used: Prisma.Decimal.add(balance.used, reqDays),
            remaining: Prisma.Decimal.sub(balance.remaining, reqDays),
          },
        });

        // 2. Mark attendance days as 'on_leave' or 'half_day'
        const attStatus = leaveRequest.is_half_day
          ? AttendanceStatus.half_day
          : AttendanceStatus.on_leave;

        let current = new Date(leaveRequest.start_date);
        const end = new Date(leaveRequest.end_date);
        while (current <= end) {
          const dateUtc = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate()));
          await tx.attendance.upsert({
            where: {
              employee_id_date: {
                employee_id: leaveRequest.employee_id,
                date: dateUtc,
              },
            },
            create: {
              company_id: companyId,
              employee_id: leaveRequest.employee_id,
              date: dateUtc,
              status: attStatus,
              worked_hours: leaveRequest.is_half_day ? 4 : 0,
              marked_by: MarkedBy.admin,
            },
            update: {
              status: attStatus,
              worked_hours: leaveRequest.is_half_day ? 4 : 0,
            },
          });
          current.setDate(current.getDate() + 1);
        }
      }

      // 3. Update Leave Request
      const updated = await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: nextStatus,
          approved_by: approver.userId,
          approved_at: new Date(),
        },
        include: {
          leave_type: true,
          employee: true,
        },
      });

      // 4. In-App Notification to Employee
      if (leaveRequest.employee.user) {
        await tx.notification.create({
          data: {
            company_id: companyId,
            user_id: leaveRequest.employee.user.id,
            type: 'LEAVE_DECISION',
            title: `Leave Request ${nextStatus.toUpperCase()}`,
            message: `Your ${leaveRequest.total_days}-day leave request (${leaveRequest.leave_type.name}) was ${nextStatus}.`,
          },
        });
      }

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          company_id: companyId,
          user_id: approver.userId,
          action: `LEAVE_REQUEST_${nextStatus.toUpperCase()}`,
          entity_type: 'leave_request',
          entity_id: requestId,
          new_value_json: {
            employeeId: leaveRequest.employee_id,
            status: nextStatus,
            totalDays: leaveRequest.total_days,
          },
        },
      });

      return updated;
    });

    return result;
  }

  // --- List Leave Requests ---
  async listLeaveRequests(
    companyId: string,
    viewer: {
      userId: string;
      role: TenantRole;
      employeeId?: string | null;
    },
    params: {
      status?: LeaveStatus;
      employee_id?: string;
    } = {}
  ) {
    const where: Prisma.LeaveRequestWhereInput = {
      company_id: companyId,
    };

    if (viewer.role === TenantRole.employee) {
      if (!viewer.employeeId) {
        throw new AppError(403, 'FORBIDDEN', 'No linked employee profile');
      }
      where.employee_id = viewer.employeeId;
    } else if (viewer.role === TenantRole.manager) {
      if (!viewer.employeeId) {
        throw new AppError(403, 'FORBIDDEN', 'No linked employee profile');
      }
      where.employee = {
        company_id: companyId,
        OR: [
          { id: viewer.employeeId }, // Manager self
          { manager_id: viewer.employeeId }, // Direct reports
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
    }

    if (params.status) {
      where.status = params.status;
    }

    return prisma.leaveRequest.findMany({
      where,
      orderBy: { applied_at: 'desc' },
      include: {
        leave_type: true,
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
        approver: {
          select: { id: true, email: true },
        },
      },
    });
  }

  // --- Phase 10: Manager Subordinates View ---
  async getSubordinatesLeave(companyId: string, role: TenantRole, managerEmployeeId?: string | null) {
    const currentYear = new Date().getFullYear();
    const where: Prisma.EmployeeWhereInput = {
      company_id: companyId,
      status: 'active',
    };

    if (role === TenantRole.manager) {
      if (!managerEmployeeId) {
        throw new AppError(400, 'NO_EMPLOYEE_PROFILE', 'No employee profile linked to manager');
      }
      where.manager_id = managerEmployeeId;
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        department: true,
        designation: true,
        leave_balances: {
          where: { year: currentYear },
          include: { leave_type: true },
        },
        leave_requests: {
          where: { status: LeaveStatus.pending },
          include: { leave_type: true },
          orderBy: { applied_at: 'desc' },
        },
      },
      orderBy: { first_name: 'asc' },
    });

    return employees.map((emp) => ({
      id: emp.id,
      employee_code: emp.employee_code,
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      department: emp.department?.name,
      designation: emp.designation?.name,
      balances: emp.leave_balances.map((b) => ({
        leave_type: b.leave_type.name,
        is_paid: b.leave_type.is_paid,
        allocated: Number(b.allocated),
        used: Number(b.used),
        remaining: Number(b.remaining),
      })),
      pending_requests_count: emp.leave_requests.length,
      pending_requests: emp.leave_requests,
    }));
  }

  // --- Phase 10: Leave Bank Carry-Forward (Admin Only) ---
  async carryForwardLeaves(companyId: string, fromYear: number) {
    const toYear = fromYear + 1;
    const employees = await prisma.employee.findMany({
      where: { company_id: companyId, status: 'active' },
    });

    let processedCount = 0;
    for (const emp of employees) {
      const balances = await prisma.leaveBalance.findMany({
        where: {
          company_id: companyId,
          employee_id: emp.id,
          year: fromYear,
          leave_type: { is_paid: true },
        },
      });

      let totalRemaining = new Prisma.Decimal(0);
      for (const b of balances) {
        const rem = new Prisma.Decimal(b.remaining);
        if (rem.greaterThan(0)) {
          totalRemaining = Prisma.Decimal.add(totalRemaining, rem);
        }
      }

      await prisma.leaveBank.upsert({
        where: {
          employee_id_year: {
            employee_id: emp.id,
            year: toYear,
          },
        },
        create: {
          company_id: companyId,
          employee_id: emp.id,
          year: toYear,
          banked_days: totalRemaining,
          encashed_days: new Prisma.Decimal(0),
          encashed_amount: new Prisma.Decimal(0),
        },
        update: {
          banked_days: totalRemaining,
        },
      });
      processedCount++;
    }

    return {
      message: `Leave carry-forward from ${fromYear} to ${toYear} completed successfully`,
      processedCount,
    };
  }

  // --- Phase 10: Leave Bank Encashment (Admin Only) ---
  async encashLeave(
    companyId: string,
    data: { employee_id: string; year: number; days_to_encash: number }
  ) {
    const daysToEncash = new Prisma.Decimal(data.days_to_encash);
    if (daysToEncash.lessThanOrEqualTo(0)) {
      throw new AppError(400, 'INVALID_DAYS', 'Days to encash must be greater than zero');
    }

    const emp = await prisma.employee.findFirst({
      where: { id: data.employee_id, company_id: companyId },
    });
    if (!emp) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found in your company');
    }

    const bank = await prisma.leaveBank.findUnique({
      where: {
        employee_id_year: {
          employee_id: data.employee_id,
          year: data.year,
        },
      },
    });
    if (!bank) {
      throw new AppError(404, 'NO_LEAVE_BANK', `No leave bank record found for employee in year ${data.year}`);
    }

    const availableDays = Prisma.Decimal.sub(bank.banked_days, bank.encashed_days);
    if (daysToEncash.greaterThan(availableDays)) {
      throw new AppError(
        400,
        'INSUFFICIENT_BANKED_DAYS',
        `Insufficient banked days. Available to encash: ${availableDays}, Requested: ${daysToEncash}`
      );
    }

    const salaryStruct = await prisma.salaryStructure.findFirst({
      where: { employee_id: data.employee_id, company_id: companyId },
      orderBy: { effective_from: 'desc' },
    });

    if (!salaryStruct) {
      throw new AppError(400, 'NO_SALARY_STRUCTURE', 'Employee has no active salary structure to calculate daily rate');
    }

    // Daily rate = base_amount / 30
    const dailyRate = Prisma.Decimal.div(salaryStruct.base_amount, new Prisma.Decimal(30));
    const encashAmount = Prisma.Decimal.mul(daysToEncash, dailyRate).toDecimalPlaces(2);

    const updated = await prisma.leaveBank.update({
      where: { id: bank.id },
      data: {
        encashed_days: Prisma.Decimal.add(bank.encashed_days, daysToEncash),
        encashed_amount: Prisma.Decimal.add(bank.encashed_amount, encashAmount),
      },
    });

    return {
      leave_bank: updated,
      encashed_days_added: Number(daysToEncash),
      encash_amount_added: Number(encashAmount),
    };
  }

  // --- Phase 10: Get Leave Bank Records ---
  async getLeaveBank(
    companyId: string,
    role: TenantRole,
    callerEmployeeId: string | null,
    targetEmployeeId?: string
  ) {
    const where: Prisma.LeaveBankWhereInput = { company_id: companyId };

    if (role === TenantRole.employee) {
      if (!callerEmployeeId) throw new AppError(400, 'NO_EMPLOYEE_PROFILE', 'No employee profile linked');
      where.employee_id = callerEmployeeId;
    } else if (role === TenantRole.manager) {
      if (targetEmployeeId) {
        if (targetEmployeeId !== callerEmployeeId) {
          const isSub = await prisma.employee.findFirst({
            where: { id: targetEmployeeId, company_id: companyId, manager_id: callerEmployeeId },
          });
          if (!isSub) throw new AppError(403, 'FORBIDDEN', 'Managers can only view leave bank of direct reports');
        }
        where.employee_id = targetEmployeeId;
      } else {
        where.OR = [
          { employee_id: callerEmployeeId || '' },
          { employee: { manager_id: callerEmployeeId || '' } },
        ];
      }
    } else if (targetEmployeeId) {
      where.employee_id = targetEmployeeId;
    }

    return prisma.leaveBank.findMany({
      where,
      include: {
        employee: {
          select: { id: true, employee_code: true, first_name: true, last_name: true },
        },
      },
      orderBy: [{ year: 'desc' }, { employee: { first_name: 'asc' } }],
    });
  }
}

export const leaveService = new LeaveService();
