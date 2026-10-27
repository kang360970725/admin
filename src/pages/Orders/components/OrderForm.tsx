// src/pages/Orders/components/OrderForm.tsx
// 说明：文件名虽为 OrderForm.tsx，但这里导出的是“新建/编辑订单通用弹窗”组件（OrderUpsertModal）
// 融合点：
// - 你现有 UI：宽弹窗 + Divider 分组 + 栅格（默认 2 列）+ 更美观
// - 新需求：下单数量 orderQuantity（小时单=下单小时），金额（应收/实收）按时长累加（= 项目单价 * 数量）
// - 兼容：可选派单（showPlayers）
// - 兼容：链式 ?. 防止空对象导致报错
// - 额外：提供小票生成所需展示字段（projectName/billingMode/unitPrice/playerNames），不建议传后端

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Col,
    Collapse,
    Alert,
    DatePicker,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Row,
    Radio,
    Select,
    Button,
    Checkbox,
    Drawer,
    List,
    Tag,
    Space,
    AutoComplete,
    QRCode,
    Typography,
} from 'antd';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas';
import { getGameProjectOptions, getMemberOrderContext, getOrderDetail, getOrderSourceOptions, getPlayerOptions, getUsers, getUserCoupons } from '@/services/api';
import { useIsMobile } from '@/utils/useIsMobile';
import { maskPhone } from '@/utils/privacy';
import { generateReceiptImage } from '@/utils/receiptImage';

type ProjectItem = {
    id: number;
    name: string;
    price?: number | null; // 小时单：每小时价格；非小时单：也可能用于默认金额
    baseAmount?: number | null; // 保底（万）
    billingMode?: 'HOURLY' | 'GUARANTEED' | string | null; // 计费方式：用于判断小时单
    category?: string | null;
    gameType?: string | null;
};

type MemberGameCardOption = {
    id: number;
    gameUniqueId: string;
    gameNickname?: string | null;
    gameCategoryName?: string | null;
    isPrimary?: boolean;
};

type OptionItem = { label: string; value: number };
const getErrorMessage = (error: any, fallback = '请求失败') => {
    const candidates = [
        error?.response?.data?.message,
        error?.data?.message,
        error?.message,
    ];
    for (const item of candidates) {
        if (Array.isArray(item)) {
            const text = item.filter(Boolean).join('；');
            if (text) return text;
        }
        const text = String(item || '').trim();
        if (text) return text;
    }
    return fallback;
};

type UserCouponOption = {
    id: number;
    templateId?: number;
    name: string;
    type?: string;
    discountValue?: number;
    thresholdAmount?: number;
    maxDiscountAmount?: number;
    applicableScope?: string;
    applicableProjectIds?: any;
    expiresAt?: string | null;
};

const MAX_PLAYERS = 2;
const ONLINE_QR_PAYMENT_PAUSED = true;
const LIVE_LUCKY_BAG_GIFT_SOURCE = 'LIVE_LUCKY_BAG_GIFT';

const toMoney = (value: any) => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
};

const formatCouponLabel = (row: any) => {
    const template = row?.template || {};
    const name = String(template?.name || `优惠券#${row?.id ?? '-'}`);
    const type = String(template?.type || '').toUpperCase();
    const discountValue = Number(template?.discountValue ?? 0);
    const thresholdAmount = Number(template?.thresholdAmount ?? 0);
    const maxDiscountAmount = Number(template?.maxDiscountAmount ?? 0);
    const ruleText = type === 'FULL_REDUCTION'
        ? `满${thresholdAmount.toFixed(2)}减${discountValue.toFixed(2)}`
        : type === 'DISCOUNT'
            ? `${discountValue > 1 ? discountValue : discountValue * 10}折${maxDiscountAmount > 0 ? `，最多减${maxDiscountAmount.toFixed(2)}` : ''}`
            : type === 'FREE'
                ? '免单券'
                : `抵扣${discountValue.toFixed(2)}`;
    const expireText = row?.expiresAt ? ` · ${dayjs(row.expiresAt).format('YYYY-MM-DD')}到期` : '';
    return `${name}（${ruleText}${expireText}）`;
};

const calcCouponPreviewDiscount = (coupon: UserCouponOption | null | undefined, originalAmount: number, projectId?: number) => {
    if (!coupon || !(originalAmount > 0)) return 0;
    const scope = String(coupon.applicableScope || 'ALL').toUpperCase();
    if (scope === 'PROJECT') {
        const ids = Array.isArray(coupon.applicableProjectIds)
            ? coupon.applicableProjectIds.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x))
            : [];
        if (ids.length && projectId && !ids.includes(Number(projectId))) return 0;
    }

    const type = String(coupon.type || '').toUpperCase();
    const discountValue = Number(coupon.discountValue ?? 0);
    const thresholdAmount = Number(coupon.thresholdAmount ?? 0);
    const maxDiscountAmount = Number(coupon.maxDiscountAmount ?? 0);
    let discount = 0;

    if (type === 'FULL_REDUCTION') {
        discount = originalAmount >= thresholdAmount ? discountValue : 0;
    } else if (type === 'DISCOUNT') {
        let rate = discountValue;
        if (rate > 1) rate = rate / 10;
        discount = rate > 0 && rate <= 1 ? originalAmount * (1 - rate) : 0;
    } else if (type === 'FREE') {
        discount = originalAmount;
    } else {
        discount = discountValue;
    }

    if (maxDiscountAmount > 0) discount = Math.min(discount, maxDiscountAmount);
    return toMoney(Math.min(Math.max(0, discount), originalAmount));
};

const isCouponUsableForProject = (coupon: UserCouponOption | null | undefined, project: ProjectItem | null | undefined, originalAmount: number) => {
    if (!coupon || !project?.id) return false;
    const scope = String(coupon.applicableScope || 'ALL').toUpperCase();
    const targetIds = Array.isArray(coupon.applicableProjectIds) ? coupon.applicableProjectIds : [];
    if (scope === 'PROJECT') {
        const ids = targetIds.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x));
        if (ids.length && !ids.includes(Number(project.id))) return false;
    }
    if (scope === 'CATEGORY') {
        const categoryId = String(project?.category || '').trim();
        const ids = targetIds.map((x: any) => String(x || '').trim()).filter(Boolean);
        if (!categoryId || (ids.length && !ids.includes(categoryId))) return false;
    }
    if (String(coupon.type || '').toUpperCase() === 'FULL_REDUCTION') {
        const threshold = Number(coupon.thresholdAmount ?? 0);
        if (threshold > 0 && toMoney(originalAmount) < threshold) return false;
    }
    return true;
};

// 注意：字段集合尽量与后端 /orders/create & /orders/update 可编辑字段一致
export type OrderUpsertValues = {
    id?: number;

    projectId: number;

    receivableAmount: number; // 应收
    paidAmount: number; // 实收
    settlementAmount?: number; // 结算金额
    settlementBaseAmount?: number;

    baseAmountWan?: number | null; // 订单保底（万）

    // ✅ 下单数量：小时单=下单小时；其它单默认 1
    orderQuantity?: number;

    customerGameId?: string;
    customerIdentifierType?: string;
    customerOriginalIdentifier?: string;
    customerUserId?: number;
    userCouponId?: number;
    manualAdjustAmount?: number;
    orderSource?: string;
    paymentChannel?: string;

    orderTime?: any;
    paymentTime?: any;

    csRate?: number;
    inviteRate?: number;
    inviter?: string;

    customClubRate?: number;
    remark?: string;

    // 新建时可选派单
    playerIds?: number[];
    isRenewal?: boolean;
    renewalPlayerIds?: number[];
    isDesignated?: boolean;
    designatedPlayerIds?: number[];

    // ---- 以下用于小票生成/展示，不建议直接传后端 ----
    projectName?: string;
    billingMode?: string;
    unitPrice?: number;
    playerNames?: string[];

    /** 是否赠送单：历史兼容字段，前端默认隐藏，不再展示编辑 */
    isGifted?: boolean;

    /**
     * 是否已收款（人工确认）
     * - 不能用 paymentTime 推断（因为前端会默认带当前时间）
     * - 赠送单 isGifted=true 时，这里仍允许传，但后端会按赠送单规则处理
     */
    isPaid?: boolean;
};

