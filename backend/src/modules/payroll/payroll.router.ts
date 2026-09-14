import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TenantRole, PayType, TaxRegime } from '@prisma/client';
import { tenantGuard, rolesGuard } from '../../common/guards/auth.guard';
import { AuthenticatedRequest } from '../../common/types';
import { sendSuccess, sendError } from '../../common/utils/response.util';
import { payrollService } from './payroll.service';

const router = Router();

// Apply tenant guard to all payroll routes
router.use(tenantGuard);

const setSalaryStructureSchema = z.object({
  pay_type: z.nativeEnum(PayType),
  base_amount: z.number().positive('Base amount must be positive'),
  effective_from: z.string().optional(),
});

const runPayrollSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

const statutorySettingsSchema = z.object({
  pf_enabled: z.boolean().optional(),
  pf_employee_rate: z.number().min(0).max(100).optional(),
  pf_employer_rate: z.number().min(0).max(100).optional(),
  pf_wage_ceiling: z.number().min(0).optional(),
  esi_enabled: z.boolean().optional(),
  esi_employee_rate: z.number().min(0).max(100).optional(),
  esi_employer_rate: z.number().min(0).max(100).optional(),
  esi_wage_ceiling: z.number().min(0).optional(),
  tds_enabled: z.boolean().optional(),
  default_tax_regime: z.nativeEnum(TaxRegime).optional(),
});

const createLoanSchema = z.object({
  employee_id: z.string().optional(),
  amount: z.number().positive('Loan amount must be greater than zero'),
  tenure_months: z.number().int().min(1).max(120),
  reason: z.string().optional(),
});

const reviewLoanSchema = z.object({
  action: z.enum(['approve', 'reject', 'approved', 'rejected', 'active']),
});

// ==========================================
// 1. STATUTORY SETTINGS (Admin Only)
// ==========================================
router.get(
  '/statutory-settings',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const settings = await payrollService.getStatutorySettings(req.tenantUser!.companyId);
      return sendSuccess(res, settings);
    } catch (err: unknown) {
      return sendError(res, 500, 'STATUTORY_FETCH_ERROR', 'Failed to retrieve statutory settings', err);
    }
  }
);

router.put(
  '/statutory-settings',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = statutorySettingsSchema.parse(req.body);
      const settings = await payrollService.updateStatutorySettings(
        req.tenantUser!.companyId,
        validated
      );
      return sendSuccess(res, settings);
    } catch (err: unknown) {
      return sendError(res, 400, 'STATUTORY_UPDATE_ERROR', 'Failed to update statutory settings', err);
    }
  }
);

// ==========================================
// 2. LOANS & ADVANCES
// ==========================================
router.post('/loans', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = createLoanSchema.parse(req.body);
    let targetEmployeeId = validated.employee_id;

    // Non-admin can only create loan for themselves
    if (req.tenantUser!.role !== TenantRole.company_admin) {
      if (!req.tenantUser!.employeeId) {
        return sendError(res, 400, 'NO_EMPLOYEE_PROFILE', 'Current user has no linked employee profile');
      }
      targetEmployeeId = req.tenantUser!.employeeId;
    } else if (!targetEmployeeId) {
      targetEmployeeId = req.tenantUser!.employeeId || undefined;
    }

    if (!targetEmployeeId) {
      return sendError(res, 400, 'MISSING_EMPLOYEE_ID', 'Employee ID is required');
    }

    const loan = await payrollService.createLoan(req.tenantUser!.companyId, {
      employee_id: targetEmployeeId,
      amount: validated.amount,
      tenure_months: validated.tenure_months,
      reason: validated.reason,
    });

    return sendSuccess(res, loan, 201);
  } catch (err: unknown) {
    return sendError(res, 400, 'LOAN_CREATE_ERROR', 'Failed to create loan application', err);
  }
});

router.get('/loans', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const loans = await payrollService.listLoans(req.tenantUser!.companyId, {
      role: req.tenantUser!.role,
      employeeId: req.tenantUser!.employeeId,
    });
    return sendSuccess(res, loans);
  } catch (err: unknown) {
    return sendError(res, 500, 'LOANS_FETCH_ERROR', 'Failed to retrieve loans', err);
  }
});

router.patch(
  '/loans/:id/review',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { action } = reviewLoanSchema.parse(req.body);
      const updated = await payrollService.reviewLoan(
        req.tenantUser!.companyId,
        req.params.id,
        action,
        req.tenantUser!.userId
      );
      return sendSuccess(res, updated);
    } catch (err: unknown) {
      return sendError(res, 400, 'LOAN_REVIEW_ERROR', 'Failed to review loan', err);
    }
  }
);

// ==========================================
// 3. SALARY STRUCTURES (Admin Only)
// ==========================================
router.get(
  '/salary-structures',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const structures = await payrollService.listSalaryStructures(req.tenantUser!.companyId);
      return sendSuccess(res, structures);
    } catch (err: unknown) {
      return sendError(res, 500, 'SALARY_STRUCTURES_ERROR', 'Failed to retrieve salary structures', err);
    }
  }
);

