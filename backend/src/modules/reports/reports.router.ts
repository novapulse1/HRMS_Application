import { Router, Response } from 'express';
import { TenantRole } from '@prisma/client';
import { tenantGuard, rolesGuard } from '../../common/guards/auth.guard';
import { AuthenticatedRequest } from '../../common/types';
import { sendError } from '../../common/utils/response.util';
import { reportsService } from './reports.service';

const router = Router();

router.use(tenantGuard);

// 1. Export Attendance CSV
router.get(
  '/attendance/csv',
  rolesGuard(TenantRole.company_admin, TenantRole.manager),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

      const { csv, filename } = await reportsService.exportAttendanceCsv(
        req.tenantUser!.companyId,
        month,
        year
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } catch (err: unknown) {
      return sendError(res, 500, 'REPORT_EXPORT_ERROR', 'Failed to export attendance CSV', err);
    }
  }
);

// 2. Export Leave Requests CSV
router.get(
  '/leave/csv',
  rolesGuard(TenantRole.company_admin, TenantRole.manager),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

      const { csv, filename } = await reportsService.exportLeaveCsv(
        req.tenantUser!.companyId,
        year
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } catch (err: unknown) {
      return sendError(res, 500, 'REPORT_EXPORT_ERROR', 'Failed to export leave CSV', err);
    }
  }
);

// 3. Export Payroll CSV (Company Admin only)
router.get(
  '/payroll/csv',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

      const { csv, filename } = await reportsService.exportPayrollCsv(
        req.tenantUser!.companyId,
        month,
        year
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } catch (err: unknown) {
      return sendError(res, 400, 'REPORT_EXPORT_ERROR', 'Failed to export payroll CSV', err);
    }
  }
);

export default router;
