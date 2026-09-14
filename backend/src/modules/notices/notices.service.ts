import { Prisma, NoticeCategory, NoticePriority, TenantRole } from '@prisma/client';
import prisma from '../../common/prisma/prisma.service';
import { AppError } from '../../common/middleware/error.middleware';

export class NoticesService {
  async listNotices(
    companyId: string,
    params: {
      search?: string;
      category?: NoticeCategory;
      priority?: NoticePriority;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const andConditions: Prisma.NoticeWhereInput[] = [
      { company_id: companyId },
    ];

    if (params.category) {
      andConditions.push({ category: params.category });
    }

    if (params.priority) {
      andConditions.push({ priority: params.priority });
    }

    if (params.search) {
      andConditions.push({
        OR: [
          { title: { contains: params.search, mode: 'insensitive' } },
          { content: { contains: params.search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.NoticeWhereInput = {
      AND: andConditions,
    };

    const [total, notices] = await Promise.all([
      prisma.notice.count({ where }),
      prisma.notice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { is_pinned: 'desc' },
          { created_at: 'desc' },
        ],
        include: {
          author: {
            select: {
              id: true,
              email: true,
              role: true,
              employee: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  employee_code: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      notices,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createNotice(
    companyId: string,
    authorId: string,
    data: {
      title: string;
      content: string;
      category?: NoticeCategory;
      priority?: NoticePriority;
      is_pinned?: boolean;
    }
  ) {
    return prisma.notice.create({
      data: {
        company_id: companyId,
        author_id: authorId,
        title: data.title.trim(),
        content: data.content.trim(),
        category: data.category || NoticeCategory.general,
        priority: data.priority || NoticePriority.normal,
        is_pinned: data.is_pinned || false,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            role: true,
            employee: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                employee_code: true,
              },
            },
          },
        },
      },
    });
  }

  async updateNotice(
    companyId: string,
    noticeId: string,
    userId: string,
    userRole: TenantRole,
    data: {
      title?: string;
      content?: string;
      category?: NoticeCategory;
      priority?: NoticePriority;
      is_pinned?: boolean;
    }
  ) {
    const notice = await prisma.notice.findFirst({
      where: { id: noticeId, company_id: companyId },
    });

    if (!notice) {
      throw new AppError(404, 'NOT_FOUND', 'Notice not found in your organization');
    }

    // Managers can only edit their own notices; Admin can edit any
    if (userRole === TenantRole.manager && notice.author_id !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Managers can only edit notices they authored');
    }

    return prisma.notice.update({
      where: { id: noticeId },
      data: {
        title: data.title !== undefined ? data.title.trim() : undefined,
        content: data.content !== undefined ? data.content.trim() : undefined,
        category: data.category !== undefined ? data.category : undefined,
        priority: data.priority !== undefined ? data.priority : undefined,
        is_pinned: data.is_pinned !== undefined ? data.is_pinned : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            role: true,
            employee: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                employee_code: true,
              },
            },
          },
        },
      },
    });
  }

  async deleteNotice(
    companyId: string,
    noticeId: string,
    userId: string,
    userRole: TenantRole
  ) {
    const notice = await prisma.notice.findFirst({
      where: { id: noticeId, company_id: companyId },
    });

    if (!notice) {
      throw new AppError(404, 'NOT_FOUND', 'Notice not found in your organization');
    }

    if (userRole === TenantRole.manager && notice.author_id !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Managers can only delete notices they authored');
    }

    await prisma.notice.delete({
      where: { id: noticeId },
    });

    return { message: 'Notice deleted successfully' };
  }

  async togglePinNotice(
    companyId: string,
    noticeId: string
  ) {
    const notice = await prisma.notice.findFirst({
      where: { id: noticeId, company_id: companyId },
    });

    if (!notice) {
      throw new AppError(404, 'NOT_FOUND', 'Notice not found in your organization');
    }

    return prisma.notice.update({
      where: { id: noticeId },
      data: {
        is_pinned: !notice.is_pinned,
      },
    });
  }
}

export const noticesService = new NoticesService();
