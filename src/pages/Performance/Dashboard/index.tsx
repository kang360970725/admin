import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
    Avatar,
    Button,
    Card,
    Col,
    DatePicker,
    Empty,
    List,
    Progress,
    Row,
    Select,
    Space,
    Statistic,
    Tag,
    Typography,
    message,
} from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { history } from 'umi';
import {
    getPerformanceDashboardList,
    getPerformanceDashboardOverview,
} from '@/services/api';

const { RangePicker } = DatePicker;
const { Text } = Typography;

type OverviewSummary = {
    totalGrossPerformanceAmount: number;
    totalNetIncomeAmount: number;
    totalContributionAmount: number;
    totalNegativeIncomeAmount: number;

    playerGrossPerformanceAmount: number;
    playerNetIncomeAmount: number;

    csGrossPerformanceAmount: number;
    csNetIncomeAmount: number;

    totalCompletedOrders: number;
    activeEarners: number;
    activeCsUsers: number;
    avgNetIncomePerUser: number;
    totalWithdrawSuccessAmount: number;
    currentWalletAvailable: number;
    currentWalletFrozen: number;
    todayNetIncomeAmount: number;
};

type TrendItem = {
    date: string;
    grossPerformanceAmount: number;
    netIncomeAmount: number;
    negativeIncomeAmount: number;
    completedOrders: number;
    activeUsers: number;
};

type Composition = {
    hourlyIncome: number;
    guaranteedIncome: number;
    modePlayIncome: number;
    carryIncome: number;
    csIncome: number;
    otherIncome: number;
};

type RankingUserItem = {
    userId: number;
    userName: string;
    amount?: number;
    completedOrders?: number;
    successCount?: number;
};

type OverviewData = {
    summary: OverviewSummary;
    trend: TrendItem[];
    incomeComposition: Composition;
    ranking: {
        incomeTop: RankingUserItem[];
        orderTop: RankingUserItem[];
        withdrawTop: RankingUserItem[];
    };
};

type TableRow = {
    userId: number;
    userName: string;
    phone?: string;
    avatar?: string;
    userType?: string;
    ownerRoleType?: string;
    canWithdraw?: boolean;
    staffRatingName?: string;

    completedOrders: number;
    totalDispatchRounds: number;

    grossPerformanceAmount: number;
    netIncomeAmount: number;
    totalContributionAmount: number;
    negativeIncomeAmount: number;

    hourlyIncome: number;
    guaranteedIncome: number;
    modePlayIncome: number;
    otherIncome: number;
    csIncome?: number;

    withdrawSuccessAmount: number;

    walletAvailable: number;
    walletFrozen: number;
    walletTotal: number;

    lastStatsDate?: string;
};

const defaultSummary: OverviewSummary = {
    totalGrossPerformanceAmount: 0,
    totalNetIncomeAmount: 0,
    totalContributionAmount: 0,
    totalNegativeIncomeAmount: 0,

    playerGrossPerformanceAmount: 0,
    playerNetIncomeAmount: 0,

    csGrossPerformanceAmount: 0,
    csNetIncomeAmount: 0,

    totalCompletedOrders: 0,
    activeEarners: 0,
    activeCsUsers: 0,
    avgNetIncomePerUser: 0,
    totalWithdrawSuccessAmount: 0,
    currentWalletAvailable: 0,
    currentWalletFrozen: 0,
    todayNetIncomeAmount: 0,
};

const defaultOverview: OverviewData = {
    summary: defaultSummary,
    trend: [],
    incomeComposition: {
        hourlyIncome: 0,
        guaranteedIncome: 0,
        modePlayIncome: 0,
        carryIncome: 0,
        csIncome: 0,
        otherIncome: 0,
    },
    ranking: {
        incomeTop: [],
        orderTop: [],
        withdrawTop: [],
    },
};

const formatMoney = (value?: number) => `¥${Number(value ?? 0).toFixed(2)}`;

