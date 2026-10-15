import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, DatePicker, Empty, Row, Space, Statistic, Table, Typography, Collapse, Tag } from 'antd';
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

    const offlineDispatcherRows = useMemo(() => {
        const grouped = new Map<string, any>();
        rows.forEach((day: any) => (day?.offlineDispatcherItems || []).forEach((item: any) => {
            const key = String(item?.dispatcherId ?? `name:${item?.dispatcherName || 'none'}`);
            const current = grouped.get(key) || { ...item, orderCount: 0, paidAmountTotal: 0 };
            current.orderCount += Number(item?.orderCount || 0);
            current.paidAmountTotal += Number(item?.paidAmountTotal || 0);
            grouped.set(key, current);
        }));
        return Array.from(grouped.values()).sort((a, b) => b.paidAmountTotal - a.paidAmountTotal);
    }, [rows]);

    const dispatcherColumns = [
        { title: '派单人', dataIndex: 'dispatcherLabel', width: 200 },
        { title: '角色', dataIndex: 'dispatcherUserType', width: 120, render: (v: any) => v || '--' },
        { title: '总数量', dataIndex: 'orderCount', width: 100 },
        { title: '订单实收', dataIndex: 'paidAmountTotal', width: 140, render: (v: any) => `¥${money(v)}` },
    ];

    const detailColumns = [
        { title: '收款时间（北京）', dataIndex: 'paymentTime', width: 180, render: chinaTime },
        { title: '订单 / 充值编号', dataIndex: 'autoSerial', width: 200 },
        { title: '派单客服', dataIndex: 'dispatcherLabel', width: 120 },
        { title: '类型', dataIndex: 'receiptTypeLabel', width: 100 },
        { title: '渠道', dataIndex: 'channelLabel', width: 170 },
        { title: '对账属性', dataIndex: 'reconciliationLabel', width: 140, render: (v: any, row: any) => (
            <Tag color={row?.reconciliationType === 'OFFLINE' ? 'orange' : row?.reconciliationType === 'ONLINE' ? 'green' : 'default'}>{v || '其他'}</Tag>
        ) },
        { title: '交易金额', dataIndex: 'paidAmount', width: 120, render: (v: any) => `¥${money(v)}` },
        { title: '计入营收', dataIndex: 'cashAmount', width: 120, render: (v: any) => `¥${money(v)}` },
        { title: '操作', dataIndex: 'orderId', width: 90, fixed: 'right' as const, render: (orderId: any) => orderId ? (
            <Typography.Link href={`/orders/${orderId}`} target="_blank">查看订单</Typography.Link>
        ) : '--' },
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
                        按北京时间实际收款日统计。收钱吧在线支付由系统验证；人工确认的线下收款单独列出，供财务与实际到账流水核对。
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
                        <Statistic title={`线上自动验证 · ${Number(summary.onlineReceiptOrderCount || 0)} 笔`} value={money(summary.onlineReceiptAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card loading={loading}>
                        <Statistic title={`线下登记收款 · ${Number(summary.offlineReceiptOrderCount || 0)} 笔`} value={money(summary.offlineReceiptAmountTotal)} prefix="¥" valueStyle={{ color: Number(summary.offlineReceiptAmountTotal || 0) > 0 ? '#d46b08' : undefined }} />
                    </Card>
                </Col>
            </Row>

            <Card title="线下收款统计（需人工与实际到账核对）" style={{ marginTop: 16 }} loading={loading}>
                <Alert
                    type="warning"
                    showIcon
                    message="这里展示客服人工登记的线下收款，不代表第三方支付平台已自动验证到账。发现账目差异后，应及时检查对应订单和登记客服。"
                    style={{ marginBottom: 16 }}
                />
                <Table
                    rowKey={(row: any) => `${row.dispatcherId ?? 'none'}-${row.dispatcherName}`}
                    columns={dispatcherColumns as any}
                    dataSource={offlineDispatcherRows}
                    pagination={false}
                    scroll={{ x: 560 }}
                    size="small"
                    locale={{ emptyText: '所选时间内没有线下收款' }}
                />
            </Card>

            <Card title="按日对账单" style={{ marginTop: 16 }} loading={loading}>
                {rows.length ? (
                    <Collapse
                        accordion
                        items={rows.map((item: any) => ({
                            key: item.axis,
                            label: (
                                <Space wrap>
                                    <Typography.Text strong>{item.axis}</Typography.Text>
                                    <Typography.Text type="secondary">线上 ¥{money(item.onlineReceiptAmountTotal)}</Typography.Text>
                                    <Typography.Text type="warning">线下 ¥{money(item.offlineReceiptAmountTotal)}</Typography.Text>
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
                                            <Card size="small"><Statistic title="线上自动验证" value={money(item.onlineReceiptAmountTotal)} prefix="¥" /></Card>
                                        </Col>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title={`线下登记 · ${Number(item.offlineReceiptOrderCount || 0)} 笔`} value={money(item.offlineReceiptAmountTotal)} prefix="¥" valueStyle={{ color: Number(item.offlineReceiptAmountTotal || 0) > 0 ? '#d46b08' : undefined }} /></Card>
                                        </Col>
                                    </Row>

                                    <Card size="small" title="线下收款按客服汇总">
                                        <Table
                                            rowKey={(row: any) => `${row.dispatcherId ?? 'none'}-${row.dispatcherName}`}
                                            columns={dispatcherColumns as any}
                                            dataSource={Array.isArray(item.offlineDispatcherItems) ? item.offlineDispatcherItems : []}
                                            pagination={false}
                                            scroll={{ x: 560 }}
                                            size="small"
                                        />
                                    </Card>

                                    <Card size="small" title="线下收款逐笔流水">
                                        <Table
                                            rowKey="receiptId"
                                            columns={detailColumns as any}
                                            dataSource={(Array.isArray(item.detailRows) ? item.detailRows : []).filter((row: any) => row?.reconciliationType === 'OFFLINE')}
                                            pagination={false}
                                            scroll={{ x: 1130 }}
                                            size="small"
                                            locale={{ emptyText: '当日没有线下收款' }}
                                        />
                                    </Card>

                                    <Card size="small" title="对账单详细">
                                        <Table
                                            rowKey="receiptId"
                                            columns={detailColumns as any}
                                            dataSource={Array.isArray(item.detailRows) ? item.detailRows : []}
                                            pagination={false}
                                            scroll={{ x: 1130 }}
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
