import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  Prisma,
  LicensePlan,
  LicenseStatus,
  TenantRole,
  EmploymentType,
  EmployeeStatus,
} from '@prisma/client';
import prisma from '../../common/prisma/prisma.service';
import { AppError } from '../../common/middleware/error.middleware';
import { SuperAdminJwtPayload } from '../../common/types';
import { superAdminLoginLimiter } from '../../common/utils/login-rate-limiter';

export class SuperAdminService {
  private getJwtSecret(): string {
    const secret = process.env.JWT_ADMIN_SECRET;
    if (!secret) {
      throw new Error('JWT_ADMIN_SECRET is not configured');
    }
    return secret;
  }

  async login(email: string, passwordPlain: string) {
    const cleanEmail = email.toLowerCase().trim();
    superAdminLoginLimiter.check(cleanEmail);

    const admin = await prisma.superAdmin.findUnique({
      where: { email: cleanEmail },
    });

    if (!admin) {
      superAdminLoginLimiter.recordFailure(cleanEmail);
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const isMatch = await bcrypt.compare(passwordPlain, admin.password_hash);
    if (!isMatch) {
      superAdminLoginLimiter.recordFailure(cleanEmail);
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    superAdminLoginLimiter.recordSuccess(cleanEmail);

    const payload: SuperAdminJwtPayload = {
      superAdminId: admin.id,
      email: admin.email,
      name: admin.name,
      mustChangePassword: admin.must_change_password,
      realm: 'super_admin',
    };

    const accessToken = jwt.sign(payload, this.getJwtSecret(), {
      expiresIn: '15m',
    });

    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        super_admin_id: admin.id,
        token_hash: tokenHash,
        expires_at: expiryDate,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      mustChangePassword: admin.must_change_password,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        mustChangePassword: admin.must_change_password,
      },
    };
  }

