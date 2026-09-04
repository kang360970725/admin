const PROTECTED_ORDER_STATUSES = new Set([
    'ARCHIVED', 'COMPLETED_PENDING_CONFIRM', 'COMPLETED', 'WAIT_REVIEW',
    'REVIEWED', 'WAIT_AFTERSALE', 'AFTERSALE_DONE', 'REFUNDED',
]);

export const canViewProtectedCustomerGameId = (currentUser: any) => {
    if (!currentUser) return false;
    const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
    const userType = String(currentUser?.userType || '').trim().toUpperCase();
    const roleName = String(currentUser?.role?.name || currentUser?.Role?.name || currentUser?.roleName || '').trim();
    const roleCode = String(currentUser?.role?.code || currentUser?.Role?.code || currentUser?.roleCode || currentUser?.roleKey || '').trim().toUpperCase();
    return userType === 'SUPER_ADMIN'
        || userType === 'ADMIN'
        || roleName.toUpperCase() === 'SUPER_ADMIN'
        || roleName.includes('客服主管')
        || ['CS_SUPERVISOR', 'CUSTOMER_SERVICE_SUPERVISOR', 'CS_MANAGER', 'CUSTOMER_SERVICE_MANAGER'].includes(roleCode)
        || permissions.includes('orders:customer-game-id:view');
};

export const shouldMaskCustomerGameId = (status: any, currentUser: any) =>
    PROTECTED_ORDER_STATUSES.has(String(status || '').trim().toUpperCase())
    && !canViewProtectedCustomerGameId(currentUser);

export const maskedCustomerGameId = (status: any, currentUser: any, value: any) => {
    if (value == null || String(value).trim() === '') return '-';
    return shouldMaskCustomerGameId(status, currentUser) ? '******' : String(value);
};
