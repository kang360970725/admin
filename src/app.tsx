import type {RuntimeConfig} from '@umijs/max';
import {Avatar, Dropdown, message, Typography} from 'antd';
import {UserOutlined} from '@ant-design/icons';
import React from 'react';
import {getCurrentUser} from './services/api';
import './global.less';

// 定义用户类型
interface CurrentUser {
    id: number;
    phone: string;
    name: string;
    userType: string;
    level: number; // 你可以把它当“评级/等级”
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
    // 你说要“评级”，但当前字段只有 level：这里给个展示文案
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
            if (userInfo) {
                localStorage.setItem('currentUser', JSON.stringify(userInfo));
            }

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
        return {fetchUserInfo, currentUser};
    }

    return {fetchUserInfo};
}

export const layout: RuntimeConfig['layout'] = {
    logo: 'https://img.alicdn.com/tfs/TB1YHEpwUT1gK0jSZFhXXaAtVXa-28-27.svg',
    title: '蓝猫陪玩管理系统',
    collapsible: false,
    collapsedButtonRender: false,
    // ✅ 关键：自定义右上角个人信息区域（默认展示昵称+评级；hover 出退出）
    avatarProps: {
        // ProLayout 会把 initialState.currentUser 透传进来作为 avatarProps 的参数之一，
        // 但在对象写法里我们拿不到 initialState；因此使用 render 的 _props 来取用户信息
        size: 'small',
        title: '当前陪玩',
        render: (props: any, _defaultDom: React.ReactNode) => {
            // Ant Design Pro/ProLayout 通常会把用户信息放在 props 中（不同版本字段可能略有差异）
            // 常见：props?.avatar / props?.title，或者直接通过 localStorage 兜底读取
            let currentUser: Partial<CurrentUser> | undefined;

            try {
                const cached = localStorage.getItem('currentUser');
                if (cached) currentUser = JSON.parse(cached);
            } catch (e) {
                // ignore
            }

            const name = getDisplayName(currentUser);
            const levelText = getLevelText(currentUser);
            const levelNum = Number(currentUser?.level || 0);

            const menuItems = [{key: 'logout', label: '退出登录'}];

            return (
                <Dropdown
                    placement="bottomRight"
                    trigger={['hover']}
                    menu={{
                        items: menuItems,
                        onClick: ({key}) => {
                            if (key === 'logout') doLogout();
                        },
                    }}
                >
                    <div className="bm-user-center">
                        {currentUser?.avatar ? (
                            <Avatar src={currentUser.avatar} size="small"/>
                        ) : (
                            <Avatar icon={<UserOutlined/>} size="small"/>
                        )}

                        {/* 昵称 */}
                        <Typography.Text
                            strong
                            style={{maxWidth: 140, display: 'inline-block'}}
                            ellipsis
                        >
                            {name}
                        </Typography.Text>

                        {/* 评级/等级（两种展示：Tag + 星星，二选一；你不想星星就删掉 Rate） */}
                        {/*<Tag style={{ marginInlineStart: 0 }}>{levelText}</Tag>*/}

                        {/* 如果你希望更“评级”感觉：用星星（level 1~5 最直观） */}
                        {/*{levelNum > 0 ? (*/}
                        {/*        <Rate*/}
                        {/*            disabled*/}
                        {/*    allowHalf*/}
                        {/*  value={Math.max(0, Math.min(5, levelNum))}*/}
                        {/*  style={{ fontSize: 12 }}*/}
                        {/*  />*/}
                        {/*) : null}*/}
                    </div>
                </Dropdown>
            );
        },
    },

    // logout: () => doLogout(),

    onPageChange: () => {
        const token = localStorage.getItem('token');
        const pathname = window.location.pathname;
        const allowAnonymous = pathname === '/login' || pathname === '/reset-password';
        if (!token && !allowAnonymous) {
            window.location.href = '/login';
        }
    }
    ,
};

export const request: RuntimeConfig['request'] =
    {
        timeout: 10000,
        errorConfig: {
            errorHandler: (error: any) => {
                const status = error?.response?.status;
                const data = error?.data; // ✅ umi-request 常见在这里

                if (status === 401) {
                    message.error(data?.message || '登录已过期，请重新登录');
                    doLogout();
                    return;
                }

                if (status === 403) {
                    message.error(data?.message || '无权限访问');
                    window.location.href = '/403';
                    return;
                }

                if (status && status >= 400) {
                    message.error(data?.message || '请求失败');
                    return;
                }

                message.error('网络错误，请检查网络连接');
                console.error('请求错误:', error);
            },
        }
        ,

        requestInterceptors: [
            (url: string, options: any) => {
                const token = localStorage.getItem('token');

                // ✅ 系统性修复：headers 可能不存在
                const headers = {...(options?.headers || {})};

                if (token) headers.Authorization = `Bearer ${token}`;
                headers['Content-Type'] = headers['Content-Type'] || 'application/json';

                return {url, options: {...options, headers}};
            },
        ],

        responseInterceptors: [(response: any) => response],
    }
;
