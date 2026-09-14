'use client';

import React, { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import {
  Megaphone,
  Plus,
  Search,
  Pin,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  Tag,
  Trash2,
  Edit3,
  Check,
  X,
  Flame,
  FileText,
  PartyPopper,
  ShieldAlert,
  Info,
  User,
} from 'lucide-react';

interface NoticeItem {
  id: string;
  title: string;
  content: string;
  category: 'general' | 'announcement' | 'policy' | 'event' | 'holiday';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    email: string;
    role: string;
    employee?: {
      id: string;
      first_name: string;
      last_name: string;
      employee_code: string;
    } | null;
  };
}

export default function NoticeBoardPage() {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Modal State (Create & Edit)
  const [showModal, setShowModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState<NoticeItem | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>('announcement');
  const [priority, setPriority] = useState<string>('normal');
  const [isPinned, setIsPinned] = useState(false);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const [userRes, noticesRes] = await Promise.all([
        api.tenantGetMe(),
        api.getNotices({
          search: search || undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        }),
      ]);
      setCurrentUser(userRes);
      if (noticesRes?.data) {
        setNotices(noticesRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch notice board:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [categoryFilter, priorityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchNotices();
  };

  const isPublisher = currentUser?.role === 'company_admin' || currentUser?.role === 'manager';
  const isAdmin = currentUser?.role === 'company_admin';

  const openCreateModal = () => {
    setEditingNotice(null);
    setTitle('');
    setContent('');
    setCategory('announcement');
    setPriority('normal');
    setIsPinned(false);
    setModalError(null);
    setShowModal(true);
  };

  const openEditModal = (notice: NoticeItem) => {
    setEditingNotice(notice);
    setTitle(notice.title);
    setContent(notice.content);
    setCategory(notice.category);
    setPriority(notice.priority);
    setIsPinned(notice.is_pinned);
    setModalError(null);
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);

    try {
      if (editingNotice) {
        await api.updateNotice(editingNotice.id, {
          title,
          content,
          category,
          priority,
          is_pinned: isPinned,
        });
      } else {
        await api.createNotice({
          title,
          content,
          category,
          priority,
          is_pinned: isPinned,
        });
      }
      setShowModal(false);
      fetchNotices();
    } catch (err: unknown) {
      const e = err as Error;
      setModalError(e.message || 'Failed to save notice');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    if (!confirm('Are you sure you want to remove this notice?')) return;
    try {
      await api.deleteNotice(id);
      fetchNotices();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Failed to delete notice: ${e.message}`);
    }
  };

  const handleTogglePin = async (id: string) => {
    try {
      await api.togglePinNotice(id);
      fetchNotices();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Failed to toggle pin: ${e.message}`);
    }
  };

  const canManageNotice = (notice: NoticeItem) => {
    if (isAdmin) return true;
    if (currentUser?.role === 'manager' && notice.author.id === currentUser?.id) return true;
    return false;
  };

  // Split pinned and regular notices
  const pinnedNotices = useMemo(() => notices.filter((n) => n.is_pinned), [notices]);
  const standardNotices = useMemo(() => notices.filter((n) => !n.is_pinned), [notices]);

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'announcement':
        return {
          label: 'Announcement',
          icon: Megaphone,
          color: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60',
        };
      case 'policy':
        return {
          label: 'Policy Update',
          icon: FileText,
          color: 'bg-blue-950/60 text-blue-400 border-blue-800/60',
        };
      case 'event':
        return {
          label: 'Company Event',
          icon: PartyPopper,
          color: 'bg-violet-950/60 text-violet-400 border-violet-800/60',
        };
      case 'holiday':
        return {
          label: 'Holiday Notice',
          icon: Calendar,
          color: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
        };
      default:
        return {
          label: 'General Notice',
          icon: Info,
          color: 'bg-slate-800 text-slate-300 border-slate-700',
        };
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'urgent':
        return {
          label: 'Urgent',
          color: 'bg-red-950/70 text-red-300 border-red-800/60 animate-pulse',
        };
      case 'high':
        return {
          label: 'High Priority',
          color: 'bg-amber-950/70 text-amber-300 border-amber-800/60',
        };
      case 'low':
        return {
          label: 'Low Priority',
          color: 'bg-slate-900 text-slate-400 border-slate-800',
        };
      default:
        return {
          label: 'Standard',
          color: 'bg-slate-800/70 text-slate-300 border-slate-700',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <Megaphone className="w-5 h-5" />
            </div>
            <span>Company Notice Board</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise announcements, administrative directives, policy circulars, and team news.
          </p>
        </div>

        {isPublisher && (
          <button
            onClick={openCreateModal}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-600/25 flex items-center gap-2 cursor-pointer transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Publish Notice</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
          {[
            { id: 'all', label: 'All Notices' },
            { id: 'announcement', label: 'Announcements' },
            { id: 'policy', label: 'Policies' },
            { id: 'event', label: 'Events' },
            { id: 'holiday', label: 'Holidays' },
            { id: 'general', label: 'General' },
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                categoryFilter === c.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Search & Priority Selector */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 lg:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search circulars & notices..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </form>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High Priority</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Section 1: Pinned Announcements (If any) */}
      {pinnedNotices.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Pin className="w-3.5 h-3.5" />
            <span>Pinned Corporate Directives ({pinnedNotices.length})</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pinnedNotices.map((n) => {
              const catBadge = getCategoryBadge(n.category);
              const priBadge = getPriorityBadge(n.priority);
              const dateStr = new Date(n.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              const authorName = n.author.employee
                ? `${n.author.employee.first_name} ${n.author.employee.last_name}`
                : n.author.email.split('@')[0];

              return (
                <div
                  key={n.id}
                  className="bg-gradient-to-br from-slate-900/90 to-slate-950 border border-amber-500/30 rounded-2xl p-5 shadow-lg relative flex flex-col justify-between hover:border-amber-500/60 transition-all"
                >
                  <div>
                    {/* Top Chips */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                          <Pin className="w-2.5 h-2.5" />
                          <span>Pinned</span>
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catBadge.color}`}
                        >
                          <catBadge.icon className="w-2.5 h-2.5" />
                          <span>{catBadge.label}</span>
                        </span>

                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${priBadge.color}`}
                        >
                          {priBadge.label}
                        </span>
                      </div>

                      {canManageNotice(n) && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleTogglePin(n.id)}
                            className="p-1 text-amber-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                            title="Unpin Notice"
                          >
                            <Pin className="w-3.5 h-3.5 rotate-45" />
                          </button>
                          <button
                            onClick={() => openEditModal(n)}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                            title="Edit Notice"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteNotice(n.id)}
                            className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 cursor-pointer"
                            title="Delete Notice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-white mb-2 leading-snug">{n.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {n.content}
                    </p>
                  </div>

                  {/* Author & Timestamp */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-white text-[10px] font-bold">
                        {authorName[0]?.toUpperCase()}
                      </div>
                      <div>
                        <span className="text-white font-medium">{authorName}</span>
                        <span className="text-slate-500 text-[10px] ml-1">
                          ({n.author.role === 'company_admin' ? 'Company Admin' : 'Manager'})
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-slate-500 text-[10px]">{dateStr}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 2: General Notice Feed */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          <span>Workforce Bulletins & Circulars</span>
        </h2>

        {loading ? (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-500 text-xs">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading company bulletins...
          </div>
        ) : notices.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-500 text-xs">
            No notices published yet. {isPublisher && 'Click "Publish Notice" above to issue your first company bulletin.'}
          </div>
        ) : standardNotices.length === 0 && pinnedNotices.length > 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 text-center text-slate-500 text-xs">
            All active notices are currently pinned above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {standardNotices.map((n) => {
              const catBadge = getCategoryBadge(n.category);
              const priBadge = getPriorityBadge(n.priority);
              const dateStr = new Date(n.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              const authorName = n.author.employee
                ? `${n.author.employee.first_name} ${n.author.employee.last_name}`
                : n.author.email.split('@')[0];

              return (
                <div
                  key={n.id}
                  className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-sm"
                >
                  <div>
                    {/* Header Chips */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catBadge.color}`}
                        >
                          <catBadge.icon className="w-2.5 h-2.5" />
                          <span>{catBadge.label}</span>
                        </span>

                        {n.priority !== 'normal' && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${priBadge.color}`}
                          >
                            {priBadge.label}
                          </span>
                        )}
                      </div>

                      {canManageNotice(n) && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleTogglePin(n.id)}
                            className="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 cursor-pointer"
                            title="Pin to top"
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(n)}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteNotice(n.id)}
                            className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-white mb-2 leading-snug">{n.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-6">
                      {n.content}
                    </p>
                  </div>

                  {/* Author & Timestamp Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-white text-[9px] font-bold">
                        {authorName[0]?.toUpperCase()}
                      </div>
                      <div>
                        <span className="text-white font-medium">{authorName}</span>
                        <span className="text-slate-500 text-[10px] ml-1">
                          ({n.author.role === 'company_admin' ? 'Admin' : 'Manager'})
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-slate-500 text-[10px]">{dateStr}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Publish or Edit Notice */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingNotice ? 'Edit Company Bulletin' : 'Publish New Notice'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Broadcasted to all workforce members (admins, managers, employees).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-xl hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs shrink-0 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Notice Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Annual Company Offsite & Schedule Details"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Notice Classification</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="announcement">Announcement</option>
                    <option value="policy">Policy Update</option>
                    <option value="event">Corporate Event</option>
                    <option value="holiday">Holiday Notice</option>
                    <option value="general">General Bulletin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent (Immediate Attention)</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Notice Content / Body *</label>
                <textarea
                  required
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write the full announcement text, instructions, dates, or circular guidelines here..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed font-sans"
                />
              </div>

              <div className="flex items-center gap-2.5 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <input
                  type="checkbox"
                  id="pinNotice"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded border-slate-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="pinNotice" className="text-slate-300 cursor-pointer flex items-center gap-1.5 font-medium">
                  <Pin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pin this bulletin to the top of the Notice Board</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-5 py-2 rounded-xl shadow-lg shadow-emerald-600/25 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {modalLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{editingNotice ? 'Update Notice' : 'Broadcast Notice'}</span>
                    </>
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
