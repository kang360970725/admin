import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, DatePicker, Empty, Row, Space, Statistic, Table, Typography, Collapse, Tag } from 'antd';
import dayjs from 'dayjs';
import { postFinanceReconciliation } from '@/services/api';

const { RangePicker } = DatePicker;

const money = (v: any) => Number(v ?? 0).toFixed(2);
const chinaTime = (v: any) => v ? new Date(new Date(v).getTime() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ') : '--';
const today = () => dayjs(new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10));
const orderStatusText: Record<string, string> = {
    REFUNDED: '已退款', COMPLETED: '已结单', COMPLETED_PENDING_CONFIRM: '结单待确认',
    ARCHIVED: '已存单', CANCELLED: '已取消', WAIT_ASSIGN: '待派单', WAIT_ACCEPT: '待接单', ACCEPTED: '服务中',
};
const refundStatusText: Record<string, string> = {
    SUCCESS: '退款已完成', MANUAL_REQUIRED: '待人工退款', FAILED: '退款失败',
};

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
        { title: '收款时间（北京）', dataIndex: 'paymentTime', width: 180, fixed: 'left' as const, render: chinaTime },
        { title: '交易金额', dataIndex: 'paidAmount', width: 120, render: (v: any) => (
            <Typography.Text type={Number(v || 0) < 0 ? 'danger' : undefined} strong={Number(v || 0) < 0}>
                {Number(v || 0) < 0 ? '-' : ''}¥{money(Math.abs(Number(v || 0)))}
            </Typography.Text>
        ) },
        { title: '计入营收', dataIndex: 'cashAmount', width: 120, render: (v: any, row: any) => (
            <Typography.Text strong={Number(v || 0) > 0} type={row?.channel === 'BALANCE' ? 'secondary' : undefined}>
                ¥{money(v)}
            </Typography.Text>
        ) },
        { title: '派单客服', dataIndex: 'dispatcherLabel', width: 130 },
        { title: '订单 / 充值编号', dataIndex: 'autoSerial', width: 190 },
        { title: '订单状态', dataIndex: 'orderStatus', width: 120, render: (v: any) => v ? (orderStatusText[v] || v) : '--' },
        { title: '退款状态', dataIndex: 'refundStatus', width: 130, render: (v: any) => v ? (
            <Tag color={v === 'SUCCESS' ? 'red' : v === 'MANUAL_REQUIRED' ? 'orange' : 'default'}>{refundStatusText[v] || v}</Tag>
        ) : '--' },
        { title: '退款金额', dataIndex: 'refundAmount', width: 120, render: (v: any) => Number(v || 0) > 0 ? `¥${money(v)}` : '--' },
        { title: '商户支付单号', dataIndex: 'paymentNo', width: 220, render: (v: any) => v || '--' },
        { title: '收钱吧 / 微信单号', key: 'externalPaymentNo', width: 240, render: (_: any, row: any) => (
            row?.providerSn || row?.transactionId || row?.clientSn || (
                <Typography.Text type="warning">未绑定外部流水</Typography.Text>
            )
        ) },
        { title: '渠道', dataIndex: 'channelLabel', width: 160 },
        { title: '对账属性', dataIndex: 'reconciliationLabel', width: 150, render: (v: any, row: any) => (
            <Tag color={row?.reconciliationType === 'OFFLINE' ? 'orange' : row?.reconciliationType === 'ONLINE' ? 'green' : 'default'}>{v || '其他'}</Tag>
        ) },
        { title: '类型', dataIndex: 'receiptTypeLabel', width: 100 },
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
                        按北京时间实际收款日统计。现金实收用于核对收钱吧等外部到账；会员储值消费单独展示，不重复计入现金实收。
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
                        <Statistic title="现金收款（退款前）" value={money(summary.grossCashReceiptAmountTotal)} prefix="¥" />
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
                <Col xs={12} lg={6}>
                    <Card loading={loading}>
                        <Statistic title="会员储值消费" value={money(summary.memberBalanceAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card loading={loading}>
                        <Statistic title="订单消费总额" value={money(summary.orderPaidAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card loading={loading}>
                        <Statistic title={`会员充值实收 · ${Number(summary.rechargeCount || 0)} 笔`} value={money(summary.rechargeAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card loading={loading}>
                        <Statistic title={`已完成退款（现金+储值）· ${Number(summary.refundCount || 0)} 笔`} value={money(summary.refundAmountTotal)} prefix="¥" valueStyle={{ color: Number(summary.refundAmountTotal || 0) > 0 ? '#cf1322' : undefined }} />
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card loading={loading}>
                        <Statistic title="净现金实收" value={money(summary.allPaidAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
            </Row>

            <Card title="线下收款统计（需人工与实际到账核对）" style={{ marginTop: 16 }} loading={loading}>
                <Alert
                    type="warning"
                    showIcon
                    message="这里展示客服人工登记的线下收款，不代表收钱吧已自动验证到账。没有收钱吧/微信单号的记录只能按时间、金额、订单号和客服人工核对。"
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
                                    <Typography.Text type="secondary">储值消费 ¥{money(item.memberBalanceAmountTotal)}</Typography.Text>
                                    <Typography.Text type="secondary">订单消费 ¥{money(item.orderPaidAmountTotal)}</Typography.Text>
                                    <Typography.Text type="secondary">充值实收 ¥{money(item.rechargeAmountTotal)}</Typography.Text>
                                    <Typography.Text type="danger">退款 -¥{money(item.refundAmountTotal)}</Typography.Text>
                                    <Typography.Text strong>净现金 ¥{money(item.allPaidAmountTotal)}</Typography.Text>
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
                                            <Card size="small"><Statistic title="现金收款（退款前）" value={money(item.grossCashReceiptAmountTotal)} prefix="¥" /></Card>
                                        </Col>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title="线上自动验证" value={money(item.onlineReceiptAmountTotal)} prefix="¥" /></Card>
                                        </Col>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title={`线下登记 · ${Number(item.offlineReceiptOrderCount || 0)} 笔`} value={money(item.offlineReceiptAmountTotal)} prefix="¥" valueStyle={{ color: Number(item.offlineReceiptAmountTotal || 0) > 0 ? '#d46b08' : undefined }} /></Card>
                                        </Col>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title="会员储值消费" value={money(item.memberBalanceAmountTotal)} prefix="¥" /></Card>
                                        </Col>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title="订单消费总额" value={money(item.orderPaidAmountTotal)} prefix="¥" /></Card>
                                        </Col>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title={`会员充值实收 · ${Number(item.rechargeCount || 0)} 笔`} value={money(item.rechargeAmountTotal)} prefix="¥" /></Card>
                                        </Col>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title={`已完成退款（现金+储值）· ${Number(item.refundCount || 0)} 笔`} value={money(item.refundAmountTotal)} prefix="¥" valueStyle={{ color: Number(item.refundAmountTotal || 0) > 0 ? '#cf1322' : undefined }} /></Card>
                                        </Col>
                                        <Col xs={24} sm={12} lg={6}>
                                            <Card size="small"><Statistic title="净现金实收" value={money(item.allPaidAmountTotal)} prefix="¥" /></Card>
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
                                            scroll={{ x: 2200 }}
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
                                            scroll={{ x: 2200 }}
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
