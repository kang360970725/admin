# BlueCat System Admin 项目上下文

> 新会话编辑 `system-admin` 前优先读取本文。本文把后台路由、页面、API 和后端业务域串起来，避免只靠全局搜索定位而遗漏副作用。

## 项目定位

`system-admin` 是 Umi Max + Ant Design Pro 的后台/员工 Web 应用。

关键入口：

- 配置与路由：`config/config.ts`
- API 封装：`src/services/api.ts`
- 权限规则：`src/access.ts`
- 当前用户状态：`src/app.tsx`、`@@initialState`
- 页面目录：`src/pages`

环境/API：

- 开发环境通过 `/api` 代理到 `http://localhost:3000`。
- 生产环境当前指向 `https://api.lmsdclub.cn`。
- 大多数后端请求集中在 `src/services/api.ts`，页面从这里 import 具名函数。
- 页面备案号展示在 `src/app.tsx` 的 `rootContainer` 全局追加，样式在 `src/global.less`；当前备案号为 `蜀ICP备2026039511号-1`。

## 高风险改动规则

- 后台页面展示金额或预计金额时，必须以后端资金服务为准，前端预览只能作为展示。
- 员工状态、退店、提现 UI 改动必须同时检查后端 `users`、`wallet`、`wallet-withdrawals`、`offline-fee` 和 `src/access.ts`。
- 订单/工作台改动必须同时检查后端 `orders`、`wallet`、`performance`、`finance`、`notifications`，以及小程序订单页。
- 小程序内容配置改动必须检查后端 `system-config`、`mini/home`、`game-project`，以及 `client-miniapp` 页面。
- `src/services/api.ts` 已经包含很多业务域，也可能有现存未提交的 questionnaire 相关内容。改接口类型时要仔细看 diff。

## 路由与页面地图

路由集中声明在 `config/config.ts`。

| 路由 | 页面 | 后端业务/API |
|---|---|---|
| `/login` | `pages/Login` | `auth/login` |
| `/reset-password` | `pages/ResetPassword` | `users/me/password`、用户更新 |
| `/welcome` | `pages/Welcome` | 当前用户信息 |
| `/m/workbench`、`/workbench` | `pages/CSWorkbench` | 订单创建/列表/派单/存单/结单、打手选项、商品选项 |
| `/m/orders`、`/orders` | `pages/Orders` | `orders/list`、创建/更新/删除/退款/标记支付、派单动作 |
| `/orders/:id` | `pages/Orders/Detail` | 订单详情、派单参与者/进度、结算调整/修复、退款、客诉 |
| `/orders/complaints` | `pages/Orders/Complaints` | 客诉工单审核/退款 |
| `/staff/my-orders` | `pages/Staff/MyOrders` | `orders/my-dispatches`、枚举 |
| `/staff/workbench` | `pages/Staff/Workbench` | 打手接单/存单/结单/拒单、工作状态 |
| `/staff/questionnaires` | `pages/Staff/Questionnaires` | 我的问卷列表/详情/提交 |
| `/users/members` | `pages/Users` 会员场景 | 用户 CRUD、会员充值、游戏名片、优惠券 |
| `/users/staff` | `pages/Users` 打手场景 | 用户 CRUD、退店/清退、评级、规则、钱包统计 |
| `/users/internal` | `pages/Users` 后台人员场景 | 用户 CRUD、角色 |
| `/wallet/overview`、`/m/wallet` | `pages/Wallet/Overview` + `Withdrawals/Mine` | 钱包账户、我的提现/申请/提现信息、二维码上传、线下费用校验 |
| `/wallet/transactions` | `pages/Wallet/Transactions` | 钱包流水、枚举 |
| `/wallet/replay-preview` | `pages/Wallet/ReplayPreview` | 钱包重放、审计、修复、回滚 |
| `/wallet/withdrawals` | `pages/Wallet/Withdrawals` | 待审核提现、审核 |
| `/wallet/withdrawals/records` | `pages/Wallet/Withdrawals/Records` | 提现记录、提现对账汇总 |
| `/wallet/member-levels` | `pages/Wallet/MemberLevels` | 会员等级 |
| `/wallet/recharge-plans` | `pages/Wallet/RechargePlans` | 会员充值方案、优惠券模板 |
| `/finance/dashboard` | `pages/Finance/Dashboard` | 财务对账/看板 API |
| `/finance/records` | `pages/Finance/Records` | 财务明细列表 |
| `/finance/offline-fees` | `pages/Finance/OfflineFees` | 线下费用账单、生成、缴费、减免、退款、提醒、强制全额 |
| `/finance/equipment-rental-fees` | `pages/Finance/EquipmentRentalFees` | 设备租赁配置、自动账单、余额不足警示、账单减免 |
| `/performance/dashboard` | `pages/Performance/Dashboard` | 业绩概览/列表 |
| `/goods/list` | `pages/System/GameProjectManagement` | 商品 CRUD、评价、上传、候选项 |
| `/goods/categories` | `pages/System/GoodsCategoryManagement` | 商品分类树配置 |
| `/goods/tags` | `pages/System/GoodsTagManagement` | 商品标签配置 |
| `/system/system-configs` | `pages/System/SystemConfigs` | 通用系统配置、员工规则引擎 |
| `/system/role-management` | `pages/System/RoleManagement` | 角色与权限 |
| `/system/permission-management` | `pages/System/PermissionManagement` | 权限树、新增、删除 |
| `/system/app-versions` | `pages/System/AppVersions` | 版本列表、保存、激活、公开最新 |
| `/system/announcements` | `pages/System/Announcements` | 公告配置 |
| `/system/questionnaires` | `pages/System/Questionnaires` | 问卷管理、统计 |
| `/system/duty-cs` | `pages/System/DutyCsSchedules` | 当班客服、请假 |
| `/system/notification-test-push` | `pages/System/NotificationTestPush` | 实时通知测试推送 |
| `/miniapp-config/home` | `pages/System/MiniappHomeConfig` | 小程序首页配置、候选项、发布 |
| `/miniapp-config/protocols` | `pages/System/MiniappProtocols` | 小程序协议分类/协议、公开预览 |
| `/ops/coupons` | `pages/System/Coupons` | 优惠券模板、发券、用户券 |
| `/ops/chest-demo`、`/m/chest`、`/chest-event` | 宝盒相关页面 | 宝盒 admin/my/public API |
| `/penalties` | `pages/System/Penalties` | 罚单规则、罚单、申诉、资金池、统计、我的罚单 |
| `/staff-ratings` | `pages/StaffRatings` | 员工评级 CRUD；列表展示创建/修改时间，必须转北京时间 |
| `/user-logs` | `pages/UserLogs` | 操作日志列表/详情、枚举 |
| `/menu`、`/menu/:id` | 公开菜单页面 | 商品公开菜单、公开协议 |

