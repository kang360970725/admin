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
    Divider,
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
import { getGameProjectOptions, getOrderSourceOptions, getPlayerOptions } from '@/services/api';
import { useIsMobile } from '@/utils/useIsMobile';

type ProjectItem = {
    id: number;
    name: string;
    price?: number | null; // 小时单：每小时价格；非小时单：也可能用于默认金额
    baseAmount?: number | null; // 保底（万）
    billingMode?: 'HOURLY' | 'GUARANTEED' | string | null; // 计费方式：用于判断小时单
};

type OptionItem = { label: string; value: number };

const MAX_PLAYERS = 2;

// 注意：字段集合尽量与后端 /orders/create & /orders/update 可编辑字段一致
export type OrderUpsertValues = {
    id?: number;

    projectId: number;

    receivableAmount: number; // 应收
    paidAmount: number; // 实收
    settlementAmount?: number; // 结算金额

    baseAmountWan?: number | null; // 订单保底（万）

    // ✅ 下单数量：小时单=下单小时；其它单默认 1
    orderQuantity?: number;

    customerGameId?: string;
    orderSource?: string;

    orderTime?: any;
    paymentTime?: any;

    csRate?: number;
    inviteRate?: number;
    inviter?: string;

    customClubRate?: number;
    remark?: string;

    // 新建时可选派单
    playerIds?: number[];

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
                const name = String(u?.name || u?.phone || '未命名');
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
                paidAmount: total,
                settlementAmount: total,
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
                patch.paidAmount = total;
                patch.settlementAmount = total;
            }
        } else {
            // 非小时单：数量默认 1（不展示，但提交需要）
            patch.orderQuantity = 1;

            // 非小时单：金额默认同步项目 price（你原有规则保持）
            if (p?.price != null) {
                patch.receivableAmount = Number(p.price);
                patch.paidAmount = Number(p.price);
                patch.settlementAmount = Number(p.price);
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
            orderSource: initialValues?.orderSource || 'CUSTOMER_SERVICE_MANUAL',
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

    // 值变化：项目变更 + 数量变更 + 限制打手数量
    const onValuesChange = (changed: any) => {
        if (changed?.projectId) syncByProject(changed.projectId);

        if (changed?.orderQuantity != null) {
            const pid = Number(form?.getFieldValue?.('projectId') ?? 0);
            recalcHourlyAmount(pid, Number(changed.orderQuantity));
        }

        if (changed?.paidAmount != null) {
            form?.setFieldValue?.('settlementAmount' as any, Number(changed.paidAmount));
        }

        if (showPlayers && Array.isArray(changed?.playerIds) && changed.playerIds.length > MAX_PLAYERS) {
            message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
            updatePlayerSelection(changed.playerIds.slice(0, MAX_PLAYERS).map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n)));
        }

        // 维护 playerNames（小票用）
        if (showPlayers && Array.isArray(changed?.playerIds)) {
            updatePlayerSelection(
                changed.playerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
            );
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
            const isPaid = Boolean(v?.isPaid);
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

            const payload: OrderUpsertValues = {
                ...(v as any),
                id: initialValues?.id,

                projectId: Number(v?.projectId),

                receivableAmount: Number(v?.receivableAmount),
                paidAmount: Number(v?.paidAmount),
                settlementAmount: v?.settlementAmount != null ? Number(v?.settlementAmount) : Number(v?.paidAmount),

                baseAmountWan: v?.baseAmountWan != null && v?.baseAmountWan !== '' ? Number(v?.baseAmountWan) : null,

                // ✅ 下单数量：小时单=小时；其它单默认 1
                orderQuantity: Number(v?.orderQuantity ?? 1),

                customerGameId: v?.customerGameId?.trim?.() || undefined,
                orderSource: v?.orderSource ? String(v.orderSource).trim() : undefined,

                orderTime: v?.orderTime ? dayjs(v.orderTime).toISOString() : now.toISOString(),
                paymentTime: v?.paymentTime ? dayjs(v.paymentTime).toISOString() : now.toISOString(),

                inviter: v?.inviter?.trim?.() || undefined,

                csRate: v?.csRate != null && v?.csRate !== '' ? Number(v?.csRate) : undefined,
                inviteRate: v?.inviteRate != null && v?.inviteRate !== '' ? Number(v?.inviteRate) : undefined,

                customClubRate: v?.customClubRate != null && v?.customClubRate !== '' ? Number(v?.customClubRate) : undefined,

                remark: v?.remark?.trim?.() || undefined,

                playerIds: showPlayers
                    ? Array.isArray(v?.playerIds)
                        ? v.playerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
                        : []
                    : undefined,

                isGifted: Boolean(v?.isGifted),

                /**
                 * isPaid 由前端勾选决定；不再从 paymentTime 推断
                 * - 赠送单：这里仍允许用户勾选，但通常赠送单不需要收款
                 */
                isPaid: Boolean(v?.isPaid),
                // 小票展示字段
                projectName: v?.projectName,
                billingMode: v?.billingMode,
                unitPrice: v?.unitPrice != null ? Number(v.unitPrice) : undefined,
                playerNames: Array.isArray(v?.playerNames) ? v.playerNames : undefined,
            };

            await onSubmit?.(payload);
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

    const updatePlayerSelection = (nextIds: number[]) => {
        const limitedIds = nextIds.slice(0, MAX_PLAYERS);
        const names = limitedIds
            .map((id: any) => playerMap?.[Number(id)])
            .filter(Boolean);
        form?.setFieldsValue?.({
            playerIds: limitedIds,
            playerNames: names,
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
            centered
            width={isMobile ? '96vw' : 700}
            style={isMobile ? { top: 12 } : undefined}
            okText="保存"
            cancelText="取消"
        >
            <Form form={form} layout="vertical" onValuesChange={onValuesChange}>
                {/* 1) 订单核心 */}
                <Divider style={{ marginTop: 0, marginBottom: 12 }} />

                <Row gutter={[16, 12]}>
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
                                placeholder={showQtyForHourly ? '随小时自动计算' : '随项目自动同步'}
                            />
                        </Form.Item>
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
                        <Form.Item name="orderSource" label="订单渠道来源" rules={[{ required: true, message: '请选择订单渠道来源' }]}>
                            <Select
                                placeholder="请选择订单渠道来源"
                                options={orderSourceOptions}
                                allowClear={false}
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
                                            <Input placeholder="可选" />
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
