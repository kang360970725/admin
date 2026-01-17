// src/pages/Orders/Detail.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import {
    Card,
    Descriptions,
    Table,
    Tag,
    Button,
    Space,
    Modal,
    Select,
    message,
    Form,
    InputNumber,
    Input,
    Typography,
    Col,
    Row,
    Tabs,
    Collapse,
    Drawer,
    FloatButton,
    List, Checkbox,
} from 'antd';
import {
    ReloadOutlined,
    ThunderboltOutlined,
    ProfileOutlined,
    WalletOutlined,
    AppstoreOutlined,
    CopyOutlined,
    FileImageOutlined,
    EditOutlined,
    DollarOutlined,
} from '@ant-design/icons';
import { useParams, useModel, history } from '@umijs/max';
import OrderUpsertModal from './components/OrderForm';

import {
    getOrderDetail,
    assignDispatch,
    updateDispatchParticipants,
    getPlayerOptions,
    updateOrderPaidAmount,
    getEnumDicts,
    adjustSettlementFinalEarnings,
    refundOrder,
    updateOrder,
    markOrderPaid
} from '@/services/api';
import dayjs from 'dayjs';
import { useIsMobile } from '@/utils/useIsMobile';
import { generateReceiptImage } from '@/utils/receiptImage';

type DictMap = Record<string, Record<string, string>>;

const MAX_PLAYERS = 2;

