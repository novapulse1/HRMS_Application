export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return 'https://hrms-application-backend-134y.onrender.com/api/v1';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
}

const API_BASE_URL = getApiBaseUrl();

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
  meta: {
    timestamp: string;
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

class ApiClient {
  public getAdminToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('nova_admin_token');
  }

  public getAdminRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('nova_admin_refresh_token');
  }

  public getTenantToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('nova_tenant_token');
  }

  private getTenantRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('nova_tenant_refresh_token');
  }

  public setAdminToken(token: string, refreshToken?: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nova_admin_token', token);
      document.cookie = `nova_admin_token=${token}; path=/; max-age=604800; SameSite=Lax`;
      if (refreshToken) {
        localStorage.setItem('nova_admin_refresh_token', refreshToken);
      }
    }
  }

  public removeAdminToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nova_admin_token');
      localStorage.removeItem('nova_admin_refresh_token');
      document.cookie = 'nova_admin_token=; path=/; max-age=0; SameSite=Lax';
    }
  }

  public setTenantToken(token: string, refreshToken?: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nova_tenant_token', token);
      document.cookie = `nova_tenant_token=${token}; path=/; max-age=604800; SameSite=Lax`;
      if (refreshToken) {
        localStorage.setItem('nova_tenant_refresh_token', refreshToken);
      }
    }
  }

  public removeTenantToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nova_tenant_token');
      localStorage.removeItem('nova_tenant_refresh_token');
      document.cookie = 'nova_tenant_token=; path=/; max-age=0; SameSite=Lax';
    }
  }

  private isRefreshing = false;

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    realm: 'admin' | 'tenant' = 'tenant',
    isRetry = false
  ): Promise<ApiResponse<T>> {
    const url = `${getApiBaseUrl()}${endpoint}`;
    const token = realm === 'admin' ? this.getAdminToken() : this.getTenantToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // 401 Refresh Interceptor
    if (
      response.status === 401 &&
      !isRetry &&
      !endpoint.includes('/login') &&
      !endpoint.includes('/refresh')
    ) {
      const refreshToken = realm === 'admin' ? this.getAdminRefreshToken() : this.getTenantRefreshToken();
      if (refreshToken && !this.isRefreshing) {
        this.isRefreshing = true;
        try {
          const refreshUrl = `${getApiBaseUrl()}/${realm === 'admin' ? 'admin' : 'auth'}/refresh`;
          const refreshRes = await fetch(refreshUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.data?.accessToken) {
              if (realm === 'admin') {
                this.setAdminToken(refreshData.data.accessToken, refreshData.data.refreshToken);
              } else {
                this.setTenantToken(refreshData.data.accessToken, refreshData.data.refreshToken);
              }
              this.isRefreshing = false;
              // Retry original request once with new token
              return this.request<T>(endpoint, options, realm, true);
            }
          }
        } catch {
          // Refresh failed
        } finally {
          this.isRefreshing = false;
        }
      }
    }

    const data: ApiResponse<T> = await response.json().catch(() => ({
      data: null,
      error: { code: 'NETWORK_ERROR', message: 'Failed to parse response' },
      meta: { timestamp: new Date().toISOString() },
    }));

    if (!response.ok && !data.error) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    if (data.error) {
      const error = new Error(data.error.message) as Error & { code?: string; details?: unknown };
      error.code = data.error.code;
      error.details = data.error.details;
      throw error;
    }

    return data;
  }

  // --- Super Admin Endpoints ---
  async adminLogin(body: { email: string; password: string }) {
    const res = await this.request<{
      accessToken: string;
      refreshToken: string;
      mustChangePassword: boolean;
      admin: { id: string; name: string; email: string; mustChangePassword: boolean };
    }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'admin');

    if (res.data?.accessToken) {
      this.setAdminToken(res.data.accessToken, res.data.refreshToken);
    }
    return res.data;
  }

  async adminChangePassword(body: { currentPassword: string; newPassword: string }) {
    const res = await this.request<{ message: string }>('/admin/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'admin');
    return res.data;
  }

  async adminGetDashboard() {
    const res = await this.request<{
      metrics: {
        totalCompanies: number;
        activeCompanies: number;
        suspendedCompanies: number;
        expiredCompanies: number;
        totalEmployees: number;
      };
      recentCompanies: Array<{
        id: string;
        name: string;
        contact_email: string;
        license_plan: string;
        license_status: string;
        license_expiry_date: string;
        created_at: string;
        _count: { employees: number };
      }>;
    }>('/admin/dashboard', { method: 'GET' }, 'admin');
    return res.data;
  }

  async adminGetCompanies(params: { page?: number; limit?: number; search?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('license_status', params.status);

    const res = await this.request<Array<{
      id: string;
      name: string;
      industry: string | null;
      size_range: string | null;
      contact_person_name: string | null;
      contact_email: string;
      contact_phone: string | null;
      address: string | null;
      license_plan: string;
      license_status: string;
      license_start_date: string;
      license_expiry_date: string;
      created_at: string;
      _count: { employees: number; users: number; departments: number };
    }>>(`/admin/companies?${query.toString()}`, { method: 'GET' }, 'admin');
    return res;
  }

  async adminCreateCompany(body: {
    name: string;
    industry?: string;
    size_range?: string;
    contact_person_name: string;
    contact_email: string;
    contact_phone?: string;
    license_plan?: string;
    license_expiry_date?: string;
  }) {
    const res = await this.request<{
      company: {
        id: string;
        name: string;
        contact_email: string;
        license_plan: string;
        license_status: string;
        license_expiry_date: string;
      };
      adminCredentials: {
        email: string;
        temporaryPassword: string;
        mustChangePassword: boolean;
      };
    }>('/admin/companies', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'admin');
    return res.data;
  }

  async adminSetCompanyStatus(companyId: string, status: 'active' | 'suspended') {
    const res = await this.request<{ id: string; license_status: string }>(
      `/admin/companies/${companyId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
      'admin'
    );
    return res.data;
  }

  async adminResetPassword(companyId: string) {
    const res = await this.request<{
      email: string;
      temporaryPassword: string;
      mustChangePassword: boolean;
    }>(`/admin/companies/${companyId}/reset-password`, {
      method: 'POST',
    }, 'admin');
    return res.data;
  }

  async adminLicenseSweep() {
    const res = await this.request<{ sweptCount: number; companies: Array<{ id: string; name: string }> }>(
      '/admin/license-sweep',
      { method: 'POST' },
      'admin'
    );
    return res.data;
  }
  // --- Tenant Portal Endpoints ---
  async tenantLogin(body: { email: string; password: string }) {
    const res = await this.request<{
      accessToken: string;
      refreshToken: string;
      mustChangePassword: boolean;
      user: {
        id: string;
        email: string;
        role: string;
        companyId: string;
        employeeId?: string | null;
        mustChangePassword: boolean;
        company: { id: string; name: string; licensePlan: string };
        employee?: {
          id: string;
          employeeCode: string;
          firstName: string;
          lastName: string;
          department?: string;
          designation?: string;
        } | null;
      };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');

    if (res.data?.accessToken) {
      this.setTenantToken(res.data.accessToken, res.data.refreshToken);
    }
    return res.data;
  }

  async tenantChangePassword(body: { currentPassword: string; newPassword: string }) {
    const res = await this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async tenantGetMe() {
    const res = await this.request<{
      id: string;
      email: string;
      role: string;
      company_id: string;
      employee_id?: string | null;
      must_change_password: boolean;
      company: {
        id: string;
        name: string;
        license_plan: string;
        license_status: string;
        license_expiry_date: string;
      };
      employee?: {
        id: string;
        employee_code: string;
        first_name: string;
        last_name: string;
        email: string;
        phone?: string;
        department?: { id: string; name: string };
        designation?: { id: string; name: string };
        manager?: { id: string; first_name: string; last_name: string; employee_code: string };
      };
    }>('/auth/me', { method: 'GET' }, 'tenant');
    return res.data;
  }

  // --- Employees & Departments ---
  async getDepartments() {
    const res = await this.request<Array<{
      id: string;
      name: string;
      _count: { employees: number; designations: number };
    }>>('/employees/departments', { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async createDepartment(name: string) {
    const res = await this.request<{ id: string; name: string }>('/employees/departments', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }, 'tenant');
    return res.data;
  }

  async getDesignations(departmentId?: string) {
    const query = departmentId ? `?department_id=${departmentId}` : '';
    const res = await this.request<Array<{
      id: string;
      name: string;
      department?: { id: string; name: string };
      _count: { employees: number };
    }>>(`/employees/designations${query}`, { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async createDesignation(data: { name: string; department_id?: string }) {
    const res = await this.request<{ id: string; name: string }>('/employees/designations', {
      method: 'POST',
      body: JSON.stringify(data),
    }, 'tenant');
    return res.data;
  }

  async getEmployees(params: {
    page?: number;
    limit?: number;
    search?: string;
    department_id?: string;
    status?: string;
    manager_id?: string;
  } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.search) query.append('search', params.search);
    if (params.department_id) query.append('department_id', params.department_id);
    if (params.status) query.append('status', params.status);
    if (params.manager_id) query.append('manager_id', params.manager_id);

    const res = await this.request<Array<{
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
    }>>(`/employees?${query.toString()}`, { method: 'GET' }, 'tenant');
    return res;
  }

  async getNextEmployeeCode() {
    const res = await this.request<{ nextCode: string }>('/employees/next-code', { method: 'GET' }, 'tenant');
    return res.data?.nextCode || '';
  }

  async getEmployeeDirectoryAnalytics() {
    const res = await this.request<{
      totalEmployees: number;
      byStatus: { active: number; inactive: number; terminated: number };
      byType: { full_time: number; part_time: number; hourly: number; contract: number };
      departments: Array<{ id: string; name: string; count: number }>;
      hiringTrend: Array<{ month: string; hires: number }>;
    }>('/employees/analytics', { method: 'GET' }, 'tenant');
    return res.data;
  }

  async createEmployee(body: {
    employee_code?: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    department_id?: string;
    designation_id?: string;
    manager_id?: string;
    date_of_joining?: string;
    employment_type?: string;
    bank_name?: string;
    bank_account_number?: string;
    bank_ifsc?: string;
    address?: string;
    pay_type?: 'monthly' | 'hourly' | 'per_day';
    base_amount?: number;
    effective_from?: string;
  }) {
    const res = await this.request('/employees', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async updateEmployee(employeeId: string, body: Record<string, unknown>) {
    const res = await this.request(`/employees/${employeeId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async deactivateEmployee(employeeId: string) {
    const res = await this.request(`/employees/${employeeId}`, {
      method: 'DELETE',
    }, 'tenant');
    return res.data;
  }

  async inviteEmployee(employeeId: string, role: string = 'employee') {
    const res = await this.request<{
      email: string;
      temporaryPassword: string;
      role: string;
      mustChangePassword: boolean;
    }>(`/employees/${employeeId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    }, 'tenant');
    return res.data;
  }

  async createEmployeeUser(employeeId: string, role: string = 'employee') {
    return this.inviteEmployee(employeeId, role);
  }

  // --- Attendance Endpoints ---
  async punchAttendance(action?: 'check_in' | 'check_out' | 'toggle', source?: string, device_id?: string) {
    const res = await this.request<{
      message: string;
      attendance: {
        id: string;
        date: string;
        status: string;
        check_in_time: string | null;
        check_out_time: string | null;
        worked_hours: number;
        marked_by: string;
      };
    }>('/attendance/punch', {
      method: 'POST',
      body: JSON.stringify({ action, source, device_id }),
    }, 'tenant');
    return res.data;
  }

  async getAttendanceSourceDistribution(month?: number, year?: number, employeeId?: string) {
    const query = new URLSearchParams();
    if (month) query.append('month', month.toString());
    if (year) query.append('year', year.toString());
    if (employeeId) query.append('employee_id', employeeId);
    const res = await this.request<{
      month: number;
      year: number;
      distribution: { web: number; mobile: number; biometric: number };
      total: number;
    }>(`/attendance/source-distribution?${query.toString()}`, { method: 'GET' }, 'tenant');
    return res.data;
  }

  async getAttendanceDevices() {
    const res = await this.request<Array<{
      id: string;
      name: string;
      device_code: string;
      ip_address: string | null;
      location: string | null;
      is_active: boolean;
      last_sync_at: string | null;
      created_at: string;
      _count?: { attendances: number };
    }>>('/attendance/devices', { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async registerAttendanceDevice(body: {
    name: string;
    device_code: string;
    ip_address?: string;
    location?: string;
  }) {
    const res = await this.request('/attendance/devices', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async toggleAttendanceDevice(id: string) {
    const res = await this.request(`/attendance/devices/${id}/toggle`, {
      method: 'PATCH',
    }, 'tenant');
    return res.data;
  }

  async syncAttendanceDevice(id: string) {
    const res = await this.request(`/attendance/devices/${id}/sync`, {
      method: 'POST',
    }, 'tenant');
    return res.data;
  }

  async deleteAttendanceDevice(id: string) {
    const res = await this.request(`/attendance/devices/${id}`, {
      method: 'DELETE',
    }, 'tenant');
    return res.data;
  }

  async getTodayAttendance() {
    const res = await this.request<{
      id: string;
      date: string;
      status: string;
      check_in_time: string | null;
      check_out_time: string | null;
      worked_hours: number;
      marked_by: string;
    } | null>('/attendance/today', { method: 'GET' }, 'tenant');
    return res.data;
  }

  async getTodayRoster() {
    const res = await this.request<{
      date: string;
      totalEmployees: number;
      presentCount: number;
      absentCount: number;
      onLeaveCount: number;
      attendanceRate: number;
      present: Array<{
        id: string;
        employee_code: string;
        name: string;
        email: string;
        department: string;
        designation: string;
        check_in_time: string | null;
        check_out_time: string | null;
        status: string;
        worked_hours: number;
      }>;
      absent: Array<{
        id: string;
        employee_code: string;
        name: string;
        email: string;
        department: string;
        designation: string;
      }>;
      onLeave: Array<{
        id: string;
        employee_code: string;
        name: string;
        email: string;
        department: string;
        designation: string;
        leave_type: string;
      }>;
    }>('/attendance/today-roster', { method: 'GET' }, 'tenant');
    return res.data;
  }

  async getAttendanceCalendar(params: {
    month: number;
    year: number;
    employee_id?: string;
    department_id?: string;
  }) {
    const query = new URLSearchParams();
    query.append('month', params.month.toString());
    query.append('year', params.year.toString());
    if (params.employee_id) query.append('employee_id', params.employee_id);
    if (params.department_id) query.append('department_id', params.department_id);

    const res = await this.request<Array<{
      id: string;
      employee_id: string;
      date: string;
      status: string;
      check_in_time: string | null;
      check_out_time: string | null;
      worked_hours: number;
      marked_by: string;
      employee: {
        id: string;
        employee_code: string;
        first_name: string;
        last_name: string;
        department?: { name: string };
        designation?: { name: string };
      };
    }>>(`/attendance/calendar?${query.toString()}`, { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async getMonthlyAttendanceSummary(month: number, year: number, employeeId?: string) {
    const query = new URLSearchParams();
    query.append('month', month.toString());
    query.append('year', year.toString());
    if (employeeId) query.append('employee_id', employeeId);

    const res = await this.request<{
      month: number;
      year: number;
      totalRecords: number;
      presentDays: number;
      halfDays: number;
      absentDays: number;
      leaveDays: number;
      holidayDays: number;
      totalWorkedHours: number;
    }>(`/attendance/summary?${query.toString()}`, { method: 'GET' }, 'tenant');
    return res.data;
  }

  async manualAttendanceCorrection(body: {
    employee_id: string;
    date: string;
    check_in_time?: string | null;
    check_out_time?: string | null;
    status: string;
    worked_hours?: number;
  }) {
    const res = await this.request('/attendance/correction', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }
  // --- Leave Management Endpoints ---
  async getLeaveTypes() {
    const res = await this.request<Array<{
      id: string;
      name: string;
      is_paid: boolean;
      default_annual_quota: number;
    }>>('/leave/types', { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async createLeaveType(body: {
    name: string;
    is_paid: boolean;
    default_annual_quota: number;
  }) {
    const res = await this.request('/leave/types', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async getLeaveBalances(employeeId?: string) {
    const query = employeeId ? `?employee_id=${employeeId}` : '';
    const res = await this.request<Array<{
      id: string;
      leave_type_id: string;
      year: number;
      allocated: number;
      used: number;
      remaining: number;
      leave_type: { id: string; name: string; is_paid: boolean };
    }>>(`/leave/balances${query}`, { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async applyLeave(body: {
    leave_type_id: string;
    start_date: string;
    end_date: string;
    is_half_day?: boolean;
    reason: string;
  }) {
    const res = await this.request('/leave/apply', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async reviewLeave(requestId: string, action: 'approve' | 'reject') {
    const res = await this.request(`/leave/${requestId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }, 'tenant');
    return res.data;
  }

  async getLeaveRequests(params: { status?: string; employee_id?: string } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.employee_id) query.append('employee_id', params.employee_id);

    const res = await this.request<Array<{
      id: string;
      start_date: string;
      end_date: string;
      total_days: number;
      is_half_day?: boolean;
      reason: string;
      status: string;
      applied_at: string;
      leave_type: { id: string; name: string; is_paid: boolean };
      employee: {
        id: string;
        employee_code: string;
        first_name: string;
        last_name: string;
        department?: { name: string };
        designation?: { name: string };
      };
      approver?: { email: string };
    }>>(`/leave/requests?${query.toString()}`, { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async getSubordinatesLeave() {
    const res = await this.request<Array<{
      id: string;
      employee_code: string;
      first_name: string;
      last_name: string;
      email: string;
      department?: string;
      designation?: string;
      balances: Array<{
        leave_type: string;
        is_paid: boolean;
        allocated: number;
        used: number;
        remaining: number;
      }>;
      pending_requests_count: number;
      pending_requests: Array<any>;
    }>>('/leave/subordinates', { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async carryForwardLeave(from_year?: number) {
    const res = await this.request<{ message: string; processedCount: number }>('/leave/carry-forward', {
      method: 'POST',
      body: JSON.stringify({ from_year }),
    }, 'tenant');
    return res.data;
  }

  async encashLeave(body: { employee_id: string; year: number; days_to_encash: number }) {
    const res = await this.request<{
      leave_bank: any;
      encashed_days_added: number;
      encash_amount_added: number;
    }>('/leave/encash', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async getLeaveBank(employeeId?: string) {
    const query = employeeId ? `?employee_id=${employeeId}` : '';
    const res = await this.request<Array<{
      id: string;
      employee_id: string;
      year: number;
      banked_days: number;
      encashed_days: number;
      encashed_amount: number;
      created_at: string;
      employee?: {
        id: string;
        employee_code: string;
        first_name: string;
        last_name: string;
      };
    }>>(`/leave/bank${query}`, { method: 'GET' }, 'tenant');
    return res.data || [];
  }
  // --- Shifts & Holidays Endpoints ---
  async getShifts() {
    const res = await this.request<Array<{
      id: string;
      name: string;
      start_time: string;
      end_time: string;
      is_night_shift: boolean;
      _count: { assignments: number };
    }>>('/shifts', { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async createShift(body: {
    name: string;
    start_time: string;
    end_time: string;
    is_night_shift?: boolean;
  }) {
    const res = await this.request('/shifts', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async assignShift(body: {
    shift_id: string;
    employee_ids: string[];
    effective_from?: string;
    effective_to?: string | null;
  }) {
    const res = await this.request('/shifts/assign', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async getHolidays(year?: number) {
    const query = year ? `?year=${year}` : '';
    const res = await this.request<Array<{
      id: string;
      name: string;
      date: string;
      is_recurring_annually: boolean;
    }>>(`/shifts/holidays${query}`, { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async createHoliday(body: {
    name: string;
    date: string;
    is_recurring_annually?: boolean;
  }) {
    const res = await this.request('/shifts/holidays', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async deleteHoliday(id: string) {
    const res = await this.request(`/shifts/holidays/${id}`, {
      method: 'DELETE',
    }, 'tenant');
    return res.data;
  }

  // --- Company Settings Endpoints ---
  async getCompanySettings() {
    const res = await this.request<{
      id: string;
      working_days_json: string[];
      working_hours_start: string;
      working_hours_end: string;
      payroll_cycle_day: number;
      overtime_enabled: boolean;
      overtime_rate_multiplier: number;
    }>('/settings', { method: 'GET' }, 'tenant');
    return res.data;
  }

  async updateCompanySettings(body: {
    working_days_json?: string[];
    working_hours_start?: string;
    working_hours_end?: string;
    payroll_cycle_day?: number;
    overtime_enabled?: boolean;
    overtime_rate_multiplier?: number;
  }) {
    const res = await this.request('/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  // --- Payroll Endpoints ---
  async getSalaryStructures() {
    const res = await this.request<any[]>('/payroll/salary-structures', { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async setSalaryStructure(employeeId: string, body: { pay_type: string; base_amount: number; effective_from?: string }) {
    const res = await this.request(`/payroll/salary-structures/${employeeId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async runPayroll(body: { month: number; year: number }) {
    const res = await this.request('/payroll/runs', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async getPayrollRuns() {
    const res = await this.request<any[]>('/payroll/runs', { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async getPayrollRunById(id: string) {
    const res = await this.request<any>(`/payroll/runs/${id}`, { method: 'GET' }, 'tenant');
    return res.data;
  }

  async markPayrollRunPaid(id: string) {
    const res = await this.request(`/payroll/runs/${id}/pay`, { method: 'PATCH' }, 'tenant');
    return res.data;
  }

  async getMyPayslips() {
    const res = await this.request<any[]>('/payroll/payslips/my', { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async getPayslipById(id: string) {
    const res = await this.request<any>(`/payroll/payslips/${id}`, { method: 'GET' }, 'tenant');
    return res.data;
  }

  async approvePayrollRun(id: string) {
    const res = await this.request(`/payroll/runs/${id}/approve`, {
      method: 'POST',
    }, 'tenant');
    return res.data;
  }

  async rejectPayrollRun(id: string, reason?: string) {
    const res = await this.request(`/payroll/runs/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }, 'tenant');
    return res.data;
  }

  async getStatutorySettings() {
    const res = await this.request<{
      id: string;
      company_id: string;
      pf_enabled: boolean;
      pf_employee_rate: number;
      pf_employer_rate: number;
      pf_wage_ceiling: number;
      esi_enabled: boolean;
      esi_employee_rate: number;
      esi_employer_rate: number;
      esi_wage_ceiling: number;
      tds_enabled: boolean;
      default_tax_regime: 'new_regime' | 'old_regime';
    }>('/payroll/statutory-settings', { method: 'GET' }, 'tenant');
    return res.data;
  }

  async updateStatutorySettings(body: any) {
    const res = await this.request('/payroll/statutory-settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async getLoans() {
    const res = await this.request<Array<{
      id: string;
      employee_id: string;
      amount: number;
      monthly_deduction_amount: number;
      outstanding_balance: number;
      tenure_months: number;
      status: string;
      reason?: string | null;
      created_at: string;
      employee: {
        id: string;
        first_name: string;
        last_name: string;
        employee_code: string;
        department?: { name: string };
      };
      approver?: { id: string; email: string };
    }>>('/payroll/loans', { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async createLoan(body: {
    employee_id?: string;
    amount: number;
    tenure_months: number;
    reason?: string;
  }) {
    const res = await this.request('/payroll/loans', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async reviewLoan(id: string, action: 'approved' | 'rejected' | 'active') {
    const res = await this.request(`/payroll/loans/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }, 'tenant');
    return res.data;
  }

  async downloadPayslipPdf(id: string, filename: string) {
    const token = this.getTenantToken();
    const res = await fetch(`${getApiBaseUrl()}/payroll/payslips/${id}/pdf`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to download PDF');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  async downloadForm16Pdf(id: string, filename: string) {
    const token = this.getTenantToken();
    const res = await fetch(`${getApiBaseUrl()}/payroll/payslips/${id}/form16`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to download Form 16 PDF');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // --- HR Helpdesk & Support Tickets ---
  async createTicket(body: {
    category: string;
    subject: string;
    description: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  }) {
    const res = await this.request('/tickets', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async getTickets(params: { status?: string; priority?: string; category?: string } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.priority) query.append('priority', params.priority);
    if (params.category) query.append('category', params.category);

    const res = await this.request<any[]>(`/tickets?${query.toString()}`, { method: 'GET' }, 'tenant');
    return res.data || [];
  }

  async getTicketById(id: string) {
    const res = await this.request<any>(`/tickets/${id}`, { method: 'GET' }, 'tenant');
    return res.data;
  }

  async assignTicket(id: string, assignedTo: string) {
    const res = await this.request(`/tickets/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assigned_to: assignedTo }),
    }, 'tenant');
    return res.data;
  }

  async updateTicketStatus(id: string, body: { status: string; resolution?: string }) {
    const res = await this.request(`/tickets/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async getTicketAnalytics() {
    const res = await this.request<any>('/tickets/analytics', { method: 'GET' }, 'tenant');
    return res.data;
  }

  // --- Notice Board Endpoints ---
  async getNotices(params: {
    search?: string;
    category?: string;
    priority?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.category) query.append('category', params.category);
    if (params.priority) query.append('priority', params.priority);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());

    const res = await this.request<Array<{
      id: string;
      title: string;
      content: string;
      category: 'general' | 'announcement' | 'policy' | 'event' | 'holiday';
      priority: 'low' | 'normal' | 'high' | 'urgent';
      is_pinned: boolean;
      created_at: string;
      updated_at: string;
      author: {
        id: string;
        email: string;
        role: string;
        employee?: {
          id: string;
          first_name: string;
          last_name: string;
          employee_code: string;
        } | null;
      };
    }>>(`/notices?${query.toString()}`, { method: 'GET' }, 'tenant');
    return res;
  }

  async createNotice(body: {
    title: string;
    content: string;
    category?: string;
    priority?: string;
    is_pinned?: boolean;
  }) {
    const res = await this.request('/notices', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async updateNotice(id: string, body: {
    title?: string;
    content?: string;
    category?: string;
    priority?: string;
    is_pinned?: boolean;
  }) {
    const res = await this.request(`/notices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }, 'tenant');
    return res.data;
  }

  async deleteNotice(id: string) {
    const res = await this.request(`/notices/${id}`, {
      method: 'DELETE',
    }, 'tenant');
    return res.data;
  }

  async togglePinNotice(id: string) {
    const res = await this.request(`/notices/${id}/pin`, {
      method: 'PATCH',
    }, 'tenant');
    return res.data;
  }
}

export const api = new ApiClient();
export default api;

