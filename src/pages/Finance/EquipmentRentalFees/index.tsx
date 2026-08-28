import React, { useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, DatePicker, Form, Input, InputNumber, message, Modal, Popconfirm, Row, Select, Space, Statistic, Tabs, Tag } from 'antd';
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
    { title: '金额', dataIndex: 'amount', width: 100, search: false, render: (_, row) => `¥${money(row.amount)}` },
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
      width: 120,
      render: (_, row) => row.status === 'PENDING' ? [
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
      ] : [],
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
            description={`账单将标记为已缴费，已缴金额 ¥${money(externalPaidBill?.remainingAmount || externalPaidBill?.amount || 0)}。请填写实际收款渠道或凭证说明。`}
          />
          <Form form={externalPaidForm} layout="vertical">
            <Form.Item
              label="缴费说明"
              name="remark"
              rules={[{ required: true, message: '请填写其他渠道缴费说明' }]}
            >
              <Input.TextArea rows={3} placeholder="例如：微信收款码已收 / 现金已收 / 银行转账流水号..." />
            </Form.Item>
          </Form>
        </Space>
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
          <Form.Item label="账单月份" name="month" rules={[{ required: true, message: '请选择月份' }]}>
            <DatePicker picker="month" format="YYYY-MM" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default EquipmentRentalFeesPage;
