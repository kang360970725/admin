import React, { useRef } from 'react';
import { Tag, Space, Typography } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { postWithdrawalsList, type WalletWithdrawalRequest } from '@/services/api';

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

/**
 * ✅ 提现记录（管理端全量）
 * - 支持筛选：状态/渠道/用户ID/单号/时间范围
 * - 展示更像“提现申请列表”：昵称、状态Tag、渠道Tag、金额醒目
 * - outTradeNo/channelTradeNo/failReason 收到展开行里，避免一屏太挤
 */
const WithdrawalRecords: React.FC = () => {
    const actionRef = useRef<ActionType>();

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
            render: (_, row: any) => {
                const nickname =  row?.user?.name || row?.user?.realName ||'-';
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
            render: (_, row: any) => (
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
            render: (_, row: any) => renderChannelTag(row.channel),
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
            render: (_, row: any) => renderStatusTag(row.status),
        },
        {
            title: '申请时间',
            dataIndex: 'createdAt',
            width: 180,
            valueType: 'dateTime',
            search: false,
        },
        {
            title: '申请时间范围',
            dataIndex: 'createdAtRange',
            hideInTable: true,
            valueType: 'dateRange',
        },
    ];

    return (
        <ProTable<WalletWithdrawalRequest & any>
            headerTitle="提现记录（全部）"
            actionRef={actionRef}
            rowKey="id"
            columns={columns}
            pagination={{ pageSize: 20 }}
            expandable={{
                expandedRowRender: (row: any) => {
                    const hasAny =
                        row?.outTradeNo || row?.channelTradeNo || row?.failReason || row?.reviewRemark;
                    if (!hasAny) {
                        return <Text type="secondary">暂无更多信息</Text>;
                    }
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

                const range = params.createdAtRange as any;
                const createdAtFrom =
                    Array.isArray(range) && range[0] ? new Date(range[0]).toISOString() : undefined;
                const createdAtTo =
                    Array.isArray(range) && range[1] ? new Date(range[1]).toISOString() : undefined;

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

                return {
                    data: resp?.list || [],
                    success: true,
                    total: resp?.total || 0,
                };
            }}
        />
    );
};

export default WithdrawalRecords;
