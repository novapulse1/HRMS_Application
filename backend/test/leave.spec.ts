describe('Leave Quota & Balance Management Engine', () => {
  interface LeaveBalance {
    allocated: number;
    used: number;
    remaining: number;
  }

  function applyLeaveDeduction(
    balance: LeaveBalance,
    requestedDays: number,
    isPaid: boolean
  ): { success: boolean; newBalance?: LeaveBalance; error?: string } {
    if (requestedDays <= 0) {
      return { success: false, error: 'Leave duration must be greater than zero' };
    }

    if (!isPaid) {
      // Unpaid leaves do not deduct from annual paid quota
      return { success: true, newBalance: balance };
    }

    if (requestedDays > balance.remaining) {
      return {
        success: false,
        error: `Insufficient leave balance. Requested: ${requestedDays}, Remaining: ${balance.remaining}`,
      };
    }

    return {
      success: true,
      newBalance: {
        allocated: balance.allocated,
        used: balance.used + requestedDays,
        remaining: balance.remaining - requestedDays,
      },
    };
  }

  function canApproveLeave(
    approverRole: 'company_admin' | 'manager' | 'employee',
    approverEmployeeId: string | null,
    applicantManagerId: string | null
  ): boolean {
    if (approverRole === 'company_admin') {
      return true; // Admins can approve for all company employees
    }
    if (approverRole === 'manager') {
      return Boolean(approverEmployeeId && approverEmployeeId === applicantManagerId);
    }
    return false; // Employees cannot approve leaves
  }

  it('correctly deducts approved days from remaining leave balance', () => {
    const initialBalance: LeaveBalance = { allocated: 14, used: 2, remaining: 12 };
    const result = applyLeaveDeduction(initialBalance, 3, true);

    expect(result.success).toBe(true);
    expect(result.newBalance?.used).toBe(5);
    expect(result.newBalance?.remaining).toBe(9);
    expect(result.newBalance?.allocated).toBe(14);
  });

  it('blocks paid leave application when requested days exceed remaining quota', () => {
    const initialBalance: LeaveBalance = { allocated: 10, used: 8, remaining: 2 };
    const result = applyLeaveDeduction(initialBalance, 5, true);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient leave balance');
  });

  it('allows unpaid leave even when remaining quota is 0 without deducting from quota', () => {
    const initialBalance: LeaveBalance = { allocated: 10, used: 10, remaining: 0 };
    const result = applyLeaveDeduction(initialBalance, 5, false);

    expect(result.success).toBe(true);
    expect(result.newBalance?.remaining).toBe(0);
    expect(result.newBalance?.used).toBe(10);
  });

  it('permits company admin to approve any leave in the tenant', () => {
    const canAdminApprove = canApproveLeave('company_admin', null, 'some-manager-id');
    expect(canAdminApprove).toBe(true);
  });

  it('permits manager to approve only direct reports (manager_id matches)', () => {
    const managerEmpId = 'mgr-100';
    const isDirectReport = canApproveLeave('manager', managerEmpId, 'mgr-100');
    const isNotDirectReport = canApproveLeave('manager', managerEmpId, 'mgr-200');

    expect(isDirectReport).toBe(true);
    expect(isNotDirectReport).toBe(false);
  });

  it('strictly blocks regular employees from approving any leave requests', () => {
    const canEmpApprove = canApproveLeave('employee', 'emp-1', 'emp-1');
    expect(canEmpApprove).toBe(false);
  });
});
