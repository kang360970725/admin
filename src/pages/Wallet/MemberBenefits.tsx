import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { ModalForm, PageContainer, ProFormDigit, ProFormSelect, ProFormSwitch, ProFormText, ProFormTextArea, ProTable } from '@ant-design/pro-components';
import { Button, Card, Form, InputNumber, message, Popconfirm, Select, Space, Switch, Tabs, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  createMemberBenefit,
  deleteMemberBenefit,
  getMemberBenefits,
  getMemberBenefitUsageRecords,
  getMemberLevelBenefitConfigs,
  replaceMemberLevelBenefits,
  updateMemberBenefit,
} from '@/services/api';

const categoryOptions = [
  { label: '服务权益', value: 'SERVICE' },
  { label: '订单折扣', value: 'ORDER_DISCOUNT' },
  { label: '租号手续费折扣', value: 'RENTAL_FEE_DISCOUNT' },
  { label: '体验资格', value: 'EXPERIENCE' },
  { label: '实物/虚拟物品', value: 'ITEM' },
];

const grantModeOptions = [
  { label: '身份权益', value: 'IDENTITY' },
  { label: '每月发放', value: 'MONTHLY' },
  { label: '升级即得', value: 'UPGRADE_ONCE' },
  { label: '自动折扣', value: 'AUTOMATIC_DISCOUNT' },
];

