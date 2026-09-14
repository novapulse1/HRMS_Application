import {
  getStatutoryRateConfig,
  CURRENT_FINANCIAL_YEAR,
} from './statutory-rates';

export interface StatutoryConfig {
  pfEnabled?: boolean;
  pfEmployeeRate?: number;
  pfWageCeiling?: number;
  esiEnabled?: boolean;
  esiEmployeeRate?: number;
  esiWageCeiling?: number;
  tdsEnabled?: boolean;
  defaultTaxRegime?: 'new_regime' | 'old_regime';
  financialYear?: string;
}

export interface PayrollCalculationInput {
  payType: 'monthly' | 'hourly' | 'per_day';
  baseAmount: number;
  workingDaysInMonth: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays?: number;
  workedHours: number;
  overtimeHours: number;
  overtimeRateMultiplier: number;
  additionalDeductions?: Record<string, number>;
  statutorySettings?: StatutoryConfig;
  loanDeduction?: number;
  financialYear?: string;
}

export interface PayrollCalculationResult {
  payType: 'monthly' | 'hourly' | 'per_day';
  baseAmount: number;
  grossAmount: number;
  deductions: Record<string, number>;
  totalDeductions: number;
  netAmount: number;
  overtimeAmount: number;
  perDayRate: number;
  hourlyRate: number;
}

/**
 * Compute Annual TDS under Section 115BAC (New Regime) or Old Regime
 * Configured dynamically via versioned statutory rate tables (FY2026-27 / Budget 2025/2026 standards)
 */
export function computeAnnualTds(
  annualGross: number,
  regime: 'new_regime' | 'old_regime' = 'new_regime',
  financialYear: string = CURRENT_FINANCIAL_YEAR
): number {
  const config = getStatutoryRateConfig(financialYear);
  const standardDeduction = config.tds.standardDeduction;
  const taxableIncome = Math.max(0, annualGross - standardDeduction);

  const regimeConfig =
    regime === 'new_regime' ? config.tds.newRegime : config.tds.oldRegime;

  // Section 87A Rebate: if taxable income is within the rebate ceiling, tax is Nil
  if (taxableIncome <= regimeConfig.rebateLimit) {
    return 0;
  }

  // Progressive slab calculation
  let tax = 0;
  for (const slab of regimeConfig.slabs) {
    if (taxableIncome > slab.min) {
      const upper =
        slab.max !== null ? Math.min(taxableIncome, slab.max) : taxableIncome;
      const taxableInSlab = upper - slab.min;
      tax += taxableInSlab * slab.rate;
    }
  }

  // Section 87A Marginal Relief (New Regime): tax before cess cannot exceed income in excess of rebate limit
  if (regime === 'new_regime' && taxableIncome > regimeConfig.rebateLimit) {
    const excessIncome = taxableIncome - regimeConfig.rebateLimit;
    if (tax > excessIncome) {
      tax = excessIncome;
    }
  }

  // Add Health & Education Cess
  const cess = tax * config.tds.cessRate;
  return Math.round((tax + cess) * 100) / 100;
}

