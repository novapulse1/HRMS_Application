import {
  PayType,
  PayrollRunStatus,
  PayslipStatus,
  TenantRole,
  PayrollApprovalStatus,
  LoanStatus,
  TaxRegime,
} from '@prisma/client';
import prisma from '../../common/prisma/prisma.service';
import { AppError } from '../../common/middleware/error.middleware';
import { calculateEmployeePayroll, computeAnnualTds } from './payroll-calculator';
import { generatePayslipPdfBuffer } from './payslip-pdf.service';
import { generateForm16PdfBuffer } from './form16-pdf.service';

export class PayrollService {
  // --- Salary Structures ---
  async setSalaryStructure(
    companyId: string,
    employeeId: string,
    data: {
      pay_type: PayType;
      base_amount: number;
      effective_from?: string | Date;
    }
  ) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, company_id: companyId },
    });

    if (!employee) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found in company');
    }

    if (data.base_amount <= 0) {
      throw new AppError(400, 'INVALID_AMOUNT', 'Base salary amount must be greater than zero');
    }

    const effectiveFrom = data.effective_from ? new Date(data.effective_from) : new Date();

    // Close any previous active structure
    await prisma.salaryStructure.updateMany({
      where: {
        employee_id: employeeId,
        company_id: companyId,
        effective_to: null,
      },
      data: {
        effective_to: effectiveFrom,
      },
    });

    const structure = await prisma.salaryStructure.create({
      data: {
        company_id: companyId,
        employee_id: employeeId,
        pay_type: data.pay_type,
        base_amount: data.base_amount,
        effective_from: effectiveFrom,
      },
    });

    return structure;
  }

  async getSalaryStructure(companyId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, company_id: companyId },
    });

    if (!employee) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found in company');
    }

    const structure = await prisma.salaryStructure.findFirst({
      where: { employee_id: employeeId, company_id: companyId },
      orderBy: { effective_from: 'desc' },
    });

    return structure;
  }

  async listSalaryStructures(companyId: string) {
    const employees = await prisma.employee.findMany({
      where: { company_id: companyId },
      include: {
        department: true,
        designation: true,
        salary_structures: {
          orderBy: { effective_from: 'desc' },
          take: 1,
        },
      },
      orderBy: { employee_code: 'asc' },
    });

    return employees.map((emp) => ({
      employeeId: emp.id,
      employeeCode: emp.employee_code,
      name: `${emp.first_name} ${emp.last_name}`,
      email: emp.email,
      department: emp.department?.name || null,
      designation: emp.designation?.name || null,
      salaryStructure: emp.salary_structures[0] || null,
    }));
  }

  // --- Helper: Count business days in month ---
  private calculateWorkingDaysInMonth(
    year: number,
    month: number,
    workingDaysList: string[] = ['mon', 'tue', 'wed', 'thu', 'fri']
  ): number {
    const dayMap: Record<number, string> = {
      0: 'sun',
      1: 'mon',
      2: 'tue',
      3: 'wed',
      4: 'thu',
      5: 'fri',
      6: 'sat',
    };

    const daysInMonth = new Date(year, month, 0).getDate();
    let count = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      const dayStr = dayMap[d.getDay()];
      if (workingDaysList.includes(dayStr)) {
        count++;
      }
    }
    return Math.max(1, count);
  }

  // --- Payroll Runs Execution ---
  async runPayroll(companyId: string, month: number, year: number, userId: string) {
    if (month < 1 || month > 12) {
      throw new AppError(400, 'INVALID_MONTH', 'Month must be between 1 and 12');
    }
    if (year < 2000 || year > 2100) {
      throw new AppError(400, 'INVALID_YEAR', 'Year is out of valid range');
    }

    // Check existing run
    const existingRun = await prisma.payrollRun.findUnique({
      where: {
        company_id_month_year: {
          company_id: companyId,
          month,
          year,
        },
      },
      include: {
        payslips: true,
      },
    });

    if (existingRun && existingRun.status === PayrollRunStatus.paid) {
      throw new AppError(
        400,
        'PAYROLL_ALREADY_PAID',
        `Payroll for ${month}/${year} has already been paid and locked against recalculation.`
      );
    }

    const settings = await prisma.companySettings.findUnique({
      where: { company_id: companyId },
    });

    const statutorySettings = await this.getStatutorySettings(companyId);

    const workingDaysList = (settings?.working_days_json as string[]) || [
      'mon',
      'tue',
      'wed',
      'thu',
      'fri',
    ];
    const workingDaysCount = this.calculateWorkingDaysInMonth(year, month, workingDaysList);

    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const activeEmployees = await prisma.employee.findMany({
      where: {
        company_id: companyId,
        status: 'active',
        date_of_joining: { lte: endOfMonth },
      },
      include: {
        salary_structures: {
          orderBy: { effective_from: 'desc' },
          take: 1,
        },
      },
    });

    if (activeEmployees.length === 0) {
      throw new AppError(400, 'NO_EMPLOYEES', 'No active employees found to process payroll for this period');
    }

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      let payrollRun = existingRun;
      if (!payrollRun) {
        payrollRun = await tx.payrollRun.create({
          data: {
            company_id: companyId,
            month,
            year,
            status: PayrollRunStatus.processing,
            approval_status: PayrollApprovalStatus.pending_approval,
            generated_by: userId,
          },
          include: { payslips: true },
        });
      } else {
        await tx.payrollRun.update({
          where: { id: payrollRun.id },
          data: {
            status: PayrollRunStatus.processing,
            approval_status: PayrollApprovalStatus.pending_approval,
            generated_by: userId,
          },
        });
      }

      for (const emp of activeEmployees) {
        // Skip if payslip already exists and is paid
        const existingPayslip = await tx.payslip.findUnique({
          where: {
            payroll_run_id_employee_id: {
              payroll_run_id: payrollRun.id,
              employee_id: emp.id,
            },
          },
        });

        if (existingPayslip && existingPayslip.status === PayslipStatus.paid) {
          continue; // Keep already finalized paid slips intact
        }

        const structure = emp.salary_structures[0];
        const baseAmount = Number(structure?.base_amount || 0);
        const payType = structure?.pay_type || PayType.monthly;

        // Mid-month joiner proration for monthly salaries
        let effectiveBaseAmount = baseAmount;
        const joinDateUtc = new Date(emp.date_of_joining);
        if (payType === PayType.monthly && joinDateUtc > startOfMonth) {
          const joinDay = joinDateUtc.getUTCDate();
          const daysInMonth = new Date(year, month, 0).getDate();
          const remainingDays = Math.max(1, daysInMonth - joinDay + 1);
          const prorationRatio = Math.min(1, remainingDays / daysInMonth);
          effectiveBaseAmount = Math.round(baseAmount * prorationRatio * 100) / 100;
        }

        // Fetch attendance records for this month
        const attendances = await tx.attendance.findMany({
          where: {
            employee_id: emp.id,
            company_id: companyId,
            date: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        });

        // Check assigned shift to determine standard working hours for overtime threshold
        const assignedShift = await tx.employeeShift.findFirst({
          where: {
            employee_id: emp.id,
            effective_from: { lte: endOfMonth },
            OR: [{ effective_to: null }, { effective_to: { gte: startOfMonth } }],
          },
          include: { shift: true },
          orderBy: { effective_from: 'desc' },
        });

        let expectedDailyHours = 8.0;
        if (assignedShift?.shift) {
          const [startH, startM] = assignedShift.shift.start_time.split(':').map(Number);
          const [endH, endM] = assignedShift.shift.end_time.split(':').map(Number);
          let startMinutes = startH * 60 + startM;
          let endMinutes = endH * 60 + endM;
          if (assignedShift.shift.is_night_shift || endMinutes < startMinutes) {
            endMinutes += 24 * 60;
          }
          const span = (endMinutes - startMinutes) / 60;
          expectedDailyHours = span > 5 ? span - 1 : span;
        }

        let presentDays = 0;
        let absentDays = 0;
        let workedHours = 0;
        let overtimeHours = 0;

        for (const att of attendances) {
          if (att.status === 'present') {
            presentDays += 1;
          } else if (att.status === 'half_day') {
            presentDays += 0.5;
            absentDays += 0.5;
          } else if (att.status === 'absent') {
            absentDays += 1;
          }
          workedHours += att.worked_hours || 0;
          if (att.worked_hours > expectedDailyHours) {
            overtimeHours += att.worked_hours - expectedDailyHours;
          }
        }

        // Fetch approved leaves in this month
        const approvedLeaves = await tx.leaveRequest.findMany({
          where: {
            employee_id: emp.id,
            status: 'approved',
            start_date: { lte: endOfMonth },
            end_date: { gte: startOfMonth },
          },
          include: { leave_type: true },
        });

        let paidLeaveDays = 0;
        let unpaidLeaveDays = 0;

        for (const l of approvedLeaves) {
          const leaveStart = new Date(l.start_date);
          const leaveEnd = new Date(l.end_date);
          const effectiveStart = Math.max(leaveStart.getTime(), startOfMonth.getTime());
          const effectiveEnd = Math.min(leaveEnd.getTime(), endOfMonth.getTime());
          const daysInThisMonth = Math.max(
            0,
            Math.floor((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1
          );

          const daysToCount = l.is_half_day ? 0.5 : Math.min(Number(l.total_days), daysInThisMonth);

          if (l.leave_type.is_paid) {
            paidLeaveDays += daysToCount;
          } else {
            unpaidLeaveDays += daysToCount;
          }
        }

        // Fetch active loans and compute loan deduction
        const activeLoans = await tx.loan.findMany({
          where: {
            company_id: companyId,
            employee_id: emp.id,
            status: 'active',
            outstanding_balance: { gt: 0 },
          },
          orderBy: { created_at: 'asc' },
        });

        const loanDeduction = activeLoans.reduce(
          (acc, loan) => acc + Math.min(Number(loan.monthly_deduction_amount), Number(loan.outstanding_balance)),
          0
        );

        const calc = calculateEmployeePayroll({
          payType,
          baseAmount: effectiveBaseAmount,
          workingDaysInMonth: workingDaysCount,
          presentDays,
          paidLeaveDays,
          unpaidLeaveDays,
          absentDays,
          workedHours,
          overtimeHours: settings?.overtime_enabled ? overtimeHours : 0,
          overtimeRateMultiplier: settings?.overtime_rate_multiplier || 1.5,
          statutorySettings: statutorySettings ? {
            pfEnabled: statutorySettings.pf_enabled,
            pfEmployeeRate: Number(statutorySettings.pf_employee_rate),
            pfWageCeiling: Number(statutorySettings.pf_wage_ceiling),
            esiEnabled: statutorySettings.esi_enabled,
            esiEmployeeRate: Number(statutorySettings.esi_employee_rate),
            esiWageCeiling: Number(statutorySettings.esi_wage_ceiling),
            tdsEnabled: statutorySettings.tds_enabled,
            defaultTaxRegime: statutorySettings.default_tax_regime as 'new_regime' | 'old_regime',
          } : undefined,
          loanDeduction,
        });

        await tx.payslip.upsert({
          where: {
            payroll_run_id_employee_id: {
              payroll_run_id: payrollRun.id,
              employee_id: emp.id,
            },
          },
          update: {
            company_id: companyId,
            gross_amount: calc.grossAmount,
            deductions_json: calc.deductions,
            net_amount: calc.netAmount,
            working_days: workingDaysCount,
            present_days: presentDays,
            paid_leave_days: paidLeaveDays,
            unpaid_leave_days: unpaidLeaveDays,
            overtime_hours: overtimeHours,
            overtime_amount: calc.overtimeAmount,
            status: PayslipStatus.generated,
            generated_at: new Date(),
          },
          create: {
            company_id: companyId,
            payroll_run_id: payrollRun.id,
            employee_id: emp.id,
            gross_amount: calc.grossAmount,
            deductions_json: calc.deductions,
            net_amount: calc.netAmount,
            working_days: workingDaysCount,
            present_days: presentDays,
            paid_leave_days: paidLeaveDays,
            unpaid_leave_days: unpaidLeaveDays,
            overtime_hours: overtimeHours,
            overtime_amount: calc.overtimeAmount,
            status: PayslipStatus.generated,
          },
        });
      }

      // Mark completed
      const completedRun = await tx.payrollRun.update({
        where: { id: payrollRun.id },
        data: { status: PayrollRunStatus.completed },
        include: {
          payslips: {
            include: {
              employee: {
                select: {
                  id: true,
                  employee_code: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                  department: { select: { name: true } },
                  designation: { select: { name: true } },
                },
              },
            },
          },
          approver: {
            select: { id: true, email: true },
          },
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          company_id: companyId,
          user_id: userId,
          action: 'PAYROLL_RUN_COMPLETED',
          entity_type: 'payroll_run',
          entity_id: completedRun.id,
          new_value_json: {
            month,
            year,
            payslipsCount: completedRun.payslips.length,
            status: completedRun.status,
            approval_status: completedRun.approval_status,
          },
        },
      });

      return completedRun;
    });

    return result;
  }

  // Single-Step Admin Approval
  async approvePayrollRun(companyId: string, runId: string, userId: string) {
    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, company_id: companyId },
    });

    if (!run) {
      throw new AppError(404, 'NOT_FOUND', 'Payroll run not found');
    }

    if (run.status === PayrollRunStatus.paid) {
      throw new AppError(400, 'ALREADY_PAID', 'Cannot alter approval status of a paid payroll run');
    }

    if (run.approval_status === PayrollApprovalStatus.rejected) {
      throw new AppError(400, 'INVALID_TRANSITION', 'Cannot approve an already-rejected payroll run');
    }

    if (run.approval_status === PayrollApprovalStatus.approved) {
      throw new AppError(400, 'ALREADY_APPROVED', 'Payroll run is already approved');
    }

    const updated = await prisma.payrollRun.update({
      where: { id: runId },
      data: {
        approval_status: PayrollApprovalStatus.approved,
        approved_by: userId,
        approved_at: new Date(),
      },
      include: {
        approver: { select: { id: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        company_id: companyId,
        user_id: userId,
        action: 'PAYROLL_RUN_APPROVED',
        entity_type: 'payroll_run',
        entity_id: runId,
        new_value_json: { approval_status: 'approved', approved_by: userId },
      },
    });

    return updated;
  }

  // Reject Payroll Run
  async rejectPayrollRun(companyId: string, runId: string, userId: string, reason?: string) {
    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, company_id: companyId },
    });

    if (!run) {
      throw new AppError(404, 'NOT_FOUND', 'Payroll run not found');
    }

    if (run.status === PayrollRunStatus.paid) {
      throw new AppError(400, 'ALREADY_PAID', 'Cannot alter approval status of a paid payroll run');
    }

    if (run.approval_status === PayrollApprovalStatus.approved) {
      throw new AppError(400, 'INVALID_TRANSITION', 'Cannot reject an already-approved payroll run');
    }

    if (run.approval_status === PayrollApprovalStatus.rejected) {
      throw new AppError(400, 'ALREADY_REJECTED', 'Payroll run is already rejected');
    }

    const updated = await prisma.payrollRun.update({
      where: { id: runId },
      data: {
        approval_status: PayrollApprovalStatus.rejected,
      },
    });

    await prisma.auditLog.create({
      data: {
        company_id: companyId,
        user_id: userId,
        action: 'PAYROLL_RUN_REJECTED',
        entity_type: 'payroll_run',
        entity_id: runId,
        new_value_json: { approval_status: 'rejected', reason },
      },
    });

    return updated;
  }

  async listPayrollRuns(companyId: string) {
    const runs = await prisma.payrollRun.findMany({
      where: { company_id: companyId },
      include: {
        payslips: {
          select: {
            id: true,
            gross_amount: true,
            net_amount: true,
            status: true,
          },
        },
        generator: {
          select: { id: true, email: true },
        },
        approver: {
          select: { id: true, email: true },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return runs.map((run) => {
      const totalGross = run.payslips.reduce((acc, p) => acc + Number(p.gross_amount), 0);
      const totalNet = run.payslips.reduce((acc, p) => acc + Number(p.net_amount), 0);
      const paidCount = run.payslips.filter((p) => p.status === 'paid').length;

      return {
        id: run.id,
        month: run.month,
        year: run.year,
        status: run.status,
        approvalStatus: run.approval_status,
        approvedBy: run.approver?.email || null,
        approvedAt: run.approved_at,
        generatedAt: run.generated_at,
        generatedBy: run.generator.email,
        employeeCount: run.payslips.length,
        totalGross: Math.round(totalGross * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        paidCount,
      };
    });
  }

  async getPayrollRunById(id: string, companyId: string) {
    const run = await prisma.payrollRun.findFirst({
      where: { id, company_id: companyId },
      include: {
        payslips: {
          include: {
            employee: {
              select: {
                id: true,
                employee_code: true,
                first_name: true,
                last_name: true,
                email: true,
                department: { select: { name: true } },
                designation: { select: { name: true } },
              },
            },
          },
          orderBy: { employee: { employee_code: 'asc' } },
        },
        generator: {
          select: { id: true, email: true },
        },
        approver: {
          select: { id: true, email: true },
        },
      },
    });

    if (!run) {
      throw new AppError(404, 'NOT_FOUND', 'Payroll run not found');
    }

    return run;
  }

  async markPayrollRunPaid(id: string, companyId: string, userId: string) {
    const run = await prisma.payrollRun.findFirst({
      where: { id, company_id: companyId },
    });

    if (!run) {
      throw new AppError(404, 'NOT_FOUND', 'Payroll run not found');
    }

    if (run.approval_status !== PayrollApprovalStatus.approved) {
      throw new AppError(
        400,
        'PAYROLL_NOT_APPROVED',
        'Payroll run must be approved by an administrator before marking as paid'
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Find all payslips for this run
      const payslips = await tx.payslip.findMany({
        where: { payroll_run_id: id },
      });

      // Update loan balances for any employees with loan repayment deductions
      for (const slip of payslips) {
        const deductions = (slip.deductions_json as Record<string, number>) || {};
        const loanDeduction = Number(deductions['Loan Repayment Deduction'] || 0);

        if (loanDeduction > 0) {
          const activeLoans = await tx.loan.findMany({
            where: {
              company_id: companyId,
              employee_id: slip.employee_id,
              status: 'active',
              outstanding_balance: { gt: 0 },
            },
            orderBy: { created_at: 'asc' },
          });

          let remainingToDeduct = loanDeduction;
          for (const loan of activeLoans) {
            if (remainingToDeduct <= 0) break;
            const currentBal = Number(loan.outstanding_balance);
            const deductFromThis = Math.min(currentBal, remainingToDeduct);
            const newBal = Math.max(0, Math.round((currentBal - deductFromThis) * 100) / 100);

            await tx.loan.update({
              where: { id: loan.id },
              data: {
                outstanding_balance: newBal,
                status: newBal === 0 ? LoanStatus.repaid : LoanStatus.active,
              },
            });

            remainingToDeduct -= deductFromThis;
          }
        }
      }

      await tx.payslip.updateMany({
        where: { payroll_run_id: id },
        data: { status: PayslipStatus.paid },
      });

      const updatedRun = await tx.payrollRun.update({
        where: { id },
        data: { status: PayrollRunStatus.paid },
        include: { payslips: true },
      });

      await tx.auditLog.create({
        data: {
          company_id: companyId,
          user_id: userId,
          action: 'PAYROLL_RUN_MARKED_PAID',
          entity_type: 'payroll_run',
          entity_id: id,
          new_value_json: { status: 'paid', payslipsCount: updatedRun.payslips.length },
        },
      });

      return updatedRun;
    });

    return updated;
  }

  // --- Payslip Retrieval & PDF Generation ---
  async getMyPayslips(companyId: string, employeeId: string) {
    return prisma.payslip.findMany({
      where: {
        employee_id: employeeId,
        payroll_run: { company_id: companyId },
      },
      include: {
        payroll_run: {
          select: { month: true, year: true, status: true, approval_status: true },
        },
      },
      orderBy: [
        { payroll_run: { year: 'desc' } },
        { payroll_run: { month: 'desc' } },
      ],
    });
  }

  async getPayslipById(
    payslipId: string,
    companyId: string,
    requestUser: { role: TenantRole; employeeId?: string | null }
  ) {
    const payslip = await prisma.payslip.findFirst({
      where: {
        id: payslipId,
        company_id: companyId,
      },
      include: {
        payroll_run: true,
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
    });

    if (!payslip) {
      throw new AppError(404, 'NOT_FOUND', 'Payslip not found');
    }

    // Non-admin can ONLY view their own payslip. Managers cannot view peer/subordinate payslips.
    if (requestUser.role !== TenantRole.company_admin && payslip.employee_id !== requestUser.employeeId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this payslip');
    }

    return payslip;
  }

  async generatePayslipPdf(
    payslipId: string,
    companyId: string,
    requestUser: { role: TenantRole; employeeId?: string | null }
  ): Promise<{ buffer: Buffer; filename: string }> {
    const payslip = await this.getPayslipById(payslipId, companyId, requestUser);

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    const structure = payslip.employee.salary_structures[0];
    const payTypeStr = structure?.pay_type || 'monthly';
    const deductions = (payslip.deductions_json as Record<string, number>) || {};
    const totalDeductions = Object.values(deductions).reduce((acc, v) => acc + (Number(v) || 0), 0);

    const buffer = await generatePayslipPdfBuffer({
      companyName: company?.name || 'Nova Pulse Tenant',
      companyAddress: company?.address,
      companyContactEmail: company?.contact_email,
      employeeName: `${payslip.employee.first_name} ${payslip.employee.last_name}`,
      employeeCode: payslip.employee.employee_code,
      departmentName: payslip.employee.department?.name,
      designationName: payslip.employee.designation?.name,
      payType: payTypeStr,
      month: payslip.payroll_run.month,
      year: payslip.payroll_run.year,
      workingDays: payslip.working_days,
      presentDays: Number(payslip.present_days),
      paidLeaveDays: Number(payslip.paid_leave_days),
      unpaidLeaveDays: Number(payslip.unpaid_leave_days),
      overtimeHours: payslip.overtime_hours,
      overtimeAmount: Number(payslip.overtime_amount),
      grossAmount: Number(payslip.gross_amount),
      deductions,
      totalDeductions,
      netAmount: Number(payslip.net_amount),
      status: payslip.status,
      generatedAt: payslip.generated_at,
    });

    const filename = `Payslip-${payslip.employee.employee_code}-${payslip.payroll_run.month}-${payslip.payroll_run.year}.pdf`;
    return { buffer, filename };
  }

  // --- Statutory Settings ---
  async getStatutorySettings(companyId: string) {
    let settings = await prisma.statutorySettings.findUnique({
      where: { company_id: companyId },
    });

    if (!settings) {
      settings = await prisma.statutorySettings.create({
        data: {
          company_id: companyId,
          pf_enabled: true,
          pf_employee_rate: 12.0,
          pf_employer_rate: 12.0,
          pf_wage_ceiling: 25000.0,
          esi_enabled: true,
          esi_employee_rate: 0.75,
          esi_employer_rate: 3.25,
          esi_wage_ceiling: 21000.0,
          tds_enabled: true,
          default_tax_regime: TaxRegime.new_regime,
        },
      });
    }

    return settings;
  }

  async updateStatutorySettings(
    companyId: string,
    data: {
      pf_enabled?: boolean;
      pf_employee_rate?: number;
      pf_employer_rate?: number;
      pf_wage_ceiling?: number;
      esi_enabled?: boolean;
      esi_employee_rate?: number;
      esi_employer_rate?: number;
      esi_wage_ceiling?: number;
      tds_enabled?: boolean;
      default_tax_regime?: TaxRegime;
    }
  ) {
    const updated = await prisma.statutorySettings.upsert({
      where: { company_id: companyId },
      create: {
        company_id: companyId,
        ...data,
      },
      update: {
        ...data,
      },
    });

    return updated;
  }

  // --- Loans & Advances ---
  async createLoan(
    companyId: string,
    data: {
      employee_id: string;
      amount: number;
      tenure_months: number;
      reason?: string;
    }
  ) {
    if (data.amount <= 0) {
      throw new AppError(400, 'INVALID_AMOUNT', 'Loan amount must be greater than 0');
    }
    if (data.tenure_months < 1) {
      throw new AppError(400, 'INVALID_TENURE', 'Tenure must be at least 1 month');
    }

    const employee = await prisma.employee.findFirst({
      where: { id: data.employee_id, company_id: companyId },
    });

    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found in company');
    }

    const monthlyDeduction = Math.round((data.amount / data.tenure_months) * 100) / 100;

    const loan = await prisma.loan.create({
      data: {
        company_id: companyId,
        employee_id: data.employee_id,
        amount: data.amount,
        monthly_deduction_amount: monthlyDeduction,
        outstanding_balance: data.amount,
        tenure_months: data.tenure_months,
        reason: data.reason || null,
        status: LoanStatus.pending,
      },
      include: {
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            employee_code: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    return loan;
  }

  async listLoans(
    companyId: string,
    requestUser: { role: TenantRole; employeeId?: string | null }
  ) {
    const where: any = { company_id: companyId };
    if (requestUser.role !== TenantRole.company_admin) {
      if (!requestUser.employeeId) {
        return [];
      }
      where.employee_id = requestUser.employeeId;
    }

    return prisma.loan.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            employee_code: true,
            department: { select: { name: true } },
          },
        },
        approver: {
          select: { id: true, email: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async reviewLoan(
    companyId: string,
    loanId: string,
    action: 'approved' | 'rejected' | 'active' | 'approve' | 'reject',
    userId: string
  ) {
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, company_id: companyId },
    });

    if (!loan) {
      throw new AppError(404, 'NOT_FOUND', 'Loan not found');
    }

    const isApprove = action === 'approved' || (action as string) === 'approve';
    const isReject = action === 'rejected' || (action as string) === 'reject';
    const targetStatus = isApprove ? LoanStatus.active : (isReject ? LoanStatus.rejected : action as LoanStatus);

    const updated = await prisma.loan.update({
      where: { id: loanId },
      data: {
        status: targetStatus,
        approved_by: targetStatus === LoanStatus.active ? userId : loan.approved_by,
        approved_at: targetStatus === LoanStatus.active ? new Date() : loan.approved_at,
      },
      include: {
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            employee_code: true,
          },
        },
      },
    });

    return updated;
  }

  // --- Form 16 PDF Generation ---
  async generateForm16Pdf(
    payslipId: string,
    companyId: string,
    requestUser: { role: TenantRole; employeeId?: string | null }
  ): Promise<{ buffer: Buffer; filename: string }> {
    const payslip = await this.getPayslipById(payslipId, companyId, requestUser);

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    const statutorySettings = await this.getStatutorySettings(companyId);

    const year = payslip.payroll_run.year;
    const financialYear = `${year - 1}-${year.toString().slice(-2)}`;
    const assessmentYear = `${year}-${(year + 1).toString().slice(-2)}`;

    const monthlyGross = Number(payslip.gross_amount);
    const grossSalary = Math.round(monthlyGross * 12 * 100) / 100;
    const standardDeduction = 75000;

    const deductions = (payslip.deductions_json as Record<string, number>) || {};
    const monthlyPf = Number(deductions['Provident Fund (PF)'] || 0);
    const providentFundDeduction = Math.round(monthlyPf * 12 * 100) / 100;

    const totalExemptions = standardDeduction + providentFundDeduction;
    const taxableIncome = Math.max(0, Math.round((grossSalary - totalExemptions) * 100) / 100);

    const regime = (statutorySettings.default_tax_regime as 'new_regime' | 'old_regime') || 'new_regime';
    const totalTaxLiability = computeAnnualTds(grossSalary, regime);
    const calculatedTax = Math.round((totalTaxLiability / 1.04) * 100) / 100;
    const healthAndEduCess = Math.round((totalTaxLiability - calculatedTax) * 100) / 100;
    const monthlyTds = Number(deductions['Tax Deducted at Source (TDS)'] || 0);
    const tdsDeducted = Math.round(monthlyTds * 12 * 100) / 100;
    const balancePayable = Math.max(0, Math.round((totalTaxLiability - tdsDeducted) * 100) / 100);

    const buffer = await generateForm16PdfBuffer({
      companyName: company?.name || 'Nova Pulse HRMS',
      companyAddress: company?.address,
      companyContactEmail: company?.contact_email,
      employeeName: `${payslip.employee.first_name} ${payslip.employee.last_name}`,
      employeeCode: payslip.employee.employee_code,
      departmentName: payslip.employee.department?.name,
      designationName: payslip.employee.designation?.name,
      financialYear,
      assessmentYear,
      taxRegime: regime,
      grossSalary,
      standardDeduction,
      providentFundDeduction,
      totalExemptions,
      taxableIncome,
      calculatedTax,
      healthAndEduCess,
      totalTaxLiability,
      tdsDeducted,
      balancePayable,
      generatedAt: new Date(),
    });

    const filename = `Form16-${payslip.employee.employee_code}-${financialYear}.pdf`;
    return { buffer, filename };
  }
}

export const payrollService = new PayrollService();
