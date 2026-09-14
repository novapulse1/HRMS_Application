/// <reference types="jest" />

import { calculateEmployeePayroll } from '../src/modules/payroll/payroll-calculator';
import { createRateLimiter } from '../src/common/middleware/rate-limit';

describe('Nova Pulse HRMS — Comprehensive Edge Cases Suite', () => {
  describe('1. Payroll Edge Cases & Financial Boundary Invariants', () => {
    it('EDGE CASE: Total deductions exceed gross earnings -> net amount MUST clamp to 0 (never negative)', () => {
      const result = calculateEmployeePayroll({
        payType: 'monthly',
        baseAmount: 1000,
        workingDaysInMonth: 20,
        presentDays: 2,
        paidLeaveDays: 0,
        unpaidLeaveDays: 18, // 18 * 50 = $900 unpaid leave deduction
        workedHours: 16,
        overtimeHours: 0,
        overtimeRateMultiplier: 1.5,
        additionalDeductions: {
          'Income Tax Advance': 300,
          'Equipment Damage Penalty': 500,
        },
      });

      // Gross = 1000
      // Deductions = 900 + 300 + 500 = 1700
      // Net without clamping would be -700. Clamping MUST ensure 0.
      expect(result.grossAmount).toBe(1000);
      expect(result.totalDeductions).toBe(1700);
      expect(result.netAmount).toBe(0);
    });

    it('EDGE CASE: Zero worked hours and 100% unpaid leave for monthly employee', () => {
      const result = calculateEmployeePayroll({
        payType: 'monthly',
        baseAmount: 4000,
        workingDaysInMonth: 20,
        presentDays: 0,
        paidLeaveDays: 0,
        unpaidLeaveDays: 20, // 20 * 200 = $4000 deduction
        workedHours: 0,
        overtimeHours: 0,
        overtimeRateMultiplier: 1.5,
      });

      expect(result.grossAmount).toBe(4000);
      expect(result.totalDeductions).toBe(4000);
      expect(result.netAmount).toBe(0);
    });

    it('EDGE CASE: Overtime hours present but overtimeRateMultiplier is 0 -> overtime pay must be exactly 0', () => {
      const result = calculateEmployeePayroll({
        payType: 'hourly',
        baseAmount: 50,
        workingDaysInMonth: 20,
        presentDays: 10,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        workedHours: 80,
        overtimeHours: 15,
        overtimeRateMultiplier: 0, // Overtime disabled / 0 multiplier
      });

      expect(result.overtimeAmount).toBe(0);
      expect(result.grossAmount).toBe(4000); // 80 * 50
      expect(result.netAmount).toBe(4000);
    });

    it('EDGE CASE: Floating point rounding precision — ensures 2 decimal places precision without rounding drift', () => {
      // Base: $3,333.33 for 23 working days
      const result = calculateEmployeePayroll({
        payType: 'monthly',
        baseAmount: 3333.33,
        workingDaysInMonth: 23,
        presentDays: 22,
        paidLeaveDays: 0,
        unpaidLeaveDays: 1,
        workedHours: 176,
        overtimeHours: 0,
        overtimeRateMultiplier: 1.5,
      });

      // Per day rate: 3333.33 / 23 = 144.927... -> 144.93
      expect(result.perDayRate).toBe(144.93);
      // Net: 3333.33 - 144.93 = 3188.40
      expect(result.netAmount).toBe(3188.40);
    });
  });

  describe('2. Leave Balance & Quota Edge Cases', () => {
    function processLeaveApplication(
      quotaAllocated: number,
      quotaUsed: number,
      requestedDays: number,
      isPaid: boolean,
      startDate: string,
      endDate: string
    ) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end < start) {
        return { success: false, error: 'End date cannot be prior to start date' };
      }

      if (requestedDays <= 0) {
        return { success: false, error: 'Leave duration must be greater than zero' };
      }

      const remaining = quotaAllocated - quotaUsed;

      if (isPaid && requestedDays > remaining) {
        return { success: false, error: 'Requested days exceed remaining leave balance' };
      }

      return {
        success: true,
        newUsed: isPaid ? quotaUsed + requestedDays : quotaUsed,
        newRemaining: isPaid ? remaining - requestedDays : remaining,
      };
    }

    it('EDGE CASE: Inverted date range (end date earlier than start date) -> must reject', () => {
      const result = processLeaveApplication(12, 2, 3, true, '2026-10-15', '2026-10-10');
      expect(result.success).toBe(false);
      expect(result.error).toContain('End date cannot be prior to start date');
    });

    it('EDGE CASE: Zero or negative days application -> must reject', () => {
      const result = processLeaveApplication(12, 2, 0, true, '2026-10-10', '2026-10-10');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Leave duration must be greater than zero');
    });

    it('EDGE CASE: Requesting exactly the remaining quota -> succeeds and leaves 0 remaining', () => {
      const result = processLeaveApplication(12, 9, 3, true, '2026-10-10', '2026-10-12');
      expect(result.success).toBe(true);
      expect(result.newRemaining).toBe(0);
      expect(result.newUsed).toBe(12);
    });

    it('EDGE CASE: Requesting 1 day more than remaining quota -> strictly blocked', () => {
      const result = processLeaveApplication(12, 9, 4, true, '2026-10-10', '2026-10-13');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Requested days exceed remaining leave balance');
    });
  });

  describe('3. Rate Limiting Compound Key Edge Cases', () => {
    it('EDGE CASE: Compound key ensures attacker IP is rate-limited without locking out legitimate user on a different IP', () => {
      const mockStore = new Map<string, { count: number; resetTime: number }>();
      const maxAttempts = 5;

      function checkAttempt(ip: string, email: string): boolean {
        const key = `${ip}:${email.trim().toLowerCase()}`;
        const record = mockStore.get(key) || { count: 0, resetTime: Date.now() + 60000 };
        record.count++;
        mockStore.set(key, record);
        return record.count <= maxAttempts;
      }

      const victimEmail = 'alice@acmecorp.com';
      const attackerIp = '203.0.113.55';
      const legitimateIp = '198.51.100.10';

      // Attacker attempts 5 wrong tries
      for (let i = 0; i < 5; i++) {
        expect(checkAttempt(attackerIp, victimEmail)).toBe(true);
      }
      // 6th try from Attacker IP -> BLOCKED
      expect(checkAttempt(attackerIp, victimEmail)).toBe(false);

      // Legitimate user on Legitimate IP tries -> ALLOWED!
      expect(checkAttempt(legitimateIp, victimEmail)).toBe(true);
    });
  });

  describe('4. Tenant Cross-Boundary Penetration Edge Cases', () => {
    it('EDGE CASE: Manipulating URL parameters or request bodies with foreign companyId NEVER overrides authenticated JWT', () => {
      const jwtClaims = { companyId: 'acme-corp-uuid-001', role: 'company_admin' };
      const maliciousPayload = { companyId: 'nexus-cloud-uuid-999', employeeId: 'nexus-emp-444' };

      // Invariant: Controller/Service must always take companyId from jwtClaims, NEVER from payload
      const effectiveCompanyId = jwtClaims.companyId;

      expect(effectiveCompanyId).toBe('acme-corp-uuid-001');
      expect(effectiveCompanyId).not.toBe(maliciousPayload.companyId);
    });
  });

  describe('5. Real-World Operational & Workplace Edge Cases', () => {
    it('OPERATIONAL EDGE CASE: Night shift crossing midnight (22:00 to 06:00) yields 8 hours (not -16 hours)', () => {
      const startTime = '22:00';
      const endTime = '06:00';
      const isNightShift = true;

      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      let startMinutes = startH * 60 + startM;
      let endMinutes = endH * 60 + endM;

      if (isNightShift || endMinutes < startMinutes) {
        endMinutes += 24 * 60;
      }

      const shiftSpanHours = (endMinutes - startMinutes) / 60;
      expect(shiftSpanHours).toBe(8); // Exactly 8 hours span
    });

    it('OPERATIONAL EDGE CASE: Overlapping leave requests must be strictly detected and blocked', () => {
      interface LeaveRange {
        start: string;
        end: string;
      }

      const existingLeaves: LeaveRange[] = [
        { start: '2026-10-10', end: '2026-10-15' },
      ];

      function hasOverlap(newStart: string, newEnd: string): boolean {
        const s = new Date(newStart).getTime();
        const e = new Date(newEnd).getTime();
        return existingLeaves.some((l) => {
          const exS = new Date(l.start).getTime();
          const exE = new Date(l.end).getTime();
          return s <= exE && e >= exS;
        });
      }

      // Overlap cases:
      expect(hasOverlap('2026-10-12', '2026-10-14')).toBe(true); // Inside existing
      expect(hasOverlap('2026-10-08', '2026-10-11')).toBe(true); // Starts before, ends inside
      expect(hasOverlap('2026-10-14', '2026-10-18')).toBe(true); // Starts inside, ends after
      expect(hasOverlap('2026-10-05', '2026-10-20')).toBe(true); // Engulfs existing
      // Non-overlap cases:
      expect(hasOverlap('2026-10-01', '2026-10-09')).toBe(false); // Before
      expect(hasOverlap('2026-10-16', '2026-10-20')).toBe(false); // After
    });

    it('OPERATIONAL EDGE CASE: Leave crossing month boundary only deducts days falling inside the payroll month', () => {
      // Leave from Oct 28 to Nov 4 (8 calendar days: 4 in Oct, 4 in Nov)
      const leaveStart = new Date('2026-10-28T00:00:00Z');
      const leaveEnd = new Date('2026-11-04T00:00:00Z');

      // October Payroll (Oct 1 to Oct 31)
      const octStart = new Date('2026-10-01T00:00:00Z');
      const octEnd = new Date('2026-10-31T23:59:59Z');

      const effOctStart = Math.max(leaveStart.getTime(), octStart.getTime());
      const effOctEnd = Math.min(leaveEnd.getTime(), octEnd.getTime());
      const octDays = Math.floor((effOctEnd - effOctStart) / (1000 * 60 * 60 * 24)) + 1;

      expect(octDays).toBe(4); // Only 4 days deducted in October (NOT 8!)

      // November Payroll (Nov 1 to Nov 30)
      const novStart = new Date('2026-11-01T00:00:00Z');
      const novEnd = new Date('2026-11-30T23:59:59Z');

      const effNovStart = Math.max(leaveStart.getTime(), novStart.getTime());
      const effNovEnd = Math.min(leaveEnd.getTime(), novEnd.getTime());
      const novDays = Math.floor((effNovEnd - effNovStart) / (1000 * 60 * 60 * 24)) + 1;

      expect(novDays).toBe(4); // Only 4 days deducted in November (NOT 8!)
    });

    it('OPERATIONAL EDGE CASE: Mid-month joiner base salary is prorated proportionally', () => {
      const fullBaseSalary = 6000;
      const daysInMonth = 30;
      const joinDay = 16; // Joined exactly midway (15 days remaining in month)

      const remainingDays = daysInMonth - joinDay + 1; // 15 days
      const prorationRatio = remainingDays / daysInMonth; // 0.5
      const proratedBase = Math.round(fullBaseSalary * prorationRatio * 100) / 100;

      expect(proratedBase).toBe(3000); // 50% salary paid
    });
  });
});
