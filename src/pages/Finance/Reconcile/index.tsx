import * as React from 'react';
import { PageContainer, ProTable, ProColumns } from '@ant-design/pro-components';
import {
    Button,
    Card,
    Col,
    DatePicker,
    Descriptions,
    Drawer,
    Form,
    Input,
    InputNumber,
    Row,
    Space,
    Statistic,
    Switch,
    Tag,
    Typography,
    message,
} from 'antd';
import dayjs from 'dayjs';
import type { FormInstance } from 'antd';
import {
    financeReconcileOrderDetail,
    financeReconcileOrders,
    financeReconcileSummary,
    getEnumDicts,
} from '@/services/api';

const { Text } = Typography;

type OrdersResp = {
    page: number;
    pageSize: number;
    total: number;
    rows: any[];
};

const money = (v: any) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return Number(v) || 0;
    if (typeof v?.toNumber === 'function') return v.toNumber();
    return Number(v) || 0;
};

const formatRate = (rate: any) => `${Math.round(money(rate) * 10000) / 100}%`;

const FinanceReconcilePage: React.FC = () => {
    const formRef = React.useRef<FormInstance>();
    const [loadingSummary, setLoadingSummary] = React.useState(false);
    const [summary, setSummary] = React.useState<any>(null);

    const [enums, setEnums] = React.useState<any>({});
    const [detailOpen, setDetailOpen] = React.useState(false);
    const [detailLoading, setDetailLoading] = React.useState(false);
    const [detail, setDetail] = React.useState<any>(null);

    const defaultRange = React.useMemo(() => {
        const start = dayjs().subtract(7, 'day').startOf('day');
        const end = dayjs().endOf('day');
        return [start, end];
    }, []);

    React.useEffect(() => {
        (async () => {
            try {
                const dicts = await getEnumDicts();
                setEnums(dicts || {});
            } catch (e: any) {
                message.warning(e?.message || '加载字典失败');
            }
        })();
    }, []);

    const getEnumText = (groupKey: string, code?: string) => {
        if (!code) return '--';
        const dict = enums?.[groupKey] || {};
        return dict?.[code] || code;
    };

    // 钱包页同款风格：方向符号+颜色
    const directionMetaMap: Record<string, { color: string; icon: React.ReactNode }> = {
        IN: { color: 'green', icon: <span style={{ fontWeight: 700 }}>↑</span> },
        OUT: { color: 'red', icon: <span style={{ fontWeight: 700 }}>↓</span> },
    };

    const bizTypeColorMap: Record<string, string> = {
        SETTLEMENT_EARNING: 'green',
        SETTLEMENT_EARNING_BASE: 'green',
        SETTLEMENT_EARNING_CARRY: 'geekblue',
        SETTLEMENT_BOMB_LOSS: 'red',
        SETTLEMENT_EARNING_CS: 'orange',
        RELEASE_FROZEN: 'blue',
        REFUND_REVERSAL: 'volcano',
        WITHDRAW_RESERVE: 'purple',
        WITHDRAW_RELEASE: 'cyan',
        WITHDRAW_PAYOUT: 'magenta',
    };

    const fetchSummary = async (values: any) => {
        const range = values?.paymentRange;
        if (!range || range.length !== 2) return;

        const startAt = dayjs(range[0]).toISOString();
        const endAt = dayjs(range[1]).toISOString();

        setLoadingSummary(true);
        try {
            const res = await financeReconcileSummary({
                startAt,
                endAt,
                includeGifted: Boolean(values?.includeGifted),
            });
            setSummary(res);
        } catch (e: any) {
            message.error(e?.message || '加载核账总览失败');
            setSummary(null);
        } finally {
            setLoadingSummary(false);
        }
    };

    const openOrderDetail = async (row: any) => {
        const orderId = row?.orderId;
        if (!orderId) return;

        setDetailOpen(true);
        setDetailLoading(true);
        setDetail(null);

        try {
            const res = await financeReconcileOrderDetail({ orderId });
            setDetail(res);
        } catch (e: any) {
            message.error(e?.message || '加载订单抽查详情失败');
        } finally {
            setDetailLoading(false);
        }
    };

    const columns: ProColumns<any>[] = [
        {
            title: '订单',
            dataIndex: 'autoSerial',
            width: 180,
            render: (_, row) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{row.autoSerial || '-'}</Text>
                    <Text type="secondary">ID: {row.orderId}</Text>
                </Space>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 110,
            render: (_, row) => <Tag>{getEnumText('OrderStatus', row?.status)}</Tag>,
        },
        { title: '收款时间', dataIndex: 'paymentTime', width: 170, valueType: 'dateTime' },
        {
            title: '收入(实收)',
            dataIndex: ['income', 'paidAmount'],
            width: 120,
            render: (_, row) => <Text>{money(row?.income?.paidAmount)}</Text>,
        },
        {
            title: '参与成员打手',
            dataIndex: 'participants',
            ellipsis: true,
            render: (_, row) => {
                const list = Array.isArray(row?.participants) ? row.participants : [];
                if (list.length === 0) return '-';
                return (
                    <Space wrap>
                        {list.map((p: any) => (
                            <Tag key={p.userId}>
                                {p.name}（{formatRate(p.rate)}）- {money(p.earnings)}
                            </Tag>
                        ))}
                    </Space>
                );
            },
        },
        { title: '客服抽成', dataIndex: 'csExpense', width: 110, render: (_, row) => <Text>{money(row?.csExpense)}</Text> },
        { title: '累计支出', dataIndex: 'totalExpense', width: 110, render: (_, row) => <Text>{money(row?.totalExpense)}</Text> },
        {
            title: '余(毛利)',
            dataIndex: 'profit',
            width: 110,
            render: (_, row) => {
                const v = money(row?.profit);
                return <Text type={v < 0 ? 'danger' : undefined}>{v}</Text>;
            },
        },
        {
            title: '退款完成',
            dataIndex: ['refund', 'refundCompleted'],
            width: 110,
            render: (_, row) => {
                const isRefunded = Boolean(row?.refund?.isRefunded);
                const ok = Boolean(row?.refund?.refundCompleted);
                if (!isRefunded) return <Tag>未退款</Tag>;
                return ok ? <Tag color="green">已冲正</Tag> : <Tag color="red">未冲正</Tag>;
            },
        },
        {
            title: '异常',
            dataIndex: ['abnormal', 'isAbnormal'],
            width: 90,
            render: (_, row) => (row?.abnormal?.isAbnormal ? <Tag color="red">异常</Tag> : <Tag>正常</Tag>),
        },
        {
            title: '操作',
            valueType: 'option',
            width: 110,
            render: (_, row) => [<a key="detail" onClick={() => openOrderDetail(row)}>抽查</a>],
        },
    ];

    return (
        <PageContainer title="财务核账" subTitle="按收款时间(paymentTime)统计：实收=isPaid=true 的 paidAmount；退款完成必须存在冲正流水">
            <Card style={{ marginBottom: 12 }}>
                <Form
                    ref={formRef as any}
                    layout="inline"
                    initialValues={{
                        paymentRange: defaultRange,
                        includeGifted: false,
                        onlyAbnormal: false,
                    }}
                    onFinish={async (values) => {
                        await fetchSummary(values);
                    }}
                >
                    <Form.Item name="paymentRange" label="收款时间" rules={[{ required: true, message: '请选择收款时间范围' }]}>
                        <DatePicker.RangePicker showTime allowClear={false} />
                    </Form.Item>

                    <Form.Item name="autoSerial" label="订单号">
                        <Input placeholder="autoSerial 精确匹配" allowClear style={{ width: 220 }} />
                    </Form.Item>

                    <Form.Item name="playerId" label="打手ID">
                        <InputNumber placeholder="参与打手 userId" min={1} style={{ width: 160 }} />
                    </Form.Item>

                    <Form.Item name="includeGifted" label="含赠送单" valuePropName="checked">
                        <Switch />
                    </Form.Item>

                    <Form.Item name="onlyAbnormal" label="仅异常" valuePropName="checked">
                        <Switch />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" onClick={() => formRef.current?.submit?.()} loading={loadingSummary}>
                                查询
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>

            <Row gutter={12} style={{ marginBottom: 12 }}>
                <Col span={6}>
                    <Card loading={loadingSummary}>
                        <Statistic title="收入(实收)" value={money(summary?.income?.totalIncome)} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card loading={loadingSummary}>
                        <Statistic title="累计支出" value={money(summary?.expense?.totalExpense)} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card loading={loadingSummary}>
                        <Statistic title="净额(实收-支出)" value={money(summary?.net?.net)} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card loading={loadingSummary}>
                        <Statistic title="退款未完成(未冲正)" value={money(summary?.refund?.refundPendingCount)} />
                    </Card>
                </Col>
            </Row>

            <ProTable<any>
                rowKey="orderId"
                columns={columns}
                search={false}
                pagination={{ pageSize: 20 }}
                request={async (params) => {
                    const values = formRef.current?.getFieldsValue?.() || {};
                    const range = values?.paymentRange;
                    if (!range || range.length !== 2) return { data: [], success: true, total: 0 };

                    const startAt = dayjs(range[0]).toISOString();
                    const endAt = dayjs(range[1]).toISOString();

                    try {
                        const res: OrdersResp = await financeReconcileOrders({
                            startAt,
                            endAt,
                            page: Number(params?.current ?? 1),
                            pageSize: Number(params?.pageSize ?? 20),
                            autoSerial: values?.autoSerial || undefined,
                            playerId: values?.playerId ? Number(values.playerId) : undefined,
                            includeGifted: Boolean(values?.includeGifted),
                            onlyAbnormal: Boolean(values?.onlyAbnormal),
                        });

                        return { data: res?.rows || [], success: true, total: res?.total || 0 };
                    } catch (e: any) {
                        message.error(e?.message || '加载订单核账明细失败');
                        return { data: [], success: false, total: 0 };
                    }
                }}
            />

            <Drawer open={detailOpen} title="订单抽查详情" width={980} onClose={() => setDetailOpen(false)} destroyOnClose>
                {detailLoading ? (
                    <Card loading />
                ) : !detail ? (
                    <Text type="secondary">暂无数据</Text>
                ) : (
                    <>
                        <Descriptions bordered size="small" column={2} style={{ marginBottom: 12 }}>
                            <Descriptions.Item label="订单号">{detail?.order?.autoSerial}</Descriptions.Item>
                            <Descriptions.Item label="订单ID">{detail?.order?.id}</Descriptions.Item>
                            <Descriptions.Item label="状态">
                                <Tag>{getEnumText('OrderStatus', detail?.order?.status)}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="收款时间">
                                {detail?.order?.paymentTime ? dayjs(detail.order.paymentTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="实收(paidAmount)">{money(detail?.order?.paidAmount)}</Descriptions.Item>
                            <Descriptions.Item label="累计支出">{money(detail?.stats?.totalExpense)}</Descriptions.Item>
                            <Descriptions.Item label="余(毛利)">{money(detail?.stats?.profit)}</Descriptions.Item>
                            <Descriptions.Item label="退款完成">
                                {detail?.stats?.refund?.isRefunded ? (
                                    detail?.stats?.refund?.refundCompleted ? <Tag color="green">已冲正</Tag> : <Tag color="red">未冲正</Tag>
                                ) : (
                                    <Tag>未退款</Tag>
                                )}
                            </Descriptions.Item>
                        </Descriptions>

                        <Card title="结算明细（应得）" size="small" style={{ marginBottom: 12 }}>
                            <ProTable
                                rowKey="id"
                                search={false}
                                options={false}
                                pagination={false}
                                dataSource={detail?.settlements || []}
                                columns={[
                                    {
                                        title: '参与者',
                                        dataIndex: ['user', 'name'],
                                        render: (_, r) => `${r?.user?.name || '-'}（${formatRate(r?.user?.rate)}）`,
                                    },
                                    { title: '结算类型', dataIndex: 'settlementType' },
                                    { title: '批次', dataIndex: 'settlementBatchId' },
                                    { title: '打手收益', dataIndex: 'finalEarnings', render: (_, r) => money(r?.finalEarnings) },
                                    { title: '客服分红', dataIndex: 'csEarnings', render: (_, r) => money(r?.csEarnings) },
                                    { title: '结算时间', dataIndex: 'settledAt', valueType: 'dateTime' },
                                    {
                                        title: '状态',
                                        dataIndex: 'paymentStatus',
                                        render: (_, r) => <Tag>{getEnumText('PaymentStatus', r?.paymentStatus)}</Tag>,
                                    },
                                ]}
                            />
                        </Card>

                        <Card title="钱包流水（实入账/冲正证据）" size="small">
                            <ProTable
                                rowKey="id"
                                search={false}
                                options={false}
                                pagination={{ pageSize: 10 }}
                                dataSource={detail?.walletTransactions || []}
                                columns={[
                                    { title: 'TxID', dataIndex: 'id', width: 80 },
                                    { title: '用户ID', dataIndex: 'userId', width: 90 },
                                    {
                                        title: '流向',
                                        dataIndex: 'direction',
                                        width: 90,
                                        render: (_, r) => {
                                            const meta = directionMetaMap[r?.direction];
                                            const label = getEnumText('WalletDirection', r?.direction);
                                            if (!meta) return <Tag>{label}</Tag>;
                                            return (
                                                <Tag color={meta.color}>
                                                    {meta.icon} {label}
                                                </Tag>
                                            );
                                        },
                                    },
                                    {
                                        title: '类型',
                                        dataIndex: 'bizType',
                                        width: 160,
                                        render: (_, r) => {
                                            const label = getEnumText('WalletBizType', r?.bizType);
                                            const color = bizTypeColorMap[r?.bizType] ?? 'default';
                                            return <Tag color={color}>{label}</Tag>;
                                        },
                                    },
                                    {
                                        title: '金额',
                                        dataIndex: 'amount',
                                        width: 120,
                                        align: 'right',
                                        render: (v, r) => {
                                            const isIn = r?.direction === 'IN';
                                            const n = Number(v ?? 0);
                                            return (
                                                <span style={{ color: isIn ? '#52c41a' : '#ff4d4f', fontWeight: 500 }}>
                          {isIn ? '+' : '-'}
                                                    {Number.isFinite(n) ? n.toFixed(1) : '0.0'}
                        </span>
                                            );
                                        },
                                    },
                                    {
                                        title: '状态',
                                        dataIndex: 'status',
                                        width: 110,
                                        render: (_, r) => <Tag>{getEnumText('WalletTxStatus', r?.status)}</Tag>,
                                    },
                                    {
                                        title: '冲正链路',
                                        dataIndex: 'reversalOfTxId',
                                        width: 140,
                                        render: (_, r) => (r?.reversalOfTxId ? <Tag color="green">reversalOf:{r.reversalOfTxId}</Tag> : '-'),
                                    },
                                    { title: '发生时间', dataIndex: 'createdAt', valueType: 'dateTime', width: 160 },
                                ]}
                            />
                        </Card>
                    </>
                )}
            </Drawer>
        </PageContainer>
    );
};

export default FinanceReconcilePage;
