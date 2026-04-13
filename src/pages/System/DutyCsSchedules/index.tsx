import React, { useEffect, useRef, useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { Button, DatePicker, Form, Input, message, Modal, Popconfirm, Select, Switch, Tag, TimePicker } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  adminDeleteDutyCsLeave,
  adminDeleteDutyCsSchedule,
  adminListDutyCsLeaves,
  adminListDutyCsSchedules,
  adminUpsertDutyCsLeave,
  adminUpsertDutyCsSchedule,
  DutyCsLeaveItem,
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

const weekOptions = Object.keys(weekdayText).map((k) => ({
  label: weekdayText[Number(k)],
  value: Number(k),
}));

const toTimeValue = (hhmm: string) => {
  const [h, m] = String(hhmm || '00:00').split(':');
  return dayjs().hour(Number(h) || 0).minute(Number(m) || 0).second(0).millisecond(0);
};

type LeaveFormValues = {
  userId: number;
  substituteUserId: number;
  startAt: Dayjs;
  endAt: Dayjs;
  enabled?: boolean;
  reason?: string;
};

type ScheduleFormValues = {
  userId: number;
  weekdays: number[];
  startTime: Dayjs;
  endTime: Dayjs;
  enabled?: boolean;
  remark?: string;
  shiftPreset?: 'DAY' | 'NIGHT' | 'CUSTOM';
};

const DutyCsSchedulesPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const leaveActionRef = useRef<ActionType>();

  const [form] = Form.useForm<ScheduleFormValues>();
  const [leaveForm] = Form.useForm<LeaveFormValues>();

  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState<DutyCsScheduleItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [leaveVisible, setLeaveVisible] = useState(false);
  const [leaveEditing, setLeaveEditing] = useState<DutyCsLeaveItem | null>(null);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

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
      width: 240,
      search: false,
      render: (_, row) => {
        const weekdays = Array.isArray((row as any).weekdays)
          ? (row as any).weekdays
          : [Number(row.weekday)];
        return weekdays.map((w: number) => (
          <Tag key={`${row.id}-${w}`} color="blue">
            {weekdayText[Number(w)] || String(w)}
          </Tag>
        ));
      },
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
            const weekdays = Array.isArray((row as any).weekdays)
              ? (row as any).weekdays
              : [row.weekday];
            form.setFieldsValue({
              userId: row.userId,
              weekdays,
              startTime: toTimeValue(String(row.startTime)),
              endTime: toTimeValue(String(row.endTime)),
              enabled: row.enabled,
              remark: row.remark,
              shiftPreset: 'CUSTOM',
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

  const leaveColumns: ProColumns<DutyCsLeaveItem>[] = [
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    {
      title: '休假客服',
      search: false,
      render: (_, row) => row.user?.name || row.user?.realName || row.user?.phone || `#${row.userId}`,
    },
    {
      title: '代班客服',
      search: false,
      render: (_, row) => row.substituteUser?.name || row.substituteUser?.realName || row.substituteUser?.phone || `#${row.substituteUserId}`,
    },
    {
      title: '休假时间',
      search: false,
      render: (_, row) => `${dayjs(row.startAt).format('YYYY-MM-DD HH:mm')} ~ ${dayjs(row.endAt).format('YYYY-MM-DD HH:mm')}`,
    },
    {
      title: '当前生效',
      dataIndex: 'isActiveNow',
      search: false,
      width: 90,
      render: (_, row) => (row.isActiveNow ? <Tag color="processing">生效中</Tag> : <Tag>否</Tag>),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 90,
      search: false,
      render: (_, row) => (row.enabled ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
    },
    { title: '原因', dataIndex: 'reason', search: false, ellipsis: true },
    {
      title: '操作',
      valueType: 'option',
      width: 140,
      render: (_, row) => [
        <a
          key="edit"
          onClick={() => {
            setLeaveEditing(row);
            setLeaveVisible(true);
            leaveForm.setFieldsValue({
              userId: row.userId,
              substituteUserId: row.substituteUserId,
              startAt: dayjs(row.startAt),
              endAt: dayjs(row.endAt),
              enabled: row.enabled,
              reason: row.reason || undefined,
            });
          }}
        >
          编辑
        </a>,
        <Popconfirm
          key="delete"
          title="确认删除该休假配置？"
          onConfirm={async () => {
            try {
              await adminDeleteDutyCsLeave({ id: row.id });
              message.success('已删除');
              leaveActionRef.current?.reload();
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
              form.setFieldsValue({
                weekdays: [1],
                startTime: toTimeValue('11:00'),
                endTime: toTimeValue('21:00'),
                enabled: true,
                shiftPreset: 'DAY',
              });
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

      <ProTable<DutyCsLeaveItem>
        rowKey="id"
        actionRef={leaveActionRef}
        headerTitle="客服休假与代班配置"
        columns={leaveColumns}
        search={{ labelWidth: 86 }}
        toolBarRender={() => [
          <Button
            key="create-leave"
            type="primary"
            onClick={() => {
              setLeaveEditing(null);
              setLeaveVisible(true);
              leaveForm.setFieldsValue({
                enabled: true,
                startAt: dayjs().add(1, 'hour'),
                endAt: dayjs().add(8, 'hour'),
              });
            }}
          >
            提交休假
          </Button>,
        ]}
        request={async (params) => {
          const list = await adminListDutyCsLeaves({ keyword: params.keyword });
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
            const weekdays = (Array.isArray(values.weekdays) ? values.weekdays : []).map((v) => Number(v));
            await adminUpsertDutyCsSchedule({
              id: editing?.id,
              userId: Number(values.userId),
              // 后端当前兼容 weekday + weekdays，这里统一传 weekdays。
              // 若后续后端移除 weekday，这里无需再改。
              weekday: weekdays[0],
              weekdays,
              startTime: dayjs(values.startTime).format('HH:mm'),
              endTime: dayjs(values.endTime).format('HH:mm'),
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

          <Form.Item label="星期" name="weekdays" rules={[{ required: true, message: '请选择星期' }]}>
            <Select
              mode="multiple"
              options={weekOptions}
              placeholder="可多选"
            />
          </Form.Item>

          <Form.Item label="班次模板" name="shiftPreset" initialValue="CUSTOM">
            <Select
              options={[
                { label: '白班（11:00-21:00）', value: 'DAY' },
                { label: '晚班（21:00-11:00，跨天）', value: 'NIGHT' },
                { label: '自定义', value: 'CUSTOM' },
              ]}
              onChange={(v) => {
                if (v === 'DAY') {
                  form.setFieldsValue({
                    startTime: toTimeValue('11:00'),
                    endTime: toTimeValue('21:00'),
                  });
                } else if (v === 'NIGHT') {
                  form.setFieldsValue({
                    startTime: toTimeValue('21:00'),
                    endTime: toTimeValue('11:00'),
                  });
                }
              }}
            />
          </Form.Item>

          <Form.Item
            label="开始时间"
            name="startTime"
            rules={[{ required: true, message: '请选择开始时间' }]}
          >
            <TimePicker
              format="HH:mm"
              minuteStep={5}
              allowClear={false}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="结束时间"
            name="endTime"
            rules={[
              { required: true, message: '请选择结束时间' },
              {
                validator: async (_, value) => {
                  const start = form.getFieldValue('startTime') as Dayjs | undefined;
                  if (!start || !value) return;
                  // 严谨校验：仅禁止开始与结束相同，允许跨天（如 21:00 -> 11:00）
                  if ((value as Dayjs).format('HH:mm') === start.format('HH:mm')) {
                    throw new Error('结束时间不能与开始时间相同');
                  }
                },
              },
            ]}
          >
            <TimePicker
              format="HH:mm"
              minuteStep={5}
              allowClear={false}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <Input maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={leaveEditing ? '编辑休假代班配置' : '新增休假代班配置'}
        open={leaveVisible}
        confirmLoading={leaveSubmitting}
        onCancel={() => {
          setLeaveVisible(false);
          setLeaveEditing(null);
          leaveForm.resetFields();
        }}
        onOk={async () => {
          try {
            const values = await leaveForm.validateFields();
            setLeaveSubmitting(true);
            await adminUpsertDutyCsLeave({
              id: leaveEditing?.id,
              userId: Number(values.userId),
              substituteUserId: Number(values.substituteUserId),
              startAt: values.startAt.toISOString(),
              endAt: values.endAt.toISOString(),
              enabled: Boolean(values.enabled),
              reason: values.reason,
            });
            message.success(leaveEditing ? '已更新' : '已创建');
            setLeaveVisible(false);
            setLeaveEditing(null);
            leaveForm.resetFields();
            leaveActionRef.current?.reload();
          } catch (e: any) {
            if (!e?.errorFields) {
              message.error(e?.data?.message || e?.message || '提交失败');
            }
          } finally {
            setLeaveSubmitting(false);
          }
        }}
      >
        <Form<LeaveFormValues> form={leaveForm} layout="vertical">
          <Form.Item label="休假客服" name="userId" rules={[{ required: true, message: '请选择休假客服' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={csUsers.map((u) => ({
                label: `${u.name || u.realName || u.phone} (${u.phone})`,
                value: u.id,
              }))}
            />
          </Form.Item>

          <Form.Item label="代班客服" name="substituteUserId" rules={[{ required: true, message: '请选择代班客服' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={csUsers.map((u) => ({
                label: `${u.name || u.realName || u.phone} (${u.phone})`,
                value: u.id,
              }))}
            />
          </Form.Item>

          <Form.Item label="开始时间" name="startAt" rules={[{ required: true, message: '请选择开始时间' }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="结束时间"
            name="endAt"
            rules={[
              { required: true, message: '请选择结束时间' },
              {
                validator: async (_, value: Dayjs | undefined) => {
                  const startAt: Dayjs | undefined = leaveForm.getFieldValue('startAt');
                  if (!startAt || !value) return;
                  if (!value.isAfter(startAt)) throw new Error('结束时间必须晚于开始时间');
                },
              },
            ]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="启用"
            name="enabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item label="休假原因" name="reason">
            <Input maxLength={255} placeholder="例如：事假/病假/调休" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default DutyCsSchedulesPage;