  async changePassword(superAdminId: string, currentPasswordPlain: string, newPasswordPlain: string) {
    if (newPasswordPlain.length < 8) {
      throw new AppError(400, 'WEAK_PASSWORD', 'New password must be at least 8 characters long');
    }

    const admin = await prisma.superAdmin.findUnique({
      where: { id: superAdminId },
    });

    if (!admin) {
      throw new AppError(404, 'NOT_FOUND', 'Super admin not found');
    }

    const isMatch = await bcrypt.compare(currentPasswordPlain, admin.password_hash);
    if (!isMatch) {
      throw new AppError(400, 'INVALID_PASSWORD', 'Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPasswordPlain, 10);

    await prisma.superAdmin.update({
      where: { id: superAdminId },
      data: {
        password_hash: newHash,
        must_change_password: false,
      },
    });

    // Revoke previous refresh tokens
    await prisma.refreshToken.updateMany({
      where: { super_admin_id: superAdminId },
      data: { is_revoked: true },
    });

    return { message: 'Password updated successfully' };
  }

  async createCompany(
    superAdminId: string,
    data: {
      name: string;
      industry?: string;
      size_range?: string;
      contact_person_name?: string;
      contact_email: string;
      contact_phone?: string;
      address?: string;
      license_plan?: LicensePlan;
      license_expiry_date?: string | Date;
    }
  ) {
    const adminEmail = data.contact_email.toLowerCase().trim();

    // Check if user email already exists globally
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });
    if (existingUser) {
      throw new AppError(400, 'EMAIL_EXISTS', `A user account with email "${adminEmail}" already exists`);
    }

    // Default expiry is 1 year if not provided
    let expiry = data.license_expiry_date ? new Date(data.license_expiry_date) : new Date();
    if (!data.license_expiry_date) {
      expiry.setDate(expiry.getDate() + 365);
    }

    const temporaryPassword = crypto.randomBytes(10).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create company
      const company = await tx.company.create({
        data: {
          name: data.name.trim(),
          industry: data.industry,
          size_range: data.size_range,
          contact_person_name: data.contact_person_name,
          contact_email: adminEmail,
          contact_phone: data.contact_phone,
          address: data.address,
          license_plan: data.license_plan || LicensePlan.trial,
          license_status: LicenseStatus.active,
          license_start_date: new Date(),
          license_expiry_date: expiry,
          created_by: superAdminId,
          settings: {
            create: {
              working_days_json: ['mon', 'tue', 'wed', 'thu', 'fri'],
              working_hours_start: '09:00',
              working_hours_end: '18:00',
              payroll_cycle_day: 28,
              overtime_enabled: false,
              overtime_rate_multiplier: 1.5,
            },
          },
        },
      });

      // 2. Default Department & Designation
      const defaultDept = await tx.department.create({
        data: {
          company_id: company.id,
          name: 'Executive Management',
        },
      });

      const defaultDesig = await tx.designation.create({
        data: {
          company_id: company.id,
          department_id: defaultDept.id,
          name: 'Company Administrator',
        },
      });

      // 3. Default Shift
      const defaultShift = await tx.shift.create({
        data: {
          company_id: company.id,
          name: 'Standard Working Hours',
          start_time: '09:00',
          end_time: '18:00',
          is_night_shift: false,
        },
      });

      // 4. Default Leave Types
      await tx.leaveType.createMany({
        data: [
          { company_id: company.id, name: 'Casual Leave', is_paid: true, default_annual_quota: 12 },
          { company_id: company.id, name: 'Sick Leave', is_paid: true, default_annual_quota: 10 },
          { company_id: company.id, name: 'Annual Leave', is_paid: true, default_annual_quota: 15 },
          { company_id: company.id, name: 'Unpaid Leave', is_paid: false, default_annual_quota: 0 },
        ],
      });

      // 5. Initial Employee Record
      const adminEmployee = await tx.employee.create({
        data: {
          company_id: company.id,
          employee_code: 'EMP-001',
          first_name: data.contact_person_name ? data.contact_person_name.split(' ')[0] : 'Admin',
          last_name: data.contact_person_name && data.contact_person_name.split(' ').length > 1
            ? data.contact_person_name.split(' ').slice(1).join(' ')
            : 'User',
          email: adminEmail,
          phone: data.contact_phone,
          department_id: defaultDept.id,
          designation_id: defaultDesig.id,
          date_of_joining: new Date(),
          employment_type: EmploymentType.full_time,
          status: EmployeeStatus.active,
          shifts: {
            create: {
              company_id: company.id,
              shift_id: defaultShift.id,
              effective_from: new Date(),
            },
          },
        },
      });

      // 6. User account with role company_admin
      const adminUser = await tx.user.create({
        data: {
          company_id: company.id,
          employee_id: adminEmployee.id,
          email: adminEmail,
          password_hash: passwordHash,
          role: TenantRole.company_admin,
          must_change_password: true,
          is_active: true,
        },
      });

      // Update employee with user_id
      await tx.employee.update({
        where: { id: adminEmployee.id },
        data: { user_id: adminUser.id },
      });

      // 7. Audit log entry
      await tx.auditLog.create({
        data: {
          company_id: company.id,
          user_id: superAdminId,
          action: 'CREATE_COMPANY',
          entity_type: 'company',
          entity_id: company.id,
          new_value_json: {
            name: company.name,
            plan: company.license_plan,
            contact_email: company.contact_email,
          },
        },
      });

      return {
        company,
        adminCredentials: {
          email: adminEmail,
          temporaryPassword,
          mustChangePassword: true,
        },
      };
    });

    return result;
  }

  async listCompanies(params: {
    page?: number;
    limit?: number;
    search?: string;
    license_status?: LicenseStatus;
    license_plan?: LicensePlan;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { contact_email: { contains: params.search, mode: 'insensitive' } },
        { contact_person_name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.license_status) {
      where.license_status = params.license_status;
    }

    if (params.license_plan) {
      where.license_plan = params.license_plan;
    }

    const [total, companies] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          _count: {
            select: {
              employees: true,
              users: true,
              departments: true,
            },
          },
        },
      }),
    ]);

    return {
      companies,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCompanyById(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        settings: true,
        _count: {
          select: {
            employees: true,
            users: true,
            departments: true,
            designations: true,
            shifts: true,
          },
        },
      },
    });

    if (!company) {
      throw new AppError(404, 'NOT_FOUND', 'Company not found');
    }

    return company;
  }

  async updateCompany(
    companyId: string,
    superAdminId: string,
    data: {
      name?: string;
      industry?: string;
      size_range?: string;
      contact_person_name?: string;
      contact_phone?: string;
      address?: string;
      license_plan?: LicensePlan;
      license_status?: LicenseStatus;
      license_expiry_date?: string | Date;
    }
  ) {
    const existing = await prisma.company.findUnique({ where: { id: companyId } });
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Company not found');
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...data,
        license_expiry_date: data.license_expiry_date
          ? new Date(data.license_expiry_date)
          : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        company_id: companyId,
        user_id: superAdminId,
        action: 'UPDATE_COMPANY',
        entity_type: 'company',
        entity_id: companyId,
        old_value_json: JSON.parse(JSON.stringify(existing)),
        new_value_json: JSON.parse(JSON.stringify(updated)),
      },
    });

    return updated;
  }

  async setCompanyStatus(
    companyId: string,
    superAdminId: string,
    status: LicenseStatus
  ) {
    const existing = await prisma.company.findUnique({ where: { id: companyId } });
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Company not found');
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { license_status: status },
    });

    await prisma.auditLog.create({
      data: {
        company_id: companyId,
        user_id: superAdminId,
        action: 'CHANGE_COMPANY_STATUS',
        entity_type: 'company',
        entity_id: companyId,
        old_value_json: { status: existing.license_status },
        new_value_json: { status },
      },
    });

    return updated;
  }

  async resetCompanyAdminPassword(companyId: string, superAdminId: string) {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new AppError(404, 'NOT_FOUND', 'Company not found');
    }

    let adminUser = await prisma.user.findFirst({
      where: {
        company_id: companyId,
        role: TenantRole.company_admin,
      },
    });

    const temporaryPassword = crypto.randomBytes(10).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    if (!adminUser) {
      const email = company.contact_email || `admin@${company.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
      adminUser = await prisma.user.create({
        data: {
          company_id: companyId,
          email,
          password_hash: passwordHash,
          role: TenantRole.company_admin,
          must_change_password: true,
          is_active: true,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: {
          password_hash: passwordHash,
          must_change_password: true,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        company_id: companyId,
        user_id: superAdminId,
        action: 'RESET_COMPANY_ADMIN_PASSWORD',
        entity_type: 'user',
        entity_id: adminUser.id,
      },
    });

    return {
      email: adminUser.email,
      temporaryPassword,
      mustChangePassword: true,
    };
  }

  async getDashboardAnalytics() {
    const now = new Date();
    const [totalCompanies, activeCompanies, suspendedCompanies, expiredCompanies, totalEmployees] =
      await Promise.all([
        prisma.company.count(),
        prisma.company.count({ where: { license_status: LicenseStatus.active, license_expiry_date: { gte: now } } }),
        prisma.company.count({ where: { license_status: LicenseStatus.suspended } }),
        prisma.company.count({
          where: {
            OR: [
              { license_status: LicenseStatus.expired },
              { license_expiry_date: { lt: now } },
            ],
          },
        }),
        prisma.employee.count(),
      ]);

    const recentCompanies = await prisma.company.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        contact_email: true,
        license_plan: true,
        license_status: true,
        license_expiry_date: true,
        created_at: true,
        _count: {
          select: { employees: true },
        },
      },
    });

    return {
      metrics: {
        totalCompanies,
        activeCompanies,
        suspendedCompanies,
        expiredCompanies,
        totalEmployees,
      },
      recentCompanies,
    };
  }

  async sweepExpiredLicenses() {
    const now = new Date();
    const expired = await prisma.company.findMany({
      where: {
        license_status: LicenseStatus.active,
        license_expiry_date: { lt: now },
      },
      select: { id: true, name: true },
    });

    if (expired.length === 0) {
      return { sweptCount: 0, companyIds: [] };
    }

    const companyIds = expired.map((c) => c.id);

    await prisma.company.updateMany({
      where: { id: { in: companyIds } },
      data: { license_status: LicenseStatus.expired },
    });

    return {
      sweptCount: expired.length,
      companies: expired,
    };
  }
}

export const superAdminService = new SuperAdminService();
