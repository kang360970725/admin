import type { RuntimeConfig } from '@umijs/max';
import React from 'react';
import {Avatar, Button, Dropdown, message, Result, Space, Typography} from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { getCurrentUser } from './services/api';
import { useIsMobile } from '@/utils/useIsMobile';
import './global.less';
import { history } from '@umijs/max';

const { Text } = Typography;

interface CurrentUser {
    id: number;
    phone: string;
    name: string;
    userType: string;
    level: number;
    balance: number;
    avatar?: string;
    permissions?: string[];
    needResetPwd?: boolean;
}

const loginPath = '/login';

function doLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.href = loginPath;
}

function getDisplayName(u?: Partial<CurrentUser>) {
    return u?.name || u?.phone || '当前陪玩';
}

function getLevelText(u?: Partial<CurrentUser>) {
    const lv = Number(u?.level || 0);
    if (!lv) return '未评级';
    return `Lv.${lv}`;
}

/**
 * 全局初始化数据配置
 */
export async function getInitialState(): Promise<{
    currentUser?: CurrentUser;
    loading?: boolean;
    fetchUserInfo?: () => Promise<CurrentUser | undefined>;
}> {
    const fetchUserInfo = async (): Promise<CurrentUser | undefined> => {
        const token = localStorage.getItem('token');
        // ✅ 未登录是正常状态：不要 throw，否则会进入 catch 并清存储
        if (!token) return undefined;

        try {
            const userInfo = await getCurrentUser();

            // （可选）缓存 currentUser
            if (userInfo) localStorage.setItem('currentUser', JSON.stringify(userInfo));

            if (userInfo?.needResetPwd && window.location.pathname !== '/reset-password') {
                window.location.href = '/reset-password';
            }

            return userInfo;
        } catch (error) {
            localStorage.removeItem('token');
            localStorage.removeItem('currentUser');
            console.error('获取用户信息失败:', error);
            return undefined;
        }
    };

    // 如果是登录页面，不执行
    if (window.location.pathname !== '/login') {
        const currentUser = await fetchUserInfo();
        return { fetchUserInfo, currentUser };
    }

    return { fetchUserInfo };
}

/**
 * ✅ Layout：PC 维持 ProLayout；/m/* 移动端走“纯内容页”
 */
export const layout: RuntimeConfig['layout'] = ({ location }) => {
    const pathname = location?.pathname || window.location.pathname;
    const isMobileShell = pathname.startsWith('/m');
    const isMobile = useIsMobile(768);

    return {
        logo: 'https://img.alicdn.com/tfs/TB1YHEpwUT1gK0jSZFhXXaAtVXa-28-27.svg',
        title: '蓝猫陪玩管理系统',
        collapsible: false,

        // ✅ 关键：移动端隐藏 ProLayout 外壳
        menuRender: isMobile ? false : undefined,
        menuHeaderRender: isMobile ? false : undefined,
        headerRender: isMobile ? false : undefined,
        footerRender: isMobile ? false : undefined,
        collapsedButtonRender: isMobile ? false : undefined,
        siderWidth: isMobile ? 0 : undefined,
        pageTitleRender: isMobile ? false : undefined,

        // ✅ 关键：移动端去掉内容区域 padding，让页面成为“纯内容”
        contentStyle: isMobile ? { padding: 0, margin: 0 } : undefined,

        // ✅ pure 模式（可选，支持则更干净）
        pure: isMobile ? true : undefined,

        // ✅ 右上角个人信息区域（保留你原逻辑）
        avatarProps: {
            size: 'small',
            title: '当前陪玩',
            render: (_props: any, _defaultDom: React.ReactNode) => {
                let currentUser: Partial<CurrentUser> | undefined;
                try {
                    const cached = localStorage.getItem('currentUser');
                    if (cached) currentUser = JSON.parse(cached);
                } catch (e) {
                    // ignore
                }

                const name = getDisplayName(currentUser);
                const levelText = getLevelText(currentUser);
                const menuItems = [{ key: 'logout', label: '退出登录' }];

                return (
                    <Dropdown
                        menu={{
                            items: menuItems,
                            onClick: ({ key }) => {
                                if (key === 'logout') doLogout();
                            },
                        }}
                    >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              {currentUser?.avatar ? (
                  <Avatar size="small" src={currentUser.avatar} />
              ) : (
                  <Avatar size="small" icon={<UserOutlined />} />
              )}
                <Text>{name}</Text>
                {/* 你之前的“评级文案”，保留但不抢眼 */}
                <Text type="secondary" style={{ fontSize: 12 }}>
                {levelText}
              </Text>
            </span>
                    </Dropdown>
                );
            },
        },

        onPageChange: ({ location }: any) => {
            const token = localStorage.getItem('token');
            const path = window.location.pathname;
            const allowAnonymous = path === '/login' || path === '/reset-password';

            if (!token && !allowAnonymous) {
                window.location.href = '/login';
            }

            const pathname = location?.pathname || window.location.pathname;

            const isMobileRoute =
                pathname.startsWith('/workbench') ||
                pathname.startsWith('/orders/') || // 订单详情
                pathname.startsWith('/m/'); // 如果你后面有 m 端路由

            const cls = 'bc-mobile-fullscreen';
            if (isMobileRoute) {
                document.body.classList.add(cls);
            } else {
                document.body.classList.remove(cls);
            }
        },
        childrenRender: (children) => {
            // ✅ 兜底：清掉历史遗留 403 标记，防止全站被截胡
            try {
                sessionStorage.removeItem('LAST_403_CODE');
                sessionStorage.removeItem('LAST_403_MESSAGE');
            } catch {}
            return children;
        },

    };
};

export const request: RuntimeConfig['request'] = {
    timeout: 10000,
    errorConfig: {
        errorHandler: (error: any) => {
            const status = error?.response?.status;
            const data = error?.data; // umi-request 常见在这里

            if (status === 401) {
                message.error(data?.message || '登录已过期，请重新登录');
                doLogout();
                return;
            }
            if (status === 403) {
                const code = data?.code || '';
                const msg = data?.message || '无权访问';

                // 冻结：引导去钱包（仍在 Layout 内跳转，不刷新）
                if (code === 'ACCOUNT_FROZEN') {
                    message.warning(msg);
                    history.push('/wallet/overview');
                    return;
                }

                // 禁用：清登录态并去登录页
                if (code === 'ACCOUNT_DISABLED') {
                    message.error(msg);
                    localStorage.removeItem('token');
                    localStorage.removeItem('currentUser');
                    history.push('/login');
                    return;
                }

                // 其他 403：最简单——进 403 路由（Layout 仍然保留）
                message.error(msg);
                history.push(`/403?code=${encodeURIComponent(code)}&msg=${encodeURIComponent(msg)}`);
                return;
            }





            if (status && status >= 400) {
                message.error(data?.message || '请求失败');
                return;
            }

            message.error('网络错误，请检查网络连接');
            console.error('请求错误:', error);
        },
    },
    requestInterceptors: [
        (url: string, options: any) => {
            const token = localStorage.getItem('token');
            const headers = { ...(options?.headers || {}) };

            if (token) headers.Authorization = `Bearer ${token}`;
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';

            return { url, options: { ...options, headers } };
        },
    ],
    responseInterceptors: [(response: any) => response],
};
