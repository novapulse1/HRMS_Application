'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  Calendar,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  ChevronRight,
  Shield,
  Sparkles,
  Menu,
  X,
  UserCheck,
  LifeBuoy,
  Megaphone,
} from 'lucide-react';

interface CurrentUser {
  id: string;
  email: string;
  role: 'company_admin' | 'manager' | 'employee';
  company_id: string;
  avatar_url?: string | null;
  company: {
    name: string;
    license_plan: string;
    license_status: string;
  };
  employee?: {
    first_name: string;
    last_name: string;
    employee_code: string;
    avatar_url?: string | null;
    department?: { name: string };
    designation?: { name: string };
  };
}

export default function TenantDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await api.tenantGetMe();
        if (data) {
          if ((data as any).must_change_password || (data as any).mustChangePassword) {
            router.push('/change-password');
            return;
          }
          setUser(data as unknown as CurrentUser);
        }
      } catch (err: unknown) {
        const e = err as Error & { code?: string };
        if (e.code === 'PASSWORD_CHANGE_REQUIRED') {
          router.push('/change-password');
          return;
        }
        if (e.code === 'UNAUTHORIZED' || e.code === 'FORBIDDEN_REALM') {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const handleLogout = () => {
    api.removeTenantToken();
    router.push('/login');
  };

  const role = user?.role || 'employee';

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['company_admin', 'manager', 'employee'],
    },
    {
      label: 'Employees',
      href: '/employees',
      icon: Users,
      roles: ['company_admin', 'manager'],
    },
    {
      label: 'Attendance',
      href: '/attendance',
      icon: Clock,
      roles: ['company_admin', 'manager', 'employee'],
    },
    {
      label: 'Leave Management',
      href: '/leave',
      icon: CalendarDays,
      roles: ['company_admin', 'manager', 'employee'],
    },
    {
      label: 'Shift Manage',
      href: '/shifts',
      icon: Clock,
      roles: ['company_admin', 'manager'],
    },
    {
      label: 'Payroll',
      href: '/payroll',
      icon: CreditCard,
      roles: ['company_admin', 'manager', 'employee'],
    },
    {
      label: 'Reports & Export',
      href: '/reports',
      icon: BarChart3,
      roles: ['company_admin', 'manager'],
    },
    {
      label: 'Notice Board',
      href: '/notices',
      icon: Megaphone,
      roles: ['company_admin', 'manager', 'employee'],
    },
    {
      label: 'Helpdesk & Tickets',
      href: '/tickets',
      icon: LifeBuoy,
      roles: ['company_admin', 'manager', 'employee'],
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: Settings,
      roles: ['company_admin'],
    },
  ];

  const filteredNav = navItems.filter((item) => item.roles.includes(role));

  const displayName = user?.employee
    ? `${user.employee.first_name} ${user.employee.last_name}`
    : user?.email.split('@')[0] || 'User';

  const roleBadgeColors: Record<string, string> = {
    company_admin: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    manager: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    employee: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Mobile Top Nav */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700/80 p-0.5 flex items-center justify-center shrink-0">
            <img src="/nova-icon.png" alt="Nova Pulse" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-xs text-white">NOVA</span>
              <span className="font-extrabold text-xs bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">PULSE</span>
            </div>
            <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">
              {user?.company?.name || 'Workspace'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-white"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:flex flex-col w-full md:w-64 bg-slate-900/70 border-r border-slate-800/80 backdrop-blur-xl shrink-0 z-30`}
      >
        {/* Nova Pulse Brand & Company Header */}
        <div className="p-5 border-b border-slate-800/80">
          {/* Top Brand Banner */}
          <div className="flex items-center gap-2.5 mb-4 pb-3.5 border-b border-slate-800/60">
            <div className="relative w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/80 p-1 flex items-center justify-center shadow-lg shadow-purple-500/15 ring-1 ring-white/10 shrink-0">
              <img src="/nova-icon.png" alt="Nova Pulse" className="w-7 h-7 object-contain drop-shadow" />
            </div>
            <div>
              <div className="flex items-center gap-1 leading-none">
                <span className="font-extrabold text-sm tracking-tight text-white">NOVA</span>
                <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">PULSE</span>
                <span className="text-[9px] font-bold text-teal-400 ml-1 px-1 py-0.2 rounded bg-teal-950/60 border border-teal-800/60 uppercase">HRMS</span>
              </div>
              <span className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold block mt-0.5">Enterprise Cloud</span>
            </div>
          </div>

          {/* Active Company Workspace Card */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="overflow-hidden min-w-0">
              <h2 className="font-semibold text-xs text-white truncate" title={user?.company?.name || 'Company Workspace'}>
                {user?.company?.name || 'Company Workspace'}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium truncate">
                  {user?.company?.license_plan || 'Active'} Plan
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-white' : 'text-slate-500 group-hover:text-emerald-400'
                    } transition-colors`}
                  />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Pill & Logout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              {user?.employee?.avatar_url || user?.avatar_url ? (
                <img
                  src={user.employee?.avatar_url || user.avatar_url || ''}
                  alt={displayName}
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-emerald-500/40 shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-white truncate">
                  {displayName}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {user?.employee?.designation?.name || user?.email}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                roleBadgeColors[role] || 'bg-slate-800 text-slate-300'
              }`}
            >
              {role.replace('_', ' ')}
            </span>

            <button
              onClick={handleLogout}
              className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>

          {/* Nova Pulse Platform Badge */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/40 flex items-center justify-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
            <img src="/nova-icon.png" alt="Nova Pulse" className="w-3.5 h-3.5 object-contain" />
            <span className="text-[10px] text-slate-400 font-medium tracking-wide">
              Powered by <strong className="text-slate-300 font-semibold">Nova Pulse</strong>
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
