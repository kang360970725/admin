import React, { useRef, useState } from 'react';
import { Button, DatePicker, Form, Input, message, Modal, Space, Switch, Tag } from 'antd';
import dayjs from 'dayjs';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  adminCreateAnnouncement,
  adminListAnnouncements,
  adminUpdateAnnouncement,
  SystemAnnouncementItem,
} from '@/services/api';

const AnnouncementsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState<SystemAnnouncementItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setVisible(true);
    form.setFieldsValue({
      forceRead: false,
      enabled: true,
    });
  };

  const openEdit = (row: SystemAnnouncementItem) => {
    setEditing(row);
    setVisible(true);
    form.setFieldsValue({
      title: row.title,
      content: row.content,
      forceRead: row.forceRead,
      enabled: row.enabled,
      publishAt: row.publishAt ? dayjs(row.publishAt) : null,
      expireAt: row.expireAt ? dayjs(row.expireAt) : null,
    });
  };

  const columns: ProColumns<SystemAnnouncementItem>[] = [
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    {
      title: '强制阅读',
      dataIndex: 'forceRead',
      width: 110,
      search: false,
      render: (_, row) => (row.forceRead ? <Tag color="red">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 100,
      search: false,
      render: (_, row) => (row.enabled ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '发布时间',
      dataIndex: 'publishAt',
      width: 180,
      search: false,
      render: (_, row) => (row.publishAt ? dayjs(row.publishAt).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '过期时间',
      dataIndex: 'expireAt',
      width: 180,
      search: false,
      render: (_, row) => (row.expireAt ? dayjs(row.expireAt).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
      render: (_, row) => [
        <a key="edit" onClick={() => openEdit(row)}>
          编辑
        </a>,
      ],
    },
  ];

  return (
    <>
      <ProTable<SystemAnnouncementItem>
        rowKey="id"
        actionRef={actionRef}
        headerTitle="系统公告"
        columns={columns}
        search={{ labelWidth: 86 }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={openCreate}>
            新建公告
          </Button>,
        ]}
        request={async (params) => {
          const res = await adminListAnnouncements({
            page: params.current,
            limit: params.pageSize,
            keyword: params.keyword,
          });

          return {
            data: res?.list || [],
            total: Number(res?.total || 0),
            success: true,
          };
        }}
      />

      <Modal
        title={editing ? '编辑公告' : '新建公告'}
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

            const payload = {
              title: values.title,
              content: values.content,
              forceRead: Boolean(values.forceRead),
              enabled: Boolean(values.enabled),
              publishAt: values.publishAt ? dayjs(values.publishAt).toISOString() : undefined,
              expireAt: values.expireAt ? dayjs(values.expireAt).toISOString() : undefined,
            };

            if (editing) {
              await adminUpdateAnnouncement({ id: editing.id, ...payload });
              message.success('公告已更新');
            } else {
              await adminCreateAnnouncement(payload);
              message.success('公告已创建');
            }

            setVisible(false);
            setEditing(null);
            form.resetFields();
            actionRef.current?.reload();
          } catch (e: any) {
            if (!e?.errorFields) {
              message.error(e?.data?.message || e?.message || '提交失败');
            }
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="公告标题" name="title" rules={[{ required: true, message: '请输入公告标题' }]}>
            <Input maxLength={120} />
          </Form.Item>

          <Form.Item label="公告内容" name="content" rules={[{ required: true, message: '请输入公告内容' }]}>
            <Input.TextArea rows={6} maxLength={5000} />
          </Form.Item>

          <Space style={{ width: '100%' }}>
            <Form.Item label="强制阅读" name="forceRead" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item label="启用" name="enabled" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item label="发布时间" name="publishAt">
            <DatePicker showTime style={{ width: '100%' }} placeholder="为空则立即生效" />
          </Form.Item>

          <Form.Item label="过期时间" name="expireAt">
            <DatePicker showTime style={{ width: '100%' }} placeholder="为空则永不过期" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default AnnouncementsPage;
