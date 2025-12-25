// src/pages/Orders/components/OrderForm.tsx
// 说明：文件名虽为 OrderForm.tsx，但这里导出的是“新建/编辑订单通用弹窗”组件（OrderUpsertModal）
// 目标：
// 1) 弹窗更宽（桌面端一屏录单）
// 2) 2~3 列栅格布局（lg=3列 / md=2列 / xs=1列）
// 3) 更美观（分组、间距、信息密度合理）
// 4) 尽量无滚动（桌面端尽量一屏；小屏仍可能不可避免）
// 5) 项目变更：强制同步应收/实收金额 + 订单保底(万)（来自项目）
// 6) “新建可选派单”：showPlayers=true 时展示打手选择（内部获取）

import React, { useEffect, useMemo, useState } from 'react';
import { Col, DatePicker, Divider, Form, Input, InputNumber, message, Modal, Row, Select } from 'antd';
import dayjs from 'dayjs';
import { getGameProjectOptions, getPlayerOptions } from '@/services/api';

type ProjectItem = {
    id: number;
    name: string;
    price?: number | null; // 项目单价（用于同步应收/实收）
    baseAmount?: number | null; // 项目保底（用于同步订单保底(万)）
};

type OptionItem = { label: string; value: number };

const MAX_PLAYERS = 2;

