import type { RuntimeConfig } from '@umijs/max';
import { message, Avatar, Dropdown, Space, Tag, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import React from 'react';
import { getCurrentUser } from './services/api';

// 定义用户类型
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

// 全局初始化数据配置，用于 Layout 用户信息和权限初始化
export async function getInitialState(): Promise<{
  currentUser?: CurrentUser;
  loading?: boolean;
  fetchUserInfo?: () => Promise<any>;
}> {
  const fetchUserInfo = async (): Promise<any> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('未登录');
      }

      // 调用获取当前用户信息的接口
      const userInfo = await getCurrentUser();

      // 检查是否需要重置密码
      if (userInfo?.needResetPwd && window.location.pathname !== '/reset-password') {
        window.location.href = '/reset-password';
        return userInfo;
      }

      return userInfo;
    } catch (error) {
      // 如果获取用户信息失败，清除本地存储
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      console.error('获取用户信息失败:', error);
    }
    return undefined;
  };

  // 如果是登录页面，不执行
  if (window.location.pathname !== '/login') {
    const currentUser = await fetchUserInfo();
    return { fetchUserInfo, currentUser };
  }

  return { fetchUserInfo };
}

const loginPath = '/login';

function getDisplayName(u?: Partial<CurrentUser>) {
  return u?.name || u?.phone || '当前陪玩';
}

function getUserTagText(u?: Partial<CurrentUser>) {
  // 你后端字段是 userType；这里给个友好展示
  if (!u?.userType) return '陪玩';
  if (u.userType === 'STAFF' || u.userType === 'PLAYER') return '陪玩';
  if (u.userType === 'ADMIN') return '管理员';
  return u.userType;
}

export const layout: RuntimeConfig['layout'] = ({ initialState }) => {
  const currentUser = initialState?.currentUser;

  return {
    // ✅ 不再固定展示一个“自带头像”，改成展示当前陪玩信息（头像+名字+标签）
    avatarProps: currentUser
        ? {
          src: currentUser.avatar,
          size: 'small',
          title: getDisplayName(currentUser),
          render: (_props: any, defaultDom: React.ReactNode) => {
            const menuItems = [
              {
                key: 'logout',
                label: '退出登录',
              },
            ];

            return (
                <Dropdown
                    placement="bottomRight"
            menu={{
              items: menuItems,
                  onClick: ({ key }) => {
                if (key === 'logout') {
                  localStorage.removeItem('token');
                  localStorage.removeItem('currentUser');
                  window.location.href = loginPath;
                }
              },
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
            {/* 头像 */}
            {currentUser.avatar ? (
                <Avatar src={currentUser.avatar} size="small" />
            ) : (
                <Avatar icon={<UserOutlined />} size="small" />
            )}

            {/* 默认展示：当前陪玩名称 */}
            <Typography.Text strong style={{ maxWidth: 140 }} ellipsis>
            {getDisplayName(currentUser)}
            </Typography.Text>

            {/* 默认展示：标签 */}
            <Tag style={{ marginInlineStart: 0 }}>{getUserTagText(currentUser)}</Tag>
            </Space>
            </Dropdown>
          );
          },
        }
        : undefined,

    title: process.env.APP_NAME || '蓝猫陪玩管理系统',

    // 保留你的 logout 方法（某些版本 ProLayout 会用到）
    logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      window.location.href = loginPath;
    },

    onPageChange: () => {
      const token = localStorage.getItem('token');
      const pathname = window.location.pathname;

      // ✅ 只在需要鉴权的页面拦截，避免登录页/重置密码页被强制跳走
      const allowAnonymous = pathname === '/login' || pathname === '/reset-password';
      if (!token && !allowAnonymous) {
        window.location.href = loginPath;
        return;
      }
    },
  };
};

export const request: RuntimeConfig['request'] = {
  timeout: 10000,
  errorConfig: {
    errorHandler: (error: any) => {
      const { response } = error;

      if (response && response.status === 401) {
        message.error('登录已过期，请重新登录');
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        window.location.href = loginPath;
        return;
      }

      if (response && response.status === 403) {
        message.error(response.data?.message || '无权限访问');
        window.location.href = '/403';
        return;
      }

      if (response && response.status >= 400) {
        const errorMessage = response.data?.message || '请求失败';
        message.error(errorMessage);
        return;
      }

      message.error('网络错误，请检查网络连接');
      console.error('请求错误:', error);
    },
  },
  requestInterceptors: [
    (url: string, options: any) => {
      const token = localStorage.getItem('token');
      if (token) {
        options.headers.Authorization = `Bearer ${token}`;
      }
      options.headers['Content-Type'] = 'application/json';
      return { url, options };
    },
  ],
  responseInterceptors: [
    (response: any) => {
      return response;
    },
  ],
};