const formatDateTime = (value?: string) => {
    if (!value) return '-';
    return dayjs(value).format('YYYY-MM-DD HH:mm');
};

const getUserTypeTag = (userType?: string) => {
    if (!userType) return <Tag>未知</Tag>;
    if (userType === 'STAFF') return <Tag color="blue">打手</Tag>;
    if (userType === 'CUSTOMER_SERVICE') return <Tag color="green">客服</Tag>;
    if (userType === 'ADMIN') return <Tag color="orange">管理员</Tag>;
    return <Tag>{userType}</Tag>;
};

const getOwnerRoleTag = (ownerRoleType?: string) => {
    if (!ownerRoleType) return <Tag>未知</Tag>;
    if (ownerRoleType === 'PLAYER') return <Tag color="blue">打手业绩</Tag>;
    if (ownerRoleType === 'CS') return <Tag color="green">客服业绩</Tag>;
    if (ownerRoleType === 'OPERATION') return <Tag color="purple">运营</Tag>;
    if (ownerRoleType === 'CHANNEL') return <Tag color="gold">渠道</Tag>;
    if (ownerRoleType === 'LEADER') return <Tag color="cyan">团长</Tag>;
    return <Tag>{ownerRoleType}</Tag>;
};

const getQuickRange = (type: 'today' | 'week' | 'month') => {
    if (type === 'today') {
        return [dayjs().startOf('day'), dayjs().endOf('day')];
    }
    if (type === 'week') {
        return [dayjs().startOf('week'), dayjs().endOf('week')];
    }
    return [dayjs().startOf('month'), dayjs().endOf('month')];
};

const buildPercent = (part: number, total: number) => {
    const p = total > 0 ? (Number(part || 0) / Number(total || 0)) * 100 : 0;
    return Math.max(0, Math.min(100, Number(p.toFixed(2))));
};

const SimpleTrendBlock: React.FC<{ data: TrendItem[] }> = ({ data }) => {
    if (!data?.length) {
        return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无趋势数据" />;
    }

    const maxNetIncome = Math.max(...data.map((i) => Number(i.netIncomeAmount || 0)), 1);

    return (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {data.map((item) => {
                const percent = Math.max(
                    4,
                    Math.round((Number(item.netIncomeAmount || 0) / maxNetIncome) * 100),
                );

                return (
                    <div key={item.date}>
                        <Row justify="space-between" style={{ marginBottom: 6 }}>
                            <Col>
                                <Text>{item.date}</Text>
                            </Col>
                            <Col>
                                <Space size={16} wrap>
                                    <Text type="secondary">净收益 {formatMoney(item.netIncomeAmount)}</Text>
                                    <Text type="secondary">业绩额 {formatMoney(item.grossPerformanceAmount)}</Text>
                                    <Text type="secondary">负收益 {formatMoney(item.negativeIncomeAmount)}</Text>
                                    <Text type="secondary">完成 {item.completedOrders || 0} 单</Text>
                                    <Text type="secondary">活跃 {item.activeUsers || 0} 人</Text>
                                </Space>
                            </Col>
                        </Row>
                        <Progress percent={percent} showInfo={false} />
                    </div>
                );
            })}
        </Space>
    );
};

const CompositionBlock: React.FC<{ data: Composition }> = ({ data }) => {
    const total =
        Number(data?.hourlyIncome || 0) +
        Number(data?.guaranteedIncome || 0) +
        Number(data?.modePlayIncome || 0) +
        Number(data?.carryIncome || 0) +
        Number(data?.csIncome || 0) +
        Number(data?.otherIncome || 0);

    const items = [
        { label: '小时单净收益', value: Number(data?.hourlyIncome || 0) },
        { label: '保底单净收益', value: Number(data?.guaranteedIncome || 0) },
        { label: '玩法单净收益', value: Number(data?.modePlayIncome || 0) },
        { label: '补偿收益', value: Number(data?.carryIncome || 0) },
        { label: '客服收益', value: Number(data?.csIncome || 0) },
        { label: '其他收益', value: Number(data?.otherIncome || 0) },
    ];

    if (!total) {
        return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无构成数据" />;
    }

    return (
        <Space direction="vertical" style={{ width: '100%' }} size={14}>
            {items.map((item) => (
                <div key={item.label}>
                    <Row justify="space-between" style={{ marginBottom: 6 }}>
                        <Col>
                            <Text>{item.label}</Text>
                        </Col>
                        <Col>
                            <Text strong>{formatMoney(item.value)}</Text>
                        </Col>
                    </Row>
                    <Progress percent={buildPercent(item.value, total)} showInfo />
                </div>
            ))}
        </Space>
    );
};