export default function MemberBenefitsPage() {
  const actionRef = useRef<any>();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [benefits, setBenefits] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<number>();
  const [savingLevel, setSavingLevel] = useState(false);

  const loadOptions = async () => {
    const [benefitRows, levelRows]: any[] = await Promise.all([getMemberBenefits(), getMemberLevelBenefitConfigs()]);
    setBenefits(Array.isArray(benefitRows) ? benefitRows : []);
    const normalizedLevels = Array.isArray(levelRows) ? levelRows : [];
    setLevels(normalizedLevels);
    setSelectedLevelId((current) => current || normalizedLevels?.[0]?.id);
  };

  useEffect(() => { loadOptions().catch((e: any) => message.error(e?.message || '会员权益配置加载失败')); }, []);

  const selectedLevel = useMemo(() => levels.find((item) => Number(item.id) === Number(selectedLevelId)), [levels, selectedLevelId]);

  useEffect(() => {
    form.setFieldsValue({
      benefits: (selectedLevel?.benefits || []).map((item: any) => ({
        benefitId: item.id,
        grantMode: item.grantMode,
        quantity: item.quantity,
        unlimited: item.unlimited,
        validityDays: item.validityDays,
        sortOrder: item.sortOrder,
        discountRate: item?.config?.rate ? Number(item.config.rate) * 100 : undefined,
        excludedProjectTypes: item?.config?.excludedProjectTypes || [],
        excludedCategoryIds: item?.config?.excludedCategoryIds || [],
      })),
    });
  }, [selectedLevel, form]);

  const columns: any[] = [
    { title: '排序', dataIndex: 'sortOrder', width: 70, search: false },
    { title: '编码', dataIndex: 'code', width: 180, search: false },
    { title: '权益名称', dataIndex: 'name', width: 180, search: false },
    { title: '类型', dataIndex: 'category', width: 150, search: false, render: (value: string) => categoryOptions.find((item) => item.value === value)?.label || value },
    { title: '单位价值', dataIndex: 'unitValue', width: 110, search: false, render: (value: any) => `¥${Number(value || 0).toFixed(2)}` },
    { title: '退款扣减', dataIndex: 'refundableDeduction', width: 100, search: false, render: (value: boolean) => value ? <Tag color="orange">参与</Tag> : <Tag>不参与</Tag> },
    { title: '审核展示', dataIndex: 'reviewRestricted', width: 110, search: false, render: (value: boolean) => value ? <Tag color="red">审核时隐藏</Tag> : <Tag color="green">正常展示</Tag> },
    { title: '状态', dataIndex: 'enabled', width: 80, search: false, render: (value: boolean) => value ? <Tag color="green">启用</Tag> : <Tag>停用</Tag> },
    {
      title: '操作', valueType: 'option', width: 140, render: (_: any, record: any) => [
        <Button key="edit" type="link" onClick={() => { setEditing(record); setOpen(true); }}>编辑</Button>,
        <Popconfirm key="delete" title="确认删除该权益？" description="有关联等级或发放记录时不能删除，可改为停用。" onConfirm={async () => {
          try { await deleteMemberBenefit(record.id); message.success('已删除'); actionRef.current?.reload(); await loadOptions(); }
          catch (e: any) { message.error(e?.response?.data?.message || e?.message || '删除失败'); }
        }}><Button type="link" danger>删除</Button></Popconfirm>,
      ],
    },
  ];

  const benefitTab = <>
    <ProTable
      rowKey="id"
      actionRef={actionRef}
      search={false}
      columns={columns}
      request={async () => {
        const rows: any = await getMemberBenefits();
        setBenefits(Array.isArray(rows) ? rows : []);
        return { data: Array.isArray(rows) ? rows : [], success: true };
      }}
      toolBarRender={() => [<Button key="create" type="primary" onClick={() => { setEditing(null); setOpen(true); }}>新增权益</Button>]}
    />
    <ModalForm
      title={editing ? '编辑会员权益' : '新增会员权益'}
      open={open}
      width={760}
      layout="vertical"
      modalProps={{ destroyOnClose: true, onCancel: () => setOpen(false), className: 'bc-admin-form-modal' }}
      initialValues={editing || { category: 'SERVICE', unitName: '次', unitValue: 0, refundableDeduction: false, reviewRestricted: false, requiresVerification: true, enabled: true, sortOrder: 100 }}
      onFinish={async (values) => {
        try {
          if (editing?.id) await updateMemberBenefit(editing.id, values); else await createMemberBenefit(values);
          message.success('保存成功'); setOpen(false); actionRef.current?.reload(); await loadOptions(); return true;
        } catch (e: any) { message.error(e?.response?.data?.message || e?.message || '保存失败'); return false; }
      }}
    >
      <div className="bc-admin-form">
        <div className="bc-admin-form-grid">
          <ProFormText name="code" label="权益编码" disabled={!!editing?.id} rules={[{ required: true }]} fieldProps={{ placeholder: '如 ORDER_DISCOUNT' }} />
          <ProFormText name="name" label="权益名称" rules={[{ required: true }]} />
          <ProFormSelect name="category" label="权益类型" options={categoryOptions} rules={[{ required: true }]} />
          <ProFormText name="unitName" label="计量单位" rules={[{ required: true }]} />
          <ProFormDigit name="unitValue" label="单份权益价值" min={0} fieldProps={{ precision: 2 }} extra="发放时保存价值快照，用于退款试算" />
          <ProFormDigit name="sortOrder" label="排序" min={0} fieldProps={{ precision: 0 }} />
          <div className="bc-admin-form-grid-full"><ProFormTextArea name="description" label="权益说明" fieldProps={{ autoSize: { minRows: 3, maxRows: 6 } }} /></div>
          <ProFormSwitch name="refundableDeduction" label="使用后参与退款扣减" />
          <ProFormSwitch name="reviewRestricted" label="小程序审核时隐藏" />
          <ProFormSwitch name="requiresVerification" label="需要人工核销" />
          <ProFormSwitch name="enabled" label="启用" />
        </div>
      </div>
    </ModalForm>
  </>;

  const levelTab = <Card>
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Select style={{ width: 320 }} value={selectedLevelId} onChange={setSelectedLevelId} options={levels.map((item) => ({ label: `${item.code} · ${item.name}`, value: item.id }))} />
      <Form form={form} layout="vertical">
        <Form.List name="benefits">
          {(fields, { add, remove }) => <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {fields.map((field) => <Card key={field.key} size="small">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,2fr) minmax(150px,1fr) 120px 90px 120px 32px', gap: 12, alignItems: 'start' }}>
                <Form.Item {...field} name={[field.name, 'benefitId']} label="权益" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={benefits.filter((item) => item.enabled !== false).map((item) => ({ label: `${item.name}（${item.code}）`, value: item.id }))} /></Form.Item>
                <Form.Item {...field} name={[field.name, 'grantMode']} label="发放方式" rules={[{ required: true }]}><Select options={grantModeOptions} /></Form.Item>
                <Form.Item {...field} name={[field.name, 'quantity']} label="数量"><InputNumber min={0.01} precision={2} style={{ width: '100%' }} /></Form.Item>
                <Form.Item {...field} name={[field.name, 'unlimited']} label="不限量" valuePropName="checked"><Switch /></Form.Item>
                <Form.Item {...field} name={[field.name, 'validityDays']} label="有效天数"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item>
                <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} style={{ marginTop: 30 }} />
              </div>
              <Form.Item noStyle shouldUpdate={(prev, next) => prev?.benefits?.[field.name]?.grantMode !== next?.benefits?.[field.name]?.grantMode}>
                {({ getFieldValue }) => getFieldValue(['benefits', field.name, 'grantMode']) === 'AUTOMATIC_DISCOUNT' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(220px,1fr) minmax(220px,1fr)', gap: 12 }}>
                    <Form.Item {...field} name={[field.name, 'discountRate']} label="折后比例（%）" rules={[{ required: true }]}><InputNumber min={1} max={100} precision={2} style={{ width: '100%' }} placeholder="如98" /></Form.Item>
                    <Form.Item {...field} name={[field.name, 'excludedProjectTypes']} label="不参与折扣的订单类型"><Select mode="tags" tokenSeparators={[',']} placeholder="如 EXPERIENCE、EUROPE_AMERICA" /></Form.Item>
                    <Form.Item {...field} name={[field.name, 'excludedCategoryIds']} label="不参与折扣的商品分类ID"><Select mode="tags" tokenSeparators={[',']} placeholder="填写分类ID，避免按名称判断" /></Form.Item>
                  </div>
                ) : null}
              </Form.Item>
            </Card>)}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ grantMode: 'IDENTITY', quantity: 1, unlimited: false })} block>关联权益</Button>
          </Space>}
        </Form.List>
      </Form>
      <Button type="primary" loading={savingLevel} onClick={async () => {
        if (!selectedLevelId) return;
        try {
          setSavingLevel(true);
          const values = await form.validateFields();
          const rows = (values?.benefits || []).map((item: any, index: number) => ({
            ...item,
            sortOrder: (index + 1) * 10,
            config: item.grantMode === 'AUTOMATIC_DISCOUNT' ? {
              rate: Number(item.discountRate || 100) / 100,
              excludedProjectTypes: item.excludedProjectTypes || [],
              excludedCategoryIds: item.excludedCategoryIds || [],
            } : undefined,
          }));
          await replaceMemberLevelBenefits(selectedLevelId, rows);
          message.success('等级权益配置已保存');
          await loadOptions();
        } catch (e: any) { if (!e?.errorFields) message.error(e?.response?.data?.message || e?.message || '保存失败'); }
        finally { setSavingLevel(false); }
      }}>保存等级权益</Button>
    </Space>
  </Card>;

  const usageTab = <ProTable
    rowKey="id"
    columns={[
      { title: '会员/权益/备注', dataIndex: 'keyword', hideInTable: true },
      { title: '核销时间', dataIndex: 'usedAt', valueType: 'dateTime', width: 170, search: false, render: (_: any, row: any) => row.usedAt ? dayjs(row.usedAt).format('YYYY-MM-DD HH:mm:ss') : '-' },
      { title: '会员', dataIndex: ['user', 'name'], width: 150, search: false, render: (_: any, row: any) => row?.user?.realName || row?.user?.name || `#${row?.userId}` },
      { title: '会员编号', dataIndex: ['user', 'memberProfile', 'memberCode'], width: 130, search: false, render: (_: any, row: any) => row?.user?.memberProfile?.memberCode || '-' },
      { title: '权益', dataIndex: ['grant', 'benefitNameSnapshot'], width: 180, search: false, render: (_: any, row: any) => row?.grant?.benefitNameSnapshot || '-' },
      { title: '核销数量', dataIndex: 'quantity', width: 110, search: false, render: (_: any, row: any) => `${Number(row.quantity || 0)}${row?.grant?.unitNameSnapshot || ''}` },
      { title: '抵扣价值', dataIndex: 'deductedValue', width: 110, search: false, render: (value: any) => `¥${Number(value || 0).toFixed(2)}` },
      { title: '关联业务', dataIndex: 'sourceType', width: 150, search: false, render: (_: any, row: any) => row.sourceType ? `${row.sourceType}${row.sourceId ? ` #${row.sourceId}` : ''}` : '-' },
      { title: '操作人', dataIndex: 'operatorName', width: 130, search: false },
      { title: '核销说明', dataIndex: 'remark', ellipsis: true, search: false, render: (value: any) => value || '-' },
      { title: '状态', dataIndex: 'status', width: 100, valueType: 'select', valueEnum: { CONFIRMED: { text: '已核销', status: 'Success' }, REVERSED: { text: '已冲销', status: 'Default' } } },
    ]}
    request={async (params: any) => {
      const result: any = await getMemberBenefitUsageRecords({
        page: params.current,
        limit: params.pageSize,
        keyword: params.keyword,
        status: params.status,
      });
      return { data: Array.isArray(result?.data) ? result.data : [], total: Number(result?.total || 0), success: true };
    }}
    search={{ labelWidth: 'auto' }}
    pagination={{ defaultPageSize: 20, showSizeChanger: true }}
    scroll={{ x: 1250 }}
  />;

  return <PageContainer><Tabs items={[{ key: 'benefits', label: '权益项目库', children: benefitTab }, { key: 'levels', label: '等级权益关联', children: levelTab }, { key: 'usages', label: '权益核销记录', children: usageTab }]} /></PageContainer>;
}
