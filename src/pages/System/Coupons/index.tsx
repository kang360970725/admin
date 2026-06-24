import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Transfer,
  Tree,
} from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import {
  createCouponTemplate,
  getCouponTemplates,
  getGameProjectOptions,
  getGoodsCategoryTree,
  getUsers,
  getUserCoupons,
  grantUserCoupon,
  updateCouponTemplateStatus,
} from '@/services/api';

const templateStatusDict: Record<string, string> = {
  DRAFT: '草稿',
  ACTIVE: '生效',
  DISABLED: '停用',
  EXPIRED: '已过期',
};
const templateTypeDict: Record<string, string> = {
  CASH: '现金券',
  DISCOUNT: '折扣券',
  FULL_REDUCTION: '满减券',
  FREE: '免单券',
};
const scopeDict: Record<string, string> = {
  ALL: '全部项目',
  PROJECT: '指定商品',
  CATEGORY: '商品类别',
  USER_LEVEL: '指定等级',
};
const userCouponStatusDict: Record<string, string> = {
  UNUSED: '未使用',
  USED: '已使用',
  EXPIRED: '已过期',
  LOCKED: '已锁定',
};

const templateStatusOptions = Object.keys(templateStatusDict).map((value) => ({
  value,
  label: templateStatusDict[value],
}));
const templateTypeOptions = Object.keys(templateTypeDict).map((value) => ({
  value,
  label: templateTypeDict[value],
}));
const scopeOptions = Object.keys(scopeDict).map((value) => ({
  value,
  label: scopeDict[value],
  disabled: value === 'USER_LEVEL',
}));
const userCouponStatusOptions = Object.keys(userCouponStatusDict).map((value) => ({
  value,
  label: userCouponStatusDict[value],
}));

const formatTime = (v?: string | null) => {
  if (!v) return '-';
  const d = dayjs(v);
  if (!d.isValid()) return '-';
  return d.format('YYYY-MM-DD HH:mm:ss');
};

