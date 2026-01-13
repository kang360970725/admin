import React, { useRef } from 'react';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Tag, message } from 'antd';
import dayjs from 'dayjs';
import { getWalletHolds, WalletHold } from '@/services/api';

export default function WalletHolds() {
    const actionRef = useRef<ActionType>();

    const columns: any = [
        // { title: 'ID', dataIndex: 'id', width: 80, search: false },
        // { title: '用户ID', dataIndex: 'userId', width: 90, search: false },
        { title: '收益流水ID', dataIndex: 'earningTxId', width: 110, search: false },
        { title: '金额', dataIndex: 'amount', width: 120, search: false },
        {
            title: '状态',
            dataIndex: 'status',
            width: 120,
            valueEnum: {
                FROZEN: { text: '冻结' },
                RELEASED: { text: '已解冻' },
                CANCELLED: { text: '已取消' },
            },
            render: (_, r) => {
                const s = r.status;
                if (s === 'FROZEN') return <Tag color="orange">冻结</Tag>;
                if (s === 'RELEASED') return <Tag color="green">已解冻</Tag>;
                if (s === 'CANCELLED') return <Tag color="red">已取消</Tag>;
                return <Tag>{s}</Tag>;
            },
        },
        {
            title: '解冻时间',
            dataIndex: 'unlockAt',
            width: 160,
            search: false,
            render: (_, r) => (r.unlockAt ? dayjs(r.unlockAt).format('YYYY-MM-DD HH:mm') : '--'),
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 160,
            search: false,
            render: (_, r) => (r.createdAt ? dayjs(r.createdAt).format('YYYY-MM-DD HH:mm') : '--'),
        },
        {
            title: '释放时间',
            dataIndex: 'releasedAt',
            width: 160,
            search: false,
            render: (_, r) => (r.releasedAt ? dayjs(r.releasedAt).format('YYYY-MM-DD HH:mm') : '--'),
        },
    ];

    return (
        <PageContainer>
            <ProTable<WalletHold>
                actionRef={actionRef}
                rowKey="id"
                columns={columns}
                search={{ labelWidth: 'auto' }}
                pagination={{ pageSize: 20 }}
                request={async (params) => {
                    try {
                        const { current, pageSize, ...rest } = params as any;
                        const res = await getWalletHolds({
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
                        message.error('获取冻结单失败');
                        return { data: [], total: 0, success: false };
                    }
                }}
            />
        </PageContainer>
    );
}
