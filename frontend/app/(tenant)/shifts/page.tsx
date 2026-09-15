'use client';

import React, { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import {
  Calendar,
  Clock,
  Plus,
  Moon,
  Sun,
  Users,
  Trash2,
  Check,
  X,
  Sparkles,
  AlertCircle,
  Repeat,
  Search,
  Filter,
  CheckSquare,
  CheckCheck,
  Building2,
  CalendarDays,
} from 'lucide-react';

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Shift Modal
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftName, setShiftName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [isNightShift, setIsNightShift] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(false);

  // Bulk Assign Shift Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignShiftId, setAssignShiftId] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [shiftsData, empsRes, deptsData] = await Promise.all([
        api.getShifts(),
        api.getEmployees({ limit: 100 }),
        api.getDepartments(),
      ]);
      setShifts(shiftsData);
      setEmployees(empsRes.data || []);
      setDepartments(deptsData);
      if (shiftsData.length > 0 && !assignShiftId) {
        setAssignShiftId(shiftsData[0].id);
      }
    } catch (err) {
      console.error('Failed to load shifts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setShiftLoading(true);
    try {
      await api.createShift({
        name: shiftName,
        start_time: startTime,
        end_time: endTime,
        is_night_shift: isNightShift,
      });
      setShowShiftModal(false);
      setShiftName('');
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Failed to create shift: ${e.message}`);
    } finally {
      setShiftLoading(false);
    }
  };

  const handleAssignShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployees.length === 0) {
      alert('Please select at least one employee for schedule allocation.');
      return;
    }

    setAssignLoading(true);
    setAssignMessage(null);
    try {
      await api.assignShift({
        shift_id: assignShiftId,
        employee_ids: selectedEmployees,
        effective_from: effectiveFrom || undefined,
        effective_to: effectiveTo || null,
      });
      setShowAssignModal(false);
      setSelectedEmployees([]);
      setEmpSearch('');
      setDeptFilter('');
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Shift assignment failed: ${e.message}`);
    } finally {
      setAssignLoading(false);
    }
  };

  // Quick filter helpers for workforce selector
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchDept = !deptFilter || emp.department?.id === deptFilter;
      const q = empSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        emp.first_name.toLowerCase().includes(q) ||
        emp.last_name.toLowerCase().includes(q) ||
        emp.employee_code.toLowerCase().includes(q) ||
        (emp.designation?.name && emp.designation.name.toLowerCase().includes(q));
      return matchDept && matchSearch;
    });
  }, [employees, deptFilter, empSearch]);

  const handleToggleSelectEmp = (id: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredEmployees.map((e) => e.id);
    setSelectedEmployees((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleDeselectAll = () => {
    setSelectedEmployees([]);
  };

  const selectedShiftObj = shifts.find((s) => s.id === assignShiftId);

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-indigo-400" />
            <span>Shift Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise duty rosters, operational shift hours, and team schedule allocations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowAssignModal(true);
              setEffectiveFrom(new Date().toISOString().split('T')[0]);
              setEffectiveTo('');
            }}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl border border-slate-700 flex items-center gap-2 cursor-pointer shadow-sm transition-all"
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>Assign Shift</span>
          </button>

          <button
            onClick={() => setShowShiftModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-600/25 flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Shift</span>
          </button>
        </div>
      </div>

      {/* Section 1: Active Work Schedules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Active Work Schedules & Rosters</span>
          </h2>
          <span className="text-xs text-slate-500">
            {shifts.length} {shifts.length === 1 ? 'profile' : 'profiles'} active
          </span>
        </div>

        {shifts.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 text-center text-slate-500 text-xs">
            No work schedules configured yet. Click "New Work Schedule" to create your first duty roster.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shifts.map((s) => (
              <div
                key={s.id}
                className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700/80 transition-all backdrop-blur-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-white">{s.name}</span>
                    {s.is_night_shift ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-950/60 text-violet-300 border border-violet-800/60">
                        <Moon className="w-3 h-3" />
                        <span>Overnight Duty</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/60">
                        <Sun className="w-3 h-3" />
                        <span>Standard Day Schedule</span>
                      </span>
                    )}
                  </div>

                  <div className="text-2xl font-mono font-bold text-white tracking-wider my-3">
                    {s.start_time} — {s.end_time}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{s._count?.assignments ?? 0} Staff Members Assigned</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal 1: Create Shift */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Configure Shift</h3>
              </div>
              <button
                onClick={() => setShowShiftModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateShift} className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Schedule / Shift Name *</label>
                <input
                  type="text"
                  required
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  placeholder="e.g. Operations Morning Roster"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Duty Start Time *</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Duty End Time *</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <input
                  type="checkbox"
                  id="nightShift"
                  checked={isNightShift}
                  onChange={(e) => setIsNightShift(e.target.checked)}
                  className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="nightShift" className="text-slate-300 cursor-pointer text-xs">
                  Overnight Duty (Crosses Midnight boundary)
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowShiftModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={shiftLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {shiftLoading ? 'Publishing...' : 'Publish Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Bulk Work Schedule Assignment */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Bulk Work Schedule Assignment</h3>
                  <p className="text-[11px] text-slate-400">
                    Allocate duty schedules to individuals, entire departments, or multiple staff members at once.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-xl hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignShift} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Step 1: Target Work Schedule */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Select Target Schedule *</label>
                    <select
                      value={assignShiftId}
                      onChange={(e) => setAssignShiftId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.start_time} - {s.end_time})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Effective Start Date *</label>
                    <input
                      type="date"
                      required
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      Effective End Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={effectiveTo}
                      onChange={(e) => setEffectiveTo(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Leave blank for ongoing schedule"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Leave blank for permanent / ongoing schedule assignment.
                    </span>
                  </div>

                  {selectedShiftObj && (
                    <div className="p-3 bg-indigo-950/30 border border-indigo-900/50 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-indigo-400 font-bold uppercase">Assigned Profile</span>
                        <div className="font-bold text-white text-xs mt-0.5">{selectedShiftObj.name}</div>
                        <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                          {selectedShiftObj.start_time} — {selectedShiftObj.end_time}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-semibold">
                        {selectedShiftObj.is_night_shift ? 'Overnight' : 'Day Duty'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Staff Selection & Bulk Controls */}
              <div className="pt-3 border-t border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Select Workforce Members</span>
                  </h4>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-semibold text-white px-2 py-0.5 rounded-lg bg-indigo-950/60 border border-indigo-800/60">
                      {selectedEmployees.length} of {employees.length} Selected
                    </span>
                  </div>
                </div>

                {/* Filter and Quick Action Toolbar */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-2.5">
                  <div className="sm:col-span-6 relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                      placeholder="Search by name, ID, or designation..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-6 flex gap-2">
                    <select
                      value={deptFilter}
                      onChange={(e) => setDeptFilter(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    >
                      <option value="">All Departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-xl border border-slate-700 font-semibold cursor-pointer transition-all text-xs shrink-0"
                      title="Select all currently visible employees"
                    >
                      Select All ({filteredEmployees.length})
                    </button>

                    {selectedEmployees.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-300 rounded-xl border border-slate-700 cursor-pointer transition-all text-xs shrink-0"
                        title="Clear current selection"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Employee Multi-Select List */}
                <div className="max-h-56 overflow-y-auto bg-slate-950/80 border border-slate-800 rounded-xl p-2 divide-y divide-slate-800/40">
                  {filteredEmployees.length === 0 ? (
                    <div className="py-6 text-center text-slate-500 text-xs">
                      No team members found matching your search filter.
                    </div>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const isChecked = selectedEmployees.includes(emp.id);
                      const currentShift = emp.shifts?.[0]?.shift;

                      return (
                        <div
                          key={emp.id}
                          onClick={() => handleToggleSelectEmp(emp.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                            isChecked ? 'bg-indigo-950/40 border border-indigo-900/60' : 'hover:bg-slate-900/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // Handled by parent div onClick
                              className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">
                                  {emp.first_name} {emp.last_name}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono text-[10px] font-bold border border-slate-700">
                                  {emp.employee_code}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>{emp.department?.name || 'General Dept'}</span>
                                <span>•</span>
                                <span>{emp.designation?.name || 'Staff'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            {currentShift ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-800">
                                Current: <strong className="text-indigo-300">{currentShift.name}</strong> ({currentShift.start_time}-{currentShift.end_time})
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">No schedule assigned</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Modal Sticky Footer */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 cursor-pointer transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading || selectedEmployees.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2 rounded-xl shadow-lg shadow-indigo-600/25 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 text-xs"
                >
                  {assignLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCheck className="w-4 h-4" />
                      <span>Assign Schedule ({selectedEmployees.length} Staff)</span>
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
