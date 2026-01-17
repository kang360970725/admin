import { request } from '@umijs/max';
import { getApiBase, logEnvInfo } from '@/utils/env';

// 记录环境信息  案件编号 01531465
logEnvInfo();

// 动态获取 API 基础路径
// ✅ 生产环境直连后端域名（来自 config/config.ts 的 define 注入）
const API_BASE =
    process.env.NODE_ENV === 'production'
        ? 'http://api.welax-tech.com'
        : '/api';

export interface User {
    id: number;
    phone: string;
    name?: string;
    email?: string;
    userType: string;
    status: string;
    realName?: string;
    idCard?: string;
    avatar?: string;
    album?: string[];
    rating?: number;
    level: number;
    balance: number;
    needResetPwd: boolean;
    lastLoginAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface PaginationResponse {
    data: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// 认证相关
export async function login(data: { phone: string; password: string }) {
    return request<{ access_token: string; user: User }>(`${API_BASE}/auth/login`, {
        method: 'POST',
        data,
        skipErrorHandler: true,
    });
}

export async function register(data: { phone: string; password: string; name?: string }) {
    return request<{ access_token: string; user: User }>(`${API_BASE}/auth/register`, {
        method: 'POST',
        data,
    });
}

export async function getCurrentUser() {
    return request<User>(`${API_BASE}/auth/me`, {
        method: 'GET',
    });
}

// 用户管理 API
export async function getUsers(params: any): Promise<PaginationResponse> {
    return request<PaginationResponse>(`${API_BASE}/users`, {
        method: 'GET',
        params,
    });
}

export async function getUserById(id: number): Promise<User> {
    return request<User>(`${API_BASE}/users/${id}`, {
        method: 'GET',
    });
}

export async function createUser(data: any): Promise<User> {
    return request<User>(`${API_BASE}/users`, {
        method: 'POST',
        data,
    });
}

export async function updateUser(id: number, data: any): Promise<User> {
    return request<User>(`${API_BASE}/users/${id}`, {
        method: 'PATCH',
        data,
    });
}

export async function deleteUser(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`${API_BASE}/users/${id}`, {
        method: 'DELETE',
    });
}

export async function changeUserLevel(id: number, data: { level: number; remark?: string }): Promise<User> {
    return request<User>(`${API_BASE}/users/${id}/level`, {
        method: 'PATCH',
        data,
    });
}

export async function resetUserPassword(id: number, data?: { remark?: string }): Promise<User & { tempPassword?: string }> {
    return request<User & { tempPassword?: string }>(`${API_BASE}/users/${id}/reset-password`, {
        method: 'POST',
        data,
    });
}
// 员工评级相关API
export async function getStaffRatings(params: any) {
    return request(`${API_BASE}/staff-ratings`, {
        method: 'GET',
        params,
    });
}
// 获取可用的员工评级
export async function getAvailableRatings() {
    return request(`${API_BASE}/users/ratings/available`, {
        method: 'GET',
    });
}

export async function createStaffRating(data: any) {
    return request(`${API_BASE}/staff-ratings`, {
        method: 'POST',
        data,
    });
}

export async function updateStaffRating(id: number, data: any) {
    return request(`${API_BASE}/staff-ratings/${id}`, {
        method: 'PATCH',
        data,
    });
}

export async function deleteStaffRating(id: number) {
    return request(`${API_BASE}/staff-ratings/${id}`, {
        method: 'DELETE',
    });
}

// === 权限管理 API ===
export async function getPermissionTree() {
    return request(`${API_BASE}/permissions/tree`, {
        method: 'GET',
    });
}

export async function createPermission(data: any) {
    return request(`${API_BASE}/permissions`, {
        method: 'POST',
        data,
    });
}

export async function deletePermission(id: number) {
    return request(`${API_BASE}/permissions/${id}`, {
        method: 'DELETE',
    });
}

// === 角色管理 API  ===
export async function getRoles() {
    return request(`${API_BASE}/roles`, {
        method: 'GET',
    });
}

export async function createRole(data: any) {
    return request(`${API_BASE}/roles`, {
        method: 'POST',
        data,
    });
}

export async function updateRole(id: number, data: any) {
    return request(`${API_BASE}/roles/${id}`, {
        method: 'PUT',
        data,
    });
}

export async function deleteRole(id: number) {
    return request(`${API_BASE}/roles/${id}`, {
        method: 'DELETE',
    });
}

// 菜单项目 API
export async function getGameProjects() {
    return request(`${API_BASE}/game-project`);
}

export async function createGameProject(data: any) {
    return request(`${API_BASE}/game-project`, {
        method: 'POST',
        data,
    });
}

export async function updateGameProject(id: number, data: any) {
    return request(`${API_BASE}/game-project/${id}`, {
        method: 'PUT',
        data,
    });
}

export async function deleteGameProject(id: number) {
    return request(`${API_BASE}/game-project/${id}`, {
        method: 'DELETE',
    });
}

// 账单相关 API
export async function getBills(params: any) {
    return request(`${API_BASE}/bills`, {
        method: 'GET',
        params,
    });
}

export async function getBillById(id: number) {
    return request(`${API_BASE}/bills/${id}`);
}

export async function createBill(data: any) {
    return request(`${API_BASE}/bills`, {
        method: 'POST',
        data,
    });
}

export async function updateBill(id: number, data: any) {
    return request(`${API_BASE}/bills/${id}`, {
        method: 'PATCH',
        data,
    });
}

export async function deleteBill(id: number) {
    return request(`${API_BASE}/bills/${id}`, {
        method: 'DELETE',
    });
}

export async function confirmBillSettlement(id: number) {
    return request(`${API_BASE}/bills/${id}/confirm-settlement`, {
        method: 'POST',
    });
}

export async function markBillAsPaid(id: number) {
    return request(`${API_BASE}/bills/${id}/mark-paid`, {
        method: 'POST',
    });
}
// ---------------------- Orders API ----------------------

export async function createOrder(data: any) {
    return request(`${API_BASE}/orders/create`, {
        method: 'POST',
        data,
    });
}

/** 订单列表：POST /orders/list */
export async function getOrders(data: any) {
    return request(`${API_BASE}/orders/list`, {
        method: 'POST',
        data,
    });
}

/** 订单详情：POST /orders/detail */
export async function getOrderDetail(id: number) {
    return request(`${API_BASE}/orders/detail`, {
        method: 'POST',
        data: { id },
    });
}

/** 派单：POST /orders/dispatch */
export async function assignDispatch(orderId: number, data: { playerIds: number[]; remark?: string }) {
    return request(`${API_BASE}/orders/dispatch`, {
        method: 'POST',
        data: { orderId, ...data },
    });
}

/** 接单：POST /orders/dispatch/accept */
export async function acceptDispatch(dispatchId: number, data?: { remark?: string }) {
    return request(`${API_BASE}/orders/dispatch/accept`, {
        method: 'POST',
        data: { dispatchId, ...(data || {}) },
    });
}

/** 存单：POST /orders/dispatch/archive */
export async function archiveDispatch(dispatchId: number, data: any) {
    return request(`${API_BASE}/orders/dispatch/archive`, {
        method: 'POST',
        data: { dispatchId, ...data },
    });
}

/** 结单：POST /orders/dispatch/complete */
export async function completeDispatch(dispatchId: number, data: any) {
    return request(`${API_BASE}/orders/dispatch/complete`, {
        method: 'POST',
        data: { dispatchId, ...data },
    });
}

/** 我的接单记录：POST /orders/my-dispatches */
// export async function getMyDispatches(data: any) {
//     return request(`${API_BASE}/orders/my-dispatches`, {
//         method: 'POST',
//         data,
//     });
// }
// 项目下拉（支持 keyword）
export async function getGameProjectOptions(data: { keyword?: string }) {
    return request(`${API_BASE}/game-project/options`, {
        method: 'POST',
        data,
    });
}

// 空闲打手下拉（支持 keyword；默认 onlyIdle=true）
export async function getPlayerOptions(data: { keyword?: string; onlyIdle?: boolean }) {
    return request(`${API_BASE}/users/players/options`, {
        method: 'POST',
        data,
    });
}

// ---- meta ----
export async function getEnumDicts() {
    return request(`${API_BASE}/meta/enums`, { method: 'POST' });
}

// ---- orders ----
export async function updateOrderPaidAmount(data: { id: number; paidAmount: number; remark?: string ; confirmPaid?: Boolean }) {
    return request(`${API_BASE}/orders/update-paid-amount`, {
        method: 'POST',
        data,
    });
}

export async function updateDispatchParticipants(data: {
    dispatchId: number;
    playerIds: number[];
    remark?: string;
}) {
    return request(`${API_BASE}/orders/dispatch/update-participants`, {
        method: 'POST',
        data,
    });
}

export async function markOrderPaid(data: { id: number; paidAmount?: number; remark?: string; confirmPaid?: boolean }) {
    return request(`${API_BASE}/orders/mark-paid`, {
        method: 'POST',
        data,
    });
}


// ---------------------- Settlement Batch API (POST style) ----------------------

/** 批次结算查询：POST /settlements/batches */
export async function querySettlementBatch(data: any) {
    return request(`${API_BASE}/settlements/batches`, {
        method: 'POST',
        data,
    });
}

/** 标记打款：POST /settlements/mark-paid */
export async function markSettlementsPaid(data: { settlementIds: number[]; remark?: string }) {
    return request(`${API_BASE}/settlements/mark-paid`, {
        method: 'POST',
        data,
    });
}
// 我的接单记录（陪玩端）
export async function getMyDispatches(data: { page?: number; limit?: number; status?: string,mode?: string }) {
    return request(`${API_BASE}/orders/my-dispatches`, {
        method: 'POST',
        data,
    });
}

/** 陪玩接单相关*/
export async function acceptDispatchAsStaff(data: { dispatchId: number; remark?: string }) {
    return request(`${API_BASE}/orders/dispatch/accept`, { method: 'POST', data });
}

export async function archiveDispatchAsStaff(data: {
    dispatchId: number;
    deductMinutesOption?: string;
    remark?: string;
    progresses?: Array<{ userId: number; progressBaseWan?: number }>;
}) {
    return request(`${API_BASE}/orders/dispatch/archive`, { method: 'POST', data });
}

export async function completeDispatchAsStaff(data: {
    dispatchId: number;
    deductMinutesOption?: string;
    remark?: string;
    progresses?: Array<{ userId: number; progressBaseWan?: number }>;
}) {
    return request(`${API_BASE}/orders/dispatch/complete`, { method: 'POST', data });
}

//  手动修改陪玩收益
export async function adjustSettlementFinalEarnings(data: { settlementId: number; finalEarnings: number; remark?: string }) {
    return request(`${API_BASE}/orders/settlements/adjust`, {
        method: 'POST',
        data,
    });
}

// 订单退款
export async function refundOrder(data: { id: number; remark?: string }) {
    return request(`${API_BASE}/orders/refund`, { method: 'POST', data });
}

// 更新订单
export async function updateOrder(data: any) {
    return request(`${API_BASE}/orders/update`, { method: 'POST', data });
}

//
export async function dispatchRejectOrder(data: any) {
    return request(`${API_BASE}/orders/dispatch/reject`, { method: 'POST', data });
}

// 打手修改状态
export async function usersWorkStatus(data: any) {
    return request(`${API_BASE}/users/work-status`, { method: 'POST', data });
}
// 获取收入统计
export async function ordersMyStats(data: any) {
    return request(`${API_BASE}/orders/my/stats`, { method: 'POST', data });
}
//修改密码
export async function updateMyPassword(body: { newPassword: string }) {
    return request(`${API_BASE}/users/me/password`, {
        method: 'POST',
        data: body,
    });
}


// ---------------------- Wallet API ----------------------

export interface WalletAccount {
    id: number;
    userId: number;
    availableBalance: number;
    frozenBalance: number;
    createdAt: string;
    updatedAt: string;
}

export interface WalletTransaction {
    id: number;
    userId: number;
    direction: 'IN' | 'OUT';
    bizType: string;
    amount: number;
    status: string;
    sourceType?: string | null;
    sourceId?: number | null;
    orderId?: number | null;
    dispatchId?: number | null;
    settlementId?: number | null;
    reversalOfTxId?: number | null;
    createdAt: string;
}

export interface WalletHold {
    id: number;
    userId: number;
    earningTxId: number;
    amount: number;
    status: string; // FROZEN/RELEASED/CANCELLED...
    unlockAt: string;
    createdAt: string;
    releasedAt?: string | null;
}

export async function getWalletAccount() {
    return request<WalletAccount>(`${API_BASE}/wallet/account`, {
        method: 'GET',
    });
}

export async function getWalletTransactions(params: {
    page?: number;
    limit?: number;
    status?: string;
    bizType?: string;
    direction?: 'IN' | 'OUT';
    orderId?: number;
    dispatchId?: number;
    startAt?: string; // ISO
    endAt?: string;   // ISO
}) {
    return request<{ data: WalletTransaction[]; total: number; page: number; limit: number }>(
        `${API_BASE}/wallet/transactions`,
        { method: 'GET', params },
    );
}

export async function getWalletHolds(params: {
    page?: number;
    limit?: number;
    status?: string;
}) {
    return request<{ data: WalletHold[]; total: number; page: number; limit: number }>(
        `${API_BASE}/wallet/holds`,
        { method: 'GET', params },
    );
}

// ---------------------- Dashboard API ----------------------

export interface RevenueOverviewRes {
    range: { startAt: string; endAt: string };

