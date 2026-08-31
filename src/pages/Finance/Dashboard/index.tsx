import React, { useEffect, useMemo, useState } from 'react';
import { Card, Col, DatePicker, Empty, Row, Space, Statistic, Table, Typography, Collapse } from 'antd';
import dayjs from 'dayjs';
import { postFinanceReconciliation } from '@/services/api';

const { RangePicker } = DatePicker;

const money = (v: any) => Number(v ?? 0).toFixed(2);
const chinaTime = (v: any) => v ? new Date(new Date(v).getTime() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ') : '--';
const today = () => dayjs(new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10));

const FinanceDashboardPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>({});
    const [filters, setFilters] = useState<any>({
        dateRange: [today().startOf('day'), today().endOf('day')],
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
        { title: '订单实收', dataIndex: 'paidAmountTotal', width: 140, render: (v: any) => `¥${money(v)}` },
    ];

    const detailColumns = [
        { title: '收款时间（北京）', dataIndex: 'paymentTime', width: 180, render: chinaTime },
        { title: '订单 / 充值编号', dataIndex: 'autoSerial', width: 200 },
        { title: '类型', dataIndex: 'receiptTypeLabel', width: 100 },
        { title: '渠道', dataIndex: 'channelLabel', width: 170 },
        { title: '交易金额', dataIndex: 'paidAmount', width: 120, render: (v: any) => `¥${money(v)}` },
        { title: '计入营收', dataIndex: 'cashAmount', width: 120, render: (v: any) => `¥${money(v)}` },
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
                        按北京时间实际收款日统计，补收不回补。营收含会员充值实收（不含赠送），储值消费不重复计入；金额为退款前收款。收钱吧包含线下订单与人工充值。
                    </Typography.Text>
                </Space>
            </Card>

            <Row gutter={[16, 16]}>
                <Col xs={12} lg={6}>
                    <Card loading={loading}>
                        <Statistic title="收款订单数（去重）" value={Number(summary.allOrderCount || 0)} />
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card loading={loading}>
                        <Statistic title="总营收（实收）" value={money(summary.allPaidAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card loading={loading}>
                        <Statistic title="收钱吧总额" value={money(summary.manualReceiptAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card loading={loading}>
                        <Statistic title={`会员充值实收 · ${Number(summary.rechargeCount || 0)} 笔`} value={money(summary.rechargeAmountTotal)} prefix="¥" />
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
                                    <Typography.Text type="secondary">充值实收 ¥{money(item.rechargeAmountTotal)}</Typography.Text>
                                    <Typography.Text type="secondary">收款订单 {Number(item.allOrderCount || 0)}</Typography.Text>
                                </Space>
                            ),
                            children: (
                                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title="收款订单数（去重）" value={Number(item.allOrderCount || 0)} /></Card>
                                        </Col>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title="总营收（实收）" value={money(item.allPaidAmountTotal)} prefix="¥" /></Card>
                                        </Col>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title="收钱吧总额" value={money(item.manualReceiptAmountTotal)} prefix="¥" /></Card>
                                        </Col>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title={`会员充值实收 · ${Number(item.rechargeCount || 0)} 笔`} value={money(item.rechargeAmountTotal)} prefix="¥" /></Card>
                                        </Col>
                                    </Row>

                                    <Card size="small" title="派单人汇总（收钱吧订单，不含充值）">
                                        <Table
                                            rowKey={(row: any) => `${row.dispatcherId ?? 'none'}-${row.dispatcherName}`}
                                            columns={dispatcherColumns as any}
                                            dataSource={Array.isArray(item.dispatcherItems) ? item.dispatcherItems : []}
                                            pagination={false}
                                            scroll={{ x: 560 }}
                                            size="small"
                                        />
                                    </Card>

                                    <Card size="small" title="对账单详细">
                                        <Table
                                            rowKey="receiptId"
                                            columns={detailColumns as any}
                                            dataSource={Array.isArray(item.detailRows) ? item.detailRows : []}
                                            pagination={false}
                                            scroll={{ x: 890 }}
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
