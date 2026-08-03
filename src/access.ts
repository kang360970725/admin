export default function access(initialState: { currentUser?: any } | undefined) {
  const { currentUser } = initialState ?? {};

  const permissions = currentUser?.permissions || [];
  const userType = String(currentUser?.userType || '').trim().toUpperCase();
  const staffEmploymentStatus = String(currentUser?.staffEmploymentStatus || '').trim().toUpperCase();
  const isSuperAdmin = userType === 'SUPER_ADMIN';
  const isDispatchEligibleStaff = !(
    userType === 'STAFF' &&
    (staffEmploymentStatus === 'EXITED' || staffEmploymentStatus === 'BLACKLISTED')
  );
  const has = (key: string) => permissions.includes(key);
  const canViewMemberUsers = isSuperAdmin || has('users:member:page');
  const canViewStaffUsers = isSuperAdmin || has('users:staff:page');
  const canViewInternalUsers = isSuperAdmin || has('users:internal:page');
  const canViewAllUsers = false;
  const canManageStaffUsers = canViewStaffUsers;
  const canCreateMemberUser = isSuperAdmin || has('users:member:create:button');
  const canCreateStaffUser = isSuperAdmin || has('users:staff:create:button');
  const canCreateInternalUser = isSuperAdmin || has('users:internal:create:button');
  const canEditMemberUser = isSuperAdmin || has('users:member:edit:button');
  const canEditStaffUser = isSuperAdmin || has('users:staff:edit:button');
  const canEditInternalUser = isSuperAdmin || has('users:internal:edit:button');
  const canDeleteMemberUser = isSuperAdmin || has('users:member:delete:button');
  const canDeleteStaffUser = isSuperAdmin || has('users:staff:delete:button');
  const canDeleteInternalUser = isSuperAdmin || has('users:internal:delete:button');
  const canAssignStaffRole = isSuperAdmin || has('users:staff:assign-role:button');
  const canAssignInternalRole = isSuperAdmin || has('users:internal:assign-role:button');
  const canResetStaffPassword = isSuperAdmin || has('users:staff:reset-password:button');
  const canResetInternalPassword = isSuperAdmin || has('users:internal:reset-password:button');
  const hasLegacySystemAdmin = has('system:role:page');
  const hasFinanceRecords = has('finance:records:list');
  const canUseOwnStaffWallet = userType === 'STAFF' && isDispatchEligibleStaff;
  const canViewWalletOverview = has('wallet:overview:page') || has('wallet:withdrawals:page') || canUseOwnStaffWallet;

  return {
    // 系统管理
    canViewRoleManagement: has('system:role:page'),
    canViewPermissionManagement: has('system:permission:page'),
    canViewGameProjectManagement: has('system:game-project:page'),
    canViewSystemConfigs: has('system:configs:page') || hasLegacySystemAdmin,
    canViewMiniappHomeConfig: has('miniapp:home:page') || hasLegacySystemAdmin,
    canViewMiniappProtocols: has('miniapp:protocols:page') || hasLegacySystemAdmin,
    canViewAppVersions: has('system:app-versions:page') || hasLegacySystemAdmin,
    canViewAnnouncements: has('system:announcements:page') || hasLegacySystemAdmin,
    canViewQuestionnairesAdmin: has('system:questionnaires:page') || hasLegacySystemAdmin,
    canViewDutyCsSchedules: has('system:duty-cs:page') || hasLegacySystemAdmin,
    canViewNotificationTestPush: has('system:notification-test-push:page') || hasLegacySystemAdmin,
    canViewUserLogs: has('system:user-logs:page') || hasLegacySystemAdmin,
    canViewChestDemo: has('ops:promotion:page') || has('chest:page') || hasLegacySystemAdmin,
    canViewCoupons: has('coupons:page') || has('coupons:user-coupons:list') || hasLegacySystemAdmin,
    canViewPenalties: has('penalties:page') || has('penalties:ticket:create') || hasLegacySystemAdmin,

    // 用户/评级
    canViewUsers: canViewMemberUsers || canViewStaffUsers || canViewInternalUsers || canViewAllUsers,
    canViewMemberUsers,
    canViewStaffUsers,
    canViewInternalUsers,
    canViewAllUsers,
    canViewStaffRatings: has('staff-ratings:page'),
    canSeeAdmin: isSuperAdmin,
    canCreateUser: canCreateMemberUser || canCreateStaffUser || canCreateInternalUser,
    canCreateMemberUser,
    canCreateStaffUser,
    canCreateInternalUser,
    canDeleteUser: canDeleteMemberUser || canDeleteStaffUser || canDeleteInternalUser,
    canDeleteMemberUser,
    canDeleteStaffUser,
    canDeleteInternalUser,
    canEditUser: canEditMemberUser || canEditStaffUser || canEditInternalUser,
    canEditMemberUser,
    canEditStaffUser,
    canEditInternalUser,
    canAssignUserRole: canAssignStaffRole || canAssignInternalRole,
    canAssignStaffRole,
    canAssignInternalRole,
    canManageStaffUsers,
    canViewStaffWalletStats: isSuperAdmin || has('users:staff:wallet-stats:button'),
    canChangeLevel: isSuperAdmin || has('users:staff:change-level:button'),
    canResetPassword: canResetStaffPassword || canResetInternalPassword,
    canResetStaffPassword,
    canResetInternalPassword,
    canStaffExit: isSuperAdmin || has('users:staff:exit:button'),
    canStaffClear: isSuperAdmin || has('users:staff:clear:button'),
    canResetWithdrawQrCode: isSuperAdmin || has('users:staff:withdraw-qr-reset:button'),
    canManualMemberRecharge: isSuperAdmin || has('users:member:recharge:button'),
    canAdjustMemberGrowth: isSuperAdmin || has('users:member:growth-adjust:button'),
    canManageMemberGameCards: isSuperAdmin || has('users:member:game-card:button'),
    canCreateRating: isSuperAdmin,
    canEditRating: isSuperAdmin,
    canDeleteRating: isSuperAdmin,

    // 陪玩中心
    canViewMyOrders: has('staff:my-orders:page') && isDispatchEligibleStaff,
    canViewWorkbench: has('staff:workbench:page') && isDispatchEligibleStaff,
    canViewStaffQuestionnaires: (has('staff:questionnaires:page') || has('staff:workbench:page')) && isDispatchEligibleStaff,

    // 订单/结算
    canViewOrdersList: has('orders:list:page'),
    canViewOrderDetail: has('orders:detail:page'),
    canViewOrderComplaints: has('orders:complaints:page') || has('orders:list:page'),
    canViewSettlementExperience: has('settlements:experience:page'),
    canViewSettlementMonthly: has('settlements:monthly:page'),

    canViewCSWorkbench: has('orders:workbench:page') || has('orders:list:page'),

    canViewWalletOverview,
    canViewWalletMemberLevels: has('wallet:member-levels:page') || has('wallet:withdrawals:page'),
    canViewWalletRechargePlans: has('wallet:recharge-plans:page') || has('wallet:withdrawals:page'),
    canViewWalletTransactions: has('wallet:transactions:page') || has('wallet:withdrawals:page') || canUseOwnStaffWallet,
    canViewWalletReplayPreview: has('wallet:replay-preview:page') || has('wallet:withdrawals:page'),
    canViewWithdrawals: has('wallet:withdrawals:page'),

    // ✅ 业绩数据看板
    canViewPerformanceDashboard: has('performance:dashboard:view'),
    // ✅ 财务核账
    canViewFinanceDashboard: has('finance:dashboard:view'), //财务看板
    canViewFinanceReconcile: hasFinanceRecords, //财务明细
    canViewFinanceOfflineFees: has('finance:offline-fees:page') || hasFinanceRecords,
    canViewFinanceEquipmentRentalFees: has('finance:equipment-rental-fees:page') || hasFinanceRecords,

  };
}





