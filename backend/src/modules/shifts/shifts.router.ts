import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { shiftsService } from './shifts.service';
import { tenantGuard, rolesGuard } from '../../common/guards/auth.guard';
import { sendSuccess } from '../../common/utils/response.util';
import { AuthenticatedRequest } from '../../common/types';
import { TenantRole } from '@prisma/client';

const router = Router();

// Apply tenantGuard across all shift routes
router.use(tenantGuard);

// 1. List Shifts
router.get(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const shifts = await shiftsService.listShifts(req.tenantUser!.companyId);
      return sendSuccess(res, shifts, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 2. Create Shift
const createShiftSchema = z.object({
  name: z.string().min(2),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:MM'),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:MM'),
  is_night_shift: z.boolean().optional(),
});

router.post(
  '/',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = createShiftSchema.parse(req.body);
      const shift = await shiftsService.createShift(req.tenantUser!.companyId, validated);
      return sendSuccess(res, shift, 201);
    } catch (err) {
      next(err);
    }
  }
);

// 3. Assign Shift
const assignShiftSchema = z.object({
  shift_id: z.string().uuid(),
  employee_ids: z.array(z.string().uuid()).min(1),
  effective_from: z.string().optional(),
  effective_to: z.string().nullable().optional(),
});

router.post(
  '/assign',
  rolesGuard(TenantRole.company_admin, TenantRole.manager),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = assignShiftSchema.parse(req.body);
      const result = await shiftsService.assignShift(req.tenantUser!.companyId, validated);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 4. List Holidays
router.get(
  '/holidays',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      const holidays = await shiftsService.listHolidays(req.tenantUser!.companyId, year);
      return sendSuccess(res, holidays, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 5. Create Holiday
const createHolidaySchema = z.object({
  name: z.string().min(2),
  date: z.string(),
  is_recurring_annually: z.boolean().optional(),
});

router.post(
  '/holidays',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = createHolidaySchema.parse(req.body);
      const holiday = await shiftsService.createHoliday(req.tenantUser!.companyId, validated);
      return sendSuccess(res, holiday, 201);
    } catch (err) {
      next(err);
    }
  }
);

// 6. Delete Holiday
router.delete(
  '/holidays/:id',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await shiftsService.deleteHoliday(req.tenantUser!.companyId, req.params.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
