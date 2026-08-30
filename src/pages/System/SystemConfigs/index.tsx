import React, { useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Divider, Form, Input, InputNumber, message, Modal, Segmented, Select, Space, Switch, Tag, Typography } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { listSystemConfigs, StaffRuleEngineConfig, SystemConfigItem, upsertStaffRuleEngineConfig, upsertSystemConfig } from '@/services/api';

const { Text } = Typography;

const valueTypeOptions = [
  { label: '数字', value: 'NUMBER' },
  { label: '字符串', value: 'STRING' },
  { label: '布尔', value: 'BOOLEAN' },
  { label: 'JSON', value: 'JSON' },
];

const hiddenKeys = new Set([
  'miniapp_home_config',
  'miniapp_home_config_draft',
  'miniapp_home_config_published',
  'miniapp_protocols',
  'goods_category_tree',
  'goods_tag_list',
  // 自动到账方案经调研暂不可行，先从后台配置入口屏蔽；H5 微信授权绑定能力保留给会员 H5 复用。
  'withdraw_auto_transfer_enabled',
  'withdraw_wechat_transfer_enabled',
  'withdraw_wechat_transfer_mock',
  'withdraw_auto_single_limit',
  'withdraw_auto_first_limit',
  'withdraw_auto_user_day_limit',
  'withdraw_auto_user_month_limit',
  'withdraw_auto_platform_day_limit',
  'withdraw_auto_eligibility',
  'wechat_transfer_scene_id',
  'wechat_transfer_notify_url',
  'wechat_transfer_appid',
  'wechat_transfer_appsecret',
]);

const categoryMeta = {
  ALL: { label: '全部配置', color: 'default' },
  WECHAT: { label: '微信配置', color: 'green' },
  PAYMENT: { label: '支付回调', color: 'blue' },
  COS: { label: '对象存储', color: 'magenta' },
  FINANCE: { label: '资金/费用规则', color: 'gold' },
  OTHER: { label: '其他配置', color: 'default' },
} as const;

type CategoryKey = keyof typeof categoryMeta;

type SubscribeTemplateSection = {
  enabled?: boolean;
  title?: string;
  description?: string;
  templateId?: string;
  page?: string;
  fields?: Record<string, string>;
};

type SubscribeTemplateConfig = {
  orderProgress: SubscribeTemplateSection;
  memberAsset: SubscribeTemplateSection;
  afterSalesResult: SubscribeTemplateSection;
  marketingActivity: SubscribeTemplateSection;
};

const SUBSCRIBE_TEMPLATE_CONFIG_KEY = 'wechat_mini_subscribe_message_templates';
const STAFF_RULE_ENGINE_CONFIG_KEY = 'staff_rule_engine_v1';

const subscribeTemplateFieldMeta = {
  orderProgress: {
    label: '订单进度提醒',
    description: '建议用于待派单、待接单、服务中、待评价、已评价、退款等状态变化',
    fields: [
      { key: 'orderNo', label: '订单号字段' },
      { key: 'projectName', label: '商品名称字段' },
      { key: 'status', label: '状态字段' },
      { key: 'updatedAt', label: '时间字段' },
      { key: 'remark', label: '备注字段' },
    ],
  },
  memberAsset: {
    label: '会员资产变动提醒',
    description: '建议用于积分到账、成长值变动、退款回退、钱包资产变化',
    fields: [
      { key: 'assetType', label: '资产类型字段' },
      { key: 'changeAmount', label: '变动金额字段' },
      { key: 'balanceAfter', label: '变动后余额字段' },
      { key: 'updatedAt', label: '时间字段' },
      { key: 'remark', label: '备注字段' },
    ],
  },
  afterSalesResult: {
    label: '售后/退款处理结果提醒',
    description: '建议用于审核通过、审核驳回、退款完成等结果提醒',
    fields: [
      { key: 'orderNo', label: '订单号字段' },
      { key: 'result', label: '处理结果字段' },
      { key: 'refundAmount', label: '退款金额字段' },
      { key: 'reviewedAt', label: '处理时间字段' },
      { key: 'remark', label: '备注字段' },
    ],
  },
  marketingActivity: {
    label: '新玩法活动通知',
    description: '建议用于活动上新、限时玩法、福利发放提醒',
    fields: [
      { key: 'activityName', label: '活动名称字段' },
      { key: 'startAt', label: '开始时间字段' },
      { key: 'benefit', label: '福利亮点字段' },
      { key: 'remark', label: '补充说明字段' },
    ],
  },
} as const;

