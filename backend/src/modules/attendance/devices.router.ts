import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { devicesService } from './devices.service';
import { tenantGuard, rolesGuard } from '../../common/guards/auth.guard';
import { sendSuccess } from '../../common/utils/response.util';
import { AuthenticatedRequest } from '../../common/types';
import { TenantRole } from '@prisma/client';

const router = Router();
router.use(tenantGuard);

const registerDeviceSchema = z.object({
  name: z.string().min(1, 'Device name is required'),
  device_code: z.string().min(1, 'Device code is required'),
  ip_address: z.string().ip().optional().nullable(),
  location: z.string().optional().nullable(),
});

// 1. List devices (company_admin and manager)
router.get(
  '/',
  rolesGuard(TenantRole.company_admin, TenantRole.manager),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const devices = await devicesService.listDevices(req.tenantUser!.companyId);
      return sendSuccess(res, devices, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 2. Register device (company_admin only)
router.post(
  '/',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = registerDeviceSchema.parse(req.body);
      const device = await devicesService.registerDevice(req.tenantUser!.companyId, {
        name: body.name,
        device_code: body.device_code,
        ip_address: body.ip_address || undefined,
        location: body.location || undefined,
      });
      return sendSuccess(res, device, 201);
    } catch (err) {
      next(err);
    }
  }
);

// 3. Toggle device active state (company_admin only)
router.patch(
  '/:id/toggle',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const device = await devicesService.toggleDevice(req.tenantUser!.companyId, req.params.id);
      return sendSuccess(res, device, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 4. Trigger device sync (company_admin only)
router.post(
  '/:id/sync',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const device = await devicesService.syncDevice(req.tenantUser!.companyId, req.params.id);
      return sendSuccess(res, device, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 5. Delete device (company_admin only)
router.delete(
  '/:id',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await devicesService.deleteDevice(req.tenantUser!.companyId, req.params.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
