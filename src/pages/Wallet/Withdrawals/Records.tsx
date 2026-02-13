import React, { useMemo, useRef, useState } from 'react';
import { Tag, Space, Typography, Card, Statistic, Row, Col } from 'antd';
import type { ActionType, ProFormInstance } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { postWithdrawalsList, type WalletWithdrawalRequest } from '@/services/api';
import dayjs from 'dayjs';

const { Text } = Typography;

const renderChannelTag = (ch: any) => {
    if (ch === 'WECHAT') return <Tag color="green">微信</Tag>;
    if (ch === 'ALIPAY') return <Tag color="blue">支付宝</Tag>;
    return <Tag color="gold">人工</Tag>;
};

const renderStatusTag = (s: any) => {
    if (s === 'PENDING_REVIEW') return <Tag color="processing">待审核</Tag>;
    if (s === 'APPROVED') return <Tag color="success">已通过</Tag>;
    if (s === 'REJECTED') return <Tag color="error">已驳回</Tag>;
    if (s === 'PAYING') return <Tag color="warning">打款中</Tag>;
    if (s === 'PAID') return <Tag color="success">已打款</Tag>;
    if (s === 'FAILED') return <Tag color="error">打款失败</Tag>;
    if (s === 'CANCELED') return <Tag>已取消</Tag>;
    return <Tag>{String(s || '-')}</Tag>;
};

// ✅ 返回 dayjs 范围：startOfMonth 00:00:00 ~ endOfMonth 23:59:59
const getMonthRange = (opts: { offsetMonthsStart?: number; monthsCount?: number }) => {
    const { offsetMonthsStart = 0, monthsCount = 1 } = opts;

    const start = dayjs()
        .add(offsetMonthsStart, 'month')
        .startOf('month')
        .startOf('day'); // 00:00:00

    const end = start
        .add(monthsCount - 1, 'month')
        .endOf('month')
        .endOf('day'); // 23:59:59

    return [start, end] as [dayjs.Dayjs, dayjs.Dayjs];
};