export default function OrderUpsertModal(props: {
    open: boolean;
    title: string;
    initialValues?: Partial<OrderUpsertValues>;
    showPlayers?: boolean; // ✅ 新建用：选择打手并派单
    onCancel: () => void;
    onSubmit: (payload: OrderUpsertValues) => Promise<void>;
    paymentResult?: any;
    onViewCreatedOrder?: (orderId: number) => void;
}) {
    const { open, title, initialValues, showPlayers, onCancel, onSubmit, paymentResult, onViewCreatedOrder } = props;
    const receiptLocked = Boolean(initialValues?.id && initialValues?.isPaid);
    const editingLocked = Boolean(initialValues?.id);

    const [form] = Form.useForm<OrderUpsertValues>();
    const isMobile = useIsMobile(768);

    const [submitting, setSubmitting] = useState(false);
    const paymentTicketRef = useRef<HTMLDivElement | null>(null);
    const [paymentTicketImage, setPaymentTicketImage] = useState('');
    const [paymentClock, setPaymentClock] = useState(() => Date.now());
    const [paymentConfirmed, setPaymentConfirmed] = useState(false);
    const [paidOrderDetail, setPaidOrderDetail] = useState<any>(null);
    const [paymentReceiptText, setPaymentReceiptText] = useState('');
    const [paymentReceiptImage, setPaymentReceiptImage] = useState('');
    const [paymentReceiptLoading, setPaymentReceiptLoading] = useState(false);
    const [generatedPaymentSignature, setGeneratedPaymentSignature] = useState('');

    // 项目下拉
    const [projectLoading, setProjectLoading] = useState(false);
    const [projectOptions, setProjectOptions] = useState<{ label: string; value: number }[]>([]);
    const [projectMap, setProjectMap] = useState<Record<number, ProjectItem>>({});

    // 打手下拉（可选）
    const [playerLoading, setPlayerLoading] = useState(false);
    const [playerOptions, setPlayerOptions] = useState<OptionItem[]>([]);
    const [playerMap, setPlayerMap] = useState<Record<number, string>>({});
    const [memberLoading, setMemberLoading] = useState(false);
    const [memberOptions, setMemberOptions] = useState<Array<{ label: string; value: number }>>([]);
    const [memberMetaMap, setMemberMetaMap] = useState<Record<number, { name: string; phone: string; balance: number; gameCards: MemberGameCardOption[] }>>({});
    const [memberOrderContext, setMemberOrderContext] = useState<any>(null);
    const [memberOrderContextLoading, setMemberOrderContextLoading] = useState(false);
    const memberContextRequestRef = useRef(0);
    const autoSelectedCardRef = useRef('');
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponOptions, setCouponOptions] = useState<Array<{ label: string; value: number; disabled?: boolean }>>([]);
    const [couponMetaMap, setCouponMetaMap] = useState<Record<number, UserCouponOption>>({});
    const [playerPickerOpen, setPlayerPickerOpen] = useState(false);
    const [playerPickerKeyword, setPlayerPickerKeyword] = useState('');
    const [orderSourceOptions, setOrderSourceOptions] = useState<Array<{ label: string; value: string }>>([]);

    const now = useMemo(() => dayjs(), []);

    // ---------- 数据获取（全部内聚在组件） ----------
    const fetchProjects = async (keyword?: string) => {
        setProjectLoading(true);
        try {
            const res = await getGameProjectOptions?.({ keyword: keyword || '' });

            // 兼容：接口可能直接返回数组，也可能包在 data 里
            const list: any[] = Array.isArray(res) ? res : (res?.data ?? []);
            const map: Record<number, ProjectItem> = {};

            const options = list.map((p: any) => {
                const id = Number(p?.id);
                const name = String(p?.name ?? '');

                map[id] = {
                    id,
                    name,
                    price: p?.price ?? null,
                    baseAmount: p?.baseAmount ?? null,
                    billingMode: p?.billingMode ?? null,
                    category: p?.category ?? null,
                    gameType: p?.gameType ?? null,
                };

                const priceText = p?.price != null ? `（¥${p.price}）` : '';
                return { value: id, label: `${name}${priceText}` };
            });

            setProjectMap(map);
            setProjectOptions(options);
        } catch (e) {
            console.error(e);
            message.error('获取项目列表失败');
            setProjectMap({});
            setProjectOptions([]);
        } finally {
            setProjectLoading(false);
        }
    };

    const fetchPlayers = async (keyword?: string) => {
        if (!showPlayers) return;
        setPlayerLoading(true);
        try {
            const res = await getPlayerOptions?.({ keyword: keyword || '', onlyIdle: true, onlyOnline: true });
            const list: any[] = Array.isArray(res) ? res : (res?.data ?? []);

            const map: Record<number, string> = {};
            const opts: OptionItem[] = list.map((u: any) => {
                const id = Number(u?.id);
                const name = String(u?.name || maskPhone(u?.phone) || '未命名');
                map[id] = name;
                return {
                    value: id,
                    label: `${name}-${u?.ratingName ?? '-'}-今日已接${u?.todayHandledCount ?? 0}`,
                };
            });

            setPlayerMap((prev) => ({ ...prev, ...map }));
            setPlayerOptions(opts);
        } catch (e) {
            console.error(e);
            message.error('获取打手列表失败');
            setPlayerMap((prev) => prev);
            setPlayerOptions([]);
        } finally {
            setPlayerLoading(false);
        }
    };

    const isHourlyProject = (pid?: number) => {
        const id = Number(pid);
        if (!id) return false;
        const mode = String(projectMap?.[id]?.billingMode ?? '');
        return mode === 'HOURLY';
    };

    const fetchOrderSources = async () => {
        try {
            const res: any = await getOrderSourceOptions();
            const list = Array.isArray(res) ? res : (res?.data ?? []);
            const options = list
                .map((item: any) => ({
                    value: String(item?.value || '').trim(),
                    label: String(item?.label || item?.value || '').trim(),
                }))
                .filter((item: any) => item.value && item.label);
            setOrderSourceOptions(options);
        } catch (e) {
            console.error(e);
            setOrderSourceOptions([]);
        }
    };

    const fetchMembers = async (keyword?: string) => {
        setMemberLoading(true);
        try {
            const res: any = await getUsers({
                page: 1,
                limit: 20,
                search: keyword || '',
                scene: 'MEMBER',
                includeStaffMembers: true,
            });
            const list = Array.isArray(res?.data) ? res.data : [];
            const nextMeta: Record<number, { name: string; phone: string; balance: number; gameCards: MemberGameCardOption[] }> = {};
            const nextOptions = list.map((item: any) => {
                const id = Number(item?.id || 0);
                const name = String(item?.name || '未命名会员').trim();
                const phone = String(item?.phone || '').trim();
                const memberCode = String(item?.memberProfile?.memberCode || '').trim();
                const balance = Number(item?.wallet?.availableBalance ?? 0);
                nextMeta[id] = { name, phone, balance, gameCards: Array.isArray(item?.memberGameCards) ? item.memberGameCards : [] };
                return {
                    value: id,
                    label: `${name}${phone ? `（${maskPhone(phone)}）` : ''}${memberCode ? ` · 编码${memberCode}` : ''} · 储值¥${balance.toFixed(2)}`,
                };
            });
            setMemberMetaMap((prev) => ({ ...prev, ...nextMeta }));
            setMemberOptions(nextOptions);
        } catch (e) {
            console.error(e);
            message.error('获取会员列表失败');
            setMemberOptions([]);
        } finally {
            setMemberLoading(false);
        }
    };

    const refreshMemberOrderContext = async (userIdInput?: number, projectIdInput?: number, amountInput?: number) => {
        const userId = Number(userIdInput ?? form?.getFieldValue?.('customerUserId') ?? 0);
        const projectId = Number(projectIdInput ?? form?.getFieldValue?.('projectId') ?? 0);
        const originalAmount = toMoney(amountInput ?? form?.getFieldValue?.('receivableAmount') ?? 0);
        if (!(userId > 0) || !(projectId > 0) || !(originalAmount > 0)) {
            setMemberOrderContext(null);
            return null;
        }
        setMemberOrderContextLoading(true);
        const requestId = ++memberContextRequestRef.current;
        try {
            const context: any = await getMemberOrderContext({ userId, projectId, originalAmount });
            if (requestId !== memberContextRequestRef.current) return null;
            setMemberOrderContext(context || null);
            const discount = context?.memberDiscount;
            if (discount?.applied && String(form?.getFieldValue?.('paymentChannel') || '').toUpperCase() === 'BALANCE') {
                const couponId = Number(form?.getFieldValue?.('userCouponId') || 0);
                const coupon = couponId > 0 ? couponMetaMap?.[couponId] : null;
                const couponDiscount = calcCouponPreviewDiscount(coupon, toMoney(discount.payableAmount), projectId);
                const payable = toMoney(Math.max(0, toMoney(discount.payableAmount) - couponDiscount));
                form?.setFieldsValue?.({ paidAmount: payable, settlementAmount: payable, manualAdjustAmount: 0 } as any);
            }
            return context;
        } catch (error) {
            console.error(error);
            setMemberOrderContext(null);
            message.error(getErrorMessage(error, '加载会员折扣及游戏名片失败'));
            return null;
        } finally {
            setMemberOrderContextLoading(false);
        }
    };

    const fetchMemberCoupons = async (userId?: number) => {
        const uid = Number(userId || 0);
        if (!uid) {
            setCouponOptions([]);
            setCouponMetaMap({});
            form?.setFieldValue?.('userCouponId' as any, undefined);
            return;
        }
        setCouponLoading(true);
        try {
            const res: any = await getUserCoupons({ page: 1, limit: 100, userId: uid, status: 'UNUSED' });
            const rows = Array.isArray(res?.data) ? res.data : [];
            const nowDate = dayjs();
            const nextMeta: Record<number, UserCouponOption> = {};
            const options = rows.map((row: any) => {
                const template = row?.template || {};
                const id = Number(row?.id || 0);
                nextMeta[id] = {
                    id,
                    templateId: Number(row?.templateId || template?.id || 0) || undefined,
                    name: String(template?.name || `优惠券#${id}`),
                    type: template?.type,
                    discountValue: template?.discountValue != null ? Number(template.discountValue) : undefined,
                    thresholdAmount: template?.thresholdAmount != null ? Number(template.thresholdAmount) : undefined,
                    maxDiscountAmount: template?.maxDiscountAmount != null ? Number(template.maxDiscountAmount) : undefined,
                    applicableScope: template?.applicableScope,
                    applicableProjectIds: template?.applicableProjectIds,
                    expiresAt: row?.expiresAt || null,
                };
                const expired = row?.expiresAt ? dayjs(row.expiresAt).isBefore(nowDate) : false;
                return {
                    value: id,
                    label: formatCouponLabel(row),
                    disabled: expired,
                };
            }).filter((item: any) => item.value);
            setCouponMetaMap(nextMeta);
            setCouponOptions(options);
        } catch (e) {
            console.error(e);
            message.error('获取会员优惠券失败');
            setCouponOptions([]);
            setCouponMetaMap({});
        } finally {
            setCouponLoading(false);
        }
    };

    // 小时单：金额=单价*下单数量（小时）
    const recalcHourlyAmount = (pid?: number, qty?: number) => {
        const id = Number(pid);
        if (!id) return;
        const p = projectMap?.[id];
        if (!p) return;
        if (String(p?.billingMode ?? '') !== 'HOURLY') return;

        const q = Number(qty ?? form?.getFieldValue?.('orderQuantity') ?? 0) || 0;
        if (p?.price != null && q > 0) {
            const total = Number(p.price) * q;
            form?.setFieldsValue?.({
                receivableAmount: total,
                paidAmount: receiptLocked ? initialValues?.paidAmount : calcPayableAfterCoupon(total, form?.getFieldValue?.('userCouponId' as any), id),
                settlementAmount: calcPayableAfterCoupon(total, form?.getFieldValue?.('userCouponId' as any), id),
            } as any);
        }
    };

    // 项目变更：同步金额/保底；小时单则开启“按数量(小时)计算”
    const syncByProject = (pid?: number) => {
        const id = Number(pid);
        if (!id) return;

        const p = projectMap?.[id];
        if (!p) return;

        // 小票展示字段
        form?.setFieldsValue?.({
            projectName: p?.name,
            billingMode: p?.billingMode ?? undefined,
            unitPrice: p?.price != null ? Number(p.price) : undefined,
        } as any);

        const patch: Partial<OrderUpsertValues> = {};

        // 保底同步
        patch.baseAmountWan = p?.baseAmount != null ? Number(p.baseAmount) : null;

        // 小时单：默认给 1（小时/数量）并计算金额
        if (String(p?.billingMode ?? '') === 'HOURLY') {
            const curQty = Number(form?.getFieldValue?.('orderQuantity') ?? 0) || 0;
            const qty = curQty > 0 ? curQty : 1;
            patch.orderQuantity = qty;

            if (p?.price != null) {
                const total = Number(p.price) * qty;
                patch.receivableAmount = total;
                const payable = calcPayableAfterCoupon(total, form?.getFieldValue?.('userCouponId' as any), id);
                patch.paidAmount = payable;
                patch.settlementAmount = payable;
            }
        } else {
            // 非小时单：数量默认 1（不展示，但提交需要）
            patch.orderQuantity = 1;

            // 非小时单：金额默认同步项目 price（你原有规则保持）
            if (p?.price != null) {
                const total = Number(p.price);
                const payable = calcPayableAfterCoupon(total, form?.getFieldValue?.('userCouponId' as any), id);
                patch.receivableAmount = total;
                patch.paidAmount = payable;
                patch.settlementAmount = payable;
            }
        }

        form?.setFieldsValue?.(patch as any);
    };

    // ---------- 打开弹窗：初始化 ----------
    useEffect(() => {
        if (!open) return;

        form?.resetFields?.();
        setMemberOrderContext(null);
        memberContextRequestRef.current += 1;
        autoSelectedCardRef.current = '';

        form?.setFieldsValue?.({
            ...initialValues,
            orderTime: initialValues?.orderTime ? dayjs(initialValues.orderTime) : now,
            paymentTime: initialValues?.paymentTime ? dayjs(initialValues.paymentTime) : undefined,
            orderQuantity:
                initialValues?.orderQuantity != null
                    ? Number(initialValues.orderQuantity)
                    : 1,
            isGifted: Boolean(initialValues?.isGifted ?? false),
            isRenewal: Boolean(initialValues?.isRenewal ?? false),
            renewalPlayerIds: Array.isArray(initialValues?.renewalPlayerIds) ? initialValues?.renewalPlayerIds : [],
            isDesignated: Boolean(initialValues?.isDesignated ?? false),
            designatedPlayerIds: Array.isArray(initialValues?.designatedPlayerIds) ? initialValues?.designatedPlayerIds : [],
            orderSource: initialValues?.orderSource || 'CUSTOMER_SERVICE_MANUAL',
            paymentChannel:
                ONLINE_QR_PAYMENT_PAUSED && String(initialValues?.paymentChannel || '').trim().toUpperCase() === 'SHOUQIANBA'
                    ? 'MANUAL'
                    : initialValues?.paymentChannel || 'MANUAL',
            isPaid: String(initialValues?.paymentChannel || 'MANUAL').trim().toUpperCase() === 'BALANCE'
                ? true
                : Boolean(initialValues?.isPaid ?? false),
            settlementAmount:
                initialValues?.settlementAmount != null
                    ? Number(initialValues.settlementAmount)
                    : (initialValues?.settlementBaseAmount != null
                        ? Number(initialValues.settlementBaseAmount)
                        : (initialValues?.paidAmount != null
                            ? Number(initialValues.paidAmount)
                            : (initialValues?.receivableAmount != null ? Number(initialValues.receivableAmount) : undefined))),
        } as any);

        void fetchProjects('');
        void fetchPlayers('');
        void fetchMembers('');
        void fetchOrderSources();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // 项目列表加载完成后：用当前 projectId 再同步一次（确保一打开就自动填）
    useEffect(() => {
        if (!open) return;
        const pid = (form?.getFieldValue?.('projectId') as any) ?? initialValues?.projectId;
        if (pid && !initialValues?.id) syncByProject(pid);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, projectMap]);

    const applyCouponToAmounts = (couponId?: number | null) => {
        const receivable = toMoney(form?.getFieldValue?.('receivableAmount' as any));
        const projectId = Number(form?.getFieldValue?.('projectId' as any) || 0);
        const payable = calcPayableAfterCoupon(receivable, couponId, projectId);
        form?.setFieldsValue?.({
            paidAmount: receiptLocked ? initialValues?.paidAmount : payable,
            settlementAmount: payable,
        } as any);
    };

    // 值变化：项目变更 + 数量变更 + 限制打手数量
    const onValuesChange = (changed: any) => {
        if (
            ONLINE_QR_PAYMENT_PAUSED &&
            String(changed?.paymentChannel || '').trim().toUpperCase() === 'SHOUQIANBA'
        ) {
            form?.setFieldValue?.('paymentChannel' as any, 'MANUAL');
            return;
        }
        if (Object.prototype.hasOwnProperty.call(changed || {}, 'orderSource')) {
            const isLiveLuckyBagGift = String(changed?.orderSource || '').trim() === LIVE_LUCKY_BAG_GIFT_SOURCE;
            if (isLiveLuckyBagGift) {
                form?.setFieldsValue?.({
                    paymentChannel: 'MANUAL',
                    isGifted: true,
                    isPaid: true,
                    paidAmount: 0,
                    manualAdjustAmount: 0,
                    paymentTime: undefined,
                } as any);
            } else {
                const payable = toMoney(
                    Number(form?.getFieldValue?.('settlementAmount') ?? form?.getFieldValue?.('receivableAmount') ?? 0),
                );
                form?.setFieldsValue?.({
                    isGifted: false,
                    isPaid: false,
                    paidAmount: payable,
                    manualAdjustAmount: 0,
                    ...(String(changed?.orderSource || '').trim() === 'STORE_PENDING_SETTLEMENT'
                        ? {paymentChannel: 'MANUAL', paymentTime: undefined}
                        : {}),
                } as any);
            }
        }
        if (Object.prototype.hasOwnProperty.call(changed || {}, 'projectId')) {
            form?.setFieldValue?.('userCouponId' as any, undefined);
            const currentIdentifier = String(form?.getFieldValue?.('customerGameId') || '').trim();
            if (autoSelectedCardRef.current && currentIdentifier === autoSelectedCardRef.current) {
                form?.setFieldsValue?.({ customerGameId: undefined, customerIdentifierIsGameId: false } as any);
                autoSelectedCardRef.current = '';
            }
            syncByProject(changed.projectId);
        }

        if (changed?.orderQuantity != null) {
            const pid = Number(form?.getFieldValue?.('projectId') ?? 0);
            recalcHourlyAmount(pid, Number(changed.orderQuantity));
        }

        if (changed?.paidAmount != null) {
            form?.setFieldValue?.('settlementAmount' as any, Number(changed.paidAmount));
        }

        if (changed?.receivableAmount != null) {
            const couponId = Number(form?.getFieldValue?.('userCouponId' as any) || 0);
            if (couponId > 0) {
                const pid = Number(form?.getFieldValue?.('projectId' as any) || 0);
                const project = pid > 0 ? projectMap?.[pid] : null;
                const coupon = couponMetaMap?.[couponId];
                if (!isCouponUsableForProject(coupon, project, Number(changed.receivableAmount || 0))) {
                    form?.setFieldValue?.('userCouponId' as any, undefined);
                    message.warning('当前金额或项目不满足所选优惠券规则，已清空优惠券');
                    const paid = toMoney(form?.getFieldValue?.('paidAmount' as any));
                    form?.setFieldValue?.('settlementAmount' as any, paid);
                } else {
                    applyCouponToAmounts(couponId);
                }
            } else {
                const paid = toMoney(form?.getFieldValue?.('paidAmount' as any));
                form?.setFieldValue?.('settlementAmount' as any, paid);
            }
        }

        if (changed?.userCouponId !== undefined) {
            applyCouponToAmounts(changed.userCouponId);
        }

        if (changed?.customerUserId != null && Number(changed.customerUserId) > 0) {
            const memberId = Number(changed.customerUserId);
            const balance = Number(memberMetaMap?.[memberId]?.balance ?? 0);
            const requiredAmount = Number(form?.getFieldValue?.('receivableAmount') || 0);
            const canUseBalance = balance > 0 && balance >= requiredAmount;
            const currentChannel = String(form?.getFieldValue?.('paymentChannel') || '').trim().toUpperCase();
            const fallbackChannel = ONLINE_QR_PAYMENT_PAUSED ? 'MANUAL' : 'SHOUQIANBA';
            const nextChannel = canUseBalance ? 'BALANCE' : (currentChannel === 'BALANCE' ? fallbackChannel : currentChannel || fallbackChannel);
            form?.setFieldsValue?.({
                paymentChannel: nextChannel,
                isPaid: nextChannel === 'BALANCE',
                userCouponId: undefined,
                customerGameId: undefined,
                customerIdentifierIsGameId: false,
            } as any);
            autoSelectedCardRef.current = '';
            if (!canUseBalance) message.warning(balance <= 0 ? '该会员当前无可用储值余额，已保留在线/线下收款方式' : `会员储值余额不足（可用 ¥${balance.toFixed(2)}），已保留在线/线下收款方式`);
            void fetchMemberCoupons(memberId);
        } else if (changed?.customerUserId !== undefined) {
            memberContextRequestRef.current += 1;
            setMemberOrderContext(null);
            form?.setFieldsValue?.({
                userCouponId: undefined,
                paymentChannel: ONLINE_QR_PAYMENT_PAUSED ? 'MANUAL' : 'SHOUQIANBA',
                isPaid: false,
                paymentTime: undefined,
                manualAdjustAmount: 0,
            } as any);
            setCouponOptions([]);
            setCouponMetaMap({});
            autoSelectedCardRef.current = '';
            const projectId = Number(form?.getFieldValue?.('projectId') || 0);
            const project = projectMap?.[projectId];
            if (project) {
                const quantity = String(project?.billingMode || '') === 'HOURLY'
                    ? Math.max(1, Number(form?.getFieldValue?.('orderQuantity') || 1))
                    : 1;
                const originalAmount = toMoney(Number(project?.price || 0) * quantity);
                form?.setFieldsValue?.({
                    receivableAmount: originalAmount,
                    paidAmount: originalAmount,
                    settlementAmount: originalAmount,
                } as any);
            }
        }

        if (changed?.paymentChannel && String(changed.paymentChannel).trim().toUpperCase() === 'BALANCE') {
            const memberId = Number(form?.getFieldValue?.('customerUserId') || 0);
            const balance = Number(memberMetaMap?.[memberId]?.balance ?? 0);
            if (!(memberId > 0) || balance <= 0) {
                message.warning(memberId > 0 ? '该会员当前无可用储值余额，已切换到在线/线下收款' : '请先选择有储值余额的会员');
                form?.setFieldsValue?.({paymentChannel: ONLINE_QR_PAYMENT_PAUSED ? 'MANUAL' : 'SHOUQIANBA', isPaid: false} as any);
            } else {
                form?.setFieldValue?.('isPaid' as any, true);
            }
        }
        if (changed?.paymentChannel && String(changed.paymentChannel).trim().toUpperCase() === 'MANUAL') {
            const projectId = Number(form?.getFieldValue?.('projectId') || 0);
            const project = projectMap?.[projectId];
            const quantity = String(project?.billingMode || '') === 'HOURLY' ? Math.max(0.5, Number(form?.getFieldValue?.('orderQuantity') || 1)) : 1;
            const originalAmount = toMoney(Number(project?.price || 0) * quantity);
            const payable = calcPayableAfterCoupon(originalAmount, Number(form?.getFieldValue?.('userCouponId') || 0), projectId);
            form?.setFieldsValue?.({
                isPaid: false,
                paymentTime: undefined,
                receivableAmount: originalAmount,
                paidAmount: payable,
                settlementAmount: payable,
                manualAdjustAmount: 0,
            } as any);
        }
        if (changed?.paymentChannel && String(changed.paymentChannel).trim().toUpperCase() === 'SHOUQIANBA') {
            const projectId = Number(form?.getFieldValue?.('projectId') || 0);
            const project = projectMap?.[projectId];
            const quantity = String(project?.billingMode || '') === 'HOURLY' ? Math.max(0.5, Number(form?.getFieldValue?.('orderQuantity') || 1)) : 1;
            const originalAmount = toMoney(Number(project?.price || 0) * quantity);
            const payable = calcPayableAfterCoupon(originalAmount, Number(form?.getFieldValue?.('userCouponId') || 0), projectId);
            form?.setFieldsValue?.({
                isPaid: false,
                paymentTime: undefined,
                receivableAmount: originalAmount,
                paidAmount: payable,
                settlementAmount: payable,
                manualAdjustAmount: 0,
                bonusAttributionType: 'NONE',
                isRenewal: false,
                renewalPlayerIds: [],
                isDesignated: false,
                designatedPlayerIds: [],
            } as any);
        }

        if (showPlayers && Array.isArray(changed?.playerIds) && changed.playerIds.length > MAX_PLAYERS) {
            message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
            updatePlayerSelection(changed.playerIds.slice(0, MAX_PLAYERS).map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n)));
        }

        // 维护 playerNames（小票用），并同步续单打手只能来自当前派单打手
        if (showPlayers && Array.isArray(changed?.playerIds)) {
            const nextPlayerIds = changed.playerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n));
            updatePlayerSelection(nextPlayerIds);
            const currentRenewalIds = Array.isArray(form?.getFieldValue?.('renewalPlayerIds'))
                ? form.getFieldValue('renewalPlayerIds').map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
                : [];
            const nextRenewalIds = currentRenewalIds.filter((id: number) => nextPlayerIds.includes(id));
            const currentDesignatedIds = Array.isArray(form?.getFieldValue?.('designatedPlayerIds'))
                ? form.getFieldValue('designatedPlayerIds').map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
                : [];
            const nextDesignatedIds = currentDesignatedIds.filter((id: number) => nextPlayerIds.includes(id));
            form?.setFieldValue?.('renewalPlayerIds' as any, nextRenewalIds);
            form?.setFieldValue?.('designatedPlayerIds' as any, nextDesignatedIds);
            if (!nextPlayerIds.length) {
                form?.setFieldValue?.('isRenewal' as any, false);
                form?.setFieldValue?.('isDesignated' as any, false);
            }
        }

        if (showPlayers && changed?.isRenewal === false) {
            form?.setFieldValue?.('renewalPlayerIds' as any, []);
        }
        if (showPlayers && changed?.isDesignated === false) {
            form?.setFieldValue?.('designatedPlayerIds' as any, []);
        }

        if (showPlayers && changed?.isRenewal === true) {
            form?.setFieldsValue?.({ isDesignated: false, designatedPlayerIds: [] } as any);
            const currentPlayerIds = Array.isArray(form?.getFieldValue?.('playerIds')) ? form.getFieldValue('playerIds') : [];
            if (!currentPlayerIds.length) {
                message.warning('请先选择派单打手，再标记续单');
                form?.setFieldValue?.('isRenewal' as any, false);
            }
        }
        if (showPlayers && changed?.isDesignated === true) {
            form?.setFieldsValue?.({ isRenewal: false, renewalPlayerIds: [] } as any);
            const currentPlayerIds = Array.isArray(form?.getFieldValue?.('playerIds')) ? form.getFieldValue('playerIds') : [];
            if (!currentPlayerIds.length) {
                message.warning('请先选择派单打手，再标记指定');
                form?.setFieldValue?.('isDesignated' as any, false);
            }
        }
    };

    // ---------- 提交 ----------
    const handleOk = async () => {
        try {
            setSubmitting(true);
            const v: any = await form?.validateFields?.();

            const pid = Number(v?.projectId);
            const hourly = isHourlyProject(pid);
            const orderSource = String(v?.orderSource || '').trim();
            const isLiveLuckyBagGift = orderSource === LIVE_LUCKY_BAG_GIFT_SOURCE;
            const isGifted = isLiveLuckyBagGift || Boolean(v?.isGifted);
            const paymentChannel = String(v?.paymentChannel || '').trim().toUpperCase();
            const isPaid = isLiveLuckyBagGift || paymentChannel === 'BALANCE' ? true : Boolean(v?.isPaid);
            const canDispatchBeforePaid = isGifted || ['CUSTOMER_SERVICE_MANUAL', 'STORE_PENDING_SETTLEMENT'].includes(orderSource);

            // 小时单：必须有下单小时（orderQuantity）
            if (hourly && !(Number(v?.orderQuantity) > 0)) {
                message.error('小时单必须填写下单小时');
                return;
            }
            if (
                showPlayers &&
                Array.isArray(v?.playerIds) &&
                v.playerIds.length > 0 &&
                !canDispatchBeforePaid &&
                !isPaid
            ) {
                message.error('非后台客服或管理自主创建的订单，未收款前不可派单');
                return;
            }
            if (paymentChannel === 'BALANCE' && !(Number(v?.customerUserId) > 0)) {
                message.error('使用会员储值收款时，必须选择会员用户');
                return;
            }
            const selectedCouponId = Number(v?.userCouponId || 0);
            if (selectedCouponId > 0) {
                const selectedProject = projectMap?.[Number(v?.projectId || 0)];
                const selectedCoupon = couponMetaMap?.[selectedCouponId];
                if (!isCouponUsableForProject(selectedCoupon, selectedProject, Number(v?.receivableAmount || 0))) {
                    message.error('所选优惠券不适用于当前项目或金额，请重新选择优惠券');
                    return;
                }
            }
            const selectedMemberBalance = Number(memberMetaMap?.[Number(v?.customerUserId || 0)]?.balance ?? 0);
            const nextPaidAmount = isLiveLuckyBagGift ? 0 : toMoney(Number(v?.paidAmount ?? 0));
            if (paymentChannel === 'BALANCE' && selectedMemberBalance < nextPaidAmount) {
                message.error(`会员储值余额不足：当前可用 ¥${selectedMemberBalance.toFixed(2)}，本单需扣 ¥${nextPaidAmount.toFixed(2)}`);
                return;
            }

            const payloadPlayerIds = showPlayers
                ? Array.isArray(v?.playerIds)
                    ? v.playerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
                    : []
                : undefined;
            const bonusAttributionType = String(v?.bonusAttributionType || 'NONE');
            const isRenewal = showPlayers ? (bonusAttributionType === 'RENEWAL' || Boolean(v?.isRenewal)) : false;
            const isDesignated = showPlayers ? (bonusAttributionType === 'DESIGNATED' || Boolean(v?.isDesignated)) : false;
            const renewalPlayerIds = isRenewal && Array.isArray(v?.renewalPlayerIds)
                ? v.renewalPlayerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
                : [];
            const designatedPlayerIds = isDesignated && Array.isArray(v?.designatedPlayerIds)
                ? v.designatedPlayerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
                : [];

            if (isRenewal && isDesignated) {
                message.error('续单和指定只能二选一');
                return;
            }
            const attributionPlayerIds = isDesignated ? designatedPlayerIds : renewalPlayerIds;
            const attributionLabel = isDesignated ? '指定' : '续单';
            if (isRenewal || isDesignated) {
                if (!payloadPlayerIds?.length) {
                    message.error(`${attributionLabel}必须先选择派单打手`);
                    return;
                }
                if (!attributionPlayerIds.length) {
                    message.error(`请选择${attributionLabel}打手`);
                    return;
                }
                if (attributionPlayerIds.some((id: number) => !payloadPlayerIds.includes(id))) {
                    message.error(`${attributionLabel}打手必须从当前派单打手中选择`);
                    return;
                }
            }

            const customerIdentifierType = Boolean(v?.customerIdentifierIsGameId) ? 'GAME_ID' : 'ALIAS';
            const customerIdentifier = String(v?.customerGameId || '').trim();
            const payload: OrderUpsertValues = {
                ...(v as any),
                id: initialValues?.id,

                projectId: Number(v?.projectId),

                receivableAmount: Number(v?.receivableAmount),
                paidAmount: isLiveLuckyBagGift ? 0 : Number(receiptLocked ? initialValues?.paidAmount : v?.paidAmount),
                settlementAmount: v?.settlementAmount != null ? Number(v?.settlementAmount) : Number(v?.paidAmount),
                manualAdjustAmount:
                    isLiveLuckyBagGift
                        ? 0
                        : v?.userCouponId != null && v?.userCouponId !== ''
                        ? 0
                        : toMoney(Math.max(0, Number(v?.receivableAmount ?? 0) - Number(v?.paidAmount ?? 0))),

                baseAmountWan: v?.baseAmountWan != null && v?.baseAmountWan !== '' ? Number(v?.baseAmountWan) : null,

                // ✅ 下单数量：小时单=小时；其它单默认 1
                orderQuantity: Number(v?.orderQuantity ?? 1),

                customerIdentifierType,
                customerOriginalIdentifier: v?.customerOriginalIdentifier?.trim?.() || customerIdentifier || undefined,
                customerGameId: customerIdentifierType === 'GAME_ID' || initialValues?.id
                    ? (customerIdentifier || undefined)
                    : undefined,
                customerUserId: v?.customerUserId != null && v?.customerUserId !== '' ? Number(v?.customerUserId) : undefined,
                userCouponId: v?.userCouponId != null && v?.userCouponId !== '' ? Number(v?.userCouponId) : undefined,
                orderSource: v?.orderSource ? String(v.orderSource).trim() : undefined,
                paymentChannel: paymentChannel || undefined,

                orderTime: v?.orderTime ? dayjs(v.orderTime).toISOString() : now.toISOString(),
                paymentTime: receiptLocked
                    ? initialValues?.paymentTime
                    : (paymentChannel === 'MANUAL' && isPaid
                        ? (v?.paymentTime ? dayjs(v.paymentTime).toISOString() : now.toISOString())
                        : undefined),

                inviter: (isRenewal || isDesignated) ? undefined : (v?.inviter?.trim?.() || undefined),

                csRate: v?.csRate != null && v?.csRate !== '' ? Number(v?.csRate) : undefined,
                inviteRate: (isRenewal || isDesignated) ? 0 : (v?.inviteRate != null && v?.inviteRate !== '' ? Number(v?.inviteRate) : undefined),

                customClubRate: v?.customClubRate != null && v?.customClubRate !== '' ? Number(v?.customClubRate) : undefined,

                remark: v?.remark?.trim?.() || undefined,

                playerIds: payloadPlayerIds,
                isRenewal,
                renewalPlayerIds: isRenewal ? renewalPlayerIds : undefined,
                isDesignated,
                designatedPlayerIds: isDesignated ? designatedPlayerIds : undefined,

                isGifted,

                /**
                 * isPaid 由前端勾选决定；不再从 paymentTime 推断
                 * - 赠送单：这里仍允许用户勾选，但通常赠送单不需要收款
                 */
                isPaid,
                // 小票展示字段
                projectName: v?.projectName,
                billingMode: v?.billingMode,
                unitPrice: v?.unitPrice != null ? Number(v.unitPrice) : undefined,
                playerNames: Array.isArray(v?.playerNames) ? v.playerNames : undefined,
            };

            try {
                await onSubmit?.(payload);
            } catch (e: any) {
                message.error(getErrorMessage(e, '提交失败'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    // ---------- UI：默认 2 列（你当前 UI 改动） ----------
    // 2列：lg=12；要 3 列把 lg 改 8
    const compactColProps = { xs: 24, sm: 12, md: 12, lg: 12 };
    const fullColProps = { xs: 24, sm: 24, md: 24, lg: 24 };

    const watchedProjectId = Form.useWatch('projectId', form);
    const curProjectId = Number(watchedProjectId ?? 0);
    const showQtyForHourly = isHourlyProject(curProjectId);
    const watchedIsPaid = Form.useWatch('isPaid', form);
    const watchedOrderSource = Form.useWatch('orderSource', form);
    const watchedIsGifted = Form.useWatch('isGifted', form);
    const canSelectPlayersWhenUnpaid =
        Boolean(watchedIsGifted) || ['CUSTOMER_SERVICE_MANUAL', 'STORE_PENDING_SETTLEMENT'].includes(String(watchedOrderSource || '').trim());
    const watchedPlayerIds = Form.useWatch('playerIds', form) || [];
    const watchedAttributionType = String(Form.useWatch('bonusAttributionType', form) || 'NONE');
    const watchedLegacyIsRenewal = Boolean(Form.useWatch('isRenewal', form));
    const watchedLegacyIsDesignated = Boolean(Form.useWatch('isDesignated', form));
    const watchedIsRenewal = watchedAttributionType === 'RENEWAL' || watchedLegacyIsRenewal;
    const watchedIsDesignated = watchedAttributionType === 'DESIGNATED' || watchedLegacyIsDesignated;
    const watchedCustomerUserId = Number(Form.useWatch('customerUserId', form) ?? 0);
    const watchedCustomerGameId = String(Form.useWatch('customerGameId', form) || '').trim();
    const watchedProjectName = String(Form.useWatch('projectName', form) || '').trim();
    const watchedPaymentChannel = String(Form.useWatch('paymentChannel', form) || '').trim().toUpperCase();
    const watchedReceivableAmount = Number(Form.useWatch('receivableAmount', form) || 0);
    const watchedPaidAmount = Number(Form.useWatch('paidAmount', form) || 0);
    const watchedSettlementAmount = Number(Form.useWatch('settlementAmount', form) || 0);
    const watchedBaseAmountWan = Number(Form.useWatch('baseAmountWan', form) || 0);
    const watchedUserCouponId = Number(Form.useWatch('userCouponId', form) || 0);
    const watchedOrderQuantity = Number(Form.useWatch('orderQuantity', form) || 1);
    const watchedCustomerOriginalIdentifier = String(Form.useWatch('customerOriginalIdentifier', form) || '').trim();
    const watchedManualAdjustAmount = Number(Form.useWatch('manualAdjustAmount', form) || 0);
    const currentPaymentSignature = JSON.stringify({
        projectId: curProjectId,
        orderQuantity: watchedOrderQuantity,
        receivableAmount: toMoney(watchedReceivableAmount),
        paidAmount: toMoney(watchedPaidAmount),
        settlementAmount: toMoney(watchedSettlementAmount),
        customerUserId: watchedCustomerUserId,
        customerGameId: watchedCustomerGameId,
        customerOriginalIdentifier: watchedCustomerOriginalIdentifier,
        userCouponId: watchedUserCouponId,
        manualAdjustAmount: toMoney(watchedManualAdjustAmount),
    });
    const paymentCodeStale = Boolean(paymentResult?.paymentId && generatedPaymentSignature && generatedPaymentSignature !== currentPaymentSignature);
    const paymentCodeExpired = Boolean(
        paymentResult?.expiresAt
        && new Date(paymentResult.expiresAt).getTime() <= paymentClock,
    );
    const paymentCodeInvalid = paymentCodeStale || paymentCodeExpired;
    const paymentExpiryLabel = paymentResult?.expiresAt
        ? dayjs(paymentResult.expiresAt).format('HH:mm')
        : '';

    useEffect(() => {
        if (!paymentResult?.paymentId || !paymentResult?.expiresAt) return undefined;
        setPaymentClock(Date.now());
        const timer = window.setInterval(() => setPaymentClock(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [paymentResult?.paymentId, paymentResult?.expiresAt]);

    useEffect(() => {
        const orderId = Number(paymentResult?.orderId || 0);
        if (!open || !orderId || !paymentResult?.paymentId) {
            setPaymentConfirmed(false);
            return undefined;
        }
        let cancelled = false;
        let timer: number | undefined;
        const checkPaid = async () => {
            try {
                const detail: any = await getOrderDetail(orderId);
                if (cancelled) return;
                const paid = detail?.isPaid === true || String(detail?.payStatus || '').toUpperCase() === 'SUCCESS';
                setPaymentConfirmed(paid);
                if (paid) setPaidOrderDetail(detail);
                if (!paid) timer = window.setTimeout(checkPaid, 3000);
            } catch {
                if (!cancelled) timer = window.setTimeout(checkPaid, 5000);
            }
        };
        void checkPaid();
        return () => {
            cancelled = true;
            if (timer) window.clearTimeout(timer);
        };
    }, [open, paymentResult?.orderId, paymentResult?.paymentId]);

    useEffect(() => {
        if (!open || !paymentConfirmed || !paidOrderDetail) return;
        let cancelled = false;
        const buildReceipt = async () => {
            setPaymentReceiptLoading(true);
            try {
                const detail = paidOrderDetail || {};
                const projectName = detail?.project?.name || detail?.projectSnapshot?.name || paymentResult?.projectName || '-';
                const dispatches = Array.isArray(detail?.dispatches) ? detail.dispatches : [];
                const participants = detail?.currentDispatch?.participants || dispatches[dispatches.length - 1]?.participants || [];
                const playerNames = (Array.isArray(participants) ? participants : [])
                    .filter((item: any) => item?.isActive !== false)
                    .map((item: any) => item?.user?.name || item?.user?.nickname || item?.userId)
                    .filter(Boolean);
                const amount = Number(detail?.paidAmount ?? detail?.finalPayableAmount ?? paymentResult?.amount ?? 0);
                const originalAmount = Number(detail?.originalAmount ?? detail?.receivableAmount ?? amount);
                const manualAdjustAmount = Number(detail?.manualAdjustAmount ?? 0);
                const memberDiscountAmount = Number(detail?.memberDiscountAmount ?? 0);
                const couponDiscountAmount = Number(detail?.couponDiscountAmount ?? 0);
                const billingMode = String(detail?.projectSnapshot?.billingMode ?? detail?.project?.billingMode ?? '');
                const unitPrice = Number(detail?.projectSnapshot?.price ?? detail?.project?.price ?? 0);
                const hours = billingMode === 'HOURLY' && unitPrice > 0 ? originalAmount / unitPrice : null;
                const orderTime = dayjs(detail?.orderTime || detail?.createdAt || new Date());
                const payment = detail?.latestPayment || {};
                const paymentNo = String(payment?.paymentNo || '').trim();
                const clientSn = String(payment?.clientSn || '').trim();
                const providerSn = String(payment?.providerSn || '').trim();
                const transactionId = String(payment?.transactionId || '').trim();
                const paymentIdentifierLines = [
                    paymentNo ? `商户支付单号：${paymentNo}` : '',
                    clientSn && clientSn !== paymentNo ? `收钱吧请求号：${clientSn}` : '',
                    providerSn ? `收钱吧流水号：${providerSn}` : '',
                    transactionId ? `微信支付单号：${transactionId}` : '',
                ].filter(Boolean);
                const paymentChannel = String(payment?.channel || detail?.paymentChannel || '').trim().toUpperCase();
                const paymentChannelText = paymentChannel === 'BALANCE'
                    ? '会员储值'
                    : paymentChannel === 'SHOUQIANBA_WAP'
                      ? '收钱吧在线收款'
                      : paymentChannel === 'MANUAL_CONFIRMED'
                        ? '人工确认收款'
                        : paymentChannel || '未记录支付方式';
                const financeLines = [`商品小计：¥${originalAmount.toFixed(2)}`];
                if (manualAdjustAmount !== 0) financeLines.push(`人工优惠：${manualAdjustAmount > 0 ? '- ' : '+ '}¥${Math.abs(manualAdjustAmount).toFixed(2)}`);
                if (memberDiscountAmount > 0) financeLines.push(`会员折扣：- ¥${memberDiscountAmount.toFixed(2)}`);
                if (couponDiscountAmount > 0) financeLines.push(`优惠券抵扣：- ¥${couponDiscountAmount.toFixed(2)}`);
                financeLines.push(`实付金额：¥${amount.toFixed(2)}`, `支付方式：${paymentChannelText}`, ...paymentIdentifierLines);
                if (paymentChannel === 'BALANCE') {
                    const notifyRaw = typeof payment?.notifyRaw === 'string' ? (() => { try { return JSON.parse(payment.notifyRaw); } catch { return {}; } })() : payment?.notifyRaw || {};
                    const receiptMeta = notifyRaw?.receiptMeta || {};
                    const held = String(detail?.balanceReservationStatus || '') === 'HELD';
                    const balanceAmount = Number(held ? detail?.balanceReservedAmount ?? receiptMeta?.memberBalanceReserved ?? amount : detail?.balanceCapturedAmount ?? receiptMeta?.memberBalanceDeducted ?? amount);
                    financeLines.push(`${held ? '储值预占' : '储值扣除'}：¥${Number.isFinite(balanceAmount) ? balanceAmount.toFixed(2) : '0.00'}`);
                    const balanceAfter = Number(receiptMeta?.memberBalanceAfter);
                    financeLines.push(`储值余额：${Number.isFinite(balanceAfter) ? `¥${balanceAfter.toFixed(2)}` : '待结算后确认'}`);
                }
                const estimatedEndTime = billingMode === 'HOURLY' && hours != null
                    ? orderTime.add(hours, 'hour').add(20, 'minute').format('YYYY-MM-DD HH:mm')
                    : '';
                const text = [
                    `订单编号：${detail?.autoSerial || paymentResult?.autoSerial || detail?.id || paymentResult?.orderId || '-'}`,
                    `商品名称：${projectName}`,
                    `服务规格：${hours != null ? `${hours.toFixed(2)} 小时` : '按商品约定'}`,
                    `接待人员：${detail?.dispatcher?.name || '客服'}`,
                    '服务人员：',
                    ...(playerNames.length ? playerNames : ['（待派单/待接单）']).map((name: any) => `  ${name}`),
                    `订单来源：${detail?.orderSourceLabel || detail?.orderSource || '人工创建'}`,
                    ...financeLines,
                    estimatedEndTime ? `预计结单时间：${estimatedEndTime}` : '',
                    `下单时间：${orderTime.format('YYYY-MM-DD HH:mm')}`,
                    `预计等待时间：${detail?.estimatedWaitTimeText || '5-10分钟'}`,
                    '',
                    '温馨提醒：',
                    '消费过程中如遇任何问题，请随时联系本单客服处理～',
                    '订单完结24小时内支持售后，客服为售后唯一渠道；',
                    '请勿相信其他任何人，谨防上当受骗。',
                ].filter(Boolean).join('\n');
                const image = await generateReceiptImage('蓝猫爽打 · 萌爪订单', text, {
                    width: 800,
                    theme: {accent: '#f55f8b', accent2: '#5599df'},
                });
                if (!cancelled) {
                    setPaymentReceiptText(text);
                    setPaymentReceiptImage(image || '');
                }
            } finally {
                if (!cancelled) setPaymentReceiptLoading(false);
            }
        };
        void buildReceipt();
        return () => { cancelled = true; };
    }, [open, paymentConfirmed, paidOrderDetail, paymentResult]);

    const copyPaymentReceiptImage = async () => {
        if (!paymentReceiptImage) return;
        try {
            const blob = await (await fetch(paymentReceiptImage)).blob();
            if (!navigator?.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('IMAGE_CLIPBOARD_UNSUPPORTED');
            await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
            message.success('订单小票已复制，可直接粘贴发送给客户');
        } catch {
            message.warning('当前浏览器不支持图片剪贴板，请使用“分享订单小票”或长按图片');
        }
    };

    const sharePaymentReceiptImage = async () => {
        if (!paymentReceiptImage) return;
        try {
            const blob = await (await fetch(paymentReceiptImage)).blob();
            const orderNo = String(paidOrderDetail?.autoSerial || paymentResult?.autoSerial || paymentResult?.orderId || '订单');
            const file = new File([blob], `蓝猫爽打-${orderNo}-订单小票.png`, {type: 'image/png'});
            const shareData = {
                title: '蓝猫爽打订单小票',
                text: `订单 ${orderNo} 已支付`,
                files: [file],
            };
            if (navigator?.share && (!navigator.canShare || navigator.canShare(shareData))) {
                await navigator.share(shareData);
                return;
            }
            const imageWindow = window.open('', '_blank');
            if (!imageWindow) throw new Error('POPUP_BLOCKED');
            imageWindow.document.title = `订单小票-${orderNo}`;
            imageWindow.document.body.style.cssText = 'margin:0;background:#111;display:flex;min-height:100vh;align-items:center;justify-content:center;';
            const img = imageWindow.document.createElement('img');
            img.src = paymentReceiptImage;
            img.alt = `订单 ${orderNo} 小票`;
            img.style.cssText = 'display:block;max-width:100%;height:auto;';
            imageWindow.document.body.appendChild(img);
            message.info('当前浏览器不支持系统分享，已打开小票原图，请长按图片发送');
        } catch (error: any) {
            if (String(error?.name || '') === 'AbortError') return;
            message.warning('当前浏览器无法直接分享，请长按小票图片保存或发送');
        }
    };

    const copyPaymentReceiptText = async () => {
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(paymentReceiptText);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = paymentReceiptText;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                const copied = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (!copied) throw new Error('TEXT_COPY_FAILED');
            }
            message.success('小票文字已复制');
        } catch {
            message.warning('当前浏览器不允许自动复制，请长按选择小票文字');
        }
    };

    useEffect(() => {
        setPaidOrderDetail(null);
        setPaymentReceiptText('');
        setPaymentReceiptImage('');
        setPaymentReceiptLoading(false);
        if (paymentResult?.paymentId) setGeneratedPaymentSignature(currentPaymentSignature);
        else setGeneratedPaymentSignature('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentResult?.paymentId]);

    useEffect(() => {
        const hasCode = Boolean(paymentResult?.paymentUrl || paymentResult?.qrCodeContent);
        if (!hasCode) {
            setPaymentTicketImage('');
            return;
        }
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            if (!paymentTicketRef.current) return;
            try {
                const canvas = await html2canvas(paymentTicketRef.current, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    useCORS: true,
                });
                if (!cancelled) setPaymentTicketImage(canvas.toDataURL('image/png'));
            } catch {
                if (!cancelled) setPaymentTicketImage('');
            }
        }, 120);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [paymentResult, watchedProjectName, watchedCustomerGameId, watchedPaidAmount]);

    const confirmAndSubmitOrder = () => {
        const isOnline = watchedPaymentChannel === 'SHOUQIANBA';
        const isBalance = watchedPaymentChannel === 'BALANCE';
        const actionTitle = isOnline
            ? (paymentResult?.orderId ? '核对修改并重新生成付款码' : '核对订单并生成付款码')
            : (isBalance ? '核对并确认会员储值支付' : '核对并创建线下订单');
        Modal.confirm({
            title: actionTitle,
            content: (
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Typography.Text>项目：{watchedProjectName || '-'}</Typography.Text>
                    <Typography.Text>客户：{watchedCustomerGameId || watchedCustomerOriginalIdentifier || '未填写'}</Typography.Text>
                    <Typography.Text strong>本次收款：¥{watchedPaidAmount.toFixed(2)}</Typography.Text>
                    <Typography.Text type="secondary">
                        {isOnline
                            ? (paymentResult?.orderId ? '确认后将更新原订单并撤销旧付款码，不会重复创建订单。' : '确认后先保存订单草稿，再向收钱吧创建预支付请求；成功后进入待支付。')
                            : (isBalance
                                ? '确认后将预占会员储值余额；预占成功后订单进入待派单。'
                                : (watchedIsPaid ? '确认后将按线下已收款创建订单，并进入待派单。' : '该订单将以“未收款”进入派单流程，派单客服承担催收及超时扣款责任。'))}
                    </Typography.Text>
                </Space>
            ),
            okText: isOnline
                ? (paymentResult?.orderId ? '更新并重新生成' : '确认并生成')
                : (isBalance ? '确认预占并创建' : '确认创建'),
            cancelText: '返回核对',
            onOk: async () => handleOk(),
        });
    };
    const selectedMember = watchedCustomerUserId > 0 ? memberMetaMap?.[watchedCustomerUserId] : null;
    const selectedCoupon = watchedUserCouponId > 0 ? couponMetaMap?.[watchedUserCouponId] : null;
    const selectedProject = curProjectId > 0 ? projectMap?.[curProjectId] : null;
    const usableCouponOptions = useMemo(
        () => couponOptions.filter((item) => {
            if (item.disabled) return false;
            const coupon = couponMetaMap?.[Number(item.value)];
            return isCouponUsableForProject(coupon, selectedProject, watchedReceivableAmount);
        }),
        [couponOptions, couponMetaMap, selectedProject, watchedReceivableAmount],
    );
    const watchedCouponDiscountAmount = calcCouponPreviewDiscount(selectedCoupon, watchedReceivableAmount, curProjectId);
    const watchedManualDiscountAmount = watchedUserCouponId > 0
        ? 0
        : toMoney(Math.max(0, watchedReceivableAmount - watchedPaidAmount));
    const watchedDiscountAmount = watchedUserCouponId > 0 ? watchedCouponDiscountAmount : watchedManualDiscountAmount;
    const isBalancePayment = watchedPaymentChannel === 'BALANCE';
    const selectedMemberBalance = Number(selectedMember?.balance ?? 0);
    const balanceInsufficient = isBalancePayment && watchedCustomerUserId > 0 && selectedMemberBalance < watchedPaidAmount;
    const memberDiscountActive = isBalancePayment && Boolean(memberOrderContext?.memberDiscount?.applied);
    const memberDiscountAmount = Number(memberOrderContext?.memberDiscount?.amount || 0);
    const totalDiscountPreview = toMoney(Math.max(0, watchedReceivableAmount - watchedPaidAmount));
    const memberGameCards: MemberGameCardOption[] = Array.isArray(memberOrderContext?.gameCards)
        ? memberOrderContext.gameCards
        : (selectedMember?.gameCards || []);
    const memberGameCardOptions = memberGameCards.map((card) => ({
        value: String(card.gameUniqueId),
        label: `${card.gameNickname ? `${card.gameNickname} · ` : ''}${card.gameUniqueId}${card.isPrimary ? '（优先）' : ''}`,
    }));
    const selectedMemberGameCard = memberGameCards.find(
        (card) => String(card.gameUniqueId) === String(watchedCustomerGameId || '').trim(),
    );

    useEffect(() => {
        if (!open || initialValues?.id) return;
        if (watchedPaymentChannel !== 'BALANCE' || !(watchedCustomerUserId > 0) || !(curProjectId > 0) || !(watchedReceivableAmount > 0)) {
            memberContextRequestRef.current += 1;
            setMemberOrderContext(null);
            return;
        }
        const timer = window.setTimeout(() => {
            void refreshMemberOrderContext(watchedCustomerUserId, curProjectId, watchedReceivableAmount);
        }, 180);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialValues?.id, watchedPaymentChannel, watchedCustomerUserId, curProjectId, watchedReceivableAmount]);

    function calcPayableAfterCoupon(receivable: number, couponId?: number | null, projectId?: number) {
        const coupon = Number(couponId || 0) > 0 ? couponMetaMap?.[Number(couponId)] : null;
        const original = toMoney(receivable);
        const contextDiscount = memberOrderContext?.memberDiscount;
        const memberPayable = contextDiscount?.applied && toMoney(contextDiscount.originalAmount) === original
            ? toMoney(contextDiscount.payableAmount)
            : original;
        const discount = calcCouponPreviewDiscount(coupon, memberPayable, Number(projectId || 0));
        return toMoney(Math.max(0, memberPayable - discount));
    }

    const updatePlayerSelection = (nextIds: number[]) => {
        const limitedIds = nextIds.slice(0, MAX_PLAYERS);
        const names = limitedIds
            .map((id: any) => playerMap?.[Number(id)])
            .filter(Boolean);
        const currentRenewalIds = Array.isArray(form?.getFieldValue?.('renewalPlayerIds'))
            ? form.getFieldValue('renewalPlayerIds').map((id: any) => Number(id)).filter((id: number) => limitedIds.includes(id))
            : [];
        const currentDesignatedIds = Array.isArray(form?.getFieldValue?.('designatedPlayerIds'))
            ? form.getFieldValue('designatedPlayerIds').map((id: any) => Number(id)).filter((id: number) => limitedIds.includes(id))
            : [];
        form?.setFieldsValue?.({
            playerIds: limitedIds,
            playerNames: names,
            renewalPlayerIds: currentRenewalIds,
            designatedPlayerIds: currentDesignatedIds,
            isRenewal: limitedIds.length ? form?.getFieldValue?.('isRenewal') : false,
            isDesignated: limitedIds.length ? form?.getFieldValue?.('isDesignated') : false,
        } as any);
    };

    const togglePlayerSelection = (playerId: number) => {
        const current = Array.isArray(watchedPlayerIds)
            ? watchedPlayerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
            : [];
        const exists = current.includes(playerId);
        const next = exists ? current.filter((id) => id !== playerId) : [...current, playerId];
        if (!exists && current.length >= MAX_PLAYERS) {
            message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
            return;
        }
        updatePlayerSelection(next);
    };

    const openPlayerPicker = async () => {
        setPlayerPickerKeyword('');
        setPlayerPickerOpen(true);
        if (!playerOptions.length) {
            await fetchPlayers('');
        }
    };




    // const watchedProjectId = Form.useWatch('projectId', form);
    // const curProjectId = Number(watchedProjectId ?? 0);
    // // const showQtyForHourly = isHourlyProject(curProjectId);
    //
    // useEffect(()=>{
    //     setShowQtyForHourly(isHourlyProject(curProjectId))
    // },[watchedProjectId])

    return (
        <Modal
            open={open}
            title={title}
            onCancel={onCancel}
            onOk={confirmAndSubmitOrder}
            confirmLoading={submitting}
            destroyOnClose
            rootClassName="bc-order-upsert-modal-root"
            className="bc-order-upsert-modal"
            width={isMobile ? '96vw' : 1080}
            style={{ top: isMobile ? 8 : 24 }}
            okText="保存"
            cancelText="取消"
            footer={watchedPaymentChannel === 'SHOUQIANBA' ? null : undefined}
            okButtonProps={{
                disabled: balanceInsufficient,
            }}
        >
            <div className="bc-order-create-layout">
            <Form form={form} layout="vertical" disabled={editingLocked} onValuesChange={onValuesChange} className="bc-admin-form bc-order-create-form">
                {editingLocked ? <Alert type="info" showIcon message="为保护交易与财务数据，现有订单仅允许修改客户标识；商品、金额、渠道、会员和支付方式均已锁定。" style={{marginBottom: 16}} /> : null}
                <div className="bc-admin-form-summary bc-order-create-summary">
                    <div className="bc-admin-form-summary-card info">
                        <div className="bc-admin-form-summary-label">应收金额</div>
                        <div className="bc-admin-form-summary-value">¥{watchedReceivableAmount.toFixed(2)}</div>
                    </div>
                    <div className="bc-admin-form-summary-card warning">
                        <div className="bc-admin-form-summary-label">优惠抵扣</div>
                        <div className="bc-admin-form-summary-value">¥{totalDiscountPreview.toFixed(2)}</div>
                    </div>
                    <div className={`bc-admin-form-summary-card ${watchedIsPaid ? 'success' : 'danger'}`}>
                        <div className="bc-admin-form-summary-label">收款状态</div>
                        <div className="bc-admin-form-summary-value">{watchedIsPaid ? '已付款' : '未付款'}</div>
                    </div>
                </div>
                {/* 1) 订单核心 */}
                <div className="bc-admin-form-section-title">① 客户与收款</div>

                <Row gutter={[16, 12]}>
                    <Col {...compactColProps}>
                        <Form.Item name="paymentChannel" label="收款方式">
                            <Radio.Group
                                className="bc-order-payment-channel"
                                optionType="button"
                                buttonStyle="solid"
                                disabled={Boolean(paymentResult?.orderId)}
                            >
                                <Radio.Button value="SHOUQIANBA" disabled={ONLINE_QR_PAYMENT_PAUSED}>在线二维码支付（暂停）</Radio.Button>
                                <Radio.Button value="BALANCE">会员储值</Radio.Button>
                                <Radio.Button value="MANUAL" className="bc-order-payment-manual">线下确认收款</Radio.Button>
                            </Radio.Group>
                        </Form.Item>
                        {watchedPaymentChannel === 'MANUAL' ? (
                            <div className="bc-order-manual-channel-note">
                                {String(watchedOrderSource || '') === 'STORE_PENDING_SETTLEMENT'
                                    ? '门店待结算订单按固定周期对账，不进入48小时催收及客服扣款流程。'
                                    : '当前默认方式。支持先创建未收款订单，结单待确认后开始计算48小时收款责任期。'}
                            </div>
                        ) : null}
                        {paymentResult?.orderId ? (
                            <div style={{ marginTop: -8, marginBottom: 8, color: '#64748b', fontSize: 12 }}>
                                草稿已建立，收款方式已锁定；如需更换渠道，请关闭后作废该草稿并重新创建。
                            </div>
                        ) : null}
                    </Col>
                    <Col {...compactColProps}>
                        <Form.Item name="orderSource" label="订单渠道来源" rules={[{ required: true, message: '请选择订单渠道来源' }]}>
                            <Select
                                placeholder="请选择订单渠道来源"
                                options={orderSourceOptions}
                                allowClear={false}
                            />
                        </Form.Item>
                    </Col>
                    <Col {...fullColProps}>
                        <Form.Item
                            name="customerUserId"
                            label="关联会员（可选）"
                            extra="订单将直接归属该会员，用于消费记录、会员权益、积分和售后；与本次游戏ID是否填写无关。"
                        >
                            <Select
                                placeholder="可选：搜索会员编码、手机号或姓名"
                                showSearch
                                filterOption={false}
                                onSearch={(v) => fetchMembers(v)}
                                options={memberOptions}
                                loading={memberLoading}
                                disabled={Boolean(paymentResult?.orderId)}
                                allowClear
                            />
                        </Form.Item>
                    </Col>
                    <Col {...fullColProps}>
                        <Form.Item name="projectId" label="项目" rules={[{ required: true, message: '请选择项目' }]}>
                            <Select
                                placeholder="请选择项目"
                                showSearch
                                filterOption={false}
                                onSearch={(v) => fetchProjects(v)}
                                options={projectOptions}
                                loading={projectLoading}
                                allowClear
                            />
                        </Form.Item>
                    </Col>
                    {watchedCustomerUserId > 0 ? <Col {...fullColProps}>
                        <Form.Item name="userCouponId" label="使用优惠券">
                            <Select
                                placeholder={
                                    !(curProjectId > 0)
                                        ? '请先选择项目'
                                        : watchedCustomerUserId > 0
                                            ? '可选：选择当前项目可用优惠券'
                                            : '请先选择会员'
                                }
                                showSearch
                                optionFilterProp="label"
                                options={usableCouponOptions}
                                loading={couponLoading}
                                disabled={!(watchedCustomerUserId > 0) || !(curProjectId > 0)}
                                allowClear
                            />
                        </Form.Item>
                        {watchedCustomerUserId > 0 && curProjectId > 0 ? (
                            <div style={{ marginTop: -8, marginBottom: 8, color: '#64748b', fontSize: 12 }}>
                                {usableCouponOptions.length
                                    ? `当前项目可用 ${usableCouponOptions.length} 张优惠券；切换项目会自动清空已选优惠券。`
                                    : (couponLoading ? '正在加载会员优惠券…' : '该会员暂无当前项目可用优惠券。')}
                            </div>
                        ) : null}
                    </Col> : null}

                    {/* ✅ 小时单才展示“下单小时(数量)” */}
                    {showQtyForHourly ? (
                        <Col {...compactColProps}>
                            <Form.Item
                                name="orderQuantity"
                                label="下单小时"
                                rules={[{ required: true, message: '请输入下单小时' }]}
                            >
                                <InputNumber min={0.5} max={24} step={0.5} precision={1} style={{ width: '100%' }} placeholder="例如：0.5 / 1 / 1.5 ..." />
                            </Form.Item>
                        </Col>
                    ) : null}

                    <Col {...compactColProps}>
                        <Form.Item name="receivableAmount" hidden rules={[{ required: true, message: '项目定价异常' }]}><InputNumber /></Form.Item>
                        <Form.Item label="应收金额">
                            <div style={{height: 32, display: 'flex', alignItems: 'center', padding: '0 11px', borderRadius: 6, background: '#f5f5f5', border: '1px solid #d9d9d9', fontWeight: 600}}>
                                ¥{watchedReceivableAmount.toFixed(2)}
                                <span style={{marginLeft: 8, color: '#8c8c8c', fontSize: 12, fontWeight: 400}}>按项目定价自动计算</span>
                            </div>
                        </Form.Item>
                    </Col>

                    <Col {...compactColProps}>
                        <Form.Item name="paidAmount" label="实收金额" tooltip={receiptLocked ? '已收款金额不可直接编辑，请通过补收或退款流程处理' : undefined} rules={[{ required: true, message: '请输入实收金额' }]}>
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                disabled={receiptLocked || watchedUserCouponId > 0 || memberDiscountActive}
                                placeholder={showQtyForHourly ? '随小时自动计算' : '随项目自动同步'}
                            />
                        </Form.Item>
                        {watchedUserCouponId > 0 ? (
                            <div style={{ marginTop: -8, marginBottom: 8, color: '#64748b', fontSize: 12 }}>
                                已选择优惠券，实收金额由券规则自动计算，不支持手动修改。
                            </div>
                        ) : null}
                    </Col>

                    <Col {...fullColProps}>
                        <Collapse
                            ghost
                            size="small"
                            className="bc-order-settlement-adjust"
                            items={[{
                                key: 'settlement',
                                // 保持默认收起，但预先挂载字段；否则 validateFields 不会提交未展开过的保底/结算金额。
                                forceRender: true,
                                label: showQtyForHourly
                                    ? `高级金额设置 · 结算 ¥${watchedSettlementAmount.toFixed(2)}${memberDiscountActive ? '（已锁定）' : ''}`
                                    : `高级金额设置 · 保底 ${watchedBaseAmountWan} 万 · 结算 ¥${watchedSettlementAmount.toFixed(2)}`,
                                children: (
                                    <Row gutter={[12, 0]}>
                                        {!showQtyForHourly ? (
                                            <Col {...compactColProps}>
                                                <Form.Item name="baseAmountWan" label="订单保底（万）">
                                                    <InputNumber min={0} style={{ width: '100%' }} placeholder="默认随项目同步" />
                                                </Form.Item>
                                            </Col>
                                        ) : null}
                                        <Col {...compactColProps}>
                                            <Form.Item name="settlementAmount" label="结算金额" rules={[{ required: true, message: '请输入结算金额' }]}>
                                                <InputNumber
                                                    min={0}
                                                    style={{ width: '100%' }}
                                                    disabled={memberDiscountActive}
                                                    placeholder="默认跟实收金额一致"
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                ),
                            }]}
                        />
                    </Col>

                    {memberDiscountActive ? <Col {...fullColProps}>
                        <div style={{ marginTop: -4, marginBottom: 8, padding: '8px 12px', borderRadius: 8, background: '#fff7e6', color: '#ad6800' }}>
                            {memberOrderContextLoading ? '正在计算会员折扣…' : `${memberOrderContext?.memberDiscount?.levelCode || '会员'} 折扣已应用：减免 ¥${memberDiscountAmount.toFixed(2)}，应收、实收和结算金额由系统计算并锁定。`}
                        </div>
                    </Col> : null}

                    <Col {...fullColProps}>
                        <Form.Item label="客户标识" style={{ marginBottom: 8 }}>
                            <Input.Group compact>
                                <Form.Item name="customerGameId" noStyle>
                                    <AutoComplete
                                        disabled={false}
                                        placeholder="客户提供的昵称 / ID / 房间号"
                                        options={memberGameCardOptions}
                                        allowClear
                                        onSelect={(value) => {
                                            autoSelectedCardRef.current = String(value);
                                            form?.setFieldValue?.('customerIdentifierIsGameId' as any, true);
                                        }}
                                        style={{ width: 'calc(100% - 118px)' }}
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="customerIdentifierIsGameId"
                                    valuePropName="checked"
                                    noStyle
                                    initialValue={Boolean(initialValues?.customerIdentifierType === 'GAME_ID' || initialValues?.id)}
                                >
                                    <Checkbox
                                        disabled={false}
                                        style={{
                                            width: 118,
                                            height: 32,
                                            padding: '3px 8px',
                                            border: '1px solid #d9d9d9',
                                            borderLeft: 0,
                                            borderRadius: '0 10px 10px 0',
                                            background: '#fff',
                                            lineHeight: '24px',
                                        }}
                                    >
                                        准确ID
                                    </Checkbox>
                                </Form.Item>
                            </Input.Group>
                            <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>
                                {selectedMemberGameCard ? (
                                    <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        alignItems: 'center',
                                        gap: 8,
                                        marginBottom: 6,
                                        padding: '7px 10px',
                                        borderRadius: 8,
                                        background: '#f0f5ff',
                                        border: '1px solid #d6e4ff',
                                        color: '#1d39c4',
                                    }}>
                                        <span style={{ color: '#64748b' }}>已选游戏名片</span>
                                        <strong>{selectedMemberGameCard.gameNickname || '未填写昵称'}</strong>
                                        <span>·</span>
                                        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                                            {selectedMemberGameCard.gameUniqueId}
                                        </span>
                                        {selectedMemberGameCard.isPrimary ? <Tag color="blue" style={{ marginInlineEnd: 0 }}>优先</Tag> : null}
                                    </div>
                                ) : null}
                                默认按昵称/房间号处理；勾选准确ID后，服务者存单/结单时不再要求补客户游戏ID。
                            </div>
                        </Form.Item>
                    </Col>

                    {watchedPaymentChannel === 'MANUAL' ? <Col {...compactColProps}>
                        <Form.Item name="paymentTime" label="付款时间">
                            <DatePicker
                                showTime
                                style={{ width: '100%' }}
                                disabled={receiptLocked || !watchedIsPaid}
                                placeholder={watchedIsPaid ? '可选：不选则按确认时自动写入当前时间' : '未收款时不需要填写'}
                            />
                        </Form.Item>
                    </Col> : null}
                    {watchedPaymentChannel === 'MANUAL' ? <Col {...compactColProps}>
                        <Form.Item
                            name="isPaid"
                            valuePropName="checked"
                            label="收款状态"
                            initialValue={true}
                            tooltip={isBalancePayment ? '会员储值支付会立即扣减余额，固定为已付款状态' : '先打后付：把这里取消勾选，订单会被标记为未收款'}
                        >
                            <Checkbox disabled={isBalancePayment}>已付款</Checkbox>
                        </Form.Item>
                    </Col> : null}
                    {watchedIsPaid && watchedPaymentChannel === 'BALANCE' ? (
                        <Col {...fullColProps}>
                            <div style={{
                                marginTop: -4,
                                padding: '10px 12px',
                                borderRadius: 10,
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                color: '#475569',
                                fontSize: 12,
                            }}>
                                {selectedMember
                                    ? `当前会员：${selectedMember.name}${selectedMember.phone ? `（${maskPhone(selectedMember.phone)}）` : ''}，可用储值余额 ¥${selectedMember.balance.toFixed(2)}，本单需扣 ¥${watchedPaidAmount.toFixed(2)}`
                                    : '使用会员储值时，请先选择对应会员。'}
                                {balanceInsufficient ? (
                                    <div style={{ marginTop: 6, color: '#dc2626', fontWeight: 600 }}>
                                        储值余额不足，无法使用会员储值支付；请更换收款方式或先充值。
                                    </div>
                                ) : null}
                            </div>
                        </Col>
                    ) : null}

                    {/* 新建可选派单 */}
                    {showPlayers ? (
                        <Col {...fullColProps}>
                            <Form.Item
                                name="playerIds"
                                label={watchedPaymentChannel === 'SHOUQIANBA'
                                    ? `预选服务者（最多 ${MAX_PLAYERS} 人）`
                                    : `接待陪玩（最多 ${MAX_PLAYERS} 人）`}
                                extra={watchedPaymentChannel === 'SHOUQIANBA'
                                    ? '付款前不会实际派单；付款成功时仅在所选服务者全部空闲的情况下自动派单，否则保持待派单。'
                                    : undefined}
                            >
                                {isMobile ? (
                                    <div>
                                        <Button
                                            block
                                            disabled={!watchedIsPaid && !canSelectPlayersWhenUnpaid}
                                            loading={playerLoading}
                                            onClick={() => void openPlayerPicker()}
                                        >
                                            {Array.isArray(watchedPlayerIds) && watchedPlayerIds.length
                                                ? `已选 ${watchedPlayerIds.length} 人，点击修改`
                                                : '选择陪玩'}
                                        </Button>

                                        <div style={{ marginTop: 8, minHeight: 20 }}>
                                            {Array.isArray(watchedPlayerIds) && watchedPlayerIds.length ? (
                                                <Space size={6} wrap>
                                                    {watchedPlayerIds.map((id: any) => (
                                                        <Tag
                                                            key={Number(id)}
                                                            closable
                                                            onClose={(e) => {
                                                                e.preventDefault();
                                                                updatePlayerSelection(
                                                                    watchedPlayerIds
                                                                        .map((x: any) => Number(x))
                                                                        .filter((n: number) => !Number.isNaN(n) && n !== Number(id))
                                                                );
                                                            }}
                                                        >
                                                            {playerMap?.[Number(id)] || `#${id}`}
                                                        </Tag>
                                                    ))}
                                                </Space>
                                            ) : (
                                                <div style={{ color: 'rgba(0,0,0,.45)', fontSize: 12 }}>
                                                    未选择陪玩
                                                </div>
                                            )}
                                        </div>

                                        {!watchedIsPaid && !canSelectPlayersWhenUnpaid ? (
                                            <div style={{ marginTop: 6, color: '#ff4d4f', fontSize: 12 }}>
                                                非后台客服或管理自主创建的订单，未收款前不可派单
                                            </div>
                                        ) : null}
                                    </div>
                                ) : (
                                    <Select
                                        mode="multiple"
                                        placeholder="可选：新建即派单"
                                        showSearch
                                        filterOption={false}
                                        onSearch={(v) => fetchPlayers(v)}
                                        options={playerOptions}
                                        loading={playerLoading}
                                        disabled={!watchedIsPaid && !canSelectPlayersWhenUnpaid}
                                        maxTagCount={2}
                                        allowClear
                                        dropdownRender={(menu) => (
                                            <>
                                                {menu}
                                                <div style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,.06)' }}>
                                                    <Button block loading={playerLoading} onClick={() => fetchPlayers('')}>
                                                        刷新列表
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    />
                                )}
                            </Form.Item>
                        </Col>
                    ) : null}
                    {showPlayers ? (
                        <Col {...fullColProps}>
                            <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                <Form.Item name="bonusAttributionType" label="分红归因" initialValue="NONE" style={{ marginBottom: 0 }}>
                                    <Radio.Group
                                        optionType="button"
                                        buttonStyle="solid"
                                        onChange={(e) => {
                                            const v = String(e?.target?.value || 'NONE');
                                            form?.setFieldsValue?.({
                                                isRenewal: v === 'RENEWAL',
                                                renewalPlayerIds: v === 'RENEWAL' ? form?.getFieldValue?.('renewalPlayerIds') : [],
                                                isDesignated: v === 'DESIGNATED',
                                                designatedPlayerIds: v === 'DESIGNATED' ? form?.getFieldValue?.('designatedPlayerIds') : [],
                                            } as any);
                                        }}
                                    >
                                        <Radio.Button value="NONE">普通</Radio.Button>
                                        <Radio.Button value="RENEWAL">续单</Radio.Button>
                                        <Radio.Button value="DESIGNATED">指定</Radio.Button>
                                    </Radio.Group>
                                </Form.Item>
                                {watchedPaymentChannel === 'SHOUQIANBA' ? (
                                    <div className="bc-order-attribution-hint">
                                        归因会随预选服务者一起保留；支付成功且自动派单后生效。如服务者非空闲，订单保持待派单，归因选择不会丢失。
                                    </div>
                                ) : null}
                                {watchedIsRenewal ? (
                                    <Form.Item
                                        name="renewalPlayerIds"
                                        label="续单打手"
                                        rules={[{ required: true, message: '请选择续单打手' }]}
                                    >
                                        <Checkbox.Group style={{ width: '100%' }}>
                                            <Space wrap size={[8, 8]}>
                                                {(Array.isArray(watchedPlayerIds) ? watchedPlayerIds : []).map((id: any) => {
                                                    const playerId = Number(id);
                                                    return (
                                                        <Checkbox key={playerId} value={playerId}>
                                                            {playerMap?.[playerId] || `#${playerId}`}
                                                        </Checkbox>
                                                    );
                                                })}
                                            </Space>
                                        </Checkbox.Group>
                                    </Form.Item>
                                ) : null}
                                {watchedIsDesignated ? (
                                    <Form.Item
                                        name="designatedPlayerIds"
                                        label="指定打手"
                                        rules={[{ required: true, message: '请选择指定打手' }]}
                                        extra="规则同续单；指定不受优秀服务者名单限制，所选成员均参与分红。"
                                    >
                                        <Checkbox.Group style={{ width: '100%' }}>
                                            <Space wrap size={[8, 8]}>
                                                {(Array.isArray(watchedPlayerIds) ? watchedPlayerIds : []).map((id: any) => {
                                                    const playerId = Number(id);
                                                    return (
                                                        <Checkbox key={playerId} value={playerId}>
                                                            {playerMap?.[playerId] || `#${playerId}`}
                                                        </Checkbox>
                                                    );
                                                })}
                                            </Space>
                                        </Checkbox.Group>
                                    </Form.Item>
                                ) : null}
                            </Space>
                        </Col>
                    ) : null}
                </Row>

                {/* 2) 更多设置 */}
                <Collapse
                    style={{ marginTop: 16 }}
                    items={[
                        {
                            key: 'more',
                            label: '更多设置',
                            children: (
                                <Row gutter={[16, 12]}>
                                    <Col {...compactColProps}>
                                        <Form.Item name="inviter" label="邀请人">
                                            <Input placeholder={watchedIsRenewal ? "续单时推荐人失效" : "可选"} disabled={watchedIsRenewal} />
                                        </Form.Item>
                                    </Col>

                                    <Col {...compactColProps}>
                                        <Form.Item name="customClubRate" label="特殊单固定抽成">
                                            <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} placeholder="0~1" />
                                        </Form.Item>
                                    </Col>

                                    <Col {...fullColProps}>
                                        <Form.Item name="remark" label="备注">
                                            <Input.TextArea rows={3} placeholder="可选" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            ),
                        },
                    ]}
                />

                {/* 隐藏字段：小票展示用 */}
                <Form.Item name="projectName" hidden>
                    <Input />
                </Form.Item>
                <Form.Item name="billingMode" hidden>
                    <Input />
                </Form.Item>
                <Form.Item name="unitPrice" hidden>
                    <InputNumber />
                </Form.Item>
                <Form.Item name="playerNames" hidden>
                    <Input />
                </Form.Item>
                <Form.Item name="isGifted" hidden>
                    <Input />
                </Form.Item>
            </Form>
            {watchedPaymentChannel === 'SHOUQIANBA' ? (
                <aside className="bc-payment-preview-panel">
                    <div className="bc-payment-preview-heading">
                        <Typography.Text strong>付款码</Typography.Text>
                        <Typography.Text type="secondary">创建订单后在此直接展示</Typography.Text>
                    </div>
                    {paymentResult?.paymentUrl || paymentResult?.qrCodeContent ? (
                        <>
                            <div className="bc-payment-ticket-capture" aria-hidden="true">
                                <div className="bc-payment-ticket" ref={paymentTicketRef}>
                                    <div className="bc-payment-ticket-brand">蓝猫爽打</div>
                                    <div className="bc-payment-ticket-subtitle">订单在线付款</div>
                                    <div className="bc-payment-ticket-info">
                                        <span>订单</span><strong>{paymentResult?.autoSerial || `#${paymentResult?.orderId}`}</strong>
                                        <span>项目</span><strong>{paymentResult?.projectName || watchedProjectName || '-'}</strong>
                                        <span>客户</span><strong>{paymentResult?.customerIdentifier || watchedCustomerGameId || '未填写'}</strong>
                                    </div>
                                    <QRCode value={String(paymentResult?.qrCodeContent || paymentResult?.paymentUrl || '')} size={220} bordered={false} />
                                    <div className="bc-payment-ticket-amount">¥{Number(paymentResult?.amount || watchedPaidAmount || 0).toFixed(2)}</div>
                                    <div className="bc-payment-ticket-scan">请使用微信或支付宝扫码付款</div>
                                    {paymentExpiryLabel ? (
                                        <div className="bc-payment-ticket-expiry">
                                            请在 {paymentExpiryLabel} 前完成支付，过期请联系客服重新生成
                                        </div>
                                    ) : null}
                                    <div className="bc-payment-ticket-notice">
                                        派单系统已升级为实时流程。支付成功后系统会自动通知服务者接单，客服无法手动修改付款及派单状态，感谢您的理解与配合。
                                    </div>
                                </div>
                            </div>
                            {paymentConfirmed ? (
                                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                    <Alert
                                        type="success"
                                        showIcon
                                        message="客户已支付，订单状态已更新"
                                        description="小票已在当前窗口生成，可直接复制图片发给客户，无需关闭弹窗或进入订单详情。"
                                    />
                                    {paymentReceiptLoading ? (
                                        <div className="bc-payment-ticket-rendering">正在生成订单小票…</div>
                                    ) : paymentReceiptImage ? (
                                        <>
                                            <img className="bc-payment-ticket-image" src={paymentReceiptImage} alt="蓝猫爽打订单小票，可右键复制图片" />
                                            <Typography.Text type="secondary" style={{ textAlign: 'center' }}>
                                                可点击按钮复制，或直接右键/长按整张小票发送给客户
                                            </Typography.Text>
                                            <Space wrap style={{ justifyContent: 'center' }}>
                                                {isMobile ? (
                                                    <Button type="primary" onClick={() => void sharePaymentReceiptImage()}>分享订单小票</Button>
                                                ) : (
                                                    <Button type="primary" onClick={() => void copyPaymentReceiptImage()}>复制订单小票</Button>
                                                )}
                                                <Button onClick={() => void copyPaymentReceiptText()}>复制小票文字</Button>
                                                {isMobile ? <Button onClick={() => void copyPaymentReceiptImage()}>尝试复制图片</Button> : null}
                                            </Space>
                                        </>
                                    ) : (
                                        <Alert type="warning" showIcon message="小票图片生成失败" description="可复制小票文字，或进入订单详情重新生成。" />
                                    )}
                                </Space>
                            ) : paymentCodeInvalid ? (
                                <Alert
                                    type="warning"
                                    showIcon
                                    message={paymentCodeStale ? '订单信息已变化，当前付款码已失效' : '当前付款码已过期'}
                                    description="请重新核对左侧内容并生成新付款码，勿继续发送旧图或链接。"
                                />
                            ) : paymentTicketImage ? (
                                <img className="bc-payment-ticket-image" src={paymentTicketImage} alt="蓝猫爽打订单付款码，可右键复制图片" />
                            ) : <div className="bc-payment-ticket-rendering">正在生成完整付款图…</div>}
                            {!paymentConfirmed && !paymentCodeInvalid ? <Typography.Text type="secondary" style={{ textAlign: 'center' }}>可直接右键复制整张付款图发送给客户</Typography.Text> : null}
                            {!paymentConfirmed ? <Space wrap style={{ justifyContent: 'center' }}>
                                <Button disabled={paymentCodeInvalid} onClick={async () => {
                                    await navigator.clipboard.writeText(String(paymentResult?.paymentUrl || ''));
                                    message.success('付款链接已复制');
                                }}>复制付款链接</Button>
                                <Button type={paymentCodeInvalid ? 'primary' : 'default'} loading={submitting} onClick={confirmAndSubmitOrder}>
                                    {paymentCodeInvalid ? '重新生成有效付款码' : '重新生成付款码'}
                                </Button>
                            </Space> : null}
                        </>
                    ) : paymentResult?.error ? (
                        <div className="bc-payment-preview-empty error">
                            <strong>订单草稿已保存，但付款码生成失败</strong>
                            <span>{paymentResult.error}</span>
                            <Space wrap style={{ justifyContent: 'center' }}>
                                <Button type="primary" loading={submitting} onClick={confirmAndSubmitOrder}>在此重新生成</Button>
                                <Button onClick={() => onViewCreatedOrder?.(Number(paymentResult?.orderId || 0))}>查看订单草稿</Button>
                            </Space>
                        </div>
                    ) : (
                        <div className="bc-payment-preview-empty">
                            <div className="bc-payment-preview-placeholder">付</div>
                            <strong>确认左侧信息后生成</strong>
                            <span>点击一次即创建订单并生成付款码，不会再打开第二个弹窗。</span>
                            <Button type="primary" size="large" loading={submitting} onClick={confirmAndSubmitOrder}>
                                核对并生成付款码
                            </Button>
                        </div>
                    )}
                    {paymentResult?.orderId ? (
                        <Space style={{ width: '100%', justifyContent: 'center' }}>
                            <Button onClick={onCancel}>关闭</Button>
                            <Button type={paymentConfirmed ? 'default' : 'primary'} onClick={() => onViewCreatedOrder?.(Number(paymentResult.orderId))}>查看订单</Button>
                        </Space>
                    ) : <Button block onClick={onCancel}>取消</Button>}
                </aside>
            ) : watchedPaymentChannel === 'MANUAL' ? (
                <aside className={`bc-order-liability-panel ${watchedIsPaid ? 'is-paid' : ''}`}>
                    <div className="bc-order-liability-icon">{watchedIsPaid ? '✓' : String(watchedOrderSource || '') === 'STORE_PENDING_SETTLEMENT' ? '账期' : '48h'}</div>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                        {watchedIsPaid ? '已标记线下收款' : String(watchedOrderSource || '') === 'STORE_PENDING_SETTLEMENT' ? '门店周期结算' : '未收款责任提醒'}
                    </Typography.Title>
                    {watchedIsPaid ? (
                        <Typography.Text type="secondary">
                            订单将按已收款创建，不进入 48 小时未收款追责流程。请确保款项已实际到账。
                        </Typography.Text>
                    ) : (
                        String(watchedOrderSource || '') === 'STORE_PENDING_SETTLEMENT' ? (
                            <>
                                <Typography.Text>订单以未付款状态进入正常服务流程，待门店固定周期对账后确认收款。</Typography.Text>
                                <div className="bc-order-liability-amount">待结算金额 <strong>¥{watchedPaidAmount.toFixed(2)}</strong></div>
                                <Typography.Text type="secondary">此渠道不启动48小时催收，不会从派单客服余额自动扣款。</Typography.Text>
                            </>
                        ) : (
                        <>
                            <Typography.Text>
                                允许先派单后收款，但未收款状态将对后续所有流程参与者可见。
                            </Typography.Text>
                            <div className="bc-order-liability-amount">
                                待收金额 <strong>¥{watchedPaidAmount.toFixed(2)}</strong>
                            </div>
                            <ul>
                                <li>责任归属创建并派单的客服</li>
                                <li>系统会定期提醒责任客服完成收款</li>
                                <li>超过 48 小时仍未收款，将自动从责任客服余额扣除订单金额</li>
                            </ul>
                            <Typography.Text type="danger" strong>
                                请确认责任可承担后再派单。
                            </Typography.Text>
                        </>
                        )
                    )}
                </aside>
            ) : <aside className="bc-order-create-side-placeholder" aria-hidden="true" />}
            </div>

            {isMobile ? (
                <Drawer
                    open={playerPickerOpen}
                    title="选择陪玩"
                    placement="bottom"
                    height="86vh"
                    destroyOnClose
                    onClose={() => setPlayerPickerOpen(false)}
                >
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center">
                            <div style={{ fontWeight: 600 }}>选择陪玩</div>
                            <Button type="primary" onClick={() => setPlayerPickerOpen(false)}>
                                完成
                            </Button>
                        </Space>

                        <Input.Search
                            allowClear
                            value={playerPickerKeyword}
                            placeholder="搜索昵称或手机号"
                            onChange={(e) => {
                                const kw = e.target.value;
                                setPlayerPickerKeyword(kw);
                                void fetchPlayers(kw);
                            }}
                        />

                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
                            已选 {Array.isArray(watchedPlayerIds) ? watchedPlayerIds.length : 0}/{MAX_PLAYERS} 人，点击列表项即可切换。
                        </div>

                        <List
                            loading={playerLoading}
                            dataSource={playerOptions}
                            locale={{ emptyText: '暂无可选陪玩' }}
                            renderItem={(item) => {
                                const selected = Array.isArray(watchedPlayerIds)
                                    ? watchedPlayerIds.map((x: any) => Number(x)).includes(item.value)
                                    : false;
                                const selectedCount = Array.isArray(watchedPlayerIds) ? watchedPlayerIds.length : 0;
                                const canAddMore = selected || selectedCount < MAX_PLAYERS;
                                return (
                                    <List.Item
                                        onClick={() => {
                                            if (!selected && !canAddMore) {
                                                message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
                                                return;
                                            }
                                            togglePlayerSelection(item.value);
                                        }}
                                        style={{
                                            cursor: 'pointer',
                                            paddingLeft: 0,
                                            paddingRight: 0,
                                        }}
                                    >
                                        <Space align="start" size={12} style={{ width: '100%', justifyContent: 'space-between' }}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: 500 }}>{playerMap?.[item.value] || item.label}</div>
                                                <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
                                                    {item.label}
                                                </div>
                                            </div>
                                            <Checkbox checked={selected} />
                                        </Space>
                                    </List.Item>
                                );
                            }}
                        />
                    </Space>
                </Drawer>
            ) : null}
        </Modal>
    );
}
