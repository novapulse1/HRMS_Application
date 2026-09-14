import crypto from 'crypto';
import prisma from '../../common/prisma/prisma.service';
import { AppError } from '../../common/middleware/error.middleware';
import { TenantRole, TicketStatus, TicketPriority, Prisma } from '@prisma/client';

export interface CreateTicketDto {
  category: string;
  subject: string;
  description: string;
  priority?: TicketPriority;
}

export class TicketsService {
  private calculateSlaDueDate(priority: TicketPriority): Date {
    const now = new Date();
    let hours = 48; // default medium
    switch (priority) {
      case TicketPriority.urgent:
        hours = 8;
        break;
      case TicketPriority.high:
        hours = 24;
        break;
      case TicketPriority.medium:
        hours = 48;
        break;
      case TicketPriority.low:
        hours = 72;
        break;
    }
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  private async generateTicketNumber(companyId: string): Promise<string> {
    const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
    const count = await prisma.ticket.count({
      where: { company_id: companyId },
    });
    const seq = String(count + 1).padStart(4, '0');
    const candidate = `TICK-${datePrefix}-${seq}`;

    const existing = await prisma.ticket.findFirst({
      where: { company_id: companyId, ticket_number: candidate },
    });
    if (!existing) {
      return candidate;
    }
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TICK-${datePrefix}-${seq}-${rand}`;
  }

  async createTicket(
    companyId: string,
    userId: string,
    employeeId: string | null,
    data: CreateTicketDto
  ) {
    if (!employeeId) {
      throw new AppError(400, 'NO_EMPLOYEE_PROFILE', 'User must have an employee profile to raise a ticket');
    }

    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, company_id: companyId },
    });
    if (!emp) {
      throw new AppError(404, 'NOT_FOUND', 'Employee record not found in this company');
    }

    const priority = data.priority || TicketPriority.medium;
    const slaDueAt = this.calculateSlaDueDate(priority);
    const ticketNumber = await this.generateTicketNumber(companyId);

    return prisma.ticket.create({
      data: {
        company_id: companyId,
        ticket_number: ticketNumber,
        employee_id: employeeId,
        created_by: userId,
        category: data.category.trim(),
        subject: data.subject.trim(),
        description: data.description.trim(),
        priority,
        status: TicketStatus.open,
        sla_due_at: slaDueAt,
      },
      include: {
        employee: {
          select: { id: true, employee_code: true, first_name: true, last_name: true },
        },
        creator: {
          select: { id: true, email: true },
        },
      },
    });
  }

  async listTickets(
    companyId: string,
    role: TenantRole,
    userId: string,
    employeeId: string | null,
    filters: { status?: TicketStatus; priority?: TicketPriority; category?: string } = {}
  ) {
    const where: Prisma.TicketWhereInput = {
      company_id: companyId,
    };

    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.category) where.category = { contains: filters.category, mode: 'insensitive' };

    // RBAC Scoping
    if (role === TenantRole.employee) {
      if (!employeeId) throw new AppError(403, 'FORBIDDEN', 'No employee profile linked');
      where.OR = [
        { employee_id: employeeId },
        { created_by: userId },
      ];
    } else if (role === TenantRole.manager) {
      if (!employeeId) throw new AppError(403, 'FORBIDDEN', 'No employee profile linked');
      where.OR = [
        { employee_id: employeeId }, // Tickets raised by manager self
        { employee: { manager_id: employeeId } }, // Tickets raised by manager's direct reports
      ];
    }
    // company_admin sees all tickets

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            employee_code: true,
            first_name: true,
            last_name: true,
            department: { select: { name: true } },
          },
        },
        creator: {
          select: { id: true, email: true },
        },
        assignee: {
          select: { id: true, email: true },
        },
      },
    });

    const now = new Date();
    return tickets.map((t) => ({
      ...t,
      is_overdue: Boolean(
        t.sla_due_at &&
        (t.resolved_at
          ? t.resolved_at > t.sla_due_at
          : (now > t.sla_due_at && t.status !== TicketStatus.closed && t.status !== TicketStatus.resolved))
      ),
    }));
  }

  async getTicketById(
    companyId: string,
    role: TenantRole,
    userId: string,
    employeeId: string | null,
    ticketId: string
  ) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, company_id: companyId },
      include: {
        employee: {
          select: {
            id: true,
            employee_code: true,
            first_name: true,
            last_name: true,
            manager_id: true,
            department: { select: { name: true } },
          },
        },
        creator: { select: { id: true, email: true } },
        assignee: { select: { id: true, email: true } },
      },
    });

    if (!ticket) {
      throw new AppError(404, 'NOT_FOUND', 'Ticket not found');
    }

    // Role-based visibility check
    if (role === TenantRole.employee) {
      if (ticket.employee_id !== employeeId && ticket.created_by !== userId) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view this ticket');
      }
    } else if (role === TenantRole.manager) {
      const isSelf = ticket.employee_id === employeeId;
      const isSubordinate = ticket.employee.manager_id === employeeId;
      if (!isSelf && !isSubordinate) {
        throw new AppError(403, 'FORBIDDEN', 'Managers can only view tickets raised by themselves or direct reports');
      }
    }

    const now = new Date();
    return {
      ...ticket,
      is_overdue: Boolean(
        ticket.sla_due_at &&
        (ticket.resolved_at
          ? ticket.resolved_at > ticket.sla_due_at
          : (now > ticket.sla_due_at && ticket.status !== TicketStatus.closed && ticket.status !== TicketStatus.resolved))
      ),
    };
  }

  async assignTicket(companyId: string, role: TenantRole, ticketId: string, assigneeUserId: string) {
    if (role !== TenantRole.company_admin) {
      throw new AppError(403, 'FORBIDDEN', 'Only company administrators can assign support tickets');
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, company_id: companyId },
    });
    if (!ticket) {
      throw new AppError(404, 'NOT_FOUND', 'Ticket not found');
    }

    // Verify assignee exists in same company
    const assigneeUser = await prisma.user.findFirst({
      where: { id: assigneeUserId, company_id: companyId },
    });
    if (!assigneeUser) {
      throw new AppError(404, 'ASSIGNEE_NOT_FOUND', 'Assignee user not found in this company');
    }

    return prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assigned_to: assigneeUserId,
        status: ticket.status === TicketStatus.open ? TicketStatus.in_progress : ticket.status,
      },
      include: {
        assignee: { select: { id: true, email: true } },
      },
    });
  }

  async updateTicketStatus(
    companyId: string,
    role: TenantRole,
    ticketId: string,
    data: { status: TicketStatus; resolution?: string }
  ) {
    if (role !== TenantRole.company_admin) {
      throw new AppError(403, 'FORBIDDEN', 'Only company administrators can update ticket status or resolution');
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, company_id: companyId },
    });
    if (!ticket) {
      throw new AppError(404, 'NOT_FOUND', 'Ticket not found');
    }

    const isResolving = data.status === TicketStatus.resolved || data.status === TicketStatus.closed;

    return prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: data.status,
        resolution: data.resolution ? data.resolution.trim() : ticket.resolution,
        resolved_at: isResolving ? new Date() : null,
      },
      include: {
        employee: {
          select: { id: true, employee_code: true, first_name: true, last_name: true },
        },
        assignee: {
          select: { id: true, email: true },
        },
      },
    });
  }

  async getTicketAnalytics(companyId: string) {
    const [total, statusCounts, priorityCounts, tickets] = await Promise.all([
      prisma.ticket.count({ where: { company_id: companyId } }),
      prisma.ticket.groupBy({
        by: ['status'],
        where: { company_id: companyId },
        _count: { id: true },
      }),
      prisma.ticket.groupBy({
        by: ['priority'],
        where: { company_id: companyId },
        _count: { id: true },
      }),
      prisma.ticket.findMany({
        where: { company_id: companyId },
        select: { sla_due_at: true, resolved_at: true, status: true },
      }),
    ]);

    const byStatus: Record<string, number> = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
    };
    for (const s of statusCounts) {
      byStatus[s.status] = s._count.id;
    }

    const byPriority: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };
    for (const p of priorityCounts) {
      byPriority[p.priority] = p._count.id;
    }

    // SLA compliance
    let slaBreached = 0;
    const now = new Date();
    for (const t of tickets) {
      if (t.sla_due_at) {
        if (t.resolved_at && t.resolved_at > t.sla_due_at) {
          slaBreached++;
        } else if (!t.resolved_at && now > t.sla_due_at && t.status !== TicketStatus.closed && t.status !== TicketStatus.resolved) {
          slaBreached++;
        }
      }
    }

    const slaComplianceRate = total > 0 ? Math.round(((total - slaBreached) / total) * 100) : 100;

    return {
      totalTickets: total,
      byStatus,
      byPriority,
      slaBreachedCount: slaBreached,
      slaComplianceRate,
    };
  }
}

export const ticketsService = new TicketsService();
