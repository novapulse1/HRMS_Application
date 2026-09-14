import { PrismaClient, LicensePlan, LicenseStatus, TenantRole, EmploymentType, EmployeeStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Nova Pulse HRMS database seed...');

  // 1. Super Admin Seed
  const superAdminEmail = 'admin@novapulse.io';
  const existingSuperAdmin = await prisma.superAdmin.findUnique({
    where: { email: superAdminEmail },
  });

  let superAdminPassword = process.env.SUPER_ADMIN_INITIAL_PASSWORD;
  if (!superAdminPassword) {
    superAdminPassword = crypto.randomBytes(12).toString('base64url');
  }

  const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 10);

  let superAdmin;
  if (existingSuperAdmin) {
    superAdmin = existingSuperAdmin;
    console.log(`ℹ️ Super admin already exists (${superAdminEmail}). Existing password preserved.`);
  } else {
    superAdmin = await prisma.superAdmin.create({
      data: {
        name: 'Nova Pulse Master Admin',
        email: superAdminEmail,
        password_hash: superAdminPasswordHash,
        must_change_password: true,
      },
    });

    console.log('\n=============================================================');
    console.log('🔑 NOVA PULSE HRMS — FIRST SUPER ADMIN CREDENTIALS');
    console.log(`Email:                ${superAdminEmail}`);
    console.log(`Initial Password:     ${superAdminPassword}`);
    console.log('Must Change Password: YES (Enforced on first login)');
    console.log('=============================================================\n');
  }

  // 2. Demo Company Seed (Development & Staging ONLY)
  if (process.env.NODE_ENV !== 'production') {
    console.log('🏢 Seeding demo company "Acme Corp" for development...');

    const demoCompanyEmail = 'contact@acmecorp.com';
    const demoAdminEmail = 'admin@acmecorp.com';

    let demoCompany = await prisma.company.findFirst({
      where: { contact_email: demoCompanyEmail },
    });

    const demoAdminPassword =
      process.env.DEMO_ADMIN_INITIAL_PASSWORD ||
      crypto.randomBytes(10).toString('base64url');
    const demoAdminPasswordHash = await bcrypt.hash(demoAdminPassword, 10);

    const today = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(today.getDate() + 365); // 1 year active license

    if (!demoCompany) {
      demoCompany = await prisma.company.create({
        data: {
          name: 'Acme Corporation',
          industry: 'Software & Technology',
          size_range: '51-200',
          contact_person_name: 'John Doe',
          contact_email: demoCompanyEmail,
          contact_phone: '+1-555-0199',
          address: '100 Innovation Way, Suite 400, Tech Valley, CA',
          license_plan: LicensePlan.pro,
          license_status: LicenseStatus.active,
          license_start_date: today,
          license_expiry_date: expiryDate,
          created_by: superAdmin.id,
          settings: {
            create: {
              working_days_json: ['mon', 'tue', 'wed', 'thu', 'fri'],
              working_hours_start: '09:00',
              working_hours_end: '18:00',
              payroll_cycle_day: 28,
              overtime_enabled: true,
              overtime_rate_multiplier: 1.5,
            },
          },
        },
      });

      // Default Departments
      const deptEngineering = await prisma.department.create({
        data: { company_id: demoCompany.id, name: 'Engineering' },
      });
      const deptHR = await prisma.department.create({
        data: { company_id: demoCompany.id, name: 'Human Resources' },
      });

      // Default Designations
      const desTechLead = await prisma.designation.create({
        data: {
          company_id: demoCompany.id,
          department_id: deptEngineering.id,
          name: 'Lead Architect',
        },
      });
      const desHRExec = await prisma.designation.create({
        data: {
          company_id: demoCompany.id,
          department_id: deptHR.id,
          name: 'HR Director',
        },
      });

      // Default Shifts
      const generalShift = await prisma.shift.create({
        data: {
          company_id: demoCompany.id,
          name: 'General Day Shift',
          start_time: '09:00',
          end_time: '18:00',
          is_night_shift: false,
        },
      });

      // Default Leave Types
      await prisma.leaveType.createMany({
        data: [
          { company_id: demoCompany.id, name: 'Casual Leave', is_paid: true, default_annual_quota: 12 },
          { company_id: demoCompany.id, name: 'Sick Leave', is_paid: true, default_annual_quota: 10 },
          { company_id: demoCompany.id, name: 'Annual Leave', is_paid: true, default_annual_quota: 15 },
          { company_id: demoCompany.id, name: 'Unpaid Leave', is_paid: false, default_annual_quota: 0 },
        ],
      });

      // Company Admin Employee & User
      const adminEmployee = await prisma.employee.create({
        data: {
          company_id: demoCompany.id,
          employee_code: 'EMP-001',
          first_name: 'John',
          last_name: 'Doe',
          email: demoAdminEmail,
          phone: '+1-555-0199',
          department_id: deptHR.id,
          designation_id: desHRExec.id,
          date_of_joining: new Date(),
          employment_type: EmploymentType.full_time,
          status: EmployeeStatus.active,
          bank_name: 'Silicon Valley Bank',
          bank_account_number: '1234567890',
          bank_ifsc: 'SVB0001',
          shifts: {
            create: {
              company_id: demoCompany.id,
              shift_id: generalShift.id,
              effective_from: today,
            },
          },
        },
      });

      await prisma.user.create({
        data: {
          company_id: demoCompany.id,
          employee_id: adminEmployee.id,
          email: demoAdminEmail,
          password_hash: demoAdminPasswordHash,
          role: TenantRole.company_admin,
          must_change_password: true,
          is_active: true,
        },
      });

      console.log('=============================================================');
      console.log('🏢 NOVA PULSE HRMS — DEMO COMPANY ADMIN CREDENTIALS');
      console.log('Company:              Acme Corporation');
      console.log(`Email:                ${demoAdminEmail}`);
      console.log(`Initial Password:     ${demoAdminPassword}`);
      console.log('Must Change Password: YES (Enforced on first login)');
      console.log('=============================================================\n');
    }
  }

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
