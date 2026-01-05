import React, { useRef } from 'react';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Tag, message } from 'antd';
import dayjs from 'dayjs';
import { getWalletTransactions, WalletTransaction } from '@/services/api';

export default function WalletTransactions() {
    const actionRef = useRef<ActionType>();

    const columns: ProColumns<WalletTransaction>[] = [
        { title: 'ID', dataIndex: 'id', width: 80, search: false },
        { title: '用户ID', dataIndex: 'userId', width: 90, search: false },
        {
            title: '方向',
            dataIndex: 'direction',
            width: 90,
            valueEnum: {
                IN: { text: '收入' },
                OUT: { text: '支出' },
            },
            render: (_, r) =>
                r.direction === 'IN' ? <Tag color="green">收入</Tag> : <Tag color="red">支出</Tag>,
        },
        { title: '类型', dataIndex: 'bizType', width: 160 },
        { title: '金额', dataIndex: 'amount', width: 120, search: false },
        { title: '状态', dataIndex: 'status', width: 120 },
        { title: '订单ID', dataIndex: 'orderId', width: 100 },
        { title: '派单批次ID', dataIndex: 'dispatchId', width: 110, search: false },
        { title: '结算ID', dataIndex: 'settlementId', width: 100, search: false },
        {
            title: '来源',
            dataIndex: 'sourceType',
            width: 160,
            search: false,
            render: (_, r) => {
                const st = r.sourceType ?? '--';
                const sid = r.sourceId ?? '--';
                return `${st}:${sid}`;
            },
        },
        {
            title: '时间',
            dataIndex: 'createdAt',
            width: 160,
            search: false,
            render: (_, r) => (r.createdAt ? dayjs(r.createdAt).format('YYYY-MM-DD HH:mm') : '--'),
        },
    ];

    return (
        <PageContainer>
            <ProTable<WalletTransaction>
                actionRef={actionRef}
                rowKey="id"
                columns={columns}
                search={{ labelWidth: 'auto' }}
                pagination={{ pageSize: 20 }}
                request={async (params) => {
                    try {
                        const { current, pageSize, ...rest } = params as any;
                        const res = await getWalletTransactions({
                            page: current ?? 1,
                            limit: pageSize ?? 20,
                            ...(rest || {}),
                        });
                        return {
                            data: (res as any).data ?? [],
                            total: (res as any).total ?? 0,
                            success: true,
                        };
                    } catch (e) {
                        message.error('获取钱包流水失败');
                        return { data: [], total: 0, success: false };
                    }
                }}
            />
        </PageContainer>
    );
}
