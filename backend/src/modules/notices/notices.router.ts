import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { noticesService } from './notices.service';
import { tenantGuard, rolesGuard } from '../../common/guards/auth.guard';
import { sendSuccess } from '../../common/utils/response.util';
import { AuthenticatedRequest } from '../../common/types';
import { TenantRole, NoticeCategory, NoticePriority } from '@prisma/client';

const router = Router();

// Apply tenant authentication to all notice routes
router.use(tenantGuard);

// 1. List Notices (Accessible by company_admin, manager, employee)
router.get(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { search, category, priority, page, limit } = req.query;
      const result = await noticesService.listNotices(req.tenantUser!.companyId, {
        search: search ? String(search) : undefined,
        category: category as NoticeCategory,
        priority: priority as NoticePriority,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return sendSuccess(res, result.notices, 200, result.meta);
    } catch (err) {
      next(err);
    }
  }
);

// 2. Create Notice (Admin & Manager)
const createNoticeSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  content: z.string().min(5, 'Notice content must be at least 5 characters'),
  category: z.nativeEnum(NoticeCategory).optional(),
  priority: z.nativeEnum(NoticePriority).optional(),
  is_pinned: z.boolean().optional(),
});

router.post(
  '/',
  rolesGuard(TenantRole.company_admin, TenantRole.manager),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = createNoticeSchema.parse(req.body);
      const notice = await noticesService.createNotice(
        req.tenantUser!.companyId,
        req.tenantUser!.userId,
        validated
      );

      return sendSuccess(res, notice, 201);
    } catch (err) {
      next(err);
    }
  }
);

// 3. Update Notice (Admin & Manager)
const updateNoticeSchema = z.object({
  title: z.string().min(2).optional(),
  content: z.string().min(5).optional(),
  category: z.nativeEnum(NoticeCategory).optional(),
  priority: z.nativeEnum(NoticePriority).optional(),
  is_pinned: z.boolean().optional(),
});

router.patch(
  '/:id',
  rolesGuard(TenantRole.company_admin, TenantRole.manager),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = updateNoticeSchema.parse(req.body);
      const notice = await noticesService.updateNotice(
        req.tenantUser!.companyId,
        req.params.id,
        req.tenantUser!.userId,
        req.tenantUser!.role,
        validated
      );

      return sendSuccess(res, notice, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 4. Delete Notice (Admin & Manager)
router.delete(
  '/:id',
  rolesGuard(TenantRole.company_admin, TenantRole.manager),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await noticesService.deleteNotice(
        req.tenantUser!.companyId,
        req.params.id,
        req.tenantUser!.userId,
        req.tenantUser!.role
      );

      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 5. Toggle Pin (Admin & Manager)
router.patch(
  '/:id/pin',
  rolesGuard(TenantRole.company_admin, TenantRole.manager),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const notice = await noticesService.togglePinNotice(
        req.tenantUser!.companyId,
        req.params.id
      );

      return sendSuccess(res, notice, 200);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
