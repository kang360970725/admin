// config/config.ts
import { defineConfig } from '@umijs/max';

// 环境配置映射
const envConfig = {
  development: {
    API_BASE: 'http://localhost:3000',
    APP_NAME: '蓝猫陪玩管理系统-开发',
  },
  test: {
    API_BASE: 'http://test-api.example.com',
    APP_NAME: '蓝猫陪玩管理系统-测试',
  },
  pre: {
    API_BASE: 'http://pre-api.example.com',
    APP_NAME: '蓝猫陪玩管理系统-预发',
  },
  production: {
    // ✅ 生产环境直连后端（不走 /api 反代）
    API_BASE: 'http://api.welax-tech.com',
    APP_NAME: '蓝猫陪玩管理系统',
  },
};

// 安全获取环境配置
const getEnv = (): keyof typeof envConfig => {
  const env = process.env.UMI_ENV || 'development';
  return env in envConfig ? (env as keyof typeof envConfig) : 'development';
};

const currentEnv = getEnv();
const config = envConfig[currentEnv];

export default defineConfig({
  title: config.APP_NAME, // ✅ 浏览器 Tab 标题
  links: [{ rel: 'icon', href: '/favicon.ico' }],

  // 运行时定义环境变量
  define: {
    'process.env.UMI_ENV': currentEnv,
    'process.env.API_BASE': config.API_BASE,
    'process.env.APP_NAME': config.APP_NAME,
  },

  hash: true,
  access: {},
  model: {},
  initialState: {},
  request: {},

  layout: {
    title: config.APP_NAME,
  },

  routes: [
    // ===========
    // Auth / Public
    // ===========
    { path: '/login', component: '@/pages/Login', layout: false },
    { name: '重置密码', path: '/reset-password', component: '@/pages/ResetPassword', layout: false },
    { path: '/403', component: '@/pages/403', layout: false },

    // ===========
    // ✅ Mobile routes (pure content)
    // 说明：
    // - 你已在 app.tsx 中根据 pathname.startsWith('/m') 隐藏 ProLayout
    // - 这里仍建议显式 layout:false（更稳）
    // ===========
    {
      path: '/m',
      layout: false,
      routes: [
        // 移动端默认入口：工作台
        { path: '/m', redirect: '/m/workbench' },

        // ✅ 移动端客服工作台（创建订单 + 存单/待派/待接）
        { path: '/m/workbench', component: '@/pages/CSWorkbench', access: 'canViewCSWorkbench' },

        // ✅ 移动端快速查单：先复用订单列表（你后续可以做轻量页再替换组件）
        { path: '/m/orders', component: './Orders', access: 'canViewOrdersList' },

        // ✅ 移动端钱包：先复用概览页（后续可以做轻量钱包页再替换组件）
        { path: '/m/wallet', component: '@/pages/Wallet/Overview' },

        // ✅ 兜底 404（移动端）
        { path: '*', component: '@/pages/404', layout: false },
      ],
    },

    // ===========
    // Desktop routes (ProLayout)
    // ===========
    // ✅ 新增欢迎页：登录后的默认入口
    { path: '/welcome', name: '欢迎页', component: '@/pages/Welcome', icon: 'smile' },

    {
      path: '/dashboard',
      name: '数据看板',
      icon: 'DashboardOutlined',
      access: 'canViewDashboard',
      routes: [
        { path: '/dashboard', redirect: '/dashboard/revenue' },
        { path: '/dashboard/revenue', name: '营业额看板', component: '@/pages/Dashboard/RevenueOverview' },
      ],
    },

    // ✅ 根路径跳欢迎页
    { path: '/', redirect: '/welcome' },

    {
      path: '/system',
      name: '系统管理',
      icon: 'SettingOutlined',
      routes: [
        { path: '/system/role-management', name: '角色管理', component: './System/RoleManagement', access: 'canViewRoleManagement' },
        { path: '/system/permission-management', name: '权限管理', component: './System/PermissionManagement', access: 'canViewPermissionManagement' },
        { path: '/system/game-project-management', name: '菜单项目管理', component: '@/pages/System/GameProjectManagement', access: 'canViewGameProjectManagement' },
      ],
    },

    {
      path: '/staff',
      name: '陪玩中心',
      icon: 'TeamOutlined',
      routes: [
        { path: '/staff/workbench', name: '打手工作台', component: './Staff/Workbench', access: 'canViewWorkbench' },
      ],
    },

    // ✅ PC端客服工作台入口保留（后台菜单中可见）
    { path: '/workbench', name: '客服工作台', icon: 'ThunderboltOutlined', component: '@/pages/CSWorkbench', access: 'canViewCSWorkbench' },

    {
      path: '/orders',
      name: '订单管理',
      icon: 'ProfileOutlined',
      routes: [
        { path: '/orders', name: '订单列表', component: './Orders', access: 'canViewOrdersList' },
        { path: '/orders/:id', name: '订单详情', component: './Orders/Detail', hideInMenu: true, access: 'canViewOrderDetail' },
      ],
    },

    {
      path: '/wallet',
      name: '钱包',
      icon: 'WalletOutlined',
      routes: [
        { path: '/wallet', redirect: '/wallet/overview' },
        { path: '/wallet/overview', name: '账户概览', component: '@/pages/Wallet/Overview' },
        { path: '/wallet/transactions', name: '流水明细', component: '@/pages/Wallet/Transactions' },
        { path: '/wallet/withdrawals', name: '提现审批', component: '@/pages/Wallet/Withdrawals', access: 'canViewWithdrawals' },
        { path: '/wallet/withdrawals/records', name: '提现记录', component: '@/pages/Wallet/Withdrawals/Records', access: 'canViewWithdrawals' },
      ],
    },

    { name: '用户管理', path: '/users', component: '@/pages/Users', icon: 'user', access: 'canViewUsers' },
    { name: '评级管理', path: '/staff-ratings', component: '@/pages/StaffRatings', icon: 'star', access: 'canViewStaffRatings' },

    // ✅ 全局兜底 404
    { path: '*', component: '@/pages/404', layout: false },
  ],

  npmClient: 'yarn',

  // 代理配置 - 只在开发环境生效（生产环境不需要 /api）
  proxy:
      currentEnv === 'development'
          ? {
            '/api': {
              target: config.API_BASE,
              changeOrigin: true,
              pathRewrite: { '^/api': '' },
            },
          }
          : undefined,
});
