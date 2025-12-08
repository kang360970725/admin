import { request } from '@umijs/max';
import { getApiBase, logEnvInfo } from '@/utils/env';

// 记录环境信息
logEnvInfo();

// 动态获取 API 基础路径
const API_BASE = '/api';

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
    return request('/api/users/ratings/available', {
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
