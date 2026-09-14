import prisma from '../../common/prisma/prisma.service';
import { AppError } from '../../common/middleware/error.middleware';

export interface RegisterDeviceDto {
  name: string;
  device_code: string;
  ip_address?: string;
  location?: string;
}

export class DevicesService {
  async registerDevice(companyId: string, data: RegisterDeviceDto) {
    const existing = await prisma.device.findUnique({
      where: {
        company_id_device_code: {
          company_id: companyId,
          device_code: data.device_code.trim(),
        },
      },
    });

    if (existing) {
      throw new AppError(409, 'DEVICE_EXISTS', `Device with code ${data.device_code} already exists`);
    }

    return prisma.device.create({
      data: {
        company_id: companyId,
        name: data.name.trim(),
        device_code: data.device_code.trim(),
        ip_address: data.ip_address?.trim() || null,
        location: data.location?.trim() || null,
        is_active: true,
      },
    });
  }

  async listDevices(companyId: string) {
    return prisma.device.findMany({
      where: { company_id: companyId },
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: { attendances: true },
        },
      },
    });
  }

  async toggleDevice(companyId: string, deviceId: string) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, company_id: companyId },
    });

    if (!device) {
      throw new AppError(404, 'NOT_FOUND', 'Device not found');
    }

    return prisma.device.update({
      where: { id: deviceId },
      data: {
        is_active: !device.is_active,
      },
    });
  }

  async syncDevice(companyId: string, deviceId: string) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, company_id: companyId },
    });

    if (!device) {
      throw new AppError(404, 'NOT_FOUND', 'Device not found');
    }

    if (!device.is_active) {
      throw new AppError(400, 'DEVICE_INACTIVE', 'Cannot sync an inactive device');
    }

    return prisma.device.update({
      where: { id: deviceId },
      data: {
        last_sync_at: new Date(),
      },
    });
  }

  async deleteDevice(companyId: string, deviceId: string) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, company_id: companyId },
    });

    if (!device) {
      throw new AppError(404, 'NOT_FOUND', 'Device not found');
    }

    await prisma.device.delete({
      where: { id: deviceId },
    });

    return { message: 'Device deleted successfully' };
  }
}

export const devicesService = new DevicesService();
