import { Request } from 'express';
import { TenantRole } from '@prisma/client';

export interface ApiResponseMeta {
  timestamp: string;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: ApiErrorPayload | null;
  meta: ApiResponseMeta;
}

export interface SuperAdminJwtPayload {
  superAdminId: string;
  email: string;
  name: string;
  mustChangePassword: boolean;
  realm: 'super_admin';
}

export interface TenantJwtPayload {
  userId: string;
  companyId: string;
  employeeId?: string | null;
  email: string;
  role: TenantRole;
  mustChangePassword: boolean;
  realm: 'tenant';
}

export interface AuthenticatedRequest extends Request {
  superAdmin?: SuperAdminJwtPayload;
  tenantUser?: TenantJwtPayload;
}