// export default function access(initialState: { currentUser?: any } | undefined) {
//   const { currentUser } = initialState ?? {};
//
//   // 权限配置
//   const isAdmin = currentUser?.userType === 'ADMIN' || currentUser?.userType === 'SUPER_ADMIN';
//   const isSuperAdmin = currentUser?.userType === 'SUPER_ADMIN';
//   const isStaff = currentUser?.userType === 'STAFF';
//   const isFinance = currentUser?.userType === 'FINANCE';
//
//   return {
//     // 页面权限
//     canAccessUserManager: isAdmin || isSuperAdmin,
//     canAccessBillManager: isFinance || isAdmin || isSuperAdmin,
//     canAccessRatingManager: isAdmin || isSuperAdmin,
//     canAccessRechargeManager: isFinance || isAdmin || isSuperAdmin,
//
//     // 用户管理按钮权限
//     canCreateUser: isAdmin || isSuperAdmin,
//     canDeleteUser: isAdmin || isSuperAdmin,
//     canEditUser: isAdmin || isSuperAdmin,
//     canChangeLevel: isAdmin || isSuperAdmin,
//     canResetPassword: isAdmin || isSuperAdmin,
//
//     // 评级管理权限
//     canCreateRating: isAdmin || isSuperAdmin,
//     canEditRating: isAdmin || isSuperAdmin,
//     canDeleteRating: isAdmin || isSuperAdmin,
//
//     // 系统管理权限
//     canAccessSystemSettings: isSuperAdmin,
//
//     // 员工权限
//     canViewOwnBills: isStaff,
//     canUpdateProfile: true,
//   };
// }
