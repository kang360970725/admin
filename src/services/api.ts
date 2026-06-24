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

export function getRealtimeStreamUrl(token: string) {
    const safeToken = encodeURIComponent(String(token || '').trim());
    return `${API_BASE}/notifications/my/realtime/stream?token=${safeToken}`;
}

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
    staffRating?: {
        id?: number;
        name?: string;
        scope?: 'BOTH' | 'ONLINE' | 'OFFLINE' | string;
        rate?: number;
    } | null;
    level: number;
    balance: number;
    needResetPwd: boolean;
    withdrawQrCodeKey?: string | null;
    withdrawQrCodeUploadedAt?: string | null;
    lastLoginAt?: string;
    createdAt: string;
    updatedAt: string;
    depositLimit: string;
    staffTags?: string[];
    matchedDepositAmount?: number;
    matchedFirstWithdrawMinBalance?: number;
    matchedQuitCoolingDays?: number;
    matchedDepositForfeitDays?: number;
    matchedStaffRule?: StaffRuleItem | null;
    walletAccount?: {
        walletUid?: string;
        availableBalance?: number;
        frozenBalance?: number;
        depositBalance?: number;
    };
    workMode?: 'ONLINE' | 'OFFLINE';
    offlineJoinedAt?: string | null;
    staffEmploymentStatus?: 'ACTIVE' | 'FROZEN' | 'EXITED' | 'BLACKLISTED';
    staffCooldownUntil?: string | null;
    staffExitedAt?: string | null;
    memberProfile?: {
        memberCode?: string;
        levelCode?: string;
        totalRechargeAmount?: number | string;
        totalConsumeAmount?: number | string;
        annualContribution?: number;
        lastRechargeAt?: string | null;
    };
    memberPointAccount?: {
        availablePoints?: number;
        totalEarnedPoints?: number;
        totalSpentPoints?: number;
    };
    wechatBindings?: Array<{
        id: number;
        platform: string;
        appId: string;
        openId: string;
        unionId?: string | null;
        lastBindAt?: string | null;
        lastLoginAt?: string | null;
    }>;
    reviewStats?: {
        averageScore?: number | null;
        reviewCount?: number;
    };
    recentReviews?: Array<{
        orderId?: number;
        score?: number;
        ratingLabel?: string;
        reviewRemark?: string;
        createdAt?: string;
        evaluatorName?: string;
    }>;
    memberGameCards?: MemberGameCard[];
}

export interface StaffRuleTag {
    code: string;
    name: string;
    enabled?: boolean;
    sort?: number;
}

export interface StaffRuleItem {
    id: string;
    name: string;
    enabled?: boolean;
    priority?: number;
    tagCodes: string[];
    depositAmount: number;
    firstWithdrawMinBalance: number;
    quitCoolingDays: number;
    depositForfeitDays: number;
    refundWhenDepositInsufficient?: boolean;
}

export interface StaffRuleEngineConfig {
    tags: StaffRuleTag[];
    rules: StaffRuleItem[];
}

export interface StaffExitPreview {
    userId: number;
    staffTags: string[];
    matchedStaffRule?: StaffRuleItem | null;
    joinedAt?: string;
    inShopDays: number;
    quitCoolingDays: number;
    depositForfeitDays: number;
    isDepositForfeit: boolean;
    availableBalance: number;
    frozenBalance: number;
    depositBalance: number;
    refundDepositAmount: number;
    forfeitDepositAmount: number;
    releaseAmount: number;
    clearAmount: number;
    depositAmountRule: number;
    firstWithdrawMinBalance: number;
    refundWhenDepositInsufficient: boolean;
    blacklistAllowed: boolean;
    suggestedExitMode: 'RELEASE_TO_AVAILABLE' | 'CLEAR_ALL';
}

export interface MemberGameCard {
    id: number;
    gameCategoryId: string;
    gameCategoryName: string;
    gameUniqueId: string;
    gameNickname?: string;
    isPrimary: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface MemberGameCardListResponse {
    categories: Array<{
        id: string;
        name: string;
    }>;
    cards: MemberGameCard[];
    rules?: {
        maxCardsPerGame?: number;
        allowEdit?: boolean;
        allowDelete?: boolean;
    };
}

export interface GetUsersParams {
    page?: number;
    limit?: number;
    search?: string;
    userType?: string;
    status?: string;
    scene?: string;
    anonymousOnly?: boolean | string;
    includeStaffMembers?: boolean | string;
    loginInactiveDays?: number;
    acceptInactiveDays?: number;
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
export async function getUsers(params: GetUsersParams): Promise<PaginationResponse> {
    return request<PaginationResponse>(`${API_BASE}/users`, {
        method: 'GET',
        params,
    });
}

export async function getMemberRechargePlans() {
    return request(`${API_BASE}/member/recharge-plans`, {
        method: 'GET',
    });
}

export async function getMemberLevelConfigs() {
    return request(`${API_BASE}/member/levels`, {
        method: 'GET',
    });
}

export async function createMemberLevelConfig(data: any) {
    return request(`${API_BASE}/member/levels`, {
        method: 'POST',
        data,
    });
}

export async function updateMemberLevelConfig(id: number, data: any) {
    return request(`${API_BASE}/member/levels/${id}`, {
        method: 'PATCH',
        data,
    });
}

export async function refreshMemberLevels() {
    return request(`${API_BASE}/member/levels/refresh`, {
        method: 'POST',
    });
}

export async function createMemberRechargePlan(data: any) {
    return request(`${API_BASE}/member/recharge-plans`, {
        method: 'POST',
        data,
    });
}

export async function updateMemberRechargePlan(id: number, data: any) {
    return request(`${API_BASE}/member/recharge-plans/${id}`, {
        method: 'PATCH',
        data,
    });
}

export async function adjustMemberPoints(data: { userId: number; points: number; remark?: string }) {
    return request(`${API_BASE}/member/points/adjust`, {
        method: 'POST',
        data,
    });
}

export async function adjustMemberGrowth(data: { userId: number; growthValue: number; remark?: string }) {
    return request(`${API_BASE}/member/growth/adjust`, {
        method: 'POST',
        data,
    });
}

export async function manualMemberRecharge(data: {
    userId: number;
    planId?: number;
    amount?: number;
    bonusAmount?: number;
    giftPoints?: number;
    giftGrowthValue?: number;
    couponBenefits?: Array<{ templateId: number; count: number }>;
    remark?: string;
}) {
    return request(`${API_BASE}/member/recharge/manual`, {
        method: 'POST',
        data,
    });
}

export async function getUserById(id: number): Promise<User> {
    return request<User>(`${API_BASE}/users/${id}`, {
        method: 'GET',
    });
}

export async function getUserMemberGameCards(id: number): Promise<MemberGameCardListResponse> {
    return request<MemberGameCardListResponse>(`${API_BASE}/users/${id}/member-game-cards`, {
        method: 'GET',
    });
}

export async function createUserMemberGameCard(
    id: number,
    data: { gameCategoryId: string; gameUniqueId: string; gameNickname?: string; isPrimary?: boolean },
): Promise<MemberGameCard> {
    return request<MemberGameCard>(`${API_BASE}/users/${id}/member-game-cards`, {
        method: 'POST',
        data,
    });
}

export async function setUserMemberGameCardPrimary(id: number, cardId: number): Promise<MemberGameCard> {
    return request<MemberGameCard>(`${API_BASE}/users/${id}/member-game-cards/${cardId}/set-primary`, {
        method: 'POST',
    });
}

export async function deleteUserMemberGameCard(id: number, cardId: number): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`${API_BASE}/users/${id}/member-game-cards/${cardId}`, {
        method: 'DELETE',
    });
}

