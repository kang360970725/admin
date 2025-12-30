import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    Row,
    Space,
    Statistic,
    Tag,
    Watermark,
} from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import dayjs from 'dayjs';
import {
    acceptDispatch,
    archiveDispatch,
    completeDispatch,
    dispatchRejectOrder,
    getEnumDicts,
    getMyDispatches,
    getOrderDetail, ordersMyStats, usersWorkStatus,
} from '@/services/api';
import { pickStatusColor, pickStatusText } from '@/constants/status';

type DictMap = Record<string, Record<string, string>>;

const WorkbenchPage: React.FC = () => {
    const { initialState, setInitialState, refresh } = useModel('@@initialState');
    const currentUser = initialState?.currentUser;

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

        const orderTime = order?.orderTime
            ? dayjs(order.orderTime)
            : dayjs(order?.createdAt || new Date());

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

        return { billingMode, isHourly, isGuaranteed, estHours, estEnd, remainingWan };
    };


    // 估算：从 dispatch.settlements 里取本人的 finalEarnings（若不存在就返回 0）
    const calcMyIncomeFromDispatch = (d: any) => {
        const uid = Number(currentUser?.id);
        const ss = Array.isArray(d?.settlements) ? d.settlements : [];
        if (!uid || ss.length === 0) return 0;
        return ss
            .filter((s: any) => Number(s?.userId) === uid)
            .reduce((sum: number, s: any) => sum + Number(s?.finalEarnings ?? 0), 0);
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
            return { ...row, order: detail };
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
                const res: any = await getMyDispatches({ page: 1, limit: 10, status });
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
                        currentUser: { ...(s?.currentUser || {}), workStatus: 'IDLE' },
                    }));
                    setPoolMode('WAITING');
                    setPoolDispatch(await hydrateDispatchWithOrder(first));
                    return;
                }

                setPoolDispatch(null);
                return;
            }

            // ✅ 默认 IDLE：优先待接，否则兜底进行中并纠正状态（解决你说的“已接单但待接为空”）
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
                    currentUser: { ...(s?.currentUser || {}), workStatus: 'WORKING' },
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
            await usersWorkStatus({ workStatus: next });

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

            // ❌ 不再 refreshPool/refreshStats，不刷新整个页面
            // （如果你后续想“只刷新订单池”，我再单独给你一个按钮触发 refreshPool）
        } catch (e: any) {
            message.error(e?.response?.data?.message || '更新状态失败');

            // 可选：失败时从服务端拉一次最新用户状态兜底（只刷新状态模块）
            // await refresh?.();
            // updateMyWorkStatus(String(initialState?.currentUser?.workStatus || 'IDLE'));
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
            await dispatchRejectOrder({ dispatchId: Number(poolDispatch.id), reason: String(v.reason || '').trim() });

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
                currentUser: { ...(s?.currentUser || {}), workStatus: 'WORKING' },
            }));

            // ✅ 删掉这里的 refreshPool（避免读旧状态）
            void refreshStats();
        } catch (e: any) {
            message.error(e?.response?.data?.message || '接单失败');
        }
    };


    // --- 存单/结单（沿用你现有逻辑，只是从“订单池”入口打开） ---
    const openFinish = async (row: any, mode: 'ARCHIVE' | 'COMPLETE') => {
        await loadDictsOnce();
        setFinishMode(mode);

        const ps = participantsActive(row);
        finishForm.setFieldsValue({
            remark: '',
            deductMinutesOption: undefined,
            totalProgressWan: 0,
            progresses: ps.map((p: any) => ({ userId: Number(p.userId), progressBaseWan: 0 })),
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

    const submitFinish = async () => {
        try {
            const values = await finishForm.validateFields();
            if (!poolDispatch?.id) return;

            setFinishSubmitting(true);
            const ps = participantsActive(poolDispatch);
            const count = ps.length || 1;

            let progresses = values.progresses;

            // 保底单存单：只填总数，均分
            if (isGuaranteed(poolDispatch) && finishMode === 'ARCHIVE') {
                const total = Number(values.totalProgressWan);
                if (!Number.isFinite(total)) {
                    message.error('存单请填写保底进度');
                    return;
                }
                const each = total / count;
                progresses = ps.map((p: any) => ({ userId: Number(p.userId), progressBaseWan: each }));
            }

            // 保底单结单：不传 progresses（后端兜底补齐）
            if (isGuaranteed(poolDispatch) && finishMode === 'COMPLETE') {
                progresses = undefined;
            }

            const payload: any = {
                remark: values.remark || undefined,
                deductMinutesOption: values.deductMinutesOption || undefined,
                progresses: progresses || undefined,
            };

            if (finishMode === 'ARCHIVE') {
                await archiveDispatch(Number(poolDispatch.id), payload);
                message.success('已存单');
            } else {
                await completeDispatch(Number(poolDispatch.id), payload);
                message.success('已结单');
            }

            setFinishOpen(false);
            void refreshPool();
            void refreshStats();
        } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || (finishMode === 'ARCHIVE' ? '存单失败' : '结单失败'));
        } finally {
            setFinishSubmitting(false);
        }
    };

    const statusMeta = useMemo(() => {
        const key = workStatus;
        const text = t('PlayerWorkStatus', key, key);
        const color = key === 'IDLE' ? 'blue' : key === 'WORKING' ? 'green' : 'default';
        return { text, color };
    }, [dicts, workStatus]);
    const renderPoolCard = () => {
        const extraBtns = (
            <Button onClick={() => refreshPool()} loading={poolLoading}>
                刷新
            </Button>
        );

        // 休息中
        if (workStatus === 'RESTING') {
            return (
                <Card title="订单池" extra={extraBtns}>
                    <div style={{ color: 'rgba(0,0,0,.45)' }}>
                        当前为休息中，不会接收新派单。
                    </div>
                    <div style={{ marginTop: 12 }}>
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
                <Card title={workStatus === 'WORKING' ? '订单池（进行中）' : '订单池（待接单）'} extra={extraBtns}>
                    <div style={{ color: 'rgba(0,0,0,.45)' }}>
                        暂未派单。
                    </div>
                    <div style={{ marginTop: 12 }}>
                        {workStatus === 'WORKING' ? (
                            <Button onClick={() => updateMyWorkStatus('RESTING')}>休息一下</Button>
                        ) : (
                            <Button onClick={() => updateMyWorkStatus('RESTING')}>休息一下</Button>
                        )}
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
        //是否已经接单
        const isAccept = ps.length > 0
            && ps.some((p: any) =>  currentUser?.id === p?.userId && !!p?.acceptedAt)

        // 待接单（等待中）
        if (workStatus === 'IDLE') {
            return (
                <Card title="订单池（待接单）" extra={extraBtns}>
                    <Descriptions size="small" column={2} bordered>
                        <Descriptions.Item label="订单号">{orderNo}</Descriptions.Item>
                        <Descriptions.Item label="项目">{projectName}</Descriptions.Item>
                        <Descriptions.Item label="派单时间">{assignedAt}</Descriptions.Item>
                        <Descriptions.Item label="派单客服">{dispatcherText}</Descriptions.Item>
                        <Descriptions.Item label="参与者（本轮）" span={2}>
                            {playerNames}
                        </Descriptions.Item>
                    </Descriptions>

                    <Divider style={{ margin: '12px 0' }} />

                    {isAccept ? <Space>
                        <div>您已接单，请等待所有打手均确认接单。</div>
                        <Button onClick={() => refreshPool()} loading={poolLoading}>
                            立即刷新
                        </Button>
                    </Space> : <Space>
                        <Button type="primary" onClick={submitAccept} loading={poolLoading}>
                            接单
                        </Button>
                        <Button danger onClick={openReject}>
                            拒单
                        </Button>
                    </Space>}

                    <Divider style={{ margin: '12px 0' }} />
                    <div style={{ color: 'rgba(0,0,0,.45)', fontSize: 12, lineHeight: 1.7 }}>
                        <div>接单前不展示敏感信息。</div>
                        <div>拒单需填写原因，拒单后将自动进入休息中。</div>
                    </div>
                </Card>
            );
        }

        // 进行中（接单中）：把旧接单弹窗内容整合到此处，并展示存单/结单
        const customerId = order?.customerGameId || '-';
        const wmText = `${currentUser?.name ?? ''} ${currentUser?.username || currentUser?.phone || ''}`.trim() || 'BlueCat';
        const extra = buildAcceptedExtraInfo(poolDispatch);

        return (
            <Card title="订单池（进行中）" extra={extraBtns}>
                <Watermark
                    content={wmText}
                    gap={[110, 88]}
                    font={{ fontSize: 14, color: 'rgba(0,0,0,0.10)' }}
                    zIndex={9}
                >
                    <Descriptions size="small" column={2} bordered>
                        <Descriptions.Item label="订单号">{orderNo}</Descriptions.Item>
                        <Descriptions.Item label="项目">{projectName}</Descriptions.Item>
                        <Descriptions.Item label="派单时间">{assignedAt}</Descriptions.Item>
                        <Descriptions.Item label="派单客服">{dispatcherText}</Descriptions.Item>

                        <Descriptions.Item label="客户ID（可复制）" span={2}>
                            <Space>
                                <Tag color="red">{String(customerId)}</Tag>
                                <Button size="small" onClick={() => navigator?.clipboard?.writeText?.(String(customerId))}>
                                    复制
                                </Button>
                            </Space>
                        </Descriptions.Item>

                        {extra.isGuaranteed ? (
                            <>
                                <Descriptions.Item label="订单类型">保底单</Descriptions.Item>
                                <Descriptions.Item label="剩余保底">
                                    <Tag color="gold">{extra.remainingWan == null ? '-' : `${extra.remainingWan.toFixed(2)} 万`}</Tag>
                                </Descriptions.Item>
                            </>
                        ) : null}

                        {extra.isHourly ? (
                            <>
                                <Descriptions.Item label="订单类型">小时单</Descriptions.Item>
                                <Descriptions.Item label="预计小时">
                                    <Tag color="blue">{extra.estHours == null ? '-' : `${extra.estHours.toFixed(2)} 小时`}</Tag>
                                </Descriptions.Item>
                                <Descriptions.Item label="预计结单时间" span={2}>
                                    <Tag color="geekblue">{extra.estEnd ?? '-'}</Tag>
                                    <span style={{ marginLeft: 8, color: 'rgba(0,0,0,.45)', fontSize: 12 }}>
                  （按实付/单价估算 + 20 分钟缓冲）
                </span>
                                </Descriptions.Item>
                            </>
                        ) : null}

                        <Descriptions.Item label="参与者（本轮）" span={2}>
                            {playerNames}
                        </Descriptions.Item>
                    </Descriptions>

                    <Divider style={{ margin: '12px 0' }} />

                    <Space>
                        <Button onClick={() => openFinish(poolDispatch, 'ARCHIVE')}>存单</Button>
                        <Button type="primary" onClick={() => openFinish(poolDispatch, 'COMPLETE')}>结单</Button>
                    </Space>

                    <Divider style={{ margin: '12px 0' }} />
                    <div style={{ color: 'rgba(0,0,0,.45)', fontSize: 12, lineHeight: 1.7 }}>
                        <div>敏感信息仅接单后可见，禁止截图外传。</div>
                        <div>存单：记录本轮保底进度；结单：触发结算。</div>
                    </div>
                </Watermark>
            </Card>
        );
    };


    return (
        <PageContainer title="打手工作台" loading={false}>
            {/* 顶部看板 */}
            <Row gutter={[12, 12]}>
                <Col xs={24} md={12} lg={6}>
                    <Card loading={statsLoading}>
                        <Statistic title="今日接单" value={todayCount} />
                    </Card>
                </Col>
                <Col xs={24} md={12} lg={6}>
                    <Card loading={statsLoading}>
                        <Statistic title="今日收入" value={todayIncome} precision={2} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} md={12} lg={6}>
                    <Card loading={statsLoading}>
                        <Statistic title="本月累计接单" value={monthCount} />
                    </Card>
                </Col>
                <Col xs={24} md={12} lg={6}>
                    <Card loading={statsLoading}>
                        <Statistic title="本月累计收入" value={monthIncome} precision={2} prefix="¥" />
                    </Card>
                </Col>
            </Row>

            <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                <Col xs={24} lg={8}>
                    <Card
                        title="当前接单状态"
                        extra={
                            <Space>
                                {/*<Button onClick={() => refreshStats()} loading={statsLoading}>刷新数据</Button>*/}
                            </Space>
                        }
                    >
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <div>
                                <Tag color={statusMeta.color} style={{ fontSize: 14, padding: '3px 10px' }}>
                                    {statusMeta.text}
                                </Tag>
                            </div>

                            <Space>
                                <Button
                                    type="primary"
                                    disabled={workStatus === 'WORKING' || workStatus === 'IDLE'}
                                    onClick={() => updateMyWorkStatus('IDLE')}
                                >
                                    开始接单
                                </Button>

                                <Button
                                    disabled={workStatus === 'WORKING' || workStatus === 'RESTING'}
                                    onClick={() => updateMyWorkStatus('RESTING')}
                                >
                                    休息一下
                                </Button>
                            </Space>

                            <div style={{ color: 'rgba(0,0,0,.45)', fontSize: 12 }}>
                                等待中会接收派单；接单中不会被再次派单；休息中不会接收新派单。
                            </div>
                        </Space>
                    </Card>
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
                            { required: true, message: '请填写拒单原因' },
                            { max: 200, message: '最多 200 字' },
                        ]}
                    >
                        <Input.TextArea rows={4} placeholder="例如：临时有事 / 设备异常 / 正在打单" />
                    </Form.Item>
                </Form>
                <div style={{ marginTop: 8, color: 'rgba(0,0,0,.45)', fontSize: 12 }}>
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
                width={720}
            >
                <Form form={finishForm} layout="vertical">
                    {poolDispatch && isHourly(poolDispatch) ? (
                        <>
                            <Divider style={{ marginTop: 0 }}>小时单</Divider>
                            <div style={{ marginBottom: 8, color: 'rgba(0,0,0,.45)' }}>
                                当前时间：{dayjs(tick).format('YYYY-MM-DD HH:mm')}
                            </div>
                            <Form.Item name="deductMinutesOption" label="扣时选项（可选）">
                                <Input placeholder="例如：M10/M20/M30（由后端枚举兜底）" />
                            </Form.Item>
                        </>
                    ) : null}

                    {poolDispatch && isGuaranteed(poolDispatch) ? (
                        <>
                            <Divider style={{ marginTop: 0 }}>保底单</Divider>

                            {finishMode === 'COMPLETE' ? (
                                <Card size="small" style={{ marginBottom: 12 }}>
                                    <div style={{ color: 'rgba(0,0,0,.45)', fontSize: 12 }}>
                                        本轮结单将按剩余保底兜底补齐（后端口径）。当前剩余：
                                    </div>
                                    <div style={{ fontSize: 18, fontWeight: 600 }}>
                                        {guaranteedCompleteRemainingWan == null ? '-' : guaranteedCompleteRemainingWan} 万
                                    </div>
                                </Card>
                            ) : (
                                <Form.Item
                                    name="totalProgressWan"
                                    label="本轮总保底进度(万)"
                                    rules={[{ required: true, message: '请填写本轮总保底进度' }]}
                                >
                                    <InputNumber style={{ width: '100%' }} />
                                </Form.Item>
                            )}

                            {finishMode === 'ARCHIVE' ? (
                                <div style={{ color: 'rgba(0,0,0,.45)', fontSize: 12, marginTop: -6 }}>
                                    系统会按参与者人数均分：当前每人约 {(Number(watchedTotalProgressWan || 0) / (participantsActive(poolDispatch).length || 1)).toFixed(2)} 万
                                </div>
                            ) : null}
                        </>
                    ) : null}

                    <Form.Item name="remark" label="备注（可选）">
                        <Input.TextArea rows={3} placeholder="异常说明/备注" />
                    </Form.Item>
                </Form>
            </Modal>
        </PageContainer>
    );
};

export default WorkbenchPage;
