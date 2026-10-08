import React, { useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, DatePicker, Descriptions, Form, Input, InputNumber, List, message, Modal, Popconfirm, Row, Select, Space, Statistic, Tabs, Tag } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import {
  confirmEquipmentRentalBillPaidExternal,
  createEquipmentRentalContract,
  EquipmentRentalBill,
  EquipmentRentalContract,
  generateEquipmentRentalBills,
  getPlayerOptions,
  listEquipmentRentalBills,
  listEquipmentRentalContracts,
  payEquipmentRentalBill,
  refundEquipmentRentalBill,
  updateEquipmentRentalContract,
  waiveEquipmentRentalBill,
} from '@/services/api';
import { maskPhone } from '@/utils/privacy';

const money = (v: any) => Number(v ?? 0).toFixed(2);
const monthValue = (value: any) => (dayjs.isDayjs(value) ? value.format('YYYY-MM') : String(value || ''));
const dateValue = (value: any) => (dayjs.isDayjs(value) ? value.format('YYYY-MM-DD') : String(value || ''));

const EquipmentRentalFeesPage: React.FC = () => {
  const contractActionRef = useRef<ActionType>();
  const billActionRef = useRef<ActionType>();
  const [contractOpen, setContractOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<EquipmentRentalContract | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [externalPaidOpen, setExternalPaidOpen] = useState(false);
  const [externalPaidBill, setExternalPaidBill] = useState<EquipmentRentalBill | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundBill, setRefundBill] = useState<EquipmentRentalBill | null>(null);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  const [logBill, setLogBill] = useState<EquipmentRentalBill | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffOptions, setStaffOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [billStats, setBillStats] = useState({
    billAmount: 0,
    chargedAmount: 0,
    externalPaidAmount: 0,
    waivedAmount: 0,
    remainingAmount: 0,
  });
  const [contractForm] = Form.useForm();
  const [generateForm] = Form.useForm();
  const [externalPaidForm] = Form.useForm();
  const [refundForm] = Form.useForm();

  const openRefund = (row: EquipmentRentalBill, presetAmount?: number, presetRemark?: string) => {
    setRefundBill(row);
    refundForm.resetFields();
    refundForm.setFieldsValue({
      amount: Number(presetAmount ?? row.refundableAmount ?? row.paidAmount ?? 0),
      remark: presetRemark || '',
    });
    setRefundOpen(true);
  };

  const fetchStaffOptions = async (keyword?: string) => {
    try {
      setStaffLoading(true);
      const res: any = await getPlayerOptions({
        keyword: String(keyword || '').trim() || undefined,
        onlyIdle: false,
        includeFrozen: true,
        limit: 100,
      });
      const rows = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setStaffOptions(rows.map((item: any) => ({
        label: `${item.name || item.realName || maskPhone(item.phone) || `#${item.id}`} (${maskPhone(item.phone)})`,
        value: Number(item.id),
      })));
    } catch (e: any) {
      message.error(e?.data?.message || e?.message || '获取员工失败');
    } finally {
      setStaffLoading(false);
    }
  };

  const openCreateContract = async () => {
    setEditingContract(null);
    contractForm.resetFields();
    contractForm.setFieldsValue({
      monthlyAmount: 0,
      startDate: dayjs(),
      status: 'ACTIVE',
    });
    setContractOpen(true);
    await fetchStaffOptions();
  };

  const openEditContract = (row: EquipmentRentalContract) => {
    setEditingContract(row);
    contractForm.setFieldsValue({
      userId: Number(row.userId),
      monthlyAmount: Number(row.monthlyAmount || 0),
      startDate: row.startDate ? dayjs(row.startDate) : row.startMonth ? dayjs(`${row.startMonth}-01`) : undefined,
      endDate: row.endDate ? dayjs(row.endDate) : row.endMonth ? dayjs(`${row.endMonth}-01`).endOf('month') : undefined,
      status: row.status,
      remark: row.remark || '',
    });
    setContractOpen(true);
    void fetchStaffOptions(row.user?.phone || row.user?.name || '');
  };

  const contractColumns = useMemo<ProColumns<EquipmentRentalContract>[]>(() => [
    {
      title: '员工',
      dataIndex: 'userId',
      width: 160,
      search: false,
      render: (_, row) => row.user?.name || maskPhone(row.user?.phone) || `#${row.userId}`,
    },
    { title: '手机号', dataIndex: ['user', 'phone'], width: 130, search: false, render: (v) => maskPhone(v as any) },
    { title: '月租', dataIndex: 'monthlyAmount', width: 100, search: false, render: (_, row) => `¥${money(row.monthlyAmount)}` },
    { title: '起租日', dataIndex: 'startDate', width: 120, search: false, render: (_, row) => row.startDate ? dayjs(row.startDate).format('YYYY-MM-DD') : row.startMonth || '-' },
    { title: '结束日', dataIndex: 'endDate', width: 120, search: false, render: (_, row) => row.endDate ? dayjs(row.endDate).format('YYYY-MM-DD') : row.endMonth || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      width: 100,
      valueEnum: { ACTIVE: { text: '启用' }, INACTIVE: { text: '停用' } },
      render: (_, row) => <Tag color={row.status === 'ACTIVE' ? 'success' : 'default'}>{row.status === 'ACTIVE' ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 260,
      render: (_, row) => [<a key="edit" onClick={() => openEditContract(row)}>编辑</a>],
    },
  ], []);

  const billColumns = useMemo<ProColumns<EquipmentRentalBill>[]>(() => [
    {
      title: '月份',
      dataIndex: 'billMonth',
      width: 120,
      valueType: 'dateMonth',
      transform: (value: any) => ({ billMonth: value ? monthValue(value) : undefined }),
    },
    {
      title: '员工',
      dataIndex: 'userId',
      valueType: 'select',
      width: 160,
      fieldProps: {
        showSearch: true,
        filterOption: false,
        loading: staffLoading,
        options: staffOptions,
        placeholder: '搜索员工',
        onSearch: fetchStaffOptions,
        onDropdownVisibleChange: (open: boolean) => {
          if (open && !staffOptions.length) void fetchStaffOptions();
        },
      },
      render: (_, row) => row.user?.name || maskPhone(row.user?.phone) || `#${row.userId}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      valueType: 'select',
      valueEnum: { PENDING: { text: '待确认' }, PAID: { text: '已缴费' }, WAIVED: { text: '已减免' } },
      render: (_, row) => {
        const color = row.status === 'PAID' ? 'success' : row.status === 'WAIVED' ? 'default' : 'warning';
        const label = row.status === 'PENDING'
          ? '待确认'
          : row.status === 'WAIVED'
            ? '已减免'
            : row.walletTxId
              ? '已扣费'
              : '已缴费';
        return <Tag color={color}>{label}</Tag>;
      },
    },
    { title: '应缴', dataIndex: 'amount', width: 100, search: false, render: (_, row) => `¥${money(row.amount)}` },
    { title: '已缴', dataIndex: 'paidAmount', width: 100, search: false, render: (_, row) => `¥${money(row.paidAmount)}` },
    { title: '已退', dataIndex: 'refundedAmount', width: 100, search: false, render: (_, row) => Number(row.refundedAmount || 0) > 0 ? <Tag color="blue">¥{money(row.refundedAmount)}</Tag> : '-' },
    { title: '未扣', dataIndex: 'remainingAmount', width: 100, search: false, render: (_, row) => `¥${money(row.remainingAmount)}` },
    {
      title: '计费周期',
      dataIndex: 'periodStart',
      width: 210,
      search: false,
      render: (_, row) => `${row.periodStart ? dayjs(row.periodStart).format('YYYY-MM-DD') : '-'} ~ ${row.periodEnd ? dayjs(row.periodEnd).format('YYYY-MM-DD') : '-'}`,
    },
    {
      title: '缴费日',
      dataIndex: 'dueAt',
      width: 120,
      search: false,
      render: (_, row) => row.dueAt ? dayjs(row.dueAt).format('YYYY-MM-DD') : '-',
    },
    {
      title: '总资产',
      dataIndex: 'totalAssets',
      width: 120,
      search: false,
      render: (_, row) => (
        <Tag color={row.insufficient ? 'red' : 'blue'}>¥{money(row.totalAssets)}</Tag>
      ),
    },
    {
      title: '风险',
      dataIndex: 'onlyRisk',
      valueType: 'select',
      width: 120,
      valueEnum: { true: { text: '仅余额不足' } },
      render: (_, row) => row.insufficient ? <Tag color="red">余额不足</Tag> : <Tag>正常</Tag>,
    },
    {
      title: '确认时间',
      dataIndex: 'confirmedAt',
      width: 160,
      search: false,
      render: (_, row) => row.confirmedAt ? dayjs(row.confirmedAt).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 260,
      render: (_, row) => {
        const actions: React.ReactNode[] = row.status === 'PENDING' ? [
        <Popconfirm
          key="pay"
          title="确认手动缴纳该设备租赁费？"
          description="确认后会直接从陪玩可用余额扣除，允许可用余额为负，但总资产不能小于 0。"
          onConfirm={async () => {
            try {
              await payEquipmentRentalBill({ billId: row.id });
              message.success('已手动缴费');
              billActionRef.current?.reload();
            } catch (e: any) {
              message.error(e?.data?.message || e?.message || '操作失败');
            }
          }}
        >
          <a>手动缴费</a>
        </Popconfirm>,
        <a
          key="externalPaid"
          onClick={() => {
            setExternalPaidBill(row);
            externalPaidForm.resetFields();
            externalPaidForm.setFieldsValue({
              amount: Number(row.remainingAmount || row.amount || 0),
              remark: '',
            });
            setExternalPaidOpen(true);
          }}
        >
          其他渠道已缴
        </a>,
        <Popconfirm
          key="waive"
          title="确认减免该设备租赁费？"
          onConfirm={async () => {
            try {
              await waiveEquipmentRentalBill({ billId: row.id });
              message.success('已减免');
              billActionRef.current?.reload();
            } catch (e: any) {
              message.error(e?.data?.message || e?.message || '操作失败');
            }
          }}
        >
          <a>减免</a>
        </Popconfirm>,
        ] : [];
        if (row.canRefund && Number(row.refundableAmount || 0) > 0) {
          actions.push(<a key="refund" onClick={() => openRefund(row)}>退费</a>);
        }
        if ((row.adjustmentLogs || []).length > 0) {
          actions.push(<a key="logs" onClick={() => setLogBill(row)}>操作记录</a>);
        }
        return actions;
      },
    },
  ], [staffLoading, staffOptions]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        message="设备租赁费需陪玩主动确认后扣款"
        description="系统每月自动生成账单；提前生成的未来账单不会影响提现，进入缴费日前 1 天后才会在提现时预留。扣费时允许可用余额变负，但扣费后可用余额 + 冻结余额的总资产不能小于 0。"
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={4}><Card size="small"><Statistic title="账单金额" value={billStats.billAmount} precision={2} prefix="¥" /></Card></Col>
        <Col xs={12} md={5}><Card size="small"><Statistic title="收费累计" value={billStats.chargedAmount} precision={2} prefix="¥" /></Card></Col>
        <Col xs={12} md={5}><Card size="small"><Statistic title="其他渠道收取" value={billStats.externalPaidAmount} precision={2} prefix="¥" /></Card></Col>
        <Col xs={12} md={5}><Card size="small"><Statistic title="减免" value={billStats.waivedAmount} precision={2} prefix="¥" /></Card></Col>
        <Col xs={12} md={5}><Card size="small"><Statistic title="未结清" value={billStats.remainingAmount} precision={2} prefix="¥" /></Card></Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'contracts',
            label: '租赁配置',
            children: (
              <ProTable<EquipmentRentalContract>
                rowKey="id"
                actionRef={contractActionRef}
                columns={contractColumns}
                search={false}
                pagination={{ pageSize: 10 }}
                toolBarRender={() => [
                  <Button key="create" type="primary" onClick={openCreateContract}>新增租赁配置</Button>,
                ]}
                request={async (params) => {
                  const res = await listEquipmentRentalContracts({ page: params.current, limit: params.pageSize });
                  return { data: res?.list || [], total: Number(res?.total || 0), success: true };
                }}
              />
            ),
          },
          {
            key: 'bills',
            label: '租赁账单',
            children: (
              <ProTable<EquipmentRentalBill>
                rowKey="id"
                actionRef={billActionRef}
                columns={billColumns}
                search={{ labelWidth: 86 }}
                pagination={{ pageSize: 20 }}
                toolBarRender={() => [
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
                request={async (params: any) => {
                  const res = await listEquipmentRentalBills({
                    page: params.current,
                    limit: params.pageSize,
                    billMonth: params.billMonth ? monthValue(params.billMonth) : undefined,
                    status: params.status,
                    userId: params.userId ? Number(params.userId) : undefined,
                    onlyRisk: params.onlyRisk === true || params.onlyRisk === 'true',
                  });
                  setBillStats({
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
        title="确认其他渠道已缴费"
        open={externalPaidOpen}
        confirmLoading={submitting}
        onCancel={() => {
          setExternalPaidOpen(false);
          setExternalPaidBill(null);
        }}
        onOk={async () => {
          try {
            const values = await externalPaidForm.validateFields();
            if (!externalPaidBill?.id) return;
            setSubmitting(true);
            await confirmEquipmentRentalBillPaidExternal({
              billId: externalPaidBill.id,
              amount: Number(values.amount),
              remark: String(values.remark || '').trim(),
            });
            message.success('已确认其他渠道缴费');
            setExternalPaidOpen(false);
            setExternalPaidBill(null);
            billActionRef.current?.reload();
          } catch (e: any) {
            if (!e?.errorFields) message.error(e?.data?.message || e?.message || '确认失败');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="该操作不会扣除员工钱包余额"
            description="可按实际情况修改本次确认金额；确认后账单金额同步为该金额。请填写真实收款渠道、凭证或调整原因。"
          />
          <Form form={externalPaidForm} layout="vertical">
            <Form.Item
              label="实际缴费金额"
              name="amount"
              rules={[{ required: true, message: '请输入实际缴费金额' }]}
            >
              <InputNumber min={0.01} precision={2} addonBefore="¥" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="调整原因 / 缴费说明"
              name="remark"
              rules={[{ required: true, message: '请填写其他渠道缴费说明' }]}
            >
              <Input.TextArea rows={3} placeholder="例如：微信收款码已收 / 现金已收 / 银行转账流水号..." />
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      <Modal
        title="确认设备费退费"
        open={refundOpen}
        confirmLoading={submitting}
        okText="确认退费"
        okButtonProps={{ danger: true }}
        onCancel={() => {
          setRefundOpen(false);
          setRefundBill(null);
        }}
        onOk={async () => {
          try {
            const values = await refundForm.validateFields();
            if (!refundBill?.id) return;
            setSubmitting(true);
            await refundEquipmentRentalBill({
              billId: refundBill.id,
              amount: Number(values.amount),
              remark: String(values.remark || '').trim(),
            });
            message.success('退费成功，款项已退回服务者可用余额');
            setRefundOpen(false);
            setRefundBill(null);
            billActionRef.current?.reload();
          } catch (e: any) {
            if (!e?.errorFields) message.error(e?.data?.message || e?.message || '退费失败');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Alert
          type="warning"
          showIcon
          message={`本单最多可退 ¥${money(refundBill?.refundableAmount || 0)}`}
          description="只有服务者自行确认扣缴且存在钱包流水的设备费才允许退费；支持部分退费，退款将原路回到服务者可用余额并生成关联流水。"
          style={{ marginBottom: 16 }}
        />
        <Form form={refundForm} layout="vertical">
          <Form.Item label="退费金额" name="amount" rules={[{ required: true, message: '请输入退费金额' }]}>
            <InputNumber min={0.01} max={Number(refundBill?.refundableAmount || 0)} precision={2} addonBefore="¥" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="退费原因" name="remark" rules={[{ required: true, whitespace: true, message: '退费原因必填' }]}>
            <Input.TextArea rows={3} placeholder="请填写重算差异、配置调整或其他退费原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重算结果"
        open={reconciliationOpen}
        footer={<Button type="primary" onClick={() => setReconciliationOpen(false)}>完成</Button>}
        onCancel={() => setReconciliationOpen(false)}
        width={760}
      >
        <List
          dataSource={reconciliations}
          locale={{ emptyText: '已缴费账单金额均正确，无需调整' }}
          renderItem={(item: any) => (
            <List.Item
              actions={item.canRefund ? [
                <Button
                  key="refund"
                  type="primary"
                  danger
                  size="small"
                  onClick={() => {
                    setReconciliationOpen(false);
                    openRefund({
                      id: item.billId,
                      userId: item.userId,
                      billMonth: item.billMonth,
                      refundableAmount: item.refundableAmount,
                      paidAmount: item.refundableAmount,
                    } as EquipmentRentalBill, Math.min(Number(item.difference), Number(item.refundableAmount)), `重算后正确金额为 ¥${money(item.correctAmount)}，退还多收差额`);
                  }}
                >
                  确认退差额 ¥{money(Math.min(Number(item.difference), Number(item.refundableAmount)))}
                </Button>,
              ] : undefined}
            >
              <List.Item.Meta
                title={`${item.user?.name || maskPhone(item.user?.phone) || `#${item.userId}`} · ${item.billMonth}`}
                description={`当前账单 ¥${money(item.currentAmount)}，重算正确金额 ¥${money(item.correctAmount)}。${item.reason}`}
              />
            </List.Item>
          )}
        />
      </Modal>

      <Modal title={`账单 #${logBill?.id || '-'} 操作记录`} open={Boolean(logBill)} footer={null} onCancel={() => setLogBill(null)} width={720}>
        <List
          dataSource={logBill?.adjustmentLogs || []}
          locale={{ emptyText: '暂无操作记录' }}
          renderItem={(item: any) => (
            <List.Item>
              <Descriptions size="small" column={1} style={{ width: '100%' }}>
                <Descriptions.Item label="操作">{item.action}</Descriptions.Item>
                <Descriptions.Item label="操作人">{item.user?.name || maskPhone(item.user?.phone) || `#${item.userId}`}</Descriptions.Item>
                <Descriptions.Item label="时间">{dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                <Descriptions.Item label="原因">{item.remark || '-'}</Descriptions.Item>
              </Descriptions>
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        title={editingContract ? '编辑租赁配置' : '新增租赁配置'}
        open={contractOpen}
        confirmLoading={submitting}
        onCancel={() => setContractOpen(false)}
        onOk={async () => {
          try {
            const values = await contractForm.validateFields();
            setSubmitting(true);
            const payload = {
              userId: Number(values.userId),
              monthlyAmount: Number(values.monthlyAmount || 0),
              startDate: dateValue(values.startDate),
              endDate: values.endDate ? dateValue(values.endDate) : undefined,
              status: values.status,
              remark: values.remark,
            };
            if (editingContract) {
              await updateEquipmentRentalContract({ id: editingContract.id, ...payload });
              message.success('配置已更新');
            } else {
              await createEquipmentRentalContract(payload);
              message.success('配置已创建');
            }
            setContractOpen(false);
            contractActionRef.current?.reload();
          } catch (e: any) {
            if (!e?.errorFields) message.error(e?.data?.message || e?.message || '保存失败');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form form={contractForm} layout="vertical">
          <Form.Item label="陪玩" name="userId" rules={[{ required: true, message: '请选择陪玩' }]}>
            <Select
              showSearch
              filterOption={false}
              loading={staffLoading}
              options={staffOptions}
              disabled={Boolean(editingContract)}
              onSearch={fetchStaffOptions}
              placeholder="搜索陪玩"
            />
          </Form.Item>
          <Form.Item label="月租金额" name="monthlyAmount" rules={[{ required: true, message: '请输入月租金额' }]}>
            <InputNumber min={0.01} precision={2} style={{ width: '100%' }} addonBefore="¥" />
          </Form.Item>
          <Form.Item label="起租日" name="startDate" rules={[{ required: true, message: '请选择起租日' }]}>
            <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="结束日" name="endDate">
            <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} allowClear />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={[{ label: '启用', value: 'ACTIVE' }, { label: '停用', value: 'INACTIVE' }]} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="生成设备租赁月账单"
        open={generateOpen}
        confirmLoading={submitting}
        onCancel={() => setGenerateOpen(false)}
        onOk={async () => {
          try {
            const values = await generateForm.validateFields();
            setSubmitting(true);
            const res = await generateEquipmentRentalBills({ month: monthValue(values.month) });
            const differences = Array.isArray(res?.reconciliations) ? res.reconciliations : [];
            setReconciliations(differences);
            setReconciliationOpen(true);
            message.success(`已生成/更新 ${res?.affected ?? 0} 条，${res?.correct ?? 0} 条已缴账单金额正确，${differences.length} 条存在差异`);
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
          <Form.Item label="账单月份" name="month" rules={[{ required: true, message: '请选择月份' }]}>
            <DatePicker picker="month" format="YYYY-MM" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default EquipmentRentalFeesPage;
