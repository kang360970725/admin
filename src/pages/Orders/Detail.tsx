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
    Divider,
    Col, Row,
} from 'antd';
import { useParams, useModel } from '@umijs/max';
import OrderUpsertModal from './components/OrderForm';

import {
    getOrderDetail,
    assignDispatch,
    updateDispatchParticipants,
    getPlayerOptions,
    updateOrderPaidAmount,
    getEnumDicts,
    adjustSettlementFinalEarnings,
    refundOrder, updateOrder,
} from '@/services/api';
import dayjs from "dayjs";

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


    const submitRefund = async () => {
        setRefundLoading(true);
        await refundOrder({ id: order?.id, remark: refundRemark });
        message.success('退款成功');
        setRefundOpen(false);
        loadDetail();
        setRefundLoading(false);
    };

    //创建订单后、复制相关功能模块
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
        }
    };

    const generateReceiptImageBase = (title: string, text: string) => {
        const lines = String(text ?? '').split('\n');

        const W = 980;
        const P = 48;
        const CARD_R = 24;

        const headerH = 86;
        const lineH = 36;

        // 自动换行
        const wrapLines = (ctx: CanvasRenderingContext2D, s: string, maxW: number) => {
            const out: string[] = [];
            let cur = '';
            for (const ch of s) {
                const next = cur + ch;
                if (ctx.measureText(next).width > maxW) {
                    if (cur) out.push(cur);
                    cur = ch;
                } else {
                    cur = next;
                }
            }
            if (cur) out.push(cur);
            return out.length ? out : [''];
        };

        // 先用临时 canvas 估高
        const tmp = document?.createElement?.('canvas');
        if (!tmp) return null;
        tmp.width = W;
        tmp.height = 10;
        const tctx = tmp.getContext('2d');
        if (!tctx) return null;

        tctx.font = '24px sans-serif';
        const maxTextW = W - P * 2 - 8;

        const wrapped: string[] = [];
        for (const ln of lines) {
            if (!ln) {
                wrapped.push('');
                continue;
            }
            const w = wrapLines(tctx, ln, maxTextW);
            wrapped.push(...w);
        }

        const bodyH = wrapped.length * lineH + 80;
        const H = P * 2 + headerH + bodyH;

        const canvas = document?.createElement?.('canvas');
        if (!canvas) return null;
        canvas.width = W;
        canvas.height = H;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // 背景（浅灰）
        ctx.fillStyle = '#f5f6f8';
        ctx.fillRect(0, 0, W, H);

        // 圆角卡片
        const x = P;
        const y = P;
        const cw = W - P * 2;
        const ch = H - P * 2;

        const roundRect = (rx: number, ry: number, rw: number, rh: number, r: number) => {
            ctx.beginPath();
            ctx.moveTo(rx + r, ry);
            ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
            ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
            ctx.arcTo(rx, ry + rh, rx, ry, r);
            ctx.arcTo(rx, ry, rx + rw, ry, r);
            ctx.closePath();
        };

        // 阴影
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.08)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 6;
        roundRect(x, y, cw, ch, CARD_R);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();

        // 标题条
        roundRect(x, y, cw, headerH, CARD_R);
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#111827';
        ctx.fillRect(x, y, cw, headerH);
        ctx.restore();

        // 标题文字
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText(title, x + 28, y + 54);

        // 次标题（右侧）
        ctx.font = '18px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        const rightText = dayjs().format('YYYY-MM-DD HH:mm');
        const tw = ctx.measureText(rightText).width;
        ctx.fillText(rightText, x + cw - 28 - tw, y + 54);

        // 内容区域
        const bodyX = x + 28;
        let yy = y + headerH + 36;

        ctx.fillStyle = '#111827';
        ctx.font = '24px sans-serif';

        for (const ln of wrapped) {
            if (ln === '') {
                yy += lineH * 0.6;
                continue;
            }
            ctx.fillText(ln, bodyX, yy);
            yy += lineH;
        }

        // 分割线
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bodyX, y + ch - 70);
        ctx.lineTo(x + cw - 28, y + ch - 70);
        ctx.stroke();

        // 底部提示
        ctx.fillStyle = '#6b7280';
        ctx.font = '18px sans-serif';
        ctx.fillText('BlueCat · 订单专用小票', bodyX, y + ch - 30);

        return canvas.toDataURL('image/png');
    };

    const generateReceiptImage = (title: string, text: string) => {
        const lines = String(text ?? '').split('\n');

        // ✅ 竖版尺寸（手机更友好）
        const W = 720;
        const P = 36;
        const CARD_R = 22;

        const headerH = 88;
        const lineH = 34;

        const canvasTmp = document?.createElement?.('canvas');
        if (!canvasTmp) return null;
        canvasTmp.width = W;
        canvasTmp.height = 10;
        const tctx = canvasTmp.getContext('2d');
        if (!tctx) return null;

        const maxTextW = W - P * 2 - 16;

        const wrapLines = (ctx: CanvasRenderingContext2D, s: string, maxW: number, font: string) => {
            ctx.font = font;
            const out: string[] = [];
            let cur = '';
            for (const ch of s) {
                const next = cur + ch;
                if (ctx.measureText(next).width > maxW) {
                    if (cur) out.push(cur);
                    cur = ch;
                } else {
                    cur = next;
                }
            }
            if (cur) out.push(cur);
            return out.length ? out : [''];
        };

        // ✅ 分段：温馨提醒之后使用更小字体
        let inTips = false;
        const prepared: Array<{ text: string; kind: 'normal' | 'tips' | 'blank' | 'titleline' }> = [];

        for (const raw of lines) {
            const ln = String(raw ?? '');
            if (!ln) {
                prepared.push({ text: '', kind: 'blank' });
                continue;
            }
            if (ln.includes('温馨提醒')) inTips = true;

            prepared.push({ text: ln, kind: inTips ? 'tips' : 'normal' });
        }

        // 先估算实际渲染行数（考虑换行）
        const expanded: Array<{ text: string; kind: 'normal' | 'tips' | 'blank' }> = [];
        for (const it of prepared) {
            if (it.kind === 'blank') {
                expanded.push({ text: '', kind: 'blank' });
                continue;
            }
            const font = it.kind === 'tips' ? '18px sans-serif' : '22px sans-serif';
            const ws = wrapLines(tctx, it.text, maxTextW, font);
            ws.forEach((w) => expanded.push({ text: w, kind: it.kind }));
        }

        const bodyH = expanded.length * lineH + 92;
        const H = P * 2 + headerH + bodyH;

        const canvas = document?.createElement?.('canvas');
        if (!canvas) return null;
        canvas.width = W;
        canvas.height = H;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // 背景
        ctx.fillStyle = '#f5f6f8';
        ctx.fillRect(0, 0, W, H);

        // 卡片区域
        const x = P;
        const y = P;
        const cw = W - P * 2;
        const ch = H - P * 2;

        const roundRect = (rx: number, ry: number, rw: number, rh: number, r: number) => {
            ctx.beginPath();
            ctx.moveTo(rx + r, ry);
            ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
            ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
            ctx.arcTo(rx, ry + rh, rx, ry, r);
            ctx.arcTo(rx, ry, rx + rw, ry, r);
            ctx.closePath();
        };

        // 阴影 + 白底
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.10)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 8;
        roundRect(x, y, cw, ch, CARD_R);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();

        // ✅ 上下锯齿（在卡片边缘挖半圆）
        const punch = (cy: number) => {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            const r = 8;
            const gap = 20;
            for (let px = x + 22; px < x + cw - 22; px += gap) {
                ctx.beginPath();
                ctx.arc(px, cy, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        };
        punch(y + headerH);        // 标题区下边缘
        punch(y + ch - 72);        // 底部提示上方

        // 标题条
        roundRect(x, y, cw, headerH, CARD_R);
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#111827';
        ctx.fillRect(x, y, cw, headerH);
        ctx.restore();

        // 标题文字
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText(title, x + 24, y + 56);

        // 右上角时间
        // ctx.font = '18px sans-serif';
        // ctx.fillStyle = 'rgba(255,255,255,0.75)';
        // const rightText = dayjs().format('YYYY-MM-DD HH:mm');
        // const tw = ctx.measureText(rightText).width;
        // ctx.fillText('打印时间：'+rightText, x + cw - 100 - tw, y + 56);

        // 内容
        let yy = y + headerH + 38;
        for (const it of expanded) {
            if (it.kind === 'blank') {
                yy += lineH * 0.55;
                continue;
            }

            // 温馨提示：更小、更浅
            if (it.kind === 'tips') {
                ctx.font = '18px sans-serif';
                ctx.fillStyle = '#6b7280';
            } else {
                ctx.font = '22px sans-serif';
                ctx.fillStyle = '#111827';
            }

            // ✅ 高亮：冒号后面内容更深/加粗（可按需扩展）
            const shouldHighlight =
                it.kind === 'normal' &&
                (it.text.startsWith('下单项目：') ||
                    it.text.startsWith('订单保底/小时：') ||
                    it.text.startsWith('预计结单时间：'));

            if (shouldHighlight) {
                const idx = it.text.indexOf('：');
                const left = idx >= 0 ? it.text.slice(0, idx + 1) : it.text;
                const right = idx >= 0 ? it.text.slice(idx + 1) : '';

                ctx.fillStyle = '#374151';
                ctx.fillText(left, x + 24, yy);

                const leftW = ctx.measureText(left).width;

                ctx.font = 'bold 22px sans-serif';
                ctx.fillStyle = '#111827';
                ctx.fillText(right, x + 24 + leftW, yy);
            } else {
                ctx.fillText(it.text, x + 24, yy);
            }

            yy += lineH;
        }

        // 底部分割线
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 24, y + ch - 66);
        ctx.lineTo(x + cw - 24, y + ch - 66);
        ctx.stroke();

        // 底部提示
        ctx.fillStyle = '#9ca3af';
        ctx.font = '16px sans-serif';
        const rightText = dayjs().format('YYYY-MM-DD HH:mm');
        ctx.fillText('BlueCat · 订单专用小票 · '+ rightText, x + 24, y + ch - 30);

        return canvas.toDataURL('image/png');
    };