router.post(
  '/salary-structures/:employeeId',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = setSalaryStructureSchema.parse(req.body);
      const structure = await payrollService.setSalaryStructure(
        req.tenantUser!.companyId,
        req.params.employeeId,
        validated
      );
      return sendSuccess(res, structure, 201);
    } catch (err: unknown) {
      return sendError(res, 400, 'SET_SALARY_ERROR', 'Failed to configure salary structure', err);
    }
  }
);

router.get(
  '/salary-structures/:employeeId',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Non-admin can only see self
      if (
        req.tenantUser!.role !== TenantRole.company_admin &&
        req.tenantUser!.employeeId !== req.params.employeeId
      ) {
        return sendError(res, 403, 'FORBIDDEN', 'Access denied to this employee salary structure');
      }

      const structure = await payrollService.getSalaryStructure(
        req.tenantUser!.companyId,
        req.params.employeeId
      );
      return sendSuccess(res, structure);
    } catch (err: unknown) {
      return sendError(res, 400, 'GET_SALARY_ERROR', 'Failed to retrieve salary structure', err);
    }
  }
);

// ==========================================
// 4. PAYROLL RUNS & APPROVAL (Admin Only)
// ==========================================
router.post(
  '/runs',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { month, year } = runPayrollSchema.parse(req.body);
      const run = await payrollService.runPayroll(
        req.tenantUser!.companyId,
        month,
        year,
        req.tenantUser!.userId
      );
      return sendSuccess(res, run, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/runs',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const runs = await payrollService.listPayrollRuns(req.tenantUser!.companyId);
      return sendSuccess(res, runs);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/runs/:id',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const run = await payrollService.getPayrollRunById(
        req.params.id,
        req.tenantUser!.companyId
      );
      return sendSuccess(res, run);
    } catch (err: unknown) {
      return sendError(res, 404, 'NOT_FOUND', 'Payroll run not found', err);
    }
  }
);

// Single-step admin approval
router.post(
  '/runs/:id/approve',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const updated = await payrollService.approvePayrollRun(
        req.tenantUser!.companyId,
        req.params.id,
        req.tenantUser!.userId
      );
      return sendSuccess(res, updated);
    } catch (err: unknown) {
      next(err);
    }
  }
);

// Single-step admin rejection
router.post(
  '/runs/:id/reject',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const updated = await payrollService.rejectPayrollRun(
        req.tenantUser!.companyId,
        req.params.id,
        req.tenantUser!.userId,
        req.body?.reason
      );
      return sendSuccess(res, updated);
    } catch (err: unknown) {
      next(err);
    }
  }
);

const payPayrollHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await payrollService.markPayrollRunPaid(
      req.params.id,
      req.tenantUser!.companyId,
      req.tenantUser!.userId
    );
    return sendSuccess(res, updated);
  } catch (err: unknown) {
    next(err);
  }
};

router.patch('/runs/:id/pay', rolesGuard(TenantRole.company_admin), payPayrollHandler);
router.post('/runs/:id/pay', rolesGuard(TenantRole.company_admin), payPayrollHandler);

// ==========================================
// 5. PAYSLIPS & FORM 16
// ==========================================
router.get('/payslips/my', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.tenantUser!.employeeId) {
      return sendError(res, 400, 'NO_EMPLOYEE_PROFILE', 'Current user is not linked to an employee record');
    }

    const payslips = await payrollService.getMyPayslips(
      req.tenantUser!.companyId,
      req.tenantUser!.employeeId
    );
    return sendSuccess(res, payslips);
  } catch (err: unknown) {
    return sendError(res, 500, 'PAYSLIPS_FETCH_ERROR', 'Failed to retrieve payslips', err);
  }
});

router.get('/payslips/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payslip = await payrollService.getPayslipById(
      req.params.id,
      req.tenantUser!.companyId,
      {
        role: req.tenantUser!.role,
        employeeId: req.tenantUser!.employeeId,
      }
    );
    return sendSuccess(res, payslip);
  } catch (err: unknown) {
    return sendError(res, 404, 'NOT_FOUND', 'Payslip not found or access denied', err);
  }
});

router.get('/payslips/:id/pdf', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { buffer, filename } = await payrollService.generatePayslipPdf(
      req.params.id,
      req.tenantUser!.companyId,
      {
        role: req.tenantUser!.role,
        employeeId: req.tenantUser!.employeeId,
      }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (err: unknown) {
    return sendError(res, 404, 'PDF_ERROR', 'Failed to generate payslip PDF', err);
  }
});

router.get('/payslips/:id/form16', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { buffer, filename } = await payrollService.generateForm16Pdf(
      req.params.id,
      req.tenantUser!.companyId,
      {
        role: req.tenantUser!.role,
        employeeId: req.tenantUser!.employeeId,
      }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (err: unknown) {
    return sendError(res, 404, 'FORM16_ERROR', 'Failed to generate Form 16 PDF', err);
  }
});

export default router;
