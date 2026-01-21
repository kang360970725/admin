// src/pages/Orders/Detail.tsx
import React, {useEffect, useMemo, useState} from 'react';
import {PageContainer} from '@ant-design/pro-components';
import {
    Button,
    Card,
    Checkbox,
    Col,
    Collapse,
    Descriptions,
    Drawer,
    FloatButton,
    Form,
    Input,
    InputNumber,
    List,
    message,
    Modal,
    Row,
    Select,
    Space,
    Table,
    Tabs,
    Tag,
    Typography,
} from 'antd';
import {
    AppstoreOutlined,
    CheckCircleOutlined,
    CopyOutlined,
    DollarOutlined,
    EditOutlined,
    FileImageOutlined,
    ProfileOutlined,
    ReloadOutlined,
    ThunderboltOutlined,
    WalletOutlined,
} from '@ant-design/icons';
import {history, useModel, useParams} from '@umijs/max';
import OrderUpsertModal from './components/OrderForm';

import {
    adjustSettlementFinalEarnings,
    assignDispatch,
    confirmCompleteOrder,
    getEnumDicts,
    getOrderDetail,
    getPlayerOptions,
    markOrderPaid,
    recalculateOrderSettlements,
    refundOrder,
    repairWalletBySettlements,
    updateArchivedProgressTotal,
    updateDispatchParticipants,
    updateOrder,
    updateOrderPaidAmount,
} from '@/services/api';
import dayjs from 'dayjs';
import {useIsMobile} from '@/utils/useIsMobile';
import {generateReceiptImage} from '@/utils/receiptImage';

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

    // ✅ 修复工具（重新结算 / 钱包对齐）
    const [toolsOpen, setToolsOpen] = useState(false);
    const [toolsLoading, setToolsLoading] = useState(false);
    const [toolsResult, setToolsResult] = useState<any>(null);
    const [toolsRemark, setToolsRemark] = useState<string>('');

    // ✅ 工具流程：先重新结算（不动钱包）=> 再钱包对齐预览 => 再执行钱包对齐
    const [toolsStep, setToolsStep] = useState<'INIT' | 'RECALCED' | 'PREVIEWED'>('INIT');
    const [recalcResult, setRecalcResult] = useState<any>(null);
    const [walletPreview, setWalletPreview] = useState<any>(null);
    const [walletApplyResult, setWalletApplyResult] = useState<any>(null);

    // ✅ 存单后修复（方案 B）：仅对 ARCHIVED 轮展示
    const [archFixOpen, setArchFixOpen] = useState(false);
    const [archFixSubmitting, setArchFixSubmitting] = useState(false);
    const [archFixDispatch, setArchFixDispatch] = useState<any>(null);
    const [archFixTotalWan, setArchFixTotalWan] = useState<number | null>(null);