## 权限规则

权限逻辑在 `src/access.ts`。

- `EXITED` / `BLACKLISTED` 员工不具备派单资格：工作台和我的接单记录由 `isDispatchEligibleStaff` 阻断。
- 钱包路由相对宽松；后端 `UserStatusGuard` 也允许冻结用户访问钱包相关接口。
- 管理员类型在部分用户管理场景有旁路能力，但多数菜单仍由 permissions key 控制。
- 当前页面级权限已经按新增岗位拆分为细分 key；历史粗权限如 `system:role:page`、`finance:records:list` 只作为兼容兜底，不应再作为新页面默认权限。
- 权限管理和角色配置使用后端 `Permission.parentId` 形成权限树；`menu:*` 是目录节点，仅用于呈现菜单位置，角色保存时只保存真实权限节点。
- 新增页面时必须让权限 key 同时出现在 `config/config.ts` 路由 access、`src/access.ts`、后端 `prisma/seed.ts` 的树形 `parentKey` 和对应 controller 的 `@Permissions` 中。
- 用户管理入口严格按 `users:member:page`、`users:staff:page`、`users:internal:page` 展示；普通 `ADMIN` 不因身份自动看到会员/后台人员。“全部用户”入口隐藏。用户管理现有按钮已改为可配置权限，并挂在对应页面节点下：会员页使用 `users:member:*:button`，打手页使用 `users:staff:*:button`，后台人员页使用 `users:internal:*:button`。
- 页面权限只控制入口；按钮权限控制动作。打手管理顶部员工资金统计属于敏感汇总，仅 `SUPER_ADMIN` 或拥有 `users:staff:wallet-stats:button` 的角色展示和加载。
- 订单模块按钮级权限已落地到对应页面节点：客服工作台创建订单 `orders:workbench:create:button`，订单列表创建/删除 `orders:list:create:button`、`orders:list:delete:button`；订单详情业务按钮统一挂在 `orders:detail:page` 下。详情页刷新、返回、钱包/订单导航不做按钮权限。
- 待修复：当前后端存在 `User.userType = SUPER_ADMIN` 与 `Role.name = FINANCE_ADMIN` 语义混用。下次权限开发需优先拆清：新增/明确 `SUPER_ADMIN` 角色，`FINANCE_ADMIN` 回归财务管理员，移除 `FINANCE_ADMIN` 全局放行，并通过 Prisma migration 随发布修正。