const CouponsPage: React.FC = () => {
  const [tab, setTab] = useState<'templates' | 'user-coupons'>('templates');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [templateFilter, setTemplateFilter] = useState<any>({});
  const [couponFilter, setCouponFilter] = useState<any>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formCreate] = Form.useForm();
  const [formGrant] = Form.useForm();
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectOptions, setProjectOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [grantTemplateLoading, setGrantTemplateLoading] = useState(false);
  const [grantTemplateOptions, setGrantTemplateOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [grantUserLoading, setGrantUserLoading] = useState(false);
  const [grantUserOptions, setGrantUserOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [categoryTreeOptions, setCategoryTreeOptions] = useState<Array<{ title: string; value: string; key: string; children?: any[] }>>([]);
  const [projectTargetKeys, setProjectTargetKeys] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Record<string, { label: string; value: number }>>({});
  const [checkedCategoryKeys, setCheckedCategoryKeys] = useState<React.Key[]>([]);
  const createScope = Form.useWatch('applicableScope', formCreate);
  const createType = Form.useWatch('type', formCreate);

  const loadProjects = async (keyword?: string) => {
    setProjectLoading(true);
    try {
      const kw = String(keyword || '').trim();
      const res: any = await getGameProjectOptions({ keyword: kw || undefined });
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setProjectOptions(
        list.map((item: any) => ({
          value: Number(item.id),
          label: item?.price != null ? `${item.name}（¥${item.price}）` : `${item.name}`,
        })),
      );
    } catch (e) {
      console.error(e);
      setProjectOptions([]);
    } finally {
      setProjectLoading(false);
    }
  };

  const loadLevel2Categories = async () => {
    try {
      const tree: any[] = await getGoodsCategoryTree();
      const mapNode = (n: any): any => {
        const lv = Number(n?.level || 0);
        if (lv > 2) return null;
        const children = Array.isArray(n?.children)
          ? n.children.map(mapNode).filter((x: any) => !!x)
          : undefined;
        return {
          title: String(n?.name || n?.id || ''),
          value: String(n?.id || ''),
          key: String(n?.id || ''),
          children,
        };
      };
      const nodes = (Array.isArray(tree) ? tree : [])
        .map(mapNode)
        .filter((x: any) => !!x.value);
      setCategoryTreeOptions(nodes);
    } catch (e) {
      console.error(e);
      setCategoryTreeOptions([]);
    }
  };

  const loadGrantTemplates = async () => {
    setGrantTemplateLoading(true);
    try {
      const res: any = await getCouponTemplates({ page: 1, limit: 200, status: 'ACTIVE' });
      const list = Array.isArray(res?.data) ? res.data : [];
      setGrantTemplateOptions(
        list.map((item: any) => ({
          value: Number(item.id),
          label: `${item?.name || '未命名模板'} #${item?.id} · ${templateTypeDict[String(item?.type || '')] || item?.type || '-'}`,
        })),
      );
    } catch (e) {
      console.error(e);
      setGrantTemplateOptions([]);
    } finally {
      setGrantTemplateLoading(false);
    }
  };

  const loadGrantUsers = async (keyword?: string) => {
    setGrantUserLoading(true);
    try {
      const kw = String(keyword || '').trim();
      const res: any = await getUsers({ page: 1, limit: 50, keyword: kw || undefined });
      const list = Array.isArray(res?.data) ? res.data : [];
      setGrantUserOptions(
        list.map((item: any) => ({
          value: Number(item.id),
          label: `${item?.name || item?.realName || '未命名'}（${item?.phone || '-'}） #${item?.id}`,
        })),
      );
    } catch (e) {
      console.error(e);
      setGrantUserOptions([]);
    } finally {
      setGrantUserLoading(false);
    }
  };

  useEffect(() => {
    if (!createOpen) return;
    formCreate.setFieldValue('applicableTargetIds', []);
    setProjectTargetKeys([]);
    setCheckedCategoryKeys([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createScope]);

  const loadData = async (nextPage = page, nextLimit = limit) => {
    setLoading(true);
    try {
      if (tab === 'templates') {
        const res: any = await getCouponTemplates({
          page: nextPage,
          limit: nextLimit,
          ...templateFilter,
        });
        setRows(Array.isArray(res?.data) ? res.data : []);
        setTotal(Number(res?.total || 0));
      } else {
        const res: any = await getUserCoupons({
          page: nextPage,
          limit: nextLimit,
          ...couponFilter,
        });
        setRows(Array.isArray(res?.data) ? res.data : []);
        setTotal(Number(res?.total || 0));
      }
      setPage(nextPage);
      setLimit(nextLimit);
    } catch (e: any) {
      console.error(e);
      message.error(e?.data?.message || e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (!grantOpen) return;
    void loadGrantTemplates();
    void loadGrantUsers();
  }, [grantOpen]);

  const templateColumns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 80 },
      { title: '名称', dataIndex: 'name' },
      { title: '类型', dataIndex: 'type', width: 140, render: (v: string) => templateTypeDict[v] || '-' },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        render: (v: string) => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{templateStatusDict[v] || '-'}</Tag>,
      },
      { title: '优惠值', dataIndex: 'discountValue', width: 120 },
      { title: '门槛', dataIndex: 'thresholdAmount', width: 120 },
      { title: '作用域', dataIndex: 'applicableScope', width: 120, render: (v: string) => scopeDict[v] || '-' },
      { title: '发放/已用', width: 140, render: (_: any, r: any) => `${r?.issuedCount || 0}/${r?.usedCount || 0}` },
      {
        title: '操作',
        width: 220,
        render: (_: any, r: any) => (
          <Space>
            {templateStatusOptions.map((item) => (
              <Button
                key={item.value}
                size="small"
                type={r?.status === item.value ? 'primary' : 'default'}
                onClick={async () => {
                  try {
                    await updateCouponTemplateStatus({ id: Number(r.id), status: item.value });
                    message.success('状态已更新');
                    await loadData(page, limit);
                  } catch (e: any) {
                    message.error(e?.data?.message || e?.message || '更新失败');
                  }
                }}
              >
                {item.label}
              </Button>
            ))}
          </Space>
        ),
      },
    ],
    [page, limit],
  );

  const userCouponColumns = useMemo(
    () => [
      { title: '券ID', dataIndex: 'id', width: 90 },
      { title: '用户', width: 180, render: (_: any, r: any) => `${r?.user?.name || '-'}(${r?.user?.id || '-'})` },
      { title: '模板', width: 220, render: (_: any, r: any) => `${r?.template?.name || '-'}(#${r?.templateId || '-'})` },
      { title: '状态', dataIndex: 'status', width: 120, render: (v: string) => userCouponStatusDict[v] || '-' },
      { title: '订单ID', dataIndex: 'orderId', width: 100 },
      { title: '领取时间', dataIndex: 'receivedAt', width: 180, render: (v: string) => formatTime(v) },
      { title: '过期时间', dataIndex: 'expiresAt', width: 180, render: (v: string) => formatTime(v) },
      { title: '使用时间', dataIndex: 'usedAt', width: 180, render: (v: string) => formatTime(v) },
    ],
    [],
  );

  return (
    <PageContainer title="优惠券管理" subTitle="模板、发券与用户券核销追踪">
      <Card>
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as any)}
          items={[
            { key: 'templates', label: '券模板' },
            { key: 'user-coupons', label: '用户券' },
          ]}
        />

        {tab === 'templates' ? (
          <Space wrap style={{ marginBottom: 12 }}>
            <Input
              placeholder="名称关键字"
              allowClear
              style={{ width: 220 }}
              onChange={(e) => setTemplateFilter((s: any) => ({ ...s, keyword: e.target.value || undefined }))}
            />
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 160 }}
              options={templateStatusOptions}
              onChange={(v) => setTemplateFilter((s: any) => ({ ...s, status: v || undefined }))}
            />
            <Select
              allowClear
              placeholder="类型"
              style={{ width: 170 }}
              options={templateTypeOptions}
              onChange={(v) => setTemplateFilter((s: any) => ({ ...s, type: v || undefined }))}
            />
            <Button type="primary" onClick={() => loadData(1, limit)}>查询</Button>
            <Button onClick={() => setCreateOpen(true)}>新建模板</Button>
            <Button onClick={() => setGrantOpen(true)}>手动发券</Button>
          </Space>
        ) : (
          <Space wrap style={{ marginBottom: 12 }}>
            <Input
              placeholder="用户姓名/手机号"
              allowClear
              style={{ width: 220 }}
              onChange={(e) => setCouponFilter((s: any) => ({ ...s, keyword: e.target.value || undefined }))}
            />
            <InputNumber
              placeholder="用户ID"
              style={{ width: 160 }}
              onChange={(v) => setCouponFilter((s: any) => ({ ...s, userId: v || undefined }))}
            />
            <InputNumber
              placeholder="模板ID"
              style={{ width: 160 }}
              onChange={(v) => setCouponFilter((s: any) => ({ ...s, templateId: v || undefined }))}
            />
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 160 }}
              options={userCouponStatusOptions}
              onChange={(v) => setCouponFilter((s: any) => ({ ...s, status: v || undefined }))}
            />
            <Button type="primary" onClick={() => loadData(1, limit)}>查询</Button>
          </Space>
        )}

        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={tab === 'templates' ? (templateColumns as any) : (userCouponColumns as any)}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            onChange: (p, s) => loadData(p, s),
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title="新建券模板"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          try {
            const v = await formCreate.validateFields();
            setSubmitting(true);
            await createCouponTemplate({
              ...v,
              startAt: v.startAt ? dayjs(v.startAt).toISOString() : undefined,
              endAt: v.endAt ? dayjs(v.endAt).toISOString() : undefined,
              applicableProjectIds:
                createScope === 'CATEGORY'
                  ? (Array.isArray(v.applicableTargetIds)
                    ? v.applicableTargetIds.map((x: any) => String(x)).filter((x: string) => !!x)
                    : [])
                  : (Array.isArray(v.applicableTargetIds)
                    ? v.applicableTargetIds.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x) && x > 0)
                    : []),
            });
            message.success('创建成功');
            setCreateOpen(false);
            formCreate.resetFields();
            await loadData(1, limit);
          } catch (e: any) {
            if (!e?.errorFields) message.error(e?.data?.message || e?.message || '创建失败');
          } finally {
            setSubmitting(false);
          }
        }}
        confirmLoading={submitting}
        width={720}
        afterOpenChange={(open) => {
          if (open) {
            void loadLevel2Categories();
            void loadProjects();
          }
        }}
      >
        <Form form={formCreate} layout="vertical" initialValues={{ status: 'DRAFT', applicableScope: 'ALL', type: 'CASH' }}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={120} />
          </Form.Item>
          <Space style={{ width: '100%' }} align="start">
            <Form.Item name="type" label="券类型" rules={[{ required: true, message: '请选择类型' }]} style={{ width: 180 }}>
              <Select options={templateTypeOptions} />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ width: 180 }}>
              <Select options={templateStatusOptions} />
            </Form.Item>
            <Form.Item name="applicableScope" label="适用范围" style={{ width: 180 }}>
              <Select options={scopeOptions} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} align="start">
            <Form.Item
              name="discountValue"
              label={createType === 'DISCOUNT' ? '优惠值（折扣）' : '优惠值'}
              tooltip={createType === 'DISCOUNT' ? '按“几折”填写，如 8.5 表示 8.5 折' : undefined}
              rules={[{ required: createType !== 'FREE', message: '请输入优惠值' }]}
              style={{ width: 220 }}
            >
              {createType === 'DISCOUNT' ? (
                <InputNumber min={0.1} max={9.9} step={0.1} precision={1} style={{ width: '100%' }} addonAfter="折" />
              ) : (
                <InputNumber min={0} style={{ width: '100%' }} />
              )}
            </Form.Item>
            {createType === 'FULL_REDUCTION' ? (
              <Form.Item
                name="thresholdAmount"
                label="满减门槛"
                rules={[{ required: true, message: '请输入满减门槛' }]}
                style={{ width: 200 }}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            ) : null}
            <Form.Item name="maxDiscountAmount" label="封顶优惠" style={{ width: 160 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} align="start">
            <Form.Item name="startAt" label="开始时间" style={{ width: 260 }}>
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="endAt" label="结束时间" style={{ width: 260 }}>
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} align="start">
            <Form.Item name="totalLimit" label="总发放上限" style={{ width: 220 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="perUserLimit" label="单用户上限" style={{ width: 220 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          {createScope === 'PROJECT' ? (
            <Form.Item
              name="applicableTargetIds"
              label="可用商品"
              rules={[{ required: true, message: '请选择可用商品' }]}
            >
              <Transfer
                showSearch
                titles={['商品列表', '已选商品']}
                targetKeys={projectTargetKeys}
                onChange={(nextTargetKeys) => {
                  setProjectTargetKeys(nextTargetKeys.map((key) => String(key)));
                  const merged: Record<string, { label: string; value: number }> = { ...selectedProjects };
                  projectOptions.forEach((x) => {
                    merged[String(x.value)] = x;
                  });
                  setSelectedProjects(merged);
                  formCreate.setFieldValue(
                    'applicableTargetIds',
                    nextTargetKeys.map((k) => Number(k)).filter((x) => Number.isFinite(x) && x > 0),
                  );
                }}
                onSearch={(direction, value) => {
                  if (direction === 'left') {
                    void loadProjects(value);
                  }
                }}
                dataSource={Array.from(
                  new Map(
                    [...projectOptions, ...Object.values(selectedProjects)].map((x) => [String(x.value), x]),
                  ).values(),
                ).map((x) => ({
                  key: String(x.value),
                  title: x.label,
                  description: x.label,
                }))}
                render={(item) => item.title}
                listStyle={{ width: 280, height: 320 }}
              />
            </Form.Item>
          ) : null}
          {createScope === 'CATEGORY' ? (
            <Form.Item
              name="applicableTargetIds"
              label="选择游戏及类别"
              rules={[{ required: true, message: '请选择分类' }]}
            >
              <>
                <Tree
                  checkable
                  selectable={false}
                  defaultExpandAll
                  treeData={categoryTreeOptions}
                  checkedKeys={checkedCategoryKeys}
                  onCheck={(nextChecked) => {
                    const keys = Array.isArray(nextChecked) ? nextChecked : nextChecked?.checked || [];
                    setCheckedCategoryKeys(keys);
                    formCreate.setFieldValue(
                      'applicableTargetIds',
                      keys.map((k) => String(k)).filter((x) => !!x),
                    );
                  }}
                />
                <Form.Item name="applicableTargetIds" noStyle>
                  <Input type="hidden" />
                </Form.Item>
              </>
            </Form.Item>
          ) : null}
          {createScope === 'USER_LEVEL' ? (
            <Form.Item label="可用等级（预留）">
              <Input disabled value="指定等级功能后续迭代开发" />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>

      <Modal
        title="发券"
        open={grantOpen}
        onCancel={() => setGrantOpen(false)}
        onOk={async () => {
          try {
            const v = await formGrant.validateFields();
            setSubmitting(true);
            await grantUserCoupon({
              userIds: Array.isArray(v.userIds) ? v.userIds.map((item: any) => Number(item)).filter((item: number) => Number.isFinite(item) && item > 0) : [],
              templateId: Number(v.templateId),
              count: Number(v.count || 1),
              expiresAt: v.expiresAt ? dayjs(v.expiresAt).toISOString() : undefined,
            });
            message.success('发券成功');
            setGrantOpen(false);
            formGrant.resetFields();
          } catch (e: any) {
            if (!e?.errorFields) message.error(e?.data?.message || e?.message || '发券失败');
          } finally {
            setSubmitting(false);
          }
        }}
        confirmLoading={submitting}
      >
        <Form form={formGrant} layout="vertical" initialValues={{ count: 1 }}>
          <Form.Item name="userIds" label="发放用户" rules={[{ required: true, message: '请选择至少一个用户' }]}>
            <Select
              showSearch
              mode="multiple"
              placeholder="输入姓名、手机号后搜索用户"
              filterOption={false}
              options={grantUserOptions}
              loading={grantUserLoading}
              onSearch={(value) => {
                void loadGrantUsers(value);
              }}
            />
          </Form.Item>
          <Form.Item name="templateId" label="优惠券模板" rules={[{ required: true, message: '请选择模板' }]}>
            <Select
              showSearch
              placeholder="选择已生效的优惠券模板"
              optionFilterProp="label"
              options={grantTemplateOptions}
              loading={grantTemplateLoading}
            />
          </Form.Item>
          <Form.Item name="count" label="发放数量">
            <InputNumber min={1} max={200} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expiresAt" label="过期时间（可选）">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default CouponsPage;
