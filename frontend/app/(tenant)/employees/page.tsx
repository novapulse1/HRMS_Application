'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Users,
  Plus,
  Search,
  Mail,
  Building2,
  Key,
  Copy,
  Check,
  X,
  Sparkles,
  UserCheck,
  AlertCircle,
  Briefcase,
  Calendar,
  LayoutGrid,
  Table as TableIcon,
  TrendingUp,
  PieChart,
  UserX,
  Phone,
  Clock,
  Coins,
  RefreshCw,
} from 'lucide-react';

interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  employment_type: string;
  status: string;
  date_of_joining?: string;
  department?: { id: string; name: string };
  designation?: { id: string; name: string };
  manager?: { id: string; first_name: string; last_name: string; employee_code: string };
  salary_structures?: Array<{
    id: string;
    pay_type: 'monthly' | 'hourly' | 'per_day';
    base_amount: string | number;
    effective_from: string;
  }>;
  shifts?: Array<{
    shift: {
      id: string;
      name: string;
      start_time: string;
      end_time: string;
      is_night_shift: boolean;
    };
  }>;
  user?: { id: string; email: string; role: string; is_active: boolean };
}

interface DirectoryAnalytics {
  totalEmployees: number;
  byStatus: { active: number; inactive: number; terminated: number };
  byType: { full_time: number; part_time: number; hourly: number; contract: number };
  departments: Array<{ id: string; name: string; count: number }>;
  hiringTrend: Array<{ month: string; hires: number }>;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [designations, setDesignations] = useState<Array<{ id: string; name: string }>>([]);
  const [analytics, setAnalytics] = useState<DirectoryAnalytics | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // New employee form state
  const [employeeCode, setEmployeeCode] = useState('');
  const [suggestedCode, setSuggestedCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState(new Date().toISOString().split('T')[0]);
  const [employmentType, setEmploymentType] = useState('full_time');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');

  // Compensation / Salary form state
  const [payType, setPayType] = useState<'monthly' | 'per_day' | 'hourly'>('monthly');
  const [baseAmount, setBaseAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');

  // Credentials reveal modal
  const [credentialsModal, setCredentialsModal] = useState<{
    name: string;
    email: string;
    tempPassword: string;
    role: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Invite action state
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [me, empData, deptData, desigData] = await Promise.all([
        api.tenantGetMe(),
        api.getEmployees({
          search: search || undefined,
          department_id: selectedDept || undefined,
        }),
        api.getDepartments(),
        api.getDesignations(),
      ]);

      setUserRole(me?.role || '');
      if (empData?.data) setEmployees(empData.data);
      if (deptData) setDepartments(deptData);
      if (desigData) setDesignations(desigData);

      if (me?.role === 'company_admin') {
        const stats = await api.getEmployeeDirectoryAnalytics().catch(() => null);
        if (stats) setAnalytics(stats);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDept]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const openAddModal = async () => {
    setShowAddModal(true);
    setAddError(null);
    try {
      const next = await api.getNextEmployeeCode();
      if (next) {
        setSuggestedCode(next);
        setEmployeeCode(next);
      }
    } catch (err) {
      console.error('Failed to get next employee code:', err);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);

    try {
      await api.createEmployee({
        employee_code: employeeCode.trim() || undefined,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || undefined,
        department_id: departmentId || undefined,
        designation_id: designationId || undefined,
        manager_id: managerId || undefined,
        date_of_joining: dateOfJoining || undefined,
        employment_type: employmentType,
        bank_name: bankName || undefined,
        bank_account_number: bankAccount || undefined,
        bank_ifsc: bankIfsc || undefined,
        pay_type: baseAmount ? payType : undefined,
        base_amount: baseAmount ? parseFloat(baseAmount) : undefined,
        effective_from: effectiveFrom || dateOfJoining || undefined,
      });

      setShowAddModal(false);
      setEmployeeCode('');
      setSuggestedCode('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setDepartmentId('');
      setDesignationId('');
      setManagerId('');
      setDateOfJoining(new Date().toISOString().split('T')[0]);
      setEmploymentType('full_time');
      setBankName('');
      setBankAccount('');
      setBankIfsc('');
      setBaseAmount('');
      setEffectiveFrom('');
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      setAddError(e.message || 'Failed to add employee');
    } finally {
      setAddLoading(false);
    }
  };

  const formatSalary = (emp: Employee) => {
    const struct = emp.salary_structures?.[0];
    if (!struct || !struct.base_amount) return null;
    const amt = Number(struct.base_amount).toLocaleString('en-IN');
    if (struct.pay_type === 'hourly') return `₹${amt}/hr`;
    if (struct.pay_type === 'per_day') return `₹${amt}/day`;
    return `₹${amt}/mo`;
  };

  const getWorkSchedule = (emp: Employee) => {
    const shiftItem = emp.shifts?.[0]?.shift;
    if (!shiftItem) return null;
    return `${shiftItem.name} (${shiftItem.start_time} - ${shiftItem.end_time})`;
  };

  const handleInviteUser = async (emp: Employee) => {
    setInvitingId(emp.id);
    try {
      const res = await api.createEmployeeUser(emp.id);
      if (res?.temporaryPassword) {
        setCredentialsModal({
          name: `${emp.first_name} ${emp.last_name}`,
          email: res.email,
          tempPassword: res.temporaryPassword,
          role: res.role,
        });
        setCopied(false);
      }
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`User access provisioning failed: ${e.message}`);
    } finally {
      setInvitingId(null);
    }
  };

  const copyCredentials = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAdmin = userRole === 'company_admin';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>Employee Directory</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Centralized workforce records, structural designations, portal authentication, and team search.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Grid Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {isAdmin && (
            <button
              onClick={openAddModal}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* Analytics Banner (Admin Only) */}
      {isAdmin && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400">Total Workforce</span>
              <div className="text-3xl font-bold font-mono text-white mt-1">
                {analytics.totalEmployees}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px]">
              <span className="text-emerald-400 font-semibold">{analytics.byStatus.active} Active</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">{analytics.byStatus.inactive} Inactive</span>
              <span className="text-slate-600">•</span>
              <span className="text-red-400">{analytics.byStatus.terminated} Terminated</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400">Employment Models</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {analytics.byType.full_time}
                </span>
                <span className="text-xs text-slate-500 font-medium">Full-Time</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[10px] text-slate-400">
              <span>{analytics.byType.part_time} Part-time</span>
              <span>•</span>
              <span>{analytics.byType.hourly} Hourly</span>
              <span>•</span>
              <span>{analytics.byType.contract} Contract</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400">Departments ({analytics.departments.length})</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {analytics.departments.slice(0, 3).map((d) => (
                  <span
                    key={d.id}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300"
                  >
                    {d.name}: <span className="font-bold text-teal-400">{d.count}</span>
                  </span>
                ))}
              </div>
            </div>
            <span className="text-[11px] text-slate-500 mt-2 block">Top organizational divisions</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                Hiring Velocity (Last 6 Mos)
              </span>
              <div className="flex items-end gap-1.5 h-10 mt-2">
                {analytics.hiringTrend.map((m, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-emerald-500/30 hover:bg-emerald-500 rounded-t transition-all"
                      style={{ height: `${Math.max(15, Math.min(100, (m.hires + 1) * 20))}%` }}
                      title={`${m.month}: ${m.hires} hires`}
                    />
                  </div>
                ))}
              </div>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 text-center block">Past 6 months growth</span>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, name, or email..."
            className="w-full bg-slate-900/70 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* View 1: Table Mode */}
      {viewMode === 'table' ? (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Employee ID</th>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Department & Role</th>
                  <th className="py-3.5 px-4">Work Schedule</th>
                  <th className="py-3.5 px-4">Compensation</th>
                  <th className="py-3.5 px-4">Reports To</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Portal Login</th>
                  {isAdmin && <th className="py-3.5 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading employee roster...
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      No employees found matching criteria.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const hasUser = !!emp.user;
                    const salaryStr = formatSalary(emp);
                    const scheduleStr = getWorkSchedule(emp);

                    return (
                      <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-semibold">
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
                            {emp.employee_code}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">
                            {emp.first_name} {emp.last_name}
                          </div>
                          <div className="text-[11px] text-slate-500">{emp.email}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-white font-medium">
                            {emp.designation?.name || 'Staff'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {emp.department?.name || 'General'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {scheduleStr ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/40 text-indigo-300 border border-indigo-800/50 text-[11px] font-medium">
                              <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
                              <span className="truncate max-w-[130px]">{scheduleStr}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px]">Unassigned</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {salaryStr ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 font-mono text-[11px] font-medium">
                              <Coins className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>{salaryStr}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-400">
                          {emp.manager ? (
                            <span>
                              {emp.manager.first_name} {emp.manager.last_name}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 capitalize">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 border border-slate-700">
                            {emp.employment_type.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {hasUser ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>Active ({emp.user?.role})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              <span>No Access</span>
                            </span>
                          )}
                        </td>

                        {isAdmin && (
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleInviteUser(emp)}
                              disabled={invitingId === emp.id}
                              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer font-medium text-[11px]"
                              title={hasUser ? 'Reset & re-issue password' : 'Grant portal login credentials'}
                            >
                              {hasUser ? 'Reset Access' : 'Invite User'}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* View 2: Grid Cards Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => {
            const initials = `${emp.first_name[0] || ''}${emp.last_name[0] || ''}`.toUpperCase();
            const hasUser = !!emp.user;
            const salaryStr = formatSalary(emp);
            const scheduleStr = getWorkSchedule(emp);

            return (
              <div
                key={emp.id}
                className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex flex-col justify-between hover:border-slate-700/80 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-bold flex items-center justify-center text-sm shadow-md">
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          {emp.first_name} {emp.last_name}
                        </h3>
                        <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                          {emp.employee_code}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {emp.employment_type.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs pt-3 border-t border-slate-800/70 text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Department</span>
                      <span className="font-medium text-white">{emp.department?.name || 'General'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Designation</span>
                      <span className="font-medium text-white">{emp.designation?.name || 'Staff'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Work Schedule</span>
                      <span className="font-medium text-indigo-300 truncate max-w-[170px]">
                        {scheduleStr || 'Unassigned'}
                      </span>
                    </div>

                    {salaryStr && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Salary Rate</span>
                        <span className="font-mono font-semibold text-emerald-400">{salaryStr}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Work Email</span>
                      <span className="text-slate-400 truncate max-w-[170px]">{emp.email}</span>
                    </div>

                    {emp.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Phone</span>
                        <span className="text-slate-400 font-mono">{emp.phone}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Reports To</span>
                      <span className="text-slate-400">
                        {emp.manager ? `${emp.manager.first_name} ${emp.manager.last_name}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/70 flex items-center justify-between">
                  <div>
                    {hasUser ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Active Portal</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                        No Login
                      </span>
                    )}
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleInviteUser(emp)}
                      disabled={invitingId === emp.id}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer font-medium text-[11px]"
                    >
                      {hasUser ? 'Reset Access' : 'Invite'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Register New Employee</h3>
                  <p className="text-[11px] text-slate-400">
                    Corporate identity, structural role, compensation structure, and payroll enrollment.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-xl hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs shrink-0 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{addError}</span>
              </div>
            )}

            {/* Scrollable Form Content */}
            <form onSubmit={handleAddEmployee} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
              {/* Section 1: Identification & Personal Info */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Corporate Identity & Contact</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-300 font-medium">Employee ID *</label>
                      {suggestedCode && (
                        <span className="text-[10px] text-slate-400">
                          Suggested: <strong className="text-emerald-400 font-mono">{suggestedCode}</strong>
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={employeeCode}
                        onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                        placeholder="e.g. EMP-001 or NV-101"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold tracking-wider focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase"
                      />
                      {suggestedCode && employeeCode !== suggestedCode && (
                        <button
                          type="button"
                          onClick={() => setEmployeeCode(suggestedCode)}
                          className="absolute right-2 top-2 text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 cursor-pointer"
                        >
                          Use {suggestedCode}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Work Email *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alice@company.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">First Name *</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Alice"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Walker"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Date of Joining</label>
                    <input
                      type="date"
                      value={dateOfJoining}
                      onChange={(e) => setDateOfJoining(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Organizational Placement */}
              <div className="pt-3 border-t border-slate-800/80">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Organizational Hierarchy & Role</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Department</label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Designation / Role</label>
                    <select
                      value={designationId}
                      onChange={(e) => setDesignationId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">Select Designation</option>
                      {designations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Reporting Manager</label>
                    <select
                      value={managerId}
                      onChange={(e) => setManagerId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">None (Reports to Leadership)</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.first_name} {e.last_name} ({e.employee_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Employment Classification</label>
                    <select
                      value={employmentType}
                      onChange={(e) => setEmploymentType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 capitalize"
                    >
                      <option value="full_time">Full Time</option>
                      <option value="part_time">Part Time</option>
                      <option value="hourly">Hourly Billing</option>
                      <option value="contract">Fixed Contract</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Compensation & Payroll Setup (Direct Payroll Integration!) */}
              <div className="pt-3 border-t border-slate-800/80 bg-slate-950/40 p-3.5 rounded-xl border border-emerald-950/40">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5" />
                    <span>Compensation & Salary Structure</span>
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-medium">
                    Feeds Direct to Payroll
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">
                  Set their initial compensation rate now to automate payslip generation and statutory deductions.
                </p>

                {/* 3 Selectable Pay Type Cards */}
                <div className="grid grid-cols-3 gap-2.5 mb-3">
                  <button
                    type="button"
                    onClick={() => setPayType('monthly')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      payType === 'monthly'
                        ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/50'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-xs text-white">Monthly Salary</span>
                      {payType === 'monthly' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400">Fixed monthly pay basis</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayType('per_day')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      payType === 'per_day'
                        ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/50'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-xs text-white">Daily Wage</span>
                      {payType === 'per_day' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400">Per day worked rate</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayType('hourly')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      payType === 'hourly'
                        ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/50'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-xs text-white">Hourly Rate</span>
                      {payType === 'hourly' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400">Per worked hour billing</p>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      {payType === 'monthly'
                        ? 'Monthly Gross Base Amount (₹)'
                        : payType === 'per_day'
                        ? 'Per-Day Daily Wage Rate (₹)'
                        : 'Hourly Compensation Rate (₹)'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-mono text-xs">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={baseAmount}
                        onChange={(e) => setBaseAmount(e.target.value)}
                        placeholder={
                          payType === 'monthly'
                            ? 'e.g. 50000'
                            : payType === 'per_day'
                            ? 'e.g. 1500'
                            : 'e.g. 250'
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      {payType === 'monthly'
                        ? 'Prorated by present days & paid leaves during monthly payroll run.'
                        : payType === 'per_day'
                        ? 'Multiplied by total present/half days recorded in attendance.'
                        : 'Calculated directly against approved worked attendance hours.'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Salary Effective Date</label>
                    <input
                      type="date"
                      value={effectiveFrom || dateOfJoining}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Defaults to date of joining ({dateOfJoining || 'today'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 4: Bank Details */}
              <div className="pt-3 border-t border-slate-800/80">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Disbursement & Bank Routing (Optional)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Account Number</label>
                    <input
                      type="text"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="501002345678"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">IFSC / Routing</label>
                    <input
                      type="text"
                      value={bankIfsc}
                      onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                      placeholder="HDFC0001234"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Sticky Footer */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-5 py-2 rounded-xl shadow-lg shadow-emerald-600/25 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 text-xs"
                >
                  {addLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Register Employee & Setup Payroll</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {credentialsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">
                Workspace Credentials Issued
              </h3>
              <p className="text-xs text-slate-400">Created for {credentialsModal.name}</p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5 mb-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-sans">
                  Login Email
                </span>
                <span className="text-white select-all">{credentialsModal.email}</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-slate-500 block text-[10px] uppercase font-sans">
                  Temporary Password
                </span>
                <span className="text-emerald-400 font-bold text-sm tracking-wider select-all">
                  {credentialsModal.tempPassword}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-amber-400/90 leading-relaxed mb-5 bg-amber-950/30 border border-amber-800/40 p-3 rounded-xl">
              ⚠️ Note: This temporary password is only displayed once. The employee will be forced to configure their own private password upon first login.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() =>
                  copyCredentials(
                    `Nova Pulse Workspace Login\nEmail: ${credentialsModal.email}\nTemporary Password: ${credentialsModal.tempPassword}\nPortal: http://localhost:3000/login`
                  )
                }
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Credentials</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setCredentialsModal(null)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-xs transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
