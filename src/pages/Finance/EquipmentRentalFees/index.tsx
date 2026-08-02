import React, { useMemo, useRef, useState } from 'react';
import { Alert, Button, DatePicker, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Tabs, Tag } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import {
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

const money = (v: any) => Number(v ?? 0).toFixed(2);
const monthValue = (value: any) => (dayjs.isDayjs(value) ? value.format('YYYY-MM') : String(value || ''));
const dateValue = (value: any) => (dayjs.isDayjs(value) ? value.format('YYYY-MM-DD') : String(value || ''));

const EquipmentRentalFeesPage: React.FC = () => {
  const contractActionRef = useRef<ActionType>();
  const billActionRef = useRef<ActionType>();
  const [contractOpen, setContractOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<EquipmentRentalContract | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffOptions, setStaffOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [contractForm] = Form.useForm();
  const [generateForm] = Form.useForm();

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
        label: `${item.name || item.realName || item.phone || `#${item.id}`} (${item.phone || '-'})`,
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
      render: (_, row) => row.user?.name || row.user?.phone || `#${row.userId}`,
    },
    { title: '手机号', dataIndex: ['user', 'phone'], width: 130, search: false },
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
      width: 120,
      render: (_, row) => [<a key="edit" onClick={() => openEditContract(row)}>编辑</a>],
    },
  ], []);

  const billColumns = useMemo<ProColumns<EquipmentRentalBill>[]>(() => [
    {
      title: '月份',
      dataIndex: 'billMonth',
      width: 120,
      valueType: 'dateMonth',
      transform: (value) => ({ billMonth: value ? monthValue(value) : undefined }),
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
      render: (_, row) => row.user?.name || row.user?.phone || `#${row.userId}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      valueType: 'select',
      valueEnum: { PENDING: { text: '待确认' }, PAID: { text: '已扣费' }, WAIVED: { text: '已减免' } },
      render: (_, row) => {
        const color = row.status === 'PAID' ? 'success' : row.status === 'WAIVED' ? 'default' : 'warning';
        return <Tag color={color}>{row.status}</Tag>;
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
        description="系统每月自动生成账单；扣费时允许可用余额变负，但扣费后可用余额 + 冻结余额的总资产不能小于 0。提现时会预留已出账和下月即将出账的设备租赁费。"
      />

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
                  return { data: res?.list || [], total: Number(res?.total || 0), success: true };
                }}
              />
            ),
          },
        ]}
      />

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
