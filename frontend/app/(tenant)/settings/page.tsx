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

  const [workingDays, setWorkingDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [hoursStart, setHoursStart] = useState('09:00');
  const [hoursEnd, setHoursEnd] = useState('18:00');
  const [payrollDay, setPayrollDay] = useState(28);
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.5);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.getCompanySettings();
        if (data) {
          setWorkingDays((data.working_days_json as string[]) || ['mon', 'tue', 'wed', 'thu', 'fri']);
          setHoursStart(data.working_hours_start || '09:00');
          setHoursEnd(data.working_hours_end || '18:00');
          setPayrollDay(data.payroll_cycle_day || 28);
          setOvertimeEnabled(data.overtime_enabled || false);
          setOvertimeMultiplier(data.overtime_rate_multiplier || 1.5);
        }
      } catch (err) {
        console.error('Failed to load company settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

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

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-400" />
          <span>Company Policies & Operations</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure default working schedule, shift spans, overtime compensations, and payroll cycle rules.
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
  );
}
