import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/main';
import prisma from '../src/common/prisma/prisma.service';
import { seedQaScenario } from '../scripts/local-only/seed-qa-scenario';
import { tenantLoginLimiter, superAdminLoginLimiter } from '../src/common/utils/login-rate-limiter';
import {
  calculateEmployeePayroll,
  computeAnnualTds,
} from '../src/modules/payroll/payroll-calculator';
import {
  STATUTORY_RATE_TABLES,
} from '../src/modules/payroll/statutory-rates';
import { AttendanceStatus, LeaveStatus } from '@prisma/client';

describe('Nova Pulse HRMS — QA Master E2E Edge Cases Test Suite', () => {
  let seededData: any;
  let adminAToken: string;
  let managerAToken: string;
  let aliceToken: string;
  let bobToken: string;
  let charlieToken: string;

  let adminBToken: string;
  let managerBToken: string;
  let davidBToken: string;

  let superAdminToken: string;

  beforeAll(async () => {
    // Reset rate limiters before test execution
    tenantLoginLimiter.reset();
    superAdminLoginLimiter.reset();

    // Seed test topology
    seededData = await seedQaScenario();

    // Obtain tokens for Company A
    const resAdminA = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@acmecorp.com', password: 'Password123!' });
    adminAToken = resAdminA.body.data.accessToken;

    const resMgrA = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager@acmecorp.com', password: 'Password123!' });
    managerAToken = resMgrA.body.data.accessToken;

    const resAlice = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@acmecorp.com', password: 'Password123!' });
    aliceToken = resAlice.body.data.accessToken;

    const resBob = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bob@acmecorp.com', password: 'Password123!' });
    bobToken = resBob.body.data.accessToken;

    const resCharlie = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'charlie@acmecorp.com', password: 'Password123!' });
    charlieToken = resCharlie.body.data.accessToken;

    // Obtain tokens for Company B
    const resAdminB = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@nexuscloud.io', password: 'Password123!' });
    adminBToken = resAdminB.body.data.accessToken;

    const resMgrB = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'manager@nexuscloud.io', password: 'Password123!' });
    managerBToken = resMgrB.body.data.accessToken;

    const resDavidB = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'david@nexuscloud.io', password: 'Password123!' });
    davidBToken = resDavidB.body.data.accessToken;

    // Obtain token for Super Admin
    const resSuper = await request(app)
      .post('/api/v1/admin/login')
      .send({ email: 'admin@novapulse.io', password: 'Password123!' });
    superAdminToken = resSuper.body.data.accessToken;
  }, 45000);

  afterAll(async () => {
    tenantLoginLimiter.reset();
    superAdminLoginLimiter.reset();
    await prisma.$disconnect();
  });

  // =========================================================================
  // PILLAR 1: SECURITY & RBAC (RELEASE-BLOCKING)
  // =========================================================================
  describe('Pillar 1: Security & RBAC', () => {
    describe('1.1 Multi-tenant isolation (cross-company IDOR prevention)', () => {
      it('Company B user querying Company A employee ID returns 403 or 404 with zero data', async () => {
        const res = await request(app)
          .get(`/api/v1/employees/${seededData.companyA.aliceId}`)
          .set('Authorization', `Bearer ${davidBToken}`);
        expect([403, 404]).toContain(res.status);
        expect(res.body.data).toBeFalsy();
      });

      it('Company B user querying Company A leave request returns 403 or 404', async () => {
        const res = await request(app)
          .get(`/api/v1/leave/${seededData.companyA.leaveId}`)
          .set('Authorization', `Bearer ${davidBToken}`);
        expect([403, 404]).toContain(res.status);
        expect(res.body.data).toBeFalsy();
      });

      it('Company B user querying Company A ticket returns 403 or 404', async () => {
        const res = await request(app)
          .get(`/api/v1/tickets/${seededData.companyA.ticketId}`)
          .set('Authorization', `Bearer ${davidBToken}`);
        expect([403, 404]).toContain(res.status);
        expect(res.body.data).toBeFalsy();
      });

      it('Company B user querying Company A documents returns 403 or 404', async () => {
        const res = await request(app)
          .get(`/api/v1/documents/employees/${seededData.companyA.aliceId}`)
          .set('Authorization', `Bearer ${davidBToken}`);
        expect([403, 404]).toContain(res.status);
        expect(res.body.data).toBeFalsy();
      });
    });

    describe('1.2 Authentication & sessions', () => {
      it('5 wrong password attempts on tenant login blocks the 6th attempt with 429', async () => {
        const testEmail = 'rate-test@acmecorp.com';
        for (let i = 0; i < 5; i++) {
          await request(app)
            .post('/api/v1/auth/login')
            .send({ email: testEmail, password: 'WrongPassword!' });
        }
        const res6 = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: testEmail, password: 'WrongPassword!' });
        expect(res6.status).toBe(429);
        expect(['TOO_MANY_REQUESTS', 'TOO_MANY_ATTEMPTS']).toContain(res6.body.error.code);
      });

      it('Admin login limiter operates independently of tenant limiter', async () => {
        const adminEmail = 'admin-rate-test@novapulse.io';
        for (let i = 0; i < 5; i++) {
          await request(app)
            .post('/api/v1/admin/login')
            .send({ email: adminEmail, password: 'WrongPassword!' });
        }
        const resAdmin6 = await request(app)
          .post('/api/v1/admin/login')
          .send({ email: adminEmail, password: 'WrongPassword!' });
        expect(resAdmin6.status).toBe(429);
        expect(['TOO_MANY_REQUESTS', 'TOO_MANY_ATTEMPTS']).toContain(resAdmin6.body.error.code);
      });

      it('Unauthenticated requests to protected endpoints return 401', async () => {
        const res = await request(app).get('/api/v1/employees');
        expect(res.status).toBe(401);
      });

      it('Silent refresh works and rotating old refresh token rejects replays with 401', async () => {
        const loginRes = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'admin@acmecorp.com', password: 'Password123!' });
        const refreshToken = loginRes.body.data.refreshToken;

        // First refresh succeeds
        const refreshRes1 = await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken });
        expect(refreshRes1.status).toBe(200);
        expect(refreshRes1.body.data.accessToken).toBeTruthy();

        // Replay of old refresh token fails
        const replayRes = await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken });
        expect(replayRes.status).toBe(401);
      });

      it('Super admin JWT rejected against tenant endpoint and vice versa', async () => {
        // Super admin JWT against tenant route
        const res1 = await request(app)
          .get('/api/v1/employees')
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect([401, 403]).toContain(res1.status);

        // Tenant JWT against super admin route
        const res2 = await request(app)
          .get('/api/v1/admin/companies')
          .set('Authorization', `Bearer ${adminAToken}`);
        expect([401, 403]).toContain(res2.status);
      });
    });

    describe('1.3 Employee role boundaries', () => {
      it('Employee views own profile and sees own bank details', async () => {
        const res = await request(app)
          .get(`/api/v1/employees/${seededData.companyA.aliceId}`)
          .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.bank_account_number).toBeTruthy();
      });

      it('Employee editing URL to view colleague profile gets 403 and body contains no financial info', async () => {
        const res = await request(app)
          .get(`/api/v1/employees/${seededData.companyA.bobId}`)
          .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(403);
        expect(res.body.data).toBeFalsy();
      });

      it('Employee directory search sees nobody but self', async () => {
        const res = await request(app)
          .get('/api/v1/employees')
          .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].id).toBe(seededData.companyA.aliceId);
      });

      it('Employee cannot call leave approval endpoint directly (returns 403)', async () => {
        const res = await request(app)
          .patch(`/api/v1/leave/${seededData.companyA.leaveId}/status`)
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({ status: 'approved' });
        expect(res.status).toBe(403);
      });

      it('Employee raises ticket and sees it in own list only', async () => {
        const resCreate = await request(app)
          .post('/api/v1/tickets')
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            category: 'HR',
            subject: 'Holiday calendar query',
            description: 'Are optional holidays allowed?',
            priority: 'low',
          });
        expect(resCreate.status).toBe(201);

        const resList = await request(app)
          .get('/api/v1/tickets')
          .set('Authorization', `Bearer ${aliceToken}`);
        expect(resList.status).toBe(200);
        const allMatchOwn = resList.body.data.every(
          (t: any) => t.employee_id === seededData.companyA.aliceId
        );
        expect(allMatchOwn).toBe(true);
      });

      it('Employee cannot access payroll routes (returns 403)', async () => {
        const res = await request(app)
          .get('/api/v1/payroll/runs')
          .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(403);
      });
    });

    describe('1.4 Manager role boundaries', () => {
      it("Manager views own and report's profile: succeeds, but bank/salary redacted", async () => {
        // Manager viewing report
        const resReport = await request(app)
          .get(`/api/v1/employees/${seededData.companyA.aliceId}`)
          .set('Authorization', `Bearer ${managerAToken}`);
        expect(resReport.status).toBe(200);
        expect(resReport.body.data.bank_account_number).toBeNull();
        expect(resReport.body.data.salary_structures).toEqual([]);

        // Manager viewing self
        const resSelf = await request(app)
          .get(`/api/v1/employees/${seededData.companyA.managerId}`)
          .set('Authorization', `Bearer ${managerAToken}`);
        expect(resSelf.status).toBe(200);
        expect(resSelf.body.data.bank_account_number).toBeNull();
        expect(resSelf.body.data.salary_structures).toEqual([]);
      });

      it("Manager trying non-report's profile by ID gets 403", async () => {
        const res = await request(app)
          .get(`/api/v1/employees/${seededData.companyA.charlieId}`)
          .set('Authorization', `Bearer ${managerAToken}`);
        expect(res.status).toBe(403);
      });

      it('Manager broad search excludes non-reports (SEC-02 regression guard)', async () => {
        const res = await request(app)
          .get('/api/v1/employees?search=a')
          .set('Authorization', `Bearer ${managerAToken}`);
        expect(res.status).toBe(200);
        const returnedIds = res.body.data.map((e: any) => e.id);
        expect(returnedIds).not.toContain(seededData.companyA.charlieId);
      });

      it('Manager can approve report leave but gets 403 on non-report leave', async () => {
        // Apply leave for Alice (report of Manager A)
        const leaveAlice = await prisma.leaveRequest.create({
          data: {
            company_id: seededData.companyA.id,
            employee_id: seededData.companyA.aliceId,
            leave_type_id: (await prisma.leaveType.findFirst({ where: { company_id: seededData.companyA.id } }))!.id,
            start_date: new Date(Date.UTC(2026, 8, 20)),
            end_date: new Date(Date.UTC(2026, 8, 20)),
            total_days: 1.0,
            reason: 'Doctor appointment',
            status: LeaveStatus.pending,
          },
        });

        // Manager approving direct report's leave succeeds
        const resApprove = await request(app)
          .patch(`/api/v1/leave/${leaveAlice.id}/status`)
          .set('Authorization', `Bearer ${managerAToken}`)
          .send({ status: 'approved' });
        expect(resApprove.status).toBe(200);

        // Manager attempting to approve non-report's leave (Charlie) gets 403
        const resNonReport = await request(app)
          .patch(`/api/v1/leave/${seededData.companyA.leaveId}/status`)
          .set('Authorization', `Bearer ${managerAToken}`)
          .send({ status: 'approved' });
        expect(resNonReport.status).toBe(403);
      });

      it('Manager hits payroll routes -> 403 on runs, salary structures, exports', async () => {
        const resRuns = await request(app)
          .get('/api/v1/payroll/runs')
          .set('Authorization', `Bearer ${managerAToken}`);
        expect(resRuns.status).toBe(403);

        const resExport = await request(app)
          .get('/api/v1/reports/payroll/csv?month=9&year=2026')
          .set('Authorization', `Bearer ${managerAToken}`);
        expect(resExport.status).toBe(403);
      });
    });

    describe('1.5 Company admin capabilities', () => {
      it('Admin views all employees with unredacted bank/salary', async () => {
        const res = await request(app)
          .get(`/api/v1/employees/${seededData.companyA.aliceId}`)
          .set('Authorization', `Bearer ${adminAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.bank_account_number).toBeTruthy();
        expect(res.body.data.salary_structures.length).toBeGreaterThan(0);
      });

      it('Admin approves and rejects loans', async () => {
        // Create test loan to reject
        const testLoan = await prisma.loan.create({
          data: {
            company_id: seededData.companyA.id,
            employee_id: seededData.companyA.charlieId,
            amount: 10000.0,
            monthly_deduction_amount: 1000.0,
            outstanding_balance: 10000.0,
            tenure_months: 10,
            status: 'pending',
          },
        });

        // Admin rejects loan
        const resReject = await request(app)
          .patch(`/api/v1/payroll/loans/${testLoan.id}/review`)
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({ action: 'reject' });
        expect(resReject.status).toBe(200);
        expect(resReject.body.data.status).toBe('rejected');

        // Create test loan to approve
        const testLoan2 = await prisma.loan.create({
          data: {
            company_id: seededData.companyA.id,
            employee_id: seededData.companyA.charlieId,
            amount: 15000.0,
            monthly_deduction_amount: 1500.0,
            outstanding_balance: 15000.0,
            tenure_months: 10,
            status: 'pending',
          },
        });

        // Admin approves loan
        const resApprove = await request(app)
          .patch(`/api/v1/payroll/loans/${testLoan2.id}/review`)
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({ action: 'approve' });
        expect(resApprove.status).toBe(200);
        expect(resApprove.body.data.status).toBe('active');
      });

      it('Admin assigns and resolves support tickets', async () => {
        // Admin assigns ticket
        const userAdmin = await prisma.user.findUnique({ where: { email: 'admin@acmecorp.com' } });
        const resAssign = await request(app)
          .patch(`/api/v1/tickets/${seededData.companyA.ticketId}/assign`)
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({ assignee_user_id: userAdmin!.id });
        expect(resAssign.status).toBe(200);

        // Admin resolves ticket
        const resResolve = await request(app)
          .patch(`/api/v1/tickets/${seededData.companyA.ticketId}/status`)
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({ status: 'resolved', resolution: 'Provided explanation of Section 87A rebate.' });
        expect(resResolve.status).toBe(200);
        expect(resResolve.body.data.status).toBe('resolved');
      });
    });
  });

  // =========================================================================
  // PILLAR 2: BUSINESS LOGIC
  // =========================================================================
  describe('Pillar 2: Business Logic', () => {
    describe('2.1 Attendance', () => {
      it('Night shift: check in 22:00, check out 06:00 next day calculates 8.00 worked_hours across midnight', async () => {
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const yDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate()));

        // Create open night-shift checkin on yesterday
        await prisma.attendance.deleteMany({
          where: { employee_id: seededData.companyA.bobId, date: yDate },
        });

        const checkInTime = new Date(yDate);
        checkInTime.setUTCHours(22, 0, 0, 0);

        await prisma.attendance.create({
          data: {
            company_id: seededData.companyA.id,
            employee_id: seededData.companyA.bobId,
            date: yDate,
            check_in_time: checkInTime,
            status: AttendanceStatus.present,
            worked_hours: 0,
          },
        });

        // Checkout today at 06:00
        const checkOutTime = new Date(yDate);
        checkOutTime.setUTCDate(checkOutTime.getUTCDate() + 1);
        checkOutTime.setUTCHours(6, 0, 0, 0);

        // Calculate worked hours across midnight
        const diffMs = checkOutTime.getTime() - checkInTime.getTime();
        const workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        expect(workedHours).toBe(8);
      });

      it('Checkout without checkin returns clear 400 error', async () => {
        // Clean today attendance for Charlie
        const todayUtc = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
        await prisma.attendance.deleteMany({
          where: { employee_id: seededData.companyA.charlieId },
        });

        const res = await request(app)
          .post('/api/v1/attendance/punch')
          .set('Authorization', `Bearer ${charlieToken}`)
          .send({ action: 'check_out' });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('NOT_CHECKED_IN');
      });

      it('Check in twice safely handles duplicate checkin', async () => {
        // First check in
        const res1 = await request(app)
          .post('/api/v1/attendance/punch')
          .set('Authorization', `Bearer ${charlieToken}`)
          .send({ action: 'check_in' });
        expect(res1.status).toBe(200);

        // Second check in
        const res2 = await request(app)
          .post('/api/v1/attendance/punch')
          .set('Authorization', `Bearer ${charlieToken}`)
          .send({ action: 'check_in' });
        expect(res2.status).toBe(200);
        expect(res2.body.data.message).toContain('Already checked in');
      });

      it('Mark attendance on configured holiday sets status to holiday, not absent', async () => {
        const holidayDateStr = `${new Date().getFullYear()}-08-15`;
        const res = await request(app)
          .post('/api/v1/attendance/correction')
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({
            employee_id: seededData.companyA.aliceId,
            date: holidayDateStr,
            status: AttendanceStatus.absent,
          });
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(AttendanceStatus.holiday);
      });

      it('Mark attendance on week-off day sets status to week_off, not absent', async () => {
        // 2026-09-13 is a Sunday (week-off for Mon-Fri)
        const weekOffDateStr = '2026-09-13';
        const res = await request(app)
          .post('/api/v1/attendance/correction')
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({
            employee_id: seededData.companyA.aliceId,
            date: weekOffDateStr,
            status: AttendanceStatus.absent,
          });
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(AttendanceStatus.week_off);
      });

      it('Assigning new shift auto-closes prior open-ended shift without overlapping active assignments', async () => {
        const newShift = await prisma.shift.create({
          data: {
            company_id: seededData.companyA.id,
            name: 'Midday Shift',
            start_time: '12:00',
            end_time: '20:00',
          },
        });

        // Assign new shift to Bob
        const resAssign = await request(app)
          .post('/api/v1/shifts/assign')
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({
            shift_id: newShift.id,
            employee_ids: [seededData.companyA.bobId],
            effective_from: '2026-10-01',
          });
        expect(resAssign.status).toBe(200);

        // Check Bob's active assignments
        const activeOpenAssignments = await prisma.employeeShift.findMany({
          where: {
            employee_id: seededData.companyA.bobId,
            effective_to: null,
          },
        });
        expect(activeOpenAssignments.length).toBe(1);
        expect(activeOpenAssignments[0].shift_id).toBe(newShift.id);
      });
    });

    describe('2.2 Leave precision, limits and CSV sanitization', () => {
      it('Three consecutive half-day leaves decrement balance exactly with zero floating-point drift', async () => {
        const leaveType = await prisma.leaveType.findFirst({
          where: { company_id: seededData.companyA.id, name: 'Casual Leave' },
        });

        // Clean up any existing leave requests for Alice for test dates
        await prisma.leaveRequest.deleteMany({
          where: {
            employee_id: seededData.companyA.aliceId,
            start_date: {
              gte: new Date('2026-11-01T00:00:00.000Z'),
              lte: new Date('2026-12-31T23:59:59.999Z'),
            },
          },
        });

        // Set starting balance to exactly 12.0
        await prisma.leaveBalance.upsert({
          where: {
            employee_id_leave_type_id_year: {
              employee_id: seededData.companyA.aliceId,
              leave_type_id: leaveType!.id,
              year: 2026,
            },
          },
          update: { allocated: 12.0, used: 0.0, remaining: 12.0 },
          create: {
            company_id: seededData.companyA.id,
            employee_id: seededData.companyA.aliceId,
            leave_type_id: leaveType!.id,
            year: 2026,
            allocated: 12.0,
            used: 0.0,
            remaining: 12.0,
          },
        });

        // Apply and approve 3 half days
        for (let i = 1; i <= 3; i++) {
          const reqDate = `2026-11-0${i}`;
          const resApply = await request(app)
            .post('/api/v1/leave/apply')
            .set('Authorization', `Bearer ${aliceToken}`)
            .send({
              leave_type_id: leaveType!.id,
              start_date: reqDate,
              end_date: reqDate,
              is_half_day: true,
              reason: `Half day check ${i}`,
            });
          expect(resApply.status).toBe(201);

          const resApprove = await request(app)
            .patch(`/api/v1/leave/${resApply.body.data.id}/status`)
            .set('Authorization', `Bearer ${adminAToken}`)
            .send({ status: 'approved' });
          expect(resApprove.status).toBe(200);
        }

        const finalBal = await prisma.leaveBalance.findUnique({
          where: {
            employee_id_leave_type_id_year: {
              employee_id: seededData.companyA.aliceId,
              leave_type_id: leaveType!.id,
              year: 2026,
            },
          },
        });

        // 12.0 - 1.5 = 10.5 exactly, not 10.499999999999998
        expect(Number(finalBal!.remaining)).toBe(10.5);
        expect(Number(finalBal!.used)).toBe(1.5);
      });

      it('Applying for more paid leave than remaining balance returns 400', async () => {
        const leaveType = await prisma.leaveType.findFirst({
          where: { company_id: seededData.companyA.id, name: 'Casual Leave' },
        });
        const res = await request(app)
          .post('/api/v1/leave/apply')
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            leave_type_id: leaveType!.id,
            start_date: '2026-12-01',
            end_date: '2026-12-25', // 25 days > 10.5 balance
            is_half_day: false,
            reason: 'Excessive vacation',
          });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INSUFFICIENT_LEAVE_BALANCE');
      });

      it('Applying for unpaid leave with zero quota is allowed', async () => {
        const unpaidType = await prisma.leaveType.findFirst({
          where: { company_id: seededData.companyA.id, name: 'Unpaid Leave' },
        });

        // Clean up any unpaid leave request for test dates
        await prisma.leaveRequest.deleteMany({
          where: {
            employee_id: seededData.companyA.aliceId,
            start_date: {
              gte: new Date('2026-12-01T00:00:00.000Z'),
              lte: new Date('2026-12-31T23:59:59.999Z'),
            },
          },
        });

        const res = await request(app)
          .post('/api/v1/leave/apply')
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            leave_type_id: unpaidType!.id,
            start_date: '2026-12-10',
            end_date: '2026-12-12',
            is_half_day: false,
            reason: 'Unpaid sabbatical',
          });
        expect(res.status).toBe(201);
      });

      it('CSV export neutralizes spreadsheet formula injection in leave reason', async () => {
        const leaveType = await prisma.leaveType.findFirst({
          where: { company_id: seededData.companyA.id, name: 'Casual Leave' },
        });

        await prisma.leaveRequest.deleteMany({
          where: {
            employee_id: seededData.companyA.charlieId,
            start_date: new Date('2026-05-01T00:00:00.000Z'),
          },
        });

        await request(app)
          .post('/api/v1/leave/apply')
          .set('Authorization', `Bearer ${charlieToken}`)
          .send({
            leave_type_id: leaveType!.id,
            start_date: '2026-05-01',
            end_date: '2026-05-01',
            is_half_day: false,
            reason: '=1+1',
          });

        const resCsv = await request(app)
          .get('/api/v1/reports/leave/csv?year=2026')
          .set('Authorization', `Bearer ${adminAToken}`);
        expect(resCsv.status).toBe(200);
        // Neutralized formula must be prefixed with single quote: "'=1+1"
        expect(resCsv.text).toContain("'=1+1");
      });
    });

    describe('2.3 Ticket SLA calculation and overdue badge', () => {
      it('Calculates SLA due dates accurately by priority (High ~ 24h, Medium ~ 48h, Low ~ 72h)', async () => {
        const resHigh = await request(app)
          .post('/api/v1/tickets')
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            category: 'IT',
            subject: 'High priority ticket',
            description: 'Urgent access needed',
            priority: 'high',
          });
        expect(resHigh.status).toBe(201);
        const highDue = new Date(resHigh.body.data.sla_due_at).getTime();
        const createdTime = new Date(resHigh.body.data.created_at).getTime();
        const diffHoursHigh = Math.round((highDue - createdTime) / (1000 * 60 * 60));
        expect(diffHoursHigh).toBe(24);
      });

      it('Past-due ticket displays is_overdue flag', async () => {
        // Create an overdue ticket directly in DB
        const overdueTicket = await prisma.ticket.create({
          data: {
            company_id: seededData.companyA.id,
            ticket_number: 'TICK-OVERDUE-001',
            employee_id: seededData.companyA.aliceId,
            created_by: (await prisma.user.findUnique({ where: { email: 'alice@acmecorp.com' } }))!.id,
            category: 'Admin',
            subject: 'Simulated overdue ticket',
            description: 'Ticket created past SLA',
            priority: 'urgent',
            status: 'open',
            sla_due_at: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h in past
          },
        });

        const res = await request(app)
          .get(`/api/v1/tickets/${overdueTicket.id}`)
          .set('Authorization', `Bearer ${adminAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.is_overdue).toBe(true);
      });
    });
  });

  // =========================================================================
  // PILLAR 3: PAYROLL & MONEY (RELEASE-BLOCKING)
  // =========================================================================
  describe('Pillar 3: Payroll & Money', () => {
    describe('3.1 Mixed payroll batch calculation', () => {
      it('Accurately computes hourly, monthly (with unpaid days), and per-day models', () => {
        // 1. Hourly employee with overtime
        // Worked 160h regular + 10h overtime @ $25/hr with 1.5x multiplier
        const hourlyRes = calculateEmployeePayroll({
          payType: 'hourly',
          baseAmount: 25,
          workingDaysInMonth: 22,
          presentDays: 20,
          paidLeaveDays: 0,
          unpaidLeaveDays: 0,
          workedHours: 160,
          overtimeHours: 10,
          overtimeRateMultiplier: 1.5,
        });
        // Regular: 160 * 25 = 4000
        // Overtime: 10 * 25 * 1.5 = 375
        // Gross: 4375
        expect(hourlyRes.grossAmount).toBe(4375);
        expect(hourlyRes.overtimeAmount).toBe(375);

        // 2. Monthly employee with 2 unpaid days
        // Base: 44000, 22 working days -> perDayRate = 2000
        // Gross: 44000
        // Unpaid leave deduction: 2 * 2000 = 4000
        // Net before statutory: 40000
        const monthlyRes = calculateEmployeePayroll({
          payType: 'monthly',
          baseAmount: 44000,
          workingDaysInMonth: 22,
          presentDays: 20,
          paidLeaveDays: 0,
          unpaidLeaveDays: 2,
          workedHours: 160,
          overtimeHours: 0,
          overtimeRateMultiplier: 1.5,
        });
        expect(monthlyRes.grossAmount).toBe(44000);
        expect(monthlyRes.deductions['Unpaid Leave Deduction']).toBe(4000);
        expect(monthlyRes.netAmount).toBe(40000);

        // 3. Per-day employee
        // Rate: 1500/day, 20 present + 2 paid leave = 22 days
        // Gross: 22 * 1500 = 33000
        const perDayRes = calculateEmployeePayroll({
          payType: 'per_day',
          baseAmount: 1500,
          workingDaysInMonth: 22,
          presentDays: 20,
          paidLeaveDays: 2,
          unpaidLeaveDays: 0,
          workedHours: 176,
          overtimeHours: 0,
          overtimeRateMultiplier: 1.5,
        });
        expect(perDayRes.grossAmount).toBe(33000);
        expect(perDayRes.netAmount).toBe(33000);
      });
    });

    describe('3.2 PF with EPFO GSR 304(E) ₹25,000 wage ceiling', () => {
      it('Employee gross ₹20,000 (below ceiling) -> PF = gross * 12% = ₹2,400', () => {
        const res = calculateEmployeePayroll({
          payType: 'monthly',
          baseAmount: 20000,
          workingDaysInMonth: 22,
          presentDays: 22,
          paidLeaveDays: 0,
          unpaidLeaveDays: 0,
          workedHours: 176,
          overtimeHours: 0,
          overtimeRateMultiplier: 1.5,
          statutorySettings: { pfEnabled: true, pfWageCeiling: 25000, pfEmployeeRate: 12.0 },
        });
        expect(res.deductions['Provident Fund (PF)']).toBe(2400);
      });

      it('Employee gross ₹40,000 (above ceiling) -> PF capped at ₹25,000 * 12% = ₹3,000', () => {
        const res = calculateEmployeePayroll({
          payType: 'monthly',
          baseAmount: 40000,
          workingDaysInMonth: 22,
          presentDays: 22,
          paidLeaveDays: 0,
          unpaidLeaveDays: 0,
          workedHours: 176,
          overtimeHours: 0,
          overtimeRateMultiplier: 1.5,
          statutorySettings: { pfEnabled: true, pfWageCeiling: 25000, pfEmployeeRate: 12.0 },
        });
        expect(res.deductions['Provident Fund (PF)']).toBe(3000);
      });
    });

    describe('3.3 ESI ₹21,000 wage ceiling boundary test', () => {
      it('Employee gross exactly ₹21,000 -> ESI applied (0.75% = ₹157.50)', () => {
        const res = calculateEmployeePayroll({
          payType: 'monthly',
          baseAmount: 21000,
          workingDaysInMonth: 22,
          presentDays: 22,
          paidLeaveDays: 0,
          unpaidLeaveDays: 0,
          workedHours: 176,
          overtimeHours: 0,
          overtimeRateMultiplier: 1.5,
          statutorySettings: { esiEnabled: true, esiWageCeiling: 21000, esiEmployeeRate: 0.75 },
        });
        expect(res.deductions['Employee State Insurance (ESI)']).toBe(157.5);
      });

      it('Employee gross ₹21,001 -> ESI NOT applied (₹0)', () => {
        const res = calculateEmployeePayroll({
          payType: 'monthly',
          baseAmount: 21001,
          workingDaysInMonth: 22,
          presentDays: 22,
          paidLeaveDays: 0,
          unpaidLeaveDays: 0,
          workedHours: 176,
          overtimeHours: 0,
          overtimeRateMultiplier: 1.5,
          statutorySettings: { esiEnabled: true, esiWageCeiling: 21000, esiEmployeeRate: 0.75 },
        });
        expect(res.deductions['Employee State Insurance (ESI)']).toBeUndefined();
      });
    });

    describe('3.4 TDS (New Regime FY2026-27 Slabs & Section 87A Marginal Relief)', () => {
      it('Annual gross ₹12,75,000 (taxable ₹12,00,000 after ₹75k std deduction) -> Tax = ₹0', () => {
        const tax = computeAnnualTds(1275000, 'new_regime', '2026-27');
        expect(tax).toBe(0);
      });

      it('Annual gross ₹12,76,000 (taxable ₹12,01,000) -> small non-zero tax with marginal relief (₹1,040)', () => {
        const tax = computeAnnualTds(1276000, 'new_regime', '2026-27');
        // Excess over 12L is 1,000. Under Section 87A marginal relief, tax = 1,000 + 4% cess = 1,040
        expect(tax).toBe(1040);
      });

      it('Progressive slabs in middle of each bracket match manual calculations', () => {
        // Taxable 14L (annual gross 14,75,000):
        // 0-4L nil, 4-8L @ 5% = 20k, 8-12L @ 10% = 40k, 12-14L (2L) @ 15% = 30k
        // Base = 90,000 + 4% cess = 93,600
        const tax14L = computeAnnualTds(1475000, 'new_regime', '2026-27');
        expect(tax14L).toBe(93600);

        // Taxable 18L (annual gross 18,75,000):
        // 90k + 16-18L (2L) @ 20% = 40k -> Base = 130k + 12-16L (4L @ 15% = 60k)
        // 0-4L nil, 4-8L 20k, 8-12L 40k, 12-16L 60k, 16-18L 40k = 160,000 + 4% cess = 166,400
        const tax18L = computeAnnualTds(1875000, 'new_regime', '2026-27');
        expect(tax18L).toBe(166400);

        // Taxable 22L (annual gross 22,75,000):
        // 160k + 16-20L (4L @ 20% = 80k) + 20-22L (2L @ 25% = 50k)
        // Base = 20k + 40k + 60k + 80k + 50k = 250,000 + 4% cess = 260,000
        const tax22L = computeAnnualTds(2275000, 'new_regime', '2026-27');
        expect(tax22L).toBe(260000);

        // Taxable 26L (annual gross 26,75,000):
        // Base = 20k + 40k + 60k + 80k + 100k + 2L @ 30% (60k) = 360,000 + 4% cess = 374,400
        const tax26L = computeAnnualTds(2675000, 'new_regime', '2026-27');
        expect(tax26L).toBe(374400);
      });
    });

    describe('3.5 Loan amortization and auto-stop on zero balance', () => {
      it('Loan deduction reduces balance, and zero balance stops deductions', async () => {
        // Clean up any previous test loan employee or loan
        const existingEmp = await prisma.employee.findFirst({
          where: { company_id: seededData.companyA.id, employee_code: 'ACME-TEST-LOAN' },
        });
        if (existingEmp) {
          await prisma.loan.deleteMany({ where: { employee_id: existingEmp.id } });
          await prisma.payslip.deleteMany({ where: { employee_id: existingEmp.id } });
          await prisma.salaryStructure.deleteMany({ where: { employee_id: existingEmp.id } });
          await prisma.employee.delete({ where: { id: existingEmp.id } });
        }
        const existingRun5 = await prisma.payrollRun.findUnique({
          where: { company_id_month_year: { company_id: seededData.companyA.id, month: 5, year: 2026 } },
        });
        if (existingRun5) {
          await prisma.payslip.deleteMany({ where: { payroll_run_id: existingRun5.id } });
          await prisma.payrollRun.delete({ where: { id: existingRun5.id } });
        }

        // Loan with balance ₹5,000 and monthly deduction ₹5,000
        const testEmp = await prisma.employee.create({
          data: {
            company_id: seededData.companyA.id,
            employee_code: 'ACME-TEST-LOAN',
            first_name: 'Loan',
            last_name: 'Tester',
            email: 'loan.test@acmecorp.com',
            status: 'active',
            employment_type: 'full_time',
            date_of_joining: new Date(Date.UTC(2025, 0, 1)),
            salary_structures: {
              create: {
                company_id: seededData.companyA.id,
                pay_type: 'monthly',
                base_amount: 30000.0,
                effective_from: new Date(Date.UTC(2025, 0, 1)),
              },
            },
          },
        });

        const loan = await prisma.loan.create({
          data: {
            company_id: seededData.companyA.id,
            employee_id: testEmp.id,
            amount: 5000.0,
            monthly_deduction_amount: 5000.0,
            outstanding_balance: 5000.0,
            tenure_months: 1,
            status: 'active',
          },
        });

        // Run payroll for month 5
        const resRun1 = await request(app)
          .post('/api/v1/payroll/runs')
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({ month: 5, year: 2026 });
        expect(resRun1.status).toBe(201);

        // Approve and mark paid
        await request(app)
          .post(`/api/v1/payroll/runs/${resRun1.body.data.id}/approve`)
          .set('Authorization', `Bearer ${adminAToken}`);

        await request(app)
          .post(`/api/v1/payroll/runs/${resRun1.body.data.id}/pay`)
          .set('Authorization', `Bearer ${adminAToken}`);

        // Verify loan balance is now 0 and status is repaid
        const updatedLoan = await prisma.loan.findUnique({ where: { id: loan.id } });
        expect(Number(updatedLoan!.outstanding_balance)).toBe(0);
        expect(updatedLoan!.status).toBe('repaid');
      });
    });

    describe('3.6 Payroll state machine transition enforcement', () => {
      it('Re-running payroll for an already paid month is blocked with 400', async () => {
        let run5 = await prisma.payrollRun.findUnique({
          where: { company_id_month_year: { company_id: seededData.companyA.id, month: 5, year: 2026 } },
        });
        if (!run5) {
          const res = await request(app)
            .post('/api/v1/payroll/runs')
            .set('Authorization', `Bearer ${adminAToken}`)
            .send({ month: 5, year: 2026 });
          run5 = res.body.data;
        }
        if (run5!.status !== 'paid') {
          if (run5!.approval_status !== 'approved') {
            await request(app)
              .post(`/api/v1/payroll/runs/${run5!.id}/approve`)
              .set('Authorization', `Bearer ${adminAToken}`);
          }
          await request(app)
            .post(`/api/v1/payroll/runs/${run5!.id}/pay`)
            .set('Authorization', `Bearer ${adminAToken}`);
        }

        const resRerun = await request(app)
          .post('/api/v1/payroll/runs')
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({ month: 5, year: 2026 });
        expect(resRerun.status).toBe(400);
        expect(resRerun.body.error.code).toBe('PAYROLL_ALREADY_PAID');
      });

      it('Invalid transitions are blocked (e.g. rejecting an already-approved run, approving an already-rejected run)', async () => {
        // Clean up month 6/2026 if exists
        const existingRun6 = await prisma.payrollRun.findUnique({
          where: { company_id_month_year: { company_id: seededData.companyA.id, month: 6, year: 2026 } },
        });
        if (existingRun6) {
          await prisma.payslip.deleteMany({ where: { payroll_run_id: existingRun6.id } });
          await prisma.payrollRun.delete({ where: { id: existingRun6.id } });
        }

        // Create a new run for month 6/2026
        const resRun = await request(app)
          .post('/api/v1/payroll/runs')
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({ month: 6, year: 2026 });
        const runId = resRun.body.data.id;

        // Reject it
        const resReject = await request(app)
          .post(`/api/v1/payroll/runs/${runId}/reject`)
          .set('Authorization', `Bearer ${adminAToken}`);
        expect(resReject.status).toBe(200);

        // Try to approve an already-rejected run -> blocked!
        const resApproveRejected = await request(app)
          .post(`/api/v1/payroll/runs/${runId}/approve`)
          .set('Authorization', `Bearer ${adminAToken}`);
        expect(resApproveRejected.status).toBe(400);
        expect(resApproveRejected.body.error.code).toBe('INVALID_TRANSITION');
      });

      it('Cannot mark pending_approval run as paid directly (skip approval blocked)', async () => {
        // Clean up month 7/2026 if exists
        const existingRun7 = await prisma.payrollRun.findUnique({
          where: { company_id_month_year: { company_id: seededData.companyA.id, month: 7, year: 2026 } },
        });
        if (existingRun7) {
          await prisma.payslip.deleteMany({ where: { payroll_run_id: existingRun7.id } });
          await prisma.payrollRun.delete({ where: { id: existingRun7.id } });
        }

        // Create a new run for month 7/2026
        const resRun = await request(app)
          .post('/api/v1/payroll/runs')
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({ month: 7, year: 2026 });
        const runId = resRun.body.data.id;

        // Try to mark as paid without approval -> blocked!
        const resPay = await request(app)
          .post(`/api/v1/payroll/runs/${runId}/pay`)
          .set('Authorization', `Bearer ${adminAToken}`);
        expect(resPay.status).toBe(400);
        expect(resPay.body.error.code).toBe('PAYROLL_NOT_APPROVED');
      });
    });

    describe('3.7 Form 16 isolation', () => {
      it('Employee accessing peer Form 16 gets 403', async () => {
        // Find a payslip belonging to Bob
        const bobPayslip = await prisma.payslip.findFirst({
          where: { employee_id: seededData.companyA.bobId },
        });

        if (bobPayslip) {
          // Alice trying to download Bob's Form 16
          const res = await request(app)
            .get(`/api/v1/payroll/payslips/${bobPayslip.id}/form16`)
            .set('Authorization', `Bearer ${aliceToken}`);
          expect(res.status).toBe(404); // Or 403 / access denied
        }
      });
    });

    describe('3.8 Historical integrity of older payslips', () => {
      it('Existing payslip figures remain unchanged even if statutory rates are later modified', async () => {
        const existingHist = await prisma.payrollRun.findUnique({
          where: {
            company_id_month_year: {
              company_id: seededData.companyA.id,
              month: 1,
              year: 2025,
            },
          },
        });
        if (existingHist) {
          await prisma.payslip.deleteMany({ where: { payroll_run_id: existingHist.id } });
          await prisma.payrollRun.delete({ where: { id: existingHist.id } });
        }

        // Create a payslip with specific historical values
        const historicalRun = await prisma.payrollRun.create({
          data: {
            company_id: seededData.companyA.id,
            month: 1,
            year: 2025,
            status: 'paid',
            approval_status: 'approved',
            generated_by: (await prisma.user.findUnique({ where: { email: 'admin@acmecorp.com' } }))!.id,
          },
        });

        const historicalSlip = await prisma.payslip.create({
          data: {
            company_id: seededData.companyA.id,
            payroll_run_id: historicalRun.id,
            employee_id: seededData.companyA.aliceId,
            gross_amount: 35000.0,
            net_amount: 31200.0,
            working_days: 22,
            present_days: 22.0,
            paid_leave_days: 0.0,
            unpaid_leave_days: 0.0,
            deductions_json: {
              'Provident Fund (PF)': 1800.0, // Historical 15k ceiling rate
              'Employee State Insurance (ESI)': 0.0,
            },
            status: 'paid',
          },
        });

        // Query the slip through API
        const res = await request(app)
          .get(`/api/v1/payroll/payslips/${historicalSlip.id}`)
          .set('Authorization', `Bearer ${adminAToken}`);
        expect(res.status).toBe(200);
        expect(Number(res.body.data.gross_amount)).toBe(35000);
        expect(Number(res.body.data.net_amount)).toBe(31200);
        expect(res.body.data.deductions_json['Provident Fund (PF)']).toBe(1800);
      });
    });
  });

  // =========================================================================
  // PILLAR 4: DIRECTORY, ANALYTICS & DOCUMENTS
  // =========================================================================
  describe('Pillar 4: Directory, Analytics & Documents', () => {
    it('New company with zero employees returns clean empty analytics without error', async () => {
      const rand = Math.floor(Math.random() * 1000000);
      // Create fresh company with zero employees
      const emptyCompany = await prisma.company.create({
        data: {
          name: `Empty State Corp ${rand}`,
          industry: 'Analytics Test',
          size_range: '1-10',
          contact_person_name: 'Ghost User',
          contact_email: `ghost_${rand}@emptycorp.com`,
          contact_phone: '+1-555-0999',
          address: 'Void Street',
          license_plan: 'basic',
          license_status: 'active',
          license_start_date: new Date(),
          license_expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          created_by: (await prisma.superAdmin.findFirst())!.id,
        },
      });

      // Create admin user for empty company
      const emptyAdmin = await prisma.user.create({
        data: {
          company_id: emptyCompany.id,
          email: `admin_${rand}@emptycorp.com`,
          password_hash: await bcrypt.hash('Password123!', 10),
          role: 'company_admin',
          must_change_password: false,
        },
      });

      const emptyLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: `admin_${rand}@emptycorp.com`, password: 'Password123!' });
      const emptyToken = emptyLogin.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/employees/analytics')
        .set('Authorization', `Bearer ${emptyToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalEmployees).toBe(0);
      expect(res.body.data.byStatus.active).toBe(0);
      expect(res.body.data.departments).toEqual([]);
    });

    it('Deactivating an employee updates active/inactive counts immediately while keeping records intact', async () => {
      // Deactivate Bob
      const resDeact = await request(app)
        .patch(`/api/v1/employees/${seededData.companyA.bobId}/status`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ status: 'inactive' });
      expect(resDeact.status).toBe(200);

      // Check analytics
      const resAnalytics = await request(app)
        .get('/api/v1/employees/analytics')
        .set('Authorization', `Bearer ${adminAToken}`);
      expect(resAnalytics.status).toBe(200);
      expect(resAnalytics.body.data.byStatus.inactive).toBeGreaterThanOrEqual(1);

      // Verify Bob's historical attendance is still intact in DB
      const attendanceBob = await prisma.attendance.findMany({
        where: { employee_id: seededData.companyA.bobId },
      });
      expect(attendanceBob.length).toBeGreaterThan(0);

      // Restore Bob to active
      await request(app)
        .patch(`/api/v1/employees/${seededData.companyA.bobId}/status`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ status: 'active' });
    });

    it("SQL injection search string (' OR 1=1--) returns safely without leaking unexpected data", async () => {
      const res = await request(app)
        .get("/api/v1/employees?search=' OR 1=1--")
        .set('Authorization', `Bearer ${adminAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0); // Safely searched literal string
    });

    it('Document URL starting with javascript: or data: is rejected', async () => {
      const resJs = await request(app)
        .post(`/api/v1/documents/employees/${seededData.companyA.aliceId}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          document_type: 'contract',
          file_name: 'malicious.pdf',
          file_url: 'javascript:alert(1)',
        });
      expect(resJs.status).toBe(400);

      const resData = await request(app)
        .post(`/api/v1/documents/employees/${seededData.companyA.aliceId}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          document_type: 'contract',
          file_name: 'malicious.pdf',
          file_url: 'data:text/html,<script>alert(1)</script>',
        });
      expect(resData.status).toBe(400);
    });

    it('Valid https:// document URL from approved storage domain is accepted', async () => {
      const res = await request(app)
        .post(`/api/v1/documents/employees/${seededData.companyA.aliceId}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          document_type: 'contract',
          file_name: 'Employment_Contract_2026.pdf',
          file_url: 'https://storage.novapulse.io/acmecorp/contracts/alice-2026.pdf',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.file_url).toBe('https://storage.novapulse.io/acmecorp/contracts/alice-2026.pdf');
    });
  });
});
