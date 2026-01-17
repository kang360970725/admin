import React, { useRef, useState } from 'react';
import { useNavigate } from '@umijs/max';
import { PageContainer, ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Tag, Space, message, Modal, Form, InputNumber, Input, Checkbox } from 'antd';
import { getOrders, createOrder, assignDispatch, markOrderPaid } from '@/services/api';
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

    // ✅ 确认收款弹窗（列表页快捷操作）
    const [markPaidOpen, setMarkPaidOpen] = useState(false);
    const [markPaidSubmitting, setMarkPaidSubmitting] = useState(false);
    const [markPaidOrder, setMarkPaidOrder] = useState<any>(null);
    const [markPaidForm] = Form.useForm();

    const openMarkPaidModal = (row: any) => {
        setMarkPaidOrder(row);

        // 进入弹窗时：默认带出当前实付金额，方便一并修正“实收金额”
        markPaidForm.setFieldsValue({
            paidAmount: row?.paidAmount,
            remark: '',
            // 勾选含义：确认款项已经收进来了（列表页的“确认收款”按钮默认勾上）
            confirmPaid: true,
        });

        setMarkPaidOpen(true);
    };

    const submitMarkPaid = async () => {
        try {
            const v = await markPaidForm.validateFields();
            setMarkPaidSubmitting(true);

            // ✅ 后端新接口：确认收款（同时允许修正 paidAmount）
            await markOrderPaid({
                id: Number(markPaidOrder?.id),
                paidAmount: Number(v.paidAmount),
                remark: v.remark || undefined,
                confirmPaid: v.confirmPaid !== false,
            });

            message.success('已确认收款');
            setMarkPaidOpen(false);
            actionRef.current?.reload?.();
        } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || '确认收款失败');
        } finally {
            setMarkPaidSubmitting(false);
        }
    };

    const columns: any = [
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
            render: (_: any, row: any) => {
                const s = statusText[row.status] || { text: row.status };
                return <Tag color={s.color}>{s.text}</Tag>;
            },
            valueType: 'select',
            valueEnum: Object.fromEntries(Object.entries(statusText).map(([k, v]) => [k, { text: v.text }])),
        },

        // ✅ 新增：收款状态筛选 + 未付款显示
        {
            title: '收款',
            dataIndex: 'isPaid',
            width: 110,
            valueType: 'select',
            valueEnum: {
                true: { text: '已收款' },
                false: { text: '未收款' },
            },
            render: (_: any, row: any) => {
                // 赠送单：保持“未收款”展示，但不做高亮提示（避免误导）
                if (row?.isGifted) return <Tag>赠送</Tag>;
                if (row?.isPaid === false) return <Tag color="red">未收款</Tag>;
                return <Tag color="green">已收款</Tag>;
            },
        },

        {
            title: '实付',
            dataIndex: 'paidAmount',
            width: 90,
            render: (_: any, row: any) => `¥${row.paidAmount}`,
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
            render: (_: any, row: any) => {
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
            width: 260,
            render: (_: any, row: any) => {
                const canQuickMarkPaid = !row?.isGifted && row?.isPaid === false;

                return [
                    <a key="detail" onClick={() => navigate(`/orders/${row.id}`)}>
                        详情
                    </a>,

                    // ✅ 新增：未收款订单的快捷“确认收款”
                    canQuickMarkPaid ? (
                        <a
                            key="markPaid"
                            style={{ color: '#1677ff', fontWeight: 500 }}
                            onClick={() => openMarkPaidModal(row)}
                        >
                            确认收款
                        </a>
                    ) : null,
                ].filter(Boolean);
            },
        },
    ];

    return (
        <PageContainer>
            {/* ✅ 未付款行高亮（最小侵入：只在本页加样式，不动全局） */}
            <style>
                {`
                .orders-row-unpaid td{
                    background: rgba(255, 77, 79, 0.08) !important;
                }
                `}
            </style>

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
                // ✅ 未付款高亮（排除赠送单）
                rowClassName={(row: any) => {
                    if (row?.isGifted) return '';
                    return row?.isPaid === false ? 'orders-row-unpaid' : '';
                }}
                request={async (params) => {
                    const isPaidParam =
                        params.isPaid === undefined
                            ? undefined
                            : params.isPaid === 'true'
                            ? true
                            : params.isPaid === 'false'
                                ? false
                                : Boolean(params.isPaid);

                    const res = await getOrders({
                        page: Number(params.current || 1),
                        limit: Number(params.pageSize || 20),
                        serial: params.autoSerial,
                        status: params.status,
                        customerGameId: params.customerGameId,

                        // ✅ 新增：收款筛选
                        isPaid: isPaidParam,

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
                        isGifted: Boolean(payload?.isGifted),

                        // ✅ 新增：是否已收款（不再由 paymentTime 推断）
                        isPaid: Boolean(payload?.isPaid),
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

            {/* ✅ 列表页：确认收款弹窗（可修正实收金额） */}
            <Modal
                open={markPaidOpen}
                title={`确认收款：${markPaidOrder?.autoSerial || ''}`}
                onCancel={() => setMarkPaidOpen(false)}
                onOk={submitMarkPaid}
                confirmLoading={markPaidSubmitting}
                okText="确认"
            >
                <Form form={markPaidForm} layout="vertical">
                    <Form.Item
                        label="实收金额（实付）"
                        name="paidAmount"
                        rules={[
                            { required: true, message: '请输入实收金额' },
                        ]}
                    >
                        <InputNumber style={{ width: '100%' }} min={0} step={1} />
                    </Form.Item>

                    <Form.Item label="备注" name="remark">
                        <Input.TextArea rows={3} placeholder="可填写收款备注（可不填）" />
                    </Form.Item>

                    <Form.Item name="confirmPaid" valuePropName="checked" initialValue={true}>
                        <Checkbox>确认订单已经收款入账</Checkbox>
                    </Form.Item>
                </Form>
            </Modal>
        </PageContainer>
    );
};

export default OrdersPage;
