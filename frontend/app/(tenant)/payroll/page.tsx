'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  DollarSign,
  Calendar,
  CreditCard,
  Download,
  Plus,
  CheckCircle2,
  Clock,
  ChevronRight,
  TrendingUp,
  FileText,
  AlertCircle,
  Search,
  Filter,
  Users,
  ShieldCheck,
  Percent,
  Landmark,
  XCircle,
  HelpCircle,
  Trash2,
  Repeat,
  X,
} from 'lucide-react';

interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: 'draft' | 'processing' | 'completed' | 'paid';
  approvalStatus: 'pending_approval' | 'approved' | 'rejected';
  approvedBy?: string | null;
  approvedAt?: string | null;
  generatedAt: string;
  generatedBy: string;
  employeeCount: number;
  totalGross: number;
  totalNet: number;
  paidCount: number;
}

interface SalaryStructureItem {
  employeeId: string;
  employeeCode: string;
  name: string;
  email: string;
  department: string | null;
  designation: string | null;
  salaryStructure: {
    id: string;
    pay_type: 'monthly' | 'hourly' | 'per_day';
    base_amount: number;
    effective_from: string;
  } | null;
}

interface LoanItem {
  id: string;
  employee_id: string;
  amount: number;
  monthly_deduction_amount: number;
  outstanding_balance: number;
  tenure_months: number;
  status: string;
  reason?: string | null;
  created_at: string;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code: string;
    department?: { name: string };
  };
  approver?: { id: string; email: string };
}

interface StatutoryConfig {
  pf_enabled: boolean;
  pf_employee_rate: number;
  pf_employer_rate: number;
  pf_wage_ceiling: number;
  esi_enabled: boolean;
  esi_employee_rate: number;
  esi_employer_rate: number;
  esi_wage_ceiling: number;
  tds_enabled: boolean;
  default_tax_regime: 'new_regime' | 'old_regime';
}

interface MyPayslip {
  id: string;
  gross_amount: number;
  net_amount: number;
  working_days: number;
  present_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  overtime_hours: number;
  overtime_amount: number;
  status: 'generated' | 'paid';
  generated_at: string;
  payroll_run: {
    month: number;
    year: number;
    status: string;
    approval_status?: string;
  };
}

interface HolidayItem {
  id: string;
  name: string;
  date: string;
  is_recurring_annually: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PayrollPage() {
  const [user, setUser] = useState<any>(null);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [salaryItems, setSalaryItems] = useState<SalaryStructureItem[]>([]);
  const [myPayslips, setMyPayslips] = useState<MyPayslip[]>([]);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [statutorySettings, setStatutorySettings] = useState<StatutoryConfig>({
    pf_enabled: true,
    pf_employee_rate: 12.0,
    pf_employer_rate: 12.0,
    pf_wage_ceiling: 25000,
    esi_enabled: true,
    esi_employee_rate: 0.75,
    esi_employer_rate: 3.25,
    esi_wage_ceiling: 21000,
    tds_enabled: true,
    default_tax_regime: 'new_regime',
  });
  const [statutorySaved, setStatutorySaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'runs' | 'structures' | 'statutory' | 'loans' | 'holidays' | 'my'>('runs');

  // Holidays state
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayRecurring, setHolidayRecurring] = useState(true);
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [holidayError, setHolidayError] = useState<string | null>(null);

  // Run Payroll Modal
  const [showRunModal, setShowRunModal] = useState(false);
  const [runMonth, setRunMonth] = useState(new Date().getMonth() + 1);
  const [runYear, setRunYear] = useState(new Date().getFullYear());
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // Set Salary Modal
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<SalaryStructureItem | null>(null);
  const [payType, setPayType] = useState<'monthly' | 'hourly' | 'per_day'>('monthly');
  const [baseAmount, setBaseAmount] = useState('');
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salaryError, setSalaryError] = useState<string | null>(null);

