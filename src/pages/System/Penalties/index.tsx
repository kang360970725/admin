import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
} from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import {
  getPenaltyAppeals,
  getPenaltyDict,
  getPenaltyFundFlows,
  getPenaltyOverview,
  getPenaltyRanking,
  getPenaltyRules,
  getPenaltyTicketContext,
  getPenaltyTicketDetail,
  getPenaltyTickets,
  getUsers,
  postPenaltyReviewAppeal,
  postPenaltyRuleCreate,
  postPenaltyRuleUpdate,
  postPenaltyTicketCreate,
  postPenaltyTicketRemind,
} from '@/services/api';

const PenaltiesPage: React.FC = () => {
  const currentUser = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);
  const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
  const canFullPenaltyManage = permissions.includes('penalties:page') || permissions.includes('system:role:page');
  const canPenaltyIssue = canFullPenaltyManage || permissions.includes('penalties:ticket:create');
  const [tab, setTab] = useState<string>(canFullPenaltyManage ? 'overview' : 'tickets');
  const [loading, setLoading] = useState(false);

  const [dict, setDict] = useState<any>({
    categoryLabelMap: {},
    ticketStatusLabelMap: {},
    appealStatusLabelMap: {},
    fundBizTypeLabelMap: {},
  });

  const [overview, setOverview] = useState<any>(null);

  const [rules, setRules] = useState<any[]>([]);
  const [ruleTotal, setRuleTotal] = useState(0);
  const [rulePage, setRulePage] = useState(1);
  const [ruleLimit, setRuleLimit] = useState(20);
  const [ruleQuery, setRuleQuery] = useState<any>({});

  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketTotal, setTicketTotal] = useState(0);
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketLimit, setTicketLimit] = useState(20);
  const [ticketQuery, setTicketQuery] = useState<any>({});

  const [appeals, setAppeals] = useState<any[]>([]);
  const [appealTotal, setAppealTotal] = useState(0);
  const [appealPage, setAppealPage] = useState(1);
  const [appealLimit, setAppealLimit] = useState(20);
  const [appealQuery, setAppealQuery] = useState<any>({});

  const [flows, setFlows] = useState<any[]>([]);
  const [flowTotal, setFlowTotal] = useState(0);
  const [flowPage, setFlowPage] = useState(1);
  const [flowLimit, setFlowLimit] = useState(20);
  const [flowQuery, setFlowQuery] = useState<any>({});

  const [ranking, setRanking] = useState<any[]>([]);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [ruleForm] = Form.useForm();

  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketForm] = Form.useForm();
  const [ticketRuleOptions, setTicketRuleOptions] = useState<any[]>([]);
  const [ticketContext, setTicketContext] = useState<any>(null);
  const [staffOptions, setStaffOptions] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTicket, setReviewTicket] = useState<any>(null);
  const [reviewForm] = Form.useForm();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);

  const categoryOptions = useMemo(
    () => Object.keys(dict?.categoryLabelMap || {}).map((key) => ({ value: key, label: dict.categoryLabelMap[key] })),
    [dict],
  );
  const ticketStatusOptions = useMemo(
    () => Object.keys(dict?.ticketStatusLabelMap || {}).map((key) => ({ value: key, label: dict.ticketStatusLabelMap[key] })),
    [dict],
  );
  const appealStatusOptions = useMemo(
    () => Object.keys(dict?.appealStatusLabelMap || {}).map((key) => ({ value: key, label: dict.appealStatusLabelMap[key] })),
    [dict],
  );
  const flowBizOptions = useMemo(
    () => Object.keys(dict?.fundBizTypeLabelMap || {}).map((key) => ({ value: key, label: dict.fundBizTypeLabelMap[key] })),
    [dict],
  );

  const fmt = (v?: string) => {
    if (!v) return '-';
    const d = dayjs(v);
    return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : '-';
  };

  const loadDict = async () => {
    const res: any = await getPenaltyDict();
    setDict(res || {});
  };

  const loadOverview = async () => {
    const [overviewRes, rankingRes] = await Promise.all([getPenaltyOverview(), getPenaltyRanking({ top: 20 })]);
    setOverview(overviewRes || null);
    setRanking(Array.isArray(rankingRes?.list) ? rankingRes.list : []);
  };

  const loadRules = async (page = rulePage, limit = ruleLimit) => {
    const res: any = await getPenaltyRules({ page, limit, ...ruleQuery });
    setRules(Array.isArray(res?.data) ? res.data : []);
    setRuleTotal(Number(res?.total || 0));
    setRulePage(page);
    setRuleLimit(limit);
  };

  const loadTickets = async (page = ticketPage, limit = ticketLimit) => {
    const res: any = await getPenaltyTickets({ page, limit, ...ticketQuery });
    setTickets(Array.isArray(res?.data) ? res.data : []);
    setTicketTotal(Number(res?.total || 0));
    setTicketPage(page);
    setTicketLimit(limit);
  };

  const loadAppeals = async (page = appealPage, limit = appealLimit) => {
    const res: any = await getPenaltyAppeals({ page, limit, ...appealQuery });
    setAppeals(Array.isArray(res?.data) ? res.data : []);
    setAppealTotal(Number(res?.total || 0));
    setAppealPage(page);
    setAppealLimit(limit);
  };

  const loadFlows = async (page = flowPage, limit = flowLimit) => {
    const res: any = await getPenaltyFundFlows({ page, limit, ...flowQuery });
    setFlows(Array.isArray(res?.data) ? res.data : []);
    setFlowTotal(Number(res?.total || 0));
    setFlowPage(page);
    setFlowLimit(limit);
  };

  const loadByTab = async (targetTab = tab) => {
    setLoading(true);
    try {
      if (targetTab === 'overview' && canFullPenaltyManage) await loadOverview();
      if (targetTab === 'rules') await loadRules(1, ruleLimit);
      if (targetTab === 'tickets') await loadTickets(1, ticketLimit);
      if (targetTab === 'appeals' && canFullPenaltyManage) await loadAppeals(1, appealLimit);
      if (targetTab === 'fund' && canFullPenaltyManage) await loadFlows(1, flowLimit);
    } catch (e: any) {
      message.error(e?.data?.message || e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadStaffOptions = async (search = '') => {
    setStaffLoading(true);
    try {
      const res: any = await getUsers({
        page: 1,
        limit: 30,
        userType: 'STAFF',
        status: 'ACTIVE',
        search: String(search || '').trim() || undefined,
      });
      const list = Array.isArray(res?.data) ? res.data : [];
      setStaffOptions(
        list.map((u: any) => ({
          value: Number(u.id),
          label: `${u?.name || u?.realName || '未命名'} (${u?.phone || '-'}) #${u?.id}`,
        })),
      );
    } catch {
      setStaffOptions([]);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        if (!canPenaltyIssue) {
          message.error('无权限访问罚单管理');
          return;
        }
        await loadDict();
        await loadByTab(canFullPenaltyManage ? 'overview' : 'tickets');
      } catch (e: any) {
        message.error(e?.data?.message || e?.message || '初始化失败');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFullPenaltyManage, canPenaltyIssue]);

  const openRuleCreate = () => {
    setEditingRule(null);
    ruleForm.resetFields();
    ruleForm.setFieldsValue({ enabled: true, sortOrder: 0 });
    setRuleModalOpen(true);
  };

  const openRuleEdit = (row: any) => {
    setEditingRule(row);
    ruleForm.setFieldsValue({
      id: row.id,
      name: row.name,
      category: row.category,
      amount: Number(row.amount || 0),
      description: row.description,
      enabled: row.enabled,
      sortOrder: row.sortOrder,
    });
    setRuleModalOpen(true);
  };

  const submitRule = async () => {
    const values = await ruleForm.validateFields();
    try {
      if (editingRule) {
        await postPenaltyRuleUpdate({
          id: Number(editingRule.id),
          ...values,
        });
        message.success('条例已更新');
      } else {
        await postPenaltyRuleCreate(values);
        message.success('条例已创建');
      }
      setRuleModalOpen(false);
      await loadRules(1, ruleLimit);
    } catch (e: any) {
      message.error(e?.data?.message || e?.message || '操作失败');
    }
  };

  const openTicketCreate = async () => {
    setTicketContext(null);
    ticketForm.resetFields();
    setTicketModalOpen(true);
    try {
      const [res] = await Promise.all([
        getPenaltyRules({ page: 1, limit: 500, enabled: true }),
        loadStaffOptions(''),
      ]);
      setTicketRuleOptions(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setTicketRuleOptions([]);
    }
  };

  const onTicketRuleChange = async () => {
    const userId = Number(ticketForm.getFieldValue('userId') || 0);
    const ruleIds = (ticketForm.getFieldValue('ruleIds') || []) as number[];
    if (!userId || !ruleIds.length) {
      setTicketContext(null);
      return;
    }
    try {
      const res: any = await getPenaltyTicketContext({ userId, ruleIds });
      setTicketContext(res || null);
      if (ticketForm.getFieldValue('finalAmount') == null) {
        ticketForm.setFieldValue('finalAmount', Number(res?.ruleAmount || 0));
      }
    } catch (e: any) {
      setTicketContext(null);
      message.error(e?.data?.message || e?.message || '获取开单上下文失败');
    }
  };

  const submitTicket = async () => {
    const values = await ticketForm.validateFields();
    try {
      await postPenaltyTicketCreate({
        userId: Number(values.userId),
        ruleIds: values.ruleIds,
        finalAmount: values.finalAmount == null ? undefined : Number(values.finalAmount),
        reason: values.reason,
      });
      message.success('罚单已创建');
      setTicketModalOpen(false);
      await Promise.all([loadTickets(1, ticketLimit), loadOverview()]);
    } catch (e: any) {
      message.error(e?.data?.message || e?.message || '创建失败');
    }
  };

  const openReview = (row: any) => {
    setReviewTicket(row);
    reviewForm.resetFields();
    reviewForm.setFieldsValue({ approved: false });
    setReviewModalOpen(true);
  };

  const submitReview = async () => {
    const values = await reviewForm.validateFields();
    if (!reviewTicket?.ticket?.id && !reviewTicket?.ticketId) return;
    const ticketId = Number(reviewTicket?.ticket?.id || reviewTicket?.ticketId);
    try {
      await postPenaltyReviewAppeal({
        ticketId,
        approved: Boolean(values.approved),
        reviewRemark: values.reviewRemark,
      });
      message.success('审核已提交');
      setReviewModalOpen(false);
      await Promise.all([loadAppeals(1, appealLimit), loadTickets(1, ticketLimit), loadOverview()]);
    } catch (e: any) {
      message.error(e?.data?.message || e?.message || '审核失败');
    }
  };

  const remindTicket = async (row: any) => {
    try {
      await postPenaltyTicketRemind({ ticketId: Number(row.id) });
      message.success('催办已发送');
    } catch (e: any) {
      message.error(e?.data?.message || e?.message || '催办失败');
    }
  };

  const openDetail = async (row: any) => {
    try {
      const res: any = await getPenaltyTicketDetail({ ticketId: Number(row.id) });
      setDetailData(res || null);
      setDetailOpen(true);
    } catch (e: any) {
      message.error(e?.data?.message || e?.message || '获取详情失败');
    }
  };

  const columnsRules = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '编码', dataIndex: 'code', width: 120 },
    { title: '名称', dataIndex: 'name' },
    { title: '分类', dataIndex: 'categoryLabel', width: 150 },
    { title: '金额', dataIndex: 'amount', width: 120 },
    { title: '状态', dataIndex: 'enabled', width: 100, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag> },
    { title: '排序', dataIndex: 'sortOrder', width: 90 },
    {
      title: '操作',
      width: 140,
      render: (_: any, row: any) => <Button type="link" onClick={() => openRuleEdit(row)}>编辑</Button>,
    },
  ];

  const columnsTickets = [
    { title: '罚单号', dataIndex: 'ticketNo', width: 180 },
    { title: '陪玩', width: 180, render: (_: any, row: any) => `${row?.user?.name || '-'}(${row?.user?.phone || '-'})` },
    { title: '规则金额', dataIndex: 'ruleAmount', width: 110 },
    { title: '最终金额', dataIndex: 'finalAmount', width: 110 },
    { title: '状态', dataIndex: 'statusLabel', width: 140 },
    { title: '申诉状态', dataIndex: 'appealStatusLabel', width: 140 },
    { title: '创建时间', dataIndex: 'createdAt', width: 170, render: (v: string) => fmt(v) },
    {
          title: '操作',
          width: 260,
          render: (_: any, row: any) => (
            <Space>
              <Button size="small" onClick={() => openDetail(row)}>详情</Button>
              {canFullPenaltyManage ? <Button size="small" onClick={() => remindTicket(row)}>催办</Button> : null}
            </Space>
          ),
    },
  ];

  const columnsAppeals = [
    { title: '申诉ID', dataIndex: 'id', width: 90 },
    { title: '罚单号', width: 180, render: (_: any, row: any) => row?.ticket?.ticketNo || '-' },
    { title: '陪玩', width: 180, render: (_: any, row: any) => `${row?.user?.name || '-'}(${row?.user?.phone || '-'})` },
    { title: '状态', dataIndex: 'statusLabel', width: 130 },
    { title: '申诉说明', dataIndex: 'content', ellipsis: true },
    { title: '提交时间', dataIndex: 'createdAt', width: 170, render: (v: string) => fmt(v) },
    {
      title: '操作',
      width: 130,
      render: (_: any, row: any) => (
        <Button size="small" type="primary" disabled={row?.status !== 'PENDING'} onClick={() => openReview(row)}>
          审核
        </Button>
      ),
    },
  ];

  const columnsFlows = [
    { title: '流水ID', dataIndex: 'id', width: 90 },
    { title: '罚单号', width: 180, render: (_: any, row: any) => row?.ticket?.ticketNo || '-' },
    { title: '陪玩', width: 180, render: (_: any, row: any) => `${row?.user?.name || '-'}(${row?.user?.phone || '-'})` },
    { title: '类型', dataIndex: 'bizTypeLabel', width: 150 },
    { title: '金额', dataIndex: 'amount', width: 120 },
    { title: '变动前', dataIndex: 'beforeBalance', width: 110 },
    { title: '变动后', dataIndex: 'afterBalance', width: 110 },
    { title: '时间', dataIndex: 'createdAt', width: 170, render: (v: string) => fmt(v) },
  ];

  return (
    <PageContainer title="罚单管理" subTitle="条例维护、开罚单、申诉审核、资金池与排行">
      <Card>
        <Tabs
          activeKey={tab}
          onChange={(next) => {
            setTab(next);
            void loadByTab(next);
          }}
          items={[
            {
              key: 'overview',
              label: '看板',
              children: (
                <>
                  <Row gutter={[16, 16]}>
                    <Col span={6}><Card><Statistic title="待确认" value={overview?.pending?.pendingConfirmCount || 0} /></Card></Col>
                    <Col span={6}><Card><Statistic title="待审核" value={overview?.pending?.appealPendingCount || 0} /></Card></Col>
                    <Col span={6}><Card><Statistic title="今日新开" value={overview?.pending?.todayCreatedCount || 0} /></Card></Col>
                    <Col span={6}><Card><Statistic title="平均处理时长(小时)" value={overview?.process?.avgProcessHours || 0} precision={1} /></Card></Col>
                  </Row>

                  <Card title="近7天趋势" style={{ marginTop: 16 }}>
                    <Table
                      rowKey="date"
                      size="small"
                      pagination={false}
                      dataSource={overview?.trend7d || []}
                      columns={[
                        { title: '日期', dataIndex: 'date' },
                        { title: '新建', dataIndex: 'createdCount' },
                        { title: '生效', dataIndex: 'effectiveCount' },
                        { title: '失效', dataIndex: 'invalidCount' },
                        { title: '扣款额', dataIndex: 'deductedAmount' },
                      ]}
                    />
                  </Card>

                  <Row gutter={16} style={{ marginTop: 16 }}>
                    <Col span={12}>
                      <Card title="高频违规 Top10">
                        <Table
                          rowKey="rank"
                          size="small"
                          pagination={false}
                          dataSource={overview?.topRules || []}
                          columns={[
                            { title: '排名', dataIndex: 'rank', width: 70 },
                            { title: '条例', dataIndex: 'ruleName' },
                            { title: '次数', dataIndex: 'count', width: 80 },
                            { title: '累计金额', dataIndex: 'amount', width: 120 },
                          ]}
                        />
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card title="受罚排行 Top20">
                        <Table
                          rowKey="rank"
                          size="small"
                          pagination={false}
                          dataSource={ranking}
                          columns={[
                            { title: '排名', dataIndex: 'rank', width: 70 },
                            { title: '陪玩', render: (_: any, row: any) => `${row?.user?.name || '-'}(${row?.user?.phone || '-'})` },
                            { title: '罚单数', dataIndex: 'penaltyCount', width: 90 },
                            { title: '扣款总额', dataIndex: 'totalDeductedAmount', width: 120 },
                          ]}
                        />
                      </Card>
                    </Col>
                  </Row>
                </>
              ),
            },
            {
              key: 'rules',
              label: '处罚条例',
              children: (
                <>
                  <Space wrap style={{ marginBottom: 12 }}>
                    <Input allowClear placeholder="关键词(编码/名称)" style={{ width: 220 }} onChange={(e) => setRuleQuery((s: any) => ({ ...s, keyword: e.target.value || undefined }))} />
                    <Select allowClear placeholder="分类" style={{ width: 180 }} options={categoryOptions} onChange={(v) => setRuleQuery((s: any) => ({ ...s, category: v || undefined }))} />
                    <Select allowClear placeholder="启用状态" style={{ width: 140 }} options={[{ label: '启用', value: true }, { label: '停用', value: false }]} onChange={(v) => setRuleQuery((s: any) => ({ ...s, enabled: v }))} />
                    <Button type="primary" onClick={() => loadRules(1, ruleLimit)}>查询</Button>
                    <Button onClick={openRuleCreate}>新增条例</Button>
                  </Space>
                  <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={rules}
                    columns={columnsRules as any}
                    pagination={{
                      current: rulePage,
                      pageSize: ruleLimit,
                      total: ruleTotal,
                      onChange: (p, l) => loadRules(p, l),
                    }}
                  />
                </>
              ),
            },
            {
              key: 'tickets',
              label: '罚单列表',
              children: (
                <>
                  <Space wrap style={{ marginBottom: 12 }}>
                    <Input allowClear placeholder="关键词(罚单号/陪玩)" style={{ width: 220 }} onChange={(e) => setTicketQuery((s: any) => ({ ...s, keyword: e.target.value || undefined }))} />
                    <InputNumber placeholder="陪玩ID" style={{ width: 140 }} onChange={(v) => setTicketQuery((s: any) => ({ ...s, userId: v || undefined }))} />
                    <Select allowClear placeholder="罚单状态" style={{ width: 170 }} options={ticketStatusOptions} onChange={(v) => setTicketQuery((s: any) => ({ ...s, status: v || undefined }))} />
                    <Select allowClear placeholder="申诉状态" style={{ width: 170 }} options={appealStatusOptions} onChange={(v) => setTicketQuery((s: any) => ({ ...s, appealStatus: v || undefined }))} />
                    <Button type="primary" onClick={() => loadTickets(1, ticketLimit)}>查询</Button>
                    <Button onClick={openTicketCreate}>开罚单</Button>
                  </Space>
                  <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={tickets}
                    columns={columnsTickets as any}
                    pagination={{
                      current: ticketPage,
                      pageSize: ticketLimit,
                      total: ticketTotal,
                      onChange: (p, l) => loadTickets(p, l),
                    }}
                  />
                </>
              ),
            },
            {
              key: 'appeals',
              label: '申诉审核',
              children: (
                <>
                  <Space wrap style={{ marginBottom: 12 }}>
                    <Input allowClear placeholder="关键词(罚单号/陪玩/内容)" style={{ width: 260 }} onChange={(e) => setAppealQuery((s: any) => ({ ...s, keyword: e.target.value || undefined }))} />
                    <Select allowClear placeholder="申诉状态" style={{ width: 180 }} options={appealStatusOptions} onChange={(v) => setAppealQuery((s: any) => ({ ...s, status: v || undefined }))} />
                    <Button type="primary" onClick={() => loadAppeals(1, appealLimit)}>查询</Button>
                  </Space>
                  <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={appeals}
                    columns={columnsAppeals as any}
                    pagination={{
                      current: appealPage,
                      pageSize: appealLimit,
                      total: appealTotal,
                      onChange: (p, l) => loadAppeals(p, l),
                    }}
                  />
                </>
              ),
            },
            {
              key: 'fund',
              label: '资金流水',
              children: (
                <>
                  <Space wrap style={{ marginBottom: 12 }}>
                    <Select allowClear placeholder="流水类型" style={{ width: 180 }} options={flowBizOptions} onChange={(v) => setFlowQuery((s: any) => ({ ...s, bizType: v || undefined }))} />
                    <Button type="primary" onClick={() => loadFlows(1, flowLimit)}>查询</Button>
                  </Space>
                  <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={flows}
                    columns={columnsFlows as any}
                    pagination={{
                      current: flowPage,
                      pageSize: flowLimit,
                      total: flowTotal,
                      onChange: (p, l) => loadFlows(p, l),
                    }}
                  />
                </>
              ),
            },
          ].filter((x) => (canFullPenaltyManage ? true : x.key === 'tickets' || x.key === 'rules'))}
        />
      </Card>

      <Modal
        title={editingRule ? '编辑处罚条例' : '新增处罚条例'}
        open={ruleModalOpen}
        onCancel={() => setRuleModalOpen(false)}
        onOk={submitRule}
        destroyOnClose
      >
        <Form layout="vertical" form={ruleForm}>
          {!editingRule && (
            <Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入编码' }]}>
              <Input maxLength={32} placeholder="例如：SERVICE_TIMEOUT" />
            </Form.Item>
          )}
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={categoryOptions} />
          </Form.Item>
          <Form.Item name="amount" label="处罚金额" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} maxLength={255} />
          </Form.Item>
          <Form.Item name="enabled" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={[{ value: true, label: '启用' }, { value: false, label: '停用' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="开罚单"
        open={ticketModalOpen}
        onCancel={() => setTicketModalOpen(false)}
        onOk={submitTicket}
        width={680}
        destroyOnClose
      >
        <Form layout="vertical" form={ticketForm}>
          <Form.Item name="userId" label="陪玩账号" rules={[{ required: true, message: '请选择陪玩账号' }]}>
            <Select
              showSearch
              allowClear
              placeholder="请选择员工账号，支持按ID/姓名/手机号搜索"
              options={staffOptions}
              loading={staffLoading}
              filterOption={false}
              onSearch={(v) => {
                void loadStaffOptions(v);
              }}
              onChange={() => onTicketRuleChange()}
            />
          </Form.Item>
          <Form.Item name="ruleIds" label="处罚条例(可多选)" rules={[{ required: true, message: '请选择条例' }]}>
            <Select
              mode="multiple"
              options={ticketRuleOptions.map((x) => ({
                value: x.id,
                label: `${x.name} (${x.categoryLabel || x.category}) ¥${x.amount}`,
              }))}
              onChange={() => onTicketRuleChange()}
            />
          </Form.Item>
          <Form.Item name="finalAmount" label="最终金额(可调整)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="备注说明">
            <Input.TextArea rows={3} maxLength={255} />
          </Form.Item>
        </Form>

        {ticketContext && (
          <Card size="small" title="开单预览信息" style={{ marginTop: 8 }}>
            <Row gutter={16}>
              <Col span={8}><Statistic title="条例累计金额" value={Number(ticketContext?.ruleAmount || 0)} /></Col>
              <Col span={16}>
                <div style={{ marginTop: 4 }}>
                  同类历史处罚：
                  {Object.keys(ticketContext?.sameCategoryStatsLabel || {}).map((k) => (
                    <Tag key={k}>{k}:{ticketContext.sameCategoryStatsLabel[k]}</Tag>
                  ))}
                </div>
              </Col>
            </Row>
          </Card>
        )}
      </Modal>

      <Modal
        title={`申诉审核${reviewTicket?.ticket?.ticketNo ? ` - ${reviewTicket?.ticket?.ticketNo}` : ''}`}
        open={reviewModalOpen}
        onCancel={() => setReviewModalOpen(false)}
        onOk={submitReview}
        destroyOnClose
      >
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="approved" label="审核结果" rules={[{ required: true, message: '请选择审核结果' }]}>
            <Select options={[{ value: true, label: '通过（罚单失效）' }, { value: false, label: '驳回（立即扣款）' }]} />
          </Form.Item>
          <Form.Item name="reviewRemark" label="审核备注">
            <Input.TextArea rows={3} maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`罚单详情${detailData?.ticketNo ? ` - ${detailData.ticketNo}` : ''}`}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={760}
      >
        <Row gutter={[16, 16]}>
          <Col span={12}><Statistic title="状态" value={detailData?.statusLabel || '-'} /></Col>
          <Col span={12}><Statistic title="申诉状态" value={detailData?.appealStatusLabel || '-'} /></Col>
          <Col span={12}><Statistic title="规则金额" value={Number(detailData?.ruleAmount || 0)} /></Col>
          <Col span={12}><Statistic title="最终金额" value={Number(detailData?.finalAmount || 0)} /></Col>
        </Row>

        <Card title="处罚条目" size="small" style={{ marginTop: 16 }}>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={detailData?.details || []}
            columns={[
              { title: '条例编码', dataIndex: 'ruleCodeSnapshot', width: 140 },
              { title: '条例名称', dataIndex: 'ruleNameSnapshot' },
              { title: '分类', dataIndex: 'ruleCategoryLabel', width: 140 },
              { title: '金额', dataIndex: 'amount', width: 100 },
            ] as any}
          />
        </Card>
      </Modal>
    </PageContainer>
  );
};

export default PenaltiesPage;