// 注意：这里的字段集合要与后端 /orders/create & /orders/update 可编辑字段一致
export type OrderUpsertValues = {
    id?: number;

    projectId: number;

    receivableAmount: number; // 应收
    paidAmount: number; // 实收
    baseAmountWan?: number | null; // 订单保底（万）

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
                };

                // label 美观：展示名称 + 价格（如果有）
                const priceText = p?.price != null ? `（¥${p.price}）` : '';
                return { value: id, label: `${name}${priceText}` };
            });

            setProjectMap(map);
            setProjectOptions(options);
        } catch (e) {
            // 这里不抛出，避免弹窗无法使用
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
            const opts: OptionItem[] = list.map((u: any) => {
                const id = Number(u?.id);
                const name = String(u?.name ?? '未命名');
                const phone = String(u?.phone ?? '-');
                return { value: id, label: `${name}（${phone}）` };
            });

            setPlayerOptions(opts);
        } catch (e) {
            console.error(e);
            message.error('获取打手列表失败');
            setPlayerOptions([]);
        } finally {
            setPlayerLoading(false);
        }
    };

    // ---------- 规则：项目变更 -> 同步金额 + 保底 ----------
    const syncByProject = (pid?: number) => {
        const id = Number(pid);
        if (!id) return;

        const p = projectMap?.[id];
        if (!p) return;

        const patch: Partial<OrderUpsertValues> = {};

        // 应收/实收：强制同步项目价格（你要求“默认填入选择的项目金额”）
        if (p?.price != null) {
            patch.receivableAmount = Number(p.price);
            patch.paidAmount = Number(p.price);
        }

        // 订单保底（万）：同步项目 baseAmount
        patch.baseAmountWan = p?.baseAmount != null ? Number(p.baseAmount) : null;

        form?.setFieldsValue?.(patch as any);
    };

    // ---------- 打开弹窗：初始化 ----------
    useEffect(() => {
        if (!open) return;

        // 先清空再填充（防止上一次残留）
        form?.resetFields?.();

        // 统一初始化：时间默认 now；其他字段用 initialValues（不在这里填金额/保底，金额/保底由项目同步规则统一控制）
        form?.setFieldsValue?.({
            orderTime: now,
            paymentTime: now,
            ...initialValues,
            orderTime: initialValues?.orderTime ? dayjs(initialValues.orderTime) : now,
            paymentTime: initialValues?.paymentTime ? dayjs(initialValues.paymentTime) : now,
        } as any);

        // 拉基础数据
        void fetchProjects('');
        void fetchPlayers('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // 项目列表加载完成后：用当前 projectId 再同步一次（确保一打开就自动填金额/保底）
    useEffect(() => {
        if (!open) return;
        const pid = (form?.getFieldValue?.('projectId') as any) ?? initialValues?.projectId;
        if (pid) syncByProject(pid);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, projectMap]);

    // 值变化：项目变更 + 限制打手数量
    const onValuesChange = (changed: any) => {
        if (changed?.projectId) syncByProject(changed.projectId);

        // 新建派单：最多 2 人（超出截断）
        if (showPlayers && Array.isArray(changed?.playerIds) && changed.playerIds.length > MAX_PLAYERS) {
            message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
            form?.setFieldValue?.('playerIds' as any, changed.playerIds.slice(0, MAX_PLAYERS));
        }
    };

    // ---------- 提交 ----------
    const handleOk = async () => {
        try {
            setSubmitting(true);

            const v = await form?.validateFields?.();

            const payload: OrderUpsertValues = {
                ...(v as any),
                id: initialValues?.id,

                projectId: Number((v as any)?.projectId),

                receivableAmount: Number((v as any)?.receivableAmount),
                paidAmount: Number((v as any)?.paidAmount),

                baseAmountWan:
                    (v as any)?.baseAmountWan != null && (v as any)?.baseAmountWan !== ''
                        ? Number((v as any)?.baseAmountWan)
                        : null,

                customerGameId: (v as any)?.customerGameId?.trim?.() || undefined,

                orderTime: (v as any)?.orderTime ? dayjs((v as any).orderTime).toISOString() : now.toISOString(),
                paymentTime: (v as any)?.paymentTime ? dayjs((v as any).paymentTime).toISOString() : now.toISOString(),

                inviter: (v as any)?.inviter?.trim?.() || undefined,

                csRate: (v as any)?.csRate != null && (v as any)?.csRate !== '' ? Number((v as any)?.csRate) : undefined,
                inviteRate:
                    (v as any)?.inviteRate != null && (v as any)?.inviteRate !== '' ? Number((v as any)?.inviteRate) : undefined,

                customClubRate:
                    (v as any)?.customClubRate != null && (v as any)?.customClubRate !== ''
                        ? Number((v as any)?.customClubRate)
                        : undefined,

                remark: (v as any)?.remark?.trim?.() || undefined,

                playerIds: showPlayers
                    ? (Array.isArray((v as any)?.playerIds)
                        ? (v as any).playerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
                        : [])
                    : undefined,
            };

            await onSubmit?.(payload);
        } finally {
            setSubmitting(false);
        }
    };

    // ---------- UI：更美观、更宽、更少滚动 ----------
    // 栅格：桌面 3列（lg=8），中屏 2列（md=12），手机 1列（xs=24）
    const colProps = { xs: 24, md: 12, lg: 12 };

    return (
        <Modal
            open={open}
            title={title}
            onCancel={onCancel}
            onOk={handleOk}
            confirmLoading={submitting}
            destroyOnClose
            centered
            width={700} // ✅ 更宽：桌面一屏录单更舒服
            okText="保存"
            cancelText="取消"
        >
            <Form form={form} layout="vertical" onValuesChange={onValuesChange}>
                {/* 1) 订单核心 */}
                <Row gutter={[16, 6]}>
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

                    <Col {...colProps}>
                        <Form.Item name="baseAmountWan" label="订单保底(万)">
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="随项目自动同步，可手改" />
                        </Form.Item>
                    </Col>

                    <Col {...colProps}>
                        <Form.Item name="receivableAmount" label="应收金额" rules={[{ required: true, message: '请输入应收金额' }]}>
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="随项目自动同步" />
                        </Form.Item>
                    </Col>

                    <Col {...colProps}>
                        <Form.Item name="paidAmount" label="实收金额" rules={[{ required: true, message: '请输入实收金额' }]}>
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="随项目自动同步" />
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Form.Item name="customerGameId" label="客户游戏ID">
                            <Input placeholder="可选" />
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
                        <Col xs={24} md={24} lg={8}>
                            <Form.Item name="playerIds" label={`打手（最多 ${MAX_PLAYERS} 人）`}>
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
                <Row gutter={[16, 12]}>

                    <Col {...colProps}>
                        <Form.Item name="inviter" label="邀请人">
                            <Input placeholder="可选" />
                        </Form.Item>
                    </Col>

                    {/*<Col {...colProps}>*/}
                    {/*    <Form.Item name="inviteRate" label="邀请抽成">*/}
                    {/*        <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} placeholder="0~1" />*/}
                    {/*    </Form.Item>*/}
                    {/*</Col>*/}

                    <Col {...colProps}>
                        <Form.Item name="customClubRate" label="特殊单自定义抽成比例">
                            <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} placeholder="0~1" />
                        </Form.Item>
                    </Col>

                    {/*<Col {...colProps}>*/}
                    {/*    <Form.Item name="csRate" label="客服抽成">*/}
                    {/*        <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} placeholder="0~1" />*/}
                    {/*    </Form.Item>*/}
                    {/*</Col>*/}
                </Row>

                {/* 3) 备注 */}
                <Row gutter={[16, 12]}>
                    <Col span={24}>
                        <Form.Item name="remark" label="备注">
                            <Input.TextArea rows={3} placeholder="可选" />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </Modal>
    );
}
