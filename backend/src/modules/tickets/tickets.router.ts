import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ticketsService } from './tickets.service';
import { tenantGuard, rolesGuard } from '../../common/guards/auth.guard';
import { sendSuccess } from '../../common/utils/response.util';
import { AuthenticatedRequest } from '../../common/types';
import { TenantRole, TicketStatus, TicketPriority } from '@prisma/client';

const router = Router();
router.use(tenantGuard);

const createTicketSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  subject: z.string().min(3, 'Subject must be at least 3 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  priority: z.nativeEnum(TicketPriority).optional(),
});

// 1. Create Ticket (All tenant roles)
router.post(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = createTicketSchema.parse(req.body);
      const ticket = await ticketsService.createTicket(
        req.tenantUser!.companyId,
        req.tenantUser!.userId,
        req.tenantUser!.employeeId || null,
        validated
      );
      return sendSuccess(res, ticket, 201);
    } catch (err) {
      next(err);
    }
  }
);

// 2. Ticket Analytics (Admin only - must be registered before /:id)
router.get(
  '/analytics',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const analytics = await ticketsService.getTicketAnalytics(req.tenantUser!.companyId);
      return sendSuccess(res, analytics, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 3. List Tickets (Scoped by role: Admin all, Manager reports/self, Employee self)
router.get(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { status, priority, category } = req.query;
      const tickets = await ticketsService.listTickets(
        req.tenantUser!.companyId,
        req.tenantUser!.role,
        req.tenantUser!.userId,
        req.tenantUser!.employeeId || null,
        {
          status: status as TicketStatus,
          priority: priority as TicketPriority,
          category: category ? String(category) : undefined,
        }
      );
      return sendSuccess(res, tickets, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 4. Get Ticket Details (Scoped)
router.get(
  '/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ticket = await ticketsService.getTicketById(
        req.tenantUser!.companyId,
        req.tenantUser!.role,
        req.tenantUser!.userId,
        req.tenantUser!.employeeId || null,
        req.params.id
      );
      return sendSuccess(res, ticket, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 5. Assign Ticket (Admin Only - Managers & Employees rejected with 403)
const assignSchema = z
  .object({
    assigned_to: z.string().uuid('Invalid user UUID for assignee').optional(),
    assignee_user_id: z.string().uuid('Invalid user UUID for assignee').optional(),
  })
  .refine((d) => d.assigned_to || d.assignee_user_id, 'Assignee ID is required');

router.patch(
  '/:id/assign',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = assignSchema.parse(req.body);
      const targetUserId = (validated.assigned_to || validated.assignee_user_id)!;
      const updated = await ticketsService.assignTicket(
        req.tenantUser!.companyId,
        req.tenantUser!.role,
        req.params.id,
        targetUserId
      );
      return sendSuccess(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 6. Update Status & Resolution (Admin Only)
const updateStatusSchema = z.object({
  status: z.nativeEnum(TicketStatus),
  resolution: z.string().optional(),
});

router.patch(
  '/:id/status',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = updateStatusSchema.parse(req.body);
      const updated = await ticketsService.updateTicketStatus(
        req.tenantUser!.companyId,
        req.tenantUser!.role,
        req.params.id,
        validated
      );
      return sendSuccess(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