export async function exitStaffShop(
    id: number,
    data: { mode: 'RELEASE_TO_AVAILABLE' | 'CLEAR_ALL'; addToBlacklist?: boolean },
) {
    return request(`${API_BASE}/users/${id}/staff-exit`, {
        method: 'POST',
        data,
    });
}

export async function getStaffExitPreview(id: number) {
    return request<StaffExitPreview>(`${API_BASE}/users/${id}/staff-exit-preview`, {
        method: 'POST',
    });
}

export async function clearStaffAssets(id: number, data: { addToBlacklist?: boolean; remark: string }) {
    return request(`${API_BASE}/users/${id}/staff-clear`, {
        method: 'POST',
        data,
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

export async function resetUserWithdrawQrCode(id: number, data?: { remark?: string }): Promise<User> {
    return request<User>(`${API_BASE}/users/${id}/withdraw-qr-code/reset`, {
        method: 'POST',
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

export async function getGameProjectList(data: {
    page?: number;
    limit?: number;
    keyword?: string;
    gameType?: string;
    category?: string;
    status?: string;
}) {
    return request<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>(`${API_BASE}/game-project/list`, {
        method: 'POST',
        data,
    });
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

export async function getGameProjectRatingSummary(id: number) {
    return request<{ projectId: number; ratingAvg: number; ratingCount: number }>(`${API_BASE}/game-project/${id}/rating-summary`, {
        method: 'GET',
    });
}

export async function listGameProjectReviews(
    id: number,
    data: { page?: number; limit?: number; includeHidden?: boolean },
) {
    return request<{
        data: Array<{
            id: number;
            score: number;
            tags?: unknown;
            content?: string;
            anonymous?: boolean;
            isHidden: boolean;
            hiddenReason?: string | null;
            hiddenAt?: string | null;
            createdAt: string;
            orderId: number;
            user?: { id: number; name?: string | null; phone?: string | null } | null;
        }>;
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>(`${API_BASE}/game-project/${id}/reviews/list`, {
        method: 'POST',
        data,
    });
}

export async function hideGameProjectReview(reviewId: number, data: { hidden: boolean; reason?: string }) {
    return request(`${API_BASE}/game-project/reviews/${reviewId}/hide`, {
        method: 'POST',
        data,
    });
}

export async function getUploadInfo(data: { module: string; filename?: string; scene?: string }) {
    return request<{
        mode: 'signature';
        module: string;
        scene: string;
        cloudPath: string;
        bucket: string;
        region: string;
        uploadUrl: string;
        fileUrl: string;
        authorization: string;
        expiredTime: number;
    }>(`${API_BASE}/uploads/info`, {
        method: 'POST',
        data,
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

export async function getOrderSourceOptions() {
    return request(`${API_BASE}/orders/source-options`, {
        method: 'POST',
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

export async function adminAcceptDispatch(dispatchId: number, data?: { remark?: string }) {
    return request(`${API_BASE}/orders/dispatch/admin-accept`, {
        method: 'POST',
        data: { dispatchId, ...(data || {}) },
    });
}

export async function rollbackDispatchToAccepted(dispatchId: number, data?: { remark?: string }) {
    return request(`${API_BASE}/orders/dispatch/rollback-to-accepted`, {
        method: 'POST',
        data: { dispatchId, ...(data || {}) },
    });
}

export async function rollbackDispatchToArchived(dispatchId: number, data?: { remark?: string }) {
    return request(`${API_BASE}/orders/dispatch/rollback-to-archived`, {
        method: 'POST',
        data: { dispatchId, ...(data || {}) },
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

export interface PublicMenuItem {
    id: number;
    name: string;
    price: number;
    originPrice?: number | null;
    type: string;
    billingMode: string;
    baseAmount?: number | null;
    clubRate?: number | null;
    coverImage?: string | null;
    description?: string | null;
    gameType?: string | null;
    projectType?: string | null;
    category?: string | null;
    showInMenuList?: boolean | null;
    gameTypeId?: string | null;
    categoryId?: string | null;
    gameTypeName?: string | null;
    categoryName?: string | null;
    projectTypeNames?: string[] | null;
}

export interface PublicMenuDetail extends PublicMenuItem {
    richContent?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export async function postPublicMenuList(data: {
    keyword?: string;
    gameType?: string;
    projectType?: string;
    category?: string;
    page?: number;
    limit?: number;
}) {
    return request<{
        list: PublicMenuItem[];
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
        hasMore?: boolean;
        filters: {
            gameTypes: string[];
            projectTypes: string[];
            categories: string[];
            gameTypeOptions?: Array<{ key: string; label: string }>;
            categoryOptions?: Array<{ key: string; label: string }>;
        };
    }>(`${API_BASE}/game-project/public/menu/list`, {
        method: 'POST',
        data,
        skipErrorHandler: true,
    });
}

export async function getPublicMenuDetail(id: number) {
    return request<PublicMenuDetail>(`${API_BASE}/game-project/public/menu/${id}`, {
        method: 'GET',
        skipErrorHandler: true,
    });
}

export async function getPublicMiniappHomeConfig() {
    return request<MiniappHomeConfig>(`${API_BASE}/mini/home/config`, {
        method: 'GET',
        skipErrorHandler: true,
    });
}

// 空闲打手下拉（支持 keyword；默认 onlyIdle=true）
export async function getPlayerOptions(data: { keyword?: string; onlyIdle?: boolean; limit?: number; onlyOnline?: boolean; paginate?: boolean; page?: number }) {
    return request(`${API_BASE}/users/players/options`, {
        method: 'POST',
        data,
    });
}

export async function updatePlayerWorkMode(id: number, data: { workMode: 'ONLINE' | 'OFFLINE' }) {
    return request(`${API_BASE}/users/players/${id}/work-mode`, {
        method: 'PATCH',
        data,
    });
}

// ---------------------- Coupons API ----------------------

export async function getCouponTemplates(data: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    keyword?: string;
}) {
    return request(`${API_BASE}/coupons/templates/list`, {
        method: 'POST',
        data,
    });
}

export async function createCouponTemplate(data: any) {
    return request(`${API_BASE}/coupons/templates/create`, {
        method: 'POST',
        data,
    });
}

export async function updateCouponTemplateStatus(data: { id: number; status: string }) {
    return request(`${API_BASE}/coupons/templates/update-status`, {
        method: 'POST',
        data,
    });
}

export async function grantUserCoupon(data: {
    userId?: number;
    userIds?: number[];
    templateId: number;
    count?: number;
    expiresAt?: string;
}) {
    return request(`${API_BASE}/coupons/grant`, {
        method: 'POST',
        data,
    });
}

export async function getUserCoupons(data: {
    page?: number;
    limit?: number;
    userId?: number;
    templateId?: number;
    keyword?: string;
    status?: string;
    orderId?: number;
}) {
    return request(`${API_BASE}/coupons/user-coupons/list`, {
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
// export async function refundOrder(data: { id: number; remark?: string }) {
//     return request(`${API_BASE}/orders/refund`, { method: 'POST', data });
// }
/**
 * ✅ 退款（兼容两种调用方式）
 * - refundOrder({ id, remark })
 * - refundOrder(id, { remark })
 *
 * 后端路由：POST /orders/refund
 */
export async function refundOrder(
    idOrDto:
        | number
        | {
              id: number;
              remark?: string;
              staffLiable?: boolean;
              liableUserIds?: number[];
              hasCompensation?: boolean;
              compensationAmount?: number;
          },
    payload?: {
        remark?: string;
        staffLiable?: boolean;
        liableUserIds?: number[];
        hasCompensation?: boolean;
        compensationAmount?: number;
    },
) {
    // 兼容：refundOrder(orderId, { remark })
    if (typeof idOrDto === 'number') {
        const id = Number(idOrDto);
        return request(`${API_BASE}/orders/refund`, {
            method: 'POST',
            data: {
                id,
                remark: payload?.remark,
                staffLiable: payload?.staffLiable,
                liableUserIds: payload?.liableUserIds,
                hasCompensation: payload?.hasCompensation,
                compensationAmount: payload?.compensationAmount,
            },
        });
    }

    // 兼容：refundOrder({ id, remark })
    return request(`${API_BASE}/orders/refund`, {
        method: 'POST',
        data: {
            id: Number(idOrDto.id),
            remark: idOrDto.remark,
            staffLiable: idOrDto.staffLiable,
            liableUserIds: idOrDto.liableUserIds,
            hasCompensation: idOrDto.hasCompensation,
            compensationAmount: idOrDto.compensationAmount,
        },
    });
}


// 更新订单
export async function updateOrder(data: any) {
    return request(`${API_BASE}/orders/update`, { method: 'POST', data });
}

export async function deleteOrder(data: { id: number; remark?: string }) {
    return request(`${API_BASE}/orders/delete`, { method: 'POST', data });
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
}|any ) {
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

export interface WalletReplayPreview {
    userId: number;
    mode: 'legacy' | 'full';
    range: { startAt: string | null; endAt: string | null };
    openingBalance: { available: number; frozen: number; total: number };
    currentBalance: { available: number; frozen: number; total: number };
    replayBalance: { available: number; frozen: number; total: number };
    diff: { available: number; frozen: number; total: number };
    settlementSummary: {
        replayTotal: number;
        historyTotal: number;
        diff: number;
        signRule: string;
    };
    withdrawalSummary: {
        replayTotal: number;
        historyTotal: number;
        diff: number;
        signRule: string;
    };
    stats: {
        txCount: number;
        ignoredCount: number;
        mismatchCount: number;
        negativeMoments: number;
        ignoredBizBreakdown: Record<string, number>;
        bizBreakdown: Record<string, number>;
        noBalanceBizTypes: string[];
    };
    mismatchRows: Array<{
        id: number;
        createdAt: string;
        bizType: string;
        status: string;
        direction: 'IN' | 'OUT';
        amount: number;
        sourceType?: string | null;
        sourceId?: number | null;
        orderId?: number | null;
        settlementId?: number | null;
        dispatchId?: number | null;
        storedAvailableAfter: number;
        storedFrozenAfter: number;
        replayAvailableAfter: number;
        replayFrozenAfter: number;
        deltaAvailable: number;
        deltaFrozen: number;
    }>;
    negativeRows: Array<{
        id: number;
        createdAt: string;
        bizType: string;
        status: string;
        direction: 'IN' | 'OUT';
        amount: number;
        sourceType?: string | null;
        sourceId?: number | null;
        orderId?: number | null;
        settlementId?: number | null;
        dispatchId?: number | null;
        replayAvailableAfter: number;
        replayFrozenAfter: number;
    }>;
}

export async function getWalletReplayPreview(params: {
    userId: number;
    startAt?: string;
    endAt?: string;
    limitMismatches?: number;
    mode?: 'legacy' | 'full';
}) {
    return request<WalletReplayPreview>(`${API_BASE}/wallet/replay-preview`, {
        method: 'GET',
        params,
    });
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

export interface FinanceDailySourceItem {
    source: string;
    label: string;
    orderCount: number;
    receivableAmount: number;
    paidAmount: number;
    settlementBaseAmount?: number;
    grossProfitAmount?: number;
}

export interface FinanceDailyOverviewRow {
    axis: string;
    orderCount: number;
    receivableAmountTotal: number;
    paidAmountTotal: number;
    settlementBaseAmountTotal?: number;
    grossProfitAmountTotal: number;
    orderTotalCost?: number;
    sourceItems?: FinanceDailySourceItem[];
}

export interface FinanceDailyOverviewRes {
    range: { startDate?: string; endDate?: string };
    rows: FinanceDailyOverviewRow[];
    summary?: {
        orderCount: number;
        receivableAmountTotal: number;
        paidAmountTotal: number;
        settlementBaseAmountTotal?: number;
        grossProfitAmountTotal: number;
    };
}

export async function postFinanceDailyOverview(data: { startDate?: string; endDate?: string }) {
    return request<FinanceDailyOverviewRes>(`${API_BASE}/finance/dashboard/daily-overview`, {
        method: 'POST',
        data,
    });
}

export interface FinanceReconciliationDetailRow {
    orderId: number;
    autoSerial: string;
    paymentTime: string;
    paidAmount: number;
    dispatcherLabel: string;
    dispatcherUserType: string;
    orderSource: string;
    orderSourceLabel: string;
}

export interface FinanceReconciliationDispatcherRow {
    dispatcherId: number | null;
    dispatcherName: string;
    dispatcherUserType: string;
    dispatcherLabel: string;
    orderCount: number;
    paidAmountTotal: number;
}

export interface FinanceReconciliationDayRow {
    axis: string;
    allOrderCount: number;
    allPaidAmountTotal: number;
    manualReceiptOrderCount: number;
    manualReceiptAmountTotal: number;
    dispatcherItems: FinanceReconciliationDispatcherRow[];
    detailRows: FinanceReconciliationDetailRow[];
}

export interface FinanceReconciliationRes {
    range: { startDate?: string; endDate?: string };
    summary: {
        allOrderCount: number;
        allPaidAmountTotal: number;
        manualReceiptOrderCount: number;
        manualReceiptAmountTotal: number;
    };
    rows: FinanceReconciliationDayRow[];
}

export async function postFinanceReconciliation(data: { startDate?: string; endDate?: string }) {
    return request<FinanceReconciliationRes>(`${API_BASE}/finance/dashboard/reconciliation`, {
        method: 'POST',
        data,
    });
}

export interface OrderShiftOverviewRes {
    date: string;
    currentDispatcherOrderCount: number;
    currentDispatcherPaidAmount: number;
    currentDispatcherSourceItems?: FinanceDailySourceItem[];
    otherCsOrderCount: number;
    otherCsPaidAmount: number;
    otherCsSourceItems?: FinanceDailySourceItem[];
    totalOrderCount: number;
    totalReceivableAmount: number;
    totalPaidAmount: number;
    wechatRealTimeAmount: number;
}

export async function postOrderShiftOverview(data: {
    date: string;
    dispatcherId?: number;
    currentOrderId?: number;
}) {
    return request<OrderShiftOverviewRes>(`${API_BASE}/finance/dashboard/shift-overview`, {
        method: 'POST',
        data,
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
    reviewTime?: string | null;
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

export interface WithdrawalReconcileUserRow {
    userId: number;
    name?: string | null;
    realName?: string | null;
    phone?: string | null;
    approvedAmount: number;
    approvedCount: number;
    paidAmount: number;
    paidCount: number;
    transferGap: number;
}

export async function postWithdrawalsReconcileSummary(data: {
    status?: string;
    channel?: string;
    userId?: number;
    requestNo?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
}) {
    return request<{
        range: { reviewedAtFrom?: string | null; reviewedAtTo?: string | null };
        total: {
            approvedAmount: number;
            approvedCount: number;
            paidAmount: number;
            paidCount: number;
            transferGap: number;
            userCount: number;
        };
        byUser: WithdrawalReconcileUserRow[];
    }>(`${API_BASE}/wallet/withdrawals/reconcile-summary`, {
        method: 'POST',
        data,
    });
}

/**
 * ✅ 我的提现记录
 * GET /wallet/withdrawals/mine
 *
 * ⚠️ 你后端目前用 GET + Body（不标准），这里为了兼容，仍用 GET 但带 data
 * 如果你后端后续改为 query 参数，这里再同步
 */
export async function getMyWithdrawals(userId?: number | { userId?: number }) {
    const parsedUserId =
        typeof userId === 'number' ? userId : Number((userId as any)?.userId || 0);
    return request<WalletWithdrawalRequest[]>(`${API_BASE}/wallet/withdrawals/mine`, {
        method: 'GET',
        data: parsedUserId ? { userId: parsedUserId } : undefined,
    });
}

/**
 * 获取提现信息（押金余额 + 阈值）
 */
export async function getWithdrawInfo() {
    return request<{
        availableBalance: number;
        depositBalance: number;
        depositLimit: number;
        firstWithdrawMinBalance: number;
        matchedStaffRule?: StaffRuleItem | null;
        workMode?: 'ONLINE' | 'OFFLINE';
    }>(`${API_BASE}/wallet/withdrawals/withdraw-info`, {
        method: 'GET',
    });
}

/**
 * 获取提现前线下费用校验信息
 */
export async function getOfflineFeeGuardInfo() {
    return request<{
        hasOutstanding: boolean;
        partialMinPay: number;
        bill: any | null;
        availableBalance: number;
        frozenBalance: number;
        walletTotal: number;
        canPartialPayByWalletRule: boolean;
    }>(`${API_BASE}/offline-fees/withdrawal/guard-info`, {
        method: 'POST',
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
    payOfflineFeeAmount?: number;
}) {
    return request<WalletWithdrawalRequest>(`${API_BASE}/wallet/withdrawals/apply`, {
        method: 'POST',
        data,
    });
}

// ---------------------- System Config API ----------------------

export interface SystemConfigItem {
    id: number;
    key: string;
    value: string;
    valueType: 'NUMBER' | 'STRING' | 'BOOLEAN' | 'JSON';
    remark?: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export async function getStaffRuleEngineConfig() {
    return request<StaffRuleEngineConfig>(`${API_BASE}/system-configs/staff-rule-engine/get`, {
        method: 'POST',
        data: {},
    });
}

export async function upsertStaffRuleEngineConfig(config: StaffRuleEngineConfig) {
    return request<SystemConfigItem>(`${API_BASE}/system-configs/staff-rule-engine/upsert`, {
        method: 'POST',
        data: { config },
    });
}

export interface AppVersionRecord {
    id: number;
    version: string;
    buildId: string;
    releasedAt: string;
    forceRefresh: boolean;
    title: string;
    notes: string[];
    enabled: boolean;
    createdAt: string;
    createdBy?: number | null;
}

export async function listSystemConfigs() {
    return request<SystemConfigItem[]>(`${API_BASE}/system-configs/list`, {
        method: 'POST',
        data: {},
    });
}

export async function upsertSystemConfig(data: {
    key: string;
    value: string;
    valueType?: 'NUMBER' | 'STRING' | 'BOOLEAN' | 'JSON';
    remark?: string;
    enabled?: boolean;
}) {
    return request<SystemConfigItem>(`${API_BASE}/system-configs/upsert`, {
        method: 'POST',
        data,
    });
}

export type MiniappHomeConfig = {
    banners: any[];
    hotSales: any[];
    limitedBenefits: any[];
    recommendedStaff: any[];
    hotEvents: any[];
    quickEntries: any[];
    esportsGoods: any[];
};

export interface MiniappProtocolItem {
    id: number;
    categoryId: number;
    category?: {
        id: number;
        name: string;
        description?: string;
        sort: number;
        enabled: boolean;
    } | null;
    key: string;
    title: string;
    coverImage?: string;
    content: string;
    enabled: boolean;
    remark?: string;
    sort: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface MiniappProtocolCategoryItem {
    id: number;
    name: string;
    description?: string;
    sort: number;
    enabled: boolean;
    protocolCount?: number;
    createdAt?: string;
    updatedAt?: string;
}

export async function getMiniappHomeConfig() {
    return request<MiniappHomeConfig>(`${API_BASE}/system-configs/miniapp/home-config/get`, {
        method: 'POST',
        data: {},
    });
}

export async function upsertMiniappHomeConfig(config: MiniappHomeConfig) {
    return request(`${API_BASE}/system-configs/miniapp/home-config/upsert`, {
        method: 'POST',
        data: { config },
    });
}

export async function getMiniappHomePublishedConfig() {
    return request<MiniappHomeConfig>(`${API_BASE}/system-configs/miniapp/home-config/published/get`, {
        method: 'POST',
        data: {},
    });
}

export async function publishMiniappHomeConfig() {
    return request<{ success: boolean }>(`${API_BASE}/system-configs/miniapp/home-config/publish`, {
        method: 'POST',
        data: {},
    });
}

export async function listMiniappProtocols() {
    return request<MiniappProtocolItem[]>(`${API_BASE}/miniapp-protocols/list`, {
        method: 'POST',
        data: {},
    });
}

export async function listMiniappProtocolCategories() {
    return request<MiniappProtocolCategoryItem[]>(`${API_BASE}/miniapp-protocols/categories/list`, {
        method: 'POST',
        data: {},
    });
}

export async function upsertMiniappProtocolCategory(data: {
    id?: number;
    name: string;
    description?: string;
    sort?: number;
    enabled?: boolean;
}) {
    return request<MiniappProtocolCategoryItem[]>(`${API_BASE}/miniapp-protocols/categories/upsert`, {
        method: 'POST',
        data,
    });
}

export async function deleteMiniappProtocolCategory(data: { id: number }) {
    return request<MiniappProtocolCategoryItem[]>(`${API_BASE}/miniapp-protocols/categories/delete`, {
        method: 'POST',
        data,
    });
}

export async function upsertMiniappProtocol(data: {
    id?: number;
    originalKey?: string;
    key: string;
    categoryId: number;
    title: string;
    coverImage?: string;
    content: string;
    enabled?: boolean;
    remark?: string;
    sort?: number;
}) {
    return request<MiniappProtocolItem[]>(`${API_BASE}/miniapp-protocols/upsert`, {
        method: 'POST',
        data,
    });
}

export async function deleteMiniappProtocol(data: { key: string }) {
    return request<MiniappProtocolItem[]>(`${API_BASE}/miniapp-protocols/delete`, {
        method: 'POST',
        data,
    });
}

export async function getPublicMiniappProtocol(key: string) {
    return request<MiniappProtocolItem | null>(`${API_BASE}/miniapp-protocols/public/${encodeURIComponent(String(key || '').trim())}`, {
        method: 'GET',
        skipErrorHandler: true,
    });
}

export async function listPublicMiniappProtocolsByCategory(category: string) {
    return request<MiniappProtocolItem[]>(`${API_BASE}/miniapp-protocols/public/list-by-category`, {
        method: 'GET',
        params: { category: String(category || '').trim() },
        skipErrorHandler: true,
    });
}

export async function listMiniappHomeStaffCandidates(keyword?: string) {
    return request<any[]>(`${API_BASE}/system-configs/miniapp/home-staff-candidates`, {
        method: 'POST',
        data: { keyword },
    });
}

export async function listMiniappAnnouncementOptions(keyword?: string) {
    return request<Array<{ id: number; title: string; audience: 'ALL' | 'APPLET' | 'ADMIN'; publishAt?: string; expireAt?: string }>>(
        `${API_BASE}/notifications/admin/announcements/miniapp-options`,
        {
            method: 'POST',
            data: { keyword },
        },
    );
}


export async function listMiniappHomeProductCandidates(params?: { keyword?: string }) {
    return request<any[]>(`${API_BASE}/system-configs/miniapp/home-product-candidates`, {
        method: 'POST',
        data: params || {},
    });
}

export async function getGoodsCategoryTree() {
    return request<any[]>(`${API_BASE}/system-configs/goods/category-tree/get`, {
        method: 'POST',
        data: {},
    });
}

export async function upsertGoodsCategoryTree(tree: any[]) {
    return request<any>(`${API_BASE}/system-configs/goods/category-tree/upsert`, {
        method: 'POST',
        data: { tree },
    });
}

export async function getGoodsTagList() {
    return request<any[]>(`${API_BASE}/system-configs/goods/tag-list/get`, {
        method: 'POST',
        data: {},
    });
}

export async function upsertGoodsTagList(tags: any[]) {
    return request<any>(`${API_BASE}/system-configs/goods/tag-list/upsert`, {
        method: 'POST',
        data: { tags },
    });
}

// ---------------------- App Version API ----------------------

export async function getPublicLatestAppVersion() {
    return request<AppVersionRecord | null>(`${API_BASE}/app-version/public/latest`, {
        method: 'GET',
        skipErrorHandler: true,
    });
}

export async function listAppVersions() {
    return request<{ list: AppVersionRecord[]; activeBuildId: string }>(`${API_BASE}/app-version/list`, {
        method: 'POST',
        data: {},
    });
}

export async function upsertAppVersion(data: {
    version?: string;
    buildId?: string;
    releaseType?: 'SMALL' | 'MAJOR';
    releasedAt?: string;
    forceRefresh?: boolean;
    title?: string;
    notes?: string[];
    mergePreviousNotes?: boolean;
    enabled?: boolean;
}) {
    return request<AppVersionRecord>(`${API_BASE}/app-version/upsert`, {
        method: 'POST',
        data,
    });
}

export async function activateAppVersion(data: { buildId: string }) {
    return request<{ success: boolean; activeBuildId: string }>(`${API_BASE}/app-version/activate`, {
        method: 'POST',
        data,
    });
}

// ---------------------- Offline Fee Bill API ----------------------

export interface OfflineFeeBill {
    id: number;
    userId: number;
    billMonth: string;
    periodStart: string;
    periodEnd: string;
    performanceBaseAmount: number;
    rate: number;
    minAmount: number;
    capAmount: number;
    shouldPayAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED';
    enforceFullPayment: boolean;
    lastRemindAt?: string | null;
    generatedAt: string;
    user?: {
        id: number;
        name?: string;
        phone: string;
        workMode?: 'ONLINE' | 'OFFLINE';
        offlineJoinedAt?: string | null;
    };
}

export interface OfflineStaffOption {
    id: number;
    label: string;
    name?: string;
    realName?: string;
    phone: string;
    status: string;
    offlineJoinedAt?: string | null;
}

export async function listOfflineFeeBills(data: {
    billMonth?: string;
    status?: string;
    userId?: number;
    page?: number;
    limit?: number;
    onlyOutstanding?: boolean;
}) {
    return request<{
        list: OfflineFeeBill[];
        total: number;
        page: number;
        limit: number;
    }>(`${API_BASE}/offline-fees/bills/list`, {
        method: 'POST',
        data,
    });
}

export async function generateOfflineFeeBills(data: { month: string }) {
  return request(`${API_BASE}/offline-fees/bills/generate`, {
    method: 'POST',
    data,
  });
}

export async function listOfflineStaffOptions(data?: { keyword?: string }) {
    return request<OfflineStaffOption[]>(`${API_BASE}/offline-fees/staff/offline-options`, {
        method: 'POST',
        data,
    });
}

export async function manualCreateOfflineFeeBill(data: {
    userId: number;
    month: string;
    performanceBaseAmount: number;
}) {
    return request(`${API_BASE}/offline-fees/bills/manual-entry`, {
        method: 'POST',
        data,
    });
}

export async function updateOfflineFeeBill(data: {
    billId: number;
    performanceBaseAmount: number;
}) {
    return request(`${API_BASE}/offline-fees/bills/update`, {
        method: 'POST',
        data,
    });
}

export async function enforceOfflineFeeBill(data: { billId: number; enforceFullPayment: boolean }) {
    return request(`${API_BASE}/offline-fees/bills/enforce`, {
        method: 'POST',
        data,
    });
}

export async function remindOfflineFeeBill(data: { billId: number }) {
    return request(`${API_BASE}/offline-fees/bills/remind`, {
        method: 'POST',
        data,
    });
}

export async function payOfflineFeeBill(data: { billId: number; amount: number; remark?: string }) {
    return request(`${API_BASE}/offline-fees/bills/pay`, {
        method: 'POST',
        data,
    });
}

// ---------------------- Notification / Announcement API ----------------------

export interface SystemAnnouncementItem {
    id: number;
    title: string;
    content: string;
    audience: 'ADMIN' | 'APPLET' | 'ALL';
    forceRead: boolean;
    enabled: boolean;
    publishAt?: string | null;
    expireAt?: string | null;
    createdBy?: number | null;
    createdAt: string;
    updatedAt: string;
    creator?: {
        id: number;
        name?: string;
        phone: string;
    };
}

export async function adminListAnnouncements(data: { keyword?: string; page?: number; limit?: number }) {
    return request<{ list: SystemAnnouncementItem[]; total: number; page: number; limit: number }>(
        `${API_BASE}/notifications/admin/announcements/list`,
        { method: 'POST', data },
    );
}

export async function adminCreateAnnouncement(data: {
    title: string;
    content: string;
    audience?: 'ADMIN' | 'APPLET' | 'ALL';
    forceRead?: boolean;
    enabled?: boolean;
    publishAt?: string;
    expireAt?: string;
}) {
    return request<SystemAnnouncementItem>(`${API_BASE}/notifications/admin/announcements/create`, {
        method: 'POST',
        data,
    });
}

export async function adminUpdateAnnouncement(data: {
    id: number;
    title?: string;
    content?: string;
    audience?: 'ADMIN' | 'APPLET' | 'ALL';
    forceRead?: boolean;
    enabled?: boolean;
    publishAt?: string;
    expireAt?: string;
}) {
    return request<SystemAnnouncementItem>(`${API_BASE}/notifications/admin/announcements/update`, {
        method: 'POST',
        data,
    });
}

export interface DutyCsScheduleItem {
    id: number;
    userId: number;
    weekday: number;
    weekdaysMask?: number;
    weekdays?: number[];
    startMinute: number;
    endMinute: number;
    startTime?: string;
    endTime?: string;
    enabled: boolean;
    remark?: string | null;
    user?: {
        id: number;
        phone: string;
        name?: string;
        realName?: string;
        userType: string;
        status: string;
    };
}

export async function adminListDutyCsSchedules(data?: { keyword?: string }) {
    return request<DutyCsScheduleItem[]>(`${API_BASE}/notifications/admin/duty-cs/list`, {
        method: 'POST',
        data,
    });
}

export async function adminUpsertDutyCsSchedule(data: {
    id?: number;
    userId: number;
    weekday?: number;
    weekdays?: number[];
    startTime: string;
    endTime: string;
    enabled?: boolean;
    remark?: string;
}) {
    return request(`${API_BASE}/notifications/admin/duty-cs/upsert`, {
        method: 'POST',
        data,
    });
}

export async function adminDeleteDutyCsSchedule(data: { id: number }) {
    return request(`${API_BASE}/notifications/admin/duty-cs/delete`, {
        method: 'POST',
        data,
    });
}
export interface DutyCsLeaveItem {
    id: number;
    userId: number;
    substituteUserId: number;
    startAt: string;
    endAt: string;
    enabled: boolean;
    reason?: string | null;
    isActiveNow?: boolean;
    user?: {
        id: number;
        phone: string;
        name?: string;
        realName?: string;
        userType: string;
        status: string;
    };
    substituteUser?: {
        id: number;
        phone: string;
        name?: string;
        realName?: string;
        userType: string;
        status: string;
    };
}

export async function adminListDutyCsLeaves(data?: { keyword?: string }) {
    return request<DutyCsLeaveItem[]>(`${API_BASE}/notifications/admin/duty-cs/leave/list`, {
        method: 'POST',
        data,
    });
}

export async function adminUpsertDutyCsLeave(data: {
    id?: number;
    userId: number;
    substituteUserId: number;
    startAt: string;
    endAt: string;
    enabled?: boolean;
    reason?: string;
}) {
    return request(`${API_BASE}/notifications/admin/duty-cs/leave/upsert`, {
        method: 'POST',
        data,
    });
}

export async function adminDeleteDutyCsLeave(data: { id: number }) {
    return request(`${API_BASE}/notifications/admin/duty-cs/leave/delete`, {
        method: 'POST',
        data,
    });
}

export async function myAnnouncements() {
    return request<Array<SystemAnnouncementItem & { isRead: boolean; readAt?: string | null }>>(
        `${API_BASE}/notifications/my/announcements`,
        {
            method: 'POST',
            data: {},
        },
    );
}

export async function readAnnouncement(data: { announcementId: number }) {
    return request(`${API_BASE}/notifications/my/announcements/read`, {
        method: 'POST',
        data,
    });
}

export async function myPendingForceAnnouncements() {
    return request<{ unreadForceCount: number; list: Array<SystemAnnouncementItem & { isRead: boolean }> }>(
        `${API_BASE}/notifications/my/announcements/pending-force`,
        {
            method: 'POST',
            data: {},
        },
    );
}

export interface RealtimeNotificationItem {
    id: string;
    type: string;
    title: string;
    content: string;
    route?: string;
    payload?: any;
    createdAt: string;
}

export async function myRealtimeNotifications() {
    return request<{ list: RealtimeNotificationItem[]; unreadCount: number }>(
        `${API_BASE}/notifications/my/realtime/list`,
        {
            method: 'POST',
            data: {},
        },
    );
}

export async function clearOneRealtimeNotification(data: { id: string }) {
    return request<{ success: boolean; unreadCount: number }>(
        `${API_BASE}/notifications/my/realtime/clear-one`,
        {
            method: 'POST',
            data,
        },
    );
}

export async function clearAllRealtimeNotifications() {
    return request<{ success: boolean; unreadCount: number }>(
        `${API_BASE}/notifications/my/realtime/clear-all`,
        {
            method: 'POST',
            data: {},
        },
    );
}

export async function adminSendTestRealtimePush(data: {
    targetRole?: 'STAFF' | 'CUSTOMER_SERVICE' | 'BOTH';
    targetUserIds?: number[];
    title?: string;
    content?: string;
    mockType?: 'DISPATCH_ASSIGNED' | 'DISPATCH_ARCHIVED' | 'DISPATCH_COMPLETED' | 'SYSTEM_ANNOUNCEMENT' | 'CS_DUTY_SUBSTITUTION' | 'CUSTOM';
}) {
    return request<{ pushed: number }>(`${API_BASE}/notifications/admin/test-push/send`, {
        method: 'POST',
        data,
    });
}



export async function listUserLogs(data: any) {
    return request(`${API_BASE}/user-logs/list`, {
        method: 'POST',
        data,
    });
}

export async function getUserLogDetail(data: { id: number }) {
    return request(`${API_BASE}/user-logs/detail`, {
        method: 'POST',
        data,
    });
}

// ---------------------- Finance Reconcile API (POST style) ----------------------

/** 财务核账-总览：POST /finance/reconcile/summary */
export async function financeReconcileSummary(data: {
    startAt: string;
    endAt: string;
    includeGifted?: boolean;
}) {
    return request(`${API_BASE}/finance/reconcile/summary`, {
        method: 'POST',
        data,
    });
}

/** 财务核账-订单明细（每单一列）：POST /finance/reconcile/orders */
export async function financeReconcileOrders(data: {
    startAt: string;
    endAt: string;
    page?: number;
    pageSize?: number;
    autoSerial?: string;
    playerId?: number;
    includeGifted?: boolean;
    onlyAbnormal?: boolean;
}) {
    return request(`${API_BASE}/finance/reconcile/orders`, {
        method: 'POST',
        data,
    });
}

/** 财务核账-订单抽查详情：POST /finance/reconcile/order-detail */
export async function financeReconcileOrderDetail(data: { orderId?: number; autoSerial?: string }) {
    return request(`${API_BASE}/finance/reconcile/order-detail`, {
        method: 'POST',
        data,
    });
}

// ======================
// ✅ Orders API Wrappers（为 Detail.tsx 统一方法名）
// - 不改现有接口，只做“方法名对齐 + 参数形状对齐”
// ======================

/**
 * ✅ 兼容：详情页使用的派单方法名
 * 后端路由：POST /orders/dispatch
 */
export async function assignDispatchOrUpdate(orderId: number, data: { playerIds: number[]; remark?: string }) {
    return assignDispatch(orderId, data);
}

/**
 * ✅ 兼容：详情页使用的“补收/改实付”方法名
 * 后端路由：POST /orders/update-paid-amount
 *
 * 注意：
 * - confirmPaid 允许 string/boolean，后端内部会 Boolean() 处理
 */
export async function updatePaidAmount(
    orderId: number,
    paidAmount: number,
    opts?: { remark?: string; confirmPaid?: boolean | string },
) {
    return updateOrderPaidAmount({
        id: orderId,
        paidAmount,
        remark: opts?.remark,
        confirmPaid: opts?.confirmPaid as any,
    });
}

/**
 * ✅ 存单进度修复（输入“本轮总进度整数”，后端按有效参与者均分）
 * 后端路由：POST /orders/dispatch/participant/update-progress
 */
export async function updateArchivedParticipantProgress(
    dispatchId: number,
    participantId: number,
    progressBaseWan: number,
    opts?: { remark?: string },
) {
    return request(`${API_BASE}/orders/dispatch/participant/update-progress`, {
        method: 'POST',
        data: {
            dispatchId,
            participantId,
            progressBaseWan,
            remark: opts?.remark,
        },
    });
}

/**
 * ⚠️ 最终确认结单（方案 C）
 * 你当前上传的 orders.controller.ts 里【还没有】这个路由，需要你后端加一个：
 *   POST /orders/confirm-complete
 * body 示例：{ id: orderId, remark?: string }
 *
 * 等你后端补好后，这个 API 就能直接用，前端不用再改。
 */
export async function confirmCompleteOrder(opts:any) {
    return request(`${API_BASE}/orders/confirm-complete`, {
        method: 'POST',
        data: opts,
    });
}

/**
 * ✅ 退款：提供一个“按 id + remark”的调用方式（更贴合 Detail.tsx 的写法）
 * 后端路由：POST /orders/refund
 */
export async function refundOrderById(orderId: number, opts?: { remark?: string }) {
    return refundOrder({ id: orderId, remark: opts?.remark });
}

export interface ComplaintWorkOrder {
    id: number;
    ticketNo: string;
    orderId: number;
    userId: number;
    status: string;
    reason: string;
    description?: string | null;
    paymentChannel?: string | null;
    refundSupported: boolean;
    refundUnsupportedReason?: string | null;
    suggestedRefundAmount?: number | null;
    approvedRefundAmount?: number | null;
    reviewRemark?: string | null;
    refundRemark?: string | null;
    reviewedBy?: number | null;
    reviewedAt?: string | null;
    refundedBy?: number | null;
    refundedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
    order?: {
        id: number;
        orderNo: string;
        serviceName: string;
        coverImage?: string;
        amount: number;
        status: string;
        createdAt?: string;
        customerName?: string;
        customerPhone?: string;
        paymentChannel?: string;
        paymentStatus?: string;
        paidAt?: string | null;
    } | null;
}

export async function getComplaintWorkOrders(params?: { page?: number; limit?: number; status?: string; keyword?: string }) {
    return request<{ data: ComplaintWorkOrder[]; total: number; page: number; limit: number; totalPages: number }>(`${API_BASE}/orders/complaints`, {
        method: 'GET',
        params,
    });
}

export async function reviewComplaintWorkOrder(id: number, data: { action: 'APPROVE' | 'REJECT'; reviewRemark?: string; approvedRefundAmount?: number }) {
    return request<ComplaintWorkOrder>(`${API_BASE}/orders/complaints/${id}/review`, {
        method: 'POST',
        data,
    });
}

export async function refundComplaintWorkOrder(id: number, data: { refundAmount?: number; refundRemark?: string }) {
    return request<ComplaintWorkOrder>(`${API_BASE}/orders/complaints/${id}/refund`, {
        method: 'POST',
        data,
    });
}



// ---------------------- Orders / Dispatch Fix (Archived) ----------------------
// 存单后修复：单个参与者进度修正（后端一次只支持一个 participantId）
export async function updateDispatchParticipantProgress(body: {
    dispatchId: number;
    participantId: number;
    progressBaseWan: number;
    remark?: string;
}) {
    return request(`${API_BASE}/orders/update-archived-progress`, {
        method: 'POST',
        data: body,
    });
}

// 存单后修复：
// - GUARANTEED：按“本轮总保底进度(万)”均分到本轮所有参与者
// - HOURLY：修复本轮 billableHours
// 二者都会触发「仅重算结算，不动钱包」
export async function updateArchivedProgressTotal(body: {
    dispatchId: number;

    // ✅ 修复类型（由后端区分处理逻辑）
    fixType: 'GUARANTEED' | 'HOURLY';

    // =========================
    // GUARANTEED 专用
    // =========================
    totalProgressBaseWan?: number; // ✅ 允许负数（炸单修正）

    // =========================
    // HOURLY 专用
    // =========================
    billableHours?: number;

    remark?: string;
}) {
    return request(`${API_BASE}/orders/update-archived-progress-total`, {
        method: 'POST',
        data: body,
    });
}


/**
 * ✅ 钱包对齐修复（以 settlement.finalEarnings 为准）
 * POST /orders/repair-wallet-by-settlements
 * - dryRun=true：只预览差异，不落库
 */
export async function repairWalletBySettlements(data: {
    id: number;
    reason?: string;
    scope?: string;
    dryRun?: boolean;
}) {
    return request(`${API_BASE}/orders/repair-wallet-by-settlements`, {
        method: 'POST',
        data,
    });
}

export async function rollbackWrongSettlementReversals(data: {
    id: number
}) {
    return request(`${API_BASE}/orders/${data.id}/rollback-wrong-settlement-reversals`, {
        method: 'POST',
        data,
    });
}


/**
 * ✅ 重新结算（修历史结算用）
 * POST /orders/repair-wallet-by-settlementsV1
 * - 默认 allowWalletSync=false：只改结算，不动钱包
 */
export async function recalculateOrderSettlements(data: {
    id: number;
    reason?: string;
    scope?: string;
    allowWalletSync?: boolean;
    settlementBaseAmount?: number;
    modePlayAllocList?: any[];
    playerEvaluations?: any[];
    orderTipEnabled?: boolean;
    orderTipUserIds?: number[];
}) {
    return request(`${API_BASE}/orders/repair-wallet-by-settlementsV1`, {
        method: 'POST',
        data,
    });
}
/**
 * 上传提现收款二维码（仅允许一次）
 * - multipart/form-data
 * - 后端字段名固定为 file
 */
export async function uploadWithdrawQrCode(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return request<{ success: boolean }>(`${API_BASE}/wallet/withdraw/qr-code`, {
        method: 'POST',
        data: formData,
        requestType: 'form', // 关键：让 umi 用 FormData
    });
}

/**
 * 获取提现收款二维码的临时访问 URL
 * - 返回 { url: string | null }
 */
export async function getWithdrawQrCodeUrl() {
    return request<{ url: string | null }>(`${API_BASE}/wallet/withdraw/qr-code-url`, {
        method: 'GET',
    });
}

/**
 * 获取平台钱包统计信息
 */
export async function getStaffWalletStatistics() {
    return request<{
        totalAvailableBalance: number;
        totalFrozenBalance: number;
        totalDepositBalance: number;
        totalBalance: number;
    }>(`${API_BASE}/users/staff/wallet-statistics`, {
        method: 'GET',
    });
}
export async function getWalletDepositTransactions(params:any) {
    return request(`${API_BASE}/wallet/deposit-transactions`, {
        method:'GET',
        params
    })
}

export async function manualDeposit(data:any) {
    return request(`${API_BASE}/wallet/deposit/manual`, {
        method:'POST',
        data
    })
}

/**
 * 获取业绩数据
 */
export async function getPerformanceDashboardOverview(data: any) {
    return request(`${API_BASE}/performance/dashboard/overview`, {
        method: 'POST',
        data,
    });
}

export async function getPerformanceDashboardList(data: any) {
    return request(`${API_BASE}/performance/dashboard/list`, {
        method: 'POST',
        data,
    });
}

/**
 * 运营数据
 */
export async function postFinanceDashboardSummary(data: any) {
    return request(`${API_BASE}/finance/dashboard/summary`, {
        method: 'POST',
        data,
    });
}

export async function postFinanceDashboardTrend(data: any) {
    return request(`${API_BASE}/finance/dashboard/trend`, {
        method: 'POST',
        data,
    });
}

export async function postFinanceDashboardCostStructure(data: any) {
    return request(`${API_BASE}/finance/dashboard/cost-structure`, {
        method: 'POST',
        data,
    });
}

export async function postFinanceRecordList(data: any) {
    return request(`${API_BASE}/finance/records/list`, {
        method: 'POST',
        data,
    });
}

// ---------------------- Penalties API ----------------------

export async function getPenaltyDict() {
  return request(`${API_BASE}/penalties/dict`, {
    method: 'POST',
    data: {},
  });
}

export async function getPenaltyOverview() {
  return request(`${API_BASE}/penalties/stats/overview`, {
    method: 'POST',
    data: {},
  });
}

export async function getPenaltyRules(data: any) {
  return request(`${API_BASE}/penalties/rules/list`, {
    method: 'POST',
    data,
  });
}

export async function postPenaltyRuleCreate(data: any) {
  return request(`${API_BASE}/penalties/rules/create`, {
    method: 'POST',
    data,
  });
}

export async function postPenaltyRuleUpdate(data: any) {
  return request(`${API_BASE}/penalties/rules/update`, {
    method: 'POST',
    data,
  });
}

export async function getPenaltyTickets(data: any) {
  return request(`${API_BASE}/penalties/tickets/list`, {
    method: 'POST',
    data,
  });
}

export async function getPenaltyTicketDetail(data: { ticketId: number }) {
  return request(`${API_BASE}/penalties/tickets/detail`, {
    method: 'POST',
    data,
  });
}

export async function getPenaltyTicketContext(data: { userId: number; ruleIds: number[] }) {
  return request(`${API_BASE}/penalties/tickets/context`, {
    method: 'POST',
    data,
  });
}

export async function postPenaltyTicketCreate(data: any) {
  return request(`${API_BASE}/penalties/tickets/create`, {
    method: 'POST',
    data,
  });
}

export async function postPenaltyTicketRemind(data: { ticketId: number }) {
  return request(`${API_BASE}/penalties/tickets/remind`, {
    method: 'POST',
    data,
  });
}

export async function getPenaltyAppeals(data: any) {
  return request(`${API_BASE}/penalties/appeals/list`, {
    method: 'POST',
    data,
  });
}

export async function postPenaltyReviewAppeal(data: {
  ticketId: number;
  approved: boolean;
  reviewRemark?: string;
}) {
  return request(`${API_BASE}/penalties/tickets/review-appeal`, {
    method: 'POST',
    data,
  });
}

export async function getPenaltyFundFlows(data: any) {
  return request(`${API_BASE}/penalties/fund/flows`, {
    method: 'POST',
    data,
  });
}

export async function getPenaltyRanking(data: { top?: number }) {
  return request(`${API_BASE}/penalties/ranking/list`, {
    method: 'POST',
    data,
  });
}

export async function getPenaltyRuleStatsByUser(data: { userId: number }) {
  return request(`${API_BASE}/penalties/stats/rule-categories`, {
    method: 'POST',
    data,
  });
}

// 打手端：我的罚单
export async function getMyPenaltyTickets(data: any) {
  return request(`${API_BASE}/penalties/my/tickets/list`, {
    method: 'POST',
    data,
  });
}

export async function getMyPenaltyPendingStats() {
  return request(`${API_BASE}/penalties/my/tickets/pending-stats`, {
    method: 'POST',
    data: {},
  });
}

export async function confirmMyPenaltyTicket(data: { ticketId: number }) {
  return request(`${API_BASE}/penalties/my/tickets/confirm`, {
    method: 'POST',
    data,
  });
}

export async function appealMyPenaltyTicket(data: { ticketId: number; content: string }) {
  return request(`${API_BASE}/penalties/my/tickets/appeal`, {
    method: 'POST',
    data,
  });
}

// ---------------------- Chest Demo (宝箱活动) ----------------------
export async function getChestAdminConfig() {
  return request(`${API_BASE}/chest/admin/config`, { method: 'GET' });
}

export async function postChestAdminConfig(data: { enabled?: boolean; title?: string; defaultKeyCount?: number }) {
  return request(`${API_BASE}/chest/admin/config`, { method: 'POST', data });
}

export async function postChestGenerateCodes(data: {
  count: number;
  keyCount?: number;
  prefix?: string;
  expireAt?: string | null;
}) {
  return request(`${API_BASE}/chest/admin/codes/generate`, { method: 'POST', data });
}

export async function postChestGeneratePromotion(data: {
  codeCount: number;
  totalKeys: number;
  prefix?: string;
  promoPrefix?: string;
  expireAt?: string | null;
}) {
  return request(`${API_BASE}/chest/admin/promotions/generate`, { method: 'POST', data });
}

export async function postChestPromotionList(data: { page?: number; pageSize?: number; promoCode?: string }) {
  return request(`${API_BASE}/chest/admin/promotions/list`, { method: 'POST', data });
}

export async function postChestCodeList(data: { page?: number; pageSize?: number; status?: 'UNUSED' | 'USED' | 'ALL'; code?: string; phone?: string }) {
  return request(`${API_BASE}/chest/admin/codes/list`, { method: 'POST', data });
}

export async function postChestCodeRedeemByAdmin(data: { code: string; userId?: number; phone?: string }) {
  return request(`${API_BASE}/chest/admin/codes/redeem`, { method: 'POST', data });
}

export async function postChestCodeHistory(data: { code: string; page?: number; pageSize?: number }) {
  return request(`${API_BASE}/chest/admin/codes/history`, { method: 'POST', data });
}

export async function postChestCodeHistoryVerify(data: { recordId: number; verified: boolean; remark?: string }) {
  return request(`${API_BASE}/chest/admin/codes/history/verify`, { method: 'POST', data });
}

export async function getChestRewardItems() {
  return request(`${API_BASE}/chest/admin/rewards`, { method: 'GET' });
}

export async function postChestRewardSave(data: {
  id?: number;
  name: string;
  type: string;
  quantity?: number;
  weight?: number;
  stock?: number | null;
  enabled?: boolean;
  sortOrder?: number;
  minDrawCount?: number;
  blockBeforeDays?: number | null;
  rampEveryDays?: number | null;
  rampStep?: number | null;
  rampMaxExtra?: number | null;
  dynamicMode?: string | null;
  publicRuleText?: string;
}) {
  return request(`${API_BASE}/chest/admin/rewards/save`, { method: 'POST', data });
}

export async function postChestRewardDelete(data: { id: number }) {
  return request(`${API_BASE}/chest/admin/rewards/delete`, { method: 'POST', data });
}

export async function getChestMyStatus() {
  return request(`${API_BASE}/chest/my/status`, { method: 'GET' });
}

export async function postChestRedeem(data: { code: string }) {
  return request(`${API_BASE}/chest/my/redeem`, { method: 'POST', data });
}

export async function postChestOpen(data?: { costKeys?: number }) {
  return request(`${API_BASE}/chest/my/open`, { method: 'POST', data: data || {} });
}

export async function postChestPublicStatus(data: { deviceId: string; phone?: string; code?: string }) {
  return request(`${API_BASE}/chest/public/status`, { method: 'POST', data, skipErrorHandler: true });
}

export async function postChestPublicRedeem(data: { deviceId: string; code: string; phone?: string }) {
  return request(`${API_BASE}/chest/public/redeem`, { method: 'POST', data, skipErrorHandler: true });
}

export async function postChestPublicOpen(data: { deviceId: string; costKeys?: number; phone?: string; code?: string }) {
  return request(`${API_BASE}/chest/public/open`, { method: 'POST', data, skipErrorHandler: true });
}

export async function postChestPublicHistory(data: { deviceId: string; page?: number; pageSize?: number; phone?: string; code?: string }) {
  return request(`${API_BASE}/chest/public/history`, { method: 'POST', data, skipErrorHandler: true });
}

export async function getChestPublicRewardPool() {
  return request(`${API_BASE}/chest/public/reward-pool`, { method: 'GET', skipErrorHandler: true });
}

export async function postChestPublicPromoStatus(data: { deviceId: string; promoCode: string; phone?: string }) {
  return request(`${API_BASE}/chest/public/promo/status`, { method: 'POST', data, skipErrorHandler: true });
}

export async function postChestPublicPromoClaim(data: { deviceId: string; promoCode: string; phone?: string }) {
  return request(`${API_BASE}/chest/public/promo/claim`, { method: 'POST', data, skipErrorHandler: true });
}
