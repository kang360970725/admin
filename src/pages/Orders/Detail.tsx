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

    const t = (group: keyof DictMap, key: any, fallback?: string) => {
        const k = String(key ?? '');
        return dicts?.[group]?.[k] || fallback || k || '-';
    };

    const loadDicts = async () => {
        try {
            const res = await getEnumDicts();
            setDicts(res || {});
        } catch (e) {
            // 不阻塞页面
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
        // 默认带入当前参与者（如果有）
        const actives =
            currentDispatch?.participants?.filter((p: any) => p.isActive !== false) || [];
        setSelectedPlayers(actives.map((p: any) => Number(p.userId)).filter((n: number) => !Number.isNaN(n)));

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

            // 有 currentDispatch => 更新参与者；无 => 派单（创建 dispatch）
            if (currentDispatch?.id) {
                await updateDispatchParticipants({
                    dispatchId: Number(currentDispatch.id),
                    playerIds: selectedPlayers,
                    remark: dispatchRemark || undefined,
                });
            } else {
                await assignDispatch(Number(order.id), {
                    playerIds: selectedPlayers,
                    remark: dispatchRemark || '详情页派单',
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

    const participantRows = useMemo(() => {
        const list = currentDispatch?.participants || [];
        // 只展示 active（历史替换掉的不展示）
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
        // 简单颜色策略
        const v = String(value);
        const color =
            v.includes('WAIT') ? 'orange' :
                v.includes('ACCEPT') ? 'blue' :
                    v.includes('ARCH') ? 'gold' :
                        v.includes('COMP') ? 'green' :
                            v.includes('CANCEL') || v.includes('REFUND') ? 'red' :
                                'default';

        return <Tag color={color}>{text}</Tag>;
    };

    return (
        <PageContainer>
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <Card
                    title={`订单详情：${order?.autoSerial || '-'}`}
                    loading={loading}
                    extra={
                        <Space>
                            <Button onClick={openDispatchModal}>
                                {currentDispatch?.id ? '更新参与者' : '派单'}
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

                        <Descriptions.Item label="订单保底（万）">{order?.baseAmountWan ?? '-'}</Descriptions.Item>

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
            </Space>

            {/* 派单 / 更新参与者 */}
            <Modal
                title={currentDispatch?.id ? '更新参与者' : '派单'}
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

                {currentDispatch?.id && (
                    <div style={{ marginTop: 12 }}>
                        <Tag color="gold">提示：若已有打手接单，将禁止修改参与者（请存单后重新派单）。</Tag>
                    </div>
                )}
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