function getDefaultSubscribeTemplateConfig(): SubscribeTemplateConfig {
  return {
    orderProgress: {
      enabled: false,
      title: '订单进度提醒',
      description: '用于提醒订单创建、派单、接单、完成、退款等进度变化',
      templateId: '',
      page: '/pages/order-details/index',
      fields: {
        orderNo: 'character_string1',
        projectName: 'thing2',
        status: 'thing3',
        updatedAt: 'time4',
        remark: 'thing5',
      },
    },
    memberAsset: {
      enabled: false,
      title: '会员资产变动提醒',
      description: '用于提醒积分到账、成长值变动、退款回退等会员资产变化',
      templateId: '',
      page: '/pages/membership/index',
      fields: {
        assetType: 'thing1',
        changeAmount: 'thing2',
        balanceAfter: 'thing3',
        updatedAt: 'time4',
        remark: 'thing5',
      },
    },
    afterSalesResult: {
      enabled: false,
      title: '售后/退款处理结果提醒',
      description: '用于提醒售后审核通过、审核驳回、退款完成等结果',
      templateId: '',
      page: '/pages/after-sales/index',
      fields: {
        orderNo: 'character_string1',
        result: 'thing2',
        refundAmount: 'amount3',
        reviewedAt: 'time4',
        remark: 'thing5',
      },
    },
    marketingActivity: {
      enabled: false,
      title: '新玩法活动通知',
      description: '用于通知新玩法上新、活动开售、福利提醒',
      templateId: '',
      page: '/pages/index/index',
      fields: {
        activityName: 'thing1',
        startAt: 'time2',
        benefit: 'thing3',
        remark: 'thing4',
      },
    },
  };
}

function parseSubscribeTemplateConfig(row: SystemConfigItem | null | undefined): SubscribeTemplateConfig {
  const fallback = getDefaultSubscribeTemplateConfig();
  const raw = String(row?.value ?? '').trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw || '{}');
    return {
      orderProgress: {
        ...fallback.orderProgress,
        ...(parsed?.orderProgress || {}),
        fields: { ...fallback.orderProgress.fields, ...(parsed?.orderProgress?.fields || {}) },
      },
      memberAsset: {
        ...fallback.memberAsset,
        ...(parsed?.memberAsset || {}),
        fields: { ...fallback.memberAsset.fields, ...(parsed?.memberAsset?.fields || {}) },
      },
      afterSalesResult: {
        ...fallback.afterSalesResult,
        ...(parsed?.afterSalesResult || {}),
        fields: { ...fallback.afterSalesResult.fields, ...(parsed?.afterSalesResult?.fields || {}) },
      },
      marketingActivity: {
        ...fallback.marketingActivity,
        ...(parsed?.marketingActivity || {}),
        fields: { ...fallback.marketingActivity.fields, ...(parsed?.marketingActivity?.fields || {}) },
      },
    };
  } catch {
    return fallback;
  }
}

function buildSubscribeTemplateConfigValue(values: any) {
  const current = values?.subscribeTemplates || {};
  const result = {
    orderProgress: {
      enabled: Boolean(current?.orderProgress?.enabled),
      title: String(current?.orderProgress?.title || '').trim(),
      description: String(current?.orderProgress?.description || '').trim(),
      templateId: String(current?.orderProgress?.templateId || '').trim(),
      page: String(current?.orderProgress?.page || '').trim(),
      fields: {
        orderNo: String(current?.orderProgress?.fields?.orderNo || '').trim(),
        projectName: String(current?.orderProgress?.fields?.projectName || '').trim(),
        status: String(current?.orderProgress?.fields?.status || '').trim(),
        updatedAt: String(current?.orderProgress?.fields?.updatedAt || '').trim(),
        remark: String(current?.orderProgress?.fields?.remark || '').trim(),
      },
    },
    memberAsset: {
      enabled: Boolean(current?.memberAsset?.enabled),
      title: String(current?.memberAsset?.title || '').trim(),
      description: String(current?.memberAsset?.description || '').trim(),
      templateId: String(current?.memberAsset?.templateId || '').trim(),
      page: String(current?.memberAsset?.page || '').trim(),
      fields: {
        assetType: String(current?.memberAsset?.fields?.assetType || '').trim(),
        changeAmount: String(current?.memberAsset?.fields?.changeAmount || '').trim(),
        balanceAfter: String(current?.memberAsset?.fields?.balanceAfter || '').trim(),
        updatedAt: String(current?.memberAsset?.fields?.updatedAt || '').trim(),
        remark: String(current?.memberAsset?.fields?.remark || '').trim(),
      },
    },
    afterSalesResult: {
      enabled: Boolean(current?.afterSalesResult?.enabled),
      title: String(current?.afterSalesResult?.title || '').trim(),
      description: String(current?.afterSalesResult?.description || '').trim(),
      templateId: String(current?.afterSalesResult?.templateId || '').trim(),
      page: String(current?.afterSalesResult?.page || '').trim(),
      fields: {
        orderNo: String(current?.afterSalesResult?.fields?.orderNo || '').trim(),
        result: String(current?.afterSalesResult?.fields?.result || '').trim(),
        refundAmount: String(current?.afterSalesResult?.fields?.refundAmount || '').trim(),
        reviewedAt: String(current?.afterSalesResult?.fields?.reviewedAt || '').trim(),
        remark: String(current?.afterSalesResult?.fields?.remark || '').trim(),
      },
    },
    marketingActivity: {
      enabled: Boolean(current?.marketingActivity?.enabled),
      title: String(current?.marketingActivity?.title || '').trim(),
      description: String(current?.marketingActivity?.description || '').trim(),
      templateId: String(current?.marketingActivity?.templateId || '').trim(),
      page: String(current?.marketingActivity?.page || '').trim(),
      fields: {
        activityName: String(current?.marketingActivity?.fields?.activityName || '').trim(),
        startAt: String(current?.marketingActivity?.fields?.startAt || '').trim(),
        benefit: String(current?.marketingActivity?.fields?.benefit || '').trim(),
        remark: String(current?.marketingActivity?.fields?.remark || '').trim(),
      },
    },
  };
  return JSON.stringify(result, null, 2);
}