    totalOrders: number;
    totalRevenue: number;

    refundedOrders: number;
    refundedAmount: number;

    costEstimated: number;
    profitEstimated: number;
    profitRate: number; // 百分比数值，例如 12.34
    giftedCost: number;
}

export async function getRevenueOverview(params?: { startAt?: string; endAt?: string }) {
    return request<RevenueOverviewRes>(`${API_BASE}/dashboard/revenue/overview`, {
        method: 'GET',
        params,
    });
}

// ---------------------- Withdrawal (提现) API ----------------------

/**
 * 提现申请单（管理端/审批端都会用到）
 * - 注意：这里的字段与后端 WalletWithdrawalRequest 对齐
 * - 你后续接微信自动打款，会增加 outTradeNo/channelTradeNo 等字段（这里先预留可选）
 */
export interface WalletWithdrawalRequest {
    id: number;
    userId: number;
    amount: number;
    status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAYING' | 'PAID' | 'FAILED' | 'CANCELED';
    channel: 'WECHAT' | 'MANUAL';
    idempotencyKey: string;
    requestNo: string;
    remark?: string | null;

    reviewedBy?: number | null;
    reviewedAt?: string | null;
    reviewRemark?: string | null;

    reserveTxId: number;
    payoutTxId?: number | null;

    outTradeNo?: string | null;
    channelTradeNo?: string | null;
    callbackRaw?: string | null;
    failReason?: string | null;

