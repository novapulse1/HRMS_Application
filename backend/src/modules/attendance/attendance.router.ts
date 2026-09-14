import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { attendanceService } from './attendance.service';
import { tenantGuard, rolesGuard } from '../../common/guards/auth.guard';
import { sendSuccess, sendError } from '../../common/utils/response.util';
import { AuthenticatedRequest } from '../../common/types';
import { AttendanceStatus, TenantRole, AttendanceSource } from '@prisma/client';
import prisma from '../../common/prisma/prisma.service';
import devicesRouter from './devices.router';

const router = Router();

// Apply tenantGuard to all attendance routes
router.use(tenantGuard);

// Sub-router for device management
router.use('/devices', devicesRouter);

// 1. Punch In / Punch Out
const punchSchema = z.object({
  action: z.enum(['check_in', 'check_out', 'toggle']).optional(),
  source: z.nativeEnum(AttendanceSource).optional(),
  device_id: z.string().uuid().optional(),
});

router.post(
  '/punch',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = punchSchema.parse(req.body || {});
      const result = await attendanceService.punch(
        req.tenantUser!.companyId,
        req.tenantUser!.employeeId!,
        validated.action || 'toggle',
        validated.source,
        validated.device_id
      );
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 2. Today's Punch Status
router.get(
  '/today',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const record = await attendanceService.getTodayStatus(
        req.tenantUser!.companyId,
        req.tenantUser!.employeeId!
      );
      return sendSuccess(res, record, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 2b. Today's Roster (Present, Absent, On Leave breakdown)
router.get(
  '/today-roster',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const roster = await attendanceService.getTodayRoster(
        req.tenantUser!.companyId,
        req.tenantUser!.role,
        req.tenantUser!.employeeId
      );
      return sendSuccess(res, roster, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 3. Manual Entry or Correction (Admin or Manager for reports)
const correctionSchema = z.object({
  employee_id: z.string().uuid(),
  date: z.string(),
  check_in_time: z.string().nullable().optional(),
  check_out_time: z.string().nullable().optional(),
  status: z.nativeEnum(AttendanceStatus),
  worked_hours: z.number().optional(),
});

router.post(
  '/correction',
  rolesGuard(TenantRole.company_admin, TenantRole.manager),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = correctionSchema.parse(req.body);
      const record = await attendanceService.manualPunchOrCorrection(
        req.tenantUser!.companyId,
        req.tenantUser!.userId,
        validated
      );
      return sendSuccess(res, record, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 4. Attendance Calendar (Scoped by Role)
router.get(
  '/calendar',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const month = req.query.month ? Number(req.query.month) : now.getUTCMonth() + 1;
      const year = req.query.year ? Number(req.query.year) : now.getUTCFullYear();
      const employeeId = req.query.employee_id ? String(req.query.employee_id) : undefined;
      const departmentId = req.query.department_id ? String(req.query.department_id) : undefined;

      const records = await attendanceService.getAttendanceCalendar(
        req.tenantUser!.companyId,
        req.tenantUser!.role,
        req.tenantUser!.employeeId,
        {
          month,
          year,
          employee_id: employeeId,
          department_id: departmentId,
        }
      );
      return sendSuccess(res, records, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 5. Monthly Summary Widget Data
router.get(
  '/summary',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const month = req.query.month ? Number(req.query.month) : now.getUTCMonth() + 1;
      const year = req.query.year ? Number(req.query.year) : now.getUTCFullYear();
      const targetEmployeeId = req.query.employee_id
        ? String(req.query.employee_id)
        : req.tenantUser!.employeeId;

      if (!targetEmployeeId) {
        return sendError(res, 400, 'NO_EMPLOYEE_PROFILE', 'User not linked to an employee');
      }

      const viewer = req.tenantUser!;
      if (viewer.role === TenantRole.employee && targetEmployeeId !== viewer.employeeId) {
        return sendError(res, 403, 'FORBIDDEN', 'Employees can only view their own attendance summary');
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
          return sendError(res, 403, 'FORBIDDEN', 'Managers can only view attendance summary of direct reports');
        }
      }

      const summary = await attendanceService.getMonthlySummary(
        req.tenantUser!.companyId,
        targetEmployeeId,
        month,
        year
      );
      return sendSuccess(res, summary, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 6. Attendance Source Distribution
router.get(
  '/source-distribution',
  rolesGuard(TenantRole.company_admin, TenantRole.manager),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const month = req.query.month ? Number(req.query.month) : now.getUTCMonth() + 1;
      const year = req.query.year ? Number(req.query.year) : now.getUTCFullYear();

      const distribution = await attendanceService.getSourceDistribution(
        req.tenantUser!.companyId,
        req.tenantUser!.role,
        req.tenantUser!.employeeId || undefined,
        month,
        year
      );
      return sendSuccess(res, distribution, 200);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
