import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { ModalForm, PageContainer, ProFormDigit, ProFormSelect, ProFormSwitch, ProFormText, ProFormTextArea, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Card, Collapse, Empty, Form, InputNumber, message, Popconfirm, Select, Space, Switch, Tabs, Tag, TreeSelect, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  createMemberBenefit,
  deleteMemberBenefit,
  getMemberBenefits,
  getMemberBenefitUsageRecords,
  getMemberLevelBenefitConfigs,
  getGoodsCategoryTree,
  replaceMemberLevelBenefits,
  updateMemberBenefit,
} from '@/services/api';
import { formatMemberBenefitQuantity } from '@/utils/memberBenefitUnit';

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
  const [categoryTree, setCategoryTree] = useState<any[]>([]);
  const watchedLevelBenefits = Form.useWatch('benefits', form) || [];

  const loadOptions = async () => {
    const [benefitRows, levelRows, categoryRows]: any[] = await Promise.all([
      getMemberBenefits(),
      getMemberLevelBenefitConfigs(),
      getGoodsCategoryTree(),
    ]);
    setBenefits(Array.isArray(benefitRows) ? benefitRows : []);
    const normalizedLevels = Array.isArray(levelRows) ? levelRows : [];
    setLevels(normalizedLevels);
    setCategoryTree(Array.isArray(categoryRows) ? categoryRows : []);
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
          <ProFormText name="unitName" label="单份规格 / 计量单位" rules={[{ required: true }]} extra="普通权益填“次、条、人”；组合规格可填“1000W”，系统展示时会按发放数量相乘。" />
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

  const saveLevelBenefits = async () => {
        if (!selectedLevelId) return;
        try {
          setSavingLevel(true);
          const values = await form.validateFields();
          const selectedIds = (values?.benefits || []).map((item: any) => Number(item.benefitId)).filter(Boolean);
          if (new Set(selectedIds).size !== selectedIds.length) {
            message.error('同一等级不能重复关联相同权益');
            return;
          }
          const rows = (values?.benefits || []).map((item: any, index: number) => ({
            ...item,
            sortOrder: (index + 1) * 10,
            config: item.grantMode === 'AUTOMATIC_DISCOUNT' ? {
              rate: Number(item.discountRate || 100) / 100,
              excludedCategoryIds: item.excludedCategoryIds || [],
            } : undefined,
          }));
          await replaceMemberLevelBenefits(selectedLevelId, rows);
          message.success('等级权益配置已保存');
          await loadOptions();
        } catch (e: any) { if (!e?.errorFields) message.error(e?.response?.data?.message || e?.message || '保存失败'); }
        finally { setSavingLevel(false); }
  };

  const levelTab = <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <Card size="small" style={{ borderRadius: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>选择要维护的会员等级</Typography.Title>
          <Typography.Text type="secondary">各等级独立保存，切换等级不会影响其他等级配置。</Typography.Text>
        </div>
        <Select
          style={{ width: 'min(100%, 360px)' }}
          size="large"
          value={selectedLevelId}
          onChange={setSelectedLevelId}
          options={levels.map((item) => ({ label: `${item.code} · ${item.name}`, value: item.id }))}
        />
      </div>
      {selectedLevel ? <Space wrap style={{ marginTop: 14 }}>
        <Tag color="blue">{selectedLevel.code}</Tag>
        <Tag>{selectedLevel.name}</Tag>
        <Tag color="geekblue">已关联 {watchedLevelBenefits.length} 项权益</Tag>
      </Space> : null}
    </Card>

    <Alert
      type="info"
      showIcon
      message="权益按项目折叠展示"
      description="点击权益标题展开维护发放方式、数量和有效期；自动折扣的排除规则仅在对应权益中显示。"
    />

    <Form form={form} layout="vertical">
      <Form.List name="benefits">
        {(fields, { add, remove }) => <Space direction="vertical" style={{ width: '100%' }} size={10}>
          {fields.length === 0 ? <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前等级暂未关联权益" /></Card> : null}
          {fields.map((field, index) => {
            const row = watchedLevelBenefits?.[field.name] || {};
            const benefit = benefits.find((item) => Number(item.id) === Number(row.benefitId));
            const grantMode = grantModeOptions.find((item) => item.value === row.grantMode)?.label || '未设置发放方式';
            const selectedIds = watchedLevelBenefits.map((item: any) => Number(item?.benefitId)).filter(Boolean);
            return <Collapse
              key={field.key}
              defaultActiveKey={fields.length <= 2 ? ['editor'] : []}
              style={{ background: '#fff', borderRadius: 12 }}
              items={[{
                key: 'editor',
                label: <Space wrap>
                  <Typography.Text strong>{index + 1}. {benefit?.name || '请选择权益项目'}</Typography.Text>
                  {benefit?.code ? <Tag>{benefit.code}</Tag> : null}
                  <Tag color="blue">{grantMode}</Tag>
                  {row.unlimited ? <Tag color="purple">不限量</Tag> : row.quantity ? <Tag>{formatMemberBenefitQuantity(row.quantity, benefit?.unitName)}</Tag> : null}
                  {benefit?.reviewRestricted ? <Tag color="red">审核时隐藏</Tag> : null}
                </Space>,
                extra: <Popconfirm title="确定解除该等级与此权益的关联？" onConfirm={() => remove(field.name)}>
                  <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={(event) => event.stopPropagation()}>移除</Button>
                </Popconfirm>,
                children: <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 16px', alignItems: 'start' }}>
                    <Form.Item {...field} name={[field.name, 'benefitId']} label="权益项目" rules={[{ required: true, message: '请选择权益项目' }]}>
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder="搜索权益名称或编码"
                        options={benefits.filter((item) => item.enabled !== false).map((item) => ({
                          label: `${item.name}（${item.code}）`,
                          value: item.id,
                          disabled: selectedIds.includes(Number(item.id)) && Number(item.id) !== Number(row.benefitId),
                        }))}
                      />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'grantMode']} label="发放方式" rules={[{ required: true, message: '请选择发放方式' }]}><Select options={grantModeOptions} /></Form.Item>
                    <Form.Item {...field} name={[field.name, 'quantity']} label="发放数量"><InputNumber min={0.01} precision={2} disabled={Boolean(row.unlimited)} style={{ width: '100%' }} /></Form.Item>
                    <Form.Item {...field} name={[field.name, 'validityDays']} label="有效天数" extra="不填表示长期有效"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item>
                    <Form.Item {...field} name={[field.name, 'unlimited']} label="数量限制" valuePropName="checked"><Switch checkedChildren="不限量" unCheckedChildren="按数量" /></Form.Item>
                  </div>
                  <Form.Item noStyle shouldUpdate={(prev, next) => prev?.benefits?.[field.name]?.grantMode !== next?.benefits?.[field.name]?.grantMode}>
                    {({ getFieldValue }) => getFieldValue(['benefits', field.name, 'grantMode']) === 'AUTOMATIC_DISCOUNT' ? (
                      <Card size="small" title="自动折扣规则" style={{ background: '#fafafa', borderRadius: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 16px' }}>
                          <Form.Item {...field} name={[field.name, 'discountRate']} label="折后比例（%）" rules={[{ required: true, message: '请输入折后比例' }]}><InputNumber min={1} max={100} precision={2} style={{ width: '100%' }} placeholder="如 98 表示九八折" /></Form.Item>
                          <Form.Item {...field} name={[field.name, 'excludedCategoryIds']} label="不参与折扣的游戏分类" extra="选择后，该分类下商品不享受本等级折扣">
                            <TreeSelect
                              treeData={categoryTree.map(function mapCategory(node: any): any {
                                const level = Number(node?.level || 0);
                                return {
                                  title: String(node?.name || node?.id || ''),
                                  value: String(node?.id || ''),
                                  key: String(node?.id || ''),
                                  selectable: level >= 2,
                                  disabled: node?.enabled === false,
                                  children: Array.isArray(node?.children) ? node.children.map(mapCategory) : undefined,
                                };
                              })}
                              treeCheckable
                              showCheckedStrategy={TreeSelect.SHOW_ALL}
                              treeDefaultExpandAll
                              allowClear
                              showSearch
                              treeNodeFilterProp="title"
                              placeholder="请选择不参与会员折扣的游戏分类"
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        </div>
                      </Card>
                    ) : null}
                  </Form.Item>
                </>,
              }]}
            />;
          })}
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ grantMode: 'IDENTITY', quantity: 1, unlimited: false })} block style={{ height: 44 }}>关联新权益</Button>
        </Space>}
      </Form.List>
    </Form>

    <Card size="small" style={{ position: 'sticky', bottom: 12, zIndex: 10, borderRadius: 12, boxShadow: '0 6px 24px rgba(15, 23, 42, 0.12)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Typography.Text type="secondary">当前等级共 {watchedLevelBenefits.length} 项权益，保存后立即按新配置生效。</Typography.Text>
        <Button type="primary" size="large" loading={savingLevel} disabled={!selectedLevelId} onClick={saveLevelBenefits}>保存当前等级权益</Button>
      </div>
    </Card>
  </Space>;

  const usageTab = <ProTable
    rowKey="id"
    columns={[
      { title: '会员/权益/备注', dataIndex: 'keyword', hideInTable: true },
      { title: '核销时间', dataIndex: 'usedAt', valueType: 'dateTime', width: 170, search: false, render: (_: any, row: any) => row.usedAt ? dayjs(row.usedAt).format('YYYY-MM-DD HH:mm:ss') : '-' },
      { title: '会员', dataIndex: ['user', 'name'], width: 150, search: false, render: (_: any, row: any) => row?.user?.realName || row?.user?.name || `#${row?.userId}` },
      { title: '会员编号', dataIndex: ['user', 'memberProfile', 'memberCode'], width: 130, search: false, render: (_: any, row: any) => row?.user?.memberProfile?.memberCode || '-' },
      { title: '权益', dataIndex: ['grant', 'benefitNameSnapshot'], width: 180, search: false, render: (_: any, row: any) => row?.grant?.benefitNameSnapshot || '-' },
      { title: '核销数量', dataIndex: 'quantity', width: 110, search: false, render: (_: any, row: any) => formatMemberBenefitQuantity(row.quantity, row?.grant?.unitNameSnapshot) },
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
