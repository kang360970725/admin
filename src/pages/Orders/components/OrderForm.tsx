import React, {useEffect, useMemo, useState} from 'react';
import {Col, DatePicker, Form, Input, InputNumber, message, Modal, Row, Select} from 'antd';
import dayjs from 'dayjs';
import {getGameProjectOptions, getPlayerOptions} from '@/services/api';

type ProjectItem = { id: number; name: string; price?: number | null; baseAmount?: number | null };
type OptionItem = { label: string; value: number };

const MAX_PLAYERS = 2;

export type OrderUpsertValues = {
    id?: number;
    projectId: number;
    receivableAmount: number;
    paidAmount: number;
    baseAmountWan?: number | null;
    customerGameId?: string;
    orderTime?: any;
    paymentTime?: any;
    csRate?: number;
    inviteRate?: number;
    inviter?: string;
    customClubRate?: number;
    remark?: string;
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
    const {open, title, initialValues, showPlayers, onCancel, onSubmit} = props;
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    const [projectLoading, setProjectLoading] = useState(false);
    const [projectOptions, setProjectOptions] = useState<{ label: string; value: number }[]>([]);
    const [projectMap, setProjectMap] = useState<Record<number, ProjectItem>>({});

    const [playerLoading, setPlayerLoading] = useState(false);
    const [playerOptions, setPlayerOptions] = useState<OptionItem[]>([]);

    const now = useMemo(() => dayjs(), []);

    const fetchProjects = async (keyword?: string) => {
        setProjectLoading(true);
        try {
            const res = await getGameProjectOptions({keyword: keyword || ''});
            const list: any[] = Array.isArray(res) ? res : (res?.data ?? []);
            const map: Record<number, ProjectItem> = {};
            const options = list.map((p: any) => {
                const id = Number(p.id);
                map[id] = {
                    id,
                    name: p.name,
                    price: p.price ?? null,
                    baseAmount: p.baseAmount ?? null,
                };
                return {
                    value: id,
                    label: `${p.name}${p.price != null ? `（¥${p.price}）` : ''}`,
                };
            });
            setProjectMap(map);
            setProjectOptions(options);
        } finally {
            setProjectLoading(false);
        }
    };

    const fetchPlayers = async (keyword?: string) => {
        if (!showPlayers) return;
        setPlayerLoading(true);
        try {
            const res = await getPlayerOptions({keyword: keyword || '', onlyIdle: true});
            const list: any[] = Array.isArray(res) ? res : (res?.data ?? []);
            setPlayerOptions(
                list.map((u: any) => ({
                    value: Number(u.id),
                    label: `${u.name || '未命名'}（${u.phone || '-'}）`,
                })),
            );
        } finally {
            setPlayerLoading(false);
        }
    };

    // ✅ 项目变更：同步「应收/实收 = 项目价格」+「保底(万)=项目 baseAmount」
    const syncByProject = (pid?: number) => {
        const id = Number(pid);
        if (!id) return;
        const p = projectMap[id];
        if (!p) return;

        const patch: any = {};
        if (p.price != null) {
            patch.receivableAmount = Number(p.price);
            patch.paidAmount = Number(p.price);
        }
        patch.baseAmountWan = p.baseAmount != null ? Number(p.baseAmount) : null;

        form.setFieldsValue(patch);
    };

    useEffect(() => {
        if (!open) return;

        form.resetFields();
        form.setFieldsValue({
            orderTime: now,
            paymentTime: now,
            ...initialValues,
            orderTime: initialValues?.orderTime ? dayjs(initialValues.orderTime) : now,
            paymentTime: initialValues?.paymentTime ? dayjs(initialValues.paymentTime) : now,
        });

        void fetchProjects('');
        void fetchPlayers('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // 项目列表加载完成后：以当前 projectId 立即同步默认值（金额+保底）
    useEffect(() => {
        if (!open) return;
        const pid = form.getFieldValue('projectId') ?? initialValues?.projectId;
        if (pid) syncByProject(pid);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, projectMap]);

    const onValuesChange = (changed: any) => {
        if (changed.projectId) syncByProject(changed.projectId);

        if (showPlayers && Array.isArray(changed.playerIds) && changed.playerIds.length > MAX_PLAYERS) {
            message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
            form.setFieldValue('playerIds', changed.playerIds.slice(0, MAX_PLAYERS));
        }
    };

    const handleOk = async () => {
        try {
            setSubmitting(true);
            const v = await form.validateFields();

            const payload: OrderUpsertValues = {
                ...v,
                id: initialValues?.id,
                projectId: Number(v.projectId),
                receivableAmount: Number(v.receivableAmount),
                paidAmount: Number(v.paidAmount),
                baseAmountWan: v.baseAmountWan != null && v.baseAmountWan !== '' ? Number(v.baseAmountWan) : null,
                customerGameId: v.customerGameId?.trim() || undefined,
                orderTime: v.orderTime ? dayjs(v.orderTime).toISOString() : now.toISOString(),
                paymentTime: v.paymentTime ? dayjs(v.paymentTime).toISOString() : now.toISOString(),
                inviter: v.inviter?.trim() || undefined,
                csRate: v.csRate != null && v.csRate !== '' ? Number(v.csRate) : undefined,
                inviteRate: v.inviteRate != null && v.inviteRate !== '' ? Number(v.inviteRate) : undefined,
                customClubRate: v.customClubRate != null && v.customClubRate !== '' ? Number(v.customClubRate) : undefined,
                remark: v.remark?.trim() || undefined,
                playerIds: showPlayers
                    ? (Array.isArray(v.playerIds) ? v.playerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n)) : [])
                    : undefined,
            };

            await onSubmit(payload);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal open={open} width={1100} title={title} onCancel={onCancel} onOk={handleOk} confirmLoading={submitting}
               destroyOnClose>
            <Form form={form} layout="vertical" onValuesChange={onValuesChange}>
                <Row gutter={16}>
                    <Col xs={24} md={12} lg={8}>
                        <Form.Item name="projectId" label="项目" rules={[{required: true}]}>
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
                    <Col xs={24} md={12} lg={8}>
                        {showPlayers ? (
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
                        ) : null}
                    </Col>
                    <Col xs={24} md={12} lg={8}>
                        <Form.Item name="customerGameId" label="客户游戏ID">
                            <Input/>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12} lg={8}>
                        <Form.Item name="receivableAmount" label="应收金额" rules={[{required: true}]}>
                            <InputNumber min={0} style={{width: '100%'}}/>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12} lg={8}>
                        <Form.Item name="paidAmount" label="实收金额" rules={[{required: true}]}>
                            <InputNumber min={0} style={{width: '100%'}}/>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12} lg={8}>
                        <Form.Item name="baseAmountWan" label="订单保底(万)">
                            <InputNumber min={0} style={{width: '100%'}}/>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12} lg={8}>
                        <Form.Item name="orderTime" label="下单时间">
                            <DatePicker showTime style={{width: '100%'}}/>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12} lg={8}>
                        <Form.Item name="paymentTime" label="付款时间">
                            <DatePicker showTime style={{width: '100%'}}/>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12} lg={8}>
                        <Form.Item name="csRate" label="客服抽成">
                            <InputNumber min={0} max={1} step={0.01} style={{width: '100%'}}/>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12} lg={8}>
                        <Form.Item name="inviteRate" label="邀请抽成">
                            <InputNumber min={0} max={1} step={0.01} style={{width: '100%'}}/>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12} lg={8}>
                        <Form.Item name="inviter" label="邀请人">
                            <Input/>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12} lg={8}>
                        <Form.Item name="customClubRate" label="自定义公会抽成">
                            <InputNumber min={0} max={1} step={0.01} style={{width: '100%'}}/>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12} lg={8}>
                        <Form.Item name="remark" label="备注">
                            <Input.TextArea rows={3}/>
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </Modal>
    );
}
