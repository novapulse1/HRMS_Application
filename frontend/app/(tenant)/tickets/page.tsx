'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  LifeBuoy,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  X,
  User,
  ShieldCheck,
  Send,
  MessageSquare,
  Sparkles,
  HelpCircle,
  TrendingUp,
  Tag,
  ArrowUpRight,
} from 'lucide-react';

interface Ticket {
  id: string;
  ticket_number: string;
  employee_id: string;
  category: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  sla_due_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
  employee?: {
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    department?: { name: string };
  };
  creator?: { id: string; email: string };
  assignee?: { id: string; email: string } | null;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Raise Ticket Modal
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [raiseCategory, setRaiseCategory] = useState('Payroll & Compensation');
  const [raiseSubject, setRaiseSubject] = useState('');
  const [raisePriority, setRaisePriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [raiseDescription, setRaiseDescription] = useState('');
  const [raiseLoading, setRaiseLoading] = useState(false);
  const [raiseError, setRaiseError] = useState<string | null>(null);

  // Manage / Resolve Modal (Admin)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [manageStatus, setManageStatus] = useState<string>('');
  const [manageResolution, setManageResolution] = useState('');
  const [manageLoading, setManageLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [me, ticketList] = await Promise.all([
        api.tenantGetMe(),
        api.getTickets(),
      ]);
      setUser(me);
      setTickets(ticketList);

      if (me && me.role === 'company_admin') {
        const stats = await api.getTicketAnalytics().catch(() => null);
        if (stats) setAnalytics(stats);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRaiseTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setRaiseLoading(true);
    setRaiseError(null);

    try {
      await api.createTicket({
        category: raiseCategory,
        subject: raiseSubject,
        priority: raisePriority,
        description: raiseDescription,
      });

      setShowRaiseModal(false);
      setRaiseSubject('');
      setRaiseDescription('');
      setRaisePriority('medium');
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      setRaiseError(e.message || 'Failed to submit support ticket');
    } finally {
      setRaiseLoading(false);
    }
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setManageLoading(true);

    try {
      await api.updateTicketStatus(selectedTicket.id, {
        status: manageStatus,
        resolution: manageResolution || undefined,
      });
      setSelectedTicket(null);
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Status update failed: ${e.message}`);
    } finally {
      setManageLoading(false);
    }
  };

  const isAdmin = user?.role === 'company_admin';
  const isManager = user?.role === 'manager';

  const priorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
            <span>Urgent (8h SLA)</span>
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>High (24h)</span>
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-400 border border-blue-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Medium (48h)</span>
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            <span>Low (72h)</span>
          </span>
        );
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-950/50 text-blue-400 border border-blue-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Open</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-purple-950/50 text-purple-400 border border-purple-800/60">
            <Clock className="w-3 h-3 text-purple-400" />
            <span>In Progress</span>
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-800/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Resolved</span>
          </span>
        );
      case 'closed':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            <span>Closed</span>
          </span>
        );
    }
  };

  const renderSlaBadge = (ticket: Ticket) => {
    if (!ticket.sla_due_at) return <span className="text-slate-500">—</span>;

    const now = new Date();
    const dueDate = new Date(ticket.sla_due_at);
    const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';

    if (isResolved) {
      const resolvedDate = ticket.resolved_at ? new Date(ticket.resolved_at) : now;
      const metSla = resolvedDate <= dueDate;
      return (
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
            metSla
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
              : 'bg-red-950/40 text-red-400 border-red-800/60'
          }`}
        >
          {metSla ? 'Met SLA' : 'SLA Breached'}
        </span>
      );
    }

    const diffMs = dueDate.getTime() - now.getTime();
    const hours = Math.round(diffMs / (1000 * 60 * 60));

    if (hours < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-red-950/60 text-red-400 border border-red-800/80">
          <AlertTriangle className="w-3 h-3" />
          <span>Overdue ({Math.abs(hours)}h)</span>
        </span>
      );
    }

