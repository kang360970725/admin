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
    API_BASE: 'https://api.example.com',
    APP_NAME: '蓝猫陪玩管理系统',
  },
};

// 安全获取环境配置
const getEnv = (): keyof typeof envConfig => {
  const env = process.env.UMI_ENV || 'development';
  return env in envConfig ? env as keyof typeof envConfig : 'development';
};

const currentEnv = getEnv();
const config = envConfig[currentEnv];

export default defineConfig({
  // 运行时定义环境变量
  define: {
    'process.env.UMI_ENV': currentEnv,
    'process.env.API_BASE': config.API_BASE,
    'process.env.APP_NAME': config.APP_NAME,
  },

  access: {},
  // Umi Max 核心插件
  model: {},
  initialState: {},
  request: {},
  layout: {
    title: config.APP_NAME,
  },

  // 路由配置
  routes: [
    {
      path: '/login',
      component: '@/pages/Login',
      layout: false,
    },
    {
      path: '/',
      redirect: '/users',
    },
    {
      path: '/system',
      name: '系统管理',
      icon: 'SettingOutlined',
      // access: 'canAccessUserManager', // 需要有用户管理权限才能访问系统管理
      routes: [
        // ... 其他系统管理路由
        {
          path: '/system/role-management',
          name: '角色管理',
          component: './System/RoleManagement',
          // access: 'canAccessUserManager', // 同用户管理权限
        },
        {
          path: '/system/permission-management',
          name: '权限管理',
          component: './System/PermissionManagement',
          // access: 'canAccessUserManager',
        },
        {
          path: '/system/game-project-management',
          name: '菜单项目管理',
          component: '@/pages/System/GameProjectManagement',
          // access: 'canAccessUserManager',
        },
      ],
    },
    {
      path: '/bill',
      name: '订单管理',
      icon: 'FileTextOutlined',
      // access: 'canAccessBillManager',
      routes: [
        {
          path: '/bill/list',
          name: '订单列表',
          component: '@/pages/Bill/BillList',
          // access: 'canAccessBillManager',
        },
        {
          path: '/bill/create',
          name: '创建订单',
          component: '@/pages/Bill/CreateBill',
          // access: 'canAccessBillManager',
        },
        // 后续添加其他订单相关页面
      ],
    },
    {
      name: '用户管理',
      path: '/users',
      component: '@/pages/Users',
      icon: 'user',
      // access: 'canAccessUserManager',
    },
    {
      name: '重置密码',
      path: '/reset-password',
      component: '@/pages/ResetPassword',
      layout: false,
    },
    {
      name: '评级管理',
      path: '/staff-ratings',
      component: '@/pages/StaffRatings',
      icon: 'star',
      // access: 'canAccessRatingManager',
    },

  ],

  npmClient: 'yarn',

  // 代理配置 - 只在开发环境生效
  proxy: currentEnv === 'development' ? {
    '/api': {
      target: config.API_BASE,
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    },
  } : undefined,
});
