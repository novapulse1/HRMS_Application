'use client';

import React, { useState, useEffect } from 'react';
import api, { getApiBaseUrl } from '@/lib/api';
import {
  FileSpreadsheet,
  ShieldAlert,
  Download,
  Calendar,
  Clock,
  User,
  History,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Briefcase,
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  user_id?: string;
  old_value_json?: any;
  new_value_json?: any;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function ReportsPage() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'exports' | 'audit'>('exports');
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Export state
  const [attMonth, setAttMonth] = useState(new Date().getMonth() + 1);
  const [attYear, setAttYear] = useState(new Date().getFullYear());
  const [leaveYear, setLeaveYear] = useState(new Date().getFullYear());
  const [payMonth, setPayMonth] = useState(new Date().getMonth() + 1);
  const [payYear, setPayYear] = useState(new Date().getFullYear());

  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const me = await api.tenantGetMe();
        if (!me) return;
        setUser(me);
        if (me.role === 'company_admin') {
          loadAuditLogs();
        }
      } catch (err) {
        console.error('Failed to load me:', err);
      }
    };
    init();
  }, []);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/audit-logs`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('nova_tenant_token')}`,
        },
      });
      const json = await res.json();
      if (json.data) {
        setLogs(json.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = async (url: string, filename: string, key: string) => {
    setDownloading(key);
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('nova_tenant_token')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to generate export');
      const blob = await res.blob();
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objUrl);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setDownloading(null);
    }
  };

  const API_BASE = getApiBaseUrl();
  const isCompanyAdmin = user?.role === 'company_admin';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-xl border border-purple-500/30 text-purple-400">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Reports & Compliance Audit</h1>
            <p className="text-sm text-slate-400">
              Export system data to certified CSV files and inspect immutable audit trails
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex items-center gap-4">
        <button
          onClick={() => setActiveTab('exports')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'exports'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Export Center
        </button>

        {isCompanyAdmin && (
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'audit'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Audit Trail ({logs.length})
          </button>
        )}
      </div>

      {/* Tab 1: Export Center */}
      {activeTab === 'exports' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Attendance Export Card */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-5">
            <div>
              <div className="flex items-center gap-3 text-sky-400 mb-3">
                <div className="p-2 bg-sky-500/10 rounded-lg border border-sky-500/20">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Attendance Summary</h3>
              </div>
              <p className="text-xs text-slate-400">
                Detailed clock in/out times, worked hours, overtime, and presence breakdown for all employees.
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800/80">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Month</label>
                  <select
                    value={attMonth}
                    onChange={(e) => setAttMonth(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Year</label>
                  <input
                    type="number"
                    value={attYear}
                    onChange={(e) => setAttYear(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <button
                onClick={() =>
                  handleDownloadCsv(
                    `${API_BASE}/reports/attendance/csv?month=${attMonth}&year=${attYear}`,
                    `Attendance-Report-${attYear}-${attMonth}.csv`,
                    'att'
                  )
                }
                disabled={downloading === 'att'}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-sky-600/25 transition disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {downloading === 'att' ? 'Exporting...' : 'Export Attendance CSV'}
              </button>
            </div>
          </div>

          {/* Leave Export Card */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-5">
            <div>
              <div className="flex items-center gap-3 text-emerald-400 mb-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Leave & Absences</h3>
              </div>
              <p className="text-xs text-slate-400">
                Full annual records of applied, approved, and rejected leave requests with reasons and balances.
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800/80">
              <div>
                <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Year</label>
                <input
                  type="number"
                  value={leaveYear}
                  onChange={(e) => setLeaveYear(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>

              <button
                onClick={() =>
                  handleDownloadCsv(
                    `${API_BASE}/reports/leave/csv?year=${leaveYear}`,
                    `Leave-Report-${leaveYear}.csv`,
                    'leave'
                  )
                }
                disabled={downloading === 'leave'}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {downloading === 'leave' ? 'Exporting...' : 'Export Leave CSV'}
              </button>
            </div>
          </div>

          {/* Payroll Export Card */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-5">
            <div>
              <div className="flex items-center gap-3 text-teal-400 mb-3">
                <div className="p-2 bg-teal-500/10 rounded-lg border border-teal-500/20">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Payroll Disbursals</h3>
              </div>
              <p className="text-xs text-slate-400">
                Itemized payroll ledger with gross earnings, unpaid deductions, overtime, and net amounts.
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800/80">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Month</label>
                  <select
                    value={payMonth}
                    onChange={(e) => setPayMonth(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Year</label>
                  <input
                    type="number"
                    value={payYear}
                    onChange={(e) => setPayYear(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <button
                onClick={() =>
                  handleDownloadCsv(
                    `${API_BASE}/reports/payroll/csv?month=${payMonth}&year=${payYear}`,
                    `Payroll-Report-${payYear}-${payMonth}.csv`,
                    'pay'
                  )
                }
                disabled={downloading === 'pay'}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-teal-600/25 transition disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {downloading === 'pay' ? 'Exporting...' : 'Export Payroll CSV'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Audit Trail */}
      {activeTab === 'audit' && isCompanyAdmin && (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <History className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-base font-medium text-slate-300">No audit log records found</p>
              <p className="text-xs mt-1">Actions such as leave approvals and payroll runs will appear here.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-800/50 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                  <th className="py-4 px-6">Timestamp (UTC)</th>
                  <th className="py-4 px-6">Action</th>
                  <th className="py-4 px-6">Entity</th>
                  <th className="py-4 px-6">Entity ID</th>
                  <th className="py-4 px-6">Details / Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-4 px-6 text-xs text-slate-400 font-mono">
                      {new Date(log.created_at).toUTCString()}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono text-xs font-semibold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-6 capitalize text-slate-300 font-medium">{log.entity_type}</td>
                    <td className="py-4 px-6 font-mono text-xs text-slate-400">{log.entity_id.slice(0, 8)}...</td>
                    <td className="py-4 px-6">
                      <pre className="text-[11px] font-mono bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 text-slate-400 max-w-md overflow-x-auto">
                        {JSON.stringify(log.new_value_json || log.old_value_json || {}, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
