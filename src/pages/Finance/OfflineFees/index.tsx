import React, { useMemo, useRef, useState } from 'react';
import { Button, Form, Input, InputNumber, message, Modal, Popconfirm, Space, Switch, Tag } from 'antd';
import dayjs from 'dayjs';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  enforceOfflineFeeBill,
  generateOfflineFeeBills,
  listOfflineFeeBills,
  OfflineFeeBill,
  payOfflineFeeBill,
  remindOfflineFeeBill,
} from '@/services/api';

const money = (v: any) => Number(v ?? 0).toFixed(2);

const statusColorMap: Record<string, string> = {
  UNPAID: 'error',
  PARTIAL: 'warning',
  PAID: 'success',
  WAIVED: 'default',
};

const OfflineFeesPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [generateVisible, setGenerateVisible] = useState(false);
  const [payVisible, setPayVisible] = useState(false);
  const [payingBill, setPayingBill] = useState<OfflineFeeBill | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generateForm] = Form.useForm();
  const [payForm] = Form.useForm();

  const columns = useMemo<ProColumns<OfflineFeeBill>[]>(
    () => [
      { title: '月份', dataIndex: 'billMonth', width: 90 },
      {
        title: '员工',
        dataIndex: ['user', 'name'],
        width: 140,
        render: (_, row) => row.user?.name || row.user?.phone || `#${row.userId}`,
      },
      { title: '手机号', dataIndex: ['user', 'phone'], width: 120, search: false },
      {
        title: '总业绩基数',
        dataIndex: 'performanceBaseAmount',
        width: 120,
        search: false,
        render: (_, row) => `¥${money(row.performanceBaseAmount)}`,
      },
      {
        title: '费率',
        dataIndex: 'rate',
        width: 80,
        search: false,
        render: (_, row) => `${(Number(row.rate) * 100).toFixed(2)}%`,
      },
      {
        title: '应缴',
        dataIndex: 'shouldPayAmount',
        width: 100,
        search: false,
        render: (_, row) => `¥${money(row.shouldPayAmount)}`,
      },
      {
        title: '已缴',
        dataIndex: 'paidAmount',
        width: 100,
        search: false,
        render: (_, row) => `¥${money(row.paidAmount)}`,
      },
      {
        title: '未缴',
        dataIndex: 'remainingAmount',
        width: 100,
        search: false,
        render: (_, row) => `¥${money(row.remainingAmount)}`,
      },
      {
        title: '状态',
        dataIndex: 'status',
        valueType: 'select',
        width: 100,
        valueEnum: {
          UNPAID: { text: '未缴费' },
          PARTIAL: { text: '部分缴纳' },
          PAID: { text: '已缴清' },
          WAIVED: { text: '已减免' },
        },
        render: (_, row) => <Tag color={statusColorMap[row.status] || 'default'}>{row.status}</Tag>,
      },
      {
        title: '强制全额',
        dataIndex: 'enforceFullPayment',
        width: 120,
        search: false,
        render: (_, row) => (
          <Switch
            checked={Boolean(row.enforceFullPayment)}
            onChange={async (checked) => {
              try {
                await enforceOfflineFeeBill({ billId: row.id, enforceFullPayment: checked });
                message.success('已更新强制全额状态');
                actionRef.current?.reload();
              } catch (e: any) {
                message.error(e?.data?.message || e?.message || '更新失败');
              }
            }}
          />
        ),
      },
      {
        title: '最后催收',
        dataIndex: 'lastRemindAt',
        width: 160,
        search: false,
        render: (_, row) => (row.lastRemindAt ? dayjs(row.lastRemindAt).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        valueType: 'option',
        width: 180,
        render: (_, row) => {
          const canPay = Number(row.remainingAmount || 0) > 0;

          return [
            <a
              key="pay"
              onClick={() => {
                setPayingBill(row);
                setPayVisible(true);
                payForm.setFieldsValue({ amount: Math.min(100, Number(row.remainingAmount || 0)) });
              }}
            >
              手动缴费
            </a>,
            <Popconfirm
              key="remind"
              title="确认发送催收提醒？"
              onConfirm={async () => {
                try {
                  await remindOfflineFeeBill({ billId: row.id });
                  message.success('催收时间已记录');
                  actionRef.current?.reload();
                } catch (e: any) {
                  message.error(e?.data?.message || e?.message || '操作失败');
                }
              }}
            >
              <a>催收</a>
            </Popconfirm>,
            !canPay ? <Tag key="done" color="success">已结清</Tag> : null,
          ].filter(Boolean);
        },
      },
    ],
    [payForm],
  );

  return (
    <>
      <ProTable<OfflineFeeBill>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        headerTitle="线下费用账单"
        search={{ labelWidth: 86 }}
        scroll={{ x: 1700 }}
        toolBarRender={() => [
          <Button
            key="generate"
            type="primary"
            onClick={() => {
              setGenerateVisible(true);
              generateForm.setFieldsValue({ month: dayjs().subtract(1, 'month').format('YYYY-MM') });
            }}
          >
            生成月账单
          </Button>,
        ]}
        request={async (params) => {
          const res = await listOfflineFeeBills({
            page: params.current,
            limit: params.pageSize,
            billMonth: params.billMonth,
            status: params.status,
            userId: params.userId,
          });

          return {
            data: res?.list || [],
            total: Number(res?.total || 0),
            success: true,
          };
        }}
      />

      <Modal
        title="生成线下费用账单"
        open={generateVisible}
        confirmLoading={submitting}
        onCancel={() => {
          setGenerateVisible(false);
          generateForm.resetFields();
        }}
        onOk={async () => {
          try {
            const values = await generateForm.validateFields();
            setSubmitting(true);
            await generateOfflineFeeBills({ month: values.month });
            message.success('账单已生成/更新');
            setGenerateVisible(false);
            actionRef.current?.reload();
          } catch (e: any) {
            if (!e?.errorFields) message.error(e?.data?.message || e?.message || '生成失败');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form form={generateForm} layout="vertical">
          <Form.Item
            label="账单月份"
            name="month"
            rules={[
              { required: true, message: '请输入账单月份' },
              { pattern: /^\d{4}-\d{2}$/, message: '格式必须为 YYYY-MM' },
            ]}
          >
            <Input style={{ width: '100%' }} placeholder="例如 2026-03" maxLength={7} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="手动缴纳线下费用"
        open={payVisible}
        confirmLoading={submitting}
        onCancel={() => {
          setPayVisible(false);
          setPayingBill(null);
          payForm.resetFields();
        }}
        onOk={async () => {
          try {
            const values = await payForm.validateFields();
            if (!payingBill) return;

            setSubmitting(true);
            await payOfflineFeeBill({
              billId: payingBill.id,
              amount: Number(values.amount),
              remark: values.remark,
            });
            message.success('已完成缴费');
            setPayVisible(false);
            setPayingBill(null);
            payForm.resetFields();
            actionRef.current?.reload();
          } catch (e: any) {
            if (!e?.errorFields) message.error(e?.data?.message || e?.message || '缴费失败');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form form={payForm} layout="vertical">
          <Form.Item label="当前未缴金额">
            <Tag color="orange">¥{money(payingBill?.remainingAmount || 0)}</Tag>
          </Form.Item>

          <Form.Item
            label="缴费金额"
            name="amount"
            rules={[
              { required: true, message: '请输入缴费金额' },
              {
                validator: async (_, v) => {
                  const n = Number(v || 0);
                  if (!Number.isFinite(n) || n <= 0) throw new Error('缴费金额必须大于 0');
                  if (payingBill && n > Number(payingBill.remainingAmount || 0)) {
                    throw new Error('缴费金额不能超过未缴金额');
                  }
                },
              },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0.01} step={10} precision={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default OfflineFeesPage;
