'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  X,
  Sparkles,
  AlertCircle,
  Filter,
  Users,
  Building2,
  DollarSign,
  ArrowRightLeft,
  Coins,
  History,
} from 'lucide-react';

interface LeaveBalance {
  id: string;
  leave_type_id: string;
  year: number;
  allocated: number;
  used: number;
  remaining: number;
  leave_type: { id: string; name: string; is_paid: boolean };
}

interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day?: boolean;
  reason: string;
  status: string;
  applied_at: string;
  leave_type: { id: string; name: string; is_paid: boolean };
  employee: {
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    department?: { name: string };
    designation?: { name: string };
  };
  approver?: { email: string };
}

interface SubordinateLeave {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  department?: string;
  designation?: string;
  balances: Array<{
    leave_type: string;
    is_paid: boolean;
    allocated: number;
    used: number;
    remaining: number;
  }>;
  pending_requests_count: number;
  pending_requests: Array<any>;
}

interface LeaveBankRecord {
  id: string;
  employee_id: string;
  year: number;
  banked_days: number;
  encashed_days: number;
  encashed_amount: number;
  created_at: string;
  employee?: {
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
  };
}

export default function LeavePage() {
  const [user, setUser] = useState<any>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [subordinates, setSubordinates] = useState<SubordinateLeave[]>([]);
  const [leaveBank, setLeaveBank] = useState<LeaveBankRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my' | 'approvals' | 'subordinates' | 'bank'>('my');

  // Apply Leave Modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reason, setReason] = useState('');

  // Review state
  const [reviewLoadingId, setReviewLoadingId] = useState<string | null>(null);

  // Carry Forward & Encash modals
  const [showCarryForwardModal, setShowCarryForwardModal] = useState(false);
  const [carryYear, setCarryYear] = useState(new Date().getFullYear() - 1);
  const [carryLoading, setCarryLoading] = useState(false);

  const [showEncashModal, setShowEncashModal] = useState(false);
  const [encashEmpId, setEncashEmpId] = useState('');
  const [encashYear, setEncashYear] = useState(new Date().getFullYear());
  const [encashDays, setEncashDays] = useState('1');
  const [encashLoading, setEncashLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [me, balData, reqData, typesData] = await Promise.all([
        api.tenantGetMe(),
        api.getLeaveBalances(),
        api.getLeaveRequests(),
        api.getLeaveTypes(),
      ]);

      setUser(me);
      setBalances(balData);
      setRequests(reqData);
      setLeaveTypes(typesData);
      if (typesData.length > 0 && !selectedTypeId) {
        setSelectedTypeId(typesData[0].id);
      }

      if (me && (me.role === 'company_admin' || me.role === 'manager')) {
        const subData = await api.getSubordinatesLeave().catch(() => []);
        setSubordinates(subData);
      }

      const bankData = await api.getLeaveBank().catch(() => []);
      setLeaveBank(bankData);
    } catch (err) {
      console.error('Failed to load leave data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyLoading(true);
    setApplyError(null);

    try {
      const finalEndDate = isHalfDay ? startDate : endDate;
      await api.applyLeave({
        leave_type_id: selectedTypeId,
        start_date: startDate,
        end_date: finalEndDate,
        is_half_day: isHalfDay,
        reason,
      });

      setShowApplyModal(false);
      setStartDate('');
      setEndDate('');
      setIsHalfDay(false);
      setReason('');
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      setApplyError(e.message || 'Failed to submit leave request');
    } finally {
      setApplyLoading(false);
    }
  };

  const handleReview = async (requestId: string, action: 'approve' | 'reject') => {
    setReviewLoadingId(requestId);
    try {
      await api.reviewLeave(requestId, action);
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Review failed: ${e.message}`);
    } finally {
      setReviewLoadingId(null);
    }
  };

  const handleCarryForward = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarryLoading(true);
    try {
      const res = await api.carryForwardLeave(carryYear);
      alert(res?.message || 'Carry-forward executed successfully');
      setShowCarryForwardModal(false);
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Carry-forward failed: ${e.message}`);
    } finally {
      setCarryLoading(false);
    }
  };

  const handleEncash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!encashEmpId) return;
    setEncashLoading(true);
    try {
      const res = await api.encashLeave({
        employee_id: encashEmpId,
        year: encashYear,
        days_to_encash: parseFloat(encashDays),
      });
      alert(`Encashment processed! Added $${res?.encash_amount_added} for ${res?.encashed_days_added} days.`);
      setShowEncashModal(false);
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Encashment failed: ${e.message}`);
    } finally {
      setEncashLoading(false);
    }
  };

  const isManagerOrAdmin = user?.role === 'company_admin' || user?.role === 'manager';
  const isAdmin = user?.role === 'company_admin';

  const myRequests = requests.filter((r) => r.employee?.id === user?.employee?.id);
  const pendingApprovals = requests.filter(
    (r) => r.status === 'pending' && r.employee?.id !== user?.employee?.id
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-teal-400" />
            <span>Leave & Absence Center</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review allocated annual quotas, submit standard or 0.5-day leaves, and manage team carry-forward.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowCarryForwardModal(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 px-3.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-teal-400" />
              <span>Carry-Forward</span>
            </button>
          )}

          <button
            onClick={() => setShowApplyModal(true)}
            className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Apply for Leave</span>
          </button>
        </div>
      </div>

      {/* Leave Balances Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {balances.map((b) => {
          const pct = Math.min(100, Math.round((Number(b.used) / (Number(b.allocated) || 1)) * 100));

          return (
            <div
              key={b.id}
              className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-white">{b.leave_type?.name}</span>
                  <span className="text-[10px] uppercase font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded">
                    {b.leave_type?.is_paid ? 'Paid' : 'Unpaid'}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-bold text-white">{Number(b.remaining)}</span>
                  <span className="text-xs text-slate-500">/ {Number(b.allocated)} left</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-teal-500 h-full rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>{Number(b.used)} used</span>
                  <span>{pct}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('my')}
          className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'my'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          My Leave History ({myRequests.length})
        </button>

        {isManagerOrAdmin && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'approvals'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <span>Team Approvals</span>
            {pendingApprovals.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        )}

        {isManagerOrAdmin && (
          <button
            onClick={() => setActiveTab('subordinates')}
            className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'subordinates'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Direct Reports Roster ({subordinates.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('bank')}
          className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'bank'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span>Leave Bank & Encashment</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'my' || activeTab === 'approvals' ? (
        /* Requests Table */
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  {activeTab === 'approvals' && <th className="py-3.5 px-4">Employee</th>}
                  <th className="py-3.5 px-4">Leave Type</th>
                  <th className="py-3.5 px-4">Dates</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4">Reason</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">
                    {activeTab === 'approvals' ? 'Decide' : 'Applied On'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading leave records...
                    </td>
                  </tr>
                ) : (activeTab === 'my' ? myRequests : requests).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No leave requests found.
                    </td>
                  </tr>
                ) : (
                  (activeTab === 'my' ? myRequests : requests).map((req) => {
                    const startFmt = new Date(req.start_date).toLocaleDateString();
                    const endFmt = new Date(req.end_date).toLocaleDateString();
                    const appliedFmt = new Date(req.applied_at).toLocaleDateString();

                    return (
                      <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                        {activeTab === 'approvals' && (
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white">
                              {req.employee?.first_name} {req.employee?.last_name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {req.employee?.employee_code} • {req.employee?.department?.name}
                            </div>
                          </td>
                        )}

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-white">{req.leave_type?.name}</span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-300">
                          {startFmt} {startFmt !== endFmt ? `– ${endFmt}` : ''}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-white font-mono mr-1.5">
                            {req.total_days} {req.total_days === 1 ? 'day' : 'days'}
                          </span>
                          {req.is_half_day && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              0.5 Half-Day
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                          {req.reason}
                        </td>

                        <td className="py-3.5 px-4">
                          {req.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-800/60 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approved</span>
                            </span>
                          ) : req.status === 'rejected' ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-red-950/50 text-red-400 border border-red-800/60 font-medium">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Rejected</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-950/50 text-amber-400 border border-amber-800/60 font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {activeTab === 'approvals' && req.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleReview(req.id, 'approve')}
                                disabled={reviewLoadingId === req.id}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                              >
                                <Check className="w-3 h-3" />
                                <span>Approve</span>
                              </button>

                              <button
                                onClick={() => handleReview(req.id, 'reject')}
                                disabled={reviewLoadingId === req.id}
                                className="px-2.5 py-1 rounded-lg bg-red-600/80 hover:bg-red-500 text-white font-medium text-[11px] flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500">{appliedFmt}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'subordinates' ? (
        /* Subordinates Roster View */
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Direct Reports Leave Quota Status
              </h3>
              <p className="text-[11px] text-slate-500">
                Real-time visibility into your team&apos;s allocated and remaining balances.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-800/60">
              {subordinates.length} Team Members
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Department & Role</th>
                  <th className="py-3.5 px-4">Leave Balances (Remaining / Allocated)</th>
                  <th className="py-3.5 px-4 text-right">Pending Requests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {subordinates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500">
                      No direct reports assigned to your profile.
                    </td>
                  </tr>
                ) : (
                  subordinates.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">
                          {sub.first_name} {sub.last_name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {sub.employee_code} • {sub.email}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <div>{sub.department || 'Unassigned'}</div>
                        <div className="text-[11px] text-slate-500">{sub.designation || 'Staff'}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {sub.balances.map((b, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800"
                            >
                              <span className="text-slate-400">{b.leave_type}:</span>
                              <span className="font-bold text-teal-400">{b.remaining}</span>
                              <span className="text-slate-600">/{b.allocated}</span>
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {sub.pending_requests_count > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            <span>{sub.pending_requests_count} Pending</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">None</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Leave Bank & Encashment View */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <span>Leave Bank & Year-End Encashment</span>
              </h2>
              <p className="text-xs text-slate-400">
                Accumulated leave carry-forward balances and statutory encashment payouts.
              </p>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (subordinates.length > 0) setEncashEmpId(subordinates[0].id);
                    setShowEncashModal(true);
                  }}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-lg shadow-amber-600/20 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Process Encashment</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Year</th>
                    <th className="py-3.5 px-4">Banked Days</th>
                    <th className="py-3.5 px-4">Encashed Days</th>
                    <th className="py-3.5 px-4">Available Days</th>
                    <th className="py-3.5 px-4">Total Encashed Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {leaveBank.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No banked leaves recorded yet. Year-end carry forward automatically accumulates balances into this bank.
                      </td>
                    </tr>
                  ) : (
                    leaveBank.map((b) => {
                      const available = Math.max(0, Number(b.banked_days) - Number(b.encashed_days));

                      return (
                        <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-white">
                            {b.employee?.first_name} {b.employee?.last_name}
                            <span className="block text-[11px] font-mono text-slate-500">
                              {b.employee?.employee_code}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-slate-300">{b.year}</td>

                          <td className="py-3.5 px-4 font-mono font-bold text-white">
                            {Number(b.banked_days)} days
                          </td>

                          <td className="py-3.5 px-4 font-mono text-amber-400">
                            {Number(b.encashed_days)} days
                          </td>

                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                            {available} days
                          </td>

                          <td className="py-3.5 px-4 font-mono font-bold text-white">
                            ${Number(b.encashed_amount).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Apply for Leave Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-semibold text-white">Apply for Leave</h3>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {applyError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs">
                {applyError}
              </div>
            )}

            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Leave Category *</label>
                <select
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.is_paid ? 'Paid' : 'Unpaid'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Half-Day Toggle */}
              <div className="flex items-center gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="halfDayCheck"
                  checked={isHalfDay}
                  onChange={(e) => {
                    setIsHalfDay(e.target.checked);
                    if (e.target.checked && startDate) {
                      setEndDate(startDate);
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <label htmlFor="halfDayCheck" className="text-slate-300 cursor-pointer select-none">
                  <span className="font-semibold block text-white">Apply as Half-Day (0.5 day)</span>
                  <span className="text-[11px] text-slate-500 block">
                    Automatically deducts 0.5 days from quota and registers 4-hour presence.
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (isHalfDay) setEndDate(e.target.value);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">End Date *</label>
                  <input
                    type="date"
                    required
                    disabled={isHalfDay}
                    value={isHalfDay ? startDate : endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Reason for Absence *</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide context for your manager..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applyLoading}
                  className="bg-teal-600 hover:bg-teal-500 text-white font-medium px-4 py-2 rounded-xl shadow-lg shadow-teal-600/25 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {applyLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Submit Request {isHalfDay ? '(0.5 Day)' : ''}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Carry Forward Modal */}
      {showCarryForwardModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-semibold text-white">Year-End Leave Carry-Forward</h3>
              </div>
              <button
                onClick={() => setShowCarryForwardModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-400 mb-4 text-[11px]">
              This will roll over remaining paid leave balances from the selected year into each active employee&apos;s Leave Bank for {carryYear + 1}.
            </p>

            <form onSubmit={handleCarryForward} className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Source Year to Roll Over</label>
                <input
                  type="number"
                  value={carryYear}
                  onChange={(e) => setCarryYear(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCarryForwardModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={carryLoading}
                  className="bg-teal-600 hover:bg-teal-500 text-white font-medium px-4 py-2 rounded-xl shadow-lg shadow-teal-600/25 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {carryLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Execute Carry-Forward</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Encash Leave Modal */}
      {showEncashModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Process Leave Encashment</h3>
              </div>
              <button
                onClick={() => setShowEncashModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEncash} className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Employee</label>
                <select
                  value={encashEmpId}
                  onChange={(e) => setEncashEmpId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {subordinates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} ({s.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Bank Year</label>
                  <input
                    type="number"
                    value={encashYear}
                    onChange={(e) => setEncashYear(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Days to Encash</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={encashDays}
                    onChange={(e) => setEncashDays(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEncashModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={encashLoading}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-medium px-4 py-2 rounded-xl shadow-lg shadow-amber-600/25 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {encashLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Process Payout</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
