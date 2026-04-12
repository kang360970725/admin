import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, DatePicker, Form, Input, message, Modal, Select, Space, Switch, Tag } from 'antd';
import dayjs from 'dayjs';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  adminCreateAnnouncement,
  adminListAnnouncements,
  adminUpdateAnnouncement,
  SystemAnnouncementItem,
} from '@/services/api';

const audienceTextMap: Record<string, string> = {
  ADMIN: '仅后台',
  APPLET: '仅小程序',
  ALL: '全平台',
};

const quickTemplates = [
  {
    key: 'ops',
    label: '系统维护通知',
    title: '【系统维护】服务临时维护通知',
    content:
      '<h3>维护通知</h3><p>亲爱的用户：</p><p>系统将于 <strong>YYYY-MM-DD HH:mm</strong> 进行维护升级，预计持续 <strong>X 小时</strong>。</p><p>维护期间部分功能不可用，请提前做好安排。</p><p>感谢理解与支持。</p>',
  },
  {
    key: 'activity',
    label: '活动上线通知',
    title: '【活动通知】新活动上线',
    content:
      '<h3>活动通知</h3><p>新活动已上线，欢迎参与。</p><ul><li>活动时间：YYYY-MM-DD 至 YYYY-MM-DD</li><li>活动内容：请在此补充</li><li>参与规则：请在此补充</li></ul>',
  },
  {
    key: 'rule',
    label: '规则变更通知',
    title: '【规则更新】平台规则调整说明',
    content:
      '<h3>规则更新说明</h3><p>为提升服务体验，平台规则进行以下调整：</p><ol><li>调整项 1</li><li>调整项 2</li><li>生效时间：YYYY-MM-DD HH:mm</li></ol>',
  },
];

const RichHtmlEditor: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
}> = ({ value, onChange }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    onChange?.(ref.current?.innerHTML || '');
  };

  return (
    <div>
      <Space wrap style={{ marginBottom: 8 }}>
        <Button size="small" onClick={() => exec('bold')}>加粗</Button>
        <Button size="small" onClick={() => exec('italic')}>斜体</Button>
        <Button size="small" onClick={() => exec('insertUnorderedList')}>无序列表</Button>
        <Button size="small" onClick={() => exec('formatBlock', 'H3')}>标题</Button>
        <Button size="small" onClick={() => exec('removeFormat')}>清格式</Button>
      </Space>
      <div
        ref={ref}
        contentEditable
        onInput={() => onChange?.(ref.current?.innerHTML || '')}
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          minHeight: 220,
          padding: 12,
          background: '#fff',
          overflow: 'auto',
        }}
      />
    </div>
  );
};

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
      audience: 'ALL',
      content: '<p>请填写公告内容</p>',
    });
  };

  const openEdit = (row: SystemAnnouncementItem) => {
    setEditing(row);
    setVisible(true);
    form.setFieldsValue({
      title: row.title,
      content: row.content,
      audience: row.audience || 'ALL',
      forceRead: row.forceRead,
      enabled: row.enabled,
      publishAt: row.publishAt ? dayjs(row.publishAt) : null,
      expireAt: row.expireAt ? dayjs(row.expireAt) : null,
    });
  };

  const columns: ProColumns<SystemAnnouncementItem>[] = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 80, search: false },
      { title: '标题', dataIndex: 'title', ellipsis: true },
      {
        title: '受众',
        dataIndex: 'audience',
        width: 110,
        valueEnum: {
          ADMIN: { text: '仅后台' },
          APPLET: { text: '仅小程序' },
          ALL: { text: '全平台' },
        },
        render: (_, row) => <Tag>{audienceTextMap[row.audience] || row.audience}</Tag>,
      },
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
    ],
    [],
  );

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
        width={900}
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
              audience: values.audience,
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
              message.success('公告已创建并触发推送');
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

          <Form.Item label="推送范围" name="audience" rules={[{ required: true, message: '请选择推送范围' }]}>
            <Select
              options={[
                { label: '仅后台（admin）', value: 'ADMIN' },
                { label: '仅前台（小程序）', value: 'APPLET' },
                { label: '全平台', value: 'ALL' },
              ]}
            />
          </Form.Item>

          <Form.Item label="快捷模板">
            <Space wrap>
              {quickTemplates.map((tpl) => (
                <Button
                  key={tpl.key}
                  onClick={() => {
                    form.setFieldsValue({
                      title: tpl.title,
                      content: tpl.content,
                    });
                  }}
                >
                  {tpl.label}
                </Button>
              ))}
            </Space>
          </Form.Item>

          <Form.Item
            label="公告内容（富文本）"
            name="content"
            rules={[{ required: true, message: '请输入公告内容' }]}
          >
            <RichHtmlEditor />
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
