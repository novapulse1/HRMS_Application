-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('web', 'mobile', 'biometric');

-- CreateEnum
CREATE TYPE "PayrollApprovalStatus" AS ENUM ('pending_approval', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('pending', 'active', 'repaid', 'rejected');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('new_regime', 'old_regime');

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "device_id" TEXT,
ADD COLUMN     "source" "AttendanceSource" NOT NULL DEFAULT 'web';

-- AlterTable employee_shifts
ALTER TABLE "employee_shifts" ADD COLUMN "company_id" TEXT;
UPDATE "employee_shifts" SET "company_id" = "employees"."company_id" FROM "employees" WHERE "employee_shifts"."employee_id" = "employees"."id";
ALTER TABLE "employee_shifts" ALTER COLUMN "company_id" SET NOT NULL;

-- AlterTable leave_balances
ALTER TABLE "leave_balances" ADD COLUMN "company_id" TEXT;
UPDATE "leave_balances" SET "company_id" = "employees"."company_id" FROM "employees" WHERE "leave_balances"."employee_id" = "employees"."id";
ALTER TABLE "leave_balances" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "leave_balances" ALTER COLUMN "allocated" SET DATA TYPE DECIMAL(4,1);
ALTER TABLE "leave_balances" ALTER COLUMN "used" SET DEFAULT 0;
ALTER TABLE "leave_balances" ALTER COLUMN "used" SET DATA TYPE DECIMAL(4,1);
ALTER TABLE "leave_balances" ALTER COLUMN "remaining" SET DATA TYPE DECIMAL(4,1);

-- AlterTable leave_requests
ALTER TABLE "leave_requests" ADD COLUMN "company_id" TEXT;
UPDATE "leave_requests" SET "company_id" = "employees"."company_id" FROM "employees" WHERE "leave_requests"."employee_id" = "employees"."id";
ALTER TABLE "leave_requests" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "leave_requests" ADD COLUMN "is_half_day" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leave_requests" ALTER COLUMN "total_days" SET DATA TYPE DECIMAL(4,1);

-- AlterTable payroll_runs
ALTER TABLE "payroll_runs" ADD COLUMN "approval_status" "PayrollApprovalStatus" NOT NULL DEFAULT 'pending_approval',
ADD COLUMN "approved_at" TIMESTAMP(3),
ADD COLUMN "approved_by" TEXT;

-- AlterTable payslips
ALTER TABLE "payslips" ADD COLUMN "company_id" TEXT;
UPDATE "payslips" SET "company_id" = "payroll_runs"."company_id" FROM "payroll_runs" WHERE "payslips"."payroll_run_id" = "payroll_runs"."id";
ALTER TABLE "payslips" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "payslips" ALTER COLUMN "gross_amount" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "payslips" ALTER COLUMN "net_amount" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "payslips" ALTER COLUMN "present_days" SET DATA TYPE DECIMAL(4,1);
ALTER TABLE "payslips" ALTER COLUMN "paid_leave_days" SET DATA TYPE DECIMAL(4,1);
ALTER TABLE "payslips" ALTER COLUMN "unpaid_leave_days" SET DATA TYPE DECIMAL(4,1);
ALTER TABLE "payslips" ALTER COLUMN "overtime_amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable salary_structures
ALTER TABLE "salary_structures" ALTER COLUMN "base_amount" SET DATA TYPE DECIMAL(12,2);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "device_code" TEXT NOT NULL,
    "ip_address" TEXT,
    "location" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_banks" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "banked_days" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "encashed_days" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "encashed_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "assigned_to" TEXT,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'medium',
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "sla_due_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "pf_enabled" BOOLEAN NOT NULL DEFAULT true,
    "pf_employee_rate" DECIMAL(5,2) NOT NULL DEFAULT 12.0,
    "pf_employer_rate" DECIMAL(5,2) NOT NULL DEFAULT 12.0,
    "pf_wage_ceiling" DECIMAL(12,2) NOT NULL DEFAULT 15000.00,
    "esi_enabled" BOOLEAN NOT NULL DEFAULT true,
    "esi_employee_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.75,
    "esi_employer_rate" DECIMAL(5,2) NOT NULL DEFAULT 3.25,
    "esi_wage_ceiling" DECIMAL(12,2) NOT NULL DEFAULT 21000.00,
    "tds_enabled" BOOLEAN NOT NULL DEFAULT true,
    "default_tax_regime" "TaxRegime" NOT NULL DEFAULT 'new_regime',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statutory_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "monthly_deduction_amount" DECIMAL(12,2) NOT NULL,
    "outstanding_balance" DECIMAL(12,2) NOT NULL,
    "tenure_months" INTEGER NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_documents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "document_type" TEXT NOT NULL DEFAULT 'FORM_16',
    "file_url" TEXT NOT NULL,
    "metadata_json" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "devices_company_id_id_idx" ON "devices"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_company_id_device_code_key" ON "devices"("company_id", "device_code");

-- CreateIndex
CREATE INDEX "leave_banks_company_id_id_idx" ON "leave_banks"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_banks_employee_id_year_key" ON "leave_banks"("employee_id", "year");

-- CreateIndex
CREATE INDEX "tickets_company_id_id_idx" ON "tickets"("company_id", "id");

-- CreateIndex
CREATE INDEX "tickets_employee_id_idx" ON "tickets"("employee_id");

-- CreateIndex
CREATE INDEX "tickets_assigned_to_idx" ON "tickets"("assigned_to");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_company_id_ticket_number_key" ON "tickets"("company_id", "ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "statutory_settings_company_id_key" ON "statutory_settings"("company_id");

-- CreateIndex
CREATE INDEX "loans_company_id_id_idx" ON "loans"("company_id", "id");

-- CreateIndex
CREATE INDEX "loans_employee_id_idx" ON "loans"("employee_id");

-- CreateIndex
CREATE INDEX "tax_documents_company_id_id_idx" ON "tax_documents"("company_id", "id");

-- CreateIndex
CREATE INDEX "tax_documents_employee_id_financial_year_idx" ON "tax_documents"("employee_id", "financial_year");

-- CreateIndex
CREATE INDEX "attendance_device_id_idx" ON "attendance"("device_id");

-- CreateIndex
CREATE INDEX "employee_shifts_company_id_id_idx" ON "employee_shifts"("company_id", "id");

-- CreateIndex
CREATE INDEX "leave_balances_company_id_id_idx" ON "leave_balances"("company_id", "id");

-- CreateIndex
CREATE INDEX "leave_requests_company_id_id_idx" ON "leave_requests"("company_id", "id");

-- CreateIndex
CREATE INDEX "payslips_company_id_id_idx" ON "payslips"("company_id", "id");

-- AddForeignKey
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_banks" ADD CONSTRAINT "leave_banks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_banks" ADD CONSTRAINT "leave_banks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statutory_settings" ADD CONSTRAINT "statutory_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

