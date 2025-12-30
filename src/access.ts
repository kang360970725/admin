export default function access(initialState: { currentUser?: API.CurrentUser } | undefined) {
  const { currentUser } = initialState ?? {};

  const permissions = currentUser?.permissions || [];

  const has = (key: string) => permissions.includes(key);

  return {
    // 系统管理
    canViewRoleManagement: has('system:role:page'),
    canViewPermissionManagement: has('system:permission:page'),
    canViewGameProjectManagement: has('system:game-project:page'),

    // 用户/评级
    canViewUsers: has('users:page'),
    canViewStaffRatings: has('staff-ratings:page'),

    // 陪玩中心
    canViewMyOrders: has('staff:my-orders:page'),
    canViewWorkbench: has('staff:workbench:page'),

    // 订单/结算
    canViewOrdersList: has('orders:list:page'),
    canViewOrderDetail: has('orders:detail:page'),
    canViewSettlementExperience: has('settlements:experience:page'),
    canViewSettlementMonthly: has('settlements:monthly:page'),
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
