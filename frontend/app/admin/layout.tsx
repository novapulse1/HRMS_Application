'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import { Shield, RefreshCw, LogOut, Building2, CheckCircle2 } from 'lucide-react';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sweeping, setSweeping] = useState(false);
  const [sweepMessage, setSweepMessage] = useState<string | null>(null);

  // If on login page, don't show admin header
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleLogout = () => {
    api.removeAdminToken();
    router.push('/admin/login');
  };

  const handleRunSweep = async () => {
    setSweeping(true);
    setSweepMessage(null);
    try {
      const res = await api.adminLicenseSweep();
      setSweepMessage(
        res?.sweptCount === 0
          ? 'License sweep complete: all licenses are up to date'
          : `Swept ${res?.sweptCount} expired licenses successfully`
      );
      setTimeout(() => setSweepMessage(null), 4000);
    } catch (err: unknown) {
      const e = err as Error;
      setSweepMessage(`Sweep failed: ${e.message}`);
      setTimeout(() => setSweepMessage(null), 4000);
    } finally {
      setSweeping(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-700/80 p-1 flex items-center justify-center shadow-md shadow-indigo-600/20 ring-1 ring-white/10">
            <img src="/nova-icon.png" alt="Nova Pulse Super Admin" className="w-8 h-8 object-contain drop-shadow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="font-extrabold tracking-tight text-white">NOVA</span>
                <span className="font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">PULSE</span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Super Admin
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Multi-Tenant Platform Control</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {sweepMessage && (
            <div className="text-xs bg-indigo-950/80 border border-indigo-800/80 text-indigo-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{sweepMessage}</span>
            </div>
          )}

          <button
            onClick={handleRunSweep}
            disabled={sweeping}
            className="text-xs font-medium bg-slate-800 hover:bg-slate-700/80 text-slate-300 px-3.5 py-2 rounded-xl border border-slate-700/60 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="Scan database and mark expired licenses"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${sweeping ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{sweeping ? 'Sweeping...' : 'Sweep Licenses'}</span>
          </button>

          <div className="h-6 w-px bg-slate-800" />

          <button
            onClick={handleLogout}
            className="text-xs font-medium text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-slate-800/60 transition-all cursor-pointer flex items-center gap-1.5"
            title="Log out of Super Admin"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  );
}
