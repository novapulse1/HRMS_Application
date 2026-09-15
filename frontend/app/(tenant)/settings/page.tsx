'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Settings,
  Clock,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Save,
  Building2,
  Sparkles,
  User,
  Camera,
  Trash2,
  Upload,
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Current User Profile State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string>('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [workingDays, setWorkingDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [hoursStart, setHoursStart] = useState('09:00');
  const [hoursEnd, setHoursEnd] = useState('18:00');
  const [payrollDay, setPayrollDay] = useState(28);
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.5);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [me, data] = await Promise.all([
          api.tenantGetMe().catch(() => null),
          api.getCompanySettings().catch(() => null),
        ]);

        if (me) {
          setCurrentUser(me);
          setUserAvatar(me.avatar_url || me.employee?.avatar_url || null);
          setUserPhone(me.employee?.phone || '');
        }

        if (data) {
          setWorkingDays((data.working_days_json as string[]) || ['mon', 'tue', 'wed', 'thu', 'fri']);
          setHoursStart(data.working_hours_start || '09:00');
          setHoursEnd(data.working_hours_end || '18:00');
          setPayrollDay(data.payroll_cycle_day || 28);
          setOvertimeEnabled(data.overtime_enabled || false);
          setOvertimeMultiplier(data.overtime_rate_multiplier || 1.5);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleAvatarFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          setUserAvatar(base64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess(null);
    setProfileError(null);
    try {
      await api.updateMyProfile({
        avatar_url: userAvatar || '',
        phone: userPhone || undefined,
      });
      setProfileSuccess('Profile and photo saved successfully!');
      setTimeout(() => setProfileSuccess(null), 3500);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDayToggle = (day: string) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter((d) => d !== day));
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await api.updateCompanySettings({
        working_days_json: workingDays,
        working_hours_start: hoursStart,
        working_hours_end: hoursEnd,
        payroll_cycle_day: Number(payrollDay),
        overtime_enabled: overtimeEnabled,
        overtime_rate_multiplier: Number(overtimeMultiplier),
      });

      setSuccessMessage('Company policies and working schedule saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMessage(e.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const displayName = currentUser?.employee
    ? `${currentUser.employee.first_name} ${currentUser.employee.last_name}`
    : currentUser?.email?.split('@')[0] || 'Member';

  const userInitials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isCompanyAdmin = currentUser?.role === 'company_admin';

  return (
    <div className="space-y-8 max-w-4xl animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-emerald-400" />
          <span>Account & System Settings</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage your personal profile identity, photo avatar, and enterprise operational policies.
        </p>
      </div>

      {/* SECTION 1: Personal Profile & Avatar (Available to all users) */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-400" />
              <span>My Profile & Avatar Photo</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload a personal photo for your HRMS profile, team directory, and navigation bar.
            </p>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {currentUser?.role?.replace('_', ' ').toUpperCase() || 'USER'}
          </span>
        </div>

        {profileSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{profileSuccess}</span>
          </div>
        )}

        {profileError && (
          <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Avatar Upload Area */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div className="relative shrink-0">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={displayName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-xl shadow-emerald-950/50"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-extrabold text-2xl flex items-center justify-center border border-emerald-500/30 shadow-xl shadow-emerald-950/50">
                  {userInitials}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-xs font-semibold text-white">Profile Photo</div>
                <p className="text-[11px] text-slate-400">
                  Supports JPG, PNG, WEBP. Automatically optimized and persisted.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer transition">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Choose Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleAvatarFile(f);
                    }}
                  />
                </label>

                {userAvatar && (
                  <button
                    type="button"
                    onClick={() => setUserAvatar(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 text-xs font-medium rounded-xl border border-slate-700 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Readonly & Editable Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Full Name</label>
              <input
                type="text"
                disabled
                value={displayName}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-medium cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Email Address</label>
              <input
                type="email"
                disabled
                value={currentUser?.email || ''}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-medium cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Phone Number</label>
              <input
                type="text"
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {currentUser?.employee?.employee_code && (
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Employee Code</label>
                <input
                  type="text"
                  disabled
                  value={currentUser.employee.employee_code}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold cursor-not-allowed"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-800/80">
            <button
              type="submit"
              disabled={profileSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 px-5 rounded-xl shadow-lg shadow-emerald-600/25 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {profileSaving ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: Company Policies & Operations (Admin Only) */}
      {isCompanyAdmin && (
        <div className="space-y-6">
          <div className="pt-4">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              <span>Company Policies & Operations</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure default working schedules, shift spans, overtime compensation, and payroll cycle rules.
            </p>
          </div>

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
        {/* Working Days & Schedule */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>Weekly Working Days Policy</span>
          </h2>
          <p className="text-xs text-slate-400">
            Unselected days are automatically considered official weekly offs during attendance status evaluation.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {DAYS_OF_WEEK.map((d) => {
              const active = workingDays.includes(d.key);

              return (
                <button
                  type="button"
                  key={d.key}
                  onClick={() => handleDayToggle(d.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    active
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800/80 text-xs">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Standard Check-In Time</label>
              <input
                type="time"
                value={hoursStart}
                onChange={(e) => setHoursStart(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Standard Check-Out Time</label>
              <input
                type="time"
                value={hoursEnd}
                onChange={(e) => setHoursEnd(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Overtime Policy */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Overtime Compensation Policy</span>
          </h2>
          <p className="text-xs text-slate-400">
            When enabled, attendance hours logged beyond the standard shift duration are automatically monetized during monthly payroll runs.
          </p>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="enableOT"
              checked={overtimeEnabled}
              onChange={(e) => setOvertimeEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-800 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="enableOT" className="text-xs font-semibold text-white cursor-pointer">
              Enable Overtime Rate Calculations
            </label>
          </div>

          {overtimeEnabled && (
            <div className="pt-2 text-xs max-w-xs animate-in fade-in">
              <label className="block text-slate-300 mb-1 font-medium">
                Overtime Hourly Multiplier
              </label>
              <select
                value={overtimeMultiplier}
                onChange={(e) => setOvertimeMultiplier(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="1.0">1.0x (Standard 100%)</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x (Industry Standard)</option>
                <option value="2.0">2.0x (Double Time)</option>
              </select>
            </div>
          )}
        </div>

        {/* Payroll Cycle Day */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-violet-400" />
            <span>Payroll Execution Settings</span>
          </h2>
          <p className="text-xs text-slate-400">
            Define the day of the month when salary calculation cut-off closes and payroll is finalized.
          </p>

          <div className="max-w-xs text-xs">
            <label className="block text-slate-300 mb-1 font-medium">
              Payroll Cycle Cut-off Day of Month
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={payrollDay}
              onChange={(e) => setPayrollDay(parseInt(e.target.value) || 28)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Default is day 28 of every calendar month.
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 px-6 rounded-xl shadow-lg shadow-indigo-600/25 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Company Configuration</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )}
</div>
  );
}
