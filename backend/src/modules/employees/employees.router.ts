import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { employeesService } from './employees.service';
import { tenantGuard, rolesGuard } from '../../common/guards/auth.guard';
import { sendSuccess } from '../../common/utils/response.util';
import { AuthenticatedRequest } from '../../common/types';
import { TenantRole, EmploymentType, EmployeeStatus, PayType } from '@prisma/client';

const router = Router();

// Apply tenantGuard to all routes in this module
router.use(tenantGuard);

// 1. Departments
router.get(
  '/departments',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const depts = await employeesService.listDepartments(req.tenantUser!.companyId);
      return sendSuccess(res, depts, 200);
    } catch (err) {
      next(err);
    }
  }
);

const createDeptSchema = z.object({
  name: z.string().min(2),
});

router.post(
  '/departments',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { name } = createDeptSchema.parse(req.body);
      const dept = await employeesService.createDepartment(req.tenantUser!.companyId, name);
      return sendSuccess(res, dept, 201);
    } catch (err) {
      next(err);
    }
  }
);

// 2. Designations
router.get(
  '/designations',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { department_id } = req.query;
      const desigs = await employeesService.listDesignations(
        req.tenantUser!.companyId,
        department_id ? String(department_id) : undefined
      );
      return sendSuccess(res, desigs, 200);
    } catch (err) {
      next(err);
    }
  }
);

const createDesigSchema = z.object({
  name: z.string().min(2),
  department_id: z.string().optional(),
});

router.post(
  '/designations',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = createDesigSchema.parse(req.body);
      const desig = await employeesService.createDesignation(req.tenantUser!.companyId, validated);
      return sendSuccess(res, desig, 201);
    } catch (err) {
      next(err);
    }
  }
);

// 3. List Employees
router.get(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { page, limit, search, department_id, status, manager_id } = req.query;
      const result = await employeesService.listEmployees(
        req.tenantUser!.companyId,
        req.tenantUser!.role,
        req.tenantUser!.employeeId,
        {
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
          search: search ? String(search) : undefined,
          department_id: department_id ? String(department_id) : undefined,
          status: status as EmployeeStatus,
          manager_id: manager_id ? String(manager_id) : undefined,
        }
      );
      return sendSuccess(res, result.employees, 200, result.meta);
    } catch (err) {
      next(err);
    }
  }
);

// 4. Create Employee
const createEmployeeSchema = z.object({
  employee_code: z.string().trim().min(1).max(50).optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  department_id: z.string().optional(),
  designation_id: z.string().optional(),
  manager_id: z.string().optional(),
  date_of_joining: z.string().optional(),
  employment_type: z.nativeEnum(EmploymentType).optional(),
  bank_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_ifsc: z.string().optional(),
  address: z.string().optional(),
  pay_type: z.nativeEnum(PayType).optional(),
  base_amount: z.number().positive().optional(),
  effective_from: z.string().optional(),
});

router.post(
  '/',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = createEmployeeSchema.parse(req.body);
      const employee = await employeesService.createEmployee(req.tenantUser!.companyId, validated);
      return sendSuccess(res, employee, 201);
    } catch (err) {
      next(err);
    }
  }
);

// 5. Employee Directory Analytics (Admin Only)
router.get(
  '/analytics',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const analytics = await employeesService.getDirectoryAnalytics(req.tenantUser!.companyId);
      return sendSuccess(res, analytics, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 6. Next Suggested Employee Code (Admin Only)
router.get(
  '/next-code',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const nextCode = await employeesService.getNextEmployeeCode(req.tenantUser!.companyId);
      return sendSuccess(res, { nextCode }, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 6. Get Employee Details
router.get(
  '/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const employee = await employeesService.getEmployeeById(
        req.tenantUser!.companyId,
        req.params.id,
        {
          role: req.tenantUser!.role,
          employeeId: req.tenantUser!.employeeId,
        }
      );
      return sendSuccess(res, employee, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 6. Update Employee
const updateEmployeeSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  phone: z.string().optional(),
  department_id: z.string().nullable().optional(),
  designation_id: z.string().nullable().optional(),
  manager_id: z.string().nullable().optional(),
  employment_type: z.nativeEnum(EmploymentType).optional(),
  status: z.nativeEnum(EmployeeStatus).optional(),
  bank_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_ifsc: z.string().optional(),
  address: z.string().optional(),
});

router.patch(
  ['/:id', '/:id/status'],
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = updateEmployeeSchema.parse(req.body);
      const updated = await employeesService.updateEmployee(
        req.tenantUser!.companyId,
        req.params.id,
        validated
      );
      return sendSuccess(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 7. Deactivate Employee
router.delete(
  '/:id',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await employeesService.deactivateEmployee(
        req.tenantUser!.companyId,
        req.params.id
      );
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
);

// 8. Invite Employee (Provision User Credentials)
const inviteSchema = z.object({
  role: z.nativeEnum(TenantRole).optional(),
});

router.post(
  '/:id/invite',
  rolesGuard(TenantRole.company_admin),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { role } = inviteSchema.parse(req.body || {});
      const credentials = await employeesService.inviteEmployee(
        req.tenantUser!.companyId,
        req.params.id,
        role || TenantRole.employee
      );
      return sendSuccess(res, credentials, 200);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
