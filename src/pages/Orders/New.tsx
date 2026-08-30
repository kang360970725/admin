// src/pages/Orders/New.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Checkbox, Form, Input, InputNumber, Select, DatePicker, Button, Row, Col, Space, message, Radio } from 'antd';
import dayjs from 'dayjs';
import { history } from '@umijs/max';

import {
    createOrder,
    getGameProjectOptions,
    getPlayerOptions,
} from '@/services/api';
import { maskPhone } from '@/utils/privacy';

type ProjectOptionItem = {
    label: string;
    value: number;
    baseAmount?: number | null; // ✅ 项目默认保底（用于自动同步到订单）
};

type OptionItem = { label: string; value: number };

const MAX_PLAYERS = 2;

const NewOrderPage: React.FC = () => {
    const [form] = Form.useForm();

    const [submitting, setSubmitting] = useState(false);

    // 项目下拉
    const [projectOptions, setProjectOptions] = useState<ProjectOptionItem[]>([]);
    const [projectLoading, setProjectLoading] = useState(false);

    // 打手下拉（默认只取空闲）
    const [playerOptions, setPlayerOptions] = useState<OptionItem[]>([]);
    const [playerLoading, setPlayerLoading] = useState(false);

    const now = useMemo(() => dayjs(), []);
    const watchedPlayerIds = Form.useWatch('playerIds', form) || [];
    const watchedAttributionType = String(Form.useWatch('bonusAttributionType', form) || 'NONE');
    const watchedLegacyIsRenewal = Boolean(Form.useWatch('isRenewal', form));
    const watchedLegacyIsDesignated = Boolean(Form.useWatch('isDesignated', form));
    const watchedIsRenewal = watchedAttributionType === 'RENEWAL' || watchedLegacyIsRenewal;
    const watchedIsDesignated = watchedAttributionType === 'DESIGNATED' || watchedLegacyIsDesignated;


    useEffect(() => {
        // 默认时间：当前时间
        form.setFieldsValue({
            orderTime: now,
            paymentTime: now,
        });

        // 初始加载 options
        void fetchProjects('');
        void fetchPlayers('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchProjects = async (keyword?: string) => {
        setProjectLoading(true);
        try {
            const res = await getGameProjectOptions({ keyword: keyword || '' });
            const list = Array.isArray(res) ? res : (res?.data ?? []);

            const options: ProjectOptionItem[] = list.map((p: any) => ({
                value: Number(p.id),
                label: `${p.name}${p.price != null ? `（¥${p.price}）` : ''}`,
                // ✅ 同步用：项目默认保底（字段名按你后端 GameProject：baseAmount）
                baseAmount: p.baseAmount ?? null,
            }));

            setProjectOptions(options);
        } catch (e) {
            // 不打断用户填写
            console.error(e);
        } finally {
            setProjectLoading(false);
        }
    };

    const fetchPlayers = async (keyword?: string) => {
        setPlayerLoading(true);
        try {
            const res = await getPlayerOptions({ keyword: keyword || '', onlyIdle: true, onlyOnline: true });
            const list = Array.isArray(res) ? res : (res?.data ?? []);
            const options: OptionItem[] = list.map((u: any) => ({
                value: Number(u.id),
                label: `${u.name || '未命名'}（${maskPhone(u.phone)}）`,
            }));
            setPlayerOptions(options);
        } catch (e) {
            console.error(e);
        } finally {
            setPlayerLoading(false);
        }
    };

    const onFinish = async (values: any) => {
        try {
            setSubmitting(true);

            const playerIds: number[] = Array.isArray(values.playerIds)
                ? values.playerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
                : [];

            if (playerIds.length > MAX_PLAYERS) {
                message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
                return;
            }

            const bonusAttributionType = String(values.bonusAttributionType || 'NONE');
            const isRenewal = bonusAttributionType === 'RENEWAL' || Boolean(values.isRenewal);
            const isDesignated = bonusAttributionType === 'DESIGNATED' || Boolean(values.isDesignated);
            const renewalPlayerIds: number[] = isRenewal && Array.isArray(values.renewalPlayerIds)
                ? values.renewalPlayerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
                : [];
            const designatedPlayerIds: number[] = isDesignated && Array.isArray(values.designatedPlayerIds)
                ? values.designatedPlayerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
                : [];
            if (isRenewal && isDesignated) {
                message.warning('续单和指定只能二选一');
                return;
            }
            const attributionPlayerIds = isDesignated ? designatedPlayerIds : renewalPlayerIds;
            const attributionLabel = isDesignated ? '指定' : '续单';
            if (isRenewal || isDesignated) {
                if (!playerIds.length) {
                    message.warning(`${attributionLabel}必须先选择派单打手`);
                    return;
                }
                if (!attributionPlayerIds.length) {
                    message.warning(`请选择${attributionLabel}打手`);
                    return;
                }
                if (attributionPlayerIds.some((id) => !playerIds.includes(id))) {
                    message.warning(`${attributionLabel}打手必须从当前派单打手中选择`);
                    return;
                }
            }

            const customerIdentifierType = Boolean(values.customerIdentifierIsGameId) ? 'GAME_ID' : 'ALIAS';
            const customerIdentifier = String(values.customerGameId || '').trim();
            const payload = {
                projectId: Number(values.projectId),
                receivableAmount: Number(values.receivableAmount),
                paidAmount: Number(values.paidAmount),
                baseAmountWan: values.baseAmountWan != null && values.baseAmountWan !== ''
                    ? Number(values.baseAmountWan)
                    : undefined,

                customerIdentifierType,
                customerOriginalIdentifier: customerIdentifier || undefined,
                customerGameId: customerIdentifierType === 'GAME_ID' ? (customerIdentifier || undefined) : undefined,

                // 时间：默认当前时间
                orderTime: values.orderTime ? dayjs(values.orderTime).toISOString() : now.toISOString(),
                paymentTime: values.paymentTime ? dayjs(values.paymentTime).toISOString() : now.toISOString(),

                inviter: isRenewal ? undefined : (values.inviter?.trim() || undefined),

                // 比例：例如 0.01/0.05
                csRate: values.csRate != null && values.csRate !== '' ? Number(values.csRate) : undefined,
                inviteRate: isRenewal ? 0 : (values.inviteRate != null && values.inviteRate !== '' ? Number(values.inviteRate) : undefined),
                customClubRate:
                    values.customClubRate != null && values.customClubRate !== ''
                        ? Number(values.customClubRate)
                        : undefined,

                remark: values.remark?.trim() || undefined,
                playerIds,
                isRenewal,
                renewalPlayerIds: isRenewal ? renewalPlayerIds : undefined,
                isDesignated,
                designatedPlayerIds: isDesignated ? designatedPlayerIds : undefined,
            };

            // 1) 创建订单（✅ 以表单传递值为准）
            const created = await createOrder(payload);

            const orderId = Number(created?.id ?? created?.data?.id);
            if (!orderId) {
                throw new Error('创建订单失败：未返回订单ID');
            }

            message.success('创建成功');
            history.push(`/orders/${orderId}`);
        } catch (err: any) {
            console.error(err);
            message.error(err?.response?.data?.message || err?.message || '创建失败');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <PageContainer>
            <Card title="新建订单" bordered={false}>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    initialValues={{
                        csRate: 0.01,
                        inviteRate: 0.05,
                        // orderTime/paymentTime 在 useEffect 里设为当前时间
                    }}
                >
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="projectId"
                                label="项目"
                                rules={[{ required: true, message: '请选择项目' }]}
                            >
                                <Select
                                    showSearch
                                    placeholder="输入筛选项目"
                                    filterOption={false}
                                    onSearch={(v) => fetchProjects(v)}
                                    options={projectOptions as any}
                                    loading={projectLoading}
                                    allowClear
                                    // ✅ 选择项目后同步“订单保底（万）”
                                    onChange={(_, option: any) => {
                                        const base = option?.baseAmount;
                                        form.setFieldsValue({
                                            baseAmountWan: base != null ? Number(base) : null,
                                        });
                                    }}
                                />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="playerIds" label={`派单打手（最多${MAX_PLAYERS}人，可不选）`}>
                                <Select
                                    mode="multiple"
                                    placeholder="输入姓名/手机号筛选，仅空闲可选"
                                    showSearch
                                    filterOption={false}
                                    onSearch={(v) => fetchPlayers(v)}
                                    loading={playerLoading}
                                    options={playerOptions}
                                    maxTagCount={2}
                                    onChange={(vals) => {
                                        if (Array.isArray(vals) && vals.length > MAX_PLAYERS) {
                                            message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
                                            // 自动截断到前 MAX_PLAYERS 个
                                            const nextIds = vals.slice(0, MAX_PLAYERS);
                                            form.setFieldsValue({
                                                playerIds: nextIds,
                                                renewalPlayerIds: Array.isArray(form.getFieldValue('renewalPlayerIds'))
                                                    ? form.getFieldValue('renewalPlayerIds').filter((id: number) => nextIds.includes(id))
                                                    : [],
                                                designatedPlayerIds: Array.isArray(form.getFieldValue('designatedPlayerIds'))
                                                    ? form.getFieldValue('designatedPlayerIds').filter((id: number) => nextIds.includes(id))
                                                    : [],
                                            });
                                            return;
                                        }
                                        const nextIds = Array.isArray(vals) ? vals.map((id: any) => Number(id)) : [];
                                        form.setFieldsValue({
                                            renewalPlayerIds: Array.isArray(form.getFieldValue('renewalPlayerIds'))
                                                ? form.getFieldValue('renewalPlayerIds').filter((id: number) => nextIds.includes(id))
                                                : [],
                                            designatedPlayerIds: Array.isArray(form.getFieldValue('designatedPlayerIds'))
                                                ? form.getFieldValue('designatedPlayerIds').filter((id: number) => nextIds.includes(id))
                                                : [],
                                            isRenewal: nextIds.length ? form.getFieldValue('isRenewal') : false,
                                            isDesignated: nextIds.length ? form.getFieldValue('isDesignated') : false,
                                        });
                                    }}
                                    allowClear
                                />
                            </Form.Item>
                        </Col>

                        <Col span={24}>
                            <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                <Form.Item name="bonusAttributionType" label="分红归因" initialValue="NONE" style={{ marginBottom: 0 }}>
                                    <Radio.Group
                                        optionType="button"
                                        buttonStyle="solid"
                                        onChange={(e) => {
                                            const v = String(e?.target?.value || 'NONE');
                                            form.setFieldsValue({
                                                isRenewal: v === 'RENEWAL',
                                                renewalPlayerIds: v === 'RENEWAL' ? form.getFieldValue('renewalPlayerIds') : [],
                                                isDesignated: v === 'DESIGNATED',
                                                designatedPlayerIds: v === 'DESIGNATED' ? form.getFieldValue('designatedPlayerIds') : [],
                                            });
                                        }}
                                    >
                                        <Radio.Button value="NONE">普通</Radio.Button>
                                        <Radio.Button value="RENEWAL">续单</Radio.Button>
                                        <Radio.Button value="DESIGNATED">指定</Radio.Button>
                                    </Radio.Group>
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
                                                    const item = playerOptions.find((p) => Number(p.value) === playerId);
                                                    return (
                                                        <Checkbox key={playerId} value={playerId}>
                                                            {item?.label || `#${playerId}`}
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
                                                    const item = playerOptions.find((p) => Number(p.value) === playerId);
                                                    return (
                                                        <Checkbox key={playerId} value={playerId}>
                                                            {item?.label || `#${playerId}`}
                                                        </Checkbox>
                                                    );
                                                })}
                                            </Space>
                                        </Checkbox.Group>
                                    </Form.Item>
                                ) : null}
                            </Space>
                        </Col>

                        <Col span={12}>
                            <Form.Item
                                name="receivableAmount"
                                label="应收金额"
                                rules={[{ required: true, message: '请输入应收金额' }]}
                            >
                                <InputNumber
                                    min={0}
                                    precision={2}
                                    style={{ width: '100%' }}
                                    placeholder="例如：200"
                                />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item
                                name="paidAmount"
                                label="实付金额"
                                rules={[{ required: true, message: '请输入实付金额' }]}
                            >
                                <InputNumber
                                    min={0}
                                    precision={2}
                                    style={{ width: '100%' }}
                                    placeholder="例如：200"
                                />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="orderTime" label="下单时间">
                                <DatePicker
                                    showTime
                                    style={{ width: '100%' }}
                                    placeholder="默认当前时间"
                                />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="paymentTime" label="付款时间">
                                <DatePicker
                                    showTime
                                    style={{ width: '100%' }}
                                    placeholder="默认当前时间"
                                />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="baseAmountWan" label="订单保底（万）">
                                <InputNumber
                                    min={0}
                                    precision={2}
                                    style={{ width: '100%' }}
                                    placeholder="小时单可不填；例如 1000"
                                />
                            </Form.Item>
                        </Col>

                        <Col span={24}>
                            <Form.Item label="客户标识">
                                <Input.Group compact>
                                    <Form.Item name="customerGameId" noStyle>
                                        <Input
                                            placeholder="客户提供的昵称 / ID / 房间号"
                                            allowClear
                                            style={{ width: 'calc(100% - 118px)' }}
                                        />
                                    </Form.Item>
                                    <Form.Item name="customerIdentifierIsGameId" valuePropName="checked" noStyle initialValue={false}>
                                        <Checkbox
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
                                    默认按昵称/房间号处理；勾选准确ID后，服务者存单/结单时不再要求补客户游戏ID。
                                </div>
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="inviter" label="邀请/推广人">
                                <Input placeholder={watchedIsRenewal ? '续单时推荐人失效' : '可填写昵称/来源'} disabled={watchedIsRenewal} allowClear />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="customClubRate" label="订单俱乐部抽成比例（可选）">
                                <InputNumber
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    precision={2}
                                    style={{ width: '100%' }}
                                    placeholder="例如 0.10 表示 10%"
                                />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="csRate" label="客服分佣比例（默认 1%）">
                                <InputNumber
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    precision={2}
                                    style={{ width: '100%' }}
                                    placeholder="例如 0.01 表示 1%"
                                />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="inviteRate" label="推广分佣比例（默认 5%）">
                                <InputNumber
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    precision={2}
                                    disabled={watchedIsRenewal}
                                    style={{ width: '100%' }}
                                    placeholder="例如 0.05 表示 5%"
                                />
                            </Form.Item>
                        </Col>

                        <Col span={24}>
                            <Form.Item name="remark" label="备注">
                                <Input.TextArea rows={2} placeholder="例如：客户指定打手/备注信息" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Space>
                            <Button
                                onClick={() => history.push('/orders')}
                                disabled={submitting}
                            >
                                返回列表
                            </Button>
                            <Button type="primary" htmlType="submit" loading={submitting}>
                                创建订单
                            </Button>
                        </Space>
                    </div>
                </Form>
            </Card>
        </PageContainer>
    );
};

export default NewOrderPage;
