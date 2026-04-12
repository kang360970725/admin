import React, { useEffect, useRef, useState } from 'react';
import { Button, Form, Input, message, Modal, Popconfirm, Select, Switch, Tag } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  adminDeleteDutyCsSchedule,
  adminListDutyCsSchedules,
  adminUpsertDutyCsSchedule,
  DutyCsScheduleItem,
  getUsers,
  User,
} from '@/services/api';

const weekdayText: Record<number, string> = {
  0: '周日',
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
};

const DutyCsSchedulesPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState<DutyCsScheduleItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [csUsers, setCsUsers] = useState<User[]>([]);

  const loadCsUsers = async () => {
    try {
      const res = await getUsers({ page: 1, limit: 200, userType: 'CUSTOMER_SERVICE', status: 'ACTIVE' });
      setCsUsers(Array.isArray(res?.data) ? res.data : []);
    } catch (e: any) {
      message.error(e?.data?.message || e?.message || '加载客服列表失败');
    }
  };

  useEffect(() => {
    loadCsUsers();
  }, []);

  const columns: ProColumns<DutyCsScheduleItem>[] = [
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    {
      title: '客服',
      dataIndex: ['user', 'name'],
      render: (_, row) => row.user?.name || row.user?.realName || row.user?.phone || `#${row.userId}`,
    },
    { title: '手机号', dataIndex: ['user', 'phone'], width: 120, search: false },
    {
      title: '星期',
      dataIndex: 'weekday',
      width: 90,
      valueEnum: {
        0: { text: '周日' },
        1: { text: '周一' },
        2: { text: '周二' },
        3: { text: '周三' },
        4: { text: '周四' },
        5: { text: '周五' },
        6: { text: '周六' },
      },
      render: (_, row) => weekdayText[Number(row.weekday)] || String(row.weekday),
    },
    {
      title: '在线时段',
      search: false,
      render: (_, row) => `${row.startTime || '-'} ~ ${row.endTime || '-'}`,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 90,
      search: false,
      render: (_, row) => (row.enabled ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
    },
    { title: '备注', dataIndex: 'remark', search: false, ellipsis: true },
    {
      title: '操作',
      valueType: 'option',
      width: 140,
      render: (_, row) => [
        <a
          key="edit"
          onClick={() => {
            setEditing(row);
            setVisible(true);
            form.setFieldsValue({
              userId: row.userId,
              weekday: row.weekday,
              startTime: row.startTime,
              endTime: row.endTime,
              enabled: row.enabled,
              remark: row.remark,
            });
          }}
        >
          编辑
        </a>,
        <Popconfirm
          key="delete"
          title="确认删除该当班配置？"
          onConfirm={async () => {
            try {
              await adminDeleteDutyCsSchedule({ id: row.id });
              message.success('已删除');
              actionRef.current?.reload();
            } catch (e: any) {
              message.error(e?.data?.message || e?.message || '删除失败');
            }
          }}
        >
          <a>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ProTable<DutyCsScheduleItem>
        rowKey="id"
        actionRef={actionRef}
        headerTitle="当班客服配置"
        columns={columns}
        search={{ labelWidth: 86 }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            onClick={() => {
              setEditing(null);
              setVisible(true);
              form.setFieldsValue({ weekday: 1, startTime: '10:00', endTime: '19:00', enabled: true });
            }}
          >
            新增当班配置
          </Button>,
        ]}
        request={async (params) => {
          const list = await adminListDutyCsSchedules({ keyword: params.keyword });
          return {
            data: Array.isArray(list) ? list : [],
            total: Array.isArray(list) ? list.length : 0,
            success: true,
          };
        }}
      />

      <Modal
        title={editing ? '编辑当班客服配置' : '新增当班客服配置'}
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
            await adminUpsertDutyCsSchedule({
              id: editing?.id,
              userId: Number(values.userId),
              weekday: Number(values.weekday),
              startTime: String(values.startTime),
              endTime: String(values.endTime),
              enabled: Boolean(values.enabled),
              remark: values.remark,
            });
            message.success(editing ? '已更新' : '已创建');
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
          <Form.Item label="客服" name="userId" rules={[{ required: true, message: '请选择客服' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={csUsers.map((u) => ({
                label: `${u.name || u.realName || u.phone} (${u.phone})`,
                value: u.id,
              }))}
            />
          </Form.Item>

          <Form.Item label="星期" name="weekday" rules={[{ required: true, message: '请选择星期' }]}>
            <Select
              options={Object.keys(weekdayText).map((k) => ({ label: weekdayText[Number(k)], value: Number(k) }))}
            />
          </Form.Item>

          <Form.Item
            label="开始时间"
            name="startTime"
            rules={[
              { required: true, message: '请输入开始时间' },
              { pattern: /^([01]?\d|2[0-3]):([0-5]\d)$/, message: '格式必须为 HH:mm' },
            ]}
          >
            <Input placeholder="例如 10:00" maxLength={5} />
          </Form.Item>

          <Form.Item
            label="结束时间"
            name="endTime"
            rules={[
              { required: true, message: '请输入结束时间' },
              { pattern: /^([01]?\d|2[0-3]):([0-5]\d)$/, message: '格式必须为 HH:mm' },
              {
                validator: async (_, value) => {
                  const start = String(form.getFieldValue('startTime') || '');
                  if (!start || !value) return;
                  const toMinute = (v: string) => {
                    const arr = v.split(':');
                    return Number(arr[0]) * 60 + Number(arr[1]);
                  };
                  if (toMinute(String(value)) <= toMinute(start)) {
                    throw new Error('结束时间必须晚于开始时间');
                  }
                },
              },
            ]}
          >
            <Input placeholder="例如 19:00" maxLength={5} />
          </Form.Item>

          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <Input maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default DutyCsSchedulesPage;
