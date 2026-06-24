import React, { useMemo, useRef, useState } from 'react';
import { Alert, Button, Divider, Form, Input, message, Modal, Segmented, Select, Space, Switch, Tag, Typography } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { listSystemConfigs, SystemConfigItem, upsertSystemConfig } from '@/services/api';

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
]);

const categoryMeta = {
  ALL: { label: '全部配置', color: 'default' },
  WECHAT: { label: '微信配置', color: 'green' },
  PAYMENT: { label: '支付回调', color: 'blue' },
  COS: { label: '对象存储', color: 'magenta' },
  FINANCE: { label: '费用规则', color: 'gold' },
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

function resolveCategory(row: SystemConfigItem): CategoryKey {
  const key = String(row.key || '').trim();
  if (key.startsWith('wechat_mini_')) return 'WECHAT';
  if (key === 'app_public_base_url' || key.startsWith('wechat_pay_')) return 'PAYMENT';
  if (key.startsWith('cos_')) return 'COS';
  if (key.startsWith('offline_fee_')) return 'FINANCE';
  return 'OTHER';
}

function formatConfigValue(row: SystemConfigItem) {
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
            const trimmedValue = isSubscribeTemplateConfig
              ? buildSubscribeTemplateConfigValue(values)
              : String(values.value ?? '').trim();
            if (values.valueType === 'JSON' && !isSubscribeTemplateConfig) {
              JSON.parse(trimmedValue || '{}');
            }
            setSubmitting(true);
            await upsertSystemConfig({
              key: values.key,
              value: values.valueType === 'JSON' ? JSON.stringify(JSON.parse(trimmedValue || '{}'), null, 2) : trimmedValue,
              valueType: values.valueType,
              remark: String(values.remark ?? '').trim(),
              enabled: Boolean(values.enabled),
            });
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
