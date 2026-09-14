'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  Building2,
  Users,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Search,
  Key,
  Power,
  Copy,
  Check,
  Calendar,
  X,
  Clock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  industry: string | null;
  size_range: string | null;
  contact_person_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  license_plan: string;
  license_status: string;
  license_start_date: string;
  license_expiry_date: string;
  _count: { employees: number; users: number; departments: number };
}

interface Metrics {
  totalCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  expiredCompanies: number;
  totalEmployees: number;
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardLoading, setOnboardLoading] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  // New company form state
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyIndustry, setNewCompanyIndustry] = useState('Technology');
  const [newCompanySize, setNewCompanySize] = useState('1-50');
  const [newCompanyContactName, setNewCompanyContactName] = useState('');
  const [newCompanyContactEmail, setNewCompanyContactEmail] = useState('');
  const [newCompanyContactPhone, setNewCompanyContactPhone] = useState('');
  const [newCompanyPlan, setNewCompanyPlan] = useState('pro');

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // In-app Confirmation Modal (replaces native window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    type: 'status' | 'reset_password';
    company: Company;
    title: string;
    message: string;
    confirmText: string;
    isDanger: boolean;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Credentials reveal modal
  const [credentialsModal, setCredentialsModal] = useState<{
    companyName: string;
    email: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset password & status action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    if (!api.getAdminToken()) {
      router.push('/admin/login');
      return;
    }

    setLoading(true);
    try {
      const [dashData, compData] = await Promise.all([
        api.adminGetDashboard(),
        api.adminGetCompanies({
          search: search || undefined,
          status: statusFilter === 'ALL' ? undefined : statusFilter.toLowerCase(),
        }),
      ]);

      if (dashData?.metrics) setMetrics(dashData.metrics);
      if (compData?.data) setCompanies(compData.data);
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (
        e.code === 'UNAUTHORIZED' ||
        e.code === 'FORBIDDEN_REALM' ||
        e.code === 'INVALID_TOKEN' ||
        e.message?.toLowerCase().includes('token') ||
        e.message?.toLowerCase().includes('authorization')
      ) {
        api.removeAdminToken();
        router.push('/admin/login');
      } else {
        console.warn('Dashboard data refresh pending:', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleOnboardCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardLoading(true);
    setOnboardError(null);

    try {
      const result = await api.adminCreateCompany({
        name: newCompanyName,
        industry: newCompanyIndustry,
        size_range: newCompanySize,
        contact_person_name: newCompanyContactName,
        contact_email: newCompanyContactEmail,
        contact_phone: newCompanyContactPhone,
        license_plan: newCompanyPlan,
      });

      if (result?.adminCredentials) {
        setShowOnboardModal(false);
        setCredentialsModal({
          companyName: newCompanyName,
          email: result.adminCredentials.email,
          tempPassword: result.adminCredentials.temporaryPassword,
        });

        // Reset form
        setNewCompanyName('');
        setNewCompanyContactName('');
        setNewCompanyContactEmail('');
        setNewCompanyContactPhone('');

        showToast(`Company "${newCompanyName}" created successfully!`, 'success');
        fetchData();
      }
    } catch (err: unknown) {
      const e = err as Error;
      setOnboardError(e.message || 'Failed to onboard company');
    } finally {
      setOnboardLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    const { type, company } = confirmModal;
    setConfirmLoading(true);

    if (type === 'status') {
      const nextStatus = company.license_status === 'active' ? 'suspended' : 'active';
      setActionLoading(company.id + '-status');
      try {
        await api.adminSetCompanyStatus(company.id, nextStatus as 'active' | 'suspended');
        showToast(
          `"${company.name}" has been ${nextStatus === 'suspended' ? 'suspended' : 'activated'} successfully!`,
          'success'
        );
        setConfirmModal(null);
        await fetchData();
      } catch (err: unknown) {
        const e = err as Error;
        showToast(`Status update failed: ${e.message}`, 'error');
      } finally {
        setActionLoading(null);
        setConfirmLoading(false);
      }
    } else if (type === 'reset_password') {
      setActionLoading(company.id + '-pwd');
      try {
        const res = await api.adminResetPassword(company.id);
        setConfirmModal(null);
        if (res?.temporaryPassword) {
          setCredentialsModal({
            companyName: company.name,
            email: res.email,
            tempPassword: res.temporaryPassword,
          });
          showToast(`Temporary password generated for ${company.name}`, 'success');
        }
      } catch (err: unknown) {
        const e = err as Error;
        showToast(`Password reset failed: ${e.message}`, 'error');
      } finally {
        setActionLoading(null);
        setConfirmLoading(false);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-violet-950/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Tenant Management Console</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
              Multi-Tenant Architecture
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Provision licensed client organizations, manage system access, and monitor platform health.
          </p>
        </div>

        <button
          onClick={() => setShowOnboardModal(true)}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Onboard New Company</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Companies</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {loading ? '...' : metrics?.totalCompanies ?? 0}
          </div>
          <span className="text-[11px] text-slate-500">Registered client accounts</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Licenses</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {loading ? '...' : metrics?.activeCompanies ?? 0}
          </div>
          <span className="text-[11px] text-slate-500">Healthy subscriptions</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Suspended / Expired</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">
            {loading
              ? '...'
              : (metrics?.suspendedCompanies ?? 0) + (metrics?.expiredCompanies ?? 0)}
          </div>
          <span className="text-[11px] text-slate-500">Access disabled</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Employees</span>
            <Users className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {loading ? '...' : metrics?.totalEmployees ?? 0}
          </div>
          <span className="text-[11px] text-slate-500">Across all tenant schemas</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company or email..."
            className="w-full bg-slate-900/70 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </form>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'ACTIVE', 'SUSPENDED', 'EXPIRED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer shrink-0 ${
                statusFilter === status
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-sm'
                  : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Company</th>
                <th className="py-3.5 px-4">Admin Contact</th>
                <th className="py-3.5 px-4">License Plan</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">License Expiry</th>
                <th className="py-3.5 px-4 text-center">Employees</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading companies...
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No companies found matching criteria.
                  </td>
                </tr>
              ) : (
                companies.map((c) => {
                  const isSuspended = c.license_status === 'suspended';
                  const isExpired = c.license_status === 'expired';
                  const expiryDate = new Date(c.license_expiry_date).toLocaleDateString();

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{c.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {c.industry || 'General Business'} • {c.size_range || '1-50'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-white font-medium">{c.contact_person_name || 'Admin'}</div>
                        <div className="text-[11px] text-slate-500">{c.contact_email}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                          {c.license_plan}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                            c.license_status === 'active'
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                              : isSuspended
                              ? 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                              : 'bg-red-950/40 text-red-400 border-red-800/60'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              c.license_status === 'active'
                                ? 'bg-emerald-400'
                                : isSuspended
                                ? 'bg-amber-400'
                                : 'bg-red-400'
                            }`}
                          />
                          <span className="capitalize">{c.license_status}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{expiryDate}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-white">
                          {c._count.employees}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() =>
                            setConfirmModal({
                              type: 'reset_password',
                              company: c,
                              title: 'Reset Administrator Password',
                              message: `Generate a fresh temporary password for the administrator of "${c.name}"? They will be required to set a new password on their next login.`,
                              confirmText: 'Generate Password',
                              isDanger: false,
                            })
                          }
                          disabled={actionLoading === c.id + '-pwd' || actionLoading === c.id + '-status'}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                          title="Generate fresh temporary password"
                        >
                          {actionLoading === c.id + '-pwd' ? (
                            <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Key className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => {
                            const isSuspending = c.license_status === 'active';
                            setConfirmModal({
                              type: 'status',
                              company: c,
                              title: isSuspending ? 'Suspend Company Access' : 'Activate Company Access',
                              message: isSuspending
                                ? `Are you sure you want to suspend "${c.name}"? All employees and administrators belonging to this company will be temporarily locked out.`
                                : `Are you sure you want to activate "${c.name}"? Company users will regain full access to their dashboard and self-service portals.`,
                              confirmText: isSuspending ? 'Suspend Company' : 'Activate Company',
                              isDanger: isSuspending,
                            });
                          }}
                          disabled={actionLoading === c.id + '-pwd' || actionLoading === c.id + '-status'}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-50 ${
                            c.license_status === 'active'
                              ? 'bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border-amber-800/60'
                              : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-800/60'
                          }`}
                          title={
                            c.license_status === 'active'
                              ? 'Suspend company access'
                              : 'Activate company access'
                          }
                        >
                          {actionLoading === c.id + '-status' ? (
                            <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Power className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboard Company Modal */}
      {showOnboardModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-semibold text-white">
                  Onboard Client Company
                </h3>
              </div>
              <button
                onClick={() => setShowOnboardModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {onboardError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs">
                {onboardError}
              </div>
            )}

            <form onSubmit={handleOnboardCompany} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-300 mb-1 font-medium">
                    Company Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="e.g. Zenith Analytics Inc."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Industry</label>
                  <input
                    type="text"
                    value={newCompanyIndustry}
                    onChange={(e) => setNewCompanyIndustry(e.target.value)}
                    placeholder="e.g. Fintech"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Team Size</label>
                  <select
                    value={newCompanySize}
                    onChange={(e) => setNewCompanySize(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="1-50">1-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-500">201-500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 mb-2">
                  Initial Administrator Details
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-slate-300 mb-1 font-medium">
                      Admin Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCompanyContactName}
                      onChange={(e) => setNewCompanyContactName(e.target.value)}
                      placeholder="e.g. Michael Scott"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-slate-300 mb-1 font-medium">
                      Admin Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={newCompanyContactEmail}
                      onChange={(e) => setNewCompanyContactEmail(e.target.value)}
                      placeholder="michael@zenith.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Contact Phone</label>
                    <input
                      type="text"
                      value={newCompanyContactPhone}
                      onChange={(e) => setNewCompanyContactPhone(e.target.value)}
                      placeholder="+1-555-0100"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Subscription Plan</label>
                    <select
                      value={newCompanyPlan}
                      onChange={(e) => setNewCompanyPlan(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 capitalize"
                    >
                      <option value="trial">Trial (30 days)</option>
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onboardLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/25 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {onboardLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Provision Company</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {credentialsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">
                Company Admin Credentials Generated
              </h3>
              <p className="text-xs text-slate-400">
                Created for {credentialsModal.companyName}
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5 mb-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-sans">
                  Login Email
                </span>
                <span className="text-white select-all">{credentialsModal.email}</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-slate-500 block text-[10px] uppercase font-sans">
                  Temporary Password
                </span>
                <span className="text-amber-400 font-bold text-sm tracking-wider select-all">
                  {credentialsModal.tempPassword}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-amber-400/90 leading-relaxed mb-5 bg-amber-950/30 border border-amber-800/40 p-3 rounded-xl">
              ⚠️ Note: This temporary password is only displayed once. The company administrator will be prompted to set a new password on first login.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() =>
                  copyToClipboard(
                    `Nova Pulse HRMS Login\nEmail: ${credentialsModal.email}\nTemporary Password: ${credentialsModal.tempPassword}\nPortal: http://localhost:3000/login`
                  )
                }
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Credentials</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setCredentialsModal(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  confirmModal.isDanger
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                }`}
              >
                {confirmModal.isDanger ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Key className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">{confirmModal.title}</h3>
                <p className="text-xs text-slate-400 font-mono">{confirmModal.company.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6 bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl">
              {confirmModal.message}
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={confirmLoading}
                className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={confirmLoading}
                className={`px-4 py-2 rounded-xl text-white font-medium text-xs shadow-lg flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 ${
                  confirmModal.isDanger
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-600/25'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25'
                }`}
              >
                {confirmLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  confirmModal.confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-700/80 text-emerald-200'
                : 'bg-red-950/90 border-red-700/80 text-red-200'
            }`}
          >
            {toast.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span className="text-xs font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white p-0.5 ml-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