export function calculateEmployeePayroll(
  input: PayrollCalculationInput
): PayrollCalculationResult {
  const {
    payType,
    baseAmount,
    workingDaysInMonth,
    presentDays,
    paidLeaveDays,
    unpaidLeaveDays,
    absentDays = 0,
    workedHours,
    overtimeHours,
    overtimeRateMultiplier,
    additionalDeductions = {},
    statutorySettings,
    loanDeduction = 0,
  } = input;

  const validWorkingDays = Math.max(1, workingDaysInMonth || 22);
  let perDayRate = 0;
  let hourlyRate = 0;
  let overtimeAmount = 0;
  let grossAmount = 0;
  const deductions: Record<string, number> = { ...additionalDeductions };

  if (payType === 'monthly') {
    perDayRate = Math.round((baseAmount / validWorkingDays) * 100) / 100;
    hourlyRate = Math.round((perDayRate / 8) * 100) / 100;

    if (overtimeHours > 0 && overtimeRateMultiplier > 0) {
      overtimeAmount =
        Math.round(overtimeHours * hourlyRate * overtimeRateMultiplier * 100) /
        100;
    }

    grossAmount = Math.round((baseAmount + overtimeAmount) * 100) / 100;

    // Monthly: base_amount - (unpaid_leave_days * per_day_rate)
    if (unpaidLeaveDays > 0) {
      const unpaidDeduction =
        Math.round(unpaidLeaveDays * perDayRate * 100) / 100;
      deductions['Unpaid Leave Deduction'] = unpaidDeduction;
    }

    // Loss of Pay (LOP) / Unauthorized Absence
    if (absentDays > 0) {
      const lopDeduction = Math.round(absentDays * perDayRate * 100) / 100;
      deductions['Loss of Pay (LOP)'] = lopDeduction;
    }
  } else if (payType === 'hourly') {
    hourlyRate = baseAmount;
    perDayRate = Math.round(hourlyRate * 8 * 100) / 100;

    if (overtimeHours > 0 && overtimeRateMultiplier > 0) {
      overtimeAmount =
        Math.round(overtimeHours * hourlyRate * overtimeRateMultiplier * 100) /
        100;
    }

    // Hourly: (worked_hours * hourly_rate) + overtime_amount
    const regularPay = Math.round(workedHours * hourlyRate * 100) / 100;
    grossAmount = Math.round((regularPay + overtimeAmount) * 100) / 100;
  } else if (payType === 'per_day') {
    perDayRate = baseAmount;
    hourlyRate = Math.round((perDayRate / 8) * 100) / 100;

    if (overtimeHours > 0 && overtimeRateMultiplier > 0) {
      overtimeAmount =
        Math.round(overtimeHours * hourlyRate * overtimeRateMultiplier * 100) /
        100;
    }

    // Per-day: (present_days + paid_leave_days) * per_day_rate + overtime_amount
    const payableDays = presentDays + paidLeaveDays;
    const basePay = Math.round(payableDays * perDayRate * 100) / 100;
    grossAmount = Math.round((basePay + overtimeAmount) * 100) / 100;
  }

  // Statutory Deductions (PF, ESI, TDS)
  if (statutorySettings) {
    // 1. Provident Fund (PF) — EPFO GSR 304(E) ₹25,000 wage ceiling (effective 1 July 2026)
    if (statutorySettings.pfEnabled) {
      const ceiling = statutorySettings.pfWageCeiling || 25000;
      const rate = (statutorySettings.pfEmployeeRate || 12.0) / 100;
      const eligibleWage = Math.min(grossAmount, ceiling);
      const pfAmount = Math.round(eligibleWage * rate * 100) / 100;
      if (pfAmount > 0) {
        deductions['Provident Fund (PF)'] = pfAmount;
      }
    }

    // 2. Employee State Insurance (ESI)
    if (statutorySettings.esiEnabled) {
      const ceiling = statutorySettings.esiWageCeiling || 21000;
      if (grossAmount <= ceiling) {
        const rate = (statutorySettings.esiEmployeeRate || 0.75) / 100;
        const esiAmount = Math.round(grossAmount * rate * 100) / 100;
        if (esiAmount > 0) {
          deductions['Employee State Insurance (ESI)'] = esiAmount;
        }
      }
    }

    // 3. Tax Deducted at Source (TDS)
    if (statutorySettings.tdsEnabled) {
      const annualProjected = grossAmount * 12;
      const annualTax = computeAnnualTds(
        annualProjected,
        statutorySettings.defaultTaxRegime || 'new_regime',
        statutorySettings.financialYear
      );
      const monthlyTds = Math.round((annualTax / 12) * 100) / 100;
      if (monthlyTds > 0) {
        deductions['Tax Deducted at Source (TDS)'] = monthlyTds;
      }
    }
  }

  // Loan Repayment Deduction
  if (loanDeduction > 0) {
    deductions['Loan Repayment Deduction'] = Math.round(loanDeduction * 100) / 100;
  }

  const totalDeductions = Object.values(deductions).reduce(
    (acc, val) => acc + val,
    0
  );
  const roundedTotalDeductions = Math.round(totalDeductions * 100) / 100;
  const netAmount = Math.max(
    0,
    Math.round((grossAmount - roundedTotalDeductions) * 100) / 100
  );

  return {
    payType,
    baseAmount,
    grossAmount,
    deductions,
    totalDeductions: roundedTotalDeductions,
    netAmount,
    overtimeAmount,
    perDayRate,
    hourlyRate,
  };
}
