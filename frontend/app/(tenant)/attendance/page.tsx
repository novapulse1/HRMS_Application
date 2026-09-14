'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Clock,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  Globe,
  Smartphone,
  Fingerprint,
  Radio,
  Plus,
  RefreshCw,
  Power,
  Trash2,
  ShieldCheck,
  UserCheck,
  UserX,
  UserMinus,
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  worked_hours: number;
  marked_by: string;
  source?: 'web' | 'mobile' | 'biometric';
  device_id?: string | null;
  employee?: {
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    department?: { name: string };
    designation?: { name: string };
  };
}

interface DeviceRecord {
  id: string;
  name: string;
  device_code: string;
  ip_address: string | null;
  location: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  _count?: { attendances: number };
}

export default function AttendancePage() {
  const [currentTime, setCurrentTime] = useState('');
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [sourceDist, setSourceDist] = useState<{
    web: number;
    mobile: number;
    biometric: number;
    total: number;
  } | null>(null);
  const [calendarRecords, setCalendarRecords] = useState<AttendanceRecord[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [todayRoster, setTodayRoster] = useState<any>(null);
  const [todayRosterTab, setTodayRosterTab] = useState<'present' | 'absent' | 'onLeave'>('present');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [punchLoading, setPunchLoading] = useState(false);

  // Month & Year state
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getUTCMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getUTCFullYear());
  const [viewMode, setViewMode] = useState<'my' | 'team' | 'devices'>('my');

  // Punch options
  const [punchSource, setPunchSource] = useState<'web' | 'mobile' | 'biometric'>('web');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Device registration modal
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [newDevName, setNewDevName] = useState('');
  const [newDevCode, setNewDevCode] = useState('');
  const [newDevIp, setNewDevIp] = useState('');
  const [newDevLocation, setNewDevLocation] = useState('');
  const [deviceSubmitting, setDeviceSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    setCurrentTime(new Date().toLocaleTimeString());
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [me, todayData, sumData, calData] = await Promise.all([
        api.tenantGetMe(),
        api.getTodayAttendance(),
        api.getMonthlyAttendanceSummary(selectedMonth, selectedYear),
        api.getAttendanceCalendar({
          month: selectedMonth,
          year: selectedYear,
        }),
      ]);

      setUser(me);
      setTodayRecord(todayData);
      setSummary(sumData);
      setCalendarRecords(calData);

      // Load source distribution & devices if manager or admin
      if (me && (me.role === 'company_admin' || me.role === 'manager')) {
        const [distData, devList, rosterData] = await Promise.all([
          api.getAttendanceSourceDistribution(selectedMonth, selectedYear).catch(() => null),
          api.getAttendanceDevices().catch(() => []),
          api.getTodayRoster().catch(() => null),
        ]);

        if (distData) {
          setSourceDist({
            web: distData.distribution?.web || 0,
            mobile: distData.distribution?.mobile || 0,
            biometric: distData.distribution?.biometric || 0,
            total: distData.total || 0,
          });
        }

        if (rosterData) {
          setTodayRoster(rosterData);
        }

        setDevices(devList);
        if (devList.length > 0 && !selectedDeviceId) {
          const activeDev = devList.find((d: DeviceRecord) => d.is_active);
          if (activeDev) setSelectedDeviceId(activeDev.id);
        }
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const handlePunch = async () => {
    setPunchLoading(true);
    try {
      const isCheckedIn = !!todayRecord?.check_in_time;
      const isCheckedOut = !!todayRecord?.check_out_time;

      const action = !isCheckedIn ? 'check_in' : 'check_out';
      const devId = punchSource === 'biometric' && selectedDeviceId ? selectedDeviceId : undefined;
      const res = await api.punchAttendance(action, punchSource, devId);
      if (res?.attendance) {
        setTodayRecord(res.attendance);
        fetchData();
      }
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Punch failed: ${e.message}`);
    } finally {
      setPunchLoading(false);
    }
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevName || !newDevCode) return;
    setDeviceSubmitting(true);
    try {
      await api.registerAttendanceDevice({
        name: newDevName,
        device_code: newDevCode,
        ip_address: newDevIp || undefined,
        location: newDevLocation || undefined,
      });
      setShowDeviceModal(false);
      setNewDevName('');
      setNewDevCode('');
      setNewDevIp('');
      setNewDevLocation('');
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Device registration failed: ${e.message}`);
    } finally {
      setDeviceSubmitting(false);
    }
  };

  const handleToggleDevice = async (id: string) => {
    try {
      await api.toggleAttendanceDevice(id);
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Toggle failed: ${e.message}`);
    }
  };

  const handleSyncDevice = async (id: string) => {
    try {
      await api.syncAttendanceDevice(id);
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Sync failed: ${e.message}`);
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!confirm('Are you sure you want to remove this biometric terminal?')) return;
    try {
      await api.deleteAttendanceDevice(id);
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Delete failed: ${e.message}`);
    }
  };

  const isCheckedIn = !!todayRecord?.check_in_time;
  const isCheckedOut = !!todayRecord?.check_out_time;
  const isManagerOrAdmin = user?.role === 'company_admin' || user?.role === 'manager';
  const isAdmin = user?.role === 'company_admin';

  const statusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Present</span>
          </span>
        );
      case 'half_day':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/50 text-amber-400 border border-amber-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Half Day</span>
          </span>
        );
      case 'on_leave':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-950/50 text-blue-400 border border-blue-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>On Leave</span>
          </span>
        );
      case 'holiday':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-950/50 text-violet-400 border border-violet-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            <span>Holiday</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-950/50 text-red-400 border border-red-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span>Absent</span>
          </span>
        );
    }
  };

  const sourceBadge = (source?: string) => {
    switch (source) {
      case 'mobile':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-950/60 text-indigo-400 border border-indigo-800/60">
            <Smartphone className="w-3 h-3 text-indigo-400" />
            <span>Mobile</span>
          </span>
        );
      case 'biometric':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/60">
            <Fingerprint className="w-3 h-3 text-amber-400" />
            <span>Biometric</span>
          </span>
        );
      case 'web':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-950/60 text-teal-400 border border-teal-800/60">
            <Globe className="w-3 h-3 text-teal-400" />
            <span>Web</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Punch Terminal */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Punch In / Out Terminal */}
        <div className="lg:col-span-2 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-teal-950/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <Radio className="w-3 h-3 animate-pulse" />
                Live Attendance Terminal
              </span>
              <span className="text-xs text-slate-400">
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Real-Time Workstation Presence
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Mark your arrival and departure timestamps across multi-channel ingress (Web, Mobile, Biometrics).
            </p>

            {/* Ingress Channel Selector */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium mr-1">Ingress Source:</span>
              <button
                type="button"
                onClick={() => setPunchSource('web')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  punchSource === 'web'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Web Browser</span>
              </button>

              <button
                type="button"
                onClick={() => setPunchSource('mobile')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  punchSource === 'mobile'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile App</span>
              </button>

              <button
                type="button"
                onClick={() => setPunchSource('biometric')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  punchSource === 'biometric'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                <Fingerprint className="w-3.5 h-3.5" />
                <span>Biometric Hardware</span>
              </button>

              {punchSource === 'biometric' && devices.length > 0 && (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id} disabled={!d.is_active}>
                      {d.name} ({d.device_code}) {!d.is_active ? '[Offline]' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-mono font-bold text-white tracking-wider">
                {currentTime || '--:--:--'}
              </div>

              <div className="h-8 w-px bg-slate-800" />

              <div className="text-xs">
                <span className="text-slate-500 block">Today's Presence</span>
                {todayRecord ? (
                  <span className="text-emerald-400 font-semibold capitalize flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {todayRecord.status.replace('_', ' ')}
                  </span>
                ) : (
                  <span className="text-amber-400 font-medium">Not Clocked In</span>
                )}
              </div>
            </div>

            <button
              onClick={handlePunch}
              disabled={punchLoading}
              className={`px-6 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 ${
                !isCheckedIn
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
                  : !isCheckedOut
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/25'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {punchLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : !isCheckedIn ? (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Clock In Now</span>
                </>
              ) : !isCheckedOut ? (
                <>
                  <Square className="w-4 h-4 fill-white" />
                  <span>Clock Out Now</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Update Punch Out</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Col: Today Punch Timestamps & Source */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Today's Punch Log
              </h3>
              {todayRecord?.source && sourceBadge(todayRecord.source)}
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Clock In</span>
                <span className="font-mono font-bold text-white">
                  {todayRecord?.check_in_time
                    ? new Date(todayRecord.check_in_time).toLocaleTimeString()
                    : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Clock Out</span>
                <span className="font-mono font-bold text-white">
                  {todayRecord?.check_out_time
                    ? new Date(todayRecord.check_out_time).toLocaleTimeString()
                    : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Logged Hours</span>
                <span className="font-mono font-bold text-emerald-400">
                  {todayRecord?.worked_hours ? `${todayRecord.worked_hours} hrs` : '0.00 hrs'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span>Server synchronized</span>
            <span className="text-emerald-500 font-mono">UTC Time</span>
          </div>
        </div>
      </div>

      {/* Monthly Summary & Source Distribution Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400">Present Days</span>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {summary?.presentDays ?? 0}
          </div>
          <span className="text-[11px] text-slate-500">Full shifts completed</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400">Half Days</span>
          <div className="text-2xl font-bold text-amber-400 mt-2">
            {summary?.halfDays ?? 0}
          </div>
          <span className="text-[11px] text-slate-500">&lt; 7.5 hours</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400">Leaves Taken</span>
          <div className="text-2xl font-bold text-blue-400 mt-2">
            {summary?.leaveDays ?? 0}
          </div>
          <span className="text-[11px] text-slate-500">Approved leave balance</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400">Total Worked Hours</span>
          <div className="text-2xl font-bold text-white mt-2">
            {summary?.totalWorkedHours ?? 0} hrs
          </div>
          <span className="text-[11px] text-slate-500">In selected month</span>
        </div>
      </div>

      {/* Source Distribution Card for Admin/Manager */}
      {isManagerOrAdmin && sourceDist && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                Punch Ingress Source Analytics
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Breakdown of punches recorded via Web, Mobile, and Biometric terminals for {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-slate-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
              Total Recorded Punches: <span className="text-emerald-400">{sourceDist.total}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-teal-900/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Web Terminal</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {sourceDist.web}
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold text-teal-400">
                {sourceDist.total > 0 ? Math.round((sourceDist.web / sourceDist.total) * 100) : 0}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-indigo-900/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Mobile Device</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {sourceDist.mobile}
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold text-indigo-400">
                {sourceDist.total > 0 ? Math.round((sourceDist.mobile / sourceDist.total) * 100) : 0}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-amber-900/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Biometric Access</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {sourceDist.biometric}
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold text-amber-400">
                {sourceDist.total > 0 ? Math.round((sourceDist.biometric / sourceDist.total) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Today's Live Attendance Breakdown (Present / Absent / On Leave) */}
      {isManagerOrAdmin && todayRoster && (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Today's Team Attendance Breakdown</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live Today
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Staff presence, absent members, and approved leaves for today ({todayRoster.date})
              </p>
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setTodayRosterTab('present')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  todayRosterTab === 'present'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                    : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Present ({todayRoster.presentCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setTodayRosterTab('absent')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  todayRosterTab === 'absent'
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
                    : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Absent ({todayRoster.absentCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setTodayRosterTab('onLeave')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  todayRosterTab === 'onLeave'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
                    : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>On Leave ({todayRoster.onLeaveCount})</span>
              </button>
            </div>
          </div>

          {/* Cards for active roster tab */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
            {(todayRoster[todayRosterTab] || []).length === 0 ? (
              <div className="col-span-full py-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                No employees in this category for today.
              </div>
            ) : (
              todayRoster[todayRosterTab].map((emp: any) => (
                <div
                  key={emp.id}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate flex items-center gap-1.5">
                      <span>{emp.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">({emp.employee_code})</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {emp.designation} • {emp.department}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {todayRosterTab === 'present' && (
                      <div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-medium">
                          Present
                        </span>
                        {emp.check_in_time && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {new Date(emp.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    )}
                    {todayRosterTab === 'absent' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/60 font-medium">
                        Not Clocked In
                      </span>
                    )}
                    {todayRosterTab === 'onLeave' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/60 font-medium">
                        {emp.leave_type || 'On Leave'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* View Switcher & Month Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isManagerOrAdmin && (
            <div className="flex items-center p-1 bg-slate-900 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewMode('my')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'my'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                My Calendar
              </button>
              <button
                onClick={() => setViewMode('team')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'team'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Team Roster View
              </button>
              {isAdmin && (
                <button
                  onClick={() => setViewMode('devices')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    viewMode === 'devices'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  Biometric Devices ({devices.length})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Month Selector */}
        {viewMode !== 'devices' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectedMonth === 1) {
                  setSelectedMonth(12);
                  setSelectedYear(selectedYear - 1);
                } else {
                  setSelectedMonth(selectedMonth - 1);
                }
              }}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-semibold text-white px-2">
              {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', {
                month: 'long',
                year: 'numeric',
              })}
            </span>

            <button
              onClick={() => {
                if (selectedMonth === 12) {
                  setSelectedMonth(1);
                  setSelectedYear(selectedYear + 1);
                } else {
                  setSelectedMonth(selectedMonth + 1);
                }
              }}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Mode 1 & 2: Attendance Records Table */}
      {viewMode !== 'devices' ? (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  {viewMode === 'team' && <th className="py-3.5 px-4">Employee</th>}
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Ingress Source</th>
                  <th className="py-3.5 px-4">Check In</th>
                  <th className="py-3.5 px-4">Check Out</th>
                  <th className="py-3.5 px-4">Worked Hours</th>
                  <th className="py-3.5 px-4">Marked By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading calendar...
                    </td>
                  </tr>
                ) : calendarRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No attendance records for this month.
                    </td>
                  </tr>
                ) : (
                  calendarRecords
                    .filter((rec) => {
                      if (viewMode === 'my') {
                        return rec.employee_id === user?.employee?.id;
                      }
                      return true;
                    })
                    .map((rec) => {
                      const dateFormatted = new Date(rec.date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      });

                      return (
                        <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-white">{dateFormatted}</td>

                          {viewMode === 'team' && (
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-white">
                                {rec.employee?.first_name} {rec.employee?.last_name}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {rec.employee?.employee_code} • {rec.employee?.department?.name}
                              </div>
                            </td>
                          )}

                          <td className="py-3.5 px-4">{statusBadge(rec.status)}</td>

                          <td className="py-3.5 px-4">{sourceBadge(rec.source)}</td>

                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            {rec.check_in_time
                              ? new Date(rec.check_in_time).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            {rec.check_out_time
                              ? new Date(rec.check_out_time).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>

                          <td className="py-3.5 px-4 font-mono font-semibold text-white">
                            {rec.worked_hours} hrs
                          </td>

                          <td className="py-3.5 px-4 capitalize">
                            <span className="text-[10px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/60">
                              {rec.marked_by}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Mode 3: Biometric Devices Management View */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Biometric Hardware Registry</h2>
              <p className="text-xs text-slate-400">
                Manage on-premise biometric access terminals, card scanners, and IoT attendance sync.
              </p>
            </div>
            <button
              onClick={() => setShowDeviceModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/25 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Register Terminal</span>
            </button>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">Terminal Name</th>
                    <th className="py-3.5 px-4">Device Code</th>
                    <th className="py-3.5 px-4">IP Address</th>
                    <th className="py-3.5 px-4">Location</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Last Sync</th>
                    <th className="py-3.5 px-4">Total Punches</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {devices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No biometric terminals registered yet. Click &quot;Register Terminal&quot; to link your first hardware scanner.
                      </td>
                    </tr>
                  ) : (
                    devices.map((dev) => (
                      <tr key={dev.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                          <Fingerprint className="w-4 h-4 text-amber-400" />
                          <span>{dev.name}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">{dev.device_code}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">{dev.ip_address || '—'}</td>
                        <td className="py-3.5 px-4 text-slate-400">{dev.location || 'HQ Office'}</td>
                        <td className="py-3.5 px-4">
                          {dev.is_active ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <span>Offline</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">
                          {dev.last_sync_at ? new Date(dev.last_sync_at).toLocaleString() : 'Never'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          {dev._count?.attendances ?? 0}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSyncDevice(dev.id)}
                              disabled={!dev.is_active}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer disabled:opacity-40"
                              title="Trigger Sync"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleDevice(dev.id)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                dev.is_active
                                  ? 'bg-amber-950/40 text-amber-400 border-amber-800 hover:bg-amber-900/60'
                                  : 'bg-emerald-950/40 text-emerald-400 border-emerald-800 hover:bg-emerald-900/60'
                              }`}
                              title={dev.is_active ? 'Deactivate' : 'Activate'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDevice(dev.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-700 transition-all cursor-pointer"
                              title="Delete Device"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Register Device Modal */}
      {showDeviceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Register Biometric Terminal</h3>
              </div>
              <button
                onClick={() => setShowDeviceModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterDevice} className="space-y-3.5">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Terminal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Lobby Turnstile Scanner"
                  value={newDevName}
                  onChange={(e) => setNewDevName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Unique Device Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BIO-LOBBY-01"
                  value={newDevCode}
                  onChange={(e) => setNewDevCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">IP Address</label>
                  <input
                    type="text"
                    placeholder="192.168.1.105"
                    value={newDevIp}
                    onChange={(e) => setNewDevIp(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Physical Location</label>
                  <input
                    type="text"
                    placeholder="Building A, Floor 1"
                    value={newDevLocation}
                    onChange={(e) => setNewDevLocation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDeviceModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deviceSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-xl shadow-lg shadow-emerald-600/25 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {deviceSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Register Terminal</span>
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
