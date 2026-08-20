import React, { useMemo, useRef, useState } from 'react';
import { Button, Card, Col, DatePicker, Form, Input, InputNumber, message, Modal, Popconfirm, Row, Select, Space, Statistic, Tabs, Tag } from 'antd';
import dayjs from 'dayjs';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  batchDeleteOfflineFeeBills,
  confirmOfflineFeeBillPaidExternal,
  createOfflineFeeContract,
  generateOfflineFeeBills,
  listOfflineFeeBills,
  listOfflineFeeContracts,
  OfflineFeeBill,
  OfflineFeeContract,
  OfflineStaffOption,
  listOfflineStaffOptions,
  payOfflineFeeBill,
  updateOfflineFeeContract,
  waiveOfflineFeeBill,
} from '@/services/api';

const money = (v: any) => Number(v ?? 0).toFixed(2);
const monthValue = (value: any) => (dayjs.isDayjs(value) ? value.format('YYYY-MM') : String(value || ''));

const statusTextMap: Record<string, string> = {
  UNPAID: '未缴费',
  PARTIAL: '部分缴纳',
  PAID: '已缴清',
  WAIVED: '已减免',
};

const statusColorMap: Record<string, string> = {
  UNPAID: 'error',
  PARTIAL: 'warning',
  PAID: 'success',
  WAIVED: 'default',
};

