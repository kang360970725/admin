import React, {useEffect, useMemo, useState} from 'react';
import {
    Button,
    Card,
    Col,
    Descriptions,
    Divider,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Row, Select,
    Space,
    Statistic,
    Tag,
    Watermark,
} from 'antd';
import {PageContainer} from '@ant-design/pro-components';
import {useModel} from '@umijs/max';
import dayjs from 'dayjs';
import {
    acceptDispatch,
    archiveDispatch,
    completeDispatch,
    dispatchRejectOrder,
    getEnumDicts,
    getMyDispatches,
    getOrderDetail,
    ordersMyStats,
    usersWorkStatus,
} from '@/services/api';

type DictMap = Record<string, Record<string, string>>;

const WorkbenchPage: React.FC = () => {
    const {initialState, setInitialState} = useModel('@@initialState');
    const currentUser = initialState?.currentUser;

    const isMobile = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia?.('(max-width: 767px)')?.matches;
    }, []);

    const [myWorkStatus, setLocalWorkStatus] = useState<string>(
        String(initialState?.currentUser?.workStatus || 'IDLE'),
    );

    // enums dicts
    const [dicts, setDicts] = useState<DictMap>({});

    // 工作状态（来自用户信息）
    const workStatus = myWorkStatus;

    // 统计
    const [statsLoading, setStatsLoading] = useState(false);
    const [todayCount, setTodayCount] = useState(0);
    const [todayIncome, setTodayIncome] = useState(0);
    const [monthCount, setMonthCount] = useState(0);
    const [monthIncome, setMonthIncome] = useState(0);

    // 订单池
    const [poolLoading, setPoolLoading] = useState(false);
    const [poolDispatch, setPoolDispatch] = useState<any>(null); // 当前展示的一条（待接/进行中）
    const [poolMode, setPoolMode] = useState<'WAITING' | 'WORKING' | 'RESTING'>('WAITING');

    // 拒单
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectSubmitting, setRejectSubmitting] = useState(false);
    const [rejectForm] = Form.useForm();

    // 存单/结单
    const [finishOpen, setFinishOpen] = useState(false);
    const [finishMode, setFinishMode] = useState<'ARCHIVE' | 'COMPLETE'>('ARCHIVE');
    const [finishSubmitting, setFinishSubmitting] = useState(false);
    const [finishForm] = Form.useForm();
    const watchedTotalProgressWan = Form.useWatch('totalProgressWan', finishForm);
    const watchedDeductMinutesOption = Form.useWatch('deductMinutesOption', finishForm);
    const watchedDeductMinutesCustom = Form.useWatch('deductMinutesCustom', finishForm);

    const [guaranteedCompleteRemainingWan, setGuaranteedCompleteRemainingWan] = useState<number | null>(null);

    // 小时单预览 tick
    const [tick, setTick] = useState(Date.now());
    useEffect(() => {
        if (!finishOpen) return;
        const timer = window.setInterval(() => setTick(Date.now()), 30_000);
        return () => window.clearInterval(timer);
    }, [finishOpen]);

    const t = (group: keyof DictMap, key: any, fallback?: string) => {
        const k = String(key ?? '');
        return dicts?.[group]?.[k] || fallback || k || '-';
    };

    const loadDictsOnce = async () => {
        if (Object.keys(dicts || {}).length > 0) return;
        try {
            const res = await getEnumDicts();
            setDicts((res || {}) as any);
        } catch (e) {
            console.error(e);
        }
    };

    const billingModeOf = (dispatchRow: any) => {
        const order = dispatchRow?.order || {};
        const snap = order?.projectSnapshot || {};
        return snap?.billingMode || order?.project?.billingMode;
    };
    const isGuaranteed = (dispatchRow: any) => billingModeOf(dispatchRow) === 'GUARANTEED';
    const isHourly = (dispatchRow: any) => billingModeOf(dispatchRow) === 'HOURLY';

    const participantsActive = (dispatchRow: any) => {
        const ps = dispatchRow?.participants || dispatchRow?.order?.currentDispatch?.participants || [];
        return (Array.isArray(ps) ? ps : []).filter((p: any) => p?.isActive !== false && !p?.rejectedAt);
    };

    const sumArchivedProgressWan = (orderDetail: any) => {
        const ds = Array.isArray(orderDetail?.dispatches) ? orderDetail.dispatches : [];
        let sum = 0;
        for (const d of ds) {
            if (String(d?.status) !== 'ARCHIVED') continue;
            const ps = Array.isArray(d?.participants) ? d.participants : [];
            for (const p of ps) sum += Number(p?.progressBaseWan ?? 0);
        }
        return sum;
    };

    const buildAcceptedExtraInfo = (dispatchRow: any) => {
        const order = dispatchRow?.order || {};
        const snap = order?.projectSnapshot || {};
        const billingMode = String(snap?.billingMode ?? order?.project?.billingMode ?? '');

        const unitPrice = Number(snap?.price ?? order?.project?.price);
        const paid = Number(order?.paidAmount ?? order?.receivableAmount ?? 0);

        const orderTime = order?.orderTime ? dayjs(order.orderTime) : dayjs(order?.createdAt || new Date());

        const isHourly = billingMode === 'HOURLY';
        const isGuaranteed = billingMode === 'GUARANTEED';

        let estHours: number | null = null;
        let estEnd: string | null = null;

        if (isHourly && Number.isFinite(unitPrice) && unitPrice > 0) {
            estHours = paid / unitPrice;
            estEnd = orderTime.add(estHours, 'hour').add(20, 'minute').format('YYYY-MM-DD HH:mm');
        }

        let remainingWan: number | null = null;
        if (isGuaranteed) {
            const base = Number(order?.baseAmountWan ?? 0);
            const done = sumArchivedProgressWan(order);
            remainingWan = Math.max(0, base - done);
        }

        return {billingMode, isHourly, isGuaranteed, estHours, estEnd, remainingWan};
    };