const RankingCard: React.FC<{
    title: string;
    type: 'income' | 'orders' | 'withdraw';
    data: RankingUserItem[];
}> = ({ title, type, data }) => {
    const renderRight = (item: RankingUserItem) => {
        if (type === 'income') {
            return <Text strong>{formatMoney(item.amount)}</Text>;
        }
        if (type === 'orders') {
            return <Text strong>{item.completedOrders || 0} 单</Text>;
        }
        return <Text strong>{formatMoney(item.amount)}</Text>;
    };

    return (
        <Card title={title} bodyStyle={{ paddingTop: 8 }}>
            {!data?.length ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无排行数据" />
            ) : (
                <List
                    dataSource={data}
                    renderItem={(item, index) => (
                        <List.Item>
                            <List.Item.Meta
                                avatar={<Avatar>{index + 1}</Avatar>}
                                title={
                                    <Space>
                                        <Text strong>{item.userName || `用户${item.userId}`}</Text>
                                        <Tag>ID {item.userId}</Tag>
                                    </Space>
                                }
                                description={
                                    type === 'income'
                                        ? `完成 ${item.completedOrders || 0} 单`
                                        : type === 'orders'
                                            ? `净收益 ${formatMoney(item.amount)}`
                                            : `成功 ${item.successCount || 0} 笔`
                                }
                            />
                            {renderRight(item)}
                        </List.Item>
                    )}
                />
            )}
        </Card>
    );
};

