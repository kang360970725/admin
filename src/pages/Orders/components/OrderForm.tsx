// src/pages/Orders/components/OrderForm.tsx
// 说明：文件名虽为 OrderForm.tsx，但这里导出的是“新建/编辑订单通用弹窗”组件（OrderUpsertModal）
// 融合点：
// - 你现有 UI：宽弹窗 + Divider 分组 + 栅格（默认 2 列）+ 更美观
// - 新需求：下单数量 orderQuantity（小时单=下单小时），金额（应收/实收）按时长累加（= 项目单价 * 数量）
// - 兼容：可选派单（showPlayers）
// - 兼容：链式 ?. 防止空对象导致报错
// - 额外：提供小票生成所需展示字段（projectName/billingMode/unitPrice/playerNames），不建议传后端

import React, { useEffect, useMemo, useState } from 'react';
import {
    Col,
    Collapse,
    DatePicker,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Row,
    Select,
    Button,
    Checkbox,
    Drawer,
    List,
    Tag,
    Space,
} from 'antd';
import dayjs from 'dayjs';
import { getGameProjectOptions, getOrderSourceOptions, getPlayerOptions, getUsers, getUserCoupons } from '@/services/api';
import { useIsMobile } from '@/utils/useIsMobile';
import { maskPhone } from '@/utils/privacy';

