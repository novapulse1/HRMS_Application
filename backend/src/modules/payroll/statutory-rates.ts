export interface TaxSlab {
  min: number;
  max: number | null; // null means no upper limit
  rate: number;       // e.g. 0.05 for 5%
}

export interface StatutoryRateConfig {
  financialYear: string;
  effectiveFrom: string;
  notes: string;
  pf: {
    wageCeiling: number;
    employeeRate: number; // e.g. 12.0
    employerRate: number; // e.g. 12.0
  };
  esi: {
    wageCeiling: number;
    employeeRate: number; // e.g. 0.75
    employerRate: number; // e.g. 3.25
  };
  tds: {
    standardDeduction: number;
    cessRate: number; // e.g. 0.04 for 4%
    newRegime: {
      rebateLimit: number; // Section 87A rebate ceiling on taxable income
      slabs: TaxSlab[];
    };
    oldRegime: {
      rebateLimit: number;
      slabs: TaxSlab[];
    };
  };
}

/**
 * Versioned Statutory Rate Tables
 * Maintained per Financial Year so calculation logic never breaks across Budget cycles.
 */
export const STATUTORY_RATE_TABLES: Record<string, StatutoryRateConfig> = {
  // Current Applicable Law: FY 2025-26 & FY 2026-27
  // - EPFO GSR 304(E) effective July 1, 2026: Wage ceiling revised to ₹25,000
  // - New Tax Regime (Section 115BAC): ₹75,000 standard deduction, ₹12L rebate u/s 87A, revised 4L slab intervals
  '2026-27': {
    financialYear: '2026-27',
    effectiveFrom: '2026-04-01',
    notes: 'Budget 2025/2026 revised New Regime slabs + ₹12L Section 87A rebate + EPFO ₹25,000 ceiling (effective 1 July 2026)',
    pf: {
      wageCeiling: 25000,
      employeeRate: 12.0,
      employerRate: 12.0,
    },
    esi: {
      wageCeiling: 21000,
      employeeRate: 0.75,
      employerRate: 3.25,
    },
    tds: {
      standardDeduction: 75000,
      cessRate: 0.04,
      newRegime: {
        rebateLimit: 1200000, // Section 87A: Tax is nil if taxable income <= ₹12,00,000
        slabs: [
          { min: 0, max: 400000, rate: 0.00 },
          { min: 400000, max: 800000, rate: 0.05 },
          { min: 800000, max: 1200000, rate: 0.10 },
          { min: 1200000, max: 1600000, rate: 0.15 },
          { min: 1600000, max: 2000000, rate: 0.20 },
          { min: 2000000, max: 2400000, rate: 0.25 },
          { min: 2400000, max: null, rate: 0.30 },
        ],
      },
      oldRegime: {
        rebateLimit: 500000,
        slabs: [
          { min: 0, max: 250000, rate: 0.00 },
          { min: 250000, max: 500000, rate: 0.05 },
          { min: 500000, max: 1000000, rate: 0.20 },
          { min: 1000000, max: null, rate: 0.30 },
        ],
      },
    },
  },

  // FY 2025-26: Same tax slabs, but pre-July 2026 EPFO ceiling was ₹15,000
  '2025-26': {
    financialYear: '2025-26',
    effectiveFrom: '2025-04-01',
    notes: 'FY 2025-26 revised New Regime slabs + ₹12L rebate',
    pf: {
      wageCeiling: 15000,
      employeeRate: 12.0,
      employerRate: 12.0,
    },
    esi: {
      wageCeiling: 21000,
      employeeRate: 0.75,
      employerRate: 3.25,
    },
    tds: {
      standardDeduction: 75000,
      cessRate: 0.04,
      newRegime: {
        rebateLimit: 1200000,
        slabs: [
          { min: 0, max: 400000, rate: 0.00 },
          { min: 400000, max: 800000, rate: 0.05 },
          { min: 800000, max: 1200000, rate: 0.10 },
          { min: 1200000, max: 1600000, rate: 0.15 },
          { min: 1600000, max: 2000000, rate: 0.20 },
          { min: 2000000, max: 2400000, rate: 0.25 },
          { min: 2400000, max: null, rate: 0.30 },
        ],
      },
      oldRegime: {
        rebateLimit: 500000,
        slabs: [
          { min: 0, max: 250000, rate: 0.00 },
          { min: 250000, max: 500000, rate: 0.05 },
          { min: 500000, max: 1000000, rate: 0.20 },
          { min: 1000000, max: null, rate: 0.30 },
        ],
      },
    },
  },

  // Historical Reference: FY 2024-25 (Interim/Old 3L slab structure)
  '2024-25': {
    financialYear: '2024-25',
    effectiveFrom: '2024-04-01',
    notes: 'Historical FY 2024-25 slabs (3L intervals, ₹7L rebate)',
    pf: {
      wageCeiling: 15000,
      employeeRate: 12.0,
      employerRate: 12.0,
    },
    esi: {
      wageCeiling: 21000,
      employeeRate: 0.75,
      employerRate: 3.25,
    },
    tds: {
      standardDeduction: 75000,
      cessRate: 0.04,
      newRegime: {
        rebateLimit: 700000,
        slabs: [
          { min: 0, max: 300000, rate: 0.00 },
          { min: 300000, max: 700000, rate: 0.05 },
          { min: 700000, max: 1000000, rate: 0.10 },
          { min: 1000000, max: 1200000, rate: 0.15 },
          { min: 1200000, max: 1500000, rate: 0.20 },
          { min: 1500000, max: null, rate: 0.30 },
        ],
      },
      oldRegime: {
        rebateLimit: 500000,
        slabs: [
          { min: 0, max: 250000, rate: 0.00 },
          { min: 250000, max: 500000, rate: 0.05 },
          { min: 500000, max: 1000000, rate: 0.20 },
          { min: 1000000, max: null, rate: 0.30 },
        ],
      },
    },
  },
};

export const CURRENT_FINANCIAL_YEAR = '2026-27';

/**
 * Get versioned statutory rate table for a given FY (defaults to active FY 2026-27)
 */
export function getStatutoryRateConfig(financialYear?: string): StatutoryRateConfig {
  const fy = financialYear && STATUTORY_RATE_TABLES[fyTarget(financialYear)]
    ? fyTarget(financialYear)
    : CURRENT_FINANCIAL_YEAR;

  return STATUTORY_RATE_TABLES[fy];
}

function fyTarget(fy: string): string {
  if (STATUTORY_RATE_TABLES[fy]) return fy;
  // If passed as full year e.g. "2026" or "2026-2027", normalize to "2026-27"
  if (fy.startsWith('2026')) return '2026-27';
  if (fy.startsWith('2025')) return '2025-26';
  if (fy.startsWith('2024')) return '2024-25';
  return CURRENT_FINANCIAL_YEAR;
}