  // Loan Application Modal
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanEmpId, setLoanEmpId] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanTenure, setLoanTenure] = useState('6');
  const [loanReason, setLoanReason] = useState('');
  const [loanLoading, setLoanLoading] = useState(false);
  const [loanError, setLoanError] = useState<string | null>(null);

  // Run Details View
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const me = await api.tenantGetMe();
      if (!me) return;
      setUser(me);

      if (me.role === 'employee') {
        setActiveTab('my');
        const [payslips, loansData, holidaysData] = await Promise.all([
          api.getMyPayslips(),
          api.getLoans().catch(() => []),
          api.getHolidays().catch(() => []),
        ]);
        setMyPayslips(payslips);
        setLoans(loansData);
        setHolidays(holidaysData || []);
      } else {
        const [runsData, structuresData, payslips, loansData, holidaysData] = await Promise.all([
          api.getPayrollRuns().catch(() => []),
          api.getSalaryStructures().catch(() => []),
          api.getMyPayslips().catch(() => []),
          api.getLoans().catch(() => []),
          api.getHolidays().catch(() => []),
        ]);
        setRuns(runsData);
        setSalaryItems(structuresData);
        setMyPayslips(payslips);
        setLoans(loansData);
        setHolidays(holidaysData || []);

        if (me.role === 'company_admin') {
          try {
            const statSettings = await api.getStatutorySettings();
            if (statSettings) {
              setStatutorySettings({
                pf_enabled: statSettings.pf_enabled,
                pf_employee_rate: Number(statSettings.pf_employee_rate),
                pf_employer_rate: Number(statSettings.pf_employer_rate),
                pf_wage_ceiling: Number(statSettings.pf_wage_ceiling),
                esi_enabled: statSettings.esi_enabled,
                esi_employee_rate: Number(statSettings.esi_employee_rate),
                esi_employer_rate: Number(statSettings.esi_employer_rate),
                esi_wage_ceiling: Number(statSettings.esi_wage_ceiling),
                tds_enabled: statSettings.tds_enabled,
                default_tax_regime: statSettings.default_tax_regime,
              });
            }
          } catch (e) {
            console.warn('Statutory settings error:', e);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load payroll data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExecuteRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunLoading(true);
    setRunError(null);
    try {
      await api.runPayroll({ month: Number(runMonth), year: Number(runYear) });
      setShowRunModal(false);
      await fetchData();
    } catch (err: any) {
      setRunError(err.message || 'Failed to process payroll run');
    } finally {
      setRunLoading(false);
    }
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    setSalaryLoading(true);
    setSalaryError(null);
    try {
      await api.setSalaryStructure(selectedEmp.employeeId, {
        pay_type: payType,
        base_amount: parseFloat(baseAmount),
      });
      setShowSalaryModal(false);
      setSelectedEmp(null);
      await fetchData();
    } catch (err: any) {
      setSalaryError(err.message || 'Failed to update salary structure');
    } finally {
      setSalaryLoading(false);
    }
  };

  const handleApproveRun = async (runId: string) => {
    try {
      await api.approvePayrollRun(runId);
      await fetchData();
      if (selectedRun && selectedRun.id === runId) {
        const updated = await api.getPayrollRunById(runId);
        setSelectedRun(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to approve payroll run');
    }
  };

  const handleRejectRun = async (runId: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (reason === null) return;
    try {
      await api.rejectPayrollRun(runId, reason);
      await fetchData();
      if (selectedRun && selectedRun.id === runId) {
        const updated = await api.getPayrollRunById(runId);
        setSelectedRun(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to reject payroll run');
    }
  };

  const handleMarkPaid = async (runId: string) => {
    try {
      await api.markPayrollRunPaid(runId);
      await fetchData();
      if (selectedRun && selectedRun.id === runId) {
        const updated = await api.getPayrollRunById(runId);
        setSelectedRun(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to mark as paid');
    }
  };

  const handleViewRun = async (runId: string) => {
    setDetailsLoading(true);
    try {
      const data = await api.getPayrollRunById(runId);
      setSelectedRun(data);
    } catch (err: any) {
      alert('Failed to load run details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleDownload = async (payslipId: string, filename: string) => {
    try {
      await api.downloadPayslipPdf(payslipId, filename);
    } catch (err: any) {
      alert(err.message || 'Failed to download PDF');
    }
  };

  const handleDownloadForm16 = async (payslipId: string, filename: string) => {
    try {
      await api.downloadForm16Pdf(payslipId, filename);
    } catch (err: any) {
      alert(err.message || 'Failed to download Form 16 PDF');
    }
  };

  const handleSaveStatutory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateStatutorySettings(statutorySettings);
      setStatutorySaved(true);
      setTimeout(() => setStatutorySaved(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update statutory configuration');
    }
  };

  const handleApplyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoanLoading(true);
    setLoanError(null);
    try {
      await api.createLoan({
        employee_id: isCompanyAdmin ? loanEmpId : undefined,
        amount: parseFloat(loanAmount),
        tenure_months: parseInt(loanTenure, 10),
        reason: loanReason,
      });
      setShowLoanModal(false);
      setLoanAmount('');
      setLoanReason('');
      await fetchData();
    } catch (err: any) {
      setLoanError(err.message || 'Failed to submit loan application');
    } finally {
      setLoanLoading(false);
    }
  };

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setHolidayLoading(true);
    setHolidayError(null);
    try {
      await api.createHoliday({
        name: holidayName,
        date: holidayDate,
        is_recurring_annually: holidayRecurring,
      });
      setShowHolidayModal(false);
      setHolidayName('');
      setHolidayDate('');
      const updated = await api.getHolidays();
      setHolidays(updated || []);
    } catch (err: any) {
      setHolidayError(err.message || 'Failed to create holiday');
    } finally {
      setHolidayLoading(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm('Are you sure you want to remove this statutory holiday?')) return;
    try {
      await api.deleteHoliday(id);
      const updated = await api.getHolidays();
      setHolidays(updated || []);
    } catch (err: any) {
      alert(err.message || 'Failed to delete holiday');
    }
  };

  const handleReviewLoan = async (loanId: string, action: 'approved' | 'rejected') => {
    try {
      await api.reviewLoan(loanId, action);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to review loan');
    }
  };

  const isAdminOrManager = user?.role === 'company_admin' || user?.role === 'manager';
  const isCompanyAdmin = user?.role === 'company_admin';

  const totalDisbursed = runs.reduce((acc, r) => acc + (r.status === 'paid' ? r.totalNet : 0), 0);
  const totalProcessed = runs.reduce((acc, r) => acc + r.totalNet, 0);

  const filteredSalaryItems = salaryItems.filter((emp) => {
    const q = searchQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.employeeCode.toLowerCase().includes(q) ||
      (emp.department && emp.department.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl border border-emerald-500/30 text-emerald-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Payroll & Statutory Compliance</h1>
              <p className="text-sm text-slate-400">
                Single-step approvals, Indian statutory deductions (PF, ESI, TDS Section 115BAC), loans, and Form 16 certificates
              </p>
            </div>
          </div>
        </div>

        {isCompanyAdmin && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRunModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition"
            >
              <TrendingUp className="w-4 h-4" />
              Run Payroll
            </button>
          </div>
        )}
      </div>

      {/* Summary KPI Cards (Admin / Manager only) */}
      {isAdminOrManager && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Disbursed (Paid)</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              ₹{totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-emerald-400 mt-2 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed & paid
            </p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Processed (All)</span>
              <DollarSign className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              ₹{totalProcessed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-400 mt-2">Gross across all runs</p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Loans</span>
              <Landmark className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              {loans.filter((l) => l.status === 'active').length}
            </div>
            <p className="text-xs text-amber-400 mt-2">Repayments deducted via payroll</p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Configured Staff</span>
              <Users className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              {salaryItems.filter((s) => s.salaryStructure).length} / {salaryItems.length}
            </div>
            <p className="text-xs text-sky-400 mt-2">Active salary profiles</p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 flex items-center gap-4">
        {isAdminOrManager && (
          <>
            <button
              onClick={() => setActiveTab('runs')}
              className={`pb-3 text-sm font-semibold border-b-2 transition ${
                activeTab === 'runs'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Payroll Runs ({runs.length})
            </button>

            <button
              onClick={() => setActiveTab('structures')}
              className={`pb-3 text-sm font-semibold border-b-2 transition ${
                activeTab === 'structures'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Salary Structures ({salaryItems.length})
            </button>

            {isCompanyAdmin && (
              <button
                onClick={() => setActiveTab('statutory')}
                className={`pb-3 text-sm font-semibold border-b-2 transition ${
                  activeTab === 'statutory'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Statutory Config
              </button>
            )}
          </>
        )}

        <button
          onClick={() => setActiveTab('loans')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'loans'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Loans & Advances ({loans.length})
        </button>

        <button
          onClick={() => setActiveTab('holidays')}
          className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'holidays'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Holidays & Statutory Offs ({holidays.length})
        </button>

        <button
          onClick={() => setActiveTab('my')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'my'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          My Payslips ({myPayslips.length})
        </button>
      </div>

      {/* Tab 1: Payroll Runs */}
      {activeTab === 'runs' && isAdminOrManager && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            {runs.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                <p className="text-base font-medium text-slate-300">No payroll runs executed yet</p>
                <p className="text-xs mt-1">Click "Run Payroll" to generate monthly compensation slips.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                    <th className="py-4 px-6">Period</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Approval</th>
                    <th className="py-4 px-6">Staff Count</th>
                    <th className="py-4 px-6">Net Payable</th>
                    <th className="py-4 px-6">Settlement</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {runs.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-4 px-6 font-semibold text-white">
                        {MONTH_NAMES[run.month - 1]} {run.year}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            run.status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {run.status === 'paid' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          {run.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            run.approvalStatus === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : run.approvalStatus === 'rejected'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {run.approvalStatus === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {run.approvalStatus === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                          {run.approvalStatus === 'pending_approval' && <Clock className="w-3.5 h-3.5" />}
                          {run.approvalStatus.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6">{run.employeeCount} employees</td>
                      <td className="py-4 px-6 font-bold text-white">
                        ₹{run.totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400">
                        {run.paidCount} / {run.employeeCount} Paid
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          onClick={() => handleViewRun(run.id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg text-slate-200 transition"
                        >
                          View Slips
                        </button>

                        {isCompanyAdmin && run.status !== 'paid' && (
                          <>
                            {run.approvalStatus !== 'approved' && (
                              <button
                                onClick={() => handleApproveRun(run.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                              >
                                Approve
                              </button>
                            )}
                            {run.approvalStatus === 'pending_approval' && (
                              <button
                                onClick={() => handleRejectRun(run.id)}
                                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 text-xs font-semibold rounded-lg transition"
                              >
                                Reject
                              </button>
                            )}
                            {run.approvalStatus === 'approved' && (
                              <button
                                onClick={() => handleMarkPaid(run.id)}
                                className="px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/30 text-teal-300 text-xs font-semibold rounded-lg transition"
                              >
                                Mark Paid
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Salary Structures */}
      {activeTab === 'structures' && isAdminOrManager && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff, code, department..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-800/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                  <th className="py-4 px-6">Employee</th>
                  <th className="py-4 px-6">Department</th>
                  <th className="py-4 px-6">Pay Type</th>
                  <th className="py-4 px-6">Base Compensation</th>
                  <th className="py-4 px-6">Effective Date</th>
                  {isCompanyAdmin && <th className="py-4 px-6 text-right">Configure</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredSalaryItems.map((emp) => {
                  const struct = emp.salaryStructure;
                  return (
                    <tr key={emp.employeeId} className="hover:bg-slate-800/30 transition">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-white">{emp.name}</div>
                        <div className="text-xs text-slate-400">{emp.employeeCode} • {emp.email}</div>
                      </td>
                      <td className="py-4 px-6 text-slate-300">
                        {emp.department || 'General'}
                        {emp.designation && <span className="text-xs text-slate-400 block">{emp.designation}</span>}
                      </td>
                      <td className="py-4 px-6">
                        {struct ? (
                          <span className="capitalize px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-emerald-400 border border-emerald-500/20">
                            {struct.pay_type.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-400 font-medium">Unconfigured</span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-semibold text-white">
                        {struct ? (
                          <>
                            ₹{struct.base_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            <span className="text-xs text-slate-400 font-normal block">
                              {struct.pay_type === 'monthly' ? '/ month' : struct.pay_type === 'hourly' ? '/ hour' : '/ day'}
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400">
                        {struct ? new Date(struct.effective_from).toLocaleDateString() : '—'}
                      </td>
                      {isCompanyAdmin && (
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => {
                              setSelectedEmp(emp);
                              if (emp.salaryStructure) {
                                setPayType(emp.salaryStructure.pay_type);
                                setBaseAmount(emp.salaryStructure.base_amount.toString());
                              } else {
                                setPayType('monthly');
                                setBaseAmount('');
                              }
                              setShowSalaryModal(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg transition"
                          >
                            {struct ? 'Edit' : 'Configure'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Statutory Configuration */}
      {activeTab === 'statutory' && isCompanyAdmin && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl max-w-3xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-emerald-400" />
                  Statutory Deductions & Tax Rules
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Indian compliance rules for Provident Fund (PF), ESI, and Section 115BAC TDS slabs.
                </p>
              </div>
              {statutorySaved && (
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>

            <form onSubmit={handleSaveStatutory} className="space-y-6">
              {/* Provident Fund */}
              <div className="p-4 bg-slate-800/30 border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={statutorySettings.pf_enabled}
                      onChange={(e) => setStatutorySettings({ ...statutorySettings, pf_enabled: e.target.checked })}
                      className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                    Enable Employee Provident Fund (PF)
                  </label>
                  <span className="text-xs text-slate-400">Section 80C compliant</span>
                </div>

                {statutorySettings.pf_enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Employee Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={statutorySettings.pf_employee_rate}
                        onChange={(e) => setStatutorySettings({ ...statutorySettings, pf_employee_rate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Employer Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={statutorySettings.pf_employer_rate}
                        onChange={(e) => setStatutorySettings({ ...statutorySettings, pf_employer_rate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Wage Ceiling (₹)</label>
                      <input
                        type="number"
                        value={statutorySettings.pf_wage_ceiling}
                        onChange={(e) => setStatutorySettings({ ...statutorySettings, pf_wage_ceiling: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Employee State Insurance */}
              <div className="p-4 bg-slate-800/30 border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={statutorySettings.esi_enabled}
                      onChange={(e) => setStatutorySettings({ ...statutorySettings, esi_enabled: e.target.checked })}
                      className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                    Enable Employee State Insurance (ESI)
                  </label>
                  <span className="text-xs text-slate-400">Applies under ₹21,000 ceiling</span>
                </div>

                {statutorySettings.esi_enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Employee Rate (%)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={statutorySettings.esi_employee_rate}
                        onChange={(e) => setStatutorySettings({ ...statutorySettings, esi_employee_rate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Employer Rate (%)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={statutorySettings.esi_employer_rate}
                        onChange={(e) => setStatutorySettings({ ...statutorySettings, esi_employer_rate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Wage Ceiling (₹)</label>
                      <input
                        type="number"
                        value={statutorySettings.esi_wage_ceiling}
                        onChange={(e) => setStatutorySettings({ ...statutorySettings, esi_wage_ceiling: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* TDS & Tax Regime */}
              <div className="p-4 bg-slate-800/30 border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={statutorySettings.tds_enabled}
                      onChange={(e) => setStatutorySettings({ ...statutorySettings, tds_enabled: e.target.checked })}
                      className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                    Enable Tax Deducted at Source (TDS)
                  </label>
                  <span className="text-xs text-slate-400">Auto-annualized deduction</span>
                </div>

                {statutorySettings.tds_enabled && (
                  <div className="pt-2">
                    <label className="text-xs text-slate-400 block mb-1">Default Income Tax Regime</label>
                    <select
                      value={statutorySettings.default_tax_regime}
                      onChange={(e) => setStatutorySettings({ ...statutorySettings, default_tax_regime: e.target.value as any })}
                      className="w-full md:w-1/2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="new_regime">New Tax Regime (Section 115BAC - ₹75k Standard Deduction)</option>
                      <option value="old_regime">Old Tax Regime (Slab based with Chapter VIA)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition"
                >
                  Save Statutory Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 4: Loans & Advances */}
      {activeTab === 'loans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white">Employee Loans & Advances</h3>
              <p className="text-xs text-slate-400">Scheduled repayments are automatically deducted from monthly payroll.</p>
            </div>
            <button
              onClick={() => {
                if (salaryItems.length > 0) setLoanEmpId(salaryItems[0].employeeId);
                setShowLoanModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
              Apply for Loan
            </button>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            {loans.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Landmark className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                <p className="text-base font-medium text-slate-300">No active loans found</p>
                <p className="text-xs mt-1">Staff can submit advance requests here.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                    <th className="py-4 px-6">Employee</th>
                    <th className="py-4 px-6">Loan Amount</th>
                    <th className="py-4 px-6">Monthly EMI</th>
                    <th className="py-4 px-6">Outstanding</th>
                    <th className="py-4 px-6">Tenure</th>
                    <th className="py-4 px-6">Status</th>
                    {isCompanyAdmin && <th className="py-4 px-6 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {loans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-white">
                          {loan.employee?.first_name} {loan.employee?.last_name}
                        </div>
                        <div className="text-xs text-slate-400">{loan.employee?.employee_code}</div>
                      </td>
                      <td className="py-4 px-6 font-bold text-white">
                        ₹{Number(loan.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-amber-400 font-medium">
                        ₹{Number(loan.monthly_deduction_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}/mo
                      </td>
                      <td className="py-4 px-6 font-bold text-rose-400">
                        ₹{Number(loan.outstanding_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400">
                        {loan.tenure_months} months
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            loan.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : loan.status === 'repaid'
                              ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                              : loan.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {loan.status.toUpperCase()}
                        </span>
                      </td>
                      {isCompanyAdmin && (
                        <td className="py-4 px-6 text-right space-x-2">
                          {loan.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleReviewLoan(loan.id, 'approved')}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReviewLoan(loan.id, 'rejected')}
                                className="px-3 py-1 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 text-xs font-semibold rounded-lg transition"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: My Payslips */}
      {activeTab === 'my' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            {myPayslips.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                <p className="text-base font-medium text-slate-300">No payslips issued yet</p>
                <p className="text-xs mt-1">When payroll is processed by your company admin, your slips will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {myPayslips.map((slip) => {
                  const filename = `Payslip-${slip.payroll_run.month}-${slip.payroll_run.year}.pdf`;
                  const form16Filename = `Form16-${slip.payroll_run.year}.pdf`;
                  return (
                    <div key={slip.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/20 transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold text-white">
                            {MONTH_NAMES[slip.payroll_run.month - 1]} {slip.payroll_run.year}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              slip.status === 'paid'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {slip.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Working: {slip.working_days}d • Present: {slip.present_days}d • Paid Leave: {slip.paid_leave_days}d
                          {slip.unpaid_leave_days > 0 && ` • Unpaid Leave: ${slip.unpaid_leave_days}d`}
                          {slip.overtime_hours > 0 && ` • OT: ${slip.overtime_hours}h (₹${slip.overtime_amount})`}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right mr-2">
                          <div className="text-xs text-slate-400">Net Salary</div>
                          <div className="text-xl font-bold text-emerald-400">
                            ₹{Number(slip.net_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDownload(slip.id, filename)}
                          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 shadow-md transition"
                        >
                          <Download className="w-4 h-4 text-emerald-400" />
                          Payslip
                        </button>

                        <button
                          onClick={() => handleDownloadForm16(slip.id, form16Filename)}
                          className="flex items-center gap-2 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-500/30 transition"
                        >
                          <FileText className="w-4 h-4 text-emerald-400" />
                          Form 16
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Holidays & Statutory Offs */}
      {activeTab === 'holidays' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-xl">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                Statutory Public Holidays & Company Offs
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Official paid holidays declared company-wide. These days are automatically credited as fully paid non-working days during payroll calculation.
              </p>
            </div>
            {isCompanyAdmin && (
              <button
                onClick={() => setShowHolidayModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition cursor-pointer flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                Declare Holiday
              </button>
            )}
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-6">Observance / Holiday Name</th>
                  <th className="py-3.5 px-6">Calendar Date</th>
                  <th className="py-3.5 px-6">Statutory Recurrence</th>
                  {isCompanyAdmin && <th className="py-3.5 px-6 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {holidays.length === 0 ? (
                  <tr>
                    <td colSpan={isCompanyAdmin ? 4 : 3} className="py-12 text-center text-slate-500">
                      <Calendar className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                      <p className="text-sm font-medium text-slate-400">No official public holidays declared yet</p>
                      {isCompanyAdmin && (
                        <p className="text-xs text-slate-500 mt-1">Click &quot;Declare Holiday&quot; above to add company paid holidays.</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  holidays.map((h) => {
                    const dateFmt = new Date(h.date).toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });

                    return (
                      <tr key={h.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 px-6 font-semibold text-white">{h.name}</td>
                        <td className="py-4 px-6 text-slate-300 font-mono">{dateFmt}</td>
                        <td className="py-4 px-6">
                          {h.is_recurring_annually ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Repeat className="w-3 h-3" />
                              <span>Annual Recurring Holiday</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Single-Year Observance</span>
                          )}
                        </td>
                        {isCompanyAdmin && (
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => handleDeleteHoliday(h.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 cursor-pointer transition-all"
                              title="Delete Holiday"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Run Payroll */}
      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white">Execute Payroll Run</h3>
              <p className="text-xs text-slate-400 mt-1">
                Calculates earnings, PF, ESI, Section 115BAC TDS, and active loan deductions.
              </p>
            </div>

            {runError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {runError}
              </div>
            )}

            <form onSubmit={handleExecuteRun} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Target Month
                </label>
                <select
                  value={runMonth}
                  onChange={(e) => setRunMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Target Year
                </label>
                <input
                  type="number"
                  value={runYear}
                  onChange={(e) => setRunYear(Number(e.target.value))}
                  min={2020}
                  max={2030}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRunModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={runLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white rounded-xl shadow-lg shadow-emerald-600/25 transition disabled:opacity-50"
                >
                  {runLoading ? 'Processing...' : 'Run Engine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Set Salary Structure */}
      {showSalaryModal && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white">Configure Salary Structure</h3>
              <p className="text-xs text-slate-400 mt-1">
                Setting compensation for <span className="text-white font-semibold">{selectedEmp.name}</span> ({selectedEmp.employeeCode})
              </p>
            </div>

            {salaryError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {salaryError}
              </div>
            )}

            <form onSubmit={handleSaveSalary} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Compensation Model
                </label>
                <select
                  value={payType}
                  onChange={(e) => setPayType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="monthly">Monthly Fixed Salary</option>
                  <option value="hourly">Hourly Rate</option>
                  <option value="per_day">Per-Day Rate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Base Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(e.target.value)}
                  placeholder={payType === 'monthly' ? 'e.g. 50000' : payType === 'hourly' ? 'e.g. 300' : 'e.g. 2000'}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSalaryModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={salaryLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white rounded-xl shadow-lg shadow-emerald-600/25 transition disabled:opacity-50"
                >
                  {salaryLoading ? 'Saving...' : 'Save Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Apply for Loan */}
      {showLoanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white">Loan & Advance Application</h3>
              <p className="text-xs text-slate-400 mt-1">
                Repayments are deducted automatically from your monthly payslip.
              </p>
            </div>

            {loanError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {loanError}
              </div>
            )}

            <form onSubmit={handleApplyLoan} className="space-y-4">
              {isCompanyAdmin && salaryItems.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Employee
                  </label>
                  <select
                    value={loanEmpId}
                    onChange={(e) => setLoanEmpId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {salaryItems.map((emp) => (
                      <option key={emp.employeeId} value={emp.employeeId}>
                        {emp.name} ({emp.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Loan Amount (₹)
                </label>
                <input
                  type="number"
                  step="100"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Tenure (Months)
                </label>
                <select
                  value={loanTenure}
                  onChange={(e) => setLoanTenure(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="3">3 Months</option>
                  <option value="6">6 Months</option>
                  <option value="12">12 Months</option>
                  <option value="24">24 Months</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  value={loanReason}
                  onChange={(e) => setLoanReason(e.target.value)}
                  placeholder="e.g. Medical emergency or personal advance"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loanLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white rounded-xl shadow-lg shadow-emerald-600/25 transition disabled:opacity-50"
                >
                  {loanLoading ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Selected Run Payslips */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Payroll Run — {MONTH_NAMES[selectedRun.month - 1]} {selectedRun.year}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Status: <span className="uppercase font-semibold text-emerald-400">{selectedRun.status}</span> • Approval: <span className="uppercase font-semibold text-emerald-400">{selectedRun.approval_status}</span> • Total
                  Staff: {selectedRun.payslips?.length || 0}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {isCompanyAdmin && selectedRun.status !== 'paid' && selectedRun.approval_status === 'approved' && (
                  <button
                    onClick={() => handleMarkPaid(selectedRun.id)}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl transition"
                  >
                    Mark Run Paid
                  </button>
                )}
                {isCompanyAdmin && selectedRun.status !== 'paid' && selectedRun.approval_status !== 'approved' && (
                  <button
                    onClick={() => handleApproveRun(selectedRun.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition"
                  >
                    Approve Run
                  </button>
                )}
                <button
                  onClick={() => setSelectedRun(null)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Attendance</th>
                    <th className="py-3 px-4">Gross</th>
                    <th className="py-3 px-4">Deductions</th>
                    <th className="py-3 px-4">Net Salary</th>
                    <th className="py-3 px-4 text-right">Downloads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {selectedRun.payslips?.map((slip: any) => {
                    const filename = `Payslip-${slip.employee?.employee_code || 'emp'}-${selectedRun.month}-${selectedRun.year}.pdf`;
                    const form16Filename = `Form16-${slip.employee?.employee_code || 'emp'}-${selectedRun.year}.pdf`;
                    const deductions = slip.deductions_json || {};
                    const dedTotal = Object.values(deductions).reduce((a: any, b: any) => a + Number(b), 0);

                    return (
                      <tr key={slip.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">
                            {slip.employee?.first_name} {slip.employee?.last_name}
                          </div>
                          <div className="text-xs text-slate-400">
                            {slip.employee?.employee_code} • {slip.employee?.department?.name || 'General'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {slip.present_days} / {slip.working_days} Days
                          {slip.unpaid_leave_days > 0 && (
                            <span className="text-amber-400 block">{slip.unpaid_leave_days} Unpaid Leave</span>
                          )}
                          {slip.overtime_hours > 0 && (
                            <span className="text-emerald-400 block">{slip.overtime_hours}h Overtime</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-300">
                          ₹{Number(slip.gross_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-xs text-red-400 font-medium">
                          -₹{Number(dedTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-400">
                          ₹{Number(slip.net_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleDownload(slip.id, filename)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                            Payslip
                          </button>
                          <button
                            onClick={() => handleDownloadForm16(slip.id, form16Filename)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold rounded-lg transition"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-400" />
                            Form 16
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Declare Statutory Holiday */}
      {showHolidayModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Declare Statutory Holiday</h3>
              </div>
              <button
                onClick={() => setShowHolidayModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {holidayError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {holidayError}
              </div>
            )}

            <form onSubmit={handleCreateHoliday} className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Holiday / Observance Name *</label>
                <input
                  type="text"
                  required
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="e.g. Republic Day / Diwali / Independence Day"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Calendar Date *</label>
                <input
                  type="date"
                  required
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <input
                  type="checkbox"
                  id="annualRecurPayroll"
                  checked={holidayRecurring}
                  onChange={(e) => setHolidayRecurring(e.target.checked)}
                  className="rounded border-slate-800 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="annualRecurPayroll" className="text-slate-300 cursor-pointer text-xs">
                  Annual Recurring Statutory Holiday (Repeats yearly)
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowHolidayModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={holidayLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-xl shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {holidayLoading ? 'Publishing...' : 'Publish Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
