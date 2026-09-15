import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from './auth.service';
import { tenantGuard } from '../../common/guards/auth.guard';
import { authRateLimiter } from '../../common/middleware/rate-limit';
import { sendSuccess } from '../../common/utils/response.util';
import { AuthenticatedRequest } from '../../common/types';

const router = Router();

// 1. Tenant Login
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
      const result = await authService.login(email, password);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 2. Tenant Change Password (Forced or Voluntary)
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post(
  '/change-password',
  tenantGuard,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const result = await authService.changePassword(
        req.tenantUser!.userId,
        currentPassword,
        newPassword
      );
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 3. Refresh Token Rotation
const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post(
  '/refresh',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      const result = await authService.refreshToken(refreshToken);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 4. Current Tenant User Profile
router.get(
  '/me',
  tenantGuard,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getMe(req.tenantUser!.userId);
      return sendSuccess(res, user, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 5. Update Current Tenant User Profile (Avatar / Phone)
const updateProfileSchema = z.object({
  avatar_url: z.string().optional(),
  phone: z.string().optional(),
});

router.patch(
  '/me',
  tenantGuard,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = updateProfileSchema.parse(req.body);
      const user = await authService.updateProfile(req.tenantUser!.userId, validated);
      return sendSuccess(res, user, 200);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
