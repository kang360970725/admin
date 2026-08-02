import React, { useMemo, useRef, useState } from 'react';
import { Button, DatePicker, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Switch, Tag } from 'antd';
import dayjs from 'dayjs';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  deleteOfflineFeeBill,
  enforceOfflineFeeBill,
  generateOfflineFeeBills,
  listOfflineFeeBills,
  OfflineFeeBill,
  OfflineStaffOption,
  listOfflineStaffOptions,
  manualCreateOfflineFeeBill,
  payOfflineFeeBill,
  refundOfflineFeeBill,
  remindOfflineFeeBill,
  updateOfflineFeeBill,
  waiveOfflineFeeBill,
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
  const [manualVisible, setManualVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [payVisible, setPayVisible] = useState(false);
  const [editingBill, setEditingBill] = useState<OfflineFeeBill | null>(null);
  const [payingBill, setPayingBill] = useState<OfflineFeeBill | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffOptions, setStaffOptions] = useState<OfflineStaffOption[]>([]);
  const [generateForm] = Form.useForm();
  const [manualForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [payForm] = Form.useForm();

  const fetchOfflineStaffOptions = async (keyword?: string) => {
    try {
      setStaffLoading(true);
      const list = await listOfflineStaffOptions({ keyword: String(keyword || '').trim() || undefined });
      setStaffOptions(Array.isArray(list) ? list : []);
    } catch (e: any) {
      message.error(e?.data?.message || e?.message || '获取线下员工列表失败');
    } finally {
      setStaffLoading(false);
    }
  };

  const columns = useMemo<ProColumns<OfflineFeeBill>[]>(
    () => [
      {
        title: '月份',
        dataIndex: 'billMonth',
        width: 120,
        valueType: 'dateMonth',
        transform: (value) => ({
          billMonth: value ? (dayjs.isDayjs(value) ? value.format('YYYY-MM') : String(value)) : undefined,
        }),
      },
      {
        title: '员工',
        dataIndex: 'userId',
        valueType: 'select',
        width: 140,
        fieldProps: {
          showSearch: true,
          filterOption: false,
          loading: staffLoading,
          placeholder: '搜索员工',
          options: staffOptions.map((staff) => ({
            label: `${staff.name || staff.realName || staff.phone} (${staff.phone})`,
            value: staff.id,
          })),
          onSearch: fetchOfflineStaffOptions,
          onDropdownVisibleChange: (open: boolean) => {
            if (open && !staffOptions.length) void fetchOfflineStaffOptions();
          },
        },
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
        width: 320,
        render: (_, row) => {
          const canPay = Number(row.remainingAmount || 0) > 0;
          const paidAmount = Number(row.paidAmount || 0);
          const isWaived = String(row.status || '') === 'WAIVED';

          return [
            <a
              key="edit"
              onClick={() => {
                setEditingBill(row);
                setEditVisible(true);
                editForm.setFieldsValue({
                  performanceBaseAmount: Number(row.performanceBaseAmount || 0),
                });
              }}
            >
              编辑账单
            </a>,
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
            paidAmount > 0 ? (
              <Popconfirm
                key="refund"
                title="确认回退已缴金额？"
                description={`将回退 ¥${money(row.paidAmount)} 到员工钱包可用余额`}
                onConfirm={async () => {
                  try {
                    await refundOfflineFeeBill({ billId: row.id });
                    message.success('已回退已缴金额');
                    actionRef.current?.reload();
                  } catch (e: any) {
                    message.error(e?.data?.message || e?.message || '回退失败');
                  }
                }}
              >
                <a>回退已缴</a>
              </Popconfirm>
            ) : null,
            !isWaived && paidAmount <= 0 ? (
              <Popconfirm
                key="waive"
                title="确认废除该账单？"
                description="废除后该账单不再参与催缴和校验"
                onConfirm={async () => {
                  try {
                    await waiveOfflineFeeBill({ billId: row.id });
                    message.success('账单已废除');
                    actionRef.current?.reload();
                  } catch (e: any) {
                    message.error(e?.data?.message || e?.message || '废除失败');
                  }
                }}
              >
                <a>废除账单</a>
              </Popconfirm>
            ) : null,
            isWaived ? (
              <Popconfirm
                key="delete"
                title="确认删除该已废除账单？"
                description="删除后列表中将不再展示该账单，仅已废除且无缴费记录的账单允许删除。"
                okText="删除"
                okButtonProps={{ danger: true }}
                onConfirm={async () => {
                  try {
                    await deleteOfflineFeeBill({ billId: row.id });
                    message.success('账单已删除');
                    actionRef.current?.reload();
                  } catch (e: any) {
                    message.error(e?.data?.message || e?.message || '删除失败');
                  }
                }}
              >
                <a style={{ color: '#ff4d4f' }}>删除账单</a>
              </Popconfirm>
            ) : null,
            !canPay ? <Tag key="done" color="success">已结清</Tag> : null,
          ].filter(Boolean);
        },
      },
    ],
    [editForm, fetchOfflineStaffOptions, payForm, staffLoading, staffOptions],
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
            key="manual"
            onClick={async () => {
              setManualVisible(true);
              manualForm.setFieldsValue({
                month: dayjs().subtract(1, 'month'),
                performanceBaseAmount: 0,
              });
              await fetchOfflineStaffOptions();
            }}
          >
            手动录入账单
          </Button>,
          <Button
            key="generate"
            type="primary"
            onClick={() => {
              setGenerateVisible(true);
              generateForm.setFieldsValue({ month: dayjs().subtract(1, 'month') });
            }}
          >
            生成月账单
          </Button>,
        ]}
        request={async (params) => {
          const billMonthValue = (params as any).billMonth;
          const res = await listOfflineFeeBills({
            page: params.current,
            limit: params.pageSize,
            billMonth: billMonthValue ? (dayjs.isDayjs(billMonthValue) ? billMonthValue.format('YYYY-MM') : String(billMonthValue)) : undefined,
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
            const month = dayjs.isDayjs(values.month) ? values.month.format('YYYY-MM') : String(values.month || '');
            await generateOfflineFeeBills({ month, confirmed: true });
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
          <div style={{ marginBottom: 12, color: '#666', lineHeight: '22px' }}>
            系统不会自动生成线下费用账单。确认后将按所选月份为当前线下员工生成或更新账单。
          </div>
          <Form.Item
            label="账单月份"
            name="month"
            rules={[
              { required: true, message: '请选择账单月份' },
            ]}
          >
            <DatePicker picker="month" style={{ width: '100%' }} format="YYYY-MM" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="手动录入线下账单"
        open={manualVisible}
        confirmLoading={submitting}
        onCancel={() => {
          setManualVisible(false);
          manualForm.resetFields();
        }}
        onOk={async () => {
          try {
            const values = await manualForm.validateFields();
            setSubmitting(true);
            await manualCreateOfflineFeeBill({
              userId: Number(values.userId),
              month: dayjs.isDayjs(values.month) ? values.month.format('YYYY-MM') : String(values.month || ''),
              performanceBaseAmount: Number(values.performanceBaseAmount || 0),
            });
            message.success('线下账单已录入');
            setManualVisible(false);
            manualForm.resetFields();
            actionRef.current?.reload();
          } catch (e: any) {
            if (!e?.errorFields) message.error(e?.data?.message || e?.message || '录入失败');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form form={manualForm} layout="vertical">
          <Form.Item
            label="线下员工"
            name="userId"
            rules={[{ required: true, message: '请选择线下员工' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              loading={staffLoading}
              placeholder="请选择线下员工"
              onSearch={fetchOfflineStaffOptions}
              options={staffOptions.map((staff) => ({
                label: `${staff.name || staff.realName || staff.phone} (${staff.phone})`,
                value: staff.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="账单月份"
            name="month"
            rules={[
              { required: true, message: '请选择账单月份' },
            ]}
          >
            <DatePicker picker="month" style={{ width: '100%' }} format="YYYY-MM" />
          </Form.Item>

          <Form.Item
            label="业绩基数"
            name="performanceBaseAmount"
            rules={[
              { required: true, message: '请输入业绩基数' },
              {
                validator: async (_, v) => {
                  const n = Number(v);
                  if (!Number.isFinite(n) || n < 0) throw new Error('业绩基数不能小于 0');
                },
              },
            ]}
          >
            <InputNumber min={0} step={100} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑线下费用账单"
        open={editVisible}
        confirmLoading={submitting}
        onCancel={() => {
          setEditVisible(false);
          setEditingBill(null);
          editForm.resetFields();
        }}
        onOk={async () => {
          try {
            const values = await editForm.validateFields();
            if (!editingBill) return;

            setSubmitting(true);
            await updateOfflineFeeBill({
              billId: editingBill.id,
              performanceBaseAmount: Number(values.performanceBaseAmount || 0),
            });
            message.success('账单已更新');
            setEditVisible(false);
            setEditingBill(null);
            editForm.resetFields();
            actionRef.current?.reload();
          } catch (e: any) {
            if (!e?.errorFields) message.error(e?.data?.message || e?.message || '更新失败');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item label="员工">
            <Input
              value={
                editingBill
                  ? `${editingBill.user?.name || editingBill.user?.phone || `#${editingBill.userId}`}`
                  : '-'
              }
              disabled
            />
          </Form.Item>

          <Form.Item label="账单月份">
            <Input value={editingBill?.billMonth || '-'} disabled />
          </Form.Item>

          <Form.Item
            label="业绩基数"
            name="performanceBaseAmount"
            rules={[
              { required: true, message: '请输入业绩基数' },
              {
                validator: async (_, v) => {
                  const n = Number(v);
                  if (!Number.isFinite(n) || n < 0) throw new Error('业绩基数不能小于 0');
                },
              },
            ]}
          >
            <InputNumber min={0} step={100} precision={2} style={{ width: '100%' }} />
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
