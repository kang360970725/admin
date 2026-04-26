import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Form, Input, message, Modal, Radio, Space, Switch, Tag, Typography } from 'antd';
import {
  activateAppVersion,
  AppVersionRecord,
  listAppVersions,
  upsertAppVersion,
} from '@/services/api';

const { Text } = Typography;

type AppVersionRow = AppVersionRecord & { isActive?: boolean };

const AppVersionsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [activeBuildId, setActiveBuildId] = useState('');
  const [editing, setEditing] = useState<AppVersionRecord | null>(null);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const openCreate = () => {
    setEditing(null);
    setVisible(true);
    form.setFieldsValue({
      version: '',
      buildId: '',
      releaseType: 'SMALL',
      forceRefresh: true,
      title: '版本更新说明',
      notesText: '',
      enabled: true,
      releasedAt: '',
    });
  };

  const openEdit = (row: AppVersionRecord) => {
    setEditing(row);
    setVisible(true);
    form.setFieldsValue({
      version: row.version,
      buildId: row.buildId,
      releaseType: 'SMALL',
      forceRefresh: row.forceRefresh,
      title: row.title || '版本更新说明',
      notesText: Array.isArray(row.notes) ? row.notes.join('\n') : '',
      enabled: row.enabled,
      releasedAt: row.releasedAt || '',
    });
  };

  const columns = useMemo<ProColumns<AppVersionRow>[]>(
    () => [
      { title: '版本号', dataIndex: 'version', width: 120 },
      {
        title: 'Build ID',
        dataIndex: 'buildId',
        width: 280,
        render: (_, row) => (
          <Space>
            <Text code>{row.buildId}</Text>
            {row.isActive ? <Tag color="success">当前生效</Tag> : null}
          </Space>
        ),
      },
      {
        title: '强制刷新',
        dataIndex: 'forceRefresh',
        width: 100,
        render: (_, row) => (row.forceRefresh ? <Tag color="error">是</Tag> : <Tag>否</Tag>),
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        width: 100,
        render: (_, row) => (row.enabled ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
      },
      { title: '发布时间', dataIndex: 'releasedAt', width: 190, valueType: 'dateTime' },
      { title: '标题', dataIndex: 'title', ellipsis: true },
      { title: '创建时间', dataIndex: 'createdAt', width: 190, valueType: 'dateTime' },
      {
        title: '操作',
        valueType: 'option',
        width: 180,
        render: (_, row) => [
          <a key="edit" onClick={() => openEdit(row)}>
            编辑
          </a>,
          <a
            key="activate"
            onClick={async () => {
              if (!row.enabled) {
                message.warning('请先启用该版本记录');
                return;
              }
              try {
                await activateAppVersion({ buildId: row.buildId });
                message.success('已切换当前生效版本');
                actionRef.current?.reload();
              } catch (e: any) {
                message.error(e?.data?.message || e?.message || '切换失败');
              }
            }}
          >
            设为生效
          </a>,
        ],
      },
    ],
    [],
  );

  return (
    <>
      <ProTable<AppVersionRow>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        headerTitle="系统版本迭代记录"
        toolBarRender={() => [
          <Button
            key="refresh"
            onClick={() => {
              actionRef.current?.reload();
            }}
          >
            刷新
          </Button>,
          <Button key="create" type="primary" onClick={openCreate}>
            新增版本记录
          </Button>,
        ]}
        request={async () => {
          const res = await listAppVersions();
          const list = Array.isArray(res?.list) ? res.list : [];
          const currentActive = String(res?.activeBuildId || '').trim();
          setActiveBuildId(currentActive);
          return {
            data: list.map((item) => ({ ...item, isActive: item.buildId === currentActive })),
            total: list.length,
            success: true,
          };
        }}
      />

      <Modal
        title={editing ? '编辑版本记录' : '新增版本记录'}
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
            const notes = String(values.notesText || '')
              .split('\n')
              .map((x) => String(x || '').trim())
              .filter(Boolean);
            await upsertAppVersion({
              version: String(values.version || '').trim() || undefined,
              buildId: String(values.buildId || '').trim() || undefined,
              releaseType: values.releaseType === 'MAJOR' ? 'MAJOR' : 'SMALL',
              title: String(values.title || '版本更新说明').trim() || '版本更新说明',
              forceRefresh: Boolean(values.forceRefresh),
              enabled: Boolean(values.enabled),
              notes,
              releasedAt: String(values.releasedAt || '').trim() || undefined,
            });
            message.success('版本记录已保存');
            setVisible(false);
            setEditing(null);
            form.resetFields();
            actionRef.current?.reload();
          } catch (e: any) {
            if (!e?.errorFields) {
              message.error(e?.data?.message || e?.message || '保存失败');
            }
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="迭代类型" name="releaseType" initialValue="SMALL">
            <Radio.Group
              options={[
                { label: '小版本（后缀 +1）', value: 'SMALL' },
                { label: '大版本（前缀 +1）', value: 'MAJOR' },
              ]}
            />
          </Form.Item>

          <Form.Item label="版本号" name="version">
            <Input placeholder="留空自动生成，例如：1.3.2" />
          </Form.Item>

          <Form.Item label="Build ID" name="buildId">
            <Input placeholder="留空自动生成，例如：b1.3.2-20260426154530999" />
          </Form.Item>

          <Form.Item label="发布时间（ISO）" name="releasedAt">
            <Input placeholder="留空则使用当前时间，例如：2026-04-26T15:00:00.000Z" />
          </Form.Item>

          <Form.Item label="更新标题" name="title">
            <Input maxLength={120} placeholder="例如：版本更新说明" />
          </Form.Item>

          <Form.Item label="更新说明（每行一条）" name="notesText">
            <Input.TextArea rows={6} placeholder="支持多行，保存后会按条展示" />
          </Form.Item>

          <Form.Item label="强制刷新" name="forceRefresh" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="启用状态" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <div style={{ marginTop: 8 }}>
        <Text type="secondary">当前生效 Build ID：{activeBuildId || '-'}</Text>
      </div>
    </>
  );
};

export default AppVersionsPage;
