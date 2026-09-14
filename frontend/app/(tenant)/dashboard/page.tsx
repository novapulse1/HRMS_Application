'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  Users,
  Clock,
  CalendarDays,
  CreditCard,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Sparkles,
  UserCheck,
  UserX,
  UserMinus,
  Search,
  ChevronRight,
  Megaphone,
  Pin,
} from 'lucide-react';

interface RosterEmployee {
  id: string;
  employee_code: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  status?: string;
  worked_hours?: number;
  leave_type?: string;
}

interface TodayRosterData {
  date: string;
  totalEmployees: number;
  presentCount: number;
  absentCount: number;
  onLeaveCount: number;
  attendanceRate: number;
  present: RosterEmployee[];
  absent: RosterEmployee[];
  onLeave: RosterEmployee[];
}

export default function TenantDashboardOverview() {
  const [user, setUser] = useState<any>(null);
  const [roster, setRoster] = useState<TodayRosterData | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'present' | 'absent' | 'onLeave'>('present');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentNotices, setRecentNotices] = useState<any[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    setCurrentTime(new Date().toLocaleTimeString());

    const loadDashboard = async () => {
      try {
        const [userData, rosterData, noticesData] = await Promise.all([
          api.tenantGetMe(),
          api.getTodayRoster().catch(() => null),
          api.getNotices({ limit: 3 }).catch(() => null),
        ]);
        setUser(userData);
        if (rosterData) {
          setRoster(rosterData);
        }
        if (noticesData?.data) {
          setRecentNotices(noticesData.data);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
    return () => clearInterval(timer);
  }, []);

  const displayName = user?.employee
    ? `${user.employee.first_name} ${user.employee.last_name}`
    : user?.email.split('@')[0] || 'Member';

  const role = user?.role || 'employee';

  // Filter employees for the active tab based on search query
  const getFilteredList = () => {
    if (!roster) return [];
    let list: RosterEmployee[] = [];
    if (activeTab === 'present') list = roster.present;
    else if (activeTab === 'absent') list = roster.absent;
    else if (activeTab === 'onLeave') list = roster.onLeave;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q)
    );
  };

  const filteredEmployees = getFilteredList();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-teal-950/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="capitalize">{user?.company?.name || 'Acme Corporation'}</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome back, {displayName}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {user?.employee?.designation?.name
              ? `${user.employee.designation.name} • ${user?.employee?.department?.name || 'Operations'}`
              : `Role: ${role.replace('_', ' ').toUpperCase()}`}
          </p>
        </div>

        {/* Live Clock Card */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 sm:px-5 sm:py-3 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Current Time</div>
            <div className="text-sm font-mono font-bold text-white">{currentTime || '--:--:--'}</div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Workforce */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Workforce</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {loading ? '...' : `${roster?.totalEmployees ?? 0} Staff`}
          </div>
          <span className="text-[11px] text-slate-500">
            {roster ? `${roster.presentCount} clocked in today` : 'Managed in company schema'}
          </span>
        </div>

        {/* Today's Attendance Dynamic Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Today's Attendance</span>
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-teal-400 mt-2 flex items-baseline gap-2">
            {loading ? (
              '...'
            ) : (
              <>
                <span>{roster ? `${roster.presentCount} / ${roster.totalEmployees}` : '0'}</span>
                <span className="text-xs font-normal text-slate-400">Present</span>
              </>
            )}
          </div>
          {/* Real-time status breakdown chips */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
            <button
              onClick={() => setActiveTab('present')}
              className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === 'present'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 hover:bg-emerald-900/50'
              }`}
            >
              🟢 {roster?.presentCount ?? 0} Present
            </button>
            <button
              onClick={() => setActiveTab('absent')}
              className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === 'absent'
                  ? 'bg-red-500 text-white font-bold'
                  : 'bg-red-950/60 text-red-400 border border-red-800/50 hover:bg-red-900/50'
              }`}
            >
              🔴 {roster?.absentCount ?? 0} Absent
            </button>
            <button
              onClick={() => setActiveTab('onLeave')}
              className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === 'onLeave'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-amber-950/60 text-amber-400 border border-amber-800/50 hover:bg-amber-900/50'
              }`}
            >
              🟡 {roster?.onLeaveCount ?? 0} On Leave
            </button>
          </div>
        </div>

        {/* Leave Balance */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Leave Balance</span>
            <CalendarDays className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">12 Days</div>
          <span className="text-[11px] text-slate-500">Annual standard quota</span>
        </div>

        {/* Payroll Cycle */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Payroll Cycle</span>
            <CreditCard className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">Day 28</div>
          <span className="text-[11px] text-slate-500">Standard monthly cut-off</span>
        </div>
      </div>

      {/* Company Notice Board Widget */}
      {recentNotices.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Megaphone className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Company Notice Board & Announcements
              </h2>
            </div>
            <Link
              href="/notices"
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-all"
            >
              <span>View All Notices</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recentNotices.map((n) => {
              const dateStr = new Date(n.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <Link
                  key={n.id}
                  href="/notices"
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between hover:border-slate-700 ${
                    n.is_pinned
                      ? 'bg-gradient-to-br from-amber-950/20 to-slate-950 border-amber-500/40 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {n.category}
                      </span>
                      {n.is_pinned && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                          <Pin className="w-2.5 h-2.5" />
                          <span>Pinned</span>
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-white text-xs mb-1 line-clamp-1">{n.title}</h3>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {n.content}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-800/70 flex items-center justify-between text-[10px] text-slate-500">
                    <span>
                      {n.author?.employee
                        ? `${n.author.employee.first_name} ${n.author.employee.last_name}`
                        : n.author?.email?.split('@')[0]}
                    </span>
                    <span className="font-mono">{dateStr}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* TODAY'S ATTENDANCE LIVE ROSTER (Present, Absent, Leave Breakdown) */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Today's Attendance Roster</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live Status
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time daily presence, absent staff, and approved leaves for today (
              <span suppressHydrationWarning>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              )
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff or dept..."
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48 sm:w-56"
              />
            </div>

            <Link
              href="/attendance"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg hover:bg-slate-800 transition-all"
            >
              <span>Full Sheet</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800/60 pb-2">
          <button
            onClick={() => setActiveTab('present')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'present'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Present</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'present' ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-emerald-400'
              }`}
            >
              {roster?.presentCount ?? 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('absent')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'absent'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Absent / Pending</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'absent' ? 'bg-red-700 text-white' : 'bg-slate-800 text-red-400'
              }`}
            >
              {roster?.absentCount ?? 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('onLeave')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'onLeave'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <UserMinus className="w-3.5 h-3.5" />
            <span>On Leave</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'onLeave' ? 'bg-amber-700 text-white' : 'bg-slate-800 text-amber-400'
              }`}
            >
              {roster?.onLeaveCount ?? 0}
            </span>
          </button>
        </div>

        {/* Tab Content Cards */}
        {loading ? (
          <div className="py-12 text-center text-slate-500">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading attendance records...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-10 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
            {activeTab === 'present' && (
              <>
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No employees checked in yet today.</p>
              </>
            )}
            {activeTab === 'absent' && (
              <>
                <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
                <p className="text-xs text-emerald-400">All employees are present or on leave today!</p>
              </>
            )}
            {activeTab === 'onLeave' && (
              <>
                <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No employees on approved leave today.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEmployees.map((emp) => {
              const initials = emp.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <div
                  key={emp.id}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-slate-700/80 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        activeTab === 'present'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : activeTab === 'absent'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {initials || 'EM'}
                    </div>

                    {/* Info */}
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-xs truncate flex items-center gap-1.5">
                        <span>{emp.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono font-normal">
                          {emp.employee_code}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {emp.designation} • {emp.department}
                      </div>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="text-right shrink-0">
                    {activeTab === 'present' && (
                      <div>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Present</span>
                        </span>
                        {emp.check_in_time && (
                          <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center justify-end gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>
                              {new Date(emp.check_in_time).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'absent' && (
                      <div>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          <span>Not Checked In</span>
                        </span>
                        <div className="text-[10px] text-slate-500 mt-1">Pending punch</div>
                      </div>
                    )}

                    {activeTab === 'onLeave' && (
                      <div>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <span>On Leave</span>
                        </span>
                        <div className="text-[10px] text-amber-400/80 font-medium mt-1 truncate max-w-[100px]">
                          {emp.leave_type || 'Approved'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link
          href="/attendance"
          className="bg-slate-900/40 hover:bg-slate-800/50 border border-slate-800/80 hover:border-emerald-500/40 rounded-xl p-5 transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1 flex items-center justify-between">
              <span>Attendance Punch</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
            </h3>
            <p className="text-xs text-slate-400">
              Clock in, clock out, and review your daily presence records and hours.
            </p>
          </div>
          <div className="mt-4 text-[11px] text-emerald-400 font-medium">Open Attendance →</div>
        </Link>

        <Link
          href="/leave"
          className="bg-slate-900/40 hover:bg-slate-800/50 border border-slate-800/80 hover:border-teal-500/40 rounded-xl p-5 transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-3">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1 flex items-center justify-between">
              <span>Apply for Leave</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all" />
            </h3>
            <p className="text-xs text-slate-400">
              Submit planned time-off requests and track manager approval status.
            </p>
          </div>
          <div className="mt-4 text-[11px] text-teal-400 font-medium">Manage Leaves →</div>
        </Link>

        <Link
          href={role === 'employee' ? '/payroll' : '/employees'}
          className="bg-slate-900/40 hover:bg-slate-800/50 border border-slate-800/80 hover:border-indigo-500/40 rounded-xl p-5 transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
              {role === 'employee' ? <CreditCard className="w-5 h-5" /> : <Users className="w-5 h-5" />}
            </div>
            <h3 className="text-sm font-bold text-white mb-1 flex items-center justify-between">
              <span>{role === 'employee' ? 'My Payslips' : 'Employee Directory'}</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
            </h3>
            <p className="text-xs text-slate-400">
              {role === 'employee'
                ? 'Download itemized payslips and monthly salary breakdown.'
                : 'Browse team roster, assign departments, and invite staff members.'}
            </p>
          </div>
          <div className="mt-4 text-[11px] text-indigo-400 font-medium">
            {role === 'employee' ? 'View Payslips →' : 'View Directory →'}
          </div>
        </Link>
      </div>
    </div>
  );
}