    return (
      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-950 text-slate-300 border border-slate-800">
        Due in {hours}h
      </span>
    );
  };

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchSub = t.subject.toLowerCase().includes(q);
      const matchNum = t.ticket_number.toLowerCase().includes(q);
      const matchCat = t.category.toLowerCase().includes(q);
      const matchEmp = `${t.employee?.first_name} ${t.employee?.last_name}`.toLowerCase().includes(q);
      if (!matchSub && !matchNum && !matchCat && !matchEmp) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-teal-400" />
            <span>HR Helpdesk & Service Center</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Submit workplace inquiries, track resolution SLAs, and coordinate employee service tickets.
          </p>
        </div>

        <button
          onClick={() => setShowRaiseModal(true)}
          className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Raise Support Ticket</span>
        </button>
      </div>

      {/* Analytics KPI Banner (Admin) */}
      {isAdmin && analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm">
            <span className="text-xs font-medium text-slate-400">Total Company Tickets</span>
            <div className="text-3xl font-bold font-mono text-white mt-1">
              {analytics.totalTickets}
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">All time volume</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm">
            <span className="text-xs font-medium text-slate-400">Open & Active</span>
            <div className="text-3xl font-bold font-mono text-amber-400 mt-1">
              {analytics.byStatus.open + analytics.byStatus.in_progress}
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              {analytics.byStatus.open} open • {analytics.byStatus.in_progress} in-progress
            </span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm">
            <span className="text-xs font-medium text-slate-400">Resolved & Closed</span>
            <div className="text-3xl font-bold font-mono text-emerald-400 mt-1">
              {analytics.byStatus.resolved + analytics.byStatus.closed}
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">Completed inquiries</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
              SLA Compliance
            </span>
            <div className="text-3xl font-bold font-mono text-white mt-1">
              {analytics.slaComplianceRate}%
            </div>
            <span className="text-[11px] text-red-400 block mt-1">
              {analytics.slaBreachedCount} breached SLA targets
            </span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
          {['all', 'open', 'in_progress', 'resolved', 'closed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by subject, number, category..."
              className="w-full bg-slate-900/70 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 capitalize"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Ticket ID</th>
                <th className="py-3.5 px-4">Requester</th>
                <th className="py-3.5 px-4">Category & Subject</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">SLA Deadline</th>
                <th className="py-3.5 px-4">Assignee</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No tickets found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-teal-400">
                      {t.ticket_number}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">
                        {t.employee?.first_name} {t.employee?.last_name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {t.employee?.employee_code} • {t.employee?.department?.name || 'General'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        {t.category}
                      </span>
                      <div className="font-semibold text-white truncate" title={t.subject}>
                        {t.subject}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">{priorityBadge(t.priority)}</td>

                    <td className="py-3.5 px-4">{statusBadge(t.status)}</td>

                    <td className="py-3.5 px-4">{renderSlaBadge(t)}</td>

                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {t.assignee?.email ? (
                        <span className="text-slate-300">{t.assignee.email}</span>
                      ) : (
                        <span className="text-slate-600">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {isAdmin ? (
                        <button
                          onClick={() => {
                            setSelectedTicket(t);
                            setManageStatus(t.status);
                            setManageResolution(t.resolution || '');
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-teal-600 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer font-medium text-[11px]"
                        >
                          Manage / Resolve
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedTicket(t);
                            setManageStatus(t.status);
                            setManageResolution(t.resolution || '');
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer font-medium text-[11px]"
                        >
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raise Support Ticket Modal */}
      {showRaiseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-semibold text-white">Raise HR Support Ticket</h3>
              </div>
              <button
                onClick={() => setShowRaiseModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {raiseError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs">
                {raiseError}
              </div>
            )}

            <form onSubmit={handleRaiseTicket} className="space-y-3.5">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Issue Category *</label>
                <select
                  value={raiseCategory}
                  onChange={(e) => setRaiseCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="Payroll & Compensation">Payroll & Compensation (Payslips, Deductions)</option>
                  <option value="Leaves & Absence">Leaves & Absence (Quotas, Carry-forward)</option>
                  <option value="Hardware & IT Access">Hardware & IT Access (Biometric, Laptop, Credentials)</option>
                  <option value="Statutory & Tax">Statutory & Tax (PF, ESI, TDS, Form 16)</option>
                  <option value="Workplace Grievance">Workplace Grievance & General HR</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Priority Level *</label>
                <select
                  value={raisePriority}
                  onChange={(e) => setRaisePriority(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="low">Low — General inquiry (72-hour SLA)</option>
                  <option value="medium">Medium — Standard request (48-hour SLA)</option>
                  <option value="high">High — Urgent issue impacting work (24-hour SLA)</option>
                  <option value="urgent">Urgent — Payroll or security blocker (8-hour SLA)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mismatch in overtime calculation on August payslip"
                  value={raiseSubject}
                  onChange={(e) => setRaiseSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Detailed Description *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide all relevant details to help HR investigate quickly..."
                  value={raiseDescription}
                  onChange={(e) => setRaiseDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRaiseModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={raiseLoading}
                  className="bg-teal-600 hover:bg-teal-500 text-white font-medium px-4 py-2 rounded-xl shadow-lg shadow-teal-600/25 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {raiseLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Submit Ticket</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage / View Ticket Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <span className="font-mono font-bold text-teal-400 block text-xs">
                  {selectedTicket.ticket_number}
                </span>
                <h3 className="text-sm font-semibold text-white">{selectedTicket.subject}</h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Requester</span>
                  <span className="font-semibold text-white">
                    {selectedTicket.employee?.first_name} {selectedTicket.employee?.last_name} ({selectedTicket.employee?.employee_code})
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Category</span>
                  <span className="text-slate-300">{selectedTicket.category}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Priority & SLA</span>
                  <div className="flex items-center gap-1.5">
                    {priorityBadge(selectedTicket.priority)}
                    {renderSlaBadge(selectedTicket)}
                  </div>
                </div>
              </div>

              <div>
                <span className="font-medium text-slate-400 block mb-1">Description</span>
                <p className="p-3 rounded-xl bg-slate-950 text-slate-300 border border-slate-800/80 leading-relaxed whitespace-pre-wrap">
                  {selectedTicket.description}
                </p>
              </div>

              {selectedTicket.resolution && (
                <div>
                  <span className="font-medium text-emerald-400 block mb-1">Official Resolution</span>
                  <p className="p-3 rounded-xl bg-emerald-950/30 text-emerald-300 border border-emerald-800/50 leading-relaxed whitespace-pre-wrap">
                    {selectedTicket.resolution}
                  </p>
                </div>
              )}
            </div>

            {isAdmin ? (
              <form onSubmit={handleUpdateTicket} className="space-y-3.5 pt-3 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Update Status</label>
                    <select
                      value={manageStatus}
                      onChange={(e) => setManageStatus(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-teal-500 capitalize"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Assignee</label>
                    <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 truncate">
                      {selectedTicket.assignee?.email || 'Unassigned'}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Resolution Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Enter resolution actions or notes for the employee..."
                    value={manageResolution}
                    onChange={(e) => setManageResolution(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(null)}
                    className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={manageLoading}
                    className="bg-teal-600 hover:bg-teal-500 text-white font-medium px-4 py-2 rounded-xl shadow-lg shadow-teal-600/25 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {manageLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span>Save Ticket Status</span>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex justify-end pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-all cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