// ✅ 把 dateRange 的值转成 Date（支持 dayjs / Date / string），并保证 end=23:59:59
const parseRangeDate = (v: any, isEnd: boolean): Date | null => {
    if (!v) return null;

    // dayjs / moment
    if (typeof v === 'object' && typeof v.toDate === 'function') {
        const d = v.toDate();
        if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
        return d;
    }

    // Date
    if (v instanceof Date) {
        if (Number.isNaN(v.getTime())) return null;
        return v;
    }

    // string: 'YYYY-MM-DD'（关键：补齐日初/日末）
    if (typeof v === 'string') {
        const s = v.trim();

        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            const full = isEnd ? `${s}T23:59:59` : `${s}T00:00:00`;
            const d = new Date(full);
            return Number.isNaN(d.getTime()) ? null : d;
        }

        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    // timestamp / other
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

const WithdrawalRecords: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const formRef = useRef<ProFormInstance>();

    const [summary, setSummary] = useState<any>({
        approvedAmount: 0,
        approvedCount: 0,
        paidAmount: 0,
        paidCount: 0,
    });

    // ✅ 默认本月（dayjs）
    const defaultRange = useMemo(() => getMonthRange({ offsetMonthsStart: 0, monthsCount: 1 }), []);

    const columns: any[] = [
        {
            title: '申请单号',
            dataIndex: 'requestNo',
            width: 170,
            copyable: true,
            formItemProps: { name: 'requestNo' },
        },
        {
            title: '用户',
            dataIndex: 'userId',
            width: 180,
            valueType: 'digit',
            formItemProps: { name: 'userId' },
            render: (_: any, row: any) => {
                const nickname = row?.user?.name || row?.user?.realName || '-';
                return (
                    <Space direction="vertical" size={0}>
                        <Text strong>{nickname}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            ID：{row.userId}
                        </Text>
                    </Space>
                );
            },
        },
        {
            title: '金额',
            dataIndex: 'amount',
            width: 120,
            search: false,
            render: (_: any, row: any) => (
                <Text strong style={{ fontSize: 14 }}>
                    ¥{Number(row.amount || 0).toFixed(2)}
                </Text>
            ),
        },
        {
            title: '渠道',
            dataIndex: 'channel',
            width: 100,
            valueType: 'select',
            valueEnum: {
                MANUAL: { text: '人工' },
                WECHAT: { text: '微信' },
                ALIPAY: { text: '支付宝' },
            },
            render: (_: any, row: any) => renderChannelTag(row.channel),
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 120,
            valueType: 'select',
            valueEnum: {
                PENDING_REVIEW: { text: '待审核' },
                APPROVED: { text: '已通过' },
                REJECTED: { text: '已驳回' },
                PAYING: { text: '打款中' },
                PAID: { text: '已打款' },
                FAILED: { text: '打款失败' },
                CANCELED: { text: '已取消' },
            },
            render: (_: any, row: any) => renderStatusTag(row.status),
        },
        {
            title: '申请时间',
            dataIndex: 'createdAt',
            width: 180,
            valueType: 'dateTime',
            search: false,
        },

        // ✅ 快捷筛选：选中后直接覆盖“审批时间范围”，并 submit
        {
            title: '快捷筛选',
            dataIndex: 'quickRange',
            hideInTable: true,
            valueType: 'select',
            formItemProps: { name: 'quickRange' },
            initialValue: 'THIS_MONTH',
            valueEnum: {
                THIS_MONTH: { text: '本月' },
                LAST_MONTH: { text: '上月' },
                LAST_2_MONTHS: { text: '近2月' },
                LAST_3_MONTHS: { text: '近3月' },
            },
            fieldProps: {
                onChange: (v: any) => {
                    let r: [dayjs.Dayjs, dayjs.Dayjs] = defaultRange;

                    if (v === 'THIS_MONTH') r = getMonthRange({ offsetMonthsStart: 0, monthsCount: 1 });
                    if (v === 'LAST_MONTH') r = getMonthRange({ offsetMonthsStart: -1, monthsCount: 1 });
                    if (v === 'LAST_2_MONTHS') r = getMonthRange({ offsetMonthsStart: -1, monthsCount: 2 }); // 上月+本月
                    if (v === 'LAST_3_MONTHS') r = getMonthRange({ offsetMonthsStart: -2, monthsCount: 3 }); // 前2月+本月

                    formRef.current?.setFieldsValue({
                        createdAtRange: r,
                    });

                    // ✅ 用 submit 触发搜索（确保 params 带上 range）
                    formRef.current?.submit();
                },
            },
        },

        // ✅ 审批时间范围（后端用 reviewedAt，但参数名保持 createdAtFrom/To）
        {
            title: '审批时间范围',
            dataIndex: 'createdAtRange',
            hideInTable: true,
            valueType: 'dateRange',
            formItemProps: { name: 'createdAtRange' },
            initialValue: defaultRange,
        },
    ];

    return (
        <>
            <Card style={{ marginBottom: 16 }}>
                <Row gutter={24} align="middle">
                    <Col>
                        <Statistic title="已审核金额（按筛选时间）" value={summary.approvedAmount} precision={2} prefix="¥" />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            笔数：{summary.approvedCount}
                        </Text>
                    </Col>
                    <Col>
                        <Statistic
                            title="已打款金额（按筛选时间）"
                            value={summary.paidAmount}
                            precision={2}
                            prefix="¥"
                            valueStyle={{ color: '#389e0d' }}
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            笔数：{summary.paidCount}
                        </Text>
                    </Col>
                </Row>
            </Card>

            <ProTable<WalletWithdrawalRequest & any>
                headerTitle="提现记录（全部）"
                actionRef={actionRef}
                rowKey="id"
                columns={columns}
                formRef={formRef}
                search={{ labelWidth: 100 }} // ✅ 明确启用 search
                pagination={{ pageSize: 20 }}
                expandable={{
                    expandedRowRender: (row: any) => {
                        const hasAny = row?.outTradeNo || row?.channelTradeNo || row?.failReason || row?.reviewRemark;
                        if (!hasAny) return <Text type="secondary">暂无更多信息</Text>;
                        return (
                            <Space direction="vertical" size={6} style={{ paddingLeft: 6 }}>
                                {row?.reviewRemark ? (
                                    <Text>
                                        <Text type="secondary">审批备注：</Text>
                                        {row.reviewRemark}
                                    </Text>
                                ) : null}
                                {row?.outTradeNo ? (
                                    <Text>
                                        <Text type="secondary">外部单号：</Text>
                                        {row.outTradeNo}
                                    </Text>
                                ) : null}
                                {row?.channelTradeNo ? (
                                    <Text>
                                        <Text type="secondary">渠道交易号：</Text>
                                        {row.channelTradeNo}
                                    </Text>
                                ) : null}
                                {row?.failReason ? (
                                    <Text>
                                        <Text type="secondary">失败原因：</Text>
                                        {row.failReason}
                                    </Text>
                                ) : null}
                            </Space>
                        );
                    },
                }}
                request={async (params) => {
                    const page = Number(params.current || 1);
                    const pageSize = Number(params.pageSize || 20);

                    const range = (params as any).createdAtRange;

                    const d0 = Array.isArray(range) ? parseRangeDate(range[0], false) : null;
                    const d1 = Array.isArray(range) ? parseRangeDate(range[1], true) : null;

                    // ✅ 如果用户清空了范围：兜底为本月（保证默认本月始终成立）
                    const fallback = defaultRange;
                    const fd0 = d0 || fallback[0].toDate();
                    const fd1 = d1 || fallback[1].toDate();

                    const createdAtFrom = fd0.toISOString();
                    const createdAtTo = fd1.toISOString();

                    const resp = await postWithdrawalsList({
                        page,
                        pageSize,
                        status: params.status as any,
                        channel: params.channel as any,
                        userId: params.userId ? Number(params.userId) : undefined,
                        requestNo: params.requestNo ? String(params.requestNo) : undefined,
                        createdAtFrom,
                        createdAtTo,
                    });

                    if (resp?.summary) setSummary(resp.summary);

                    return {
                        data: resp?.list || [],
                        success: true,
                        total: resp?.total || 0,
                    };
                }}
            />
        </>
    );
};

export default WithdrawalRecords;
