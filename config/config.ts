// config/config.ts
import { defineConfig } from '@umijs/max';
import fs from 'node:fs';
import path from 'node:path';

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
    API_BASE: 'https://api.lmsdclub.cn',
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

function readManifest(): { version?: string; buildId?: string } {
  try {
    const target = path.resolve(__dirname, '../public/version-manifest.json');
    const raw = fs.readFileSync(target, 'utf8');
    const json = JSON.parse(raw);
    return {
      version: String(json?.version || '').trim() || undefined,
      buildId: String(json?.buildId || '').trim() || undefined,
    };
  } catch {
    return {};
  }
}

const manifest = readManifest();
const appVersion = process.env.APP_VERSION || manifest.version || '0.0.0';
// 关键：默认与 version-manifest 对齐，避免线上长期不一致导致强制刷新循环弹窗
const appBuildId = process.env.APP_BUILD_ID || manifest.buildId || `${currentEnv}-${appVersion}`;

export default defineConfig({
  title: config.APP_NAME, // ✅ 浏览器 Tab 标题
  links: [{ rel: 'icon', href: '/favicon.ico' }],

  // 运行时定义环境变量
  define: {
    'process.env.UMI_ENV': currentEnv,
    'process.env.API_BASE': config.API_BASE,
    'process.env.APP_NAME': config.APP_NAME,
    'process.env.APP_VERSION': appVersion,
    'process.env.APP_BUILD_ID': appBuildId,
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
    { path: '/menu', component: '@/pages/PublicMenuGallery', layout: false },
    { path: '/menu/:id', component: '@/pages/PublicMenu/Detail', layout: false },
    { path: '/chest-event', component: '@/pages/PublicChest/index', layout: false },
    { path: '/login', component: '@/pages/Login', layout: false },
    { name: '重置密码', path: '/reset-password', component: '@/pages/ResetPassword', layout: false },
    { path: '/403', component: '@/pages/403'},

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

        // ✅ 移动端服务者在线看板（创建订单 + 存单/待派/待接）
        { path: '/m/workbench', component: '@/pages/CSWorkbench', access: 'canViewCSWorkbench' },

        // ✅ 移动端快速查单：先复用订单列表（你后续可以做轻量页再替换组件）
        { path: '/m/orders', component: './Orders', access: 'canViewOrdersList' },

        // ✅ 移动端钱包：先复用概览页（后续可以做轻量钱包页再替换组件）
        { path: '/m/wallet', component: '@/pages/Wallet/Overview', access: 'canViewWalletOverview' },
        { path: '/m/chest', component: '@/pages/Mobile/Chest', access: 'canViewChestDemo' },

        // ✅ 兜底 404（移动端）
        { path: '*', component: '@/pages/404', layout: false },
      ],
    },

    // ===========
    // Desktop routes (ProLayout)
    // ===========
    // ✅ 新增欢迎页：登录后的默认入口
    { path: '/welcome', name: '欢迎页', component: '@/pages/Welcome', icon: 'smile' },

    // {
    //   path: '/dashboard',
    //   name: '数据看板',
    //   icon: 'DashboardOutlined',
    //   access: 'canViewDashboard',
    //   routes: [
    //     { path: '/dashboard', redirect: '/dashboard/revenue' },
    //     { path: '/dashboard/revenue', name: '营业额看板', component: '@/pages/Dashboard/RevenueOverview' },
    //   ],
    // },

    {
      path: '/performance/dashboard',
      icon: 'AuditOutlined',
      name: '业绩看板',
      component: './Performance/Dashboard',
      access: 'canViewPerformanceDashboard',
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
        { path: '/system/system-configs', name: '基础配置', component: '@/pages/System/SystemConfigs', access: 'canViewSystemConfigs' },
        { path: '/system/app-versions', name: '版本迭代', component: '@/pages/System/AppVersions', access: 'canViewAppVersions' },
        { path: '/system/announcements', name: '系统公告', component: '@/pages/System/Announcements', access: 'canViewAnnouncements' },
        { path: '/system/questionnaires', name: '匿名问卷', component: '@/pages/System/Questionnaires', access: 'canViewQuestionnairesAdmin' },
        { path: '/system/duty-cs', name: '当班客服配置', component: '@/pages/System/DutyCsSchedules', access: 'canViewDutyCsSchedules' },
        { path: '/system/notification-test-push', name: '测试推送中心', component: '@/pages/System/NotificationTestPush', access: 'canViewNotificationTestPush' },
      ],
    },
    {
      path: '/goods',
      name: '商品管理',
      icon: 'ShopOutlined',
      routes: [
        { path: '/goods', redirect: '/goods/list' },
        { path: '/goods/list', name: '商品列表', component: '@/pages/System/GameProjectManagement', access: 'canViewGameProjectManagement' },
        { path: '/goods/categories', name: '分类管理', component: '@/pages/System/GoodsCategoryManagement', access: 'canViewGameProjectManagement' },
        { path: '/goods/tags', name: '标签管理', component: '@/pages/System/GoodsTagManagement', access: 'canViewGameProjectManagement' },
      ],
    },
    { path: '/system/game-project-management', redirect: '/goods/list', hideInMenu: true },
    {
      path: '/ops',
      name: '推广运营',
      icon: 'GiftOutlined',
      routes: [
        { path: '/ops/chest-demo', name: '宝盒活动', component: '@/pages/System/ChestDemo', access: 'canViewChestDemo' },
        { path: '/ops/coupons', name: '优惠券管理', component: '@/pages/System/Coupons', access: 'canViewCoupons' },
      ],
    },
    { path: '/system/coupons', redirect: '/ops/coupons', hideInMenu: true },
    {
      path: '/miniapp-config',
      name: '小程序功能配置',
      icon: 'AppstoreOutlined',
      routes: [
        { path: '/miniapp-config/home', name: '首页配置', component: '@/pages/System/MiniappHomeConfig', access: 'canViewMiniappHomeConfig' },
        { path: '/miniapp-config/customer-service', name: '客服二维码配置', component: '@/pages/System/MiniappCustomerServiceConfig', access: 'canViewMiniappCustomerServiceConfig' },
        { path: '/miniapp-config/protocols', name: '协议维护', component: '@/pages/System/MiniappProtocols', access: 'canViewMiniappProtocols' },
      ],
    },
    { path: '/system/penalties', redirect: '/penalties', hideInMenu: true },
    { path: '/penalties', name: '罚单管理', icon: 'SafetyOutlined', component: '@/pages/System/Penalties', access: 'canViewPenalties' },
    {
      path: '/user-logs',
      name: '操作日志',
      icon: 'FileSearchOutlined',
      component: './UserLogs',
      access: 'canViewUserLogs'
    },
    // {
    //   path: '/finance',
    //   name: '财务核账',
    //   icon: 'AuditOutlined',
    //   access: 'canViewFinanceReconcile',
    //   routes: [
    //     { path: '/finance', redirect: '/finance/reconcile' },
    //     { path: '/finance/reconcile', name: '核账报表', component: '@/pages/Finance/Reconcile', access: 'canViewFinanceReconcile' },
    //   ],
    // },
    {
      path: '/finance',
      name: '财务管理',
      icon: 'PieChartOutlined',
      routes: [
        {
          path: '/finance/dashboard',
          name: '财务看板',
          component: '@/pages/Finance/Dashboard',
          access: 'canViewFinanceDashboard',
        },
        {
          path: '/finance/records',
          name: '财务明细',
          component: '@/pages/Finance/Records',
          access: 'canViewFinanceReconcile',
        },
        {
          path: '/finance/offline-fees',
          name: '线下费用',
          component: '@/pages/Finance/OfflineFees',
          access: 'canViewFinanceOfflineFees',
        },
        {
          path: '/finance/equipment-rental-fees',
          name: '设备租赁费',
          component: '@/pages/Finance/EquipmentRentalFees',
          access: 'canViewFinanceEquipmentRentalFees',
        },
        {
          path: '/finance/rental-orders',
          name: '租号订单',
          component: '@/pages/Finance/RentalOrders',
          access: 'canViewRentalOrders',
        },
      ],
    },

    {
      path: '/staff',
      name: '服务者中心',
      icon: 'TeamOutlined',
      routes: [
        { path: '/staff/my-orders', name: '我的服务记录', component: './Staff/MyOrders',access: 'canViewMyOrders' },
        { path: '/staff/workbench', name: '服务者工作台', component: './Staff/Workbench', access: 'canViewWorkbench' },
        { path: '/staff/questionnaires', name: '信息采集', component: './Staff/Questionnaires', access: 'canViewStaffQuestionnaires' },
      ],
    },

    // ✅ PC端服务者在线看板入口保留（后台菜单中可见）
    { path: '/workbench', name: '服务者在线看板', icon: 'ThunderboltOutlined', component: '@/pages/CSWorkbench', access: 'canViewServiceOnlineBoard' },

    {
      path: '/orders',
      name: '订单管理',
      icon: 'ProfileOutlined',
      access: 'canViewOrdersList',
      routes: [
        { path: '/orders', name: '订单列表', component: './Orders', access: 'canViewOrdersList' },
        { path: '/orders/renewal-leaderboard', name: '续单榜单', component: './Orders/RenewalLeaderboard', access: 'canViewRenewalLeaderboard' },
        { path: '/orders/complaints', name: '客诉工单', component: './Orders/Complaints', access: 'canViewOrderComplaints' },
        { path: '/orders/:id', name: '订单详情', component: './Orders/Detail', hideInMenu: true, access: 'canViewOrderDetail' },
      ],
    },

    {
      path: '/wallet',
      name: '钱包',
      icon: 'WalletOutlined',
      routes: [
        { path: '/wallet', redirect: '/wallet/overview' },
        { path: '/wallet/overview', name: '账户概览', component: '@/pages/Wallet/Overview', access: 'canViewWalletOverview' },
        { path: '/wallet/member-levels', name: '会员等级', component: '@/pages/Wallet/MemberLevels', access: 'canViewWalletMemberLevels' },
        { path: '/wallet/recharge-plans', name: '充值方案', component: '@/pages/Wallet/RechargePlans', access: 'canViewWalletRechargePlans' },
        { path: '/wallet/member-recharges', name: '会员充值记录', component: '@/pages/Wallet/MemberRecharges', access: 'canViewWalletMemberRecharges' },
        { path: '/wallet/transactions', name: '流水明细', component: '@/pages/Wallet/Transactions', access: 'canViewWalletTransactions' },
        { path: '/wallet/deposit-reconciliation', name: '保证金对账', component: '@/pages/Wallet/DepositReconciliation', access: 'canViewWalletDepositReconciliation' },
        { path: '/wallet/replay-preview', name: '单用户预核算', component: '@/pages/Wallet/ReplayPreview', access: 'canViewWalletReplayPreview' },
        { path: '/wallet/withdrawals', name: '提现审批', component: '@/pages/Wallet/Withdrawals', access: 'canViewWithdrawals' },
        { path: '/wallet/withdrawals/records', name: '提现记录', component: '@/pages/Wallet/Withdrawals/Records', access: 'canViewWithdrawals' },
      ],
    },

    {
      path: '/users',
      name: '用户管理',
      icon: 'user',
      access: 'canViewUsers',
      routes: [
        { path: '/users', redirect: '/users/members' },
        { path: '/users/members', name: '会员管理', component: '@/pages/Users', access: 'canViewMemberUsers' },
        { path: '/users/staff', name: '服务者管理', component: '@/pages/Users', access: 'canViewStaffUsers' },
        { path: '/users/rental-risk', name: '租号风控查询', component: '@/pages/Users', access: 'canViewStaffRentalRisk' },
        { path: '/users/excellent-staff', name: '优秀服务者管理', component: '@/pages/Users/ExcellentStaff', access: 'canViewExcellentStaff' },
        { path: '/users/internal', name: '后台人员', component: '@/pages/Users', access: 'canViewInternalUsers' },
        { path: '/users/all', name: '全部用户', component: '@/pages/Users', access: 'canViewAllUsers', hideInMenu: true },
      ],
    },
    { name: '服务者评级', path: '/staff-ratings', component: '@/pages/StaffRatings', icon: 'star', access: 'canViewStaffRatings' },

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
