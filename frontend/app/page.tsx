'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Building2, ArrowRight, Sparkles, CheckCircle2, Lock } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 px-8 py-5 flex items-center justify-between backdrop-blur-md bg-slate-900/40">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-11 h-11 rounded-2xl bg-slate-900/90 border border-slate-700/80 p-1 flex items-center justify-center shadow-lg shadow-purple-500/20 ring-1 ring-white/10 group-hover:border-purple-500/50 group-hover:shadow-purple-500/30 transition-all">
            <img src="/nova-icon.png" alt="Nova Pulse Emblem" className="w-8 h-8 object-contain drop-shadow" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xl font-extrabold tracking-tight text-white">NOVA</span>
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">PULSE</span>
            </div>
            <span className="text-[10px] text-teal-400 font-semibold block tracking-wider uppercase">
              Next-Gen Enterprise HRMS
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/admin/login"
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-all flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Super Admin</span>
          </Link>

          <Link
            href="/login"
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25 transition-all flex items-center gap-1.5"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Client Portal</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center relative overflow-hidden">
        {/* Glow circles */}
        <div className="absolute top-1/3 -left-48 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-48 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl z-10">
          <div className="flex justify-center mb-5">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/80 border border-slate-700/70 shadow-xl shadow-purple-500/10 backdrop-blur-md">
              <img src="/nova-icon.png" alt="Nova Pulse" className="w-6 h-6 object-contain" />
              <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">
                Nova Pulse Platform
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-6">
            <ShieldCheck className="w-4 h-4" />
            <span>Multi-Tenant Enterprise Architecture • Isolated Data Schemas</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent leading-tight mb-6">
            Intelligent HR, Attendance & High-Precision Payroll
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Nova Pulse provides isolated SaaS tenant spaces for companies to manage their employees,
            track attendance rosters, automate leave balance deductions, and calculate accurate multi-tiered payroll.
          </p>

          {/* Dual Portals Access Grid */}
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto text-left">
            {/* Super Admin Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl hover:border-indigo-500/50 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Super Admin Panel</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Platform owner console to onboard client companies, generate initial admin credentials, manage subscription licenses, and run automatic expiry sweeps.
                </p>
              </div>

              <Link
                href="/admin/login"
                className="inline-flex items-center justify-between w-full bg-slate-800 hover:bg-indigo-600 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-all group-hover:shadow-lg group-hover:shadow-indigo-600/25"
              >
                <span>Access Super Admin</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Client Tenant Portal Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl hover:border-emerald-500/50 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Client Tenant Portal</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Dedicated company portal for Company Admins, Team Managers, and Employees. Real-time attendance punch, leave requests, shift scheduling, and payslips.
                </p>
              </div>

              <Link
                href="/login"
                className="inline-flex items-center justify-between w-full bg-slate-800 hover:bg-emerald-600 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-all group-hover:shadow-lg group-hover:shadow-emerald-600/25"
              >
                <span>Enter Client Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-8 text-center text-xs text-slate-500">
        <p>© 2026 Nova Pulse HRMS. Engineered with strict multi-tenant isolation & zero-trust role guards.</p>
      </footer>
    </div>
  );
}
