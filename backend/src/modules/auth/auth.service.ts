import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { LicenseStatus } from '@prisma/client';
import prisma from '../../common/prisma/prisma.service';
import { AppError } from '../../common/middleware/error.middleware';
import { TenantJwtPayload } from '../../common/types';
import { tenantLoginLimiter } from '../../common/utils/login-rate-limiter';

export class AuthService {
  private getJwtSecret(): string {
    const secret = process.env.JWT_TENANT_SECRET;
    if (!secret) {
      throw new Error('JWT_TENANT_SECRET is not configured');
    }
    return secret;
  }

  async login(email: string, passwordPlain: string) {
    const cleanEmail = email.toLowerCase().trim();

    // Check rate limit (5 failed attempts max)
    tenantLoginLimiter.check(cleanEmail);

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            license_plan: true,
            license_status: true,
            license_expiry_date: true,
          },
        },
        employee: {
          select: {
            id: true,
            employee_code: true,
            first_name: true,
            last_name: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      tenantLoginLimiter.recordFailure(cleanEmail);
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (!user.is_active) {
      throw new AppError(401, 'ACCOUNT_INACTIVE', 'User account is deactivated. Contact your company administrator.');
    }

    // Tenant License Checks
    if (user.company.license_status === LicenseStatus.suspended) {
      throw new AppError(
        403,
        'COMPANY_SUSPENDED',
        'Company access has been suspended. Please contact Nova Pulse support.'
      );
    }

    if (
      user.company.license_status === LicenseStatus.expired ||
      user.company.license_expiry_date < new Date()
    ) {
      throw new AppError(
        403,
        'LICENSE_EXPIRED',
        'Company subscription license has expired. Contact your administrator to renew.'
      );
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!isMatch) {
      tenantLoginLimiter.recordFailure(cleanEmail);
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Successful login: reset failed attempts
    tenantLoginLimiter.recordSuccess(cleanEmail);

    const payload: TenantJwtPayload = {
      userId: user.id,
      companyId: user.company_id,
      employeeId: user.employee_id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
      realm: 'tenant',
    };

    const accessToken = jwt.sign(payload, this.getJwtSecret(), {
      expiresIn: '15m',
    });

    // Refresh Token Generation & Rotation Store
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiryDate,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      mustChangePassword: user.must_change_password,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.company_id,
        employeeId: user.employee_id,
        mustChangePassword: user.must_change_password,
        company: {
          id: user.company.id,
          name: user.company.name,
          licensePlan: user.company.license_plan,
        },
        employee: user.employee
          ? {
              id: user.employee.id,
              employeeCode: user.employee.employee_code,
              firstName: user.employee.first_name,
              lastName: user.employee.last_name,
              department: user.employee.department?.name,
              designation: user.employee.designation?.name,
            }
          : null,
      },
    };
  }

  async changePassword(userId: string, currentPasswordPlain: string, newPasswordPlain: string) {
    if (newPasswordPlain.length < 8) {
      throw new AppError(400, 'WEAK_PASSWORD', 'New password must be at least 8 characters long');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    const isMatch = await bcrypt.compare(currentPasswordPlain, user.password_hash);
    if (!isMatch) {
      throw new AppError(400, 'INVALID_PASSWORD', 'Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPasswordPlain, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password_hash: newHash,
        must_change_password: false,
      },
    });

    // Revoke all previous refresh tokens for security
    await prisma.refreshToken.updateMany({
      where: { user_id: userId },
      data: { is_revoked: true },
    });

    return { message: 'Password changed successfully' };
  }

  async refreshToken(rawRefreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: {
        user: {
          include: {
            company: {
              select: {
                id: true,
                license_status: true,
                license_expiry_date: true,
              },
            },
          },
        },
      },
    });

    if (!storedToken || storedToken.is_revoked || !storedToken.user) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or revoked');
    }

    if (storedToken.expires_at < new Date()) {
      throw new AppError(401, 'EXPIRED_REFRESH_TOKEN', 'Refresh token has expired. Please log in again.');
    }

    const user = storedToken.user;
    if (!user.is_active || user.company.license_status !== LicenseStatus.active) {
      throw new AppError(403, 'ACCESS_DENIED', 'User or company account is not active');
    }

    // 1. Revoke the used refresh token (strict rotation)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { is_revoked: true },
    });

    // 2. Issue new token pair
    const payload: TenantJwtPayload = {
      userId: user.id,
      companyId: user.company_id,
      employeeId: user.employee_id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
      realm: 'tenant',
    };

    const newAccessToken = jwt.sign(payload, this.getJwtSecret(), {
      expiresIn: '15m',
    });

    const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex');

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: newTokenHash,
        expires_at: expiryDate,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        company_id: true,
        employee_id: true,
        must_change_password: true,
        last_login_at: true,
        company: {
          select: {
            id: true,
            name: true,
            license_plan: true,
            license_status: true,
            license_expiry_date: true,
          },
        },
        employee: {
          select: {
            id: true,
            employee_code: true,
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
            date_of_joining: true,
            employment_type: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } },
            manager: {
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

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User profile not found');
    }

    return user;
  }
}

export const authService = new AuthService();
