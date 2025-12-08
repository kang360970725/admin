export default function access(initialState: { currentUser?: API.CurrentUser } | undefined) {
  const { currentUser } = initialState ?? {};

  // 从后端获取的权限列表
  const permissions = currentUser?.permissions || [];

  // 动态权限检查函数
  const hasPermission = (permissionKey: string) => {
    return permissions.includes(permissionKey);
  };

  return {
    // 页面权限
    canAccessUserManager: hasPermission('canAccessUserManager'),
    canAccessBillManager: hasPermission('canAccessBillManager'),
    canAccessRatingManager: hasPermission('canAccessRatingManager'),
    canAccessRechargeManager: hasPermission('canAccessRechargeManager'),
    canAccessRoleManager: hasPermission('canAccessUserManager'), // 角色管理权限同用户管理

    // 用户管理按钮权限
    canCreateUser: hasPermission('canCreateUser'),
    canDeleteUser: hasPermission('canDeleteUser'),
    canEditUser: hasPermission('canEditUser'),
    canChangeLevel: hasPermission('canChangeLevel'),
    canResetPassword: hasPermission('canResetPassword'),

    // 评级管理权限
    canCreateRating: hasPermission('canCreateRating'),
    canEditRating: hasPermission('canEditRating'),
    canDeleteRating: hasPermission('canDeleteRating'),

    // 系统管理权限
    canAccessSystemSettings: hasPermission('canAccessSystemSettings'),

    // 员工权限
    canViewOwnBills: hasPermission('canViewOwnBills'),
    canUpdateProfile: true,
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
