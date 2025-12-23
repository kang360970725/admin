// src/pages/Orders/Detail.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Descriptions, Table, Tag, Button, Space, Modal, Select, message, Form, InputNumber, Input } from 'antd';
import { useParams } from '@umijs/max';

import {
    getOrderDetail,
    assignDispatch,
    updateDispatchParticipants,
    getPlayerOptions,
    updateOrderPaidAmount,
    getEnumDicts,
} from '@/services/api';

type DictMap = Record<string, Record<string, string>>;

const MAX_PLAYERS = 2;

const OrderDetailPage: React.FC = () => {
    const params = useParams<{ id: string }>();
    const orderId = Number(params.id);

    const [loading, setLoading] = useState(false);
    const [order, setOrder] = useState<any>(null);

    // enum dicts
    const [dicts, setDicts] = useState<DictMap>({});

    // players for select
    const [playerLoading, setPlayerLoading] = useState(false);
    const [playerOptions, setPlayerOptions] = useState<{ label: string; value: number }[]>([]);

    // dispatch modal
    const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
    const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
    const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
    const [dispatchRemark, setDispatchRemark] = useState<string>('');

    // paidAmount modal (hourly only)
    const [paidModalOpen, setPaidModalOpen] = useState(false);
    const [paidSubmitting, setPaidSubmitting] = useState(false);
    const [paidForm] = Form.useForm();

    const currentDispatch = order?.currentDispatch;

    const billingMode = useMemo(() => {
        // 优先快照
        const snap = order?.projectSnapshot || {};
        return snap.billingMode || order?.project?.billingMode;
    }, [order]);

    const isHourly = billingMode === 'HOURLY';
    const isGuaranteed = billingMode === 'GUARANTEED';

    const t = (group: keyof DictMap, key: any, fallback?: string) => {
        const k = String(key ?? '');
        return dicts?.[group]?.[k] || fallback || k || '-';
    };

    const loadDicts = async () => {
        try {
            const res = await getEnumDicts();
            setDicts(res || {});
        } catch (e) {
            console.error(e);
        }
    };

    const loadDetail = async () => {
        if (!orderId) return;
        setLoading(true);
        try {
            const res = await getOrderDetail(orderId);
            setOrder(res);
        } catch (e: any) {
            message.error(e?.response?.data?.message || '加载订单详情失败');
        } finally {
            setLoading(false);
        }
    };

    const fetchPlayers = async (keyword?: string) => {
        setPlayerLoading(true);
        try {
            const res = await getPlayerOptions({ keyword: keyword || '', onlyIdle: true });
            const list = Array.isArray(res) ? res : (res?.data ?? []);
            setPlayerOptions(
                list.map((u: any) => ({
                    value: Number(u.id),
                    label: `${u.name || '未命名'}（${u.phone || '-'}）`,
                })),
            );
        } catch (e) {
            console.error(e);
        } finally {
            setPlayerLoading(false);
        }
    };

    useEffect(() => {
        void loadDicts();
        void loadDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId]);

    // 打开派单/更新参与者弹窗
    const openDispatchModal = async () => {
        setDispatchRemark('');

        // ✅ 若当前派单已存单（ARCHIVED），再次派单必须重新选择，不带入旧参与者
        if (currentDispatch?.status === 'ARCHIVED') {
            setSelectedPlayers([]);
        } else {
            const actives = currentDispatch?.participants?.filter((p: any) => p.isActive !== false) || [];
            setSelectedPlayers(
                actives.map((p: any) => Number(p.userId)).filter((n: number) => !Number.isNaN(n)),
            );
        }

        setDispatchModalOpen(true);
        await fetchPlayers('');
    };

    const submitDispatchOrUpdate = async () => {
        try {
            if (!order) return;
            if (!Array.isArray(selectedPlayers) || selectedPlayers.length < 1 || selectedPlayers.length > MAX_PLAYERS) {
                message.warning(`请选择 1~${MAX_PLAYERS} 名打手`);
                return;
            }

            setDispatchSubmitting(true);

            // ✅ 只有在 WAIT_ASSIGN / WAIT_ACCEPT 才允许更新参与者
            // ✅ ARCHIVED（存单）必须创建新 dispatch（重新派单）
            const canUpdateParticipants =
                currentDispatch?.id &&
                (currentDispatch.status === 'WAIT_ASSIGN' || currentDispatch.status === 'WAIT_ACCEPT');

            if (canUpdateParticipants) {
                await updateDispatchParticipants({
                    dispatchId: Number(currentDispatch.id),
                    playerIds: selectedPlayers,
                    remark: dispatchRemark || undefined,
                });
            } else {
                await assignDispatch(Number(order.id), {
                    playerIds: selectedPlayers,
                    remark: dispatchRemark || '详情页派单/重新派单',
                });
            }

            message.success('操作成功');
            setDispatchModalOpen(false);
            await loadDetail();
        } catch (e: any) {
            message.error(e?.response?.data?.message || '操作失败');
        } finally {
            setDispatchSubmitting(false);
        }
    };

    const openPaidModal = () => {
        if (!order) return;
        paidForm.setFieldsValue({
            paidAmount: order.paidAmount,
            remark: '',
        });
        setPaidModalOpen(true);
    };

    const submitPaidAmount = async () => {
        try {
            const values = await paidForm.validateFields();
            setPaidSubmitting(true);

            await updateOrderPaidAmount({
                id: Number(order.id),
                paidAmount: Number(values.paidAmount),
                remark: values.remark || undefined,
            });

            message.success('已更新实付金额');
            setPaidModalOpen(false);
            await loadDetail();
        } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || '更新失败');
        } finally {
            setPaidSubmitting(false);
        }
    };

    // 当前参与者（仅展示 active）
    const participantRows = useMemo(() => {
        const list = currentDispatch?.participants || [];
        return list.filter((p: any) => p.isActive !== false);
    }, [currentDispatch]);

    const participantColumns = [
        {
            title: '打手',
            dataIndex: 'user',
            render: (_: any, row: any) => {
                const u = row.user;
                return `${u?.name || '未命名'}（${u?.phone || '-'}）`;
            },
        },
        {
            title: '接单时间',
            dataIndex: 'acceptedAt',
            render: (v: any) => (v ? new Date(v).toLocaleString() : '-'),
        },
        {
            title: '保底进度（万）',
            dataIndex: 'progressBaseWan',
            render: (v: any) => (v == null ? '-' : v),
        },
        {
            title: '贡献金额',
            dataIndex: 'contributionAmount',
            render: (v: any) => (v == null ? '-' : v),
        },
    ];

    const statusTag = (group: keyof DictMap, value: any) => {
        const text = t(group, value, String(value));
        const v = String(value);
        const color =
            v.includes('WAIT') ? 'orange'
                : v.includes('ACCEPT') ? 'blue'
                : v.includes('ARCH') ? 'gold'
                    : v.includes('COMP') ? 'green'
                        : v.includes('CANCEL') || v.includes('REFUND') ? 'red'
                            : 'default';

        return <Tag color={color}>{text}</Tag>;
    };

    // -----------------------------
    // ✅ 顶部：剩余保底计算（累计所有轮次 progressBaseWan）
    // -----------------------------
    const baseAmountWan = useMemo(() => {
        // 订单创建时你落库 baseAmountWan
        const v = order?.baseAmountWan;
        return v == null ? null : Number(v);
    }, [order]);

    const totalProgressWan = useMemo(() => {
        const dispatches = Array.isArray(order?.dispatches) ? order.dispatches : [];
        let sum = 0;
        for (const d of dispatches) {
            const parts = Array.isArray(d?.participants) ? d.participants : [];
            for (const p of parts) {
                sum += Number(p?.progressBaseWan ?? 0);
            }
        }
        return sum;
    }, [order]);

    const remainingBaseWan = useMemo(() => {
        if (!isGuaranteed) return null;
        if (baseAmountWan == null || !Number.isFinite(baseAmountWan) || baseAmountWan <= 0) return null;
        return baseAmountWan - totalProgressWan;
    }, [isGuaranteed, baseAmountWan, totalProgressWan]);

    const remainingBaseColor = useMemo(() => {
        if (remainingBaseWan == null) return 'default';
        return remainingBaseWan >= 0 ? 'green' : 'red';
    }, [remainingBaseWan]);

    // -----------------------------
    // ✅ 历史参与者：按 dispatchId + userId 匹配 settlement.finalEarnings
    // -----------------------------
    const settlementMap = useMemo(() => {
        const map = new Map<string, any>();
        const list = Array.isArray(order?.settlements) ? order.settlements : [];
        for (const s of list) {
            const key = `${s.dispatchId}_${s.userId}`;
            map.set(key, s);
        }
        return map;
    }, [order]);

    const historyDispatches = useMemo(() => {
        const list = Array.isArray(order?.dispatches) ? order.dispatches : [];
        return list;
    }, [order]);

    const historyColumns = [
        { title: '轮次', dataIndex: 'round', width: 80 },
        {
            title: '派单状态',
            dataIndex: 'status',
            width: 120,
            render: (v: any) => statusTag('DispatchStatus', v),
        },
        {
            title: '派单时间',
            dataIndex: 'assignedAt',
            width: 180,
            render: (v: any) => (v ? new Date(v).toLocaleString() : '-'),
        },
        {
            title: '全员接单',
            dataIndex: 'acceptedAllAt',
            width: 180,
            render: (v: any) => (v ? new Date(v).toLocaleString() : '-'),
        },
        {
            title: '存单时间',
            dataIndex: 'archivedAt',
            width: 180,
            render: (v: any) => (v ? new Date(v).toLocaleString() : '-'),
        },
        {
            title: '结单时间',
            dataIndex: 'completedAt',
            width: 180,
            render: (v: any) => (v ? new Date(v).toLocaleString() : '-'),
        },
        {
            title: '备注',
            dataIndex: 'remark',
            ellipsis: true,
            render: (v: any) => v || '-',
        },
    ];

    const historyParticipantColumns = [
        {
            title: '打手',
            dataIndex: 'user',
            render: (_: any, row: any) => {
                const u = row.user;
                return `${u?.name || '未命名'}（${u?.phone || '-'}）`;
            },
        },
        {
            title: '接单时间',
            dataIndex: 'acceptedAt',
            render: (v: any) => (v ? new Date(v).toLocaleString() : '-'),
        },
        {
            title: '保底进度（万）',
            dataIndex: 'progressBaseWan',
            render: (v: any) => (v == null ? '-' : v),
        },
        {
            title: '贡献金额',
            dataIndex: 'contributionAmount',
            render: (v: any) => (v == null ? '-' : v),
        },
        {
            title: '实际收益',
            dataIndex: 'finalEarnings',
            render: (_: any, row: any) => {
                const key = `${row.dispatchId}_${row.userId}`;
                const s = settlementMap.get(key);
                const v = s?.finalEarnings;
                return v == null ? '-' : `¥${v}`;
            },
        },
    ];

    const hideCurrentParticipants = order?.status === 'COMPLETED';

    return (
        <PageContainer>
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <Card
                    title={`订单详情：${order?.autoSerial || '-'}`}
                    loading={loading}
                    extra={
                        <Space>
                            <Button onClick={openDispatchModal}>
                                {/* ✅ 存单/无派单/不可更新时统一叫“派单”，其余才叫“更新参与者” */}
                                {currentDispatch?.id && (currentDispatch.status === 'WAIT_ASSIGN' || currentDispatch.status === 'WAIT_ACCEPT')
                                    ? '更新参与者'
                                    : '派单'}
                            </Button>

                            <Button disabled={!isHourly} onClick={openPaidModal}>
                                小时单补收修改实付
                            </Button>
                        </Space>
                    }
                >
                    <Descriptions column={2} bordered size="small">
                        <Descriptions.Item label="订单状态">
                            {statusTag('OrderStatus', order?.status)}
                        </Descriptions.Item>

                        <Descriptions.Item label="当前派单状态">
                            {currentDispatch?.status ? statusTag('DispatchStatus', currentDispatch.status) : '-'}
                        </Descriptions.Item>

                        <Descriptions.Item label="项目">
                            {order?.project?.name || order?.projectSnapshot?.name || '-'}
                        </Descriptions.Item>

                        <Descriptions.Item label="计费类型">
                            {t('BillingMode', billingMode, billingMode)}
                        </Descriptions.Item>

                        <Descriptions.Item label="应收金额">¥{order?.receivableAmount ?? '-'}</Descriptions.Item>

                        <Descriptions.Item label="实付金额">
                            ¥{order?.paidAmount ?? '-'}
                            {isHourly ? <Tag style={{ marginLeft: 8 }}>小时单可补收</Tag> : null}
                        </Descriptions.Item>

                        <Descriptions.Item label="订单保底（万）">
                            {baseAmountWan ?? '-'}
                            {isGuaranteed ? <Tag style={{ marginLeft: 8 }}>保底单</Tag> : null}
                        </Descriptions.Item>

                        <Descriptions.Item label="剩余保底（万）">
                            {remainingBaseWan == null ? '-' : <Tag color={remainingBaseColor as any}>{remainingBaseWan}</Tag>}
                        </Descriptions.Item>

                        <Descriptions.Item label="客户游戏ID">{order?.customerGameId ?? '-'}</Descriptions.Item>

                        <Descriptions.Item label="派单客服">
                            {order?.dispatcher ? `${order.dispatcher.name || '-'}（${order.dispatcher.phone || '-'}）` : '-'}
                        </Descriptions.Item>

                        <Descriptions.Item label="下单时间">
                            {order?.orderTime ? new Date(order.orderTime).toLocaleString() : '-'}
                        </Descriptions.Item>

                        <Descriptions.Item label="付款时间">
                            {order?.paymentTime ? new Date(order.paymentTime).toLocaleString() : '-'}
                        </Descriptions.Item>
                    </Descriptions>
                </Card>

                {/* ✅ 已结单后不再显示“当前参与者（本轮）” */}
                {!hideCurrentParticipants ? (
                    <Card title="当前参与者（本轮）" loading={loading}>
                        <Table
                            rowKey="id"
                            columns={participantColumns as any}
                            dataSource={participantRows}
                            pagination={false}
                        />
                        {!currentDispatch?.id ? (
                            <div style={{ marginTop: 12 }}>
                                <Tag color="orange">当前还未派单</Tag>
                            </div>
                        ) : null}
                    </Card>
                ) : null}

                {/* ✅ 新增：历史参与者（按轮次） */}
                <Card title="历史参与者（按轮次）" loading={loading}>
                    <Table
                        rowKey="id"
                        columns={historyColumns as any}
                        dataSource={historyDispatches}
                        pagination={false}
                        scroll={{ x: 1100 }}
                        expandable={{
                            expandedRowRender: (dispatchRow: any) => {
                                const parts = Array.isArray(dispatchRow?.participants) ? dispatchRow.participants : [];
                                // 给子表补 dispatchId 便于 settlement 匹配
                                const data = parts.map((p: any) => ({ ...p, dispatchId: dispatchRow.id }));
                                return (
                                    <Table
                                        rowKey="id"
                                        columns={historyParticipantColumns as any}
                                        dataSource={data}
                                        pagination={false}
                                        size="small"
                                    />
                                );
                            },
                        }}
                    />
                    {historyDispatches.length === 0 ? (
                        <div style={{ marginTop: 12 }}>
                            <Tag>暂无历史派单</Tag>
                        </div>
                    ) : null}
                </Card>
            </Space>

            {/* 派单 / 更新参与者 */}
            <Modal
                title={(currentDispatch?.id && (currentDispatch.status === 'WAIT_ASSIGN' || currentDispatch.status === 'WAIT_ACCEPT')) ? '更新参与者' : '派单'}
                open={dispatchModalOpen}
                onCancel={() => setDispatchModalOpen(false)}
                onOk={submitDispatchOrUpdate}
                confirmLoading={dispatchSubmitting}
                destroyOnClose
            >
                <div style={{ marginBottom: 12 }}>
                    <div style={{ marginBottom: 6 }}>选择打手（仅空闲可选，最多 2 人）</div>
                    <Select
                        mode="multiple"
                        value={selectedPlayers}
                        onChange={(vals) => {
                            if (vals.length > MAX_PLAYERS) {
                                message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
                                setSelectedPlayers(vals.slice(0, MAX_PLAYERS));
                                return;
                            }
                            setSelectedPlayers(vals as number[]);
                        }}
                        showSearch
                        filterOption={false}
                        onSearch={(v) => fetchPlayers(v)}
                        loading={playerLoading}
                        options={playerOptions}
                        placeholder="输入姓名/手机号筛选"
                        style={{ width: '100%' }}
                    />
                </div>

                <div>
                    <div style={{ marginBottom: 6 }}>备注（可选）</div>
                    <Input
                        value={dispatchRemark}
                        onChange={(e) => setDispatchRemark(e.target.value)}
                        placeholder="例如：客户指定/换号/紧急"
                        allowClear
                    />
                </div>

                {(currentDispatch?.id && (currentDispatch.status === 'WAIT_ASSIGN' || currentDispatch.status === 'WAIT_ACCEPT')) ? (
                    <div style={{ marginTop: 12 }}>
                        <Tag color="gold">提示：若已有打手接单，将禁止修改参与者（请存单后重新派单）。</Tag>
                    </div>
                ) : null}
            </Modal>

            {/* 小时单补收：修改实付金额 */}
            <Modal
                title="小时单补收：修改实付金额"
                open={paidModalOpen}
                onCancel={() => setPaidModalOpen(false)}
                onOk={submitPaidAmount}
                confirmLoading={paidSubmitting}
                destroyOnClose
            >
                <Form form={paidForm} layout="vertical">
                    <Form.Item
                        name="paidAmount"
                        label="实付金额（仅允许增加）"
                        rules={[
                            { required: true, message: '请输入实付金额' },
                            () => ({
                                validator: async (_, v) => {
                                    const nv = Number(v);
                                    if (!Number.isFinite(nv) || nv < 0) throw new Error('金额非法');
                                    if (order?.paidAmount != null && nv < Number(order.paidAmount)) {
                                        throw new Error('仅允许增加（超时补收），不允许减少');
                                    }
                                },
                            }),
                        ]}
                    >
                        <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item name="remark" label="补收说明（建议填写）">
                        <Input placeholder="例如：超时 30 分钟补收 ¥20" allowClear />
                    </Form.Item>

                    <Tag color="blue">该操作会写入操作日志（UPDATE_PAID_AMOUNT）。</Tag>
                </Form>
            </Modal>
        </PageContainer>
    );
};

export default OrderDetailPage;
