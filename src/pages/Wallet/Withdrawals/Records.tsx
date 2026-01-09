import React, { useRef } from 'react';
import { Tag } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { postWithdrawalsList, type WalletWithdrawalRequest } from '@/services/api';

/**
 * ✅ 提现记录（管理端全量）
 * - 支持筛选：状态/渠道/用户ID/单号/时间范围
 * - 展示打款结果字段：outTradeNo、channelTradeNo、failReason
 */
const WithdrawalRecords: React.FC = () => {
    const actionRef = useRef<ActionType>();

    const columns: ProColumns<WalletWithdrawalRequest>[] = [
        {
            title: '申请单号',
            dataIndex: 'requestNo',
            width: 160,
            copyable: true,
            // ✅ 支持按单号模糊搜索
            formItemProps: {
                name: 'requestNo',
            },
        },
        {
            title: '用户ID',
            dataIndex: 'userId',
            width: 100,
            // ✅ 支持按 userId 搜索
            valueType: 'digit',
            formItemProps: {
                name: 'userId',
            },
        },
        {
            title: '金额',
            dataIndex: 'amount',
            width: 120,
            search: false,
            render: (_, row) => <span>{Number(row.amount || 0).toFixed(2)}</span>,
        },
        {
            title: '渠道',
            dataIndex: 'channel',
            width: 100,
            valueType: 'select',
            valueEnum: {
                MANUAL: { text: '人工' },
                WECHAT: { text: '微信' },
            },
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 140,
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
            render: (_, row) => {
                const s = row.status;
                if (s === 'PENDING_REVIEW') return <Tag color="processing">待审核</Tag>;
                if (s === 'APPROVED') return <Tag color="success">已通过</Tag>;
                if (s === 'REJECTED') return <Tag color="error">已驳回</Tag>;
                if (s === 'PAYING') return <Tag color="warning">打款中</Tag>;
                if (s === 'PAID') return <Tag color="success">已打款</Tag>;
                if (s === 'FAILED') return <Tag color="error">打款失败</Tag>;
                if (s === 'CANCELED') return <Tag>已取消</Tag>;
                return <Tag>{s}</Tag>;
            },
        },
        {
            title: '外部单号(outTradeNo)',
            dataIndex: 'outTradeNo',
            width: 180,
            search: false,
            ellipsis: true,
        },
        {
            title: '渠道交易号(channelTradeNo)',
            dataIndex: 'channelTradeNo',
            width: 180,
            search: false,
            ellipsis: true,
        },
        {
            title: '失败原因',
            dataIndex: 'failReason',
            width: 200,
            search: false,
            ellipsis: true,
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
            // ✅ ProTable 会把这个值放到 params.createdAtRange
        },
    ];

    return (
        <ProTable<WalletWithdrawalRequest>
            headerTitle="提现记录（全部）"
            actionRef={actionRef}
            rowKey="id"
            columns={columns}
            pagination={{ pageSize: 20 }}
            request={async (params) => {
                // ✅ ProTable 默认 params.current/params.pageSize
                const page = Number(params.current || 1);
                const pageSize = Number(params.pageSize || 20);

                // ✅ 时间范围：dateRange 返回 [start, end]
                const range = params.createdAtRange as any;
                const createdAtFrom = Array.isArray(range) && range[0] ? new Date(range[0]).toISOString() : undefined;
                const createdAtTo = Array.isArray(range) && range[1] ? new Date(range[1]).toISOString() : undefined;

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