export default function PerformanceDashboardPage() {
    const actionRef = useRef<ActionType>();
    const [loadingOverview, setLoadingOverview] = useState(false);
    const [overview, setOverview] = useState<OverviewData>(defaultOverview);

    const [filters, setFilters] = useState<any>({
        dateRange: undefined,
        userType: 'ALL',
        billingMode: undefined,
        keyword: undefined,
    });

    const queryParams = useMemo(() => {
        const range = filters?.dateRange;
        return {
            dateFrom: Array.isArray(range) && range[0] ? dayjs(range[0]).format('YYYY-MM-DD') : undefined,
            dateTo: Array.isArray(range) && range[1] ? dayjs(range[1]).format('YYYY-MM-DD') : undefined,
            userType: filters?.userType,
            billingMode: filters?.billingMode,
            keyword: filters?.keyword,
        };
    }, [filters]);

    const loadOverview = async () => {
        try {
            setLoadingOverview(true);
            const res = await getPerformanceDashboardOverview(queryParams);
            setOverview({
                summary: {
                    ...defaultSummary,
                    ...(res?.summary || {}),
                },
                trend: Array.isArray(res?.trend) ? res.trend : [],
                incomeComposition: res?.incomeComposition || defaultOverview.incomeComposition,
                ranking: {
                    incomeTop: Array.isArray(res?.ranking?.incomeTop) ? res.ranking.incomeTop : [],
                    orderTop: Array.isArray(res?.ranking?.orderTop) ? res.ranking.orderTop : [],
                    withdrawTop: Array.isArray(res?.ranking?.withdrawTop) ? res.ranking.withdrawTop : [],
                },
            });
        } catch (error) {
            message.error('加载业绩看板失败');
            setOverview(defaultOverview);
        } finally {
            setLoadingOverview(false);
        }
    };

    useEffect(() => {
        loadOverview();
    }, [queryParams]);

    const columns: ProColumns<TableRow>[] = [
        {
            title: '搜索',
            dataIndex: 'keyword',
            hideInTable: true,
            valueType: 'text',
            fieldProps: {
                placeholder: '姓名 / 手机号 / ID',
            },
        },
        {
            title: 'ID',
            dataIndex: 'userId',
            width: 80,
            search: false,
        },
        {
            title: '用户',
            dataIndex: 'userName',
            width: 180,
            search: false,
            render: (_, record) => (
                <Space>
                    <Avatar src={record.avatar}>{record.userName?.[0]}</Avatar>
                    <div>
                        <div style={{ fontWeight: 600 }}>{record.userName || '-'}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>{record.phone || '-'}</div>
                    </div>
                </Space>
            ),
        },
        {
            title: '类型',
            dataIndex: 'userType',
            width: 90,
            search: false,
            render: (_, record) => getUserTypeTag(record.userType),
        },
        {
            title: '业绩角色',
            dataIndex: 'ownerRoleType',
            width: 110,
            search: false,
            render: (_, record) => getOwnerRoleTag(record.ownerRoleType),
        },
        {
            title: '员工评级',
            dataIndex: 'staffRatingName',
            width: 100,
            search: false,
            render: (v) => (v ? <Tag color="blue">{v}</Tag> : <Tag>未设置</Tag>),
        },
        {
            title: '提现',
            dataIndex: 'canWithdraw',
            width: 90,
            search: false,
            render: (_, record) =>
                record.canWithdraw ? <Tag color="green">允许</Tag> : <Tag color="default">关闭</Tag>,
        },
        {
            title: '完成单',
            dataIndex: 'completedOrders',
            width: 90,
            search: false,
            sorter: true,
        },
        {
            title: '派单轮次',
            dataIndex: 'totalDispatchRounds',
            width: 90,
            search: false,
            sorter: true,
        },
        {
            title: '总业绩额',
            dataIndex: 'grossPerformanceAmount',
            width: 110,
            search: false,
            sorter: true,
            renderText: (v) => formatMoney(v),
        },
        {
            title: '总净收益',
            dataIndex: 'netIncomeAmount',
            width: 110,
            search: false,
            sorter: true,
            render: (_, record) => <Text strong>{formatMoney(record.netIncomeAmount)}</Text>,
        },
        {
            title: '总贡献',
            dataIndex: 'totalContributionAmount',
            width: 110,
            search: false,
            sorter: true,
            render: (_, record) =>
                record.ownerRoleType === 'CS' ? (
                    <Text type="secondary">--</Text>
                ) : (
                    <Text>{formatMoney(record.totalContributionAmount)}</Text>
                ),
        },
        {
            title: '总负收益',
            dataIndex: 'negativeIncomeAmount',
            width: 110,
            search: false,
            sorter: true,
            renderText: (v) => formatMoney(v),
        },
        {
            title: '小时单净收益',
            dataIndex: 'hourlyIncome',
            width: 120,
            search: false,
            sorter: true,
            renderText: (v) => formatMoney(v),
        },
        {
            title: '保底单净收益',
            dataIndex: 'guaranteedIncome',
            width: 120,
            search: false,
            sorter: true,
            renderText: (v) => formatMoney(v),
        },
        {
            title: '玩法单净收益',
            dataIndex: 'modePlayIncome',
            width: 120,
            search: false,
            sorter: true,
            renderText: (v) => formatMoney(v),
        },
        {
            title: '客服净收益',
            dataIndex: 'csIncome',
            width: 120,
            search: false,
            sorter: true,
            render: (_, record) =>
                record.ownerRoleType === 'CS' ? (
                    <Text strong style={{ color: '#389e0d' }}>
                        {formatMoney(record.csIncome)}
                    </Text>
                ) : (
                    <Text type="secondary">--</Text>
                ),
        },
        {
            title: '其他净收益',
            dataIndex: 'otherIncome',
            width: 110,
            search: false,
            sorter: true,
            renderText: (v) => formatMoney(v),
        },
        {
            title: '成功提现',
            dataIndex: 'withdrawSuccessAmount',
            width: 110,
            search: false,
            sorter: true,
            renderText: (v) => formatMoney(v),
        },
        {
            title: '当前钱包',
            dataIndex: 'walletAvailable',
            width: 140,
            search: false,
            render: (_, record) => (
                <Space direction="vertical" size={0}>
                    <Text style={{ color: '#1677ff' }}>可用 {formatMoney(record.walletAvailable)}</Text>
                    <Text style={{ color: '#faad14' }}>冻结 {formatMoney(record.walletFrozen)}</Text>
                </Space>
            ),
        },
        {
            title: '最后统计日期',
            dataIndex: 'lastStatsDate',
            width: 150,
            search: false,
            sorter: true,
            renderText: (v) => formatDateTime(v),
        },
        {
            title: '操作',
            key: 'action',
            width: 120,
            fixed: 'right',
            search: false,
            render: (_, record) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        onClick={() => history.push(`/performance/staff/${record.userId}`)}
                    >
                        业绩详情
                    </Button>
                </Space>
            ),
        },
    ];

    const summary = overview.summary || defaultSummary;
    const trend = overview.trend || [];
    const composition = overview.incomeComposition || defaultOverview.incomeComposition;

    return (
        <PageContainer
            header={{
                title: '业绩总看板',
                subTitle: '基于 PerformanceRecord 的业绩主口径',
            }}
        >
            <Card style={{ marginBottom: 16 }}>
                <Space wrap size={12}>
                    <RangePicker
                        value={filters.dateRange}
                        onChange={(value) => {
                            setFilters((prev: any) => ({ ...prev, dateRange: value }));
                        }}
                    />

                    <Button
                        onClick={() => setFilters((prev: any) => ({ ...prev, dateRange: getQuickRange('today') }))}
                    >
                        今天
                    </Button>

                    <Button
                        onClick={() => setFilters((prev: any) => ({ ...prev, dateRange: getQuickRange('week') }))}
                    >
                        本周
                    </Button>

                    <Button
                        onClick={() => setFilters((prev: any) => ({ ...prev, dateRange: getQuickRange('month') }))}
                    >
                        本月
                    </Button>

                    <Select
                        style={{ width: 140 }}
                        placeholder="用户类型"
                        value={filters.userType}
                        onChange={(value) => setFilters((prev: any) => ({ ...prev, userType: value }))}
                        options={[
                            { label: '全部', value: 'ALL' },
                            { label: '只看打手', value: 'STAFF' },
                            { label: '只看客服', value: 'CUSTOMER_SERVICE' },
                        ]}
                    />

                    <Select
                        allowClear
                        style={{ width: 140 }}
                        placeholder="订单类型"
                        value={filters.billingMode}
                        onChange={(value) => setFilters((prev: any) => ({ ...prev, billingMode: value }))}
                        options={[
                            { label: '小时单', value: 'HOURLY' },
                            { label: '保底单', value: 'GUARANTEED' },
                            { label: '玩法单', value: 'MODE_PLAY' },
                        ]}
                    />

                    <Button
                        type="primary"
                        onClick={() => {
                            loadOverview();
                            actionRef.current?.reload();
                        }}
                    >
                        刷新数据
                    </Button>
                </Space>
            </Card>

            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="总业绩额" value={summary.playerGrossPerformanceAmount} precision={2} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="总净收益" value={summary.totalNetIncomeAmount} precision={2} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="打手总业绩" value={summary.playerGrossPerformanceAmount} precision={2} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="打手总收益" value={summary.playerNetIncomeAmount} precision={2} prefix="¥" />
                    </Card>
                </Col>
            </Row>

            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="客服正价单业绩" value={summary.csGrossPerformanceAmount} precision={2} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="客服总收益" value={summary.csNetIncomeAmount} precision={2} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="总贡献" value={summary.totalContributionAmount} precision={2} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="总负收益" value={summary.totalNegativeIncomeAmount} precision={2} prefix="¥" />
                    </Card>
                </Col>
            </Row>

            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="活跃打手" value={summary.activeEarners} />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="活跃客服" value={summary.activeCsUsers} />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="完成单量" value={summary.totalCompletedOrders} />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="人均净收益" value={summary.avgNetIncomePerUser} precision={2} prefix="¥" />
                    </Card>
                </Col>
            </Row>

            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="成功提现" value={summary.totalWithdrawSuccessAmount} precision={2} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="当前总可用" value={summary.currentWalletAvailable} precision={2} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic title="当前总冻结" value={summary.currentWalletFrozen} precision={2} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card loading={loadingOverview}>
                        <Statistic
                            title="今日净收益"
                            value={summary.todayNetIncomeAmount}
                            precision={2}
                            valueStyle={{
                                color: Number(summary.todayNetIncomeAmount || 0) >= 0 ? '#3f8600' : '#cf1322',
                            }}
                            prefix={
                                Number(summary.todayNetIncomeAmount || 0) >= 0 ? (
                                    <ArrowUpOutlined />
                                ) : (
                                    <ArrowDownOutlined />
                                )
                            }
                            suffix="元"
                        />
                    </Card>
                </Col>
            </Row>

            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={24} lg={14}>
                    <Card
                        title="陪玩收益总览"
                        extra={<Text type="secondary">不包含客服抽成</Text>}
                    >
                        <SimpleTrendBlock data={trend} />
                    </Card>
                </Col>
                <Col xs={24} lg={10}>
                    <Card
                        title="收益构成"
                        extra={<Text type="secondary">客服单独记入客服收益</Text>}
                    >
                        <CompositionBlock data={composition} />
                    </Card>
                </Col>
            </Row>

            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={24} lg={8}>
                    <RankingCard
                        title="净收益 TOP"
                        type="income"
                        data={overview?.ranking?.incomeTop || []}
                    />
                </Col>
                <Col xs={24} lg={8}>
                    <RankingCard
                        title="接单 TOP"
                        type="orders"
                        data={overview?.ranking?.orderTop || []}
                    />
                </Col>
                <Col xs={24} lg={8}>
                    <RankingCard
                        title="提现 TOP"
                        type="withdraw"
                        data={overview?.ranking?.withdrawTop || []}
                    />
                </Col>
            </Row>

            <ProTable<TableRow>
                headerTitle="业绩列表"
                actionRef={actionRef}
                rowKey="userId"
                scroll={{ x: 2700 }}
                columns={columns}
                search={{
                    labelWidth: 'auto',
                }}
                pagination={{
                    pageSize: 20,
                }}
                request={async (params, sorter) => {
                    try {
                        const { current, pageSize, keyword } = params as any;
                        const sortField = Object.keys(sorter || {})?.[0];
                        const sortOrder = sortField ? (sorter as any)?.[sortField] : undefined;

                        const res = await getPerformanceDashboardList({
                            page: current ?? 1,
                            limit: pageSize ?? 20,
                            keyword,
                            ...queryParams,
                            sortField,
                            sortOrder,
                        });

                        return {
                            data: Array.isArray(res?.data) ? res.data : [],
                            success: true,
                            total: Number(res?.total || 0),
                        };
                    } catch (error) {
                        message.error('加载业绩列表失败');
                        return {
                            data: [],
                            success: false,
                            total: 0,
                        };
                    }
                }}
                toolBarRender={() => [
                    <Button
                        key="refresh"
                        onClick={() => {
                            loadOverview();
                            actionRef.current?.reload();
                        }}
                    >
                        刷新
                    </Button>,
                ]}
            />
        </PageContainer>
    );
}