const OrderDetailPage: React.FC = () => {
    const params = useParams<{ id: string }>();
    const orderId = Number(params.id);

    const isMobile = useIsMobile(768);

    const [loading, setLoading] = useState(false);
    const [order, setOrder] = useState<any>(null);

    // enum dicts
    const [dicts, setDicts] = useState<DictMap>({});

    // players for select
    const [playerLoading, setPlayerLoading] = useState(false);
    const [playerOptions, setPlayerOptions] = useState<{ label: string; value: number }[]>([]);

    // dispatch modal/drawer
    const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
    const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
    const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
    const [dispatchRemark, setDispatchRemark] = useState<string>('');

    // paidAmount modal (hourly only)
    const [paidModalOpen, setPaidModalOpen] = useState(false);
    const [paidSubmitting, setPaidSubmitting] = useState(false);
    const [paidForm] = Form.useForm();

    const [adjustOpen, setAdjustOpen] = useState(false);
    const [adjustSubmitting, setAdjustSubmitting] = useState(false);
    const [adjustForm] = Form.useForm();
    const [currentSettlement, setCurrentSettlement] = useState<any>(null);

    const [refundOpen, setRefundOpen] = useState(false);
    const [refundRemark, setRefundRemark] = useState('');
    const [refundLoading, setRefundLoading] = useState(false);

    const [editOpen, setEditOpen] = useState(false);
    const openEditModal = () => setEditOpen(true);
    const forbidEdit = ['COMPLETED', 'REFUNDED'].includes(order?.status);

    // ✅ confirm payment modal
    const [markPaidOpen, setMarkPaidOpen] = useState(false);
    const [markPaidSubmitting, setMarkPaidSubmitting] = useState(false);
    const [markPaidForm] = Form.useForm();

    const openMarkPaidModal = () => {
        if (!order) return;

        markPaidForm.setFieldsValue({
            paidAmount: order?.paidAmount,
            remark: '',
            confirmPaid: true,
        });

        setMarkPaidOpen(true);
    };

    const submitMarkPaid = async () => {
        try {
            const v = await markPaidForm.validateFields();
            setMarkPaidSubmitting(true);

            await markOrderPaid({
                id: Number(order?.id),
                paidAmount: Number(v.paidAmount),
                remark: v.remark || undefined,
                confirmPaid: v.confirmPaid !== false,
            });

            message.success('已确认收款');
            setMarkPaidOpen(false);
            await loadDetail();
        } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || '确认收款失败');
        } finally {
            setMarkPaidSubmitting(false);
        }
    };


    const submitRefund = async () => {
        try {
            setRefundLoading(true);
            await refundOrder({ id: order?.id, remark: refundRemark });
            message.success('退款成功');
            setRefundOpen(false);
            loadDetail();
        } finally {
            setRefundLoading(false);
        }
    };

    // 创建订单后、复制相关功能模块
    const { initialState } = useModel('@@initialState');
    const currentUser = initialState?.currentUser;

    const [receiptOpen, setReceiptOpen] = useState(false);
    const [receiptType, setReceiptType] = useState<'customer' | 'staff'>('customer');
    const [receiptTextCustomer, setReceiptTextCustomer] = useState('');
    const [receiptTextStaff, setReceiptTextStaff] = useState('');
    const [receiptImgCustomer, setReceiptImgCustomer] = useState<string | null>(null);

    const copyText = async (text: string) => {
        try {
            await navigator?.clipboard?.writeText?.(text);
            message.success('复制成功');
        } catch (e) {
            console.error(e);
            message.error('复制失败，请检查权限');
        }
    };


    // 从详情数据生成两段文案
    const buildReceiptTextsFromDetail = () => {
        const o: any = order || {};
        const projectName = o?.project?.name || o?.projectSnapshot?.name || '-';
        const billingModeLocal = String(o?.projectSnapshot?.billingMode ?? o?.project?.billingMode ?? '');
        const isHourlyLocal = billingModeLocal === 'HOURLY';

        const orderNo = String(o?.autoSerial ?? o?.id ?? '-');
        const customerId = o?.customerGameId ?? '-';
        const csName = o?.dispatcher?.name || o?.dispatcher?.phone || '客服';

        const pickPlayersText = (detail: any) => {
            const cd = detail?.currentDispatch;
            const cdParts = Array.isArray(cd?.participants) ? cd.participants : [];
            const active = cdParts.filter((p: any) => p?.isActive !== false);

            const fallbackDispatches = Array.isArray(detail?.dispatches) ? detail.dispatches : [];
            const last = fallbackDispatches.length ? fallbackDispatches[fallbackDispatches.length - 1] : null;
            const lastParts = Array.isArray(last?.participants) ? last.participants : [];

            const parts = active.length ? active : lastParts;

            const names = parts
                .map((p: any) => p?.user?.name || p?.user?.nickname || p?.user?.phone || p?.userId)
                .filter(Boolean);

            return names.length ? names.join('、') : '（待派单/待接单）';
        };

        const playerNames = pickPlayersText(o);

        const unitPrice = Number(o?.projectSnapshot?.price ?? o?.project?.price);
        const paid = Number(o?.paidAmount ?? o?.receivableAmount);
        const estHours =
            isHourlyLocal && Number.isFinite(unitPrice) && unitPrice > 0 && Number.isFinite(paid) && paid >= 0
                ? paid / unitPrice
                : null;

        const orderTime = o?.orderTime ? dayjs(o.orderTime) : dayjs(o?.createdAt || new Date());
        const endTime = isHourlyLocal && estHours != null ? orderTime.add(estHours, 'hour').add(20, 'minute') : null;

        const baseWan = o?.baseAmountWan ?? null;

        const customerText = [
            `下单项目：${projectName}`,
            `订单${estHours != null ? '时长' : '保底'}：${
                isHourlyLocal ? `${estHours != null ? estHours.toFixed(2) : '-'} 小时` : `${baseWan ?? '-'} 万`
            }`,
            `接待客服：${csName}`,
            `接待陪玩：${playerNames}`,
            isHourlyLocal ? `预计结单时间：${endTime ? endTime.format('YYYY-MM-DD HH:mm') : '-'}` : '',
            `下单时间：${orderTime.format('YYYY-MM-DD HH:mm')}`,
            `预计等待时间：5-10分钟`,
            ``,
            `温馨提醒：`,
            `消费过程中如遇任何问题，请随时联系本单客服处理～`,
            `订单完结24小时内支持售后，客服为售后唯一渠道；`,
            `请勿相信其他任何人，谨防上当受骗。`,
        ]
            .filter(Boolean)
            .join('\n');

        const staffText = [
            `订单编号：${orderNo}`,
            `客户ID：${customerId}`,
            `接单陪玩：${playerNames}`,
            `开单时间：${orderTime.format('YYYY-MM-DD HH:mm')}`,
            `派单客服：${csName}`,
            `实时单，请在 3 分钟内完成对接。`,
        ].join('\n');

        return { customerText, staffText };
    };

    const openReceipt = (type: 'customer' | 'staff') => {
        const { customerText, staffText } = buildReceiptTextsFromDetail();
        setReceiptTextCustomer(customerText);
        setReceiptTextStaff(staffText);
        // setReceiptImgCustomer(generateReceiptImage('蓝猫爽打-订单小票', customerText));
        setReceiptImgCustomer(
            generateReceiptImage('蓝猫爽打-订单小票', customerText, {
                width: 560,
                theme: { accent: '#22d3ee', accent2: '#a78bfa' },
            }),
        );
        setReceiptType(type);
        setReceiptOpen(true);
    };

    const currentDispatch = order?.currentDispatch;

    const canDispatch = useMemo(() => {
        if (!order) return false;
        if (order?.status === 'COMPLETED' || order?.status === 'REFUNDED') return false;

        if (!currentDispatch?.id) return order?.status === 'WAIT_ASSIGN';

        const ds = String(currentDispatch.status);
        if (ds === 'WAIT_ASSIGN' || ds === 'WAIT_ACCEPT' || ds === 'ARCHIVED') return true;
        return false;
    }, [order, currentDispatch]);

    const openAdjust = (settlement: any) => {
        setCurrentSettlement(settlement);
        adjustForm.setFieldsValue({
            finalEarnings: settlement?.finalEarnings,
            remark: '',
        });
        setAdjustOpen(true);
    };

    const submitAdjust = async () => {
        try {
            const v = await adjustForm.validateFields();
            setAdjustSubmitting(true);
            await adjustSettlementFinalEarnings({
                settlementId: Number(currentSettlement.id),
                finalEarnings: Number(v.finalEarnings),
                remark: v.remark || undefined,
            });
            message.success('已调整实际收益');
            setAdjustOpen(false);
            await loadDetail();
        } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || '调整失败');
        } finally {
            setAdjustSubmitting(false);
        }
    };

    const billingMode = useMemo(() => {
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
            const list = Array.isArray(res) ? res : res?.data ?? [];
            setPlayerOptions(
                list.map((u: any) => ({
                    value: Number(u.id),
                    label: `${u?.name || '未命名'}-${u?.ratingName ?? '-'}-今日已接${u?.todayHandledCount ?? 0}`,
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

    // 打开派单/更新参与者（移动端用 Drawer）
    const openDispatchModal = async () => {
        setDispatchRemark('');

        if (currentDispatch?.status === 'ARCHIVED') {
            setSelectedPlayers([]);
        } else {
            const actives = currentDispatch?.participants?.filter((p: any) => p.isActive !== false) || [];
            setSelectedPlayers(actives.map((p: any) => Number(p.userId)).filter((n: number) => !Number.isNaN(n)));
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

            const canUpdateParticipants =
                currentDispatch?.id && (currentDispatch.status === 'WAIT_ASSIGN' || currentDispatch.status === 'WAIT_ACCEPT');

            if (canUpdateParticipants) {
                await updateDispatchParticipants({
                    dispatchId: Number(currentDispatch.id),
                    playerIds: selectedPlayers,
                    remark: dispatchRemark || undefined,
                });
            } else {
                await assignDispatch(Number(order?.id), {
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
            paidAmount: order?.paidAmount,
            remark: '',
            // ✅ 小时单补收：订单当前是未收款时，默认勾选“补收完成后一并确认收款”
            confirmPaid: !order?.isGifted && order?.isPaid === false,
        });
        setPaidModalOpen(true);
    };

    const submitPaidAmount = async () => {
        try {
            const values = await paidForm.validateFields();
            setPaidSubmitting(true);

            await updateOrderPaidAmount({
                id: Number(order?.id),
                paidAmount: Number(values.paidAmount),
                remark: values.remark || undefined,
                // ✅ 新增：补收后是否一并确认收款
                confirmPaid: values.confirmPaid !== false,
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
        { title: '接单时间', dataIndex: 'acceptedAt', render: (v: any) => (v ? new Date(v).toLocaleString() : '-') },
        { title: '保底进度（万）', dataIndex: 'progressBaseWan', render: (v: any) => (v == null ? '-' : v) },
        { title: '贡献金额', dataIndex: 'contributionAmount', render: (v: any) => (v == null ? '-' : v) },
    ];

    const statusTag = (group: keyof DictMap, value: any) => {
        const text = t(group, value, String(value));
        const v = String(value);
        const color =
            v.includes('WAIT')
                ? 'orange'
                : v.includes('ACCEPT')
                ? 'blue'
                : v.includes('ARCH')
                    ? 'gold'
                    : v.includes('COMP')
                        ? 'green'
                        : v.includes('CANCEL') || v.includes('REFUND')
                            ? 'red'
                            : 'default';

        return <Tag color={color}>{text}</Tag>;
    };

    // ✅ 剩余保底计算
    const baseAmountWan = useMemo(() => {
        const v = order?.baseAmountWan;
        return v == null ? null : Number(v);
    }, [order]);

    const totalProgressWan = useMemo(() => {
        const dispatches = Array.isArray(order?.dispatches) ? order?.dispatches : [];
        let sum = 0;
        for (const d of dispatches) {
            const parts = Array.isArray(d?.participants) ? d.participants : [];
            for (const p of parts) sum += Number(p?.progressBaseWan ?? 0);
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

    // ✅ settlement map
    const settlementMap = useMemo(() => {
        const map = new Map<string, any>();
        const list = Array.isArray(order?.settlements) ? order?.settlements : [];
        for (const s of list) map.set(`${s.dispatchId}_${s.userId}`, s);
        return map;
    }, [order]);

    const historyDispatches = useMemo(() => {
        const list = Array.isArray(order?.dispatches) ? order?.dispatches : [];
        return list;
    }, [order]);

    const historyColumns = [
        { title: '轮次', dataIndex: 'round', width: 80 },
        { title: '派单状态', dataIndex: 'status', width: 120, render: (v: any) => statusTag('DispatchStatus', v) },
        { title: '派单时间', dataIndex: 'assignedAt', width: 180, render: (v: any) => (v ? new Date(v).toLocaleString() : '-') },
        { title: '全员接单', dataIndex: 'acceptedAllAt', width: 180, render: (v: any) => (v ? new Date(v).toLocaleString() : '-') },
        { title: '存单时间', dataIndex: 'archivedAt', width: 180, render: (v: any) => (v ? new Date(v).toLocaleString() : '-') },
        { title: '结单时间', dataIndex: 'completedAt', width: 180, render: (v: any) => (v ? new Date(v).toLocaleString() : '-') },
        { title: '备注', dataIndex: 'remark', ellipsis: true, render: (v: any) => v || '-' },
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
        { title: '接单时间', dataIndex: 'acceptedAt', render: (v: any) => (v ? new Date(v).toLocaleString() : '-') },
        { title: '保底进度（万）', dataIndex: 'progressBaseWan', render: (v: any) => (v == null ? '-' : v) },
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
        {
            title: '操作',
            width: 120,
            render: (_: any, row: any) => {
                const key = `${row.dispatchId}_${row.userId}`;
                const s = settlementMap.get(key);
                if (!s) return '-';
                return (
                    <Button size="small" onClick={() => openAdjust(s)}>
                        调整收益
                    </Button>
                );
            },
        },
    ];

    const hideCurrentParticipants = order?.status === 'COMPLETED';

    const primaryActionText =
        currentDispatch?.id && ['WAIT_ASSIGN', 'WAIT_ACCEPT', 'WAIT_ACCEPT'].includes(currentDispatch.status)
            ? '更新参与者'
            : '派单';

    const openActionDispatch = () => {
        if (forbidEdit) return;
        openDispatchModal();
    };

    const openActionPaid = () => {
        if (!isHourly) return;
        openPaidModal();
    };

    // ===== App 化样式 helpers（移动端）=====
    const cardStyleMobile: React.CSSProperties = {
        borderRadius: 18,
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
    };

    const cardBodyMobile: React.CSSProperties = { padding: 14 };

    // ===== Mobile: 头部卡片（更 App 化）=====
    const MobileHeader = (
        <Card
            loading={loading}
            style={{
                ...cardStyleMobile,
                background: 'linear-gradient(135deg, rgba(22,119,255,0.10), rgba(16,185,129,0.06))',
            }}
            bodyStyle={cardBodyMobile}
        >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Space direction="vertical" size={2}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            订单详情
                        </Typography.Text>
                        <Typography.Text strong style={{ fontSize: 18, letterSpacing: 0.2 }}>
                            {order?.autoSerial || '-'}
                        </Typography.Text>
                    </Space>

                    <Space size={6} wrap>
                        {statusTag('OrderStatus', order?.status)}
                        {currentDispatch?.status ? statusTag('DispatchStatus', currentDispatch.status) : <Tag>-</Tag>}
                    </Space>
                </Space>

                <Space size={8} wrap>
                    <Tag color="geekblue" style={{ borderRadius: 999 }}>
                        实付 ¥{order?.paidAmount ?? '-'}
                    </Tag>
                    <Tag style={{ borderRadius: 999 }}>应收 ¥{order?.receivableAmount ?? '-'}</Tag>
                    {isHourly ? <Tag color="blue" style={{ borderRadius: 999 }}>小时单</Tag> : null}
                    {isGuaranteed ? <Tag color="gold" style={{ borderRadius: 999 }}>保底单</Tag> : null}
                    {remainingBaseWan == null ? null : (
                        <Tag color={remainingBaseColor as any} style={{ borderRadius: 999 }}>
                            剩余保底 {remainingBaseWan}
                        </Tag>
                    )}
                    {order?.isGifted ? <Tag style={{ borderRadius: 999 }}>赠送</Tag> : order?.isPaid === false ? (
                        <Tag color="red" style={{ borderRadius: 999 }}>未收款</Tag>
                    ) : (
                        <Tag color="green" style={{ borderRadius: 999 }}>已收款</Tag>
                    )}
                </Space>

                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                        项目：{order?.project?.name || order?.projectSnapshot?.name || '-'}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                        客户游戏ID：{order?.customerGameId ?? '-'}
                    </Typography.Text>
                </Space>
            </Space>
        </Card>
    );

    // ===== Mobile: “第一屏快捷区” —— 小票放这里（你要的）=====
    const MobileQuickActions = (
        <Card style={cardStyleMobile} bodyStyle={cardBodyMobile}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Typography.Text strong style={{ fontSize: 15 }}>
                        快捷操作
                    </Typography.Text>
                    <Button size="small" icon={<ReloadOutlined />} onClick={() => loadDetail()}>
                        刷新
                    </Button>
                </Space>

                <Row gutter={[10, 10]}>
                    <Col span={12}>
                        <Button
                            type="primary"
                            icon={<FileImageOutlined />}
                            block
                            style={{ height: 44, borderRadius: 14 }}
                            onClick={() => openReceipt('customer')}
                        >
                            订单小票
                        </Button>
                    </Col>
                    {!order?.isGifted && order?.isPaid === false ? (
                        <Col span={12}>
                            <Button
                                type="primary"
                                block
                                style={{ height: 44, borderRadius: 14 }}
                                onClick={openMarkPaidModal}
                            >
                                确认收款
                            </Button>
                        </Col>
                    ) : null}
                    <Col span={12}>
                        <Button
                            icon={<CopyOutlined />}
                            block
                            style={{ height: 44, borderRadius: 14 }}
                            onClick={async () => {
                                const { staffText } = buildReceiptTextsFromDetail();
                                await copyText(staffText);
                            }}
                        >
                            复制派单话术
                        </Button>
                    </Col>

                    <Col span={12}>
                        <Button
                            icon={<ThunderboltOutlined />}
                            block
                            disabled={!canDispatch || forbidEdit}
                            style={{ height: 44, borderRadius: 14 }}
                            onClick={openActionDispatch}
                        >
                            {primaryActionText}
                        </Button>
                    </Col>

                    <Col span={12}>
                        <Button
                            icon={<DollarOutlined />}
                            block
                            disabled={!isHourly}
                            style={{ height: 44, borderRadius: 14 }}
                            onClick={openActionPaid}
                        >
                            修改实付
                        </Button>
                    </Col>
                </Row>

                <Space size={8} wrap>
                    <Tag style={{ borderRadius: 999 }}>
                        派单客服：{order?.dispatcher ? `${order?.dispatcher.name || '-'}（${order?.dispatcher.phone || '-'}）` : '-'}
                    </Tag>
                    <Tag style={{ borderRadius: 999 }}>下单：{order?.orderTime ? new Date(order.orderTime).toLocaleString() : '-'}</Tag>
                </Space>
            </Space>
        </Card>
    );

    // ===== Mobile: 当前参与者卡片列表 =====
    const MobileParticipants = (
        <Card title="当前参与者（本轮）" style={cardStyleMobile} bodyStyle={cardBodyMobile}>
            {participantRows?.length ? (
                <List
                    dataSource={participantRows}
                    renderItem={(p: any) => {
                        const u = p?.user || {};
                        return (
                            <List.Item style={{ paddingLeft: 0, paddingRight: 0 }}>
                                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                                        <Typography.Text strong>
                                            {u?.name || '未命名'}（{u?.phone || '-'}）
                                        </Typography.Text>
                                        <Tag style={{ borderRadius: 999 }}>{p?.acceptedAt ? '已接单' : '未接单'}</Tag>
                                    </Space>
                                    <Space size={8} wrap>
                                        <Tag style={{ borderRadius: 999 }}>保底进度：{p?.progressBaseWan ?? '-'}</Tag>
                                        {p?.contributionAmount != null ? <Tag style={{ borderRadius: 999 }}>贡献：{p?.contributionAmount}</Tag> : null}
                                    </Space>
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                        接单时间：{p?.acceptedAt ? new Date(p.acceptedAt).toLocaleString() : '-'}
                                    </Typography.Text>
                                </Space>
                            </List.Item>
                        );
                    }}
                />
            ) : (
                <div>
                    <Tag color="orange" style={{ borderRadius: 999 }}>{currentDispatch?.id ? '暂无参与者' : '当前还未派单'}</Tag>
                </div>
            )}
        </Card>
    );

    // ===== Mobile: 历史派单卡片列表 =====
    const MobileHistory = (
        <Card title="历史派单（按轮次）" style={cardStyleMobile} bodyStyle={cardBodyMobile}>
            {historyDispatches?.length ? (
                <Collapse
                    accordion
                    items={historyDispatches.map((d: any) => {
                        const parts = Array.isArray(d?.participants) ? d.participants : [];
                        const data = parts.map((p: any) => ({ ...p, dispatchId: d.id, dispatchStatus: d.status }));
                        return {
                            key: String(d?.id),
                            label: (
                                <Space size={8} wrap>
                                    <Tag style={{ borderRadius: 999 }}>第 {d?.round ?? '-'} 轮</Tag>
                                    {statusTag('DispatchStatus', d?.status)}
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                        派单：{d?.assignedAt ? new Date(d.assignedAt).toLocaleString() : '-'}
                                    </Typography.Text>
                                </Space>
                            ),
                            children: (
                                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                            全员接单：{d?.acceptedAllAt ? new Date(d.acceptedAllAt).toLocaleString() : '-'}
                                        </Typography.Text>
                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                            存单：{d?.archivedAt ? new Date(d.archivedAt).toLocaleString() : '-'}
                                        </Typography.Text>
                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                            结单：{d?.completedAt ? new Date(d.completedAt).toLocaleString() : '-'}
                                        </Typography.Text>
                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                            备注：{d?.remark || '-'}
                                        </Typography.Text>
                                    </Space>

                                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                        {data.length ? (
                                            data.map((row: any) => {
                                                const u = row?.user || {};
                                                const key = `${row.dispatchId}_${row.userId}`;
                                                const s = settlementMap.get(key);
                                                const v = s?.finalEarnings;

                                                return (
                                                    <Card
                                                        key={row?.id}
                                                        size="small"
                                                        style={{ borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}
                                                        bodyStyle={{ padding: 12 }}
                                                    >
                                                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                                            <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                                                                <Typography.Text strong>
                                                                    {u?.name || '未命名'}（{u?.phone || '-'}）
                                                                </Typography.Text>
                                                                <Tag style={{ borderRadius: 999 }}>{row?.acceptedAt ? '已接' : '未接'}</Tag>
                                                            </Space>

                                                            <Space size={8} wrap>
                                                                <Tag style={{ borderRadius: 999 }}>保底进度：{row?.progressBaseWan ?? '-'}</Tag>
                                                                <Tag style={{ borderRadius: 999 }}>收益：{v == null ? '-' : `¥${v}`}</Tag>
                                                            </Space>

                                                            <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                                                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                                                    接单：{row?.acceptedAt ? new Date(row.acceptedAt).toLocaleString() : '-'}
                                                                </Typography.Text>
                                                                {s ? (
                                                                    <Button size="small" onClick={() => openAdjust(s)} style={{ borderRadius: 10 }}>
                                                                        调整收益
                                                                    </Button>
                                                                ) : (
                                                                    <span />
                                                                )}
                                                            </Space>
                                                        </Space>
                                                    </Card>
                                                );
                                            })
                                        ) : (
                                            <Tag style={{ borderRadius: 999 }}>该轮无参与者</Tag>
                                        )}
                                    </Space>
                                </Space>
                            ),
                        };
                    })}
                />
            ) : (
                <Tag style={{ borderRadius: 999 }}>暂无历史派单</Tag>
            )}
        </Card>
    );

    // ===== Mobile: 基础信息（Descriptions 单列）=====
    const MobileInfo = (
        <Card style={cardStyleMobile} bodyStyle={cardBodyMobile}>
            <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="计费类型">{t('BillingMode', billingMode, billingMode)}</Descriptions.Item>
                <Descriptions.Item label="订单保底（万）">{baseAmountWan ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="付款时间">
                    {order?.paymentTime ? new Date(order?.paymentTime).toLocaleString() : '-'}
                </Descriptions.Item>
            </Descriptions>
        </Card>
    );

    // ===== PC：基本沿用你原来的（保持习惯）=====
    const DesktopView = (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Card
                title={`订单详情：${order?.autoSerial || '-'}`}
                loading={loading}
                extra={
                    <Space>
                        <Button onClick={() => openReceipt('staff')}>订单小票</Button>
                        {!order?.isGifted && order?.isPaid === false ? (
                            <Button
                                type="primary"
                                onClick={openMarkPaidModal}>
                                确认收款
                            </Button>
                        ) : null}
                        {order?.status !== 'REFUNDED' && <Button danger onClick={() => setRefundOpen(true)}>退款</Button>}
                        <Button type="primary" disabled={forbidEdit} onClick={openEditModal}>编辑订单</Button>

                        <Button onClick={openDispatchModal} disabled={!canDispatch || forbidEdit}>
                            {primaryActionText}
                        </Button>

                        <Button disabled={!isHourly} onClick={openPaidModal}>
                            小时单补收修改实付
                        </Button>
                    </Space>
                }
            >
                <Descriptions column={2} bordered size="small">
                    <Descriptions.Item label="订单状态">{statusTag('OrderStatus', order?.status)}</Descriptions.Item>
                    <Descriptions.Item label="当前派单状态">
                        {currentDispatch?.status ? statusTag('DispatchStatus', currentDispatch.status) : '-'}
                    </Descriptions.Item>

                    <Descriptions.Item label="项目">{order?.project?.name || order?.projectSnapshot?.name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="计费类型">{t('BillingMode', billingMode, billingMode)}</Descriptions.Item>

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
                        {order?.dispatcher ? `${order?.dispatcher.name || '-'}（${order?.dispatcher.phone || '-'}）` : '-'}
                    </Descriptions.Item>

                    <Descriptions.Item label="下单时间">{order?.orderTime ? new Date(order?.orderTime).toLocaleString() : '-'}</Descriptions.Item>
                    <Descriptions.Item label="付款时间">{order?.paymentTime ? new Date(order?.paymentTime).toLocaleString() : '-'}</Descriptions.Item>
                    <Descriptions.Item label="收款状态">
                        {order?.isGifted ? <Tag>赠送</Tag> : order?.isPaid === false ? <Tag color="red">未收款</Tag> : <Tag color="green">已收款</Tag>}
                    </Descriptions.Item>
                </Descriptions>
            </Card>

            {order?.status !== 'REFUNDED' && !hideCurrentParticipants ? (
                <Card title="当前参与者（本轮）" loading={loading}>
                    <Table rowKey="id" columns={participantColumns as any} dataSource={participantRows} pagination={false} />
                    {!currentDispatch?.id ? (
                        <div style={{ marginTop: 12 }}>
                            <Tag color="orange">当前还未派单</Tag>
                        </div>
                    ) : null}
                </Card>
            ) : null}

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
                            const data = parts.map((p: any) => ({
                                ...p,
                                dispatchId: dispatchRow.id,
                                dispatchStatus: dispatchRow.status,
                            }));
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
            </Card>
        </Space>
    );
    // ===== Mobile：更 App 化布局 =====
    const MobileView = (
        <div style={{ padding: 12, paddingBottom: 76, background: '#f5f6f8',maxWidth: 480, minHeight: '100vh' }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {MobileHeader}

                <Tabs
                    defaultActiveKey="overview"
                    items={[
                        {
                            key: 'overview',
                            label: '概览',
                            children: (
                                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                    {/* ✅ 你要的：小票入口放第一页（概览） */}
                                    {MobileQuickActions}
                                    {MobileInfo}
                                    {order?.status !== 'REFUNDED' && !hideCurrentParticipants ? MobileParticipants : null}
                                </Space>
                            ),
                        },
                        {
                            key: 'history',
                            label: '历史',
                            children: <Space direction="vertical" size={12} style={{ width: '100%' }}>{MobileHistory}</Space>,
                        },
                        {
                            key: 'more',
                            label: '更多',
                            children: (
                                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                    <Card style={cardStyleMobile} bodyStyle={cardBodyMobile}>
                                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                            <Button block icon={<FileImageOutlined />} onClick={() => openReceipt('customer')} style={{ borderRadius: 14, height: 44 }}>
                                                订单小票
                                            </Button>

                                            {order?.status !== 'REFUNDED' ? (
                                                <Button danger block onClick={() => setRefundOpen(true)} style={{ borderRadius: 14, height: 44 }}>
                                                    退款
                                                </Button>
                                            ) : null}

                                            <Button
                                                type="primary"
                                                block
                                                icon={<EditOutlined />}
                                                disabled={forbidEdit}
                                                onClick={openEditModal}
                                                style={{ borderRadius: 14, height: 44 }}
                                            >
                                                编辑订单
                                            </Button>
                                        </Space>
                                    </Card>
                                </Space>
                            ),
                        },
                    ]}
                />

                {/* 底部固定操作条：更像 App */}
                <div
                    style={{
                        position: 'fixed',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.92)',
                        backdropFilter: 'blur(10px)',
                        borderTop: '1px solid rgba(0,0,0,0.06)',
                        zIndex: 99,
                    }}
                >
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Button
                            type="primary"
                            icon={<ThunderboltOutlined />}
                            disabled={!canDispatch || forbidEdit}
                            onClick={openDispatchModal}
                            style={{ borderRadius: 14, flex: 1, height: 44 }}
                        >
                            {primaryActionText}
                        </Button>

                        <Button onClick={() => history.push('/orders')} icon={<ProfileOutlined />} style={{ borderRadius: 14, height: 44 }}>
                            订单
                        </Button>

                        <Button onClick={() => history.push('/wallet/overview')} icon={<WalletOutlined />} style={{ borderRadius: 14, height: 44 }}>
                            钱包
                        </Button>
                    </Space>
                </div>
            </Space>
        </div>
    );

    return (
        <PageContainer title={isMobile ? false : undefined} contentStyle={isMobile ? { padding: 0, maxWidth: '100%' } : undefined}>
            {isMobile ? MobileView : DesktopView}

            {/* 派单 / 更新参与者：PC 用 Modal；Mobile 用 Drawer bottom sheet */}
            {isMobile ? (
                <Drawer
                    title={
                        currentDispatch?.id && (currentDispatch.status === 'WAIT_ASSIGN' || currentDispatch.status === 'WAIT_ACCEPT')
                            ? '更新参与者'
                            : '派单'
                    }
                    placement="bottom"
                    height="72vh"
                    open={dispatchModalOpen}
                    onClose={() => setDispatchModalOpen(false)}
                    destroyOnClose
                    extra={
                        <Button type="primary" onClick={submitDispatchOrUpdate} loading={dispatchSubmitting} style={{ borderRadius: 12 }}>
                            确认
                        </Button>
                    }
                >
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span>选择打手（仅空闲可选，最多 2 人）</span>
                            <Button size="small" onClick={() => fetchPlayers('')} icon={<ReloadOutlined />}>
                                刷新
                            </Button>
                        </div>
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

                    {currentDispatch?.id && (currentDispatch.status === 'WAIT_ASSIGN' || currentDispatch.status === 'WAIT_ACCEPT') ? (
                        <div style={{ marginTop: 12 }}>
                            <Tag color="gold" style={{ borderRadius: 999 }}>
                                提示：若已有打手接单，将禁止修改参与者（请存单后重新派单）。
                            </Tag>
                        </div>
                    ) : null}
                </Drawer>
            ) : (
                <Modal
                    title={
                        currentDispatch?.id && (currentDispatch.status === 'WAIT_ASSIGN' || currentDispatch.status === 'WAIT_ACCEPT')
                            ? '更新参与者'
                            : '派单'
                    }
                    open={dispatchModalOpen}
                    onCancel={() => setDispatchModalOpen(false)}
                    onOk={submitDispatchOrUpdate}
                    confirmLoading={dispatchSubmitting}
                    destroyOnClose
                >
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span>选择打手（仅空闲可选，最多 2 人）</span>
                            <Button size="small" onClick={() => fetchPlayers('')} icon={<ReloadOutlined />}>
                                刷新
                            </Button>
                        </div>
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

                    {currentDispatch?.id && (currentDispatch.status === 'WAIT_ASSIGN' || currentDispatch.status === 'WAIT_ACCEPT') ? (
                        <div style={{ marginTop: 12 }}>
                            <Tag color="gold" style={{ borderRadius: 999 }}>
                                提示：若已有打手接单，将禁止修改参与者（请存单后重新派单）。
                            </Tag>
                        </div>
                    ) : null}
                </Modal>
            )}

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
                                    if (order?.paidAmount != null && nv < Number(order?.paidAmount)) {
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
                    <Form.Item
                        name="confirmPaid"
                        valuePropName="checked"
                        extra="勾选后会将订单标记为已收款，并写入付款时间"
                    >
                        <Checkbox>勾选后即视为订单已收款入账</Checkbox>
                    </Form.Item>

                    <Tag color="blue" style={{ borderRadius: 999 }}>该操作会写入操作日志（UPDATE_PAID_AMOUNT）。</Tag>
                </Form>
            </Modal>

            {/* 调整收益 */}
            <Modal
                title="调整实际收益（奖惩/纠错）"
                open={adjustOpen}
                onCancel={() => setAdjustOpen(false)}
                onOk={submitAdjust}
                confirmLoading={adjustSubmitting}
                destroyOnClose
            >
                <Form form={adjustForm} layout="vertical">
                    <Form.Item
                        name="finalEarnings"
                        label="实际收益"
                        rules={[
                            { required: true, message: '请输入实际收益' },
                            () => ({
                                validator: async (_, val) => {
                                    const n = Number(val);
                                    if (!Number.isFinite(n)) throw new Error('金额非法');
                                },
                            }),
                        ]}
                    >
                        <InputNumber precision={2} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="remark" label="调整原因（必填建议）" rules={[{ required: true, message: '请填写调整原因' }]}>
                        <Input placeholder="例如：违规扣款/优秀奖励/客服补偿" allowClear />
                    </Form.Item>
                    <Tag color="gold" style={{ borderRadius: 999 }}>该操作会写入操作日志（ADJUST_SETTLEMENT）。</Tag>
                </Form>
            </Modal>

            {/* 退款 */}
            <Modal
                open={refundOpen}
                onCancel={() => setRefundOpen(false)}
                onOk={submitRefund}
                confirmLoading={refundLoading}
                title="订单退款"
            >
                <Input.TextArea
                    rows={3}
                    value={refundRemark}
                    onChange={(e) => setRefundRemark(e.target.value)}
                    placeholder="退款备注（可选）"
                />
            </Modal>

            {/* 编辑订单 */}
            <OrderUpsertModal
                open={editOpen}
                title="编辑订单"
                initialValues={{
                    id: order?.id,
                    projectId: order?.projectId,
                    customerGameId: order?.customerGameId,
                    orderTime: order?.orderTime,
                    paymentTime: order?.paymentTime,
                    csRate: order?.csRate,
                    inviteRate: order?.inviteRate,
                    inviter: order?.inviter,
                    customClubRate: order?.customClubRate,
                    remark: '',
                }}
                onCancel={() => setEditOpen(false)}
                onSubmit={async (payload) => {
                    await updateOrder(payload);
                    setEditOpen(false);
                    loadDetail();
                }}
            />

            {/* 小票：移动端更贴合 */}
            <Modal
                open={receiptOpen}
                title="订单小票"
                onCancel={() => setReceiptOpen(false)}
                width={isMobile ? '96vw' : 900}
                destroyOnClose
                footer={null}
            >
                <Row gutter={16}>
                    <Col xs={24} lg={12}>
                        <div style={{ border: '1px solid #eee', borderRadius: 14, padding: 12, background: '#fff' }}>
                            <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 10 }}>
                                <Typography.Text strong>客户小票</Typography.Text>
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<CopyOutlined />}
                                    onClick={() => copyText(receiptTextCustomer)}
                                    style={{ borderRadius: 10 }}
                                >
                                    复制文案
                                </Button>
                            </Space>

                            {receiptImgCustomer ? (
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <img
                                        src={receiptImgCustomer}
                                        alt="receipt"
                                        style={{
                                            width: isMobile ? 320 : 360,
                                            maxWidth: '100%',
                                            border: '1px solid #eee',
                                            borderRadius: 14,
                                            background: '#fff',
                                        }}
                                    />
                                </div>
                            ) : null}

                            <div style={{ marginTop: 10, color: 'rgba(0,0,0,.45)', fontSize: 12 }}>
                                提示：小票图片请直接长按/右键复制图片即可。
                            </div>
                        </div>
                    </Col>

                    <Col xs={24} lg={12}>
                        <div style={{ border: '1px solid #eee', borderRadius: 14, padding: 12, background: '#fff' }}>
                            <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 10 }}>
                                <Typography.Text strong>派单话术</Typography.Text>
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<CopyOutlined />}
                                    onClick={() => copyText(receiptTextStaff)}
                                    style={{ borderRadius: 10 }}
                                >
                                    一键复制
                                </Button>
                            </Space>

                            <Input.TextArea value={receiptTextStaff} readOnly rows={isMobile ? 5 : 8} />

                            <div style={{ marginTop: 10, color: 'rgba(0,0,0,.45)', fontSize: 12 }}>
                                提示：建议先复制派单话术发派单群，再复制客户小票发客户。
                            </div>
                        </div>
                    </Col>
                </Row>
            </Modal>

            {/* 移动端：右下角更多导航（可选） */}
            {isMobile ? (
                <FloatButton.Group trigger="click" type="primary" icon={<AppstoreOutlined />} style={{ right: 16, bottom: 92 }}>
                    <FloatButton icon={<ReloadOutlined />} tooltip="刷新" onClick={() => loadDetail()} />
                    <FloatButton icon={<ProfileOutlined />} tooltip="订单列表" onClick={() => history.push('/orders')} />
                    <FloatButton icon={<WalletOutlined />} tooltip="钱包" onClick={() => history.push('/wallet/overview')} />
                    <FloatButton icon={<FileImageOutlined />} tooltip="订单小票" onClick={() => openReceipt('customer')} />
                </FloatButton.Group>
            ) : null}

            <Modal
                open={markPaidOpen}
                title={`确认收款：${order?.autoSerial || ''}`}
                onCancel={() => setMarkPaidOpen(false)}
                onOk={submitMarkPaid}
                confirmLoading={markPaidSubmitting}
                okText="确认"
            >
                <Form form={markPaidForm} layout="vertical">
                    <Form.Item
                        label="实收金额（实付）"
                        name="paidAmount"
                        rules={[{ required: true, message: '请输入实收金额' }]}
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

export default OrderDetailPage;
