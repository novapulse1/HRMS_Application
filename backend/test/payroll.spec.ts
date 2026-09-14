import { calculateEmployeePayroll } from '../src/modules/payroll/payroll-calculator';

describe('Payroll Calculation Engine (Pure Formulas)', () => {
  describe('Monthly Salary Structure', () => {
    it('calculates full base pay when there are no unpaid leaves or overtime', () => {
      const result = calculateEmployeePayroll({
        payType: 'monthly',
        baseAmount: 5000,
        workingDaysInMonth: 20,
        presentDays: 20,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        workedHours: 160,
        overtimeHours: 0,
        overtimeRateMultiplier: 1.5,
      });

      expect(result.grossAmount).toBe(5000);
      expect(result.totalDeductions).toBe(0);
      expect(result.netAmount).toBe(5000);
      expect(result.perDayRate).toBe(250); // 5000 / 20
      expect(result.hourlyRate).toBe(31.25); // 250 / 8
    });

    it('accurately deducts unpaid leaves: base_amount - (unpaid_leave_days * per_day_rate)', () => {
      // 5000 base, 20 working days => perDayRate = 250
      // 2 unpaid days => 500 deduction => 4500 net
      const result = calculateEmployeePayroll({
        payType: 'monthly',
        baseAmount: 5000,
        workingDaysInMonth: 20,
        presentDays: 18,
        paidLeaveDays: 0,
        unpaidLeaveDays: 2,
        workedHours: 144,
        overtimeHours: 0,
        overtimeRateMultiplier: 1.5,
      });

      expect(result.grossAmount).toBe(5000);
      expect(result.deductions['Unpaid Leave Deduction']).toBe(500);
      expect(result.totalDeductions).toBe(500);
      expect(result.netAmount).toBe(4500);
    });

    it('accurately deducts Loss of Pay (LOP) for unexcused absent days: absentDays * per_day_rate', () => {
      // 6000 base, 20 working days => perDayRate = 300
      // 3 absent days => 900 LOP deduction => 5100 net
      const result = calculateEmployeePayroll({
        payType: 'monthly',
        baseAmount: 6000,
        workingDaysInMonth: 20,
        presentDays: 17,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        absentDays: 3,
        workedHours: 136,
        overtimeHours: 0,
        overtimeRateMultiplier: 1.5,
      });

      expect(result.grossAmount).toBe(6000);
      expect(result.deductions['Loss of Pay (LOP)']).toBe(900);
      expect(result.totalDeductions).toBe(900);
      expect(result.netAmount).toBe(5100);
    });

    it('correctly calculates overtime pay on top of monthly base', () => {
      // 4000 base, 20 days => perDayRate = 200 => hourlyRate = 25
      // 10 overtime hours @ 1.5x => 10 * 25 * 1.5 = 375
      const result = calculateEmployeePayroll({
        payType: 'monthly',
        baseAmount: 4000,
        workingDaysInMonth: 20,
        presentDays: 20,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        workedHours: 170,
        overtimeHours: 10,
        overtimeRateMultiplier: 1.5,
      });

      expect(result.perDayRate).toBe(200);
      expect(result.hourlyRate).toBe(25);
      expect(result.overtimeAmount).toBe(375);
      expect(result.grossAmount).toBe(4375);
      expect(result.netAmount).toBe(4375);
    });
  });

  describe('Hourly Salary Structure', () => {
    it('calculates regular worked hours and overtime pay: (worked_hours * hourly_rate) + overtime', () => {
      // hourly rate = $30
      // 100 regular worked hours => 3000
      // 8 overtime hours @ 1.5x => 8 * 30 * 1.5 = 360
      const result = calculateEmployeePayroll({
        payType: 'hourly',
        baseAmount: 30,
        workingDaysInMonth: 22,
        presentDays: 15,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        workedHours: 100,
        overtimeHours: 8,
        overtimeRateMultiplier: 1.5,
      });

      expect(result.hourlyRate).toBe(30);
      expect(result.overtimeAmount).toBe(360);
      expect(result.grossAmount).toBe(3360);
      expect(result.netAmount).toBe(3360);
    });
  });

  describe('Per-Day Salary Structure', () => {
    it('calculates pay based on (present_days + paid_leave_days) * per_day_rate', () => {
      // per day rate = $200
      // 15 present days + 2 paid leave days = 17 days => 3400
      const result = calculateEmployeePayroll({
        payType: 'per_day',
        baseAmount: 200,
        workingDaysInMonth: 22,
        presentDays: 15,
        paidLeaveDays: 2,
        unpaidLeaveDays: 3,
        workedHours: 120,
        overtimeHours: 0,
        overtimeRateMultiplier: 1.5,
      });

      expect(result.perDayRate).toBe(200);
      expect(result.grossAmount).toBe(3400);
      expect(result.netAmount).toBe(3400);
    });

    it('calculates per-day pay with overtime hours: ((present_days + paid_leave_days) * per_day_rate) + overtime_amount', () => {
      // perDayRate = $200
      // hourlyRate = 200 / 8 = 25
      // 10 present days, 0 paid leave => 10 * 200 = 2000 base
      // 6 overtime hours @ 1.5x => 6 * 25 * 1.5 = 225 overtime
      // grossAmount = 2000 + 225 = 2225
      const result = calculateEmployeePayroll({
        payType: 'per_day',
        baseAmount: 200,
        workingDaysInMonth: 20,
        presentDays: 10,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        workedHours: 86,
        overtimeHours: 6,
        overtimeRateMultiplier: 1.5,
      });

      expect(result.perDayRate).toBe(200);
      expect(result.hourlyRate).toBe(25);
      expect(result.overtimeAmount).toBe(225);
      expect(result.grossAmount).toBe(2225);
      expect(result.netAmount).toBe(2225);
    });
  });

  describe('Deductions & Safety Clamping', () => {
    it('aggregates additional deductions correctly and prevents negative net pay', () => {
      const result = calculateEmployeePayroll({
        payType: 'monthly',
        baseAmount: 1000,
        workingDaysInMonth: 20,
        presentDays: 5,
        paidLeaveDays: 0,
        unpaidLeaveDays: 15, // 15 * 50 = 750 deduction
        workedHours: 40,
        overtimeHours: 0,
        overtimeRateMultiplier: 1.5,
        additionalDeductions: {
          'Health Insurance': 200,
          'Uniform Fee': 150,
        },
      });

      // Gross = 1000
      // Unpaid deduction = 750
      // Health = 200
      // Uniform = 150
      // Total deductions = 1100
      // Net amount must clamp to 0 (cannot be negative -100)
      expect(result.totalDeductions).toBe(1100);
      expect(result.netAmount).toBe(0);
    });
  });
});
