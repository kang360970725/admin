import React, { useEffect, useMemo, useState } from 'react';
import { Card, Col, DatePicker, Empty, Row, Space, Statistic, Table, Typography, Collapse } from 'antd';
import dayjs from 'dayjs';
import { postFinanceReconciliation } from '@/services/api';

const { RangePicker } = DatePicker;

const money = (v: any) => Number(v ?? 0).toFixed(2);

const FinanceDashboardPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>({});
    const [filters, setFilters] = useState<any>({
        dateRange: [dayjs().startOf('day'), dayjs().endOf('day')],
    });

    const requestParams = useMemo(() => {
        const [start, end] = filters.dateRange || [];
        return {
            startDate: start ? dayjs(start).format('YYYY-MM-DD') : undefined,
            endDate: end ? dayjs(end).format('YYYY-MM-DD') : undefined,
        };
    }, [filters.dateRange]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await postFinanceReconciliation(requestParams);
            setData(res?.data || {});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestParams.startDate, requestParams.endDate]);

    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const summary = data?.summary || {};

    const dispatcherColumns = [
        { title: '派单人', dataIndex: 'dispatcherLabel', width: 200 },
        { title: '角色', dataIndex: 'dispatcherUserType', width: 120, render: (v: any) => v || '--' },
        { title: '总数量', dataIndex: 'orderCount', width: 100 },
        { title: '总营收', dataIndex: 'paidAmountTotal', width: 140, render: (v: any) => `¥${money(v)}` },
    ];

    const detailColumns = [
        { title: '时间', dataIndex: 'paymentTime', width: 200, render: (v: any) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '--') },
        { title: '收款金额', dataIndex: 'paidAmount', width: 160, render: (v: any) => `¥${money(v)}` },
    ];

    return (
        <div>
            <Card style={{ marginBottom: 16 }} loading={loading}>
                <Space wrap align="center">
                    <RangePicker
                        value={filters.dateRange}
                        onChange={(val) => setFilters((prev: any) => ({ ...prev, dateRange: val }))}
                    />
                    <Typography.Text type="secondary">
                        统计按付款时间计算。小程序自助单不纳入对账单明细。
                    </Typography.Text>
                </Space>
            </Card>

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={8}>
                    <Card loading={loading}>
                        <Statistic title="总订单数" value={Number(summary.allOrderCount || 0)} />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <Card loading={loading}>
                        <Statistic title="总营收" value={money(summary.allPaidAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <Card loading={loading}>
                        <Statistic title="收钱吧总额" value={money(summary.manualReceiptAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
            </Row>

            <Card title="按日对账单" style={{ marginTop: 16 }} loading={loading}>
                {rows.length ? (
                    <Collapse
                        accordion
                        items={rows.map((item: any) => ({
                            key: item.axis,
                            label: (
                                <Space wrap>
                                    <Typography.Text strong>{item.axis}</Typography.Text>
                                    <Typography.Text type="secondary">收钱吧总额 ¥{money(item.manualReceiptAmountTotal)}</Typography.Text>
                                    <Typography.Text type="secondary">总订单 {Number(item.allOrderCount || 0)}</Typography.Text>
                                </Space>
                            ),
                            children: (
                                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title="总订单数" value={Number(item.allOrderCount || 0)} /></Card>
                                        </Col>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title="总营收" value={money(item.allPaidAmountTotal)} prefix="¥" /></Card>
                                        </Col>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title="收钱吧总额" value={money(item.manualReceiptAmountTotal)} prefix="¥" /></Card>
                                        </Col>
                                    </Row>

                                    <Card size="small" title="派单人汇总">
                                        <Table
                                            rowKey={(row: any) => `${row.dispatcherId ?? 'none'}-${row.dispatcherName}`}
                                            columns={dispatcherColumns as any}
                                            dataSource={Array.isArray(item.dispatcherItems) ? item.dispatcherItems : []}
                                            pagination={false}
                                            size="small"
                                        />
                                    </Card>

                                    <Card size="small" title="对账单详细">
                                        <Table
                                            rowKey={(row: any) => `${row.orderId}-${row.paymentTime}`}
                                            columns={detailColumns as any}
                                            dataSource={Array.isArray(item.detailRows) ? item.detailRows : []}
                                            pagination={false}
                                            size="small"
                                        />
                                    </Card>
                                </Space>
                            ),
                        }))}
                    />
                ) : (
                    <Empty description="暂无对账数据" />
                )}
            </Card>
        </div>
    );
};

export default FinanceDashboardPage;
