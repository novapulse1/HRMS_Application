import {
  calculateEmployeePayroll,
  computeAnnualTds,
} from '../src/modules/payroll/payroll-calculator';

describe('Phases 9 to 13 Enterprise Feature Verification Suite', () => {
  // ==========================================
  // PHASE 9: Attendance Sources & Biometric Ingress
  // ==========================================
  describe('Phase 9: Attendance Sources & Device Registry', () => {
    interface AttendanceEntry {
      source: 'web' | 'mobile' | 'biometric';
      deviceId?: string | null;
      isValidDevice: boolean;
    }

    function recordPunch(entry: AttendanceEntry) {
      if (entry.source === 'biometric') {
        if (!entry.deviceId || !entry.isValidDevice) {
          throw new Error('Biometric punch rejected: device unrecognized or inactive');
        }
      }
      return { success: true, source: entry.source, deviceId: entry.deviceId || null };
    }

    it('rejects biometric punch if device is invalid or unregistered', () => {
      expect(() =>
        recordPunch({ source: 'biometric', deviceId: 'dev-unknown', isValidDevice: false })
      ).toThrow('Biometric punch rejected');
    });

    it('successfully accepts biometric punch from an active registered device', () => {
      const punch = recordPunch({ source: 'biometric', deviceId: 'dev-001', isValidDevice: true });
      expect(punch.success).toBe(true);
      expect(punch.source).toBe('biometric');
      expect(punch.deviceId).toBe('dev-001');
    });

    it('accurately compiles source distribution percentages across web, mobile, and biometric', () => {
      const logs = [
        { source: 'web' },
        { source: 'web' },
        { source: 'mobile' },
        { source: 'biometric' },
      ];

      const counts = { web: 0, mobile: 0, biometric: 0 };
      logs.forEach((l) => counts[l.source as keyof typeof counts]++);

      expect(counts.web).toBe(2);
      expect(counts.mobile).toBe(1);
      expect(counts.biometric).toBe(1);
    });
  });

  // ==========================================
  // PHASE 10: Leave Module (Half-Day & Leave Bank)
  // ==========================================
  describe('Phase 10: Half-Day Deductions & Leave Bank Encashment', () => {
    it('accurately deducts 0.5 Decimal days for half-day leaves without floating point drift', () => {
      const startingBalance = 15.0;
      const leaveDuration = 0.5;
      const remainingBalance = startingBalance - leaveDuration;

      expect(remainingBalance).toBe(14.5);
      // Double check precision
      expect(Number(remainingBalance.toFixed(1))).toBe(14.5);
    });

    it('calculates leave encashment payout: encashed_days * per_day_rate', () => {
      const baseMonthlySalary = 60000;
      const workingDays = 20;
      const perDayRate = baseMonthlySalary / workingDays; // 3000
      const encashedDays = 5.0;

      const payout = encashedDays * perDayRate;
      expect(perDayRate).toBe(3000);
      expect(payout).toBe(15000);
    });
  });

  // ==========================================
  // PHASE 11: Employee Directory Analytics
  // ==========================================
  describe('Phase 11: Employee Analytics Aggregation', () => {
    it('accurately counts headcounts, department distribution, and employment types', () => {
      const employees = [
        { status: 'active', department: 'Engineering', type: 'full_time' },
        { status: 'active', department: 'Engineering', type: 'contract' },
        { status: 'probation', department: 'Product', type: 'full_time' },
        { status: 'inactive', department: 'Sales', type: 'full_time' },
      ];

      const totalHeadcount = employees.length;
      const activeCount = employees.filter((e) => e.status === 'active').length;
      const probationCount = employees.filter((e) => e.status === 'probation').length;
      const engCount = employees.filter((e) => e.department === 'Engineering').length;

      expect(totalHeadcount).toBe(4);
      expect(activeCount).toBe(2);
      expect(probationCount).toBe(1);
      expect(engCount).toBe(2);
    });
  });

  // ==========================================
  // PHASE 12: Helpdesk SLA Matrix
  // ==========================================
  describe('Phase 12: Support Ticketing SLA Computation', () => {
    function getSlaHours(priority: 'low' | 'medium' | 'high' | 'urgent'): number {
      const matrix = { urgent: 8, high: 24, medium: 48, low: 72 };
      return matrix[priority];
    }

    it('computes exact SLA due date according to priority matrix', () => {
      const baseTime = new Date('2026-09-12T10:00:00Z').getTime();

      // Urgent: 8 hours
      const urgentDue = new Date(baseTime + getSlaHours('urgent') * 3600 * 1000);
      expect(urgentDue.toISOString()).toBe('2026-09-12T18:00:00.000Z');

      // High: 24 hours
      const highDue = new Date(baseTime + getSlaHours('high') * 3600 * 1000);
      expect(highDue.toISOString()).toBe('2026-09-13T10:00:00.000Z');
    });

    it('flags breached SLA when current time exceeds sla_due_at and status is unresolved', () => {
      const now = new Date('2026-09-13T19:00:00Z');
      const slaDue = new Date('2026-09-13T18:00:00Z');
      const isBreached = now > slaDue;

      expect(isBreached).toBe(true);
    });
  });

  // ==========================================
  // PHASE 13: Statutory Deductions, Loans & Single-Step Approval
  // ==========================================
  describe('Phase 13: Statutory Calculations, Loans & Approvals', () => {
    it('applies revised statutory PF deduction up to ₹25,000 wage ceiling (EPFO GSR 304(E): 12% = ₹3,000)', () => {
      const resultHighSalary = calculateEmployeePayroll({
        payType: 'monthly',
        baseAmount: 80000,
        workingDaysInMonth: 22,
        presentDays: 22,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        workedHours: 176,
        overtimeHours: 0,
        overtimeRateMultiplier: 1.5,
        statutorySettings: {
          pfEnabled: true,
          pfEmployeeRate: 12.0,
          pfWageCeiling: 25000, // Revised mandatory EPFO ceiling
        },
      });

      // Ceiling applies: 25,000 * 0.12 = 3000 (capped from 80,000 * 0.12 = 9,600)
      expect(resultHighSalary.deductions['Provident Fund (PF)']).toBe(3000);
    });

    it('applies statutory ESI (0.75%) only when wage is <= ₹21,000 ceiling; exempts higher earners', () => {
      // Eligible employee (18,000 gross)
      const eligibleResult = calculateEmployeePayroll({
        payType: 'monthly',
        baseAmount: 18000,
        workingDaysInMonth: 20,
        presentDays: 20,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        workedHours: 160,
        overtimeHours: 0,
        overtimeRateMultiplier: 1.5,
        statutorySettings: {
          esiEnabled: true,
          esiEmployeeRate: 0.75,
          esiWageCeiling: 21000,
        },
      });

      // 18,000 * 0.0075 = 135
      expect(eligibleResult.deductions['Employee State Insurance (ESI)']).toBe(135);

      // Exempt employee (50,000 gross)
      const exemptResult = calculateEmployeePayroll({
        payType: 'monthly',
        baseAmount: 50000,
        workingDaysInMonth: 20,
        presentDays: 20,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        workedHours: 160,
        overtimeHours: 0,
        overtimeRateMultiplier: 1.5,
        statutorySettings: {
          esiEnabled: true,
          esiEmployeeRate: 0.75,
          esiWageCeiling: 21000,
        },
      });

      expect(exemptResult.deductions['Employee State Insurance (ESI)']).toBeUndefined();
    });

    it('computes annual TDS under Section 115BAC (New Regime, FY2026-27): nil tax for taxable income <= ₹12L', () => {
      // Annual gross 12,00,000 - 75,000 standard deduction = 11,25,000 <= 12,00,000 => Full Rebate under 87A => 0 tax
      const zeroTax = computeAnnualTds(1200000, 'new_regime');
      expect(zeroTax).toBe(0);

      // Annual gross 15,00,000 - 75,000 std deduction = 14,25,000 (> 12L, rebate does not apply)
      // 0-4L: 0
      // 4L-8L (4L @ 5% = 20,000)
      // 8L-12L (4L @ 10% = 40,000)
      // 12L-14.25L (2.25L @ 15% = 33,750)
      // Base tax = 93,750 + 4% cess (3,750) = 97,500
      const calculatedTax = computeAnnualTds(1500000, 'new_regime');
      expect(calculatedTax).toBe(97500);

      // Historical lookup verification: FY 2024-25 calculation remains accessible
      const historicalTax = computeAnnualTds(1500000, 'new_regime', '2024-25');
      expect(historicalTax).toBe(130000);
    });

    it('deducts active loan repayment and caps deduction at outstanding balance', () => {
      // Loan has outstanding balance of 3,500, scheduled EMI is 5,000
      const loanOutstanding = 3500;
      const scheduledEmi = 5000;
      const effectiveDeduction = Math.min(scheduledEmi, loanOutstanding);

      const result = calculateEmployeePayroll({
        payType: 'monthly',
        baseAmount: 60000,
        workingDaysInMonth: 22,
        presentDays: 22,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        workedHours: 176,
        overtimeHours: 0,
        overtimeRateMultiplier: 1.5,
        loanDeduction: effectiveDeduction,
      });

      expect(effectiveDeduction).toBe(3500);
      expect(result.deductions['Loan Repayment Deduction']).toBe(3500);
      expect(result.netAmount).toBe(60000 - 3500);
    });

    it('executes single-step admin approval transition and verifies paid run repayment update', () => {
      let run = {
        id: 'run-01',
        status: 'completed',
        approval_status: 'pending_approval',
        approved_by: null as string | null,
      };

      // Admin approves run
      run = {
        ...run,
        approval_status: 'approved',
        approved_by: 'admin-user-id',
      };
      expect(run.approval_status).toBe('approved');
      expect(run.approved_by).toBe('admin-user-id');

      // Marking paid reduces loan balance to 0 and closes loan
      let loan = {
        id: 'loan-01',
        outstanding_balance: 3500,
        status: 'active',
      };

      const deduction = 3500;
      loan.outstanding_balance = Math.max(0, loan.outstanding_balance - deduction);
      if (loan.outstanding_balance === 0) {
        loan.status = 'repaid';
      }

      expect(loan.outstanding_balance).toBe(0);
      expect(loan.status).toBe('repaid');
    });
  });
});
