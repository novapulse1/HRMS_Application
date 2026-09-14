import { Router, Response } from 'express';
import { TenantRole } from '@prisma/client';
import { tenantGuard, rolesGuard } from '../../common/guards/auth.guard';
import { AuthenticatedRequest } from '../../common/types';
import { sendSuccess, sendError } from '../../common/utils/response.util';
import { auditLogsService } from './audit-logs.service';

const router = Router();

router.use(tenantGuard);

// 1. List audit logs (Company Admin only)
router.get(
  '/',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;

      const result = await auditLogsService.listLogs(
        req.tenantUser!.companyId,
        page,
        limit
      );

      return sendSuccess(res, result.logs, 200, result.pagination);
    } catch (err: unknown) {
      return sendError(res, 500, 'AUDIT_LOGS_ERROR', 'Failed to retrieve audit logs', err);
    }
  }
);

export default router;
