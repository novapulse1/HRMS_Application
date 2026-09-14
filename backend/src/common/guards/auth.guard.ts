import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { TenantRole, LicenseStatus } from '@prisma/client';
import { AuthenticatedRequest, SuperAdminJwtPayload, TenantJwtPayload } from '../types';
import { sendError } from '../utils/response.util';
import prisma from '../prisma/prisma.service';

export async function superAdminGuard(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Missing or malformed Authorization header');
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_ADMIN_SECRET;
    if (!secret) {
      throw new Error('JWT_ADMIN_SECRET is not configured');
    }
    const decoded = jwt.verify(token, secret) as SuperAdminJwtPayload;

    if (decoded.realm !== 'super_admin') {
      return sendError(res, 403, 'FORBIDDEN_REALM', 'Invalid token realm for admin portal');
    }

    const admin = await prisma.superAdmin.findUnique({
      where: { id: decoded.superAdminId },
      select: { id: true, email: true, name: true, must_change_password: true },
    });

    if (!admin) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Super admin account not found');
    }

    req.superAdmin = {
      superAdminId: admin.id,
      email: admin.email,
      name: admin.name,
      mustChangePassword: admin.must_change_password,
      realm: 'super_admin',
    };

    // If must change password and not calling the change-password route, block access
    const isChangePasswordRoute = req.path.includes('/change-password');
    if (admin.must_change_password && !isChangePasswordRoute) {
      return sendError(
        res,
        403,
        'PASSWORD_CHANGE_REQUIRED',
        'Password change required before accessing administration portal'
      );
    }

    next();
  } catch (err: unknown) {
    return sendError(res, 401, 'INVALID_TOKEN', 'Admin token is invalid or expired', err);
  }
}

export async function tenantGuard(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Missing or malformed Authorization header');
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_TENANT_SECRET;
    if (!secret) {
      throw new Error('JWT_TENANT_SECRET is not configured');
    }
    const decoded = jwt.verify(token, secret) as TenantJwtPayload;

    if (decoded.realm !== 'tenant') {
      return sendError(res, 403, 'FORBIDDEN_REALM', 'Invalid token realm for tenant portal');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        company: {
          select: {
            id: true,
            license_status: true,
            license_expiry_date: true,
          },
        },
      },
    });

    if (!user || !user.is_active) {
      return sendError(res, 401, 'UNAUTHORIZED', 'User account is inactive or not found');
    }

    // Check company license status
    if (user.company.license_status === LicenseStatus.suspended) {
      return sendError(
        res,
        403,
        'COMPANY_SUSPENDED',
        'Company account has been suspended by Nova Pulse administration'
      );
    }

    if (
      user.company.license_status === LicenseStatus.expired ||
      user.company.license_expiry_date < new Date()
    ) {
      return sendError(
        res,
        403,
        'LICENSE_EXPIRED',
        'Company subscription license has expired. Please contact administration to renew.'
      );
    }

    req.tenantUser = {
      userId: user.id,
      companyId: user.company_id,
      employeeId: user.employee_id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
      realm: 'tenant',
    };

    // If must change password and not calling change-password or me route, block access
    const isChangePasswordRoute = req.path.includes('/change-password') || req.path.endsWith('/me');
    if (user.must_change_password && !isChangePasswordRoute) {
      return sendError(
        res,
        403,
        'PASSWORD_CHANGE_REQUIRED',
        'Password change required before accessing the system'
      );
    }

    next();
  } catch (err: unknown) {
    return sendError(res, 401, 'INVALID_TOKEN', 'Tenant token is invalid or expired', err);
  }
}

export function rolesGuard(...allowedRoles: TenantRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.tenantUser) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Tenant user session not found');
    }

    if (!allowedRoles.includes(req.tenantUser.role)) {
      return sendError(
        res,
        403,
        'FORBIDDEN_ROLE',
        `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`
      );
    }

    next();
  };
}
