import React, { useRef , useState } from 'react';
import { useNavigate } from '@umijs/max';
import { PageContainer, ProTable, type ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Space , message} from 'antd';
import { getOrders, createOrder, assignDispatch } from '@/services/api';
import OrderUpsertModal from './components/OrderForm';

const statusText: Record<string, { text: string; color?: string }> = {
    WAIT_ASSIGN: { text: '待派单', color: 'default' },
    WAIT_ACCEPT: { text: '待接单', color: 'orange' },
    ACCEPTED: { text: '已接单', color: 'blue' },
    ARCHIVED: { text: '已存单', color: 'purple' },
    COMPLETED: { text: '已结单', color: 'green' },
    WAIT_REVIEW: { text: '待评价', color: 'gold' },
    REVIEWED: { text: '已评价', color: 'cyan' },
    WAIT_AFTERSALE: { text: '待售后', color: 'volcano' },
    AFTERSALE_DONE: { text: '已售后', color: 'magenta' },
    REFUNDED: { text: '已退款', color: 'red' },
};

const OrdersPage: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const navigate = useNavigate();
    const [createOpen, setCreateOpen] = useState(false);

    const columns:any = [
        {
            title: '单号',
            dataIndex: 'autoSerial',
            width: 160,
            copyable: true,
            ellipsis: true,
        },
        {
            title: '项目',
            dataIndex: ['project', 'name'],
            ellipsis: true,
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 110,
            render: (_, row) => {
                const s = statusText[row.status] || { text: row.status };
                return <Tag color={s.color}>{s.text}</Tag>;
            },
            valueType: 'select',
            valueEnum: Object.fromEntries(Object.entries(statusText).map(([k, v]) => [k, { text: v.text }])),
        },
        {
            title: '实付',
            dataIndex: 'paidAmount',
            width: 90,
            render: (_, row) => `¥${row.paidAmount}`,
            search: false,
        },
        {
            title: '客户游戏ID',
            dataIndex: 'customerGameId',
            ellipsis: true,
        },
        {
            title: '派单客服',
            dataIndex: ['dispatcher', 'name'],
            width: 110,
            search: false,
        },
        {
            title: '当前陪玩',
            dataIndex: 'currentPlayers',
            search: false,
            render: (_, row) => {
                const players = row.currentDispatch?.participants?.map((p: any) => p.user?.name || p.user?.phone) || [];
                if (players.length === 0) return '-';
                return (
                    <Space wrap>
                        {players.map((n: string) => (
                            <Tag key={n}>{n}</Tag>
                        ))}
                    </Space>
                );
            },
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            valueType: 'dateTime',
            width: 170,
            search: false,
        },
        {
            title: '操作',
            valueType: 'option',
            width: 180,
            render: (_, row) => [
                <a key="detail" onClick={() => navigate(`/orders/${row.id}`)}>
                    详情
                </a>,
            ],
        },
    ];

    return (
        <PageContainer>
            <ProTable<any>
                rowKey="id"
                actionRef={actionRef}
                columns={columns}
                search={{ labelWidth: 90 }}
                toolbar={{
                    actions: [
                        <Button key="new" type="primary" onClick={() => setCreateOpen(true)}>
                            新建订单
                        </Button>,
                    ],
                }}
                request={async (params) => {
                    const res = await getOrders({
                        page: Number(params.current || 1),
                        limit: Number(params.pageSize || 20),
                        serial: params.autoSerial,
                        status: params.status,
                        customerGameId: params.customerGameId,
                        // projectId/playerId/dispatcherId 你后续加筛选控件后再传
                    });
                    return {
                        data: res.data || [],
                        success: true,
                        total: res.total || 0,
                    };
                }}
            />
            <OrderUpsertModal
                open={createOpen}
                title="创建订单"
                showPlayers
                onCancel={() => setCreateOpen(false)}
                onSubmit={async (payload) => {
                    const created = await createOrder({
                        projectId: payload?.projectId,
                        receivableAmount: payload?.receivableAmount,
                        paidAmount: payload?.paidAmount,
                        baseAmountWan: payload?.baseAmountWan ?? undefined,
                        customerGameId: payload?.customerGameId,
                        orderTime: payload?.orderTime,
                        paymentTime: payload?.paymentTime,
                        csRate: payload?.csRate,
                        inviteRate: payload?.inviteRate,
                        inviter: payload?.inviter,
                        customClubRate: payload?.customClubRate,
                        remark: payload?.remark,
                        // ✅ 新增：赠送单标识
                        isGifted: Boolean(payload?.isGifted),
                    });

                    const orderId = Number((created as any)?.id ?? (created as any)?.data?.id);
                    if (!orderId) throw new Error('创建订单失败：未返回订单ID');

                    if (payload?.playerIds?.length) {
                        await assignDispatch(orderId, { playerIds: payload?.playerIds, remark: '新建订单时派单' });
                    }

                    message.success('创建成功');
                    setCreateOpen(false);
                    actionRef.current?.reload?.();
                    navigate(`/orders/${orderId}`);
                }}
            />
        </PageContainer>
    );
};
export default OrdersPage;