新增路由时通常需要同时改：

1. `config/config.ts` 路由和 `access` 字段。
2. `src/access.ts` 中对应能力，如果不能复用已有能力。
3. 后端 `prisma/seed.ts` 权限种子和对应 controller 的 `@Permissions`，确保角色管理能分配、接口也能校验。

## 环境与域名

- 生产 API 域名为 `https://api.lmsdclub.cn`。
- `config/config.ts` 负责按 `UMI_ENV` 注入 `process.env.API_BASE`；生产环境不要再硬编码旧的 `http://api.welax-tech.com`。
- `src/app.tsx` 的刷新接口和 `src/services/api.ts` 的业务接口都应读取 `process.env.API_BASE`。

## 重点页面说明

### 管理页布局约定

- 同一业务页存在多个主数据视图时，使用 `Tabs` 分开，例如“配置 / 账单 / 记录”；不要上下堆叠多个主表格。
- 页面首屏保留当前任务的主表或主操作，辅助说明用轻量提示，不要用上下多块大 Card 拉长操作路径。

### 订单 / 客服工作台

文件：

- `src/pages/Orders/index.tsx`
- `src/pages/CSWorkbench/index.tsx`

规则：

- 两个入口都可按客户游戏 ID 查询订单消费记录，并支持 `YYYY-MM` 月份维度筛选。
- 查询客户游戏 ID 后，需要展示当前筛选命中的全量统计，不只统计当前分页：订单数、应付合计、实付合计。
- 统计数据来自 `getOrders` 返回的 `summary.receivableAmount/paidAmount`；前端不要自行用当前页数据累加。

### 我的提现 / 钱包概览

文件：`src/pages/Wallet/Withdrawals/Mine.tsx`。

依赖：

- `getWithdrawInfo`
- `getOfflineFeeGuardInfo`
- `applyWithdrawal`
- `getMyWithdrawals`
- `getWithdrawQrCodeUrl`
- `uploadWithdrawQrCode`

规则：

- 保证金预览必须与后端 `wallet-withdrawals.service.ts` 保持一致。
- 只有 `STAFF + ACTIVE` 才展示/计算“保证金补充”。
- `EXITED` 退店员工可以提现已释放余额，不应再扣保证金。
- `OFFLINE` 员工提现前可能需要补缴线下费用。
- 员工规则引擎配置项包括：押金金额、首次提现最低保留、首次提现需接单满 N 天、退店冷却期、押金不退限制、自动冻结周期。
- 系统配置页采用“默认规则 + 标签规则”形式：默认规则用于未配置/未命中的员工；每条标签规则内直接维护标签名称、标签编码和规则字段，标签与规则一对一绑定，不再先建标签再多选关联规则。
- `firstWithdrawMinAcceptedDays` 未配置时后端默认 15 天；`dormantFreezeDays` 未配置时后端默认 7 天。

### 用户管理

文件：`src/pages/Users/index.tsx` 和 `src/pages/Users/components/*`。

特点：

- 同一页面按路由处理会员、打手、后台人员、全部用户。
- 新增员工时必须填写手机号、真实姓名、身份证号；后端会用这 3 个信息匹配历史员工账号，任一相同都视为重复。
- 已退店员工重新入店由后端复用原账号；未满退店冷却期时，创建接口会返回 `STAFF_REJOIN_COOLDOWN_CONFIRM_REQUIRED`，前端需弹出二次确认并提示风险，确认后携带 `forceRejoin=true` 重试。
- 重新入店会清零该员工账户中的所有正数余额，负数余额不处理；黑名单员工不可重新入店。
- 退店使用 `getStaffExitPreview`、`exitStaffShop`、`clearStaffAssets`。
- 员工列表只有 `ACTIVE/FROZEN` 展示退店、清退按钮；`EXITED/BLACKLISTED` 不展示，后端接口也会拒绝重复操作。
- 员工状态展示/编辑会影响后端员工生命周期，改动时检查 `server/src/users/users.service.ts`。
- 钱包抽屉能手动缴纳保证金、查看钱包流水/保证金流水，属于资金敏感页面。

