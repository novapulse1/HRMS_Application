import { DocumentType, TenantRole } from '@prisma/client';
import prisma from '../../common/prisma/prisma.service';
import { AppError } from '../../common/middleware/error.middleware';

export class DocumentsService {
  async listEmployeeDocuments(
    companyId: string,
    employeeId: string,
    requestUser: { role: TenantRole; employeeId?: string | null }
  ) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, company_id: companyId },
    });

    if (!employee) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found in company');
    }

    // Role-based document access control
    if (requestUser.role === TenantRole.employee && requestUser.employeeId !== employeeId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to these documents');
    }

    if (requestUser.role === TenantRole.manager) {
      if (!requestUser.employeeId || (employeeId !== requestUser.employeeId && employee.manager_id !== requestUser.employeeId)) {
        throw new AppError(403, 'FORBIDDEN', 'Managers can only access documents of their direct reports');
      }
    }

    return prisma.employeeDocument.findMany({
      where: { employee_id: employeeId, company_id: companyId },
      orderBy: { uploaded_at: 'desc' },
    });
  }

  async createDocument(
    companyId: string,
    employeeId: string,
    data: {
      document_type: DocumentType;
      file_name: string;
      file_url: string;
      file_size?: number;
      mime_type?: string;
    },
    requestUser?: { role: TenantRole; employeeId?: string | null }
  ) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, company_id: companyId },
    });

    if (!employee) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found in company');
    }

    if (requestUser && requestUser.role === TenantRole.manager) {
      if (!requestUser.employeeId || (employeeId !== requestUser.employeeId && employee.manager_id !== requestUser.employeeId)) {
        throw new AppError(403, 'FORBIDDEN', 'Managers can only upload documents for their direct reports');
      }
    }

    return prisma.employeeDocument.create({
      data: {
        company_id: companyId,
        employee_id: employeeId,
        document_type: data.document_type,
        file_name: data.file_name,
        file_url: data.file_url,
      },
    });
  }

  async deleteDocument(companyId: string, documentId: string) {
    const doc = await prisma.employeeDocument.findFirst({
      where: { id: documentId, company_id: companyId },
    });

    if (!doc) {
      throw new AppError(404, 'NOT_FOUND', 'Document not found');
    }

    return prisma.employeeDocument.delete({
      where: { id: documentId },
    });
  }
}

export const documentsService = new DocumentsService();
