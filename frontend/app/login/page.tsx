'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Building2, Lock, Mail, ArrowRight, KeyRound, AlertCircle, CheckCircle2, Shield } from 'lucide-react';

export default function TenantLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forced password change modal
  const [mustChangeModal, setMustChangeModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeSuccess, setChangeSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await api.tenantLogin({ email, password });
      if (data?.mustChangePassword) {
        setCurrentPassword(password);
        setMustChangeModal(true);
      } else {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === 'PASSWORD_CHANGE_REQUIRED') {
        setCurrentPassword(password);
        setMustChangeModal(true);
      } else {
        setError(e.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setChangeLoading(true);
    setError(null);

    try {
      await api.tenantChangePassword({ currentPassword, newPassword });
      setChangeSuccess(true);
      setTimeout(() => {
        setMustChangeModal(false);
        router.push('/dashboard');
      }, 1500);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to update password');
    } finally {
      setChangeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-900/90 border border-slate-700/80 p-2 shadow-2xl shadow-purple-500/20 mb-4 ring-1 ring-white/10">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-purple-600/20 to-teal-500/20 blur-xl pointer-events-none" />
            <img
              src="/nova-icon.png"
              alt="Nova Pulse Logo"
              className="w-14 h-14 object-contain relative z-10 drop-shadow-md"
            />
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-3xl font-black tracking-tight text-white">NOVA</h1>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-purple-400 via-indigo-400 to-teal-400 bg-clip-text text-transparent">PULSE</h1>
            <span className="text-xs font-bold text-slate-400 self-end mb-1 ml-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">HRMS</span>
          </div>
          <p className="text-xs uppercase tracking-widest text-teal-400 font-semibold mt-1.5">
            Client Workspace Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl shadow-black/40">
          <h2 className="text-lg font-semibold text-white mb-2">Member Sign In</h2>
          <p className="text-xs text-slate-400 mb-6">
            Log in to manage attendance, submit leave requests, view payslips, and access your team dashboard.
          </p>

          {error && !mustChangeModal && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <Link
                href="/admin/login"
                className="hover:text-slate-300 transition-colors flex items-center gap-1"
              >
                <Shield className="w-3 h-3 text-indigo-400" />
                <span>Super Admin Access</span>
              </Link>
              <span className="text-slate-600">Enterprise Edition</span>
            </div>
          </div>
      </div>

      {/* Forced Password Change Modal */}
      {mustChangeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">First Login: Password Setup</h3>
                <p className="text-xs text-slate-400">Security requirement for all workspace accounts</p>
              </div>
            </div>

            {changeSuccess ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 animate-bounce" />
                <h4 className="text-sm font-semibold text-white">Password Updated!</h4>
                <p className="text-xs text-slate-400 mt-1">Entering your workspace dashboard...</p>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  You are logging in with a generated temporary password. Please configure a private, secure password to activate your account.
                </p>

                {error && (
                  <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={changeLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer text-xs"
                >
                  {changeLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Set Password & Open Dashboard</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