### 线下费用

文件：`src/pages/Finance/OfflineFees/index.tsx`。

- 线下费用账单只允许管理员手动生成：页面选择账单月份并确认后调用 `generateOfflineFeeBills({ month, confirmed: true })`。
- 后端不再通过定时任务或提现校验自动生成账单；提现前只检查已存在的上月账单。
- 列表月份筛选必须使用精确到月的选择器，传给后端的 `billMonth` 格式为 `YYYY-MM`。
- 员工筛选必须传 `userId`，不要用 `user.name` 或嵌套字段作为筛选参数。
- 账单可先废除为 `WAIVED`；只有已废除且无缴费记录的账单才展示删除入口并允许删除。

### 设备租赁费

文件：

- `src/pages/Finance/EquipmentRentalFees/index.tsx`
- 员工确认入口：`src/pages/Wallet/Withdrawals/Mine.tsx`

规则：

- 财务管理下维护设备租赁配置：员工、月租金额、起租日、结束日、启停状态；配置精确到日，不再只配月份。
- 租赁配置选择陪玩时不限制在线/空闲；只要员工未退店、未拉黑，即 `ACTIVE/FROZEN`，都可被搜索并配置。
- 系统自动生成月账单，也可在页面手动生成指定月份；账单月份是缴费月份，缴费日按起租日落到下一月，例如 8 月 15 日起租，首张账单为 9 月 15 日缴费。
- 陪玩必须在钱包/提现页主动确认设备租赁账单，确认后直接扣可用余额。
- 后台租赁账单支持管理员手动缴费，逻辑同陪玩确认：直接扣可用余额，并要求扣费后总资产不能小于 0。
- 扣费允许可用余额变负，但后端要求可用余额 + 冻结余额扣费后不能小于 0。
- 提现前后端会校验已出账和下月即将出账的设备租赁费，提现后总资产不足时拒绝申请。
- 财务账单列表用 `insufficient` 标识余额不足风险，并提供“仅余额不足”筛选。

### 订单与工作台

文件：

- `src/pages/Orders/index.tsx`
- `src/pages/Orders/Detail.tsx`
- `src/pages/CSWorkbench/index.tsx`
- `src/pages/Staff/Workbench/index.tsx`

后端影响：

- 派单动作可能改变订单状态、参与者、结算、钱包冻结、业绩/财务记录、员工工作状态、日志、通知。
- 订单详情页包含修复/重算工具；以后端服务行为为准，不要只改前端按钮或文案。
- 订单回退/客服强制存结单要检查当前派单是否有有效打手：`Orders/Detail.tsx` 会在当前轮无活跃且未拒单参与者时禁用“客服存单/客服结单”；后端 `orders.service.ts` 仍会做最终校验。
- 后端结算允许跳过历史 `ARCHIVED` 空轮次，但当前 `COMPLETED` 结单轮为空必须失败；前端不要通过隐藏历史轮次来规避后端核算规则。

### 小程序配置

涉及页面：

- `System/MiniappHomeConfig`
- 商品、分类、标签页面
- 优惠券
- 公告
- 协议

可见内容链路：

1. 后台配置页面。
2. 后端 admin 写接口。
3. 后端 `/mini/*` 公开读接口。
4. 小程序页面渲染和 fallback。

## API 函数分组

`src/services/api.ts` 大致分段：

- 登录、用户、会员基础能力。
- 商品、公开菜单、上传。
- 订单、派单、结算、员工派单。
- 钱包账户、流水、冻结、重放、异常修复。
- 看板、财务、业绩。
- 提现、线下费用校验。
- 系统配置、员工规则引擎、小程序配置、协议、商品配置、版本。
- 线下费用。
- 问卷。
- 通知、操作日志。
- 罚单。
- 宝盒。

改 API 签名时，先通过页面 import 定位所有调用方，再改类型和页面。

## 验证方式

- 构建：在 `system-admin` 下执行 `yarn build:dev`。
- 如果沙箱阻止写 `node_modules/.cache/logger/umi.log`，需要提升权限重跑；这是构建缓存输出，不代表代码错误。
- 项目没有明显的前端单元测试，通常使用构建 + 目标页面手动验证。

## 跨项目上下文

配合阅读：

- 后端：`../server/docs/PROJECT_CONTEXT.md`
- 小程序：`../client-miniapp/docs/PROJECT_CONTEXT.md`
