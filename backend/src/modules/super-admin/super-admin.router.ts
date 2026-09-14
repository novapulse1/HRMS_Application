import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { superAdminService } from './super-admin.service';
import { superAdminGuard } from '../../common/guards/auth.guard';
import { authRateLimiter } from '../../common/middleware/rate-limit';
import { sendSuccess } from '../../common/utils/response.util';
import { AuthenticatedRequest } from '../../common/types';
import { LicensePlan, LicenseStatus } from '@prisma/client';

const router = Router();

// 1. Super Admin Login
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  '/login',
  authRateLimiter,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const result = await superAdminService.login(email, password);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 2. Change Password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post(
  '/change-password',
  superAdminGuard,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const result = await superAdminService.changePassword(
        req.superAdmin!.superAdminId,
        currentPassword,
        newPassword
      );
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 3. Current Super Admin Profile
router.get(
  '/me',
  superAdminGuard,
  async (req: AuthenticatedRequest, res: Response) => {
    return sendSuccess(res, { admin: req.superAdmin }, 200);
  }
);

// 4. Dashboard Analytics
router.get(
  '/dashboard',
  superAdminGuard,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await superAdminService.getDashboardAnalytics();
      return sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 5. Onboard Company
const createCompanySchema = z.object({
  name: z.string().min(2),
  industry: z.string().optional(),
  size_range: z.string().optional(),
  contact_person_name: z.string().min(2),
  contact_email: z.string().email(),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
  license_plan: z.nativeEnum(LicensePlan).optional(),
  license_expiry_date: z.string().optional(),
});

router.post(
  '/companies',
  superAdminGuard,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = createCompanySchema.parse(req.body);
      const result = await superAdminService.createCompany(
        req.superAdmin!.superAdminId,
        validated
      );
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }
);

// 6. List Companies
router.get(
  '/companies',
  superAdminGuard,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { page, limit, search, license_status, license_plan } = req.query;
      const result = await superAdminService.listCompanies({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search ? String(search) : undefined,
        license_status: license_status as LicenseStatus,
        license_plan: license_plan as LicensePlan,
      });
      return sendSuccess(res, result.companies, 200, result.meta);
    } catch (err) {
      next(err);
    }
  }
);

// 7. Get Company Details
router.get(
  '/companies/:id',
  superAdminGuard,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const company = await superAdminService.getCompanyById(req.params.id);
      return sendSuccess(res, company, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 8. Update Company
const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  industry: z.string().optional(),
  size_range: z.string().optional(),
  contact_person_name: z.string().optional(),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
  license_plan: z.nativeEnum(LicensePlan).optional(),
  license_status: z.nativeEnum(LicenseStatus).optional(),
  license_expiry_date: z.string().optional(),
});

router.patch(
  '/companies/:id',
  superAdminGuard,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = updateCompanySchema.parse(req.body);
      const updated = await superAdminService.updateCompany(
        req.params.id,
        req.superAdmin!.superAdminId,
        validated
      );
      return sendSuccess(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 9. Set Company Status (Suspend/Activate)
const statusSchema = z.object({
  status: z.nativeEnum(LicenseStatus),
});

router.patch(
  '/companies/:id/status',
  superAdminGuard,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { status } = statusSchema.parse(req.body);
      const updated = await superAdminService.setCompanyStatus(
        req.params.id,
        req.superAdmin!.superAdminId,
        status
      );
      return sendSuccess(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 10. Reset Company Admin Password
router.post(
  '/companies/:id/reset-password',
  superAdminGuard,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await superAdminService.resetCompanyAdminPassword(
        req.params.id,
        req.superAdmin!.superAdminId
      );
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 11. Scheduled / On-Demand License Expiry Sweep
router.post(
  '/license-sweep',
  superAdminGuard,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await superAdminService.sweepExpiredLicenses();
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
