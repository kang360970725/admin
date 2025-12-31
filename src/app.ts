import {RuntimeConfig} from '@umijs/max';
import {message} from 'antd';
import {getCurrentUser} from './services/api';

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
  fetchUserInfo?: () => Promise<CurrentUser | undefined>;
}> {
  const fetchUserInfo = async (): Promise<CurrentUser | undefined> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('未登录');
      }

      // 调用获取当前用户信息的接口
      const userInfo = await getCurrentUser();
      // 检查是否需要重置密码
      if (userInfo.needResetPwd && window.location.pathname !== '/reset-password') {
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
    return {
      fetchUserInfo,
      currentUser,
    };
  }

  return {
    fetchUserInfo,
  };
}
const loginPath = '/login';
export const layout: RuntimeConfig['layout'] = {
  logo: 'https://img.alicdn.com/tfs/TB1YHEpwUT1gK0jSZFhXXaAtVXa-28-27.svg',
  title: '蓝猫陪玩管理系统',
  logout: (initialState: any) => {
    // 清除本地存储
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');

    // 跳转到登录页
    window.location.href = '/login';

    // 可以调用后端退出接口（如果需要）
    // await logout();
  },
  onPageChange: () => {
    const token = localStorage.getItem('token');
    const { location } = history;
    document.title = process.env.APP_NAME || '蓝猫爽打管理系统';

    if (!token && location.pathname !== loginPath) {
      history.replace(loginPath);
    }
  },
};

export const request: RuntimeConfig['request'] = {
  timeout: 10000,
  errorConfig: {
    errorHandler: (error: any) => {
      const { response } = error;

      if (response && response.status === 401) {
        // token 过期或无效，跳转到登录页
        message.error('登录已过期，请重新登录');
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        window.location.href = '/login';
        return;
      }

      if (response && response.status >= 400) {
        const errorMessage = response.data?.message || '请求失败';
        message.error(errorMessage);
      }

      if (response && response.status === 403) {
        message.error(response.data?.message || '无权限访问');
        window.location.href = '/403';
        return;
      }

      else {
        message.error('网络错误，请检查网络连接');
      }

      console.error('请求错误:', error);
    },
  },
  requestInterceptors: [
    (url: string, options: any) => {
      // 添加 token 到请求头
      const token = localStorage.getItem('token');
      if (token) {
        options.headers.Authorization = `Bearer ${token}`;
      }

      // 添加其他通用头信息
      options.headers['Content-Type'] = 'application/json';

      return { url, options };
    },
  ],
  responseInterceptors: [
    (response: any) => {
      // 可以在这里处理通用响应逻辑
      return response;
    },
  ],
};