function getDefaultStaffRuleEngineConfig(): StaffRuleEngineConfig {
  const defaultRule = {
    id: 'default_rule',
    name: '默认规则',
    enabled: true,
    priority: -1,
    tagCodes: [],
    depositAmount: 500,
    firstWithdrawMinBalance: 1000,
    firstWithdrawMinAcceptedDays: 15,
    quitCoolingDays: 180,
    depositForfeitDays: 30,
    dormantFreezeDays: 7,
    settlementFreezeExperienceDays: 3,
    settlementFreezeRegularDays: 7,
    refundWhenDepositInsufficient: true,
  };
  return {
    tags: [],
    rules: [],
    defaultRule,
  };
}

function parseStaffRuleEngineConfig(row: SystemConfigItem | null | undefined): StaffRuleEngineConfig {
  const fallback = getDefaultStaffRuleEngineConfig();
  const raw = String(row?.value ?? '').trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw || '{}');
    const tags = Array.isArray(parsed?.tags) ? parsed.tags : [];
    const tagMap = new Map<string, { code: string; name: string; enabled: boolean; sort: number }>(
      tags.map((item: any, index: number) => [
        String(item?.code || '').trim().toLowerCase(),
        {
          code: String(item?.code || '').trim().toLowerCase(),
          name: String(item?.name || '').trim(),
          enabled: item?.enabled !== false,
          sort: Number.isFinite(Number(item?.sort)) ? Number(item.sort) : index + 1,
        },
      ]),
    );
    const defaultRule = {
      ...fallback.defaultRule,
      ...(parsed?.defaultRule && typeof parsed.defaultRule === 'object' ? parsed.defaultRule : {}),
      id: 'default_rule',
      name: '默认规则',
      enabled: true,
      tagCodes: [],
      dormantFreezeDays: Number(parsed?.defaultRule?.dormantFreezeDays ?? fallback.defaultRule.dormantFreezeDays),
      settlementFreezeExperienceDays: Number(parsed?.defaultRule?.settlementFreezeExperienceDays ?? fallback.defaultRule.settlementFreezeExperienceDays),
      settlementFreezeRegularDays: Number(parsed?.defaultRule?.settlementFreezeRegularDays ?? fallback.defaultRule.settlementFreezeRegularDays),
    };
    const rules = Array.isArray(parsed?.rules)
      ? parsed.rules.map((item: any, index: number) => {
          const tagCode = String((Array.isArray(item?.tagCodes) ? item.tagCodes[0] : item?.tagCode) || '').trim().toLowerCase();
          const tag = tagMap.get(tagCode);
          return {
            ...item,
            id: String(item?.id || '').trim(),
            enabled: item?.enabled !== false,
            priority: Number.isFinite(Number(item?.priority)) ? Number(item.priority) : 0,
            tagCode,
            tagName: String(tag?.name || item?.tagName || '').trim(),
            tagEnabled: tag?.enabled !== false,
            sort: Number.isFinite(Number(tag?.sort)) ? Number(tag?.sort) : index + 1,
            tagCodes: tagCode ? [tagCode] : [],
            name: `${String(tag?.name || item?.tagName || item?.name || tagCode || `标签 ${index + 1}`).trim()}规则`,
            firstWithdrawMinAcceptedDays: Number(item?.firstWithdrawMinAcceptedDays ?? 15),
            dormantFreezeDays: Number(item?.dormantFreezeDays ?? 7),
            settlementFreezeExperienceDays: Number(item?.settlementFreezeExperienceDays ?? 3),
            settlementFreezeRegularDays: Number(item?.settlementFreezeRegularDays ?? 7),
          };
        })
      : [];
    return {
      tags,
      rules,
      defaultRule,
    };
  } catch {
    return fallback;
  }
}

