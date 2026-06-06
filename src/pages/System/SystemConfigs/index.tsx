import React, { useMemo, useRef, useState } from 'react';
import { Button, Form, Input, message, Modal, Segmented, Select, Space, Switch, Tag, Typography } from 'antd';
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
    form.setFieldsValue({
      key: row.key,
      value: formatConfigValue(row),
      valueType: row.valueType,
      remark: row.remark,
      enabled: row.enabled,
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
            const trimmedValue = String(values.value ?? '').trim();
            if (values.valueType === 'JSON') {
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
            shouldUpdate={(prev, next) => prev.valueType !== next.valueType}
          >
            {({ getFieldValue }) => {
              const valueType = getFieldValue('valueType');
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
