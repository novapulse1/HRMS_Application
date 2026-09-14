import prisma from '../../common/prisma/prisma.service';
import { AppError } from '../../common/middleware/error.middleware';

export class CompanySettingsService {
  async getSettings(companyId: string) {
    let settings = await prisma.companySettings.findUnique({
      where: { company_id: companyId },
    });

    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          company_id: companyId,
          working_days_json: ['mon', 'tue', 'wed', 'thu', 'fri'],
          working_hours_start: '09:00',
          working_hours_end: '18:00',
          payroll_cycle_day: 28,
          overtime_enabled: false,
          overtime_rate_multiplier: 1.5,
        },
      });
    }

    return settings;
  }

  async updateSettings(
    companyId: string,
    adminUserId: string,
    data: {
      working_days_json?: string[];
      working_hours_start?: string;
      working_hours_end?: string;
      payroll_cycle_day?: number;
      overtime_enabled?: boolean;
      overtime_rate_multiplier?: number;
    }
  ) {
    const existing = await this.getSettings(companyId);

    const updated = await prisma.companySettings.update({
      where: { company_id: companyId },
      data: {
        ...data,
      },
    });

    await prisma.auditLog.create({
      data: {
        company_id: companyId,
        user_id: adminUserId,
        action: 'UPDATE_COMPANY_SETTINGS',
        entity_type: 'company_settings',
        entity_id: updated.id,
        old_value_json: JSON.parse(JSON.stringify(existing)),
        new_value_json: JSON.parse(JSON.stringify(updated)),
      },
    });

    return updated;
  }
}

export const companySettingsService = new CompanySettingsService();