function buildStaffRuleEngineConfigValue(values: any): StaffRuleEngineConfig {
  const current = values?.staffRuleEngine || {};
  const rawRules = Array.isArray(current?.rules) ? current.rules : [];
  const tags = rawRules
    .map((item: any, index: number) => ({
        code: String(item?.tagCode || item?.code || '').trim().toLowerCase(),
        name: String(item?.tagName || item?.name || '').trim(),
        enabled: item?.enabled !== false,
        sort: Number.isFinite(Number(item?.sort)) ? Number(item.sort) : index + 1,
      }))
    .filter((item: any) => item.code);
  const defaultRule = {
    ...getDefaultStaffRuleEngineConfig().defaultRule,
    ...(current?.defaultRule || {}),
    id: 'default_rule',
    name: '默认规则',
    enabled: true,
    tagCodes: [],
    depositAmount: Number(current?.defaultRule?.depositAmount ?? 500),
    firstWithdrawMinBalance: Number(current?.defaultRule?.firstWithdrawMinBalance ?? 1000),
    firstWithdrawMinAcceptedDays: Number(current?.defaultRule?.firstWithdrawMinAcceptedDays ?? 15),
    quitCoolingDays: Number(current?.defaultRule?.quitCoolingDays ?? 180),
    depositForfeitDays: Number(current?.defaultRule?.depositForfeitDays ?? 30),
    dormantFreezeDays: Number(current?.defaultRule?.dormantFreezeDays ?? 7),
    settlementFreezeExperienceDays: Number(current?.defaultRule?.settlementFreezeExperienceDays ?? 3),
    settlementFreezeRegularDays: Number(current?.defaultRule?.settlementFreezeRegularDays ?? 7),
    refundWhenDepositInsufficient: true,
  };
  const rules = rawRules
    .map((item: any, index: number) => {
      const tagCode = String(item?.tagCode || item?.code || '').trim().toLowerCase();
      const tagName = String(item?.tagName || item?.name || tagCode || `标签 ${index + 1}`).trim();
      return {
        id: String(item?.id || `${tagCode || `rule_${index + 1}`}_rule`).trim(),
        name: `${tagName}规则`,
        enabled: item?.enabled !== false,
        priority: Number.isFinite(Number(item?.priority)) ? Number(item.priority) : 0,
        tagCodes: tagCode ? [tagCode] : [],
        depositAmount: Number(item?.depositAmount ?? 0),
        firstWithdrawMinBalance: Number(item?.firstWithdrawMinBalance ?? 0),
        firstWithdrawMinAcceptedDays: Number(item?.firstWithdrawMinAcceptedDays ?? 15),
        quitCoolingDays: Number(item?.quitCoolingDays ?? 0),
        depositForfeitDays: Number(item?.depositForfeitDays ?? 0),
        dormantFreezeDays: Number(item?.dormantFreezeDays ?? 7),
        settlementFreezeExperienceDays: Number(item?.settlementFreezeExperienceDays ?? 3),
        settlementFreezeRegularDays: Number(item?.settlementFreezeRegularDays ?? 7),
        refundWhenDepositInsufficient: true,
      };
    });
  return { tags, rules, defaultRule };
}

function resolveCategory(row: SystemConfigItem): CategoryKey {
  const key = String(row.key || '').trim();
  if (key.startsWith('wechat_mini_') || key.startsWith('wechat_h5_')) return 'WECHAT';
  if (key === 'app_public_base_url' || key.startsWith('wechat_pay_')) return 'PAYMENT';
  if (key.startsWith('cos_')) return 'COS';
  if (key.startsWith('offline_fee_') || key.startsWith('withdraw_') || key.startsWith('wechat_transfer_')) return 'FINANCE';
  return 'OTHER';
}

function formatConfigValue(row: SystemConfigItem) {
  if (String(row.key || '').trim() === STAFF_RULE_ENGINE_CONFIG_KEY) {
    try {
      const parsed = parseStaffRuleEngineConfig(row);
      return `标签 ${parsed.tags.length} 个，规则 ${parsed.rules.length} 条`;
    } catch {
      return '服务者规则分组与提现/退店规则配置';
    }
  }
  const raw = String(row.value ?? '');
  if (row.valueType !== 'JSON') return raw || '-';
  try {
    return JSON.stringify(JSON.parse(raw || '{}'), null, 2);
  } catch {
    return raw || '-';
  }
}

const SystemConfigsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [editing, setEditing] = useState<SystemConfigItem | null>(null);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('ALL');
  const [dataSource, setDataSource] = useState<SystemConfigItem[]>([]);
  const [form] = Form.useForm();

  const visibleData = useMemo(() => {
    const filtered = dataSource.filter((item) => !hiddenKeys.has(String(item.key || '').trim()));
    if (activeCategory === 'ALL') return filtered;
    return filtered.filter((item) => resolveCategory(item) === activeCategory);
  }, [activeCategory, dataSource]);

  const categoryOptions = useMemo(() => {
    const baseData = dataSource.filter((item) => !hiddenKeys.has(String(item.key || '').trim()));
    const counts = baseData.reduce<Record<string, number>>((acc, item) => {
      const key = resolveCategory(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const allCount = baseData.length;

    return (Object.keys(categoryMeta) as CategoryKey[]).map((key) => ({
      label: `${categoryMeta[key].label}${key === 'ALL' ? ` (${allCount})` : ` (${counts[key] || 0})`}`,
      value: key,
    }));
  }, [dataSource, visibleData]);

  const openEdit = (row: SystemConfigItem) => {
    setEditing(row);
    setVisible(true);
    const nextValues: Record<string, any> = {
      key: row.key,
      value: formatConfigValue(row),
      valueType: row.valueType,
      remark: row.remark,
      enabled: row.enabled,
    };
    if (String(row.key || '').trim() === SUBSCRIBE_TEMPLATE_CONFIG_KEY) {
      nextValues.subscribeTemplates = parseSubscribeTemplateConfig(row);
    }
    if (String(row.key || '').trim() === STAFF_RULE_ENGINE_CONFIG_KEY) {
      nextValues.staffRuleEngine = parseStaffRuleEngineConfig(row);
    }
    form.setFieldsValue({
      ...nextValues,
    });
  };

  const openCreate = () => {
    setEditing(null);
    setVisible(true);
    form.setFieldsValue({
      key: '',
      value: '',
      valueType: 'STRING',
      remark: '',
      enabled: true,
    });
  };

  const columns = useMemo<ProColumns<SystemConfigItem>[]>(
    () => [
      {
        title: '分类',
        dataIndex: 'category',
        width: 110,
        search: false,
        render: (_, row) => {
          const category = resolveCategory(row);
          return <Tag color={categoryMeta[category].color}>{categoryMeta[category].label}</Tag>;
        },
      },
      { title: '配置键', dataIndex: 'key', width: 260, copyable: true, search: false },
      {
        title: '配置值',
        dataIndex: 'value',
        search: false,
        render: (_, row) => (
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontSize: 12,
              lineHeight: '20px',
              maxWidth: 560,
              maxHeight: 148,
              overflow: 'auto',
              padding: '8px 10px',
              background: '#fafafa',
              border: '1px solid #f0f0f0',
              borderRadius: 6,
            }}
          >
            {formatConfigValue(row)}
          </pre>
        ),
      },
      {
        title: '值类型',
        dataIndex: 'valueType',
        width: 100,
        search: false,
        render: (_, row) => <Tag>{row.valueType}</Tag>,
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        width: 90,
        search: false,
        render: (_, row) => (row.enabled ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
      },
      {
        title: '备注',
        dataIndex: 'remark',
        search: false,
        render: (_, row) => <Text ellipsis={{ tooltip: row.remark }}>{row.remark || '-'}</Text>,
      },
      {
        title: '操作',
        valueType: 'option',
        width: 120,
        render: (_, row) => [
          <a key="edit" onClick={() => openEdit(row)}>
            编辑
          </a>,
        ],
      },
    ],
    [form],
  );

  return (
    <>
      <ProTable<SystemConfigItem>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        headerTitle="基础配置"
        dataSource={visibleData}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        toolBarRender={() => [
          <Button
            key="add"
            type="primary"
            onClick={openCreate}
          >
            新增配置
          </Button>,
          <Segmented
            key="category"
            options={categoryOptions}
            value={activeCategory}
            onChange={(value) => setActiveCategory(value as CategoryKey)}
          />,
          <Button
            key="refresh"
            onClick={() => {
              actionRef.current?.reload();
            }}
          >
            刷新
          </Button>,
        ]}
        request={async () => {
          const data = await listSystemConfigs();
          const rows = Array.isArray(data) ? data : [];
          setDataSource(rows);
          return {
            data: [],
            total: 0,
            success: true,
          };
        }}
      />

      <Modal
        title="编辑基础配置"
        open={visible}
        width={720}
        confirmLoading={submitting}
        onCancel={() => {
          setVisible(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            const isSubscribeTemplateConfig = String(values.key || '').trim() === SUBSCRIBE_TEMPLATE_CONFIG_KEY;
            const isStaffRuleEngineConfig = String(values.key || '').trim() === STAFF_RULE_ENGINE_CONFIG_KEY;
            const trimmedValue = isSubscribeTemplateConfig
              ? buildSubscribeTemplateConfigValue(values)
              : isStaffRuleEngineConfig
                ? ''
              : String(values.value ?? '').trim();
            if (values.valueType === 'JSON' && !isSubscribeTemplateConfig && !isStaffRuleEngineConfig) {
              JSON.parse(trimmedValue || '{}');
            }
            setSubmitting(true);
            if (isStaffRuleEngineConfig) {
              await upsertStaffRuleEngineConfig(buildStaffRuleEngineConfigValue(values));
            } else {
              await upsertSystemConfig({
                key: values.key,
                value: values.valueType === 'JSON' ? JSON.stringify(JSON.parse(trimmedValue || '{}'), null, 2) : trimmedValue,
                valueType: values.valueType,
                remark: String(values.remark ?? '').trim(),
                enabled: Boolean(values.enabled),
              });
            }
            message.success('配置已更新');
            setVisible(false);
            setEditing(null);
            form.resetFields();
            actionRef.current?.reload();
          } catch (e: any) {
            if (e instanceof SyntaxError) {
              message.error('JSON 格式不正确，请检查后再保存');
              return;
            }
            if (!e?.errorFields) {
              message.error(e?.data?.message || e?.message || '更新失败');
            }
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="配置键" name="key" rules={[{ required: true, message: '请输入配置键' }]}>
            <Input disabled={Boolean(editing)} placeholder="例如 cos_secret_id / custom_key" />
          </Form.Item>

          <Form.Item label="值类型" name="valueType" rules={[{ required: true, message: '请选择值类型' }]}>
            <Select options={valueTypeOptions} />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, next) => prev.valueType !== next.valueType || prev.key !== next.key}
          >
            {({ getFieldValue }) => {
              const valueType = getFieldValue('valueType');
              const configKey = String(getFieldValue('key') || '').trim();
              const isSubscribeTemplateConfig = configKey === SUBSCRIBE_TEMPLATE_CONFIG_KEY;
              const isStaffRuleEngineConfig = configKey === STAFF_RULE_ENGINE_CONFIG_KEY;
              if (isSubscribeTemplateConfig) {
                return (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                      message="这里维护微信小程序订阅消息模板"
                      description="模板ID、跳转页、字段关键词需要和微信公众平台后台实际模板保持一致，否则发送会被微信拒绝。"
                    />
                    {(Object.keys(subscribeTemplateFieldMeta) as Array<keyof typeof subscribeTemplateFieldMeta>).map((sectionKey, index) => {
                      const section = subscribeTemplateFieldMeta[sectionKey];
                      return (
                        <div key={sectionKey}>
                          {index > 0 ? <Divider /> : null}
                          <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 12 }}>
                            <Text strong>{section.label}</Text>
                            <Text type="secondary">{section.description}</Text>
                          </Space>

                          <Form.Item label="启用" name={['subscribeTemplates', sectionKey, 'enabled']} valuePropName="checked">
                            <Switch />
                          </Form.Item>

                          <Form.Item label="模板标题" name={['subscribeTemplates', sectionKey, 'title']} rules={[{ required: true, message: '请输入模板标题' }]}>
                            <Input placeholder="例如 订单进度提醒" />
                          </Form.Item>

                          <Form.Item label="模板说明" name={['subscribeTemplates', sectionKey, 'description']}>
                            <Input placeholder="用于后台识别和维护" />
                          </Form.Item>

                          <Form.Item label="模板ID" name={['subscribeTemplates', sectionKey, 'templateId']}>
                            <Input placeholder="微信公众平台订阅消息模板ID" />
                          </Form.Item>

                          <Form.Item label="跳转页面" name={['subscribeTemplates', sectionKey, 'page']}>
                            <Input placeholder="/pages/order-details/index" />
                          </Form.Item>

                          {section.fields.map((field) => (
                            <Form.Item
                              key={`${sectionKey}-${field.key}`}
                              label={field.label}
                              name={['subscribeTemplates', sectionKey, 'fields', field.key]}
                            >
                              <Input placeholder="例如 thing2 / character_string1 / time4" />
                            </Form.Item>
                          ))}
                        </div>
                      );
                    })}
                  </>
                );
              }
              if (isStaffRuleEngineConfig) {
                return (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                      message="这里维护服务者规则分组"
                      description="默认规则用于未配置或未命中规则分组的服务者；下方每条分组规则为一对一绑定，服务者资料中只能选择一个规则分组。"
                    />

                    <Card size="small" title="默认规则" style={{ marginBottom: 16 }}>
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Space size={16} wrap>
                          <Form.Item
                            label="押金金额"
                            name={['staffRuleEngine', 'defaultRule', 'depositAmount']}
                            rules={[{ required: true, message: '请输入押金金额' }]}
                          >
                            <InputNumber min={0} precision={2} style={{ width: 160 }} addonBefore="¥" />
                          </Form.Item>
                          <Form.Item
                            label="首次提现最低保留"
                            name={['staffRuleEngine', 'defaultRule', 'firstWithdrawMinBalance']}
                            rules={[{ required: true, message: '请输入首次提现最低保留金额' }]}
                          >
                            <InputNumber min={0} precision={2} style={{ width: 180 }} addonBefore="¥" />
                          </Form.Item>
                        </Space>
                        <Space size={16} wrap>
                          <Form.Item
                            label="首次提现接单满"
                            name={['staffRuleEngine', 'defaultRule', 'firstWithdrawMinAcceptedDays']}
                            initialValue={15}
                            rules={[{ required: true, message: '请输入首次提现接单天数' }]}
                          >
                            <InputNumber min={0} precision={0} style={{ width: 180 }} addonAfter="天" />
                          </Form.Item>
                          <Form.Item
                            label="退店冷却期"
                            name={['staffRuleEngine', 'defaultRule', 'quitCoolingDays']}
                            rules={[{ required: true, message: '请输入退店冷却天数' }]}
                          >
                            <InputNumber min={0} precision={0} style={{ width: 160 }} addonAfter="天" />
                          </Form.Item>
                          <Form.Item
                            label="押金不退限制"
                            name={['staffRuleEngine', 'defaultRule', 'depositForfeitDays']}
                            rules={[{ required: true, message: '请输入押金不退天数' }]}
                          >
                            <InputNumber min={0} precision={0} style={{ width: 180 }} addonAfter="天" />
                          </Form.Item>
                          <Form.Item
                            label="自动冻结周期"
                            name={['staffRuleEngine', 'defaultRule', 'dormantFreezeDays']}
                            initialValue={7}
                            rules={[{ required: true, message: '请输入自动冻结周期' }]}
                          >
                            <InputNumber min={0} precision={0} style={{ width: 180 }} addonAfter="天" />
                          </Form.Item>
                          <Form.Item
                            label="体验单结算冻结"
                            name={['staffRuleEngine', 'defaultRule', 'settlementFreezeExperienceDays']}
                            initialValue={3}
                            rules={[{ required: true, message: '请输入体验单结算冻结周期' }]}
                          >
                            <InputNumber min={0} precision={0} style={{ width: 190 }} addonAfter="天" />
                          </Form.Item>
                          <Form.Item
                            label="普通单结算冻结"
                            name={['staffRuleEngine', 'defaultRule', 'settlementFreezeRegularDays']}
                            initialValue={7}
                            rules={[{ required: true, message: '请输入普通单结算冻结周期' }]}
                          >
                            <InputNumber min={0} precision={0} style={{ width: 190 }} addonAfter="天" />
                          </Form.Item>
                        </Space>
                      </Space>
                    </Card>

                    <Card size="small" title="分组规则">
                      <Form.List name={['staffRuleEngine', 'rules']}>
                        {(fields, { add, remove }) => (
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            {fields.map((field, index) => (
                              <Card
                                key={field.key}
                                size="small"
                                type="inner"
                                title={`规则 ${index + 1}`}
                                extra={<a onClick={() => remove(field.name)}>删除</a>}
                              >
                                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                  <Form.Item name={[field.name, 'id']} hidden>
                                    <Input />
                                  </Form.Item>
                                  <Space size={16} wrap>
                                    <Form.Item
                                      label="分组名称"
                                      name={[field.name, 'tagName']}
                                      rules={[{ required: true, message: '请输入分组名称' }]}
                                    >
                                      <Input placeholder="例如：线上高端、大神、金牌陪玩" />
                                    </Form.Item>
                                    <Form.Item
                                      label="分组编码"
                                      name={[field.name, 'tagCode']}
                                      rules={[{ required: true, message: '请输入分组编码' }]}
                                      extra="建议使用英文字母或拼音缩写，系统会自动转成小写。"
                                    >
                                      <Input placeholder="例如：vip_online / high_rank" />
                                    </Form.Item>
                                  </Space>
                                  <Space size={16} wrap>
                                    <Form.Item label="是否启用" name={[field.name, 'enabled']} valuePropName="checked" initialValue={true}>
                                      <Switch />
                                    </Form.Item>
                                    <Form.Item label="排序" name={[field.name, 'sort']} initialValue={index + 1}>
                                      <InputNumber min={1} precision={0} style={{ width: 120 }} />
                                    </Form.Item>
                                    <Form.Item label="优先级" name={[field.name, 'priority']} initialValue={0}>
                                      <InputNumber min={0} precision={0} style={{ width: 120 }} />
                                    </Form.Item>
                                  </Space>
                                  <Space size={16} wrap>
                                    <Form.Item
                                      label="押金金额"
                                      name={[field.name, 'depositAmount']}
                                      rules={[{ required: true, message: '请输入押金金额' }]}
                                    >
                                      <InputNumber min={0} precision={2} style={{ width: 160 }} addonBefore="¥" />
                                    </Form.Item>
                                    <Form.Item
                                      label="首次提现最低保留"
                                      name={[field.name, 'firstWithdrawMinBalance']}
                                      rules={[{ required: true, message: '请输入首次提现最低保留金额' }]}
                                    >
                                      <InputNumber min={0} precision={2} style={{ width: 180 }} addonBefore="¥" />
                                    </Form.Item>
                                    <Form.Item
                                      label="首次提现接单满"
                                      name={[field.name, 'firstWithdrawMinAcceptedDays']}
                                      initialValue={15}
                                      rules={[{ required: true, message: '请输入首次提现接单天数' }]}
                                    >
                                      <InputNumber min={0} precision={0} style={{ width: 180 }} addonAfter="天" />
                                    </Form.Item>
                                  </Space>
                                  <Space size={16} wrap>
                                    <Form.Item
                                      label="退店冷却期"
                                      name={[field.name, 'quitCoolingDays']}
                                      rules={[{ required: true, message: '请输入退店冷却天数' }]}
                                    >
                                      <InputNumber min={0} precision={0} style={{ width: 160 }} addonAfter="天" />
                                    </Form.Item>
                                    <Form.Item
                                      label="押金不退限制"
                                      name={[field.name, 'depositForfeitDays']}
                                      rules={[{ required: true, message: '请输入押金不退天数' }]}
                                    >
                                      <InputNumber min={0} precision={0} style={{ width: 180 }} addonAfter="天" />
                                    </Form.Item>
                                    <Form.Item
                                      label="自动冻结周期"
                                      name={[field.name, 'dormantFreezeDays']}
                                      initialValue={7}
                                      rules={[{ required: true, message: '请输入自动冻结周期' }]}
                                    >
                                      <InputNumber min={0} precision={0} style={{ width: 180 }} addonAfter="天" />
                                    </Form.Item>
                                    <Form.Item
                                      label="体验单结算冻结"
                                      name={[field.name, 'settlementFreezeExperienceDays']}
                                      initialValue={3}
                                      rules={[{ required: true, message: '请输入体验单结算冻结周期' }]}
                                    >
                                      <InputNumber min={0} precision={0} style={{ width: 190 }} addonAfter="天" />
                                    </Form.Item>
                                    <Form.Item
                                      label="普通单结算冻结"
                                      name={[field.name, 'settlementFreezeRegularDays']}
                                      initialValue={7}
                                      rules={[{ required: true, message: '请输入普通单结算冻结周期' }]}
                                    >
                                      <InputNumber min={0} precision={0} style={{ width: 190 }} addonAfter="天" />
                                    </Form.Item>
                                  </Space>
                                </Space>
                              </Card>
                            ))}
                            <Button onClick={() => add({ enabled: true, sort: fields.length + 1, priority: 0, depositAmount: 0, firstWithdrawMinBalance: 0, firstWithdrawMinAcceptedDays: 15, quitCoolingDays: 0, depositForfeitDays: 0, dormantFreezeDays: 7, settlementFreezeExperienceDays: 3, settlementFreezeRegularDays: 7 })}>
                              新增分组规则
                            </Button>
                          </Space>
                        )}
                      </Form.List>
                    </Card>
                  </>
                );
              }
              return (
                <Form.Item label="配置值" name="value" rules={[{ required: true, message: '请输入配置值' }]}>
                  <Input.TextArea
                    rows={valueType === 'JSON' ? 14 : 5}
                    style={valueType === 'JSON' ? { fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace' } : undefined}
                    placeholder={valueType === 'JSON' ? '请输入格式正确的 JSON' : '请输入配置值'}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <Input />
          </Form.Item>

          <Form.Item label="启用状态" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default SystemConfigsPage;