// ✅ 客服确认结单（两段式结单第二步）
    const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
    const [confirmCompleteLoading, setConfirmCompleteLoading] = useState(false);
    const [confirmCompleteRemark, setConfirmCompleteRemark] = useState('');

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

    const toCents = (v: any) => {
        const n = Number(v ?? 0);
        if (!Number.isFinite(n)) return 0;
        return Math.round(n * 100);
    };

    const centsToMoney = (cents: number) => {
        const n = Number(cents ?? 0);
        const yuan = n / 100;
        // 保留 2 位（去掉浮点尾巴）
        return yuan.toFixed(2);
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


    // ==========================
    // 修复工具：钱包对齐 / 重新结算
    // - 强引导：先“重新结算（不动钱包）”，再“钱包对齐预览”，最后“执行钱包对齐”
    // - 结果不再直接 dump JSON；尽可能用“普通客服能读懂”的方式呈现
    // ==========================
    const fmtMoney = (n: any) => {
        const x = Number(n);
        if (!Number.isFinite(x)) return '-';
        return `¥${x.toFixed(2)}`;
    };

    const fmtWan = (n: any) => {
        const x = Number(n);
        if (!Number.isFinite(x)) return '-';
        // 进度字段是“万”整数为主，这里保持原样展示（若你后端是 Decimal，也不影响）
        return String(x);
    };

    const openTools = () => {
        setToolsRemark('');
        setToolsResult(null);

        // ✅ 重置流程
        setToolsStep('INIT');
        setRecalcResult(null);
        setWalletPreview(null);
        setWalletApplyResult(null);

        setToolsOpen(true);
    };

    //重新结算方法不动钱包
    const runRecalculate = async () => {
        if (!order?.id) return;
        try {
            setToolsLoading(true);

            const res = await recalculateOrderSettlements({
                id: Number(order.id),
                reason: toolsRemark || undefined,
                scope: 'COMPLETED_AND_ARCHIVED',
                allowWalletSync: false, // ✅ 最安全：不动钱包
            });

            setToolsResult(res);
            setRecalcResult(res);
            setToolsStep('RECALCED');

            // ✅ 一旦重新结算，旧的预览/执行结果应失效
            setWalletPreview(null);
            setWalletApplyResult(null);

            message.success('重新结算完成（未同步钱包）');
            await loadDetail();
        } catch (e: any) {
            message.error(e?.response?.data?.message || '重新结算失败');
        } finally {
            setToolsLoading(false);
        }
    };
    //钱包对齐预览
    const runWalletPreview = async () => {
        if (!order?.id) return;
        if (toolsStep !== 'RECALCED') {
            message.warning('请先执行“重新结算（不动钱包）”，再生成钱包对齐预览');
            return;
        }
        try {
            setToolsLoading(true);
            const res = await repairWalletBySettlements({
                id: Number(order.id),
                reason: toolsRemark || undefined,
                scope: 'COMPLETED_AND_ARCHIVED',
                dryRun: true,
            });
            setToolsResult(res);
            setWalletPreview(res);
            setToolsStep('PREVIEWED');
            message.success('已生成钱包对齐预览');
        } catch (e: any) {
            message.error(e?.response?.data?.message || '钱包对齐预览失败');
        } finally {
            setToolsLoading(false);
        }
    };
    //执行钱包对齐
    const runWalletApply = async () => {
        if (!order?.id) return;
        if (toolsStep !== 'PREVIEWED') {
            message.warning('请先生成“钱包对齐预览”，确认无误后再执行');
            return;
        }

        const preview = walletPreview;
        const changes: any[] = Array.isArray(preview?.changes) ? preview.changes : Array.isArray(preview?.items) ? preview.items : [];
        const summary = preview?.summary || {};

        const newCount = Number(summary?.newTxCount ?? 0);
        const adjustCount = Number(summary?.adjustTxCount ?? 0);
        const delta = summary?.totalDelta ?? preview?.totalDelta ?? null;

        Modal.confirm({
            title: '确认执行钱包对齐？',
            content: (
                <Space direction="vertical" size={6}>
                    <Typography.Text>
                        将写入钱包流水 / 冻结记录，用于让“钱包统计/可提现余额”与结算落库保持一致。
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{fontSize: 12}}>
                        预计新增流水：{newCount} 条；调整流水：{adjustCount} 条；净变动：{fmtMoney(delta)}
                    </Typography.Text>
                    <Tag color="gold" style={{borderRadius: 999}}>
                        执行后会影响冻结余额与可提现余额，请务必先核对预览结果。
                    </Tag>
                </Space>
            ),
            okText: '确认执行',
            okButtonProps: {danger: true},
            cancelText: '取消',
            onOk: async () => {
                try {
                    setToolsLoading(true);
                    const res = await repairWalletBySettlements({
                        id: Number(order.id),
                        reason: toolsRemark || undefined,
                        scope: 'COMPLETED_AND_ARCHIVED',
                        dryRun: false,
                    });
                    setToolsResult(res);
                    setWalletApplyResult(res);
                    message.success('钱包对齐已执行');
                    await loadDetail();
                } catch (e: any) {
                    message.error(e?.response?.data?.message || '执行钱包对齐失败');
                } finally {
                    setToolsLoading(false);
                }
            },
        });
    };

    // ===== 工具结果渲染：尽量让普通客服可读 =====
    const ToolStepHeader = (
        <Space size={8} wrap>
            <Tag color={toolsStep === 'INIT' ? 'blue' : 'default'} style={{borderRadius: 999}}>
                ① 重新结算（不动钱包）
            </Tag>
            <Tag color={toolsStep === 'RECALCED' ? 'blue' : toolsStep === 'PREVIEWED' ? 'default' : 'default'}
                 style={{borderRadius: 999}}>
                ② 钱包对齐预览
            </Tag>
            <Tag color={toolsStep === 'PREVIEWED' ? 'blue' : 'default'} style={{borderRadius: 999}}>
                ③ 执行钱包对齐
            </Tag>
        </Space>
    );

    const renderRecalcResult = (res: any) => {
        if (!res) return null;

        // 兼容：若后端暂未提供结构化 diff，这里仍能兜底展示 JSON
        const summary = res?.summary;
        const byDispatch = Array.isArray(res?.byDispatch) ? res.byDispatch : null;

        if (!summary && !byDispatch) {
            return (
                <Card size="small" title="重新结算结果（原始 JSON）">
                    <pre style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                    }}>{JSON.stringify(res, null, 2)}</pre>
                </Card>
            );
        }

        return (
            <Space direction="vertical" size={10} style={{width: '100%'}}>
                <Card size="small" title="重新结算结果（结算已更新，钱包未动）">
                    <Descriptions column={isMobile ? 1 : 3} bordered size="small">
                        <Descriptions.Item label="订单ID">{res?.orderId ?? order?.id ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label="批次号">{res?.settlementBatchId || '-'}</Descriptions.Item>
                        <Descriptions.Item label="是否有变化">
                            {res?.changed === false ? <Tag>无变化</Tag> : <Tag color="green">已更新</Tag>}
                        </Descriptions.Item>

                        <Descriptions.Item
                            label="实收（paidAmount）">{fmtMoney(summary?.paidAmount ?? order?.paidAmount)}</Descriptions.Item>
                        <Descriptions.Item label="平台收益（前）">{fmtMoney(summary?.platformIncomeBefore)}</Descriptions.Item>
                        <Descriptions.Item label="平台收益（后）">{fmtMoney(summary?.platformIncomeAfter)}</Descriptions.Item>

                        <Descriptions.Item
                            label="打手支出（前）">{fmtMoney(summary?.totalPayToPlayersBefore)}</Descriptions.Item>
                        <Descriptions.Item
                            label="打手支出（后）">{fmtMoney(summary?.totalPayToPlayersAfter)}</Descriptions.Item>
                        <Descriptions.Item label="客服抽成（前→后）">
                            {fmtMoney(summary?.customerServiceShareBefore)} → {fmtMoney(summary?.customerServiceShareAfter)}
                        </Descriptions.Item>
                    </Descriptions>
                </Card>

                {byDispatch ? (
                    <Card size="small" title="按轮次变化（建议核对最后一轮 + 有争议的轮次）">
                        <Table
                            size="small"
                            rowKey={(r: any) => String(r.dispatchId)}
                            pagination={false}
                            dataSource={byDispatch}
                            columns={[
                                {title: '轮次ID', dataIndex: 'dispatchId', width: 90},
                                {
                                    title: '状态',
                                    dataIndex: 'status',
                                    width: 120,
                                    render: (v: any) => statusTag('DispatchStatus', v),
                                },
                                {
                                    title: '本轮合计（前→后）',
                                    render: (_: any, r: any) => (
                                        <span>
                                            {fmtMoney(r?.before?.total)} → {fmtMoney(r?.after?.total)}
                                        </span>
                                    ),
                                },
                                {
                                    title: '打手（前→后）',
                                    render: (_: any, r: any) => (
                                        <span>
                                            {fmtMoney(r?.before?.players)} → {fmtMoney(r?.after?.players)}
                                        </span>
                                    ),
                                },
                                {
                                    title: '客服（前→后）',
                                    render: (_: any, r: any) => (
                                        <span>
                                            {fmtMoney(r?.before?.cs)} → {fmtMoney(r?.after?.cs)}
                                        </span>
                                    ),
                                },
                            ] as any}
                            expandable={{
                                expandedRowRender: (r: any) => {
                                    const items = Array.isArray(r?.items) ? r.items : [];
                                    return (
                                        <Table
                                            size="small"
                                            rowKey={(x: any) => String(x.settlementId || `${x.userId}_${x.settlementType}`)}
                                            pagination={false}
                                            dataSource={items}
                                            columns={[
                                                {title: '用户ID', dataIndex: 'userId', width: 90},
                                                {title: '类型', dataIndex: 'settlementType', width: 160},
                                                {
                                                    title: '收益（前→后）',
                                                    render: (_: any, x: any) => (
                                                        <span>
                                                            {fmtMoney(x.beforeFinal)} → {fmtMoney(x.afterFinal)}
                                                        </span>
                                                    ),
                                                },
                                                {
                                                    title: '差额',
                                                    dataIndex: 'diff',
                                                    width: 120,
                                                    render: (v: any) => {
                                                        const n = Number(v);
                                                        if (!Number.isFinite(n)) return '-';
                                                        return <Tag
                                                            color={n === 0 ? 'default' : n > 0 ? 'green' : 'red'}
                                                            style={{borderRadius: 999}}>{fmtMoney(n)}</Tag>;
                                                    },
                                                },
                                            ] as any}
                                        />
                                    );
                                },
                            }}
                        />
                    </Card>
                ) : null}
            </Space>
        );
    };

    const renderWalletPreview = (res: any) => {
        if (!res) return null;
        const summary = res?.summary || {};
        const changes = Array.isArray(res?.changes) ? res.changes : [];

        if (!changes.length) {
            return (
                <Card size="small" title="钱包对齐预览">
                    <Typography.Text type="secondary">暂无可对齐项目（可能结算为 0 或已对齐）。</Typography.Text>
                    <pre style={{
                        marginTop: 8,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                    }}>{JSON.stringify(res, null, 2)}</pre>
                </Card>
            );
        }

        return (
            <Card size="small" title="钱包对齐预览（不会写入钱包）">
                <Space direction="vertical" size={10} style={{width: '100%'}}>
                    <Space size={8} wrap>
                        <Tag style={{borderRadius: 999}}>新增：{summary?.newTxCount ?? '-'}</Tag>
                        <Tag style={{borderRadius: 999}}>调整：{summary?.adjustTxCount ?? '-'}</Tag>
                        <Tag style={{borderRadius: 999}}>无需变化：{summary?.noChangeCount ?? '-'}</Tag>
                        <Tag
                            color={Number(summary?.totalDelta ?? 0) === 0 ? 'default' : Number(summary?.totalDelta ?? 0) > 0 ? 'green' : 'red'}
                            style={{borderRadius: 999}}>
                            净变动：{fmtMoney(summary?.totalDelta)}
                        </Tag>
                    </Space>

                    <Table
                        size="small"
                        rowKey={(r: any) => String(r.settlementId ?? `${r.userId}_${r.dispatchId}`)}
                        pagination={{pageSize: 8, hideOnSinglePage: true} as any}
                        dataSource={changes}
                        columns={[
                            {title: '结算ID', dataIndex: 'settlementId', width: 90},
                            {title: '用户ID', dataIndex: 'userId', width: 80},
                            {title: '轮次', dataIndex: 'dispatchId', width: 80},
                            {
                                title: '变化类型',
                                dataIndex: 'status',
                                width: 120,
                                render: (v: any) => {
                                    const s = String(v || '');
                                    const color = s === 'NEW' ? 'green' : s === 'ADJUST' ? 'gold' : s === 'NO_CHANGE' ? 'default' : 'default';
                                    const text = s === 'NEW' ? '新增冻结流水' : s === 'ADJUST' ? '调整冻结金额' : s === 'NO_CHANGE' ? '无需变化' : s;
                                    return <Tag color={color} style={{borderRadius: 999}}>{text}</Tag>;
                                },
                            },
                            {
                                title: '预计金额',
                                dataIndex: 'expected',
                                render: (v: any) => fmtMoney(v),
                            },
                            {
                                title: '现有金额',
                                dataIndex: 'current',
                                render: (v: any) => fmtMoney(v),
                            },
                            {
                                title: '差额',
                                dataIndex: 'delta',
                                render: (v: any) => {
                                    const n = Number(v);
                                    if (!Number.isFinite(n)) return '-';
                                    return <Tag color={n === 0 ? 'default' : n > 0 ? 'green' : 'red'}
                                                style={{borderRadius: 999}}>{fmtMoney(n)}</Tag>;
                                },
                            },
                        ] as any}
                    />
                </Space>
            </Card>
        );
    };

    const renderWalletApply = (res: any) => {
        if (!res) return null;
        // apply 返回结构可能和 preview 相同（只是多了执行结果），这里兜底展示 JSON + 成功提示
        return (
            <Card size="small" title="钱包对齐执行结果">
                <Tag color="green" style={{borderRadius: 999, marginBottom: 8}}>已执行写入（如有失败条目，请根据 JSON 排查）</Tag>
                <pre style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                }}>{JSON.stringify(res, null, 2)}</pre>
            </Card>
        );
    };

    // const runRecalculate = async () => {
    //     if (!order?.id) return;
    //     try {
    //         setToolsLoading(true);
    //         const res = await recalculateOrderSettlements({
    //             id: Number(order.id),
    //             reason: toolsRemark || undefined,
    //             scope: 'COMPLETED_AND_ARCHIVED',
    //             allowWalletSync: false, // ✅ 最安全：不动钱包
    //         });
    //         setToolsResult(res);
    //         message.success('重新结算已执行（未同步钱包）');
    //         await loadDetail();
    //     } catch (e: any) {
    //         message.error(e?.response?.data?.message || '重新结算失败');
    //     } finally {
    //         setToolsLoading(false);
    //     }
    // };

    // ==========================
    // 客服确认结单（两段式结单第二步）
    // ==========================
    const openConfirmComplete = () => {
        setConfirmCompleteRemark('');
        setConfirmCompleteOpen(true);
    };

    const submitConfirmComplete = async () => {
        if (!order?.id) return;
        try {
            setConfirmCompleteLoading(true);
            await confirmCompleteOrder({id: Number(order.id), remark: confirmCompleteRemark || undefined});
            message.success('已确认结单');
            setConfirmCompleteOpen(false);
            await loadDetail();
        } catch (e: any) {
            message.error(e?.response?.data?.message || '确认结单失败');
        } finally {
            setConfirmCompleteLoading(false);
        }
    };


    const submitRefund = async () => {
        try {
            setRefundLoading(true);
            await refundOrder({id: order?.id, remark: refundRemark});
            message.success('退款成功');
            setRefundOpen(false);
            loadDetail();
        } finally {
            setRefundLoading(false);
        }
    };

    // 创建订单后、复制相关功能模块
    const {initialState} = useModel('@@initialState');
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

        return {customerText, staffText};
    };

    const openReceipt = (type: 'customer' | 'staff') => {
        const {customerText, staffText} = buildReceiptTextsFromDetail();
        setReceiptTextCustomer(customerText);
        setReceiptTextStaff(staffText);
        // setReceiptImgCustomer(generateReceiptImage('蓝猫爽打-订单小票', customerText));
        setReceiptImgCustomer(
            generateReceiptImage('蓝猫爽打-订单小票', customerText, {
                width: 560,
                theme: {accent: '#22d3ee', accent2: '#a78bfa'},
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
            const res = await getPlayerOptions({keyword: keyword || '', onlyIdle: true});
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

    // ==========================
    // 存单后修复（方案 B）
    // - 仅对 ARCHIVED 轮展示入口
    // - 只改“本轮总保底进度（万）”，然后均分到本轮所有成员
    // - 最小改动：前端负责“均分 + 余数分配”，后端仍按既有 updateDispatchParticipantProgress 接口落库
    // ==========================
    const openArchFix = (dispatchRow: any) => {
        const d = dispatchRow;
        if (!d?.id) return;

        setArchFixDispatch(d);

        // 默认值：本轮当前 progress 合计（万）
        const parts = Array.isArray(d?.participants) ? d.participants : [];
        const total = parts.reduce((sum: number, p: any) => sum + Number(p?.progressBaseWan ?? 0), 0);

        setArchFixTotalWan(Number.isFinite(total) ? total : 0);
        setArchFixOpen(true);
    };

    const splitEvenlyInt = (total: number, n: number) => {
        // 允许负数；按“整数均分 + 余数分配”保证总和一致
        if (!Number.isFinite(total) || !Number.isFinite(n) || n <= 0) return [];
        const base = total >= 0 ? Math.floor(total / n) : Math.ceil(total / n);
        const rem = total - base * n; // 可能为负
        const arr = new Array(n).fill(base);

        // rem > 0: 前 rem 个 +1；rem < 0: 前 |rem| 个 -1
        const step = rem >= 0 ? 1 : -1;
        for (let i = 0; i < Math.abs(rem); i++) arr[i] += step;

        return arr;
    };

    const submitArchFix = async () => {
        try {
            const d = archFixDispatch;
            if (!d?.id) return;

            const parts = Array.isArray(d?.participants) ? d.participants : [];

            // ✅ ARCHIVED 轮 participants 很可能 isActive 全 false，所以不要按 isActive 过滤
            // ✅ 关键：必须拿到 OrderParticipant.id（p.id），否则后端无法定位要修复的参与者
            const fixParts = parts.filter((p: any) => Number(p?.id) > 0);

            if (!fixParts.length) {
                message.warning('该轮没有可修复的参与者（缺少 participant.id）');
                return;
            }

            const total = Number(archFixTotalWan ?? 0);
            if (!Number.isFinite(total)) {
                message.warning('请输入合法的整数进度（万）');
                return;
            }

            setArchFixSubmitting(true);

            const splits = splitEvenlyInt(Math.trunc(total), fixParts.length);

            // ✅ 这里必须传 participantId = OrderParticipant.id
            const progresses = fixParts.map((p: any, idx: number) => ({
                participantId: Number(p.id),      // ✅ 后端要的就是这个
                userId: Number(p?.userId),        // ✅ 可留着（如果后端 DTO 允许）
                progressBaseWan: splits[idx] ?? 0,
            }));

            // ✅ 新：按“本轮总保底进度(万)”修正，后端自动均分并触发本轮重算（不动钱包）
            await updateArchivedProgressTotal({
                dispatchId: Number(d.id),
                totalProgressBaseWan: Math.trunc(total), // ✅ 允许负数（炸单修正）
                remark: `ARCHIVED_FIX_TOTAL_WAN=${Math.trunc(total)}（均分到本轮参与人，并重算该轮结算）`,
            });

            message.success('已修复该轮保底进度');
            setArchFixOpen(false);
            await loadDetail();
        } catch (e: any) {
            message.error(e?.response?.data?.message || '修复失败');
        } finally {
            setArchFixSubmitting(false);
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
        {title: '接单时间', dataIndex: 'acceptedAt', render: (v: any) => (v ? new Date(v).toLocaleString() : '-')},
        {title: '保底进度（万）', dataIndex: 'progressBaseWan', render: (v: any) => (v == null ? '-' : v)},
        {title: '贡献金额', dataIndex: 'contributionAmount', render: (v: any) => (v == null ? '-' : v)},
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

    // ==========================
    // 低权重：收益概览（仅展示，不参与任何业务写入）
    // - 订单收入：paidAmount（赠送单视为 0）
    // - 总支出：按 settlements.finalEarnings 汇总（只统计非 0 且为数字的值）
    // - 平台收益：收入 - 支出
    // ==========================
    const earningsSummary = useMemo(() => {
        const incomeCents = order?.isGifted ? 0 : toCents(order?.paidAmount);
        const list = Array.isArray(order?.settlements) ? order.settlements : [];

        let payoutIncomeCents = 0;     // 正向收益合计（分）
        let payoutExpenseAbsCents = 0; // 支出合计（分，绝对值）

        const perUser: Record<string,
            { userId: number; name: string; phone: string; incomeCents: number; expenseAbsCents: number; netCents: number }> = {};

        for (const s of list as any[]) {
            const v = Number(s?.finalEarnings ?? 0);
            if (!Number.isFinite(v) || v === 0) continue;

            const centsAbs = Math.abs(toCents(v));
            const isLoss = v < 0;

            const u = (s as any)?.user || {};
            const key = String(s?.userId ?? u?.id ?? '0');

            if (!perUser[key]) {
                perUser[key] = {
                    userId: Number(s?.userId ?? u?.id ?? 0),
                    name: u?.name || '-',
                    phone: u?.phone || '-',
                    incomeCents: 0,
                    expenseAbsCents: 0,
                    netCents: 0,
                };
            }

            if (isLoss) {
                payoutExpenseAbsCents += centsAbs;
                perUser[key].expenseAbsCents += centsAbs;
            } else {
                payoutIncomeCents += centsAbs;
                perUser[key].incomeCents += centsAbs;
            }

            perUser[key].netCents = perUser[key].incomeCents - perUser[key].expenseAbsCents;
        }

        const platformSuggestedCents = incomeCents - payoutIncomeCents + payoutExpenseAbsCents;

        const perUserList = Object.values(perUser)
            .map((u) => ({
                userId: u.userId,
                name: u.name,
                phone: u.phone,
                income: Number(centsToMoney(u.incomeCents)),
                expense: Number(centsToMoney(u.expenseAbsCents)),
                net: Number(centsToMoney(u.netCents)),
            }))
            .sort((a, b) => b.net - a.net);

        return {
            income: Number(centsToMoney(incomeCents)),

            payoutIncome: Number(centsToMoney(payoutIncomeCents)),
            payoutExpenseAbs: Number(centsToMoney(payoutExpenseAbsCents)),
            platformSuggested: Number(centsToMoney(platformSuggestedCents)),

            // 兼容旧字段（如果还在用）
            payout: Number(centsToMoney(payoutIncomeCents - payoutExpenseAbsCents)),
            platform: Number(centsToMoney(incomeCents - (payoutIncomeCents - payoutExpenseAbsCents))),

            perUserList,
        };
    }, [order]);


    const historyDispatches = useMemo(() => {
        const list = Array.isArray(order?.dispatches) ? order?.dispatches : [];
        return list;
    }, [order]);

    const historyColumns = [
        {title: '轮次', dataIndex: 'round', width: 80},
        {title: '派单状态', dataIndex: 'status', width: 120, render: (v: any) => statusTag('DispatchStatus', v)},
        {
            title: '派单时间',
            dataIndex: 'assignedAt',
            width: 180,
            render: (v: any) => (v ? new Date(v).toLocaleString() : '-')
        },
        {
            title: '全员接单',
            dataIndex: 'acceptedAllAt',
            width: 180,
            render: (v: any) => (v ? new Date(v).toLocaleString() : '-')
        },
        {
            title: '存单时间',
            dataIndex: 'archivedAt',
            width: 180,
            render: (v: any) => (v ? new Date(v).toLocaleString() : '-')
        },
        {
            title: '结单时间',
            dataIndex: 'completedAt',
            width: 180,
            render: (v: any) => (v ? new Date(v).toLocaleString() : '-')
        },
        {title: '备注', dataIndex: 'remark', ellipsis: true, render: (v: any) => v || '-'},
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
        {title: '接单时间', dataIndex: 'acceptedAt', render: (v: any) => (v ? new Date(v).toLocaleString() : '-')},
        {title: '保底进度（万）', dataIndex: 'progressBaseWan', render: (v: any) => (v == null ? '-' : v)},
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

    const cardBodyMobile: React.CSSProperties = {padding: 14};

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
            <Space direction="vertical" size={12} style={{width: '100%'}}>
                <Space align="center" style={{justifyContent: 'space-between', width: '100%'}}>
                    <Space direction="vertical" size={2}>
                        <Typography.Text type="secondary" style={{fontSize: 12}}>
                            订单详情
                        </Typography.Text>
                        <Typography.Text strong style={{fontSize: 18, letterSpacing: 0.2}}>
                            {order?.autoSerial || '-'}
                        </Typography.Text>
                    </Space>

                    <Space size={6} wrap>
                        {statusTag('OrderStatus', order?.status)}
                        {currentDispatch?.status ? statusTag('DispatchStatus', currentDispatch.status) : <Tag>-</Tag>}
                    </Space>
                </Space>

                <Space size={8} wrap>
                    <Tag color="geekblue" style={{borderRadius: 999}}>
                        实付 ¥{order?.paidAmount ?? '-'}
                    </Tag>
                    <Tag style={{borderRadius: 999}}>应收 ¥{order?.receivableAmount ?? '-'}</Tag>
                    {isHourly ? <Tag color="blue" style={{borderRadius: 999}}>小时单</Tag> : null}
                    {isGuaranteed ? <Tag color="gold" style={{borderRadius: 999}}>保底单</Tag> : null}
                    {remainingBaseWan == null ? null : (
                        <Tag color={remainingBaseColor as any} style={{borderRadius: 999}}>
                            剩余保底 {remainingBaseWan}
                        </Tag>
                    )}
                    {order?.isGifted ? <Tag style={{borderRadius: 999}}>赠送</Tag> : order?.isPaid === false ? (
                        <Tag color="red" style={{borderRadius: 999}}>未收款</Tag>
                    ) : (
                        <Tag color="green" style={{borderRadius: 999}}>已收款</Tag>
                    )}
                </Space>

                <Space direction="vertical" size={4} style={{width: '100%'}}>
                    <Typography.Text type="secondary" style={{fontSize: 13}}>
                        项目：{order?.project?.name || order?.projectSnapshot?.name || '-'}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{fontSize: 13}}>
                        客户游戏ID：{order?.customerGameId ?? '-'}
                    </Typography.Text>
                </Space>
            </Space>
        </Card>
    );

    // ===== Mobile: “第一屏快捷区” —— 小票放这里（你要的）=====
    const MobileQuickActions = (
        <Card style={cardStyleMobile} bodyStyle={cardBodyMobile}>
            <Space direction="vertical" size={12} style={{width: '100%'}}>
                <Space align="center" style={{justifyContent: 'space-between', width: '100%'}}>
                    <Typography.Text strong style={{fontSize: 15}}>
                        快捷操作
                    </Typography.Text>
                    <Button size="small" icon={<ReloadOutlined/>} onClick={() => loadDetail()}>
                        刷新
                    </Button>
                </Space>

                <Row gutter={[10, 10]}>
                    <Col span={12}>
                        <Button
                            type="primary"
                            icon={<FileImageOutlined/>}
                            block
                            style={{height: 44, borderRadius: 14}}
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
                                style={{height: 44, borderRadius: 14}}
                                onClick={openMarkPaidModal}
                            >
                                确认收款
                            </Button>
                        </Col>
                    ) : null}
                    <Col span={12}>
                        <Button
                            icon={<CopyOutlined/>}
                            block
                            style={{height: 44, borderRadius: 14}}
                            onClick={async () => {
                                const {staffText} = buildReceiptTextsFromDetail();
                                await copyText(staffText);
                            }}
                        >
                            复制派单话术
                        </Button>
                    </Col>

                    <Col span={12}>
                        <Button
                            icon={<ThunderboltOutlined/>}
                            block
                            disabled={!canDispatch || forbidEdit}
                            style={{height: 44, borderRadius: 14}}
                            onClick={openActionDispatch}
                        >
                            {primaryActionText}
                        </Button>
                    </Col>

                    <Col span={12}>
                        <Button
                            icon={<DollarOutlined/>}
                            block
                            disabled={!isHourly}
                            style={{height: 44, borderRadius: 14}}
                            onClick={openActionPaid}
                        >
                            修改实付
                        </Button>
                    </Col>

                    <Col span={12}>
                        <Button
                            icon={<ProfileOutlined/>}
                            block
                            style={{height: 44, borderRadius: 14}}
                            onClick={openTools}
                        >
                            工具
                        </Button>
                    </Col>

                    {String(order?.status) === 'COMPLETED_PENDING_CONFIRM' ? (
                        <Col span={12}>
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined/>}
                                block
                                style={{height: 44, borderRadius: 14}}
                                onClick={openConfirmComplete}
                            >
                                确认结单
                            </Button>
                        </Col>
                    ) : null}
                </Row>

                <Space size={8} wrap>
                    <Tag style={{borderRadius: 999}}>
                        派单客服：{order?.dispatcher ? `${order?.dispatcher.name || '-'}（${order?.dispatcher.phone || '-'}）` : '-'}
                    </Tag>
                    <Tag
                        style={{borderRadius: 999}}>下单：{order?.orderTime ? new Date(order.orderTime).toLocaleString() : '-'}</Tag>
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
                            <List.Item style={{paddingLeft: 0, paddingRight: 0}}>
                                <Space direction="vertical" size={6} style={{width: '100%'}}>
                                    <Space style={{justifyContent: 'space-between', width: '100%'}}>
                                        <Typography.Text strong>
                                            {u?.name || '未命名'}（{u?.phone || '-'}）
                                        </Typography.Text>
                                        <Tag style={{borderRadius: 999}}>{p?.acceptedAt ? '已接单' : '未接单'}</Tag>
                                    </Space>
                                    <Space size={8} wrap>
                                        <Tag style={{borderRadius: 999}}>保底进度：{p?.progressBaseWan ?? '-'}</Tag>
                                        {p?.contributionAmount != null ?
                                            <Tag style={{borderRadius: 999}}>贡献：{p?.contributionAmount}</Tag> : null}
                                    </Space>
                                    <Typography.Text type="secondary" style={{fontSize: 12}}>
                                        接单时间：{p?.acceptedAt ? new Date(p.acceptedAt).toLocaleString() : '-'}
                                    </Typography.Text>
                                </Space>
                            </List.Item>
                        );
                    }}
                />
            ) : (
                <div>
                    <Tag color="orange" style={{borderRadius: 999}}>{currentDispatch?.id ? '暂无参与者' : '当前还未派单'}</Tag>
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
                        const data = parts.map((p: any) => ({...p, dispatchId: d.id, dispatchStatus: d.status}));
                        console.log("=========d======");
                        console.log(d);
                        const canArchFix = String(order?.status) === 'ARCHIVED' &&
                            isGuaranteed && String(d?.status) === 'ARCHIVED' &&
                            Array.isArray(d?.participants) &&
                            d.participants.length > 0;
                        return {
                            key: String(d?.id),
                            label: (
                                <Space size={8} wrap>
                                    <Tag style={{borderRadius: 999}}>第 {d?.round ?? '-'} 轮</Tag>
                                    {statusTag('DispatchStatus', d?.status)}
                                    <Typography.Text type="secondary" style={{fontSize: 12}}>
                                        派单：{d?.assignedAt ? new Date(d.assignedAt).toLocaleString() : '-'}
                                    </Typography.Text>
                                </Space>
                            ),
                            children: (
                                <Space direction="vertical" size={10} style={{width: '100%'}}>
                                    <Space direction="vertical" size={2} style={{width: '100%'}}>
                                        <Typography.Text type="secondary" style={{fontSize: 12}}>
                                            全员接单：{d?.acceptedAllAt ? new Date(d.acceptedAllAt).toLocaleString() : '-'}
                                        </Typography.Text>
                                        <Typography.Text type="secondary" style={{fontSize: 12}}>
                                            存单：{d?.archivedAt ? new Date(d.archivedAt).toLocaleString() : '-'}
                                        </Typography.Text>
                                        <Typography.Text type="secondary" style={{fontSize: 12}}>
                                            结单：{d?.completedAt ? new Date(d.completedAt).toLocaleString() : '-'}
                                        </Typography.Text>
                                        <Typography.Text type="secondary" style={{fontSize: 12}}>
                                            备注：{d?.remark || '-'}
                                        </Typography.Text>
                                    </Space>

                                    {/*{String(d.status) === 'ARCHIVED' ? (*/}
                                    {/*    <Button*/}
                                    {/*        size="small"*/}
                                    {/*        onClick={() => openFixProgress(Number(d.id), Number(row.id))}*/}
                                    {/*        style={{borderRadius: 10}}*/}
                                    {/*    >*/}
                                    {/*        修复进度*/}
                                    {/*    </Button>*/}
                                    {/*) : null}*/}
                                    {/* ✅ 存单后修复入口（方案 B）：仅 ARCHIVED 轮可见（保底单） */}
                                    {
                                        canArchFix ? (
                                            <div style={{marginBottom: 10}}>
                                                <Button size="small" onClick={() => openArchFix(d)}
                                                        style={{borderRadius: 10}}>
                                                    修复本轮保底
                                                </Button>
                                            </div>) : null
                                    }

                                    <Space direction="vertical" size={10} style={{width: '100%'}}>
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
                                                        style={{
                                                            borderRadius: 14,
                                                            border: '1px solid rgba(0,0,0,0.06)',
                                                            boxShadow: '0 6px 18px rgba(0,0,0,0.04)'
                                                        }}
                                                        bodyStyle={{padding: 12}}
                                                    >
                                                        <Space direction="vertical" size={8} style={{width: '100%'}}>
                                                            <Space style={{
                                                                justifyContent: 'space-between',
                                                                width: '100%'
                                                            }}>
                                                                <Typography.Text strong>
                                                                    {u?.name || '未命名'}（{u?.phone || '-'}）
                                                                </Typography.Text>
                                                                <Tag
                                                                    style={{borderRadius: 999}}>{row?.acceptedAt ? '已接' : '未接'}</Tag>
                                                            </Space>

                                                            <Space size={8} wrap>
                                                                <Tag
                                                                    style={{borderRadius: 999}}>保底进度：{row?.progressBaseWan ?? '-'}</Tag>
                                                                <Tag
                                                                    style={{borderRadius: 999}}>收益：{v == null ? '-' : `¥${v}`}</Tag>
                                                            </Space>

                                                            <Space style={{
                                                                justifyContent: 'space-between',
                                                                width: '100%'
                                                            }}>
                                                                <Typography.Text type="secondary"
                                                                                 style={{fontSize: 12}}>
                                                                    接单：{row?.acceptedAt ? new Date(row.acceptedAt).toLocaleString() : '-'}
                                                                </Typography.Text>
                                                                {s ? (
                                                                    <Button size="small" onClick={() => openAdjust(s)}
                                                                            style={{borderRadius: 10}}>
                                                                        调整收益
                                                                    </Button>
                                                                ) : (
                                                                    <span/>
                                                                )}
                                                            </Space>
                                                        </Space>
                                                    </Card>
                                                );
                                            })
                                        ) : (
                                            <Tag style={{borderRadius: 999}}>该轮无参与者</Tag>
                                        )}
                                    </Space>
                                </Space>
                            ),
                        };
                    })}
                />
            ) : (
                <Tag style={{borderRadius: 999}}>暂无历史派单</Tag>
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
        <Space direction="vertical" style={{width: '100%'}} size={16}>
            <Card
                title={`订单详情：${order?.autoSerial || '-'}`}
                loading={loading}
                extra={
                    <Space>
                        <Button icon={<ProfileOutlined/>} onClick={openTools}>
                            工具
                        </Button>

                        {/* ✅ 两段式结单：客服确认（低频入口，但要可用） */}
                        {String(order?.status) === 'COMPLETED_PENDING_CONFIRM' ? (
                            <Button type="primary" icon={<CheckCircleOutlined/>} onClick={openConfirmComplete}>
                                确认结单
                            </Button>
                        ) : null}

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

                    <Descriptions.Item
                        label="项目">{order?.project?.name || order?.projectSnapshot?.name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="计费类型">{t('BillingMode', billingMode, billingMode)}</Descriptions.Item>

                    <Descriptions.Item label="应收金额">¥{order?.receivableAmount ?? '-'}</Descriptions.Item>
                    <Descriptions.Item label="实付金额">
                        ¥{order?.paidAmount ?? '-'}
                        {isHourly ? <Tag style={{marginLeft: 8}}>小时单可补收</Tag> : null}
                    </Descriptions.Item>

                    <Descriptions.Item label="订单保底（万）">
                        {baseAmountWan ?? '-'}
                        {isGuaranteed ? <Tag style={{marginLeft: 8}}>保底单</Tag> : null}
                    </Descriptions.Item>

                    <Descriptions.Item label="剩余保底（万）">
                        {remainingBaseWan == null ? '-' :
                            <Tag color={remainingBaseColor as any}>{remainingBaseWan}</Tag>}
                    </Descriptions.Item>

                    <Descriptions.Item label="客户游戏ID">{order?.customerGameId ?? '-'}</Descriptions.Item>
                    <Descriptions.Item label="派单客服">
                        {order?.dispatcher ? `${order?.dispatcher.name || '-'}（${order?.dispatcher.phone || '-'}）` : '-'}
                    </Descriptions.Item>

                    <Descriptions.Item
                        label="下单时间">{order?.orderTime ? new Date(order?.orderTime).toLocaleString() : '-'}</Descriptions.Item>
                    <Descriptions.Item
                        label="付款时间">{order?.paymentTime ? new Date(order?.paymentTime).toLocaleString() : '-'}</Descriptions.Item>
                    <Descriptions.Item label="收款状态">
                        {order?.isGifted ? <Tag>赠送</Tag> : order?.isPaid === false ? <Tag color="red">未收款</Tag> :
                            <Tag color="green">已收款</Tag>}
                    </Descriptions.Item>
                </Descriptions>
            </Card>

            {order?.status !== 'REFUNDED' && !hideCurrentParticipants ? (
                <Card title="当前参与者（本轮）" loading={loading}>
                    <Table rowKey="id" columns={participantColumns as any} dataSource={participantRows}
                           pagination={false}/>
                    {!currentDispatch?.id ? (
                        <div style={{marginTop: 12}}>
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
                    scroll={{x: 1100}}
                    expandable={{
                        expandedRowRender: (dispatchRow: any) => {
                            const parts = Array.isArray(dispatchRow?.participants) ? dispatchRow.participants : [];
                            const data = parts.map((p: any) => ({
                                ...p,
                                dispatchId: dispatchRow.id,
                                dispatchStatus: dispatchRow.status,
                            }));
                            // ✅ 存单后修复入口（方案 B）：仅 ARCHIVED 轮可见（保底单）且需要订单也是存单状态
                            const canArchFix = String(order?.status) === 'ARCHIVED' &&
                                isGuaranteed && String(dispatchRow?.status) === 'ARCHIVED' &&
                                Array.isArray(dispatchRow?.participants) &&
                                dispatchRow.participants.length > 0;

                            const ArchFixBar = canArchFix ? (
                                <div style={{marginBottom: 10}}>
                                    <Tag color="gold" style={{borderRadius: 999, marginRight: 8}}>
                                        存单修复：修改本轮总保底进度（万），系统将均分给本轮成员
                                    </Tag>
                                    <Button size="small" onClick={() => openArchFix(dispatchRow)}
                                            style={{borderRadius: 10}}>
                                        修复本轮保底
                                    </Button>
                                </div>
                            ) : null;


                            return (
                                <>
                                    {ArchFixBar}
                                    <Table
                                        rowKey="id"
                                        columns={historyParticipantColumns as any}
                                        dataSource={data}
                                        pagination={false}
                                        size="small"
                                    />
                                </>
                            );
                        },
                    }}
                />
            </Card>

            {/*
                低权重模块：本单收益概览（仅展示，方便随手查看）
                - 不参与业务决策；不影响任何表单/派单/结算
                - 默认折叠，避免占用主流程视觉空间
             */}
            <Collapse
                defaultActiveKey={[]}
                items={[
                    {
                        key: 'earningsSummary',
                        label: '收益概览（参考）',
                        children: (
                            <Space direction="vertical" size={12} style={{width: '100%'}}>
                                <Space size={8} wrap>
                                    <Tag style={{borderRadius: 999}}>订单收入：¥{earningsSummary.income}</Tag>

                                    <Tag color="green" style={{borderRadius: 999}}>
                                        订单成本(总支出)：¥{earningsSummary.payoutIncome}
                                    </Tag>

                                    <Tag color="red" style={{borderRadius: 999}}>
                                        打手炸单贡献收益：¥{earningsSummary.payoutExpenseAbs}
                                    </Tag>

                                    <Tag
                                        color={(earningsSummary.platformSuggested ?? earningsSummary.platform) >= 0 ? 'green' : 'red'}
                                        style={{borderRadius: 999}}
                                    >
                                        平台净额：¥{(earningsSummary.platformSuggested ?? earningsSummary.platform)}
                                    </Tag>
                                </Space>

                                <Table
                                    size="small"
                                    rowKey="userId"
                                    pagination={false}
                                    dataSource={earningsSummary.perUserList}
                                    columns={[
                                        {
                                            title: '参与者',
                                            dataIndex: 'name',
                                            render: (_: any, r: any) => `${r.name}（${r.phone}）`,
                                        },
                                        {
                                            title: '收益',
                                            dataIndex: 'income',
                                            align: 'right',
                                            render: (v: any) => {
                                                const n = Number(v ?? 0);
                                                return (
                                                    <span style={{color: '#389e0d', fontWeight: 500}}>¥{n}</span>
                                                );
                                            },
                                        },
                                        {
                                            title: '支出',
                                            dataIndex: 'expense',
                                            align: 'right',
                                            render: (v: any) => {
                                                const n = Number(v ?? 0);
                                                return (
                                                    <span style={{color: '#cf1322', fontWeight: 500}}>-¥{n}</span>
                                                );
                                            },
                                        },
                                        {
                                            title: '净额',
                                            dataIndex: 'net',
                                            align: 'right',
                                            render: (v: any) => {
                                                const n = Number(v ?? 0);
                                                return (
                                                    <span
                                                        style={{
                                                            color: n >= 0 ? '#389e0d' : '#cf1322',
                                                            fontWeight: 600,
                                                        }}
                                                    >¥{n}</span>
                                                );
                                            },
                                        },
                                    ] as any}
                                />

                            </Space>
                        ),
                    },
                ]}
            />
        </Space>
    );
    // ===== Mobile：更 App 化布局 =====
    const MobileView = (
        <div style={{padding: 12, paddingBottom: 76, background: '#f5f6f8', maxWidth: 480, minHeight: '100vh'}}>
            <Space direction="vertical" size={12} style={{width: '100%'}}>
                {MobileHeader}

                <Tabs
                    defaultActiveKey="overview"
                    items={[
                        {
                            key: 'overview',
                            label: '概览',
                            children: (
                                <Space direction="vertical" size={12} style={{width: '100%'}}>
                                    {/* ✅ 你要的：小票入口放第一页（概览） */}
                                    {MobileQuickActions}
                                    {MobileInfo}
                                    {order?.status !== 'REFUNDED' && !hideCurrentParticipants ? MobileParticipants : null}

                                    <Collapse
                                        defaultActiveKey={[]}
                                        items={[{
                                            key: 'earningsSummaryM',
                                            label: '收益概览（参考）',
                                            children: (
                                                <Space direction="vertical" size={10} style={{width: '100%'}}>
                                                    <Space size={8} wrap>
                                                        <Tag
                                                            style={{borderRadius: 999}}>收入：¥{earningsSummary.income}</Tag>
                                                        <Tag
                                                            style={{borderRadius: 999}}>支出：¥{earningsSummary.payout}</Tag>
                                                        <Tag color={earningsSummary.platform >= 0 ? 'green' : 'red'}
                                                             style={{borderRadius: 999}}>
                                                            平台：¥{earningsSummary.platform}
                                                        </Tag>
                                                    </Space>
                                                </Space>
                                            ),
                                        }]}
                                    />
                                </Space>
                            ),
                        },
                        {
                            key: 'history',
                            label: '历史',
                            children: <Space direction="vertical" size={12}
                                             style={{width: '100%'}}>{MobileHistory}</Space>,
                        },
                        {
                            key: 'more',
                            label: '更多',
                            children: (
                                <Space direction="vertical" size={12} style={{width: '100%'}}>
                                    <Card style={cardStyleMobile} bodyStyle={cardBodyMobile}>
                                        <Space direction="vertical" size={10} style={{width: '100%'}}>
                                            <Button block icon={<FileImageOutlined/>}
                                                    onClick={() => openReceipt('customer')}
                                                    style={{borderRadius: 14, height: 44}}>
                                                订单小票
                                            </Button>

                                            {order?.status !== 'REFUNDED' ? (
                                                <Button danger block onClick={() => setRefundOpen(true)}
                                                        style={{borderRadius: 14, height: 44}}>
                                                    退款
                                                </Button>
                                            ) : null}

                                            <Button
                                                type="primary"
                                                block
                                                icon={<EditOutlined/>}
                                                disabled={forbidEdit}
                                                onClick={openEditModal}
                                                style={{borderRadius: 14, height: 44}}
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
                    <Space style={{width: '100%', justifyContent: 'space-between'}}>
                        <Button
                            type="primary"
                            icon={<ThunderboltOutlined/>}
                            disabled={!canDispatch || forbidEdit}
                            onClick={openDispatchModal}
                            style={{borderRadius: 14, flex: 1, height: 44}}
                        >
                            {primaryActionText}
                        </Button>

                        <Button onClick={() => history.push('/orders')} icon={<ProfileOutlined/>}
                                style={{borderRadius: 14, height: 44}}>
                            订单
                        </Button>

                        <Button onClick={() => history.push('/wallet/overview')} icon={<WalletOutlined/>}
                                style={{borderRadius: 14, height: 44}}>
                            钱包
                        </Button>
                    </Space>
                </div>
            </Space>
        </div>
    );

    return (
        <PageContainer title={isMobile ? false : undefined}
                       contentStyle={isMobile ? {padding: 0, maxWidth: '100%'} : undefined}>
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
                        <Button type="primary" onClick={submitDispatchOrUpdate} loading={dispatchSubmitting}
                                style={{borderRadius: 12}}>
                            确认
                        </Button>
                    }
                >
                    <div style={{marginBottom: 12}}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 6
                        }}>
                            <span>选择打手（仅空闲可选，最多 2 人）</span>
                            <Button size="small" onClick={() => fetchPlayers('')} icon={<ReloadOutlined/>}>
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
                            style={{width: '100%'}}
                        />
                    </div>

                    <div>
                        <div style={{marginBottom: 6}}>备注（可选）</div>
                        <Input
                            value={dispatchRemark}
                            onChange={(e) => setDispatchRemark(e.target.value)}
                            placeholder="例如：客户指定/换号/紧急"
                            allowClear
                        />
                    </div>

                    {currentDispatch?.id && (currentDispatch.status === 'WAIT_ASSIGN' || currentDispatch.status === 'WAIT_ACCEPT') ? (
                        <div style={{marginTop: 12}}>
                            <Tag color="gold" style={{borderRadius: 999}}>
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
                    <div style={{marginBottom: 12}}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 6
                        }}>
                            <span>选择打手（仅空闲可选，最多 2 人）</span>
                            <Button size="small" onClick={() => fetchPlayers('')} icon={<ReloadOutlined/>}>
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
                            style={{width: '100%'}}
                        />
                    </div>

                    <div>
                        <div style={{marginBottom: 6}}>备注（可选）</div>
                        <Input
                            value={dispatchRemark}
                            onChange={(e) => setDispatchRemark(e.target.value)}
                            placeholder="例如：客户指定/换号/紧急"
                            allowClear
                        />
                    </div>

                    {currentDispatch?.id && (currentDispatch.status === 'WAIT_ASSIGN' || currentDispatch.status === 'WAIT_ACCEPT') ? (
                        <div style={{marginTop: 12}}>
                            <Tag color="gold" style={{borderRadius: 999}}>
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
                            {required: true, message: '请输入实付金额'},
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
                        <InputNumber min={0} precision={2} style={{width: '100%'}}/>
                    </Form.Item>

                    <Form.Item name="remark" label="补收说明（建议填写）">
                        <Input placeholder="例如：超时 30 分钟补收 ¥20" allowClear/>
                    </Form.Item>
                    <Form.Item
                        name="confirmPaid"
                        valuePropName="checked"
                        extra="勾选后会将订单标记为已收款，并写入付款时间"
                    >
                        <Checkbox>勾选后即视为订单已收款入账</Checkbox>
                    </Form.Item>

                    <Tag color="blue" style={{borderRadius: 999}}>该操作会写入操作日志（UPDATE_PAID_AMOUNT）。</Tag>
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
                            {required: true, message: '请输入实际收益'},
                            () => ({
                                validator: async (_, val) => {
                                    const n = Number(val);
                                    if (!Number.isFinite(n)) throw new Error('金额非法');
                                },
                            }),
                        ]}
                    >
                        <InputNumber precision={2} style={{width: '100%'}}/>
                    </Form.Item>
                    <Form.Item name="remark" label="调整原因（必填建议）" rules={[{required: true, message: '请填写调整原因'}]}>
                        <Input placeholder="例如：违规扣款/优秀奖励/客服补偿" allowClear/>
                    </Form.Item>
                    <Tag color="gold" style={{borderRadius: 999}}>该操作会写入操作日志（ADJUST_SETTLEMENT）。</Tag>
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


            {/* ==========================
                存单后修复（方案 B）：仅 ARCHIVED 轮
                - 修改“本轮总保底进度（万）”，系统均分给本轮成员
                - 仅影响该轮 participants.progressBaseWan（落库），然后剩余保底会随之变化（页面已按详情重新计算）
               ========================== */}
            <Modal
                open={archFixOpen}
                title={`存单修复：第 ${archFixDispatch?.round ?? '-'} 轮（总保底进度均分）`}
                onCancel={() => setArchFixOpen(false)}
                onOk={submitArchFix}
                confirmLoading={archFixSubmitting}
                okText="保存"
                destroyOnClose
            >
                <Space direction="vertical" size={10} style={{width: '100%'}}>
                    <Typography.Text type="secondary">
                        说明：仅对“存单（ARCHIVED）”轮开放修复入口。你只需要输入本轮总进度（万），系统会均分到本轮所有成员。
                    </Typography.Text>

                    <div>
                        <div style={{marginBottom: 6}}>本轮总保底进度（万，允许负数）</div>
                        <InputNumber
                            style={{width: '100%'}}
                            precision={0}
                            step={1}
                            value={archFixTotalWan ?? 0}
                            onChange={(v) => setArchFixTotalWan(typeof v === 'number' ? v : Number(v))}
                        />
                        <div style={{marginTop: 6, fontSize: 12, opacity: 0.65}}>
                            本轮成员数：{Array.isArray(archFixDispatch?.participants) ? archFixDispatch.participants.filter((p: any) => p?.isActive !== false).length : 0}
                        </div>
                    </div>

                    <Tag color="gold" style={{borderRadius: 999}}>
                        注意：这是“纠错/修复”入口，请务必和客服核对确认后再保存。
                    </Tag>
                </Space>
            </Modal>

            {/* ==========================
                工具：钱包对齐 / 重新结算（低权重入口）
                ========================== */}
            <Drawer
                open={toolsOpen}
                title="工具：重新结算 / 钱包对齐"
                placement="bottom"
                height={isMobile ? '78vh' : 520}
                onClose={() => setToolsOpen(false)}
                destroyOnClose
            >
                <Space direction="vertical" size={12} style={{width: '100%'}}>
                    {ToolStepHeader}

                    <Card size="small" style={{borderRadius: 14}} bodyStyle={{padding: 12}}>
                        <Space direction="vertical" size={10} style={{width: '100%'}}>
                            <Typography.Text strong>操作备注（可选）</Typography.Text>
                            <Input.TextArea
                                value={toolsRemark}
                                onChange={(e) => setToolsRemark(e.target.value)}
                                rows={3}
                                placeholder="用于审计追溯：例如“客户投诉核对后修复结算/补收后重新计算”等"
                            />

                            <Space wrap>
                                <Button
                                    loading={toolsLoading}
                                    type="primary"
                                    onClick={runRecalculate}
                                    icon={<ReloadOutlined/>}
                                    style={{borderRadius: 12}}
                                >
                                    ① 重新结算（不动钱包）
                                </Button>

                                <Button
                                    loading={toolsLoading}
                                    onClick={runWalletPreview}
                                    icon={<WalletOutlined/>}
                                    disabled={toolsStep !== 'RECALCED'}
                                    style={{borderRadius: 12}}
                                >
                                    ② 钱包对齐预览
                                </Button>

                                <Button
                                    loading={toolsLoading}
                                    danger
                                    onClick={runWalletApply}
                                    icon={<WalletOutlined/>}
                                    disabled={toolsStep !== 'PREVIEWED'}
                                    style={{borderRadius: 12}}
                                >
                                    ③ 执行钱包对齐
                                </Button>
                            </Space>

                            <Typography.Text type="secondary" style={{fontSize: 12}}>
                                建议流程：先重新结算 → 再生成钱包预览核对差异 → 确认无误后再执行钱包对齐（写入钱包）。
                            </Typography.Text>
                        </Space>
                    </Card>

                    {/* 结果展示：优先用“可读 UI”，必要时兜底展示 JSON */}
                    {recalcResult ? renderRecalcResult(recalcResult) : null}
                    {walletPreview ? renderWalletPreview(walletPreview) : null}
                    {walletApplyResult ? renderWalletApply(walletApplyResult) : null}

                    {/* 兜底：若后端返回结构未知，仍可查看原始 JSON */}
                    {toolsResult && !recalcResult && !walletPreview && !walletApplyResult ? (
                        <Card size="small" title="结果（原始 JSON）"
                              bodyStyle={{maxHeight: isMobile ? '42vh' : 280, overflow: 'auto'}}>
                            <pre style={{margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                                {JSON.stringify(toolsResult, null, 2)}
                            </pre>
                        </Card>
                    ) : null}
                </Space>
            </Drawer>

            {/* ==========================
                客服确认结单（两段式结单第二步）
                ========================== */}
            <Modal
                open={confirmCompleteOpen}
                title={`确认结单：${order?.autoSerial || ''}`}
                onCancel={() => setConfirmCompleteOpen(false)}
                onOk={submitConfirmComplete}
                confirmLoading={confirmCompleteLoading}
                okText="确认"
            >
                <Input.TextArea
                    value={confirmCompleteRemark}
                    onChange={(e) => setConfirmCompleteRemark(e.target.value)}
                    rows={3}
                    placeholder="备注（可不填）：例如核对无误/补充说明"
                />
            </Modal>

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
                        <div style={{border: '1px solid #eee', borderRadius: 14, padding: 12, background: '#fff'}}>
                            <Space style={{justifyContent: 'space-between', width: '100%', marginBottom: 10}}>
                                <Typography.Text strong>客户小票</Typography.Text>
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<CopyOutlined/>}
                                    onClick={() => copyText(receiptTextCustomer)}
                                    style={{borderRadius: 10}}
                                >
                                    复制文案
                                </Button>
                            </Space>

                            {receiptImgCustomer ? (
                                <div style={{display: 'flex', justifyContent: 'center'}}>
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

                            <div style={{marginTop: 10, color: 'rgba(0,0,0,.45)', fontSize: 12}}>
                                提示：小票图片请直接长按/右键复制图片即可。
                            </div>
                        </div>
                    </Col>

                    <Col xs={24} lg={12}>
                        <div style={{border: '1px solid #eee', borderRadius: 14, padding: 12, background: '#fff'}}>
                            <Space style={{justifyContent: 'space-between', width: '100%', marginBottom: 10}}>
                                <Typography.Text strong>派单话术</Typography.Text>
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<CopyOutlined/>}
                                    onClick={() => copyText(receiptTextStaff)}
                                    style={{borderRadius: 10}}
                                >
                                    一键复制
                                </Button>
                            </Space>

                            <Input.TextArea value={receiptTextStaff} readOnly rows={isMobile ? 5 : 8}/>

                            <div style={{marginTop: 10, color: 'rgba(0,0,0,.45)', fontSize: 12}}>
                                提示：建议先复制派单话术发派单群，再复制客户小票发客户。
                            </div>
                        </div>
                    </Col>
                </Row>
            </Modal>

            {/* 移动端：右下角更多导航（可选） */}
            {isMobile ? (
                <FloatButton.Group trigger="click" type="primary" icon={<AppstoreOutlined/>}
                                   style={{right: 16, bottom: 92}}>
                    <FloatButton icon={<ReloadOutlined/>} tooltip="刷新" onClick={() => loadDetail()}/>
                    <FloatButton icon={<ProfileOutlined/>} tooltip="订单列表" onClick={() => history.push('/orders')}/>
                    <FloatButton icon={<WalletOutlined/>} tooltip="钱包"
                                 onClick={() => history.push('/wallet/overview')}/>
                    <FloatButton icon={<FileImageOutlined/>} tooltip="订单小票" onClick={() => openReceipt('customer')}/>
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
                        rules={[{required: true, message: '请输入实收金额'}]}
                    >
                        <InputNumber style={{width: '100%'}} min={0} step={1}/>
                    </Form.Item>

                    <Form.Item label="备注" name="remark">
                        <Input.TextArea rows={3} placeholder="可填写收款备注（可不填）"/>
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
