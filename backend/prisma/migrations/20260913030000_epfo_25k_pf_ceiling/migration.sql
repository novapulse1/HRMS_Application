-- AlterTable: Update default pf_wage_ceiling to 25000.00 (EPFO GSR 304(E))
ALTER TABLE "statutory_settings" ALTER COLUMN "pf_wage_ceiling" SET DEFAULT 25000.00;

-- Backfill: Update existing company statutory settings from 15000 to 25000 where unchanged default
UPDATE "statutory_settings"
SET "pf_wage_ceiling" = 25000.00
WHERE "pf_wage_ceiling" = 15000.00;
