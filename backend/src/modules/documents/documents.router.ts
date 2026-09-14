import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DocumentType, TenantRole } from '@prisma/client';
import { tenantGuard, rolesGuard } from '../../common/guards/auth.guard';
import { AuthenticatedRequest } from '../../common/types';
import { sendSuccess, sendError } from '../../common/utils/response.util';
import { documentsService } from './documents.service';

const router = Router();

router.use(tenantGuard);

const createDocumentSchema = z.object({
  document_type: z.nativeEnum(DocumentType),
  file_name: z.string().min(1, 'File name is required'),
  file_url: z
    .string()
    .url('File URL must be a valid URL')
    .refine(
      (url) =>
        url.startsWith('https://') &&
        !url.includes('javascript:') &&
        !url.includes('data:') &&
        !url.includes('localhost') &&
        !url.includes('127.0.0.1'),
      'File URL must be a secure HTTPS storage URL'
    ),
  file_size: z.number().optional(),
  mime_type: z.string().optional(),
});

// 1. List documents for employee
router.get('/employees/:employeeId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const docs = await documentsService.listEmployeeDocuments(
      req.tenantUser!.companyId,
      req.params.employeeId,
      {
        role: req.tenantUser!.role,
        employeeId: req.tenantUser!.employeeId,
      }
    );
    return sendSuccess(res, docs);
  } catch (err: unknown) {
    next(err);
  }
});

// 2. Upload/Register document for employee (Admin, Manager)
router.post(
  '/employees/:employeeId',
  rolesGuard(TenantRole.company_admin, TenantRole.manager),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = createDocumentSchema.parse(req.body);
      const doc = await documentsService.createDocument(
        req.tenantUser!.companyId,
        req.params.employeeId,
        validated,
        {
          role: req.tenantUser!.role,
          employeeId: req.tenantUser!.employeeId,
        }
      );
      return sendSuccess(res, doc, 201);
    } catch (err: unknown) {
      return sendError(res, 400, 'DOCUMENT_CREATE_ERROR', 'Failed to create document record', err);
    }
  }
);

// 3. Delete document (Admin only)
router.delete(
  '/:id',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const deleted = await documentsService.deleteDocument(
        req.tenantUser!.companyId,
        req.params.id
      );
      return sendSuccess(res, deleted);
    } catch (err: unknown) {
      return sendError(res, 400, 'DOCUMENT_DELETE_ERROR', 'Failed to delete document', err);
    }
  }
);

export default router;
