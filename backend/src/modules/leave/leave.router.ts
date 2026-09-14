import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { leaveService } from './leave.service';
import { tenantGuard, rolesGuard } from '../../common/guards/auth.guard';
import { sendSuccess, sendError } from '../../common/utils/response.util';
import { AuthenticatedRequest } from '../../common/types';
import { TenantRole, LeaveStatus } from '@prisma/client';
import prisma from '../../common/prisma/prisma.service';

const router = Router();

// Apply tenantGuard across all leave routes
router.use(tenantGuard);

// 1. List Leave Types
router.get(
  '/types',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const types = await leaveService.listLeaveTypes(req.tenantUser!.companyId);
      return sendSuccess(res, types, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 2. Create Leave Type (Company Admin Only)
const createLeaveTypeSchema = z.object({
  name: z.string().min(2),
  is_paid: z.boolean().default(true),
  default_annual_quota: z.number().int().min(0).default(12),
});

router.post(
  '/types',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = createLeaveTypeSchema.parse(req.body);
      const leaveType = await leaveService.createLeaveType(
        req.tenantUser!.companyId,
        validated
      );
      return sendSuccess(res, leaveType, 201);
    } catch (err) {
      next(err);
    }
  }
);

// 3. Get Leave Balances
router.get(
  '/balances',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const targetEmployeeId = req.query.employee_id
        ? String(req.query.employee_id)
        : req.tenantUser!.employeeId;
      const year = req.query.year ? Number(req.query.year) : undefined;

      if (!targetEmployeeId) {
        return sendError(res, 400, 'NO_EMPLOYEE_PROFILE', 'User not linked to an employee');
      }

      const viewer = req.tenantUser!;
      if (viewer.role === TenantRole.employee && targetEmployeeId !== viewer.employeeId) {
        return sendError(res, 403, 'FORBIDDEN', 'Employees can only view their own leave balances');
      }

      if (viewer.role === TenantRole.manager && targetEmployeeId !== viewer.employeeId) {
        const isSubordinate = await prisma.employee.findFirst({
          where: {
            id: targetEmployeeId,
            company_id: viewer.companyId,
            manager_id: viewer.employeeId,
          },
        });
        if (!isSubordinate) {
          return sendError(res, 403, 'FORBIDDEN', 'Managers can only view leave balances of direct reports');
        }
      }

      const balances = await leaveService.getEmployeeBalances(
        req.tenantUser!.companyId,
        targetEmployeeId,
        year
      );
      return sendSuccess(res, balances, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 4. Apply for Leave (With Half-Day 0.5 Support)
const applyLeaveSchema = z.object({
  leave_type_id: z.string().uuid(),
  start_date: z.string(),
  end_date: z.string(),
  is_half_day: z.boolean().optional().default(false),
  reason: z.string().min(2),
});

router.post(
  '/apply',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = applyLeaveSchema.parse(req.body);
      const request = await leaveService.applyLeave(
        req.tenantUser!.companyId,
        req.tenantUser!.employeeId!,
        validated
      );
      return sendSuccess(res, request, 201);
    } catch (err) {
      next(err);
    }
  }
);

// Alias: POST /requests -> apply leave
router.post(
  '/requests',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = applyLeaveSchema.parse(req.body);
      const request = await leaveService.applyLeave(
        req.tenantUser!.companyId,
        req.tenantUser!.employeeId!,
        validated
      );
      return sendSuccess(res, request, 201);
    } catch (err) {
      next(err);
    }
  }
);

// 5. Manager Subordinates List & Quotas
router.get(
  '/subordinates',
  rolesGuard(TenantRole.company_admin, TenantRole.manager),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const subordinates = await leaveService.getSubordinatesLeave(
        req.tenantUser!.companyId,
        req.tenantUser!.role,
        req.tenantUser!.employeeId
      );
      return sendSuccess(res, subordinates, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 6. Leave Bank Carry-Forward (Admin Only)
const carryForwardSchema = z.object({
  from_year: z.number().int().optional(),
});

router.post(
  '/carry-forward',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = carryForwardSchema.parse(req.body || {});
      const fromYear = body.from_year || new Date().getFullYear() - 1;
      const result = await leaveService.carryForwardLeaves(req.tenantUser!.companyId, fromYear);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 7. Leave Bank Encashment (Admin Only)
const encashSchema = z.object({
  employee_id: z.string().uuid(),
  year: z.number().int(),
  days_to_encash: z.number().positive(),
});

router.post(
  '/encash',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = encashSchema.parse(req.body);
      const result = await leaveService.encashLeave(req.tenantUser!.companyId, validated);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 8. Get Leave Bank Records
router.get(
  '/bank',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const targetEmpId = req.query.employee_id ? String(req.query.employee_id) : undefined;
      const records = await leaveService.getLeaveBank(
        req.tenantUser!.companyId,
        req.tenantUser!.role,
        req.tenantUser!.employeeId || null,
        targetEmpId
      );
      return sendSuccess(res, records, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 9. Review Leave Request (Approve / Reject)
const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

const reviewLeaveHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rawAction =
      req.body?.action ||
      (req.body?.status === 'approved' ? 'approve' : req.body?.status === 'rejected' ? 'reject' : req.body?.status);
    const { action } = reviewSchema.parse({ action: rawAction });
    const result = await leaveService.reviewLeaveRequest(
      req.tenantUser!.companyId,
      {
        userId: req.tenantUser!.userId,
        role: req.tenantUser!.role,
        employeeId: req.tenantUser!.employeeId,
      },
      req.params.id,
      action
    );
    return sendSuccess(res, result, 200);
  } catch (err) {
    next(err);
  }
};

router.post('/:id/review', rolesGuard(TenantRole.company_admin, TenantRole.manager), reviewLeaveHandler);
router.patch('/:id/status', rolesGuard(TenantRole.company_admin, TenantRole.manager), reviewLeaveHandler);

// 10. List Leave Requests (Scoped)
router.get(
  '/requests',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as LeaveStatus;
      const employeeId = req.query.employee_id ? String(req.query.employee_id) : undefined;

      const requests = await leaveService.listLeaveRequests(
        req.tenantUser!.companyId,
        {
          userId: req.tenantUser!.userId,
          role: req.tenantUser!.role,
          employeeId: req.tenantUser!.employeeId,
        },
        { status, employee_id: employeeId }
      );
      return sendSuccess(res, requests, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 11. Cancel Leave Request (Employee self-cancel or Admin/Manager cancel)
router.post(
  '/:id/cancel',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await leaveService.cancelLeaveRequest(
        req.tenantUser!.companyId,
        {
          userId: req.tenantUser!.userId,
          role: req.tenantUser!.role,
          employeeId: req.tenantUser!.employeeId,
        },
        req.params.id
      );
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