// 从详情数据生成两段文案
    const buildReceiptTextsFromDetail = () => {
        const o: any = order || {}; // 你页面里已有 order 详情对象
        const projectName = o?.project?.name || o?.projectSnapshot?.name || '-';
        const billingMode = String(o?.projectSnapshot?.billingMode ?? o?.project?.billingMode ?? '');
        const isHourly = billingMode === 'HOURLY';

        // 订单编号：优先 autoSerial（如果有），否则 id
        const orderNo = String(o?.autoSerial ?? o?.id ?? '-');

        // 客户ID（游戏ID）
        const customerId = o?.customerGameId ?? '-';

        // 接待客服
        const csName = o?.dispatcher?.name || o?.dispatcher?.phone || '客服';

        // 接待陪玩（尽量从“当前轮参与者”取，取不到就给占位）
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

        // 小时单：预计小时（不依赖额外字段，按实付/单价估算）
        const unitPrice = Number(o?.projectSnapshot?.price ?? o?.project?.price);
        const paid = Number(o?.paidAmount ?? o?.receivableAmount);
        const estHours =
            isHourly && Number.isFinite(unitPrice) && unitPrice > 0 && Number.isFinite(paid) && paid >= 0
                ? paid / unitPrice
                : null;

        // 下单时间
        const orderTime = o?.orderTime ? dayjs(o.orderTime) : dayjs(o?.createdAt || new Date());

        // 预计结单时间（小时单）：下单时长往后延续 + 20分钟
        const endTime = isHourly && estHours != null
            ? orderTime.add(estHours, 'hour').add(20, 'minute')
            : null;

        const baseWan = o?.baseAmountWan ?? null;

        const customerText =
            [
                `下单项目：${projectName}`,
                // `客户ID：${customerId}`,
                `订单${estHours != null ? '时长' : '保底'}：${isHourly ? `${estHours != null ? estHours.toFixed(2) : '-'} 小时` : `${baseWan ?? '-'} 万`}`,
                `接待客服：${csName}`,
                `接待陪玩：${playerNames}`,
                isHourly ? `预计结单时间：${endTime ? endTime.format('YYYY-MM-DD HH:mm') : '-'}` : '',
                `下单时间：${orderTime.format('YYYY-MM-DD HH:mm')}`,
                `预计等待时间：5-10分钟`,
                ``,
                `温馨提醒：`,
                `消费过程中如遇任何问题，请随时联系本单客服处理～`,
                `订单完结 24 小时内支持售后，售后唯一渠道为客服处理；`,
                `请勿相信其他任何人，谨防上当受骗。`,
            ]
                .filter(Boolean)
                .join('\n');

        const staffText =
            [
                `订单编号：${orderNo}`,
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
        // setReceiptImgCustomer(generateReceiptImage('订单小票', customerText.split('\n')));
        setReceiptImgCustomer(generateReceiptImage('蓝猫爽打-订单小票', customerText));
        setReceiptType(type);
        setReceiptOpen(true);
    };

    const canDispatch = useMemo(() => {
        if (!order) return false;
        // 已结单/已退款：不允许
        if (order?.status === 'COMPLETED' || order?.status === 'REFUNDED') return false;

        // 没有 currentDispatch：WAIT_ASSIGN 才能派
        if (!currentDispatch?.id) return order?.status === 'WAIT_ASSIGN';

        // 有 currentDispatch：
        // - 当前派单 WAIT_ASSIGN / WAIT_ACCEPT 才允许“更新参与者”
        // - ARCHIVED 状态下必须创建新 dispatch（你已有逻辑：点击派单创建新 dispatch）
        const ds = String(currentDispatch.status);
        if (ds === 'WAIT_ASSIGN' || ds === 'WAIT_ACCEPT' || ds === 'ARCHIVED') return true;
        // ['WAIT_ASSIGN','WAIT_ACCEPT','WAIT_ACCEPT'].includes(currentDispatch.status)
        // 已接单/已结单：不允许从详情页直接改参与者
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
        const dispatches = Array.isArray(order?.dispatches) ? order?.dispatches : [];
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
        const list = Array.isArray(order?.settlements) ? order?.settlements : [];
        for (const s of list) {
            const key = `${s.dispatchId}_${s.userId}`;
            map.set(key, s);
        }
        return map;
    }, [order]);

    const historyDispatches = useMemo(() => {
        const list = Array.isArray(order?.dispatches) ? order?.dispatches : [];
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
        // {
        //     title: '贡献金额',
        //     dataIndex: 'contributionAmount',
        //     render: (v: any) => (v == null ? '-' : v),
        // },
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
        }
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
                            <Button onClick={() => openReceipt('staff')}>订单小票</Button>
                            {order?.status !== 'REFUNDED' && (
                            <Button danger onClick={() => setRefundOpen(true)}>退款</Button>)}
                            <Button type="primary" disabled={forbidEdit} onClick={openEditModal}>编辑订单</Button>
                            {/*<Button onClick={openDispatchModal}>*/}
                            {/*    /!* ✅ 存单/无派单/不可更新时统一叫“派单”，其余才叫“更新参与者” *!/*/}
                            {/*    {currentDispatch?.id && (currentDispatch.status === 'WAIT_ASSIGN' || currentDispatch.status === 'WAIT_ACCEPT')*/}
                            {/*        ? '更新参与者'*/}
                            {/*        : '派单'}*/}
                            {/*</Button>*/}
                            <Button onClick={openDispatchModal} disabled={canDispatch || forbidEdit}>
                                {/*{currentDispatch?.id ? '更新参与者' : '派单'}*/}
                                {currentDispatch?.id && ['WAIT_ASSIGN','WAIT_ACCEPT','WAIT_ACCEPT'].includes(currentDispatch.status)
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
                            {order?.dispatcher ? `${order?.dispatcher.name || '-'}（${order?.dispatcher.phone || '-'}）` : '-'}
                        </Descriptions.Item>

                        <Descriptions.Item label="下单时间">
                            {order?.orderTime ? new Date(order?.orderTime).toLocaleString() : '-'}
                        </Descriptions.Item>

                        <Descriptions.Item label="付款时间">
                            {order?.paymentTime ? new Date(order?.paymentTime).toLocaleString() : '-'}
                        </Descriptions.Item>
                    </Descriptions>
                </Card>

                {/* ✅ 已结单后不再显示“当前参与者（本轮）” */}
                {order?.status !== 'REFUNDED' && !hideCurrentParticipants ? (
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

                    <Tag color="blue">该操作会写入操作日志（UPDATE_PAID_AMOUNT）。</Tag>
                </Form>
            </Modal>
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
                    <Tag color="gold">该操作会写入操作日志（ADJUST_SETTLEMENT）。</Tag>
                </Form>
            </Modal>
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
                    onChange={e => setRefundRemark(e.target.value)}
                    placeholder="退款备注（可选）"
                />
            </Modal>
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
            <Modal
                open={receiptOpen}
                title="订单小票"
                onCancel={() => setReceiptOpen(false)}
                width={900}
                destroyOnClose
                footer={null}
            >
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
                    {/*<Button onClick={() => copyText(receiptTextCustomer)}>复制客户文案</Button>*/}
                </div>

                <Row gutter={16}>
                    {/* 左：客户小票 */}
                    <Col xs={24} lg={12}>
                        <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>客户小票</div>

                            {/*<Input.TextArea value={receiptTextCustomer} readOnly rows={6} />*/}

                            {receiptImgCustomer ? (
                                <div style={{ marginTop: 12 }}>
                                    {/*<div style={{ fontWeight: 600, marginBottom: 8 }}>图片预览</div>*/}
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <img
                                            src={receiptImgCustomer}
                                            alt="receipt"
                                            style={{
                                                width: 360,            // ✅ 竖版预览更像手机
                                                maxWidth: '100%',
                                                border: '1px solid #eee',
                                                borderRadius: 12,
                                                background: '#fff',
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : null}
                            <div style={{ marginTop: 8, color: 'rgba(0,0,0,.45)', fontSize: 12 }}>
                                提示：小票图片请直接右键复制图片即可。
                            </div>
                        </div>
                    </Col>

                    {/* 右：派单小票 */}
                    <Col xs={24} lg={12}>
                        <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 12, height: '93%' }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>派单话术</div>
                            <Input.TextArea value={receiptTextStaff} readOnly rows={6} />
                            <div style={{ marginTop: 8, color: 'rgba(0,0,0,.45)', fontSize: 12 }}>
                                提示：建议先复制派单话术发派单群，再复制客户小票发客户。
                            </div>
                            <div style={{marginTop: 48,display: 'flex', justifyContent: 'center' }} >
                                <Button type="primary" onClick={() => copyText(receiptTextStaff)}>一键复制派单</Button>
                            </div>
                        </div>
                    </Col>
                </Row>
            </Modal>

        </PageContainer>
    );
};

export default OrderDetailPage;
