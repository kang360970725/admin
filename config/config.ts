// config/config.ts
import { defineConfig } from '@umijs/max';

// 环境配置映射
const envConfig = {
  development: {
    API_BASE: 'http://localhost:3000',
    APP_NAME: '蓝猫陪玩管理系统-开发',
  },
  test: {
    // 如需可改为你的测试后端
    API_BASE: 'http://test-api.example.com',
    APP_NAME: '蓝猫陪玩管理系统-测试',
  },
  pre: {
    // 如需可改为你的预发后端
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
  title: config.APP_NAME,   // ✅ 浏览器 Tab 标题
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

  // 路由配置（保持你现有不动）
  routes: [
    { path: '/login', component: '@/pages/Login', layout: false },

    // ✅ 新增欢迎页：登录后的默认入口
    { path: '/welcome', name: '欢迎页', component: '@/pages/Welcome', icon: 'smile' },

    {
      path: '/dashboard',
      name: '数据看板',
      icon: 'DashboardOutlined',
      routes: [
        { path: '/dashboard', redirect: '/dashboard/revenue' },
        {
          path: '/dashboard/revenue',
          name: '营业额看板',
          component: '@/pages/Dashboard/RevenueOverview',
        },
      ],
    },

    // ✅ 根路径跳欢迎页（原来是 /users）
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
        {
          path: '/wallet',
          redirect: '/wallet/overview',
        },
        {
          path: '/wallet/overview',
          name: '账户概览',
          component: '@/pages/Wallet/Overview',
          // access: 'canViewWallet', // 先不加，避免 access 未定义导致看不到
        },
        {
          path: '/wallet/transactions',
          name: '流水明细',
          component: '@/pages/Wallet/Transactions',
        },
        {
          path: '/wallet/holds',
          name: '冻结单',
          component: '@/pages/Wallet/Holds',
        },
        {
          path: '/wallet/withdrawals',
          name: '提现审批',
          component: '@/pages/Wallet/Withdrawals',
          access: 'canViewWithdrawals', // ✅ 新增权限点（下一步在 access.ts 里加）
        },
        {
          path: '/wallet/withdrawals/records',
          name: '提现记录',
          component: '@/pages/Wallet/Withdrawals/Records',
          access: 'canViewWithdrawals',
        },
        {
          path: '/wallet/withdrawals/mine',
          name: '提现申请',
          component: '@/pages/Wallet/Withdrawals/Mine',
          access: 'canViewWithdrawals', // 你也可以改成单独权限，例如 canApplyWithdrawal
        },
      ],
    },
    { name: '用户管理', path: '/users', component: '@/pages/Users', icon: 'user', access: 'canViewUsers' },
    { name: '重置密码', path: '/reset-password', component: '@/pages/ResetPassword', layout: false },
    { name: '评级管理', path: '/staff-ratings', component: '@/pages/StaffRatings', icon: 'star', access: 'canViewStaffRatings' },
    { path: '/403', component: '@/pages/403', layout: false },
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
