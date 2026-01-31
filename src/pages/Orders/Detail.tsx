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
    Switch,
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
    updateArchivedProgressTotal,
    updateDispatchParticipants,
    updateOrder,
    updateOrderPaidAmount,
} from '@/services/api';
import dayjs from 'dayjs';
import {useIsMobile} from '@/utils/useIsMobile';
import {generateReceiptImage} from '@/utils/receiptImage';
import {useOrderReconcile} from "@/hooks/useOrderReconcile";
import {seedModePlayEqualByRound, validateModePlayAlloc} from "@/utils/format";

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

    // ✅ 客服确认结单（两段式结单第二步）
    const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
    const [confirmCompleteLoading, setConfirmCompleteLoading] = useState(false);
    const [confirmCompleteRemark, setConfirmCompleteRemark] = useState('');

    // 重算工具 - 玩法单分轮输入
    const [recalcModePlayAlloc, setRecalcModePlayAlloc] = useState<any>(null);


    // ==========================
    // ✅ 玩法单（MODE_PLAY）多轮不同参与者：分轮收入输入（仅前端校验/UI）
    // ==========================
    type ModePlayRoundRow = {
        key: string;
        dispatchId: number;
        round: number;
        participantIds: number[];
        participantNames: string[]; // ✅ 新增：用于展示
        participantCount: number;
        income: number; // 本轮收入（客服填）
    };

    type ModePlayAllocState = {
        need: boolean;           // 是否需要分配（玩法单 + 多轮不同人）
        rows: ModePlayRoundRow[]; // 表格行
    };

    const [modePlayAlloc, setModePlayAlloc] = useState<any>(null);


    const [editOpen, setEditOpen] = useState(false);
    const openEditModal = () => setEditOpen(true);
    const forbidEdit = ['COMPLETED', 'REFUNDED'].includes(order?.status);

    // ✅ confirm payment modal
    const [markPaidOpen, setMarkPaidOpen] = useState(false);
    const [markPaidSubmitting, setMarkPaidSubmitting] = useState(false);
    const [markPaidForm] = Form.useForm();

    const [debugJsonEnabled, setDebugJsonEnabled] = useState(false);

    const [repairPreview, setRepairPreview] = useState<any>(null);
    const [archFixValue, setArchFixValue] = useState<number>(0);


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
        initRecalcModePlayAlloc()
        setToolsOpen(true);

    };

    const initRecalcModePlayAlloc = () => {
        if (!isModePlay) {
            setRecalcModePlayAlloc(null);
            return;
        }

        const alloc = buildModePlayAllocState(order); // 你之前用于确认结单的构建函数
        // ✅ 默认按轮均分（你已做过 seedModePlayEqualByRound）
        if (alloc.need) {
            alloc.rows = seedModePlayEqualByRound(alloc.rows, Number(order?.paidAmount ?? 0));
        }
        setRecalcModePlayAlloc(alloc);
    };

    const renderRecalcResult = (res: any) => {
        if (!res) return null;

        const vm = res?.plan && res?.plan?.rounds ? res.plan : res; // ✅ 如果 plan 里有 rounds，就用 plan
        const rounds = Array.isArray(vm?.rounds) ? vm.rounds : [];
        const columns = Array.isArray(vm?.columns) ? vm.columns : [];
        const summary = vm?.summary;

        // 兼容：如果还是旧结构，走你原来的逻辑（不删，兜底）
        if (!rounds.length || !columns.length) {
            return (
                <Card size="small" title="① 重新结算结果" style={{borderRadius: 14}}>
                    <Typography.Text type="secondary">
                        返回结构不是新视图模型（可开启调试模式查看原始数据）。
                    </Typography.Text>
                </Card>
            );
        }

        const orderIdText = res?.orderId ?? order?.id ?? '-';
        const income = summary?.income ?? res?.orderSummary?.paidAmount;
        const payout = summary?.payout ?? 0;
        const penaltyIncome = summary?.penaltyIncome ?? 0;
        const platformNet = summary?.platformNet ?? (
            Number.isFinite(Number(income)) ? (Number(income) - payout + penaltyIncome) : undefined
        );

        const deltaTag = (n: any) => {
            const v = Number(n);
            if (!Number.isFinite(v) || v === 0) return <Tag style={{borderRadius: 999}}>0</Tag>;
            return (
                <Tag color={v > 0 ? 'green' : 'red'} style={{borderRadius: 999}}>
                    {v > 0 ? '+' : ''}{fmtMoney(v)}
                </Tag>
            );
        };

        // ✅ 行内单元格：同一行展示多个 settlementType（缺失 => —）
        const renderCell = (cell: any) => {
            if (!cell) return <Typography.Text type="secondary">—</Typography.Text>;

            const p = cell.preview || {};
            return (
                <Space direction="vertical" size={2}>
                    <span>{fmtMoney(p.oldFinal)} → {fmtMoney(p.expectedFinal)}</span>
                    <span>{deltaTag(p.deltaFinal)}</span>
                    {cell.note ? (
                        <Typography.Text type="secondary" style={{fontSize: 12}}>
                            {cell.note}
                        </Typography.Text>
                    ) : null}
                </Space>
            );
        };

        // ✅ 动态列：全单统一 settlementType 列（A），每列一个 cell
        const tableColumns: any[] = [
            {
                title: '参与人',
                dataIndex: 'user',
                width: 110,
                fixed: isMobile ? undefined : 'left',
                render: (_: any, r: any) => r?.user?.name ?? `#${r?.userId}`,
            },
            ...columns.map((c: any) => {
                const t = String(c?.settlementType || '');
                return {
                    title: t,
                    dataIndex: ['cellsByType', t],
                    width: 220,
                    render: (cell: any) => renderCell(cell),
                };
            }),
            {
                title: '本行小计',
                width: 160,
                render: (_: any, r: any) => (
                    <Space direction="vertical" size={2}>
                        <span>支出：{fmtMoney(r?.rowSummary?.payout ?? 0)}</span>
                        <span>炸单贡献：{fmtMoney(r?.rowSummary?.penaltyIncome ?? 0)}</span>
                        <span>
            净额：{deltaTag(r?.rowSummary?.net ?? 0)}
          </span>
                    </Space>
                ),
            },
        ];

        return (
            <Space direction="vertical" size={10} style={{width: '100%'}}>
                {/* ✅ 图三：总览（融入同一视图顶部） */}
                <Card size="small" title="① 重新核算结果（预览）" style={{borderRadius: 14}}>
                    <Space direction="vertical" size={8} style={{width: '100%'}}>
                        <Descriptions bordered size="small" column={isMobile ? 1 : 4}>
                            <Descriptions.Item label="订单ID">{orderIdText}</Descriptions.Item>
                            <Descriptions.Item
                                label="订单收入">{income !== undefined ? fmtMoney(income) : '-'}</Descriptions.Item>
                            <Descriptions.Item label="订单成本(总支出)">{fmtMoney(payout)}</Descriptions.Item>
                            <Descriptions.Item label="炸单贡献收益">{fmtMoney(penaltyIncome)}</Descriptions.Item>
                        </Descriptions>

                        <div>
                            平台净额：
                            <Tag
                                color={
                                    platformNet === undefined ? 'default' : Number(platformNet) >= 0 ? 'green' : 'red'
                                }
                                style={{borderRadius: 999, marginLeft: 6}}
                            >
                                {platformNet === undefined ? '-' : fmtMoney(platformNet)}
                            </Tag>
                        </div>

                        <Typography.Text type="secondary" style={{fontSize: 12}}>
                            说明：负数收益统一视为“炸单贡献收益”（不再依赖 settlementType）。
                        </Typography.Text>
                    </Space>
                </Card>

                {/* ✅ 图二骨架：轮次分组，每轮一个表；单元格就是图一细节 */}
                <Collapse
                    defaultActiveKey={[]}
                    items={rounds.map((rd: any) => {
                        const title = `第${rd?.dispatchRound ?? '-'}轮（${String(rd?.dispatchStatus ?? '-')}，派单ID:${rd?.dispatchId ?? '-'}）`;
                        const rs = rd?.roundSummary || {};
                        return {
                            key: String(rd?.dispatchId ?? rd?.dispatchRound ?? Math.random()),
                            label: (
                                <Space wrap>
                                    <span>{title}</span>
                                    <Tag style={{borderRadius: 999}}>支出：{fmtMoney(rs.payout ?? 0)}</Tag>
                                    <Tag style={{borderRadius: 999}}>炸单贡献：{fmtMoney(rs.penaltyIncome ?? 0)}</Tag>
                                    <Tag style={{borderRadius: 999}}>净额：{fmtMoney(rs.net ?? 0)}</Tag>
                                </Space>
                            ),
                            children: (
                                <Table
                                    size="small"
                                    rowKey={(r: any) => String(r?.userId)}
                                    pagination={false}
                                    scroll={{x: true}}
                                    dataSource={Array.isArray(rd?.rows) ? rd.rows : []}
                                    columns={tableColumns}
                                />
                            ),
                        };
                    })}
                />
            </Space>
        );
    };

    const buildModePlayRoundRowsFromOrder = (order: any) => {
        const dispatches = Array.isArray(order?.dispatches) ? order.dispatches : [];
        // 只取参与结算/重算的轮次（你后端也是 COMPLETED+ARCHIVED）
        const inStatuses = ['COMPLETED', 'ARCHIVED'];
        const list = dispatches
            .filter((d: any) => inStatuses.includes(String(d?.status)))
            .sort((a: any, b: any) => (Number(a?.round ?? 0) - Number(b?.round ?? 0)));

        return list.map((d: any) => {
            const active = (d?.participants ?? []).filter((p: any) => p?.acceptedAt);
            const names = active.map((p: any) => p?.user?.name).filter(Boolean);

            return {
                key: String(d.id),
                dispatchId: Number(d.id),
                round: Number(d.round ?? 0),
                participantCount: active.length,
                participantNames: names,
                income: 0, // 默认 0，need=false 时会被均分覆盖
            };
        });
    };

    const runRecalcPreview = async () => {
        if (!order?.id) return;

        // ✅ 口径：赠送单用 receivableAmount，否则用 paidAmount（和你 submitConfirmComplete 保持一致）
        const paidBase = toNum(order?.isGifted !== true ? order?.paidAmount : order?.receivableAmount);

        // ✅ 玩法单：重算必须携带每轮金额（无论 need 与否）
        let modePlayAllocList: any[] | undefined = undefined;

        if (isModePlay) {
            // 兜底：必须有“轮次 rows”（因为后端按轮循环）
            const rows = (Array.isArray(recalcModePlayAlloc?.rows) && recalcModePlayAlloc.rows.length > 0)
                ? (recalcModePlayAlloc.rows as any[])
                : buildModePlayRoundRowsFromOrder(order);

            if (!Array.isArray(rows) || rows.length === 0) {
                message.warning('玩法单重算未找到可用的派单轮次（需要 COMPLETED/ARCHIVED 轮次）');
                return;
            }

            if (recalcModePlayAlloc?.need) {
                // ✅ need=true：必须人工输入并校验
                const v = validateModePlayAlloc(rows as any, paidBase);
                if (!v.ok) {
                    message.warning(v.err || '玩法单分轮收入校验未通过');
                    return;
                }
                modePlayAllocList = rows.map((r: any) => ({
                    dispatchId: Number(r.dispatchId),
                    income: toNum(r.income ?? 0),
                }));
            } else {
                // ✅ need=false：自动按轮次均分 paidBase（最后一轮吃尾差）
                const n = rows.length;
                const totalCents = Math.round(paidBase * 100);
                const base = Math.floor(totalCents / n);
                const remainder = totalCents - base * n;

                modePlayAllocList = rows.map((r: any, idx: number) => {
                    const cents = base + (idx === n - 1 ? remainder : 0);
                    return {
                        dispatchId: Number(r.dispatchId),
                        income: cents / 100,
                    };
                });

                // ✅ 把 UI 也同步成默认均分（避免预览结果和表格展示不一致）
                setRecalcModePlayAlloc((prev: any) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        rows: (prev.rows || []).map((r: any, idx: number) => ({
                            ...r,
                            income: modePlayAllocList![idx]?.income ?? toNum(r.income ?? 0),
                        })),
                    };
                });
            }
        }

        try {
            setToolsLoading(true);

            // 清理旧结果，避免误读
            setRepairPreview(null);
            setRecalcResult(null);
            setToolsResult(null);

            const res = await recalculateOrderSettlements({
                id: Number(order.id),
                reason: toolsRemark || undefined,
                scope: 'COMPLETED_AND_ARCHIVED',
                dryRun: true,
                applyRepair: false,

                ...(isModePlay ? { modePlayAllocList } : {}),
            } as any);

            setRepairPreview(res);
            setRecalcResult(res);
            setToolsResult(res);
            setToolsStep('PREVIEWED');

            message.success('已生成修复预览，请核对后再确认应用');
        } finally {
            setToolsLoading(false);
        }
    };



    const runRecalcApply = async () => {
        if (!order?.id) return;

        // ✅ 防呆：必须先预览（你当前是看 repairPreview）
        if (!repairPreview) {
            message.warning('请先执行“修复预览”，确认无误后再点击“确认应用”');
            return;
        }

        // ✅ 口径：赠送单用 receivableAmount，否则用 paidAmount
        const paidBase = toNum(order?.isGifted !== true ? order?.paidAmount : order?.receivableAmount);

        // ✅ 玩法单：应用时也携带每轮金额（无论 need 与否）
        let modePlayAllocList: any[] | undefined = undefined;

        if (isModePlay) {
            const rows = (Array.isArray(recalcModePlayAlloc?.rows) && recalcModePlayAlloc.rows.length > 0)
                ? (recalcModePlayAlloc.rows as any[])
                : buildModePlayRoundRowsFromOrder(order);

            if (!Array.isArray(rows) || rows.length === 0) {
                message.warning('玩法单重算未找到可用的派单轮次（需要 COMPLETED/ARCHIVED 轮次）');
                return;
            }

            if (recalcModePlayAlloc?.need) {
                const v = validateModePlayAlloc(rows as any, paidBase);
                if (!v.ok) {
                    message.warning(v.err || '玩法单分轮收入校验未通过');
                    return;
                }
                modePlayAllocList = rows.map((r: any) => ({
                    dispatchId: Number(r.dispatchId),
                    income: toNum(r.income ?? 0),
                }));
            } else {
                // need=false：自动按轮次均分 paidBase（最后一轮吃尾差）
                const n = rows.length;
                const totalCents = Math.round(paidBase * 100);
                const base = Math.floor(totalCents / n);
                const remainder = totalCents - base * n;

                modePlayAllocList = rows.map((r: any, idx: number) => {
                    const cents = base + (idx === n - 1 ? remainder : 0);
                    return {
                        dispatchId: Number(r.dispatchId),
                        income: cents / 100,
                    };
                });
            }
        }

        try {
            setToolsLoading(true);
            setToolsResult(null);

            const res = await recalculateOrderSettlements({
                id: Number(order.id),
                reason: toolsRemark || undefined,
                applyRepair: true,
                dryRun: false,
                scope: 'COMPLETED_AND_ARCHIVED',

                ...(isModePlay ? { modePlayAllocList } : {}),
            } as any);

            setToolsResult(res);
            setToolsStep('APPLIED');

            message.success('已确认应用：已重建结算&钱包流水');

            // ✅ 清空预览，避免重复点击误用旧预览
            setRepairPreview(null);

            // 可选：应用后刷新详情
            // await reloadOrderDetail();
        } finally {
            setToolsLoading(false);
        }
    };



    const toNum = (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    const getDispatchParticipantIds = (d: any): number[] => {
        // 注意：ARCHIVED 轮参与者 isActive 可能 false，这里不要按 isActive 过滤
        const parts = Array.isArray(d?.participants) ? d.participants : [];
        const ids = parts
            .map((p: any) => Number(p?.userId))
            .filter((n: number) => Number.isFinite(n) && n > 0);
        return Array.from(new Set(ids)).sort((a, b) => a - b);
    };

    const getParticipantDisplayName = (p: any): string => {
        return (
            p?.name ||
            p?.user?.name ||
            `UID:${p?.id ?? ''}`
        );
    };

    const buildModePlayAllocState = (detail: any): ModePlayAllocState => {
        const dispatches = Array.isArray(detail?.dispatches) ? detail.dispatches : [];
        // 只取“确实有参与者”的轮次（避免空轮影响判断）
        const used = dispatches
            .map((d: any, idx: number) => {
                const parts = Array.isArray(d?.participants) ? d.participants : [];

                const pids = parts
                    .map((p: any) => Number(p?.userId))
                    .filter((n: number) => Number.isFinite(n) && n > 0);

                const uniqueIds = Array.from(new Set(pids)).sort((a, b) => a - b);

                const names = parts
                    .filter((p: any) => uniqueIds.includes(Number(p?.userId)))
                    .map(getParticipantDisplayName);

                return {
                    d,
                    idx,
                    pids: uniqueIds,
                    names,
                };
            })
            .filter((x: any) => x.pids.length > 0);


        if (used.length <= 1) {
            return {need: false, rows: []};
        }

        const sig0 = used[0].pids.join(',');
        const allSame = used.every((x: any) => x.pids.join(',') === sig0);

        if (allSame) {
            return {need: false, rows: []};
        }

        // need=true：按派单轮生成输入行
        let rows: ModePlayRoundRow[] = used.map((x: any, i: number) => ({
            key: String(x?.d?.id ?? i),
            dispatchId: Number(x?.d?.id),
            round: Number(x?.d?.round ?? (i + 1)),
            participantIds: x.pids,
            participantNames: x.names,
            participantCount: x.pids.length,
            income: 0,
        }));

        // ✅ 默认：按轮次均分实付金额
        rows = seedModePlayEqualByRound(rows, toNum(detail?.isGifted !== true ? detail?.paidAmount : detail?.receivableAmount));

        return {need: true, rows};
    };


    // ==========================
    // 客服确认结单（两段式结单第二步）
    // ==========================
    const openConfirmComplete = () => {
        setConfirmCompleteRemark('');

        // ✅ 玩法单：在打开弹窗前一次性初始化分轮表格
        if (isModePlay) {
            const alloc = buildModePlayAllocState(order);
            setModePlayAlloc(alloc);
        } else {
            setModePlayAlloc(null);
        }

        setConfirmCompleteOpen(true);
    };


    const buildModePlayAllocList = (params: {
        isModePlay: boolean;
        paidAmount: number;
        allocState: any; // modePlayAlloc 或 recalcModePlayAlloc
    }) => {
        const { isModePlay, paidAmount, allocState } = params;
        if (!isModePlay) return undefined;

        const rows = (allocState?.rows ?? []) as any[];
        if (!Array.isArray(rows) || rows.length === 0) {
            return null; // 用于上层提示阻断
        }

        // need=true：用表格输入
        if (allocState?.need) {
            return rows.map((r) => ({
                dispatchId: Number(r.dispatchId),
                income: Number(r.income ?? 0),
            }));
        }

        // need=false：按轮次均分 paidAmount（最后一轮吃尾差）
        const n = rows.length;
        const totalCents = Math.round(Number(paidAmount ?? 0) * 100);
        const base = Math.floor(totalCents / n);
        const remainder = totalCents - base * n;

        return rows.map((r, idx) => {
            const cents = base + (idx === n - 1 ? remainder : 0);
            return {
                dispatchId: Number(r.dispatchId),
                income: cents / 100,
            };
        });
    };

    const submitConfirmComplete = async () => {
        if (!order?.id) return;

        // ✅ 口径：赠送单用 receivableAmount，否则用 paidAmount（和你校验/传参统一）
        const paidBase = toNum(order?.isGifted !== true ? order?.paidAmount : order?.receivableAmount);

        try {
            setConfirmCompleteLoading(true);

            // ✅ 玩法单：无论 need 与否，都必须传 modePlayAllocList（按派单轮次）
            let modePlayAllocList: any[] | undefined = undefined;

            if (isModePlay) {
                // ✅ rows 兜底：优先用弹窗 state，没有就从 order.dispatches 现算
                const rows =
                    (Array.isArray(modePlayAlloc?.rows) && modePlayAlloc.rows.length > 0)
                        ? (modePlayAlloc.rows as any[])
                        : buildModePlayRoundRowsFromOrder(order);

                if (!Array.isArray(rows) || rows.length === 0) {
                    message.warning('玩法单结单未找到可用派单轮次（需要 COMPLETED/ARCHIVED 轮次）');
                    return;
                }

                if (modePlayAlloc?.need === true) {
                    // ✅ need=true：必须人工分配 + 校验
                    const v = validateModePlayAlloc(rows as any, paidBase);
                    if (!v.ok) {
                        message.warning(v.err || '请先完成玩法单分配校验');
                        return;
                    }
                    modePlayAllocList = rows.map((r: any) => ({
                        dispatchId: Number(r.dispatchId),
                        income: toNum(r.income ?? 0),
                    }));
                } else {
                    // ✅ need=false 或 need 未初始化：默认按轮次均分 paidBase（最后一轮吃尾差）
                    const n = rows.length;
                    const totalCents = Math.round(paidBase * 100);
                    const base = Math.floor(totalCents / n);
                    const remainder = totalCents - base * n;

                    modePlayAllocList = rows.map((r: any, idx: number) => {
                        const cents = base + (idx === n - 1 ? remainder : 0);
                        return {
                            dispatchId: Number(r.dispatchId),
                            income: cents / 100,
                        };
                    });
                }
            }

            const payload: any = {
                id: Number(order.id),
                remark: confirmCompleteRemark || undefined,
                paidAmount: paidBase,
                confirmPaid: true,
            };

            if (isModePlay) payload.modePlayAllocList = modePlayAllocList;

            await confirmCompleteOrder(payload);

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

    const isHourly = billingMode === 'HOURLY'; //小时单
    const isGuaranteed = billingMode === 'GUARANTEED'; //保底单
    const isModePlay = billingMode === 'MODE_PLAY';  //玩法单

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
        if (isHourly) {
            setArchFixValue(Number(d?.billableHours ?? 0));
        } else if (isGuaranteed) {
            setArchFixValue(Number.isFinite(total) ? total : 0);
        }
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
            // ✅ 必须拿到 OrderParticipant.id
            const fixParts = parts.filter((p: any) => Number(p?.id) > 0);

            if (!fixParts.length) {
                message.warning('该轮没有可修复的参与者（缺少 participant.id）');
                return;
            }

            const value = Number(archFixValue ?? 0);
            if (!Number.isFinite(value)) {
                message.warning(isHourly ? '请输入合法的小时数' : '请输入合法的整数进度（万）');
                return;
            }

            setArchFixSubmitting(true);

            // =========================
            // 保底单：仍然按「总进度均分」
            // =========================
            if (isGuaranteed) {
                const splits = splitEvenlyInt(Math.trunc(value), fixParts.length);

                const progresses = fixParts.map((p: any, idx: number) => ({
                    participantId: Number(p.id),
                    userId: Number(p?.userId),
                    progressBaseWan: splits[idx] ?? 0,
                }));

                await updateArchivedProgressTotal({
                    dispatchId: Number(d.id),
                    fixType: 'GUARANTEED',
                    totalProgressBaseWan: Math.trunc(value), // ✅ 允许负数
                    remark: `ARCHIVED_FIX_TOTAL_WAN=${Math.trunc(value)}（均分到本轮参与人，并重算该轮结算）`,
                });
            }

            // =========================
            // 小时单：修复 billableHours
            // =========================
            if (isHourly) {
                await updateArchivedProgressTotal({
                    dispatchId: Number(d.id),
                    fixType: 'HOURLY',
                    billableHours: value,
                    remark: `ARCHIVED_FIX_HOURS=${value}（小时单修复，重算该轮结算）`,
                });
            }

            message.success('已修复该轮存单数据');
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
    const {earningsSummary, walletEarningsSummary, reconcileHint, reconcileHintByUser} = useOrderReconcile(order);


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
        {
            title: '本轮时长',
            dataIndex: 'billableHours',
            width: 120,
            render: (v: any) => (v ? v + '小时' : '-')
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
        // {
        //     title: '操作',
        //     width: 120,
        //     render: (_: any, row: any) => {
        //         const key = `${row.dispatchId}_${row.userId}`;
        //         const s = settlementMap.get(key);
        //         if (!s) return '-';
        //         return (
        //             <Button size="small" onClick={() => openAdjust(s)}>
        //                 调整收益
        //             </Button>
        //         );
        //     },
        // },
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
                    {String(order?.status) === 'COMPLETED' ? (
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
                    ) : null}

                    <Col span={12}>
                        <Button
                            icon={<ReloadOutlined/>}
                            block
                            style={{height: 44, borderRadius: 14}}
                            onClick={loadDetail}
                        >
                            刷新
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

    // ✅ 对账提示（以钱包流水为准）
    const ws = walletEarningsSummary as any;
    const ReconcileHintBlock = (
        <Card size="small" style={{borderRadius: 14}}>
            <Space direction="vertical" size={10} style={{width: '100%'}}>
                {/* ===== 总体状态行 ===== */}
                <Space wrap>
                    <Tag
                        color={
                            reconcileHint?.status === 'MATCHED'
                                ? 'green'
                                : reconcileHint?.status === 'MISMATCHED'
                                ? 'red'
                                : 'default'
                        }
                        style={{borderRadius: 999, fontWeight: 600}}
                    >
                        对账：
                        {reconcileHint?.status === 'MATCHED'
                            ? '一致'
                            : reconcileHint?.status === 'MISMATCHED'
                                ? '不一致'
                                : '暂无'}
                    </Tag>

                    {/* ✅ 钱包净额（IN-OUT） */}
                    <Tag style={{borderRadius: 999, fontWeight: 600}}>
                        钱包净额：¥{ws ? Number(ws.netTotal ?? ws.total ?? 0).toFixed(2) : '-'}
                    </Tag>

                    {/* ✅ 钱包 IN / OUT */}
                    <Tag style={{borderRadius: 999}}>
                        钱包入账(IN)：¥{ws ? Number(ws.inTotal || 0).toFixed(2) : '-'}
                    </Tag>
                    <Tag style={{borderRadius: 999}}>
                        扣除(OUT)：¥{ws ? Number(ws.outTotal || 0).toFixed(2) : '-'}
                    </Tag>

                    {/* 可用/冻结（净额口径，避免误解） */}
                    <Tag style={{borderRadius: 999}}>
                        可用净额：¥{ws ? Number(ws.available || 0).toFixed(2) : '-'}
                    </Tag>
                    <Tag style={{borderRadius: 999}}>
                        冻结净额：¥{ws ? Number(ws.frozen || 0).toFixed(2) : '-'}
                    </Tag>

                    {/* 结算参考 */}
                    <Tag style={{borderRadius: 999}}>
                        结算参考：¥{reconcileHint ? Number(reconcileHint.settlementTotal || 0).toFixed(2) : '-'}
                    </Tag>

                    {/* 差额（钱包净额 - 结算参考） */}
                    <Tag
                        color={
                            reconcileHint
                                ? Number(reconcileHint.diff || 0) === 0
                                ? 'green'
                                : 'red'
                                : 'default'
                        }
                        style={{borderRadius: 999}}
                    >
                        差额：
                        {reconcileHint
                            ? `${Number(reconcileHint.diff || 0) > 0 ? '+' : ''}¥${Number(reconcileHint.diff || 0).toFixed(2)}`
                            : '-'}
                    </Tag>
                </Space>

                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    说明：钱包流水按 <b>direction</b> 区分 IN / OUT；对账口径使用
                    <b>「钱包净额（IN-OUT）」</b> 对比 <b>「结算参考」</b>。
                </Typography.Text>

                <Collapse
                    defaultActiveKey={[]}
                    items={[
                        {
                            key: 'reconcileDetail',
                            label: '展开对账详情（按人）',
                            children: (
                                <Space direction="vertical" size={12} style={{width: '100%'}}>
                                    <Descriptions bordered size="small" column={isMobile ? 1 : 4}>
                                        <Descriptions.Item label="对账状态">
                                            {reconcileHint?.status ?? '-'}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="钱包净额（IN-OUT）">
                                            ¥{ws ? Number(ws.netTotal ?? ws.total ?? 0).toFixed(2) : '-'}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="结算参考（finalEarnings 汇总）">
                                            ¥{reconcileHint ? Number(reconcileHint.settlementTotal || 0).toFixed(2) : '-'}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="差额（钱包净额-结算）">
                                            {reconcileHint
                                                ? `${Number(reconcileHint.diff || 0) > 0 ? '+' : ''}¥${Number(reconcileHint.diff || 0).toFixed(2)}`
                                                : '-'}
                                        </Descriptions.Item>
                                    </Descriptions>

                                    <Table
                                        size="small"
                                        rowKey="userId"
                                        pagination={false}
                                        dataSource={Array.isArray(reconcileHintByUser) ? reconcileHintByUser : []}
                                        locale={{emptyText: '暂无对账数据'}}
                                        columns={[
                                            {
                                                title: '参与者',
                                                dataIndex: 'userName',
                                                width: 120,
                                            },
                                            {
                                                title: '钱包 总收入',
                                                dataIndex: 'walletIn',
                                                align: 'right',
                                                render: (v) => (
                                                    <span style={{color: '#389e0d', fontWeight: 500}}>
                                                        +¥{Number(v).toFixed(2)}
                                                    </span>
                                                ),
                                            },
                                            {
                                                title: '钱包 总支出',
                                                dataIndex: 'walletOut',
                                                align: 'right',
                                                render: (v) => (
                                                    <span style={{color: '#cf1322', fontWeight: 500}}>
                                                        -¥{Number(v).toFixed(2)}
                                                    </span>
                                                ),
                                            },
                                            {
                                                title: '钱包净额',
                                                dataIndex: 'walletNet',
                                                align: 'right',
                                                render: (v) => {
                                                    const n = Number(v);
                                                    return (
                                                        <span
                                                            style={{
                                                                fontWeight: 600,
                                                                color: n >= 0 ? '#389e0d' : '#cf1322',
                                                            }}>
                                                            {n >= 0 ? '+' : '-'}¥{n.toFixed(2)}
                                                        </span>
                                                    );
                                                },
                                            },
                                            {
                                                title: '结算参考',
                                                dataIndex: 'settlementTotal',
                                                align: 'right',
                                                render: (v) => `¥${Number(v).toFixed(2)}`,
                                            },
                                            {
                                                title: '差额（净额-结算）',
                                                dataIndex: 'diff',
                                                align: 'right',
                                                render: (v) => {
                                                    const n = Number(v);
                                                    return (
                                                        <span style={{
                                                            fontWeight: 600,
                                                            color: n === 0 ? '#389e0d' : '#cf1322',
                                                        }}>
                                                            {n > 0 ? '+' : ''}¥{n.toFixed(2)}
                                                        </span>
                                                    );
                                                },
                                            },
                                            {
                                                title: '状态',
                                                dataIndex: 'status',
                                                width: 90,
                                                render: (s) => (
                                                    <Tag
                                                        color={s === 'MATCHED' ? 'green' : 'red'}
                                                        style={{borderRadius: 999}}
                                                    >
                                                        {s === 'MATCHED' ? '一致' : '不一致'}
                                                    </Tag>
                                                ),
                                            },
                                        ]}

                                    />
                                </Space>
                            ),
                        },
                    ]}
                />
            </Space>
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
                        <Button icon={<ReloadOutlined/>} onClick={loadDetail}>
                            刷新
                        </Button>
                        {String(order?.status) === 'COMPLETED' ? (
                            <Button icon={<ProfileOutlined/>} onClick={openTools}>
                                工具
                            </Button>
                        ) : null}

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
                            // const canArchFix = String(order?.status) === 'ARCHIVED' &&
                            //     isGuaranteed && String(dispatchRow?.status) === 'ARCHIVED' &&
                            //     Array.isArray(dispatchRow?.participants) &&
                            //     dispatchRow.participants.length > 0;
                            const canArchFix = String(order?.status) === 'ARCHIVED' && (isGuaranteed || isHourly) &&
                                String(dispatchRow?.status) === 'ARCHIVED' &&
                                Array.isArray(dispatchRow?.participants) &&
                                dispatchRow.participants.length > 0;

                            const ArchFixBar = canArchFix ? (
                                <div style={{marginBottom: 10}}>
                                    <Tag color="gold" style={{borderRadius: 999, marginRight: 8}}>
                                        {isGuaranteed ? '存单修复：修改本轮总保底进度（万），系统将均分给本轮成员' : ''}
                                        {isHourly ? '存单修复：修改本轮总时长，系统将同步调整本轮参与成员时长' : ''}
                                    </Tag>
                                    <Button size="small" onClick={() => openArchFix(dispatchRow)}
                                            style={{borderRadius: 10}}>
                                        {`修复本轮${isGuaranteed ? '保底' : '时长'}`}
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
            {ReconcileHintBlock}
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
                                    {ReconcileHintBlock}
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
            {/*<Modal*/}
            {/*    title="调整实际收益（奖惩/纠错）"*/}
            {/*    open={adjustOpen}*/}
            {/*    onCancel={() => setAdjustOpen(false)}*/}
            {/*    onOk={submitAdjust}*/}
            {/*    confirmLoading={adjustSubmitting}*/}
            {/*    destroyOnClose*/}
            {/*>*/}
            {/*    <Form form={adjustForm} layout="vertical">*/}
            {/*        <Form.Item*/}
            {/*            name="finalEarnings"*/}
            {/*            label="实际收益"*/}
            {/*            rules={[*/}
            {/*                {required: true, message: '请输入实际收益'},*/}
            {/*                () => ({*/}
            {/*                    validator: async (_, val) => {*/}
            {/*                        const n = Number(val);*/}
            {/*                        if (!Number.isFinite(n)) throw new Error('金额非法');*/}
            {/*                    },*/}
            {/*                }),*/}
            {/*            ]}*/}
            {/*        >*/}
            {/*            <InputNumber precision={2} style={{width: '100%'}}/>*/}
            {/*        </Form.Item>*/}
            {/*        <Form.Item name="remark" label="调整原因（必填建议）" rules={[{required: true, message: '请填写调整原因'}]}>*/}
            {/*            <Input placeholder="例如：违规扣款/优秀奖励/客服补偿" allowClear/>*/}
            {/*        </Form.Item>*/}
            {/*        <Tag color="gold" style={{borderRadius: 999}}>该操作会写入操作日志（ADJUST_SETTLEMENT）。</Tag>*/}
            {/*    </Form>*/}
            {/*</Modal>*/}

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
                isHourly 判断小时单
                isHourly 判断小时单
               ========================== */}
            <Modal
                open={archFixOpen}
                title={`存单修复：第 ${archFixDispatch?.round ?? '-'} 轮${isHourly ? '（调整小时单时长）' : '（总保底进度均分）'}`}
                onCancel={() => setArchFixOpen(false)}
                onOk={submitArchFix}
                confirmLoading={archFixSubmitting}
                okText="保存"
                destroyOnClose
            >
                <Space direction="vertical" size={10} style={{width: '100%'}}>
                    <Typography.Text type="secondary">
                        说明：仅对“存单”轮开放修复入口。你只需要输入本轮总进度（万）/时长，系统会根据订单类型调整本轮所有成员。
                    </Typography.Text>

                    <div>
                        <div style={{marginBottom: 6}}>
                            {isHourly ? '本轮计费时长（小时）' : '本轮总保底进度（万，允许负数）'}
                        </div>

                        <InputNumber
                            style={{width: '220px'}}
                            precision={isHourly ? 1 : 0}
                            step={isHourly ? 0.5 : 1}
                            value={archFixValue}
                            addonAfter={isHourly ? '小时' : '万/哈夫币'}
                            onChange={(v) => {
                                if (isHourly) {
                                    const n = Number(v ?? 0);
                                    if (!Number.isFinite(n)) {
                                        setArchFixValue(0);
                                        return;
                                    }
                                    // 向最接近的 0.5 对齐
                                    const fixed = Math.round(n * 2) / 2;
                                    setArchFixValue(fixed);
                                } else {
                                    setArchFixValue(Number(v ?? 0))
                                }
                            }}
                        />

                        <div style={{marginTop: 6, fontSize: 12, opacity: 0.65}}>
                            本轮成员数：
                            {Array.isArray(archFixDispatch?.participants)
                                ? archFixDispatch.participants.length
                                : 0}人参与 <br/>
                            注意：{isHourly ? '小时单最小单位为0.5小时' : '保底单存单最低大于30万'}
                        </div>
                    </div>

                    <Tag color="gold" style={{borderRadius: 999}}>
                        注意：这是“纠错/修复”入口，不可逆。请务必和参与成员与客户核对确认后再保存。
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
                onClose={() => {
                    setToolsOpen(false)
                    setDebugJsonEnabled(false);
                }}
                destroyOnClose
            >
                <Space direction="vertical" size={12} style={{width: '100%'}}>
                    <Card size="small" style={{borderRadius: 14}} bodyStyle={{padding: 12}}>
                        <Space align="center" size={8}>
                            <Switch
                                checked={debugJsonEnabled}
                                onChange={(v) => setDebugJsonEnabled(v)}
                            />
                            <Typography.Text type="secondary">
                                调试模式（显示原始 JSON，仅研发/主管使用）
                            </Typography.Text>
                        </Space>
                        <Space direction="vertical" size={10} style={{width: '100%'}}>
                            <Typography.Text strong>操作备注（可选）</Typography.Text>
                            <Input.TextArea
                                value={toolsRemark}
                                onChange={(e) => setToolsRemark(e.target.value)}
                                rows={3}
                                placeholder="用于审计追溯：例如“客户投诉核对后修复结算/补收后重新计算”等"
                            />
                            {isModePlay ? (
                                <Card size="small"
                                      style={{borderRadius: 12, background: '#fffbe6', border: '1px solid #ffe58f'}}
                                      bodyStyle={{padding: 12}}>
                                    <Space direction="vertical" size={10} style={{width: '100%'}}>
                                        <Typography.Text strong style={{color: '#d48806'}}>
                                            玩法单：每轮收入（重算必填）
                                        </Typography.Text>

                                        {recalcModePlayAlloc?.need ? (
                                            <>
                                                <Space wrap>
                                                    <Button
                                                        size="small"
                                                        onClick={() => {
                                                            const paid = Number(order?.paidAmount ?? 0);
                                                            const rows = recalcModePlayAlloc?.rows ?? [];
                                                            const seeded = seedModePlayEqualByRound(rows as any, paid);
                                                            setRecalcModePlayAlloc({
                                                                ...recalcModePlayAlloc,
                                                                rows: seeded
                                                            });
                                                        }}
                                                        style={{borderRadius: 10}}
                                                    >
                                                        按轮均分实付金额
                                                    </Button>
                                                    <Typography.Text type="secondary" style={{fontSize: 12}}>
                                                        默认按轮次均分（最后一轮自动补尾差），可手动微调
                                                    </Typography.Text>
                                                </Space>

                                                {(() => {
                                                    const paid = Number(order?.paidAmount ?? 0);
                                                    const rows = recalcModePlayAlloc?.rows ?? [];
                                                    const v = validateModePlayAlloc(rows as any, paid);

                                                    return (
                                                        <>
                                                            <Table
                                                                size="small"
                                                                rowKey="key"
                                                                pagination={false}
                                                                dataSource={rows}
                                                                columns={[
                                                                    {title: '轮次', dataIndex: 'round', width: 80},
                                                                    {
                                                                        title: '参与者',
                                                                        dataIndex: 'participantNames',
                                                                        render: (names: string[]) => (
                                                                            <Space size={4} wrap>
                                                                                {(names || []).map((n, idx) => (
                                                                                    <Tag key={idx}
                                                                                         style={{borderRadius: 999}}>
                                                                                        {n}
                                                                                    </Tag>
                                                                                ))}
                                                                            </Space>
                                                                        ),
                                                                    },
                                                                    {
                                                                        title: '人数',
                                                                        dataIndex: 'participantCount',
                                                                        width: 70
                                                                    },
                                                                    {
                                                                        title: '本轮收入',
                                                                        dataIndex: 'income',
                                                                        width: 180,
                                                                        render: (_: any, row: any) => (
                                                                            <InputNumber
                                                                                style={{width: '100%'}}
                                                                                min={0}
                                                                                precision={2}
                                                                                step={1}
                                                                                value={row.income}
                                                                                onChange={(val) => {
                                                                                    const nv = Number(val ?? 0);
                                                                                    setRecalcModePlayAlloc((prev: any) => {
                                                                                        if (!prev) return prev;
                                                                                        return {
                                                                                            ...prev,
                                                                                            rows: (prev.rows || []).map((r: any) =>
                                                                                                r.key === row.key ? {
                                                                                                    ...r,
                                                                                                    income: nv
                                                                                                } : r,
                                                                                            ),
                                                                                        };
                                                                                    });
                                                                                }}
                                                                                addonAfter="¥"
                                                                            />
                                                                        ),
                                                                    },
                                                                ]}
                                                            />

                                                            <div style={{
                                                                display: 'flex',
                                                                gap: 8,
                                                                marginTop: 10,
                                                                alignItems: 'center',
                                                                flexWrap: 'wrap'
                                                            }}>
                                                                <Tag
                                                                    style={{borderRadius: 999}}>已分配：¥{v.sum.toFixed(2)}</Tag>
                                                                <Tag
                                                                    style={{borderRadius: 999}}>实付金额：¥{paid.toFixed(2)}</Tag>
                                                                <Tag color={v.ok ? 'green' : 'red'}
                                                                     style={{borderRadius: 999}}>
                                                                    {v.ok ? '校验通过' : '校验不通过'}
                                                                </Tag>
                                                                {!v.ok ? (
                                                                    <Typography.Text type="danger"
                                                                                     style={{fontSize: 12}}>
                                                                        {v.err}
                                                                    </Typography.Text>
                                                                ) : null}
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </>
                                        ) : (
                                            <Typography.Text type="secondary" style={{fontSize: 12}}>
                                                当前玩法单各派单轮参与者一致：无需录入每轮收入，可直接重算。
                                            </Typography.Text>
                                        )}
                                    </Space>
                                </Card>
                            ) : null}

                            <Space wrap>
                                <Button
                                    loading={toolsLoading}
                                    type="primary"
                                    onClick={runRecalcPreview} // ✅ ① 只预览（不落库）
                                    icon={<ReloadOutlined/>}
                                    style={{borderRadius: 12}}
                                    disabled={(() => {
                                        if (!(isModePlay && recalcModePlayAlloc?.need)) return false;
                                        const paid = Number(order?.paidAmount ?? 0);
                                        const v = validateModePlayAlloc((recalcModePlayAlloc?.rows ?? []) as any, paid);
                                        return !v.ok;
                                    })()}
                                >
                                    ① 重新核算（预览）
                                </Button>

                                <Button
                                    loading={toolsLoading}
                                    danger
                                    onClick={runRecalcApply}   // ✅ ② 确认覆盖（落库）
                                    disabled={(() => {
                                        // 原逻辑：必须先预览
                                        if (!recalcResult || toolsStep !== 'PREVIEWED') return true;
                                        // 玩法单校验
                                        if (!(isModePlay && recalcModePlayAlloc?.need)) return false;
                                        const paid = Number(order?.paidAmount ?? 0);
                                        const v = validateModePlayAlloc((recalcModePlayAlloc?.rows ?? []) as any, paid);
                                        return !v.ok;
                                    })()}
                                    icon={<CheckCircleOutlined/>}
                                    style={{borderRadius: 12}}
                                >
                                    ② 确认重算（覆盖收益）
                                </Button>

                                <Button
                                    loading={toolsLoading}
                                    onClick={() => {
                                        setRecalcResult(null);
                                        setToolsResult(null);
                                        setToolsStep('INIT');
                                        initRecalcModePlayAlloc();
                                    }}
                                    style={{borderRadius: 12}}
                                >
                                    清空结果
                                </Button>
                            </Space>

                            <Typography.Text type="secondary" style={{fontSize: 12}}>
                                建议流程：① 重新核算（仅预览差异）→ 核对轮次/参与人/各列收益变化 → ② 确认重算（覆盖写入结算收益）。
                            </Typography.Text>
                        </Space>
                    </Card>

                    {/* 结果展示：优先用“可读 UI”，必要时兜底展示 JSON */}
                    {recalcResult ? renderRecalcResult(recalcResult) : null}

                    {/* 兜底：若后端返回结构未知，仍可查看原始 JSON */}

                    {debugJsonEnabled && toolsResult ? (
                        <Card
                            size="small"
                            title="结果（原始 JSON / 调试）"
                            style={{borderRadius: 14}}
                            bodyStyle={{maxHeight: isMobile ? '42vh' : 280, overflow: 'auto'}}
                        >
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
                destroyOnClose
                okButtonProps={{
                    // ✅ 玩法单 + 需要分配：校验不过不允许确认
                    disabled: (() => {
                        if (!(isModePlay && modePlayAlloc?.need)) return false;
                        const v = validateModePlayAlloc(modePlayAlloc.rows, toNum(order?.isGifted !== true ? order?.paidAmount : order?.receivableAmount));
                        return !v.ok;
                    })(),
                }}
            >
                <Space direction="vertical" size={12} style={{width: '100%'}}>

                    {/* ✅ 玩法单：多轮不同参与者 -> 分轮收入输入 */}
                    {isModePlay && modePlayAlloc?.need ? (() => {
                        const paid = toNum(order?.isGifted !== true ? order?.paidAmount : order?.receivableAmount);
                        const v = validateModePlayAlloc(modePlayAlloc.rows, paid);

                        return (
                            <div style={{
                                border: '1px solid #ffe58f',
                                background: '#fffbe6',
                                borderRadius: 12,
                                padding: 12
                            }}>
                                <div style={{fontWeight: 600, color: '#d48806', marginBottom: 6}}>
                                    ⚠ 当前玩法单存在多轮不同参与者
                                </div>
                                <div style={{color: '#8c8c8c', marginBottom: 10}}>
                                    请按派单轮次分配每一轮收入（系统将自动均分给该轮参与者）。分配合计不得大于订单实付金额。
                                </div>
                                <Space style={{marginBottom: 8}} wrap>
                                    <Button
                                        size="small"
                                        onClick={() => {
                                            setModePlayAlloc((prev) => {
                                                if (!prev) return prev;
                                                return {
                                                    ...prev,
                                                    rows: seedModePlayEqualByRound(prev.rows, toNum(order?.isGifted !== true ? order?.paidAmount : order?.receivableAmount)),
                                                };
                                            });
                                        }}
                                    >
                                        按轮均分实付金额
                                    </Button>
                                    <Typography.Text type="secondary" style={{fontSize: 12}}>
                                        默认已按轮次均分（最后一轮自动补尾差）
                                    </Typography.Text>
                                </Space>
                                <Table
                                    size="small"
                                    rowKey="key"
                                    pagination={false}
                                    dataSource={modePlayAlloc.rows}
                                    columns={[
                                        {title: '轮次', dataIndex: 'round', width: 50},
                                        {
                                            title: '参与者',
                                            dataIndex: 'participantNames',
                                            render: (names: string[]) => (
                                                <Space size={4} wrap>
                                                    {names.map((n, idx) => (
                                                        <Tag key={idx} style={{borderRadius: 999}}>
                                                            {n}
                                                        </Tag>
                                                    ))}
                                                </Space>
                                            ),
                                        },
                                        {
                                            title: '本轮收入',
                                            width: 160,
                                            dataIndex: 'income',
                                            render: (_: any, row: ModePlayRoundRow) => (
                                                <InputNumber
                                                    style={{width: '100%'}}
                                                    min={0}
                                                    precision={2}
                                                    step={1}
                                                    value={row.income}
                                                    onChange={(val) => {
                                                        const nv = Number(val ?? 0);
                                                        setModePlayAlloc((prev) => {
                                                            if (!prev) return prev;
                                                            return {
                                                                ...prev,
                                                                rows: prev.rows.map((r) => (r.key === row.key ? {
                                                                    ...r,
                                                                    income: nv
                                                                } : r)),
                                                            };
                                                        });
                                                    }}
                                                    addonAfter="¥"
                                                />
                                            ),
                                        },
                                    ]}
                                />

                                <div style={{
                                    display: 'flex',
                                    gap: 8,
                                    marginTop: 10,
                                    alignItems: 'center',
                                    flexWrap: 'wrap'
                                }}>
                                    <Tag style={{borderRadius: 999}}>已分配：¥{v.sum.toFixed(2)}</Tag>
                                    <Tag style={{borderRadius: 999}}>实付金额：¥{paid.toFixed(2)}</Tag>
                                    <Tag color={v.ok ? 'green' : 'red'} style={{borderRadius: 999}}>
                                        {v.ok ? '可继续分配' : '分配超额/非法'}
                                    </Tag>
                                </div>

                                <div style={{marginTop: 8, color: v.ok ? '#8c8c8c' : '#cf1322'}}>
                                    {v.ok
                                        ? '说明：每轮收入将自动均分给该轮所有参与者；允许存在未分配金额。'
                                        : (v.err || '请检查分配金额')}
                                </div>
                            </div>
                        );
                    })() : null}

                    <Input.TextArea
                        value={confirmCompleteRemark}
                        onChange={(e) => setConfirmCompleteRemark(e.target.value)}
                        rows={3}
                        placeholder="备注（可不填）：例如核对无误/补充说明"
                    />
                </Space>
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