    createdAt: string;
    updatedAt: string;
}

/**
 * ✅ 管理端：待审核列表
 * GET /wallet/withdrawals/pending
 */
export async function getPendingWithdrawals() {
    return request<WalletWithdrawalRequest[]>(`${API_BASE}/wallet/withdrawals/pending`, {
        method: 'GET',
    });
}

/**
 * ✅ 管理端：审批
 * POST /wallet/withdrawals/review
 *
 * reviewerId：审批人（从 currentUser.id 取）
 * approve：true=通过；false=驳回
 * reviewRemark：审批备注（可选）
 */
export async function reviewWithdrawal(data: {
    requestId: number;
    reviewerId: number;
    approve: boolean;
    reviewRemark?: string;
}) {
    return request<WalletWithdrawalRequest>(`${API_BASE}/wallet/withdrawals/review`, {
        method: 'POST',
        data,
    });
}

// ---------------------- Withdrawal (提现) API - 扩展：list/mine/apply ----------------------

/**
 * ✅ 管理端：全量记录（分页+筛选）
 * POST /wallet/withdrawals/list
 */
export async function postWithdrawalsList(data: {
    page: number;
    pageSize: number;
    status?: string;
    channel?: string;
    userId?: number;
    requestNo?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
}) {
    return request<{ total: number; list: WalletWithdrawalRequest[]; page: number; pageSize: number }>(
        `${API_BASE}/wallet/withdrawals/list`,
        { method: 'POST', data },
    );
}

/**
 * ✅ 我的提现记录
 * GET /wallet/withdrawals/mine
 *
 * ⚠️ 你后端目前用 GET + Body（不标准），这里为了兼容，仍用 GET 但带 data
 * 如果你后端后续改为 query 参数，这里再同步
 */
export async function getMyWithdrawals(userId: number) {
    return request<WalletWithdrawalRequest[]>(`${API_BASE}/wallet/withdrawals/mine`, {
        method: 'GET',
        data: { userId },
    });
}

/**
 * ✅ 申请提现
 * POST /wallet/withdrawals/apply
 *
 * idempotencyKey：前端生成 uuid，防止重复提交
 */
export async function applyWithdrawal(data: {
    userId: number;
    amount: number;
    idempotencyKey: string;
    remark?: string;
    channel?: string | 'MANUAL' | 'WECHAT';
}) {
    return request<WalletWithdrawalRequest>(`${API_BASE}/wallet/withdrawals/apply`, {
        method: 'POST',
        data,
    });
}