const OfflineFeesPage: React.FC = () => {
  const contractActionRef = useRef<ActionType>();
  const billActionRef = useRef<ActionType>();
  const [contractOpen, setContractOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<OfflineFeeContract | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [payVisible, setPayVisible] = useState(false);
  const [externalVisible, setExternalVisible] = useState(false);
  const [payingBill, setPayingBill] = useState<OfflineFeeBill | null>(null);
  const [externalBill, setExternalBill] = useState<OfflineFeeBill | null>(null);
  const [selectedBillRowKeys, setSelectedBillRowKeys] = useState<React.Key[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffOptions, setStaffOptions] = useState<OfflineStaffOption[]>([]);
  const [stats, setStats] = useState({
    billAmount: 0,
    chargedAmount: 0,
    externalPaidAmount: 0,
    waivedAmount: 0,
    remainingAmount: 0,
  });
  const [contractForm] = Form.useForm();
  const [generateForm] = Form.useForm();
  const [payForm] = Form.useForm();
  const [externalForm] = Form.useForm();

  const fetchOfflineStaffOptions = async (keyword?: string) => {
    try {
      setStaffLoading(true);
      const list = await listOfflineStaffOptions({ keyword: String(keyword || '').trim() || undefined });
      setStaffOptions(Array.isArray(list) ? list : []);
    } catch (e: any) {
      message.error(e?.data?.message || e?.message || '获取线下服务者列表失败');
    } finally {
      setStaffLoading(false);
    }
  };

  const staffSelectOptions = staffOptions.map((staff) => ({
    label: `${staff.name || staff.realName || staff.phone} (${staff.phone})`,
    value: staff.id,
  }));

  const openCreateContract = async () => {
    setEditingContract(null);
    contractForm.resetFields();
    contractForm.setFieldsValue({ startMonth: dayjs(), status: 'ACTIVE' });
    setContractOpen(true);
    await fetchOfflineStaffOptions();
  };

  const openEditContract = (row: OfflineFeeContract) => {
    setEditingContract(row);
    contractForm.setFieldsValue({
      userId: row.userId,
      monthlyAmount: Number(row.monthlyAmount || 0),
      startMonth: row.startMonth ? dayjs(row.startMonth, 'YYYY-MM') : undefined,
      endMonth: row.endMonth ? dayjs(row.endMonth, 'YYYY-MM') : undefined,
      status: row.status,
      remark: row.remark || '',
    });
    setContractOpen(true);
  };

  const openPayModal = (row: OfflineFeeBill) => {
    setPayingBill(row);
    payForm.resetFields();
    payForm.setFieldsValue({ amount: Number(row.remainingAmount || 0) });
    setPayVisible(true);
  };

  const openExternalModal = (row: OfflineFeeBill) => {
    setExternalBill(row);
    externalForm.resetFields();
    externalForm.setFieldsValue({ amount: Number(row.remainingAmount || 0) });
    setExternalVisible(true);
  };

  const contractColumns = useMemo<ProColumns<OfflineFeeContract>[]>(() => [
    {
      title: '服务者',
      dataIndex: 'userId',
      width: 160,
      render: (_, row) => row.user?.name || row.user?.realName || row.user?.phone || `#${row.userId}`,
    },
    { title: '手机号', dataIndex: ['user', 'phone'], width: 130 },
    {
      title: '每月费用',
      dataIndex: 'monthlyAmount',
      width: 120,
      render: (_, row) => `¥${money(row.monthlyAmount)}`,
    },
    { title: '开始月份', dataIndex: 'startMonth', width: 110 },
    { title: '结束月份', dataIndex: 'endMonth', width: 110, render: (_, row) => row.endMonth || '长期' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, row) => row.status === 'ACTIVE' ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>,
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    {
      title: '操作',
      valueType: 'option',
      width: 90,
      render: (_, row) => [<a key="edit" onClick={() => openEditContract(row)}>编辑</a>],
    },
  ], []);

  const billColumns = useMemo<ProColumns<OfflineFeeBill>[]>(
    () => [
      {
        title: '月份',
        dataIndex: 'billMonth',
        width: 110,
        valueType: 'dateMonth',
        transform: (value: any) => ({ billMonth: value ? monthValue(value) : undefined }),
      },
      {
        title: '服务者',
        dataIndex: 'userId',
        valueType: 'select',
        width: 150,
        fieldProps: {
          showSearch: true,
          filterOption: false,
          loading: staffLoading,
          placeholder: '搜索服务者',
          options: staffSelectOptions,
          onSearch: fetchOfflineStaffOptions,
          onDropdownVisibleChange: (open: boolean) => {
            if (open && !staffOptions.length) void fetchOfflineStaffOptions();
          },
        },
        render: (_, row) => row.user?.name || row.user?.phone || `#${row.userId}`,
      },
      { title: '手机号', dataIndex: ['user', 'phone'], width: 120, search: false },
      {
        title: '扣费时间',
        dataIndex: 'dueAt',
        width: 160,
        search: false,
        render: (_, row) => (row.dueAt ? dayjs(row.dueAt).format('YYYY-MM-DD HH:mm') : '-'),
      },
      { title: '扣费金额', dataIndex: 'shouldPayAmount', width: 110, search: false, render: (_, row) => `¥${money(row.shouldPayAmount)}` },
      { title: '收费累计', dataIndex: 'manualPaidAmount', width: 110, search: false, render: (_, row) => `¥${money(row.manualPaidAmount || 0)}` },
      { title: '其他渠道', dataIndex: 'externalPaidAmount', width: 110, search: false, render: (_, row) => `¥${money(row.externalPaidAmount || 0)}` },
      { title: '减免', dataIndex: 'waivedAmount', width: 100, search: false, render: (_, row) => `¥${money(row.waivedAmount || 0)}` },
      { title: '未结清', dataIndex: 'remainingAmount', width: 100, search: false, render: (_, row) => `¥${money(row.remainingAmount)}` },
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
        render: (_, row) => <Tag color={statusColorMap[row.status] || 'default'}>{statusTextMap[row.status] || row.status}</Tag>,
      },
      { title: '备注', dataIndex: 'remark', width: 180, search: false, ellipsis: true, render: (_, row) => row.remark || '-' },
      {
        title: '操作',
        valueType: 'option',
        width: 260,
        render: (_, row) => {
          const canSettle = Number(row.remainingAmount || 0) > 0;
          return [
            canSettle ? <a key="pay" onClick={() => openPayModal(row)}>手动缴费</a> : null,
            canSettle ? <a key="external" onClick={() => openExternalModal(row)}>其他渠道已缴</a> : null,
            canSettle ? (
              <Popconfirm
                key="waive"
                title="确认减免该线下管理费？"
                onConfirm={async () => {
                  try {
                    await waiveOfflineFeeBill({ billId: row.id, remark: '后台减免线下管理费' });
                    message.success('已减免');
                    billActionRef.current?.reload();
                  } catch (e: any) {
                    message.error(e?.data?.message || e?.message || '减免失败');
                  }
                }}
              >
                <a>减免</a>
              </Popconfirm>
            ) : null,
          ].filter(Boolean);
        },
      },
    ],
    [staffLoading, staffOptions],
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        <Col xs={12} md={4}><Card size="small"><Statistic title="账单金额" value={stats.billAmount} precision={2} prefix="¥" /></Card></Col>
        <Col xs={12} md={5}><Card size="small"><Statistic title="收费累计" value={stats.chargedAmount} precision={2} prefix="¥" /></Card></Col>
        <Col xs={12} md={5}><Card size="small"><Statistic title="其他渠道收取" value={stats.externalPaidAmount} precision={2} prefix="¥" /></Card></Col>
        <Col xs={12} md={5}><Card size="small"><Statistic title="减免" value={stats.waivedAmount} precision={2} prefix="¥" /></Card></Col>
        <Col xs={12} md={5}><Card size="small"><Statistic title="未结清" value={stats.remainingAmount} precision={2} prefix="¥" /></Card></Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'contracts',
            label: '收费配置',
            children: (
              <ProTable<OfflineFeeContract>
                rowKey="id"
                actionRef={contractActionRef}
                columns={contractColumns}
                search={false}
                pagination={{ pageSize: 10 }}
                toolBarRender={() => [<Button key="create" type="primary" onClick={() => void openCreateContract()}>新增收费配置</Button>]}
                request={async (params) => {
                  const res = await listOfflineFeeContracts({ page: params.current, limit: params.pageSize });
                  return { data: res?.list || [], total: Number(res?.total || 0), success: true };
                }}
              />
            ),
          },
          {
            key: 'bills',
            label: '账单列表',
            children: (
              <ProTable<OfflineFeeBill>
                rowKey="id"
                actionRef={billActionRef}
                columns={billColumns}
                search={{ labelWidth: 86 }}
                scroll={{ x: 1500 }}
                rowSelection={{
                  selectedRowKeys: selectedBillRowKeys,
                  onChange: setSelectedBillRowKeys,
                }}
                toolBarRender={() => [
                  <Popconfirm
                    key="batch-delete"
                    title={`确认删除选中的 ${selectedBillRowKeys.length} 条线下费用账单？`}
                    description="仅无缴费、减免流水的账单会被删除；已有流水的账单会自动跳过。"
                    okText="确认删除"
                    cancelText="取消"
                    onConfirm={async () => {
                      try {
                        const res = await batchDeleteOfflineFeeBills({
                          billIds: selectedBillRowKeys.map((id) => Number(id)),
                        });
                        if (Number(res?.skipped || 0) > 0) {
                          message.warning(`已删除 ${res?.deleted || 0} 条，跳过 ${res?.skipped || 0} 条存在流水或不存在的账单`);
                        } else {
                          message.success(`已删除 ${res?.deleted || 0} 条线下费用账单`);
                        }
                        setSelectedBillRowKeys([]);
                        billActionRef.current?.reload();
                      } catch (e: any) {
                        message.error(e?.data?.message || e?.message || '批量删除失败');
                      }
                    }}
                  >
                    <Button danger disabled={selectedBillRowKeys.length === 0}>
                      批量删除
                    </Button>
                  </Popconfirm>,
                  <Button
                    key="generate"
                    onClick={() => {
                      generateForm.setFieldsValue({ month: dayjs() });
                      setGenerateOpen(true);
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
                    billMonth: billMonthValue ? monthValue(billMonthValue) : undefined,
                    status: params.status,
                    userId: params.userId,
                  });
                  setStats({
                    billAmount: Number(res?.stats?.billAmount || 0),
                    chargedAmount: Number(res?.stats?.chargedAmount || 0),
                    externalPaidAmount: Number(res?.stats?.externalPaidAmount || 0),
                    waivedAmount: Number(res?.stats?.waivedAmount || 0),
                    remainingAmount: Number(res?.stats?.remainingAmount || 0),
                  });
                  return { data: res?.list || [], total: Number(res?.total || 0), success: true };
                }}
              />
            ),
          },
        ]}
      />

      <Modal
        title={editingContract ? '编辑收费配置' : '新增收费配置'}
        open={contractOpen}
        confirmLoading={submitting}
        onCancel={() => {
          setContractOpen(false);
          setEditingContract(null);
        }}
        onOk={async () => {
          try {
            const values = await contractForm.validateFields();
            setSubmitting(true);
            const payload = {
              userId: Number(values.userId),
              monthlyAmount: Number(values.monthlyAmount || 0),
              startMonth: monthValue(values.startMonth),
              endMonth: values.endMonth ? monthValue(values.endMonth) : null,
              status: values.status,
              remark: values.remark,
            };
            if (editingContract) {
              await updateOfflineFeeContract({ id: editingContract.id, ...payload });
              message.success('配置已更新');
            } else {
              await createOfflineFeeContract(payload);
              message.success('配置已创建');
            }
            setContractOpen(false);
            setEditingContract(null);
            contractActionRef.current?.reload();
          } catch (e: any) {
            if (!e?.errorFields) message.error(e?.data?.message || e?.message || '保存失败');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form form={contractForm} layout="vertical">
          <Form.Item label="线下服务者" name="userId" rules={[{ required: true, message: '请选择线下服务者' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              loading={staffLoading}
              placeholder="请选择线下服务者"
              disabled={Boolean(editingContract)}
              onSearch={fetchOfflineStaffOptions}
              options={staffSelectOptions}
            />
          </Form.Item>
          <Form.Item label="每月费用" name="monthlyAmount" rules={[{ required: true, message: '请输入每月费用' }]}>
            <InputNumber min={0.01} step={10} precision={2} style={{ width: '100%' }} addonBefore="¥" />
          </Form.Item>
          <Form.Item label="开始月份" name="startMonth" rules={[{ required: true, message: '请选择开始月份' }]}>
            <DatePicker picker="month" style={{ width: '100%' }} format="YYYY-MM" />
          </Form.Item>
          <Form.Item label="结束月份" name="endMonth">
            <DatePicker picker="month" style={{ width: '100%' }} format="YYYY-MM" allowClear />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={[{ label: '启用', value: 'ACTIVE' }, { label: '停用', value: 'INACTIVE' }]} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} placeholder="例如：线下门店管理费" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="生成线下管理费月账单"
        open={generateOpen}
        confirmLoading={submitting}
        onCancel={() => setGenerateOpen(false)}
        onOk={async () => {
          try {
            const values = await generateForm.validateFields();
            setSubmitting(true);
            const res: any = await generateOfflineFeeBills({ month: monthValue(values.month), confirmed: true });
            message.success(`已生成/更新 ${res?.affected ?? 0} 条账单`);
            setGenerateOpen(false);
            billActionRef.current?.reload();
          } catch (e: any) {
            if (!e?.errorFields) message.error(e?.data?.message || e?.message || '生成失败');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form form={generateForm} layout="vertical">
          <div style={{ marginBottom: 12, color: '#666', lineHeight: '22px' }}>
            系统每月 20 日会自动生成当月线下管理费账单；这里可用于补生成或手动重试。
          </div>
          <Form.Item label="账单月份" name="month" rules={[{ required: true, message: '请选择月份' }]}>
            <DatePicker picker="month" format="YYYY-MM" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="手动缴纳线下管理费"
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
            await payOfflineFeeBill({ billId: payingBill.id, amount: Number(values.amount), remark: values.remark });
            message.success('已完成缴费');
            setPayVisible(false);
            setPayingBill(null);
            payForm.resetFields();
            billActionRef.current?.reload();
          } catch (e: any) {
            if (!e?.errorFields) message.error(e?.data?.message || e?.message || '缴费失败');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form form={payForm} layout="vertical">
          <Form.Item label="当前未结清金额"><Tag color="orange">¥{money(payingBill?.remainingAmount || 0)}</Tag></Form.Item>
          <Form.Item label="缴费金额" name="amount" rules={[{ required: true, message: '请输入缴费金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} max={Number(payingBill?.remainingAmount || 0)} step={10} precision={2} addonBefore="¥" />
          </Form.Item>
          <Form.Item label="备注" name="remark"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title="确认其他渠道已缴"
        open={externalVisible}
        confirmLoading={submitting}
        onCancel={() => {
          setExternalVisible(false);
          setExternalBill(null);
          externalForm.resetFields();
        }}
        onOk={async () => {
          try {
            const values = await externalForm.validateFields();
            if (!externalBill) return;
            setSubmitting(true);
            await confirmOfflineFeeBillPaidExternal({
              billId: externalBill.id,
              amount: Number(values.amount),
              remark: String(values.remark || '').trim(),
            });
            message.success('已记录其他渠道收款');
            setExternalVisible(false);
            setExternalBill(null);
            externalForm.resetFields();
            billActionRef.current?.reload();
          } catch (e: any) {
            if (!e?.errorFields) message.error(e?.data?.message || e?.message || '确认失败');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form form={externalForm} layout="vertical">
          <Form.Item label="当前未结清金额"><Tag color="orange">¥{money(externalBill?.remainingAmount || 0)}</Tag></Form.Item>
          <Form.Item label="收款金额" name="amount" rules={[{ required: true, message: '请输入收款金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} max={Number(externalBill?.remainingAmount || 0)} step={10} precision={2} addonBefore="¥" />
          </Form.Item>
          <Form.Item label="收款说明" name="remark" rules={[{ required: true, message: '请填写收款说明' }]}>
            <Input.TextArea rows={3} placeholder="例如：微信收款码已收 / 现金已收 / 银行转账流水号..." />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default OfflineFeesPage;
