import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { companySettingsService } from './company-settings.service';
import { tenantGuard, rolesGuard } from '../../common/guards/auth.guard';
import { sendSuccess } from '../../common/utils/response.util';
import { AuthenticatedRequest } from '../../common/types';
import { TenantRole } from '@prisma/client';

const router = Router();

// Apply tenantGuard across all settings routes
router.use(tenantGuard);

// 1. Get Company Settings
router.get(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const settings = await companySettingsService.getSettings(req.tenantUser!.companyId);
      return sendSuccess(res, settings, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 2. Update Company Settings (Admin Only)
const updateSettingsSchema = z.object({
  working_days_json: z.array(z.string()).optional(),
  working_hours_start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  working_hours_end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  payroll_cycle_day: z.number().int().min(1).max(31).optional(),
  overtime_enabled: z.boolean().optional(),
  overtime_rate_multiplier: z.number().min(1).max(5).optional(),
});

router.patch(
  '/',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = updateSettingsSchema.parse(req.body);
      const updated = await companySettingsService.updateSettings(
        req.tenantUser!.companyId,
        req.tenantUser!.userId,
        validated
      );
      return sendSuccess(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
