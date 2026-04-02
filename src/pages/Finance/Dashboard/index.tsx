import React, { useEffect, useMemo, useState } from 'react';
import { Card, Col, DatePicker, Empty, Row, Select, Space, Statistic, Table, Typography } from 'antd';
import { Line, Pie } from '@ant-design/charts';
import dayjs from 'dayjs';
import {
    postFinanceDashboardSummary,
    postFinanceDashboardTrend,
    postFinanceDashboardCostStructure,
} from '@/services/api';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const money = (v: any) => Number(v ?? 0).toFixed(2);

const FinanceDashboardPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<any>({});
    const [trend, setTrend] = useState<any[]>([]);
    const [costItems, setCostItems] = useState<any[]>([]);

    const [filters, setFilters] = useState<any>({
        dateRange: [dayjs().startOf('month'), dayjs().endOf('month')],
        trendGroupBy: 'DAY',
        billingMode: undefined,
        orderType: undefined,
        projectId: undefined,
        bizLine: undefined,
    });

    const requestParams = useMemo(() => {
        const [start, end] = filters.dateRange || [];
        return {
            startDate: start ? dayjs(start).format('YYYY-MM-DD') : undefined,
            endDate: end ? dayjs(end).format('YYYY-MM-DD') : undefined,
            billingMode: filters.billingMode,
            orderType: filters.orderType,
            projectId: filters.projectId,
            bizLine: filters.bizLine,
        };
    }, [filters]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [summaryRes, trendRes, costRes] = await Promise.all([
                postFinanceDashboardSummary(requestParams),
                postFinanceDashboardTrend({
                    ...requestParams,
                    groupBy: filters.trendGroupBy,
                }),
                postFinanceDashboardCostStructure(requestParams),
            ]);

            setSummary(summaryRes?.data || {});
            setTrend(trendRes?.data || []);
            setCostItems(costRes?.data?.items || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [requestParams, filters.trendGroupBy]);

    const trendData = useMemo(() => {
        const result: any[] = [];
        (trend || []).forEach((item: any) => {
            result.push({
                axis: item.axis,
                type: '实付营收',
                value: Number(item.paidAmountTotal || 0),
            });
            result.push({
                axis: item.axis,
                type: '订单总支出',
                value: Number(item.orderTotalCost || 0),
            });
            result.push({
                axis: item.axis,
                type: '毛利润',
                value: Number(item.grossProfitAmountTotal || 0),
            });
        });
        return result;
    }, [trend]);

    const costPieData = useMemo(() => {
        return (costItems || []).map((item: any) => ({
            type: item.name,
            value: Number(item.amount || 0),
        }));
    }, [costItems]);

    const dimensionColumns = [
        {
            title: '周期',
            dataIndex: 'axis',
            width: 140,
        },
        {
            title: '实付营收',
            dataIndex: 'paidAmountTotal',
            render: (v: any) => `¥${money(v)}`,
        },
        {
            title: '订单总支出',
            dataIndex: 'orderTotalCost',
            render: (v: any) => `¥${money(v)}`,
        },
        {
            title: '毛利润',
            dataIndex: 'grossProfitAmountTotal',
            render: (v: any) => `¥${money(v)}`,
        },
        {
            title: '订单数',
            dataIndex: 'orderCount',
        },
    ];

    return (
        <div>
            <Card style={{ marginBottom: 16 }}>
                <Space wrap>
                    <RangePicker
                        value={filters.dateRange}
                        onChange={(val) => setFilters((prev: any) => ({ ...prev, dateRange: val }))}
                    />

                    <Select
                        style={{ width: 140 }}
                        placeholder="趋势粒度"
                        value={filters.trendGroupBy}
                        onChange={(val) => setFilters((prev: any) => ({ ...prev, trendGroupBy: val }))}
                        options={[
                            { label: '按日', value: 'DAY' },
                            { label: '按月', value: 'MONTH' },
                        ]}
                    />

                    <Select
                        allowClear
                        style={{ width: 140 }}
                        placeholder="计费模式"
                        value={filters.billingMode}
                        onChange={(val) => setFilters((prev: any) => ({ ...prev, billingMode: val }))}
                        options={[
                            { label: '小时单', value: 'HOURLY' },
                            { label: '保底单', value: 'GUARANTEED' },
                            { label: '玩法单', value: 'MODE_PLAY' },
                        ]}
                    />

                    <Select
                        allowClear
                        style={{ width: 160 }}
                        placeholder="订单类型"
                        value={filters.orderType}
                        onChange={(val) => setFilters((prev: any) => ({ ...prev, orderType: val }))}
                        options={[
                            { label: '体验单', value: 'EXPERIENCE' },
                            { label: '娱乐单', value: 'FUN' },
                            { label: '护航单', value: 'ESCORT' },
                            { label: '福袋单', value: 'LUCKY_BAG' },
                            { label: '盲盒单', value: 'BLIND_BOX' },
                            { label: '自定义单', value: 'CUSTOM' },
                            { label: '定制单', value: 'CUSTOMIZED' },
                        ]}
                    />
                </Space>
            </Card>

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Card loading={loading}>
                        <Statistic title="原价GMV" value={money(summary.receivableAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Card loading={loading}>
                        <Statistic title="实付营收" value={money(summary.paidAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Card loading={loading}>
                        <Statistic title="订单总支出" value={money(summary.orderTotalCost)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Card loading={loading}>
                        <Statistic title="毛利润" value={money(summary.grossProfitAmountTotal)} prefix="¥" />
                    </Card>
                </Col>

                <Col xs={24} sm={12} md={8} lg={6}>
                    <Card loading={loading}>
                        <Statistic title="毛利率" value={money(summary.grossProfitRate)} suffix="%" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Card loading={loading}>
                        <Statistic title="营销成本" value={money(summary.marketingCostTotal)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Card loading={loading}>
                        <Statistic title="售后成本" value={money(summary.afterSaleCostAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Card loading={loading}>
                        <Statistic title="赔付成本" value={money(summary.complaintPenaltyAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                    <Card title="财务趋势">
                        {trendData.length ? (
                            <Line
                                data={trendData}
                                xField="axis"
                                yField="value"
                                seriesField="type"
                                smooth
                                autoFit
                            />
                        ) : (
                            <Empty description="暂无趋势数据" />
                        )}
                    </Card>
                </Col>

                <Col xs={24} lg={10}>
                    <Card title="成本结构占比">
                        {costPieData.length ? (
                            <Pie
                                data={costPieData}
                                angleField="value"
                                colorField="type"
                                label={{
                                    type: 'outer',
                                    content: '{name} {percentage}',
                                }}
                                legend={{ position: 'bottom' }}
                            />
                        ) : (
                            <Empty description="暂无成本数据" />
                        )}
                    </Card>
                </Col>

                <Col xs={24} lg={14}>
                    <Card title="趋势明细">
                        <Table
                            rowKey="axis"
                            loading={loading}
                            dataSource={trend}
                            columns={dimensionColumns}
                            pagination={false}
                            size="small"
                            scroll={{ x: 800 }}
                        />
                    </Card>
                </Col>
            </Row>

            <Card title="当前口径说明" style={{ marginTop: 16 }}>
                <Space direction="vertical">
                    <Text>原价GMV = receivableAmount 汇总</Text>
                    <Text>实付营收 = paidAmount 汇总</Text>
                    <Text>订单总支出 = 履约成本 + 营销成本 + 售后成本 + 赔付成本</Text>
                    <Text>毛利润 = grossProfitAmount 汇总</Text>
                    <Text>毛利率 = 毛利润 / 实付营收</Text>
                    <Text type="secondary">后续接入人工支出流水后：净利润 = 毛利润 - 手动支出</Text>
                </Space>
            </Card>
        </div>
    );
};

export default FinanceDashboardPage;