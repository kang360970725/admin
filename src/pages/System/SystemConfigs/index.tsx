import React, { useMemo, useRef, useState } from 'react';
import { Button, Form, Input, message, Modal, Select, Space, Switch, Tag, Typography } from 'antd';
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

const SystemConfigsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [editing, setEditing] = useState<SystemConfigItem | null>(null);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const openEdit = (row: SystemConfigItem) => {
    setEditing(row);
    setVisible(true);
    form.setFieldsValue({
      key: row.key,
      value: row.value,
      valueType: row.valueType,
      remark: row.remark,
      enabled: row.enabled,
    });
  };

  const columns = useMemo<ProColumns<SystemConfigItem>[]>(
    () => [
      { title: '配置键', dataIndex: 'key', width: 220, copyable: true },
      {
        title: '配置值',
        dataIndex: 'value',
        width: 260,
        render: (_, row) => <Text code>{String(row.value)}</Text>,
      },
      {
        title: '值类型',
        dataIndex: 'valueType',
        width: 100,
        render: (_, row) => <Tag>{row.valueType}</Tag>,
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        width: 100,
        render: (_, row) => (row.enabled ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
      },
      { title: '备注', dataIndex: 'remark', ellipsis: true },
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
    [],
  );

  return (
    <>
      <ProTable<SystemConfigItem>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        headerTitle="基础配置"
        toolBarRender={() => [
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
          return {
            data: Array.isArray(data) ? data : [],
            total: Array.isArray(data) ? data.length : 0,
            success: true,
          };
        }}
      />

      <Modal
        title="编辑基础配置"
        open={visible}
        confirmLoading={submitting}
        onCancel={() => {
          setVisible(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            setSubmitting(true);
            await upsertSystemConfig({
              key: values.key,
              value: String(values.value ?? ''),
              valueType: values.valueType,
              remark: values.remark,
              enabled: Boolean(values.enabled),
            });
            message.success('配置已更新');
            setVisible(false);
            setEditing(null);
            form.resetFields();
            actionRef.current?.reload();
          } catch (e: any) {
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
            <Input disabled={Boolean(editing)} />
          </Form.Item>

          <Form.Item label="配置值" name="value" rules={[{ required: true, message: '请输入配置值' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item label="值类型" name="valueType" rules={[{ required: true, message: '请选择值类型' }]}>
            <Select options={valueTypeOptions} />
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