// --- 小时单：开始时间（全员接单时间）& 估时计算 ---

    /** 小时单开始时间：优先用全员接单时间 acceptedAllAt */
    const getHourlyStartAt = (dispatchRow: any) => {
        const d = dispatchRow || {};
        const order = d?.order || {};
        const cd = order?.currentDispatch || {};

        // ✅ 1) 你指定：全员接单时间
        const acceptedAllAt =
            d?.acceptedAllAt ||
            cd?.acceptedAllAt;

        if (acceptedAllAt) return dayjs(acceptedAllAt);

        // ✅ 2) 兜底：避免字段缺失导致 UI 崩
        if (d?.assignedAt) return dayjs(d.assignedAt);
        if (order?.orderTime) return dayjs(order.orderTime);
        if (order?.createdAt) return dayjs(order.createdAt);

        return dayjs(); // 最后兜底：现在
    };

    /**
     * 估时时长折算规则：
     * - 按分钟差：整小时 + 余分钟分段
     * - 余分钟：0-18 => +0；18-45 => +0.5；>45 => +1
     * - 最低 0.5 小时
     */
    const calcHourlyChargeHours = (diffMinutesRaw: number) => {
        const diffMinutes = Math.max(0, Math.floor(Number(diffMinutesRaw || 0)));
        const baseHours = Math.floor(diffMinutes / 60);
        const rem = diffMinutes % 60;

        let add = 0;
        if (rem >= 18 && rem <= 45) add = 0.5;
        else if (rem > 45) add = 1;

        let hours = baseHours + add;
        if (hours < 0.5) hours = 0.5;

        return { diffMinutes, hours };
    };

    const refreshStats = async () => {
        setStatsLoading(true);
        try {
            const res = await ordersMyStats({});
            setTodayCount(Number(res?.todayCount ?? 0));
            setTodayIncome(Number(res?.todayIncome ?? 0));
            setMonthCount(Number(res?.monthCount ?? 0));
            setMonthIncome(Number(res?.monthIncome ?? 0));
        } catch (e: any) {
            message.error(e?.response?.data?.message || '获取统计失败');
        } finally {
            setStatsLoading(false);
        }
    };

    // ✅ 补全：把 dispatch 行补成带完整 order detail 的结构（详情失败也不阻断）
    const hydrateDispatchWithOrder = async (row: any) => {
        if (!row) return null;
        const orderId = Number(row?.orderId ?? row?.order?.id);
        if (!orderId) return row;
        try {
            const detail = await getOrderDetail(orderId);
            return {...row, order: detail};
        } catch (e) {
            return row;
        }
    };

    const refreshPool = async () => {
        setPoolLoading(true);
        try {
            await loadDictsOnce();

            if (workStatus === 'RESTING') {
                setPoolMode('RESTING');
                setPoolDispatch(null);
                return;
            }

            const fetchFirst = async (status: 'WAIT_ACCEPT' | 'ACCEPTED') => {
                const res: any = await getMyDispatches({page: 1, limit: 10, status, mode:'workbench'});
                const list = Array.isArray(res?.data) ? res.data : [];
                return list?.[0] || null;
            };

            // ✅ WORKING：优先进行中，否则兜底待接并纠正状态
            if (workStatus === 'WORKING') {
                setPoolMode('WORKING');

                let first = await fetchFirst('ACCEPTED');
                if (first) {
                    setPoolDispatch(await hydrateDispatchWithOrder(first));
                    return;
                }

                first = await fetchFirst('WAIT_ACCEPT');
                if (first) {
                    // 自动纠正：实际上是等待中
                    setLocalWorkStatus('IDLE');
                    setInitialState?.((s: any) => ({
                        ...s,
                        currentUser: {...(s?.currentUser || {}), workStatus: 'IDLE'},
                    }));
                    setPoolMode('WAITING');
                    setPoolDispatch(await hydrateDispatchWithOrder(first));
                    return;
                }

                setPoolDispatch(null);
                return;
            }

            // ✅ 默认 IDLE：优先待接，否则兜底进行中并纠正状态
            setPoolMode('WAITING');

            let first = await fetchFirst('WAIT_ACCEPT');
            if (first) {
                setPoolDispatch(await hydrateDispatchWithOrder(first));
                return;
            }

            first = await fetchFirst('ACCEPTED');
            if (first) {
                // 自动纠正：实际上是接单中
                setLocalWorkStatus('WORKING');
                setInitialState?.((s: any) => ({
                    ...s,
                    currentUser: {...(s?.currentUser || {}), workStatus: 'WORKING'},
                }));
                setPoolMode('WORKING');
                setPoolDispatch(await hydrateDispatchWithOrder(first));
                return;
            }

            setPoolDispatch(null);
        } catch (e) {
            console.error(e);
        } finally {
            setPoolLoading(false);
        }
    };

    useEffect(() => {
        void loadDictsOnce();
        void refreshStats();
        void refreshPool();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // workStatus 变化时刷新订单池
    useEffect(() => {
        void refreshPool();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workStatus]);

    const updateMyWorkStatus = async (next: 'IDLE' | 'RESTING') => {
        try {
            await usersWorkStatus({workStatus: next});

            // ✅ 1) 立即更新本地状态（状态模块秒更新）
            setLocalWorkStatus(next);

            // ✅ 2) 同步到 initialState，避免其它地方仍读旧值
            setInitialState?.((s: any) => ({
                ...s,
                currentUser: {
                    ...(s?.currentUser || {}),
                    workStatus: next,
                },
            }));

            message.success(next === 'IDLE' ? '已开始接单（等待中）' : '已进入休息中');
        } catch (e: any) {
            message.error(e?.response?.data?.message || '更新状态失败');
        }
    };

    const openReject = () => {
        rejectForm.resetFields();
        setRejectOpen(true);
    };

    const submitReject = async () => {
        try {
            const v = await rejectForm.validateFields();
            if (!poolDispatch?.id) return;

            setRejectSubmitting(true);
            await dispatchRejectOrder({dispatchId: Number(poolDispatch.id), reason: String(v.reason || '').trim()});

            message.success('已拒单，已进入休息中');
            setRejectOpen(false);

            // ✅ 要求：拒单后默认休息中
            await updateMyWorkStatus('RESTING');
        } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || '拒单失败');
        } finally {
            setRejectSubmitting(false);
        }
    };

    const submitAccept = async () => {
        try {
            if (!poolDispatch?.id) return;
            await acceptDispatch(Number(poolDispatch.id), {});
            message.success('已接单，请等待所有打手均确认接单');

            setLocalWorkStatus('WORKING');
            setInitialState?.((s: any) => ({
                ...s,
                currentUser: {...(s?.currentUser || {}), workStatus: 'WORKING'},
            }));

            void refreshStats();
        } catch (e: any) {
            message.error(e?.response?.data?.message || '接单失败');
        }
    };




    // ✅ 成功后：立即同步工作状态（修复“结单后状态卡不更新”）
    const syncWorkStatusAfterFinish = (next: 'IDLE' | 'RESTING' | 'WORKING') => {
        setLocalWorkStatus(next);
        setInitialState?.((s: any) => ({
            ...s,
            currentUser: {...(s?.currentUser || {}), workStatus: next},
        }));
    };

    // --- 存单/结单 弹窗---
    const openFinish = async (row: any, mode: 'ARCHIVE' | 'COMPLETE') => {
        await loadDictsOnce();
        setFinishMode(mode);

        // ✅ 1) 优先从 row/currentDispatch 拿本轮参与者
        let ps = participantsActive(row);

        // ✅ 2) 若为空：补拉订单详情，从 detail.dispatches 按 dispatchId 找本轮 participants
        if (!ps || ps.length === 0) {
            try {
                const orderId = Number(row?.order?.id ?? row?.orderId);
                const dispatchId = Number(row?.id);
                if (orderId && dispatchId) {
                    const detail = await getOrderDetail(orderId);

                    const dispatches = Array.isArray(detail?.dispatches) ? detail.dispatches : [];
                    const thisRound = dispatches.find((d: any) => Number(d?.id) === dispatchId);

                    const parts = thisRound?.participants || [];
                    // 复用同样的“活跃参与者”口径（跟 participantsActive 一致）
                    ps = (Array.isArray(parts) ? parts : []).filter(
                        (p: any) => p?.isActive !== false && !p?.rejectedAt,
                    );
                }
            } catch (e) {
                console.error(e);
            }
        }

        // ✅ 3) 仍为空：不阻断弹窗，但 progresses 至少给一个空数组（避免 form 结构异常）
        //    你若希望这里直接 message.error 并 return，我也可以按你口径改成强约束。
        const safePs = Array.isArray(ps) ? ps : [];

        finishForm.setFieldsValue({
            remark: '',
            deductMinutesOption: undefined,
            deductMinutesCustom: undefined, // ✅ 自定义扣时分钟
            totalProgressWan: 0,

            // ✅ 关键：小时单也要带 progresses（结构跟保底单一致）
            progresses: safePs.map((p: any) => ({
                userId: Number(p.userId),
                progressBaseWan: 0,
            })),
        });

        // 保底单结单：回显剩余保底（不允许输入）
        if (isGuaranteed(row) && mode === 'COMPLETE') {
            try {
                const orderId = Number(row?.order?.id ?? row?.orderId);
                if (orderId) {
                    const detail = await getOrderDetail(orderId);
                    const base = Number(detail?.baseAmountWan ?? 0);
                    const dispatches = Array.isArray(detail?.dispatches) ? detail.dispatches : [];
                    let archivedProgress = 0;
                    for (const d of dispatches) {
                        if (String(d?.status) !== 'ARCHIVED') continue;
                        const parts = Array.isArray(d?.participants) ? d.participants : [];
                        for (const p of parts) archivedProgress += Number(p?.progressBaseWan ?? 0);
                    }
                    const remaining = Number.isFinite(base) ? Math.max(0, base - archivedProgress) : 0;
                    setGuaranteedCompleteRemainingWan(remaining);
                    finishForm.setFieldsValue({ totalProgressWan: remaining });
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            setGuaranteedCompleteRemainingWan(null);
        }

        setTick(Date.now());
        setFinishOpen(true);
    };
    // --- 确认存单/结单 ---
    // --- 确认存单/结单 ---
    const submitFinish = async () => {
        // ✅ 抽一个内部执行函数：可被“确认框 onOk”复用
        const runSubmit = async (modeToRun: 'ARCHIVE' | 'COMPLETE', values: any) => {
            if (!poolDispatch?.id) return;

            setFinishSubmitting(true);
            try {
                const ps = participantsActive(poolDispatch);
                const count = ps.length || 1;

                // ✅ 不依赖 validateFields 的返回，直接读 form store
                let progresses = finishForm.getFieldValue('progresses');
                if (!Array.isArray(progresses) || progresses.length === 0) {
                    progresses = ps.map((p: any) => ({ userId: Number(p.userId), progressBaseWan: 0 }));
                }

                // 保底单存单：只填总数，均分
                if (isGuaranteed(poolDispatch) && modeToRun === 'ARCHIVE') {
                    const total = Number(values.totalProgressWan);
                    if (!Number.isFinite(total)) {
                        message.error('存单请填写保底进度');
                        return;
                    }
                    const each = total / count;
                    progresses = ps.map((p: any) => ({ userId: Number(p.userId), progressBaseWan: each }));
                }

                // 保底单结单：不传 progresses（后端兜底补齐）
                if (isGuaranteed(poolDispatch) && modeToRun === 'COMPLETE') {
                    progresses = undefined;
                }

                const payload: any = {
                    remark: values.remark || undefined,
                    progresses: progresses || undefined,
                };

                // ✅ Step2.5：小时单——按新字段格式传参（保持你现有逻辑）
                if (poolDispatch && isHourly(poolDispatch)) {
                    const opt = String(values.deductMinutesOption || ''); // M10/M20.../CUSTOM/ALL/''

                    // 1) 计算总进行分钟（提交瞬间实时 now）
                    const startAt = getHourlyStartAt(poolDispatch);
                    const totalMinutes = Math.max(0, dayjs().diff(startAt, 'minute'));

                    // 2) 解析扣除分钟
                    let deductMinutesValue = 0;

                    if (/^M\d+$/.test(opt)) {
                        deductMinutesValue = Number(opt.slice(1)) || 0;
                    } else if (opt === 'CUSTOM') {
                        deductMinutesValue = Math.max(0, Math.floor(Number(values.deductMinutesCustom || 0)));
                    } else if (opt === 'ALL') {
                        deductMinutesValue = totalMinutes; // 全免：扣到 0
                    } else {
                        deductMinutesValue = 0;
                    }

                    // 3) 裁剪：扣除不能超过总分钟
                    deductMinutesValue = Math.max(0, Math.min(totalMinutes, Math.floor(deductMinutesValue)));

                    // 4) 扣除后有效分钟
                    const billableMinutes = Math.max(0, totalMinutes - deductMinutesValue);

                    // 5) 折算计费小时（按你的规则；全免允许 0；非全免最低 0.5）
                    const calcBillableHours = (mins: number) => {
                        const m = Math.max(0, Math.floor(Number(mins || 0)));
                        if (m === 0) return 0;

                        const baseHours = Math.floor(m / 60);
                        const rem = m % 60;

                        let add = 0;
                        if (rem >= 18 && rem <= 45) add = 0.5;
                        else if (rem > 45) add = 1;

                        let h = baseHours + add;
                        if (h < 0.5) h = 0.5;
                        return h;
                    };

                    const billableHours = calcBillableHours(billableMinutes);

                    let deductMinutesEnum: any = undefined;
                    if (/^M(10|20|30|40|50|60)$/.test(opt)) {
                        deductMinutesEnum = opt; // 例如 'M10'
                    } else {
                        deductMinutesEnum = undefined;
                    }

                    payload.deductMinutes = deductMinutesEnum;
                    payload.deductMinutesValue = deductMinutesValue;
                    payload.billableMinutes = billableMinutes;
                    payload.billableHours = billableHours;

                    // 小时单你这里希望后端一定有 progresses：保持你原逻辑
                    payload.progresses = progresses;
                }

                if (modeToRun === 'ARCHIVE') {
                    await archiveDispatch(Number(poolDispatch.id), payload);
                    message.success('已存单');
                } else {
                    await completeDispatch(Number(poolDispatch.id), payload);
                    message.success('已结单');
                }

                setFinishOpen(false);

                // ✅ 关键：结单/存单后，立刻回到等待接单
                syncWorkStatusAfterFinish('IDLE');

                setPoolDispatch(null);
                setPoolMode('WAITING');

                void refreshPool();
                void refreshStats();
            } finally {
                setFinishSubmitting(false);
            }
        };

        try {
            const values = await finishForm.validateFields();
            if (!poolDispatch?.id) return;

            // ✅ Step3：保底单 + 存单：输入进度 >= 剩余保底 → 确认后直接结单
            if (isGuaranteed(poolDispatch) && finishMode === 'ARCHIVE') {
                const total = Number(values.totalProgressWan);
                if (!Number.isFinite(total)) {
                    message.error('存单请填写保底进度');
                    return;
                }

                // 计算“剩余保底”（提交时兜底计算一次，避免依赖 openFinish 的 state）
                let remaining = 0;
                try {
                    const orderId = Number(poolDispatch?.order?.id ?? poolDispatch?.orderId);
                    if (orderId) {
                        const detail = await getOrderDetail(orderId);
                        const base = Number(detail?.baseAmountWan ?? 0);
                        const dispatches = Array.isArray(detail?.dispatches) ? detail.dispatches : [];
                        let archivedProgress = 0;
                        for (const d of dispatches) {
                            if (String(d?.status) !== 'ARCHIVED') continue;
                            const parts = Array.isArray(d?.participants) ? d.participants : [];
                            for (const p of parts) archivedProgress += Number(p?.progressBaseWan ?? 0);
                        }
                        remaining = Number.isFinite(base) ? Math.max(0, base - archivedProgress) : 0;
                    }
                } catch (e) {
                    // 拉详情失败时：不强行拦截（按你“先跑通”原则），直接走存单
                    remaining = 0;
                }

                if (total >= remaining && remaining > 0) {
                    Modal.confirm({
                        title: '进度已达到/超出剩余保底',
                        content:
                            `你录入的进度为 ${total} 万，已 ≥ 当前剩余保底 ${remaining} 万。\n` +
                            `若继续，将直接结单（无法存单），并走结单逻辑与接口。\n` +
                            `确认继续吗？`,
                        okText: '确认结单',
                        cancelText: '返回修改',
                        onOk: async () => {
                            // ✅ 走结单接口（保底结单口径：不传 progresses，后端兜底补齐）
                            await runSubmit('COMPLETE', values);
                        },
                    });
                    return; // ✅ 弹框后结束本次 submitFinish
                }
            }

            // 默认：按当前 finishMode 正常提交
            await runSubmit(finishMode, values);
        } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || (finishMode === 'ARCHIVE' ? '存单失败' : '结单失败'));
            setFinishSubmitting(false);
        }
    };



    const statusMeta = useMemo(() => {
        const key = workStatus;
        const text = t('PlayerWorkStatus', key, key);
        const color = key === 'IDLE' ? 'blue' : key === 'WORKING' ? 'green' : 'default';
        return {text, color};
    }, [dicts, workStatus]);

    const renderStatusCard = () => {
        const isWorking = workStatus === 'WORKING';
        const isIdle = workStatus === 'IDLE';
        const isResting = workStatus === 'RESTING';

        const bg =
            isWorking
                ? 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(16,185,129,0.10))'
                : isIdle
                ? 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(37,99,235,0.10))'
                : 'linear-gradient(135deg, rgba(148,163,184,0.18), rgba(100,116,139,0.10))';

        const border =
            isWorking ? 'rgba(34,197,94,0.35)'
                : isIdle ? 'rgba(59,130,246,0.35)'
                : 'rgba(148,163,184,0.35)';

        return (
            <Card
                title="当前接单状态"
                style={{
                    background: bg,
                    border: `1px solid ${border}`,
                }}
                bodyStyle={{padding: isMobile ? 14 : 16}}
            >
                <Space direction="vertical" style={{width: '100%'}} size={10}>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
                        <div style={{fontSize: isMobile ? 13 : 14, color: 'rgba(0,0,0,0.65)'}}>状态</div>
                        <Tag
                            color={statusMeta.color as any}
                            style={{
                                fontSize: isMobile ? 14 : 16,
                                padding: isMobile ? '6px 12px' : '8px 14px',
                                borderRadius: 999,
                                fontWeight: 700,
                                letterSpacing: 0.5,
                            }}
                        >
                            {statusMeta.text}
                        </Tag>
                    </div>

                    <Space wrap>
                        <Button
                            type="primary"
                            disabled={isWorking || isIdle}
                            onClick={() => updateMyWorkStatus('IDLE')}
                        >
                            开始接单
                        </Button>

                        <Button
                            disabled={isWorking || isResting}
                            onClick={() => updateMyWorkStatus('RESTING')}
                        >
                            休息一下
                        </Button>

                        <Button onClick={() => refreshPool()} loading={poolLoading}>
                            刷新订单池
                        </Button>
                    </Space>

                    <div style={{color: 'rgba(0,0,0,.55)', fontSize: 12, lineHeight: 1.6}}>
                        等待中会接收派单；接单中不会被再次派单；休息中不会接收新派单。
                    </div>
                </Space>
            </Card>
        );
    };

    const renderPoolCard = () => {
        const extraBtns = (
            <Button onClick={() => refreshPool()} loading={poolLoading}>
                刷新
            </Button>
        );

        // 休息中
        if (workStatus === 'RESTING') {
            return (
                <Card title="订单池" extra={extraBtns} bodyStyle={{padding: isMobile ? 14 : 16}}>
                    <div style={{color: 'rgba(0,0,0,.55)'}}>当前为休息中，不会接收新派单。</div>
                    <div style={{marginTop: 12}}>
                        <Button type="primary" onClick={() => updateMyWorkStatus('IDLE')}>
                            开始接单
                        </Button>
                    </div>
                </Card>
            );
        }

        // 空态
        if (!poolDispatch) {
            return (
                <Card
                    title={workStatus === 'WORKING' ? '订单池（进行中）' : '订单池（待接单）'}
                    extra={extraBtns}
                    bodyStyle={{padding: isMobile ? 14 : 16}}
                >
                    <div style={{color: 'rgba(0,0,0,.55)'}}>暂未派单。</div>
                    <div style={{marginTop: 12}}>
                        <Button onClick={() => updateMyWorkStatus('RESTING')}>休息一下</Button>
                    </div>
                </Card>
            );
        }

        const order = poolDispatch?.order || {};
        const projectName = order?.project?.name || order?.projectSnapshot?.name || '-';
        const orderNo = String(order?.autoSerial ?? order?.id ?? '-');
        const assignedAt = poolDispatch?.assignedAt ? dayjs(poolDispatch.assignedAt).format('YYYY-MM-DD HH:mm') : '-';
        const dispatcherText = order?.dispatcher
            ? `${order?.dispatcher?.name || '-'}（${order?.dispatcher?.phone || '-'}）`
            : '-';

        const ps = participantsActive(poolDispatch);
        const playerNames =
            ps.length > 0
                ? ps
                    .map((p: any) => p?.user?.name || p?.user?.nickname || p?.user?.phone || p?.userId)
                    .filter(Boolean)
                    .join('、')
                : '-';

        // 是否已经接单（自己）
        const isAccept =
            ps.length > 0 && ps.some((p: any) => currentUser?.id === p?.userId && !!p?.acceptedAt);

        // 待接单
        if (workStatus === 'IDLE') {
            return (
                <Card title="订单池（待接单）" extra={extraBtns} bodyStyle={{padding: isMobile ? 14 : 16}}>
                    <Descriptions size="small" column={isMobile ? 1 : 2} bordered>
                        <Descriptions.Item label="订单号">{orderNo}</Descriptions.Item>
                        <Descriptions.Item label="项目">{projectName}</Descriptions.Item>
                        <Descriptions.Item label="派单时间">{assignedAt}</Descriptions.Item>
                        <Descriptions.Item label="派单客服">{dispatcherText}</Descriptions.Item>
                        <Descriptions.Item label="参与者（本轮）" span={isMobile ? 1 : 2}>
                            {playerNames}
                        </Descriptions.Item>
                    </Descriptions>

                    <Divider style={{margin: '12px 0'}}/>

                    {isAccept ? (
                        <Space direction={isMobile ? 'vertical' : 'horizontal'}
                               style={{width: isMobile ? '100%' : 'auto'}}>
                            <div>您已接单，请等待所有打手均确认接单。</div>
                            <Button onClick={() => refreshPool()} loading={poolLoading}>
                                立即刷新
                            </Button>
                        </Space>
                    ) : (
                        <Space wrap>
                            <Button type="primary" onClick={submitAccept} loading={poolLoading}>
                                接单
                            </Button>
                            {/*<Button danger onClick={openReject}>*/}
                            {/*    拒单*/}
                            {/*</Button>*/}
                        </Space>
                    )}

                    <Divider style={{margin: '12px 0'}}/>
                    <div style={{color: 'rgba(0,0,0,.55)', fontSize: 12, lineHeight: 1.7}}>
                        <div>接单前不展示敏感信息。</div>
                        <div>拒单需填写原因，拒单后将自动进入休息中。</div>
                    </div>
                </Card>
            );
        }

        // 进行中
        const customerId = order?.customerGameId || '-';
        const wmText =
            `${currentUser?.name ?? ''} ${currentUser?.username || currentUser?.phone || ''}`.trim() || 'BlueCat';
        const extra = buildAcceptedExtraInfo(poolDispatch);

        return (
            <Card title="订单池（进行中）" extra={extraBtns} bodyStyle={{padding: isMobile ? 14 : 16}}>
                <Watermark
                    content={wmText}
                    gap={[110, 88]}
                    font={{fontSize: 14, color: 'rgba(0,0,0,0.10)'}}
                    zIndex={9}
                >
                    <Descriptions size="small" column={isMobile ? 1 : 2} bordered>
                        <Descriptions.Item label="订单号">{orderNo}</Descriptions.Item>
                        <Descriptions.Item label="项目">{projectName}</Descriptions.Item>
                        <Descriptions.Item label="派单时间">{assignedAt}</Descriptions.Item>
                        <Descriptions.Item label="派单客服">{dispatcherText}</Descriptions.Item>

                        <Descriptions.Item label="客户ID（可复制）" span={isMobile ? 1 : 2}>
                            <Space wrap>
                                <Tag color="red">{String(customerId)}</Tag>
                                <Button
                                    size="small"
                                    onClick={() => navigator?.clipboard?.writeText?.(String(customerId))}
                                >
                                    复制
                                </Button>
                            </Space>
                        </Descriptions.Item>

                        {extra.isGuaranteed ? (
                            <>
                                <Descriptions.Item label="订单类型">保底单</Descriptions.Item>
                                <Descriptions.Item label="剩余保底">
                                    <Tag
                                        color="gold">{extra.remainingWan == null ? '-' : `${extra.remainingWan.toFixed(2)} 万`}</Tag>
                                </Descriptions.Item>
                            </>
                        ) : null}

                        {extra.isHourly ? (
                            <>
                                <Descriptions.Item label="订单类型">小时单</Descriptions.Item>
                                <Descriptions.Item label="预计小时">
                                    <Tag
                                        color="blue">{extra.estHours == null ? '-' : `${extra.estHours.toFixed(2)} 小时`}</Tag>
                                </Descriptions.Item>
                                <Descriptions.Item label="预计结单时间" span={isMobile ? 1 : 2}>
                                    <Tag color="geekblue">{extra.estEnd ?? '-'}</Tag>
                                    {!isMobile ? (
                                        <span style={{marginLeft: 8, color: 'rgba(0,0,0,.45)', fontSize: 12}}>
                      （按实付/单价估算 + 20 分钟缓冲）
                    </span>
                                    ) : null}
                                </Descriptions.Item>
                            </>
                        ) : null}

                        <Descriptions.Item label="参与者（本轮）" span={isMobile ? 1 : 2}>
                            {playerNames}
                        </Descriptions.Item>
                    </Descriptions>

                    <Divider style={{margin: '12px 0'}}/>

                    <Space wrap style={{width: '100%'}}>
                        <Button onClick={() => openFinish(poolDispatch, 'ARCHIVE')}>存单</Button>
                        <Button type="primary" onClick={() => openFinish(poolDispatch, 'COMPLETE')}>
                            结单
                        </Button>
                    </Space>

                    <Divider style={{margin: '12px 0'}}/>
                    <div style={{color: 'rgba(0,0,0,.55)', fontSize: 12, lineHeight: 1.7}}>
                        <div>敏感信息仅接单后可见，禁止截图外传。</div>
                        <div>存单：记录本轮保底进度；结单：触发结算。</div>
                    </div>
                </Watermark>
            </Card>
        );
    };

    return (
        <PageContainer title="打手工作台" loading={false}>
            {/* ✅ 移动端：收窄边距，避免两侧过宽 */}
            <div className="bc-workbench-wrap">
                <div
                    style={{
                        width: '100%',
                        maxWidth: isMobile ? '100%' : 1200,
                        margin: '0 auto',
                        padding: isMobile ? '0' : 0,
                    }}
                >
                    {/* 顶部看板 */}
                    <Row gutter={[12, 12]}>
                        <Col xs={12} md={12} lg={6}>
                            <Card loading={statsLoading} bodyStyle={{padding: isMobile ? 12 : 16}}>
                                <Statistic title="今日接单" value={todayCount}/>
                            </Card>
                        </Col>
                        <Col xs={12} md={12} lg={6}>
                            <Card loading={statsLoading} bodyStyle={{padding: isMobile ? 12 : 16}}>
                                <Statistic title="今日收入" value={todayIncome} precision={2} prefix="¥"/>
                            </Card>
                        </Col>
                        <Col xs={12} md={12} lg={6}>
                            <Card loading={statsLoading} bodyStyle={{padding: isMobile ? 12 : 16}}>
                                <Statistic title="本月接单" value={monthCount}/>
                            </Card>
                        </Col>
                        <Col xs={12} md={12} lg={6}>
                            <Card loading={statsLoading} bodyStyle={{padding: isMobile ? 12 : 16}}>
                                <Statistic title="本月收入" value={monthIncome} precision={2} prefix="¥"/>
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={[12, 12]} style={{marginTop: 12}}>
                        <Col xs={24} lg={8}>
                            {renderStatusCard()}
                        </Col>

                        <Col xs={24} lg={16}>
                            {renderPoolCard()}
                        </Col>
                    </Row>

                    {/* 拒单 */}
                    <Modal
                        open={rejectOpen}
                        title="拒单"
                        onCancel={() => setRejectOpen(false)}
                        onOk={submitReject}
                        confirmLoading={rejectSubmitting}
                        destroyOnClose
                    >
                        <Form form={rejectForm} layout="vertical">
                            <Form.Item
                                name="reason"
                                label="拒单原因"
                                rules={[
                                    {required: true, message: '请填写拒单原因'},
                                    {max: 200, message: '最多 200 字'},
                                ]}
                            >
                                <Input.TextArea rows={4} placeholder="例如：临时有事 / 设备异常 / 正在打单"/>
                            </Form.Item>
                        </Form>
                        <div style={{marginTop: 8, color: 'rgba(0,0,0,.45)', fontSize: 12}}>
                            拒单后将自动切换为“休息中”。
                        </div>
                    </Modal>

                    {/* 存单/结单 */}
                    <Modal
                        open={finishOpen}
                        title={finishMode === 'ARCHIVE' ? '存单' : '结单'}
                        onCancel={() => setFinishOpen(false)}
                        onOk={submitFinish}
                        confirmLoading={finishSubmitting}
                        destroyOnClose
                        width={isMobile ? '96vw' : 720}x
                    >
                        <Form form={finishForm} layout="vertical">
                            {poolDispatch && isHourly(poolDispatch) ? (
                                <>
                                    <Divider style={{ marginTop: 0 }}>小时单</Divider>

                                    {(() => {
                                        const startAt = getHourlyStartAt(poolDispatch);
                                        const nowAt = dayjs(tick);
                                        const diffMinutesRaw = nowAt.diff(startAt, 'minute');
                                        const { diffMinutes, hours } = calcHourlyChargeHours(diffMinutesRaw);

                                        // ✅ Step2：解析扣时分钟（支持 M10/M20...、CUSTOM、ALL）
                                        const opt = String(watchedDeductMinutesOption || '');
                                        let deductMinutes = 0;

                                        if (/^M\d+$/.test(opt)) {
                                            deductMinutes = Number(opt.slice(1)) || 0;
                                        } else if (opt === 'CUSTOM') {
                                            deductMinutes = Number(watchedDeductMinutesCustom || 0) || 0;
                                        } else if (opt === 'ALL') {
                                            deductMinutes = diffMinutes; // 全免：直接扣到 0
                                        }

                                        // 扣时不能超过已进行分钟
                                        deductMinutes = Math.max(0, Math.min(diffMinutes, Math.floor(deductMinutes)));

                                        const afterMinutes = Math.max(0, diffMinutes - deductMinutes);

                                        // ✅ 关键：允许全免为 0 小时；否则最低 0.5 小时
                                        let afterHours = 0;
                                        if (afterMinutes > 0) {
                                            afterHours = calcHourlyChargeHours(afterMinutes).hours; // 内部已做最低 0.5
                                        }

                                        return (
                                            <div style={{ marginBottom: 10, lineHeight: 1.9 }}>
                                                <div style={{ color: 'rgba(0,0,0,.45)' }}>
                                                    接单时间：<Tag>{startAt.format('YYYY-MM-DD HH:mm')}</Tag>
                                                </div>

                                                <div style={{ color: 'rgba(0,0,0,.45)' }}>
                                                    当前时间：<Tag>{nowAt.format('YYYY-MM-DD HH:mm')}</Tag>
                                                </div>

                                                <div style={{ marginTop: 6 }}>
                                                    <Tag color="gold">已进行</Tag>
                                                    <span style={{ fontWeight: 700 }}>{diffMinutes}</span> 分钟
                                                    <span style={{ marginLeft: 10 }} />
                                                    <Tag color="blue">计费时长</Tag>
                                                    <span style={{ fontWeight: 800, fontSize: 16 }}>{hours}</span> 小时
                                                </div>

                                                <div style={{ marginTop: 6 }}>
                                                    <Tag color="red">本次减免</Tag>
                                                    <span style={{ fontWeight: 700 }}>{deductMinutes}</span> 分钟
                                                    <span style={{ marginLeft: 10 }} />

                                                    <Tag color="green">减免后</Tag>
                                                    <span style={{ fontWeight: 800, fontSize: 16 }}>{afterHours}</span> 小时
                                                    <span style={{ color: 'rgba(0,0,0,.45)', marginLeft: 6 }}>/ {afterMinutes} 分钟</span>
                                                </div>

                                                <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
                                                    规则：0-18分钟不计算；18-45分钟计0.5小时；&gt;45分钟以上计1小时；非全免时最低计时 0.5小时
                                                </div>
                                            </div>
                                        );

                                    })()}

                                    <Form.Item name="deductMinutesOption" label="减免选项（可选）">
                                        <Select
                                            allowClear
                                            placeholder="选择减免时长（或全免/自定义）"
                                            options={[
                                                { label: '不扣时', value: undefined as any }, // allowClear 也可
                                                { label: '减免 10 分钟', value: 'M10' },
                                                { label: '减免 20 分钟', value: 'M20' },
                                                { label: '减免 30 分钟', value: 'M30' },
                                                { label: '减免 60 分钟', value: 'M60' },
                                                { label: '全免（扣到 0）', value: 'ALL' },
                                                { label: '手动输入分钟数', value: 'CUSTOM' },
                                            ]}
                                        />
                                    </Form.Item>

                                    {String(watchedDeductMinutesOption || '') === 'CUSTOM' ? (
                                        <Form.Item
                                            name="deductMinutesCustom"
                                            label="自定义减免时长(分钟)"
                                            rules={[
                                                { required: true, message: '请输入自定义减免分钟' },
                                            ]}
                                        >
                                            <InputNumber style={{ width: '100%' }} min={0} step={1} placeholder="例如：90" />
                                        </Form.Item>
                                    ) : null}
                                </>
                            ) : null}


                            {poolDispatch && isGuaranteed(poolDispatch) ? (
                                <>
                                    <Divider style={{marginTop: 0}}>保底单</Divider>

                                    {finishMode === 'COMPLETE' ? (
                                        <Card size="small" style={{marginBottom: 12}}>
                                            <div style={{color: 'rgba(0,0,0,.45)', fontSize: 12}}>
                                                本轮结单将按剩余保底兜底补齐（后端口径）。当前剩余：
                                            </div>
                                            <div style={{fontSize: 18, fontWeight: 600}}>
                                                {guaranteedCompleteRemainingWan == null ? '-' : guaranteedCompleteRemainingWan} 万
                                            </div>
                                        </Card>
                                    ) : (
                                        <Form.Item
                                            name="totalProgressWan"
                                            label="本轮总保底进度(万)"
                                            rules={[{required: true, message: '请填写本轮总保底进度'}]}
                                        >
                                            <InputNumber style={{width: '100%'}}/>
                                        </Form.Item>
                                    )}

                                    {finishMode === 'ARCHIVE' ? (
                                        <div style={{color: 'rgba(0,0,0,.45)', fontSize: 12, marginTop: -6}}>
                                            系统会按参与者人数均分：当前每人约{' '}
                                            {(Number(watchedTotalProgressWan || 0) / (participantsActive(poolDispatch).length || 1)).toFixed(2)} 万
                                        </div>
                                    ) : null}
                                </>
                            ) : null}

                            <Form.Item name="remark" label="备注（可选）">
                                <Input.TextArea rows={3} placeholder="异常说明/备注"/>
                            </Form.Item>
                        </Form>
                    </Modal>
                </div>
            </div>
        </PageContainer>
    );
};

export default WorkbenchPage;