type ProjectItem = {
    id: number;
    name: string;
    price?: number | null; // 小时单：每小时价格；非小时单：也可能用于默认金额
    baseAmount?: number | null; // 保底（万）
    billingMode?: 'HOURLY' | 'GUARANTEED' | string | null; // 计费方式：用于判断小时单
    category?: string | null;
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
}) {
    const { open, title, initialValues, showPlayers, onCancel, onSubmit } = props;

    const [form] = Form.useForm<OrderUpsertValues>();
    const isMobile = useIsMobile(768);

    const [submitting, setSubmitting] = useState(false);

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
    const [memberMetaMap, setMemberMetaMap] = useState<Record<number, { name: string; phone: string; balance: number }>>({});
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
            });
            const list = Array.isArray(res?.data) ? res.data : [];
            const nextMeta: Record<number, { name: string; phone: string; balance: number }> = {};
            const nextOptions = list.map((item: any) => {
                const id = Number(item?.id || 0);
                const name = String(item?.name || '未命名会员').trim();
                const phone = String(item?.phone || '').trim();
                const memberCode = String(item?.memberProfile?.memberCode || '').trim();
                const balance = Number(item?.wallet?.availableBalance ?? 0);
                nextMeta[id] = { name, phone, balance };
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
                paidAmount: calcPayableAfterCoupon(total, form?.getFieldValue?.('userCouponId' as any), id),
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

        form?.setFieldsValue?.({
            ...initialValues,
            orderTime: initialValues?.orderTime ? dayjs(initialValues.orderTime) : now,
            paymentTime: initialValues?.paymentTime ? dayjs(initialValues.paymentTime) : now,
            orderQuantity:
                initialValues?.orderQuantity != null
                    ? Number(initialValues.orderQuantity)
                    : 1,
            isGifted: Boolean(initialValues?.isGifted ?? false),
            isRenewal: Boolean(initialValues?.isRenewal ?? false),
            renewalPlayerIds: Array.isArray(initialValues?.renewalPlayerIds) ? initialValues?.renewalPlayerIds : [],
            orderSource: initialValues?.orderSource || 'CUSTOMER_SERVICE_MANUAL',
            paymentChannel: initialValues?.paymentChannel || 'MANUAL',
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
            paidAmount: payable,
            settlementAmount: payable,
        } as any);
    };

    // 值变化：项目变更 + 数量变更 + 限制打手数量
    const onValuesChange = (changed: any) => {
        if (Object.prototype.hasOwnProperty.call(changed || {}, 'projectId')) {
            form?.setFieldValue?.('userCouponId' as any, undefined);
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
            form?.setFieldsValue?.({
                paymentChannel: 'BALANCE',
                isPaid: true,
                userCouponId: undefined,
            } as any);
            void fetchMemberCoupons(Number(changed.customerUserId));
        } else if (changed?.customerUserId !== undefined) {
            form?.setFieldsValue?.({ userCouponId: undefined } as any);
            setCouponOptions([]);
            setCouponMetaMap({});
        }

        if (changed?.paymentChannel && String(changed.paymentChannel).trim().toUpperCase() === 'BALANCE') {
            form?.setFieldValue?.('isPaid' as any, true);
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
            form?.setFieldValue?.('renewalPlayerIds' as any, nextRenewalIds);
            if (!nextPlayerIds.length) {
                form?.setFieldValue?.('isRenewal' as any, false);
            }
        }

        if (showPlayers && changed?.isRenewal === false) {
            form?.setFieldValue?.('renewalPlayerIds' as any, []);
        }

        if (showPlayers && changed?.isRenewal === true) {
            const currentPlayerIds = Array.isArray(form?.getFieldValue?.('playerIds')) ? form.getFieldValue('playerIds') : [];
            if (!currentPlayerIds.length) {
                message.warning('请先选择派单打手，再标记续单');
                form?.setFieldValue?.('isRenewal' as any, false);
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
            const isGifted = Boolean(v?.isGifted);
            const paymentChannel = String(v?.paymentChannel || '').trim().toUpperCase();
            const isPaid = paymentChannel === 'BALANCE' ? true : Boolean(v?.isPaid);
            const canDispatchBeforePaid = isGifted || orderSource === 'CUSTOMER_SERVICE_MANUAL';

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
            const nextPaidAmount = toMoney(Number(v?.paidAmount ?? 0));
            if (paymentChannel === 'BALANCE' && selectedMemberBalance < nextPaidAmount) {
                message.error(`会员储值余额不足：当前可用 ¥${selectedMemberBalance.toFixed(2)}，本单需扣 ¥${nextPaidAmount.toFixed(2)}`);
                return;
            }

            const payloadPlayerIds = showPlayers
                ? Array.isArray(v?.playerIds)
                    ? v.playerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
                    : []
                : undefined;
            const isRenewal = showPlayers ? Boolean(v?.isRenewal) : false;
            const renewalPlayerIds = isRenewal && Array.isArray(v?.renewalPlayerIds)
                ? v.renewalPlayerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
                : [];

            if (isRenewal) {
                if (!payloadPlayerIds?.length) {
                    message.error('续单必须先选择派单打手');
                    return;
                }
                if (!renewalPlayerIds.length) {
                    message.error('请选择续单打手');
                    return;
                }
                if (renewalPlayerIds.some((id: number) => !payloadPlayerIds.includes(id))) {
                    message.error('续单打手必须从当前派单打手中选择');
                    return;
                }
            }

            const payload: OrderUpsertValues = {
                ...(v as any),
                id: initialValues?.id,

                projectId: Number(v?.projectId),

                receivableAmount: Number(v?.receivableAmount),
                paidAmount: Number(v?.paidAmount),
                settlementAmount: v?.settlementAmount != null ? Number(v?.settlementAmount) : Number(v?.paidAmount),
                manualAdjustAmount:
                    v?.userCouponId != null && v?.userCouponId !== ''
                        ? 0
                        : toMoney(Math.max(0, Number(v?.receivableAmount ?? 0) - Number(v?.paidAmount ?? 0))),

                baseAmountWan: v?.baseAmountWan != null && v?.baseAmountWan !== '' ? Number(v?.baseAmountWan) : null,

                // ✅ 下单数量：小时单=小时；其它单默认 1
                orderQuantity: Number(v?.orderQuantity ?? 1),

                customerGameId: v?.customerGameId?.trim?.() || undefined,
                customerUserId: v?.customerUserId != null && v?.customerUserId !== '' ? Number(v?.customerUserId) : undefined,
                userCouponId: v?.userCouponId != null && v?.userCouponId !== '' ? Number(v?.userCouponId) : undefined,
                orderSource: v?.orderSource ? String(v.orderSource).trim() : undefined,
                paymentChannel: paymentChannel || undefined,

                orderTime: v?.orderTime ? dayjs(v.orderTime).toISOString() : now.toISOString(),
                paymentTime: v?.paymentTime ? dayjs(v.paymentTime).toISOString() : now.toISOString(),

                inviter: isRenewal ? undefined : (v?.inviter?.trim?.() || undefined),

                csRate: v?.csRate != null && v?.csRate !== '' ? Number(v?.csRate) : undefined,
                inviteRate: isRenewal ? 0 : (v?.inviteRate != null && v?.inviteRate !== '' ? Number(v?.inviteRate) : undefined),

                customClubRate: v?.customClubRate != null && v?.customClubRate !== '' ? Number(v?.customClubRate) : undefined,

                remark: v?.remark?.trim?.() || undefined,

                playerIds: payloadPlayerIds,
                isRenewal,
                renewalPlayerIds: isRenewal ? renewalPlayerIds : undefined,

                isGifted: Boolean(v?.isGifted),

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
    const compactColProps = { xs: 12, sm: 12, md: 12, lg: 12 };
    const fullColProps = { xs: 24, sm: 24, md: 24, lg: 24 };

    const watchedProjectId = Form.useWatch('projectId', form);
    const curProjectId = Number(watchedProjectId ?? 0);
    const showQtyForHourly = isHourlyProject(curProjectId);
    const watchedIsPaid = Form.useWatch('isPaid', form);
    const watchedOrderSource = Form.useWatch('orderSource', form);
    const watchedIsGifted = Form.useWatch('isGifted', form);
    const canSelectPlayersWhenUnpaid =
        Boolean(watchedIsGifted) || String(watchedOrderSource || '').trim() === 'CUSTOMER_SERVICE_MANUAL';
    const watchedPlayerIds = Form.useWatch('playerIds', form) || [];
    const watchedIsRenewal = Boolean(Form.useWatch('isRenewal', form));
    const watchedCustomerUserId = Number(Form.useWatch('customerUserId', form) ?? 0);
    const watchedPaymentChannel = String(Form.useWatch('paymentChannel', form) || '').trim().toUpperCase();
    const watchedReceivableAmount = Number(Form.useWatch('receivableAmount', form) || 0);
    const watchedPaidAmount = Number(Form.useWatch('paidAmount', form) || 0);
    const watchedSettlementAmount = Number(Form.useWatch('settlementAmount', form) || 0);
    const watchedUserCouponId = Number(Form.useWatch('userCouponId', form) || 0);
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

    function calcPayableAfterCoupon(receivable: number, couponId?: number | null, projectId?: number) {
        const coupon = Number(couponId || 0) > 0 ? couponMetaMap?.[Number(couponId)] : null;
        const discount = calcCouponPreviewDiscount(coupon, toMoney(receivable), Number(projectId || 0));
        return toMoney(Math.max(0, toMoney(receivable) - discount));
    }

    const updatePlayerSelection = (nextIds: number[]) => {
        const limitedIds = nextIds.slice(0, MAX_PLAYERS);
        const names = limitedIds
            .map((id: any) => playerMap?.[Number(id)])
            .filter(Boolean);
        const currentRenewalIds = Array.isArray(form?.getFieldValue?.('renewalPlayerIds'))
            ? form.getFieldValue('renewalPlayerIds').map((id: any) => Number(id)).filter((id: number) => limitedIds.includes(id))
            : [];
        form?.setFieldsValue?.({
            playerIds: limitedIds,
            playerNames: names,
            renewalPlayerIds: currentRenewalIds,
            isRenewal: limitedIds.length ? form?.getFieldValue?.('isRenewal') : false,
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
            onOk={handleOk}
            confirmLoading={submitting}
            destroyOnClose
            rootClassName="bc-order-upsert-modal-root"
            className="bc-order-upsert-modal"
            width={isMobile ? '96vw' : 700}
            style={{ top: isMobile ? 8 : 24 }}
            okText="保存"
            cancelText="取消"
            okButtonProps={{
                disabled: balanceInsufficient,
            }}
        >
            <Form form={form} layout="vertical" onValuesChange={onValuesChange} className="bc-admin-form">
                <div className="bc-admin-form-summary">
                    <div className="bc-admin-form-summary-card info">
                        <div className="bc-admin-form-summary-label">应收金额</div>
                        <div className="bc-admin-form-summary-value">¥{watchedReceivableAmount.toFixed(2)}</div>
                    </div>
                    <div className="bc-admin-form-summary-card info">
                        <div className="bc-admin-form-summary-label">实收金额</div>
                        <div className="bc-admin-form-summary-value">¥{watchedPaidAmount.toFixed(2)}</div>
                    </div>
                    <div className="bc-admin-form-summary-card warning">
                        <div className="bc-admin-form-summary-label">优惠抵扣</div>
                        <div className="bc-admin-form-summary-value">¥{watchedDiscountAmount.toFixed(2)}</div>
                    </div>
                    <div className="bc-admin-form-summary-card info">
                        <div className="bc-admin-form-summary-label">结算金额</div>
                        <div className="bc-admin-form-summary-value">¥{watchedSettlementAmount.toFixed(2)}</div>
                    </div>
                    <div className={`bc-admin-form-summary-card ${watchedIsPaid ? 'success' : 'danger'}`}>
                        <div className="bc-admin-form-summary-label">收款状态</div>
                        <div className="bc-admin-form-summary-value">{watchedIsPaid ? '已付款' : '未付款'}</div>
                    </div>
                </div>
                {/* 1) 订单核心 */}
                <div className="bc-admin-form-section-title">订单信息</div>

                <Row gutter={[16, 12]}>
                    <Col {...compactColProps}>
                        <Form.Item name="paymentChannel" label="收款方式">
                            <Select
                                placeholder="默认线下收款"
                                allowClear={false}
                                options={[
                                    { label: '线下收款', value: 'MANUAL' },
                                    { label: '会员储值', value: 'BALANCE' },
                                ]}
                            />
                        </Form.Item>
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
                        <Form.Item name="customerUserId" label="关联会员">
                            <Select
                                placeholder="可选：搜索会员编码、手机号或姓名"
                                showSearch
                                filterOption={false}
                                onSearch={(v) => fetchMembers(v)}
                                options={memberOptions}
                                loading={memberLoading}
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
                    <Col {...fullColProps}>
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
                    </Col>

                    {/* ✅ 小时单才展示“下单小时(数量)” */}
                    {showQtyForHourly ? (
                        <Col {...compactColProps}>
                            <Form.Item
                                name="orderQuantity"
                                label="下单小时"
                                rules={[{ required: true, message: '请输入下单小时' }]}
                            >
                                <InputNumber min={1} max={24} step={1} style={{ width: '100%' }} placeholder="例如：1 / 2 / 3 ..." />
                            </Form.Item>
                        </Col>
                    ) : <Col {...compactColProps}>
                        <Form.Item name="baseAmountWan" label="订单保底(万)">
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="随项目自动同步，可手改" />
                        </Form.Item>
                    </Col>}

                    <Col {...compactColProps}>
                        <Form.Item name="receivableAmount" label="应收金额" rules={[{ required: true, message: '请输入应收金额' }]}>
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                placeholder={showQtyForHourly ? '随小时自动计算' : '随项目自动同步'}
                            />
                        </Form.Item>
                    </Col>

                    <Col {...compactColProps}>
                        <Form.Item name="paidAmount" label="实收金额" rules={[{ required: true, message: '请输入实收金额' }]}>
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                disabled={watchedUserCouponId > 0}
                                placeholder={showQtyForHourly ? '随小时自动计算' : '随项目自动同步'}
                            />
                        </Form.Item>
                        {watchedUserCouponId > 0 ? (
                            <div style={{ marginTop: -8, marginBottom: 8, color: '#64748b', fontSize: 12 }}>
                                已选择优惠券，实收金额由券规则自动计算，不支持手动修改。
                            </div>
                        ) : null}
                    </Col>

                    <Col {...compactColProps}>
                        <Form.Item name="settlementAmount" label="结算金额" rules={[{ required: true, message: '请输入结算金额' }]}>
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                placeholder="默认跟实收金额一致"
                            />
                        </Form.Item>
                    </Col>

                    <Col {...fullColProps}>
                        <Form.Item name="customerGameId" label="客户ID（游戏ID）">
                            <Input placeholder="ID或昵称" />
                        </Form.Item>
                    </Col>

                    <Col {...compactColProps}>
                        <Form.Item name="paymentTime" label="付款时间">
                            <DatePicker
                                showTime
                                style={{ width: '100%' }}
                                disabled={!watchedIsPaid}
                                placeholder={watchedIsPaid ? '可选：不选则按确认时自动写入当前时间' : '未收款时不需要填写'}
                            />
                        </Form.Item>
                    </Col>
                    <Col {...compactColProps}>
                        <Form.Item
                            name="isPaid"
                            valuePropName="checked"
                            label="收款状态"
                            initialValue={true}
                            tooltip="先打后付：把这里取消勾选，订单会被标记为未收款"
                        >
                            <Checkbox>已付款</Checkbox>
                        </Form.Item>
                    </Col>
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
                            <Form.Item name="playerIds" label={`接待陪玩（最多 ${MAX_PLAYERS} 人）`}>
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
                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                <Form.Item name="isRenewal" valuePropName="checked" style={{ marginBottom: 0 }}>
                                    <Checkbox disabled={!Array.isArray(watchedPlayerIds) || !watchedPlayerIds.length}>标记为续单</Checkbox>
                                </Form.Item>
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
