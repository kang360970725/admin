// src/pages/Orders/components/OrderForm.tsx
// 说明：文件名虽为 OrderForm.tsx，但这里导出的是“新建/编辑订单通用弹窗”组件（OrderUpsertModal）
// 融合点：
// - 你现有 UI：宽弹窗 + Divider 分组 + 栅格（默认 2 列）+ 更美观
// - 新需求：小时单选择下单小时，金额（应收/实收）按时长累加（= 项目单价 * 小时）
// - 兼容：可选派单（showPlayers）
// - 兼容：链式 ?. 防止空对象导致报错
// - 额外：提供小票生成所需展示字段（projectName/billingMode/unitPrice/playerNames），不建议传后端

import React, { useEffect, useMemo, useState } from 'react';
import {
    Col,
    DatePicker,
    Divider,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Row,
    Select,
} from 'antd';
import dayjs from 'dayjs';
import { getGameProjectOptions, getPlayerOptions } from '@/services/api';

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

    baseAmountWan?: number | null; // 订单保底（万）

    // 小时单：下单小时（仅前端创建时用；后端 updateEditable 当前不包含此字段）
    orderHours?: number;

    customerGameId?: string;

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

    const [submitting, setSubmitting] = useState(false);

    // 项目下拉
    const [projectLoading, setProjectLoading] = useState(false);
    const [projectOptions, setProjectOptions] = useState<{ label: string; value: number }[]>([]);
    const [projectMap, setProjectMap] = useState<Record<number, ProjectItem>>({});

    // 打手下拉（可选）
    const [playerLoading, setPlayerLoading] = useState(false);
    const [playerOptions, setPlayerOptions] = useState<OptionItem[]>([]);
    const [playerMap, setPlayerMap] = useState<Record<number, string>>({});

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
            const res = await getPlayerOptions?.({ keyword: keyword || '', onlyIdle: true });
            const list: any[] = Array.isArray(res) ? res : (res?.data ?? []);

            const map: Record<number, string> = {};
            const opts: OptionItem[] = list.map((u: any) => {
                const id = Number(u?.id);
                const name = String(u?.name || u?.phone || '未命名');
                map[id] = name;
                const phone = String(u?.phone ?? '-');
                return { value: id, label: `${name}（${phone}）` };
            });

            setPlayerMap(map);
            setPlayerOptions(opts);
        } catch (e) {
            console.error(e);
            message.error('获取打手列表失败');
            setPlayerMap({});
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

    // 小时单：金额=单价*小时
    const recalcHourlyAmount = (pid?: number, hours?: number) => {
        const id = Number(pid);
        if (!id) return;
        const p = projectMap?.[id];
        if (!p) return;
        if (String(p?.billingMode ?? '') !== 'HOURLY') return;

        const h = Number(hours ?? form?.getFieldValue?.('orderHours') ?? 0) || 0;
        if (p?.price != null && h > 0) {
            const total = Number(p.price) * h;
            form?.setFieldsValue?.({
                receivableAmount: total,
                paidAmount: total,
            } as any);
        }
    };

    // 项目变更：同步金额/保底；小时单则开启“按小时计算”
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

        // 小时单：默认给 1 小时并计算金额
        if (String(p?.billingMode ?? '') === 'HOURLY') {
            const curHours = Number(form?.getFieldValue?.('orderHours') ?? 0) || 0;
            const hours = curHours > 0 ? curHours : 1;
            patch.orderHours = hours;

            if (p?.price != null) {
                const total = Number(p.price) * hours;
                patch.receivableAmount = total;
                patch.paidAmount = total;
            }
        } else {
            // 非小时单：金额默认同步项目 price（你原有规则保持）
            patch.orderHours = undefined;
            if (p?.price != null) {
                patch.receivableAmount = Number(p.price);
                patch.paidAmount = Number(p.price);
            }
        }

        form?.setFieldsValue?.(patch as any);
    };

    // ---------- 打开弹窗：初始化 ----------
    useEffect(() => {
        if (!open) return;

        form?.resetFields?.();

        form?.setFieldsValue?.({
            orderTime: now,
            paymentTime: now,
            ...initialValues,
            orderTime: initialValues?.orderTime ? dayjs(initialValues.orderTime) : now,
            paymentTime: initialValues?.paymentTime ? dayjs(initialValues.paymentTime) : now,
        } as any);

        void fetchProjects('');
        void fetchPlayers('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // 项目列表加载完成后：用当前 projectId 再同步一次（确保一打开就自动填）
    useEffect(() => {
        if (!open) return;
        const pid = (form?.getFieldValue?.('projectId') as any) ?? initialValues?.projectId;
        if (pid) syncByProject(pid);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, projectMap]);

    // 值变化：项目变更 + 小时变更 + 限制打手数量
    const onValuesChange = (changed: any) => {
        if (changed?.projectId) syncByProject(changed.projectId);

        if (changed?.orderHours != null) {
            const pid = Number(form?.getFieldValue?.('projectId') ?? 0);
            recalcHourlyAmount(pid, Number(changed.orderHours));
        }

        if (showPlayers && Array.isArray(changed?.playerIds) && changed.playerIds.length > MAX_PLAYERS) {
            message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
            form?.setFieldValue?.('playerIds' as any, changed.playerIds.slice(0, MAX_PLAYERS));
        }

        // 维护 playerNames（小票用）
        if (showPlayers && Array.isArray(changed?.playerIds)) {
            const names = changed.playerIds
                .map((id: any) => playerMap?.[Number(id)])
                .filter(Boolean);
            form?.setFieldsValue?.({ playerNames: names } as any);
        }
    };

    // ---------- 提交 ----------
    const handleOk = async () => {
        try {
            setSubmitting(true);
            const v: any = await form?.validateFields?.();

            const pid = Number(v?.projectId);
            const hourly = isHourlyProject(pid);

            // 小时单：必须有下单小时
            if (hourly && !(Number(v?.orderHours) > 0)) {
                message.error('小时单必须填写下单小时');
                return;
            }

            const payload: OrderUpsertValues = {
                ...(v as any),
                id: initialValues?.id,

                projectId: Number(v?.projectId),

                receivableAmount: Number(v?.receivableAmount),
                paidAmount: Number(v?.paidAmount),

                baseAmountWan:
                    v?.baseAmountWan != null && v?.baseAmountWan !== '' ? Number(v?.baseAmountWan) : null,

                // 小时单携带 hours（你后续生成小票需要；后端 create 若暂不支持也不会影响前端）
                orderHours: hourly ? Number(v?.orderHours) : undefined,

                customerGameId: v?.customerGameId?.trim?.() || undefined,

                orderTime: v?.orderTime ? dayjs(v.orderTime).toISOString() : now.toISOString(),
                paymentTime: v?.paymentTime ? dayjs(v.paymentTime).toISOString() : now.toISOString(),

                inviter: v?.inviter?.trim?.() || undefined,

                csRate: v?.csRate != null && v?.csRate !== '' ? Number(v?.csRate) : undefined,
                inviteRate: v?.inviteRate != null && v?.inviteRate !== '' ? Number(v?.inviteRate) : undefined,

                customClubRate:
                    v?.customClubRate != null && v?.customClubRate !== '' ? Number(v?.customClubRate) : undefined,

                remark: v?.remark?.trim?.() || undefined,

                playerIds: showPlayers
                    ? (Array.isArray(v?.playerIds)
                        ? v.playerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
                        : [])
                    : undefined,

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
    const colProps = { xs: 24, md: 12, lg: 12 };

    const curProjectId = Number(form?.getFieldValue?.('projectId') ?? 0);
    const showHours = isHourlyProject(curProjectId);

    return (
        <Modal
            open={open}
            title={title}
            onCancel={onCancel}
            onOk={handleOk}
            confirmLoading={submitting}
            destroyOnClose
            centered
            width={700}
            okText="保存"
            cancelText="取消"
        >
            <Form form={form} layout="vertical" onValuesChange={onValuesChange}>
                {/* 1) 订单核心 */}
                <Divider style={{ marginTop: 0, marginBottom: 12 }}/>

                <Row gutter={[16, 12]}>
                    <Col {...colProps}>
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

                    {showHours ? (
                        <Col {...colProps}>
                            <Form.Item
                                name="orderHours"
                                label="下单小时"
                                rules={[{ required: true, message: '请输入下单小时' }]}
                            >
                                <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="例如：1 / 2 / 3 ..." />
                            </Form.Item>
                        </Col>
                    ) : null}

                    <Col {...colProps}>
                        <Form.Item name="customerGameId" label="客户ID（游戏ID）">
                            <Input placeholder="ID或昵称" />
                        </Form.Item>
                    </Col>

                    <Col {...colProps}>
                        <Form.Item name="baseAmountWan" label="订单保底(万)">
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="随项目自动同步，可手改" />
                        </Form.Item>
                    </Col>

                    <Col {...colProps}>
                        <Form.Item name="receivableAmount" label="应收金额" rules={[{ required: true, message: '请输入应收金额' }]}>
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                placeholder={showHours ? '随小时自动计算' : '随项目自动同步'}
                            />
                        </Form.Item>
                    </Col>

                    <Col {...colProps}>
                        <Form.Item name="paidAmount" label="实收金额" rules={[{ required: true, message: '请输入实收金额' }]}>
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                placeholder={showHours ? '随小时自动计算' : '随项目自动同步'}
                            />
                        </Form.Item>
                    </Col>

                    <Col {...colProps}>
                        <Form.Item name="orderTime" label="下单时间">
                            <DatePicker showTime style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>

                    <Col {...colProps}>
                        <Form.Item name="paymentTime" label="付款时间">
                            <DatePicker showTime style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>

                    {/* 新建可选派单 */}
                    {showPlayers ? (
                        <Col xs={24} md={24} lg={12}>
                            <Form.Item name="playerIds" label={`接待陪玩（最多 ${MAX_PLAYERS} 人）`}>
                                <Select
                                    mode="multiple"
                                    placeholder="可选：新建即派单"
                                    showSearch
                                    filterOption={false}
                                    onSearch={(v) => fetchPlayers(v)}
                                    options={playerOptions}
                                    loading={playerLoading}
                                    maxTagCount={2}
                                    allowClear
                                />
                            </Form.Item>
                        </Col>
                    ) : null}
                </Row>

                {/* 2) 抽成信息 */}
                <Divider style={{ marginTop: 16, marginBottom: 12 }}/>
                <Row gutter={[16, 12]}>
                    {/*<Col {...colProps}>*/}
                    {/*    <Form.Item name="csRate" label="客服抽成">*/}
                    {/*        <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} placeholder="0~1" />*/}
                    {/*    </Form.Item>*/}
                    {/*</Col>*/}

                    {/*<Col {...colProps}>*/}
                    {/*    <Form.Item name="inviteRate" label="邀请抽成">*/}
                    {/*        <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} placeholder="0~1" />*/}
                    {/*    </Form.Item>*/}
                    {/*</Col>*/}

                    <Col {...colProps}>
                        <Form.Item name="inviter" label="邀请人">
                            <Input placeholder="可选" />
                        </Form.Item>
                    </Col>

                    <Col {...colProps}>
                        <Form.Item name="customClubRate" label="特殊单固定抽成">
                            <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} placeholder="0~1" />
                        </Form.Item>
                    </Col>
                </Row>

                {/* 3) 备注 */}
                <Divider style={{ marginTop: 16, marginBottom: 12 }}/>
                <Row gutter={[16, 12]}>
                    <Col span={24}>
                        <Form.Item name="remark" label="备注">
                            <Input.TextArea rows={3} placeholder="可选" />
                        </Form.Item>
                    </Col>
                </Row>

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
            </Form>
        </Modal>
    );
}
