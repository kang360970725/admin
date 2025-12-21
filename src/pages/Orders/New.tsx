// src/pages/Orders/New.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Form, Input, InputNumber, Select, DatePicker, Button, Row, Col, Space, message } from 'antd';
import dayjs from 'dayjs';
import { history } from '@umijs/max';

import {
    createOrder,
    assignDispatch,
    getGameProjectOptions,
    getPlayerOptions,
} from '@/services/api';

type OptionItem = { label: string; value: number };

const MAX_PLAYERS = 2;

const NewOrderPage: React.FC = () => {
    const [form] = Form.useForm();

    const [submitting, setSubmitting] = useState(false);

    // 项目下拉
    const [projectOptions, setProjectOptions] = useState<OptionItem[]>([]);
    const [projectLoading, setProjectLoading] = useState(false);

    // 打手下拉（默认只取空闲）
    const [playerOptions, setPlayerOptions] = useState<OptionItem[]>([]);
    const [playerLoading, setPlayerLoading] = useState(false);

    const now = useMemo(() => dayjs(), []);

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
            const options: OptionItem[] = list.map((p: any) => ({
                value: Number(p.id),
                label: `${p.name}${p.price != null ? `（¥${p.price}）` : ''}`,
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
            const res = await getPlayerOptions({ keyword: keyword || '', onlyIdle: true });
            const list = Array.isArray(res) ? res : (res?.data ?? []);
            const options: OptionItem[] = list.map((u: any) => ({
                value: Number(u.id),
                label: `${u.name || '未命名'}（${u.phone || '-'}）`,
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

            const payload = {
                projectId: Number(values.projectId),
                receivableAmount: Number(values.receivableAmount),
                paidAmount: Number(values.paidAmount),
                baseAmountWan: values.baseAmountWan != null && values.baseAmountWan !== ''
                    ? Number(values.baseAmountWan)
                    : undefined,

                customerGameId: values.customerGameId?.trim() || undefined,

                // 时间：默认当前时间
                orderTime: values.orderTime ? dayjs(values.orderTime).toISOString() : now.toISOString(),
                paymentTime: values.paymentTime ? dayjs(values.paymentTime).toISOString() : now.toISOString(),

                inviter: values.inviter?.trim() || undefined,

                // 比例：例如 0.01/0.05
                csRate: values.csRate != null && values.csRate !== '' ? Number(values.csRate) : undefined,
                inviteRate: values.inviteRate != null && values.inviteRate !== '' ? Number(values.inviteRate) : undefined,
                customClubRate:
                    values.customClubRate != null && values.customClubRate !== ''
                        ? Number(values.customClubRate)
                        : undefined,

                remark: values.remark?.trim() || undefined,
            };

            // 1) 创建订单
            const created = await createOrder(payload);

            const orderId = Number(created?.id ?? created?.data?.id);
            if (!orderId) {
                throw new Error('创建订单失败：未返回订单ID');
            }

            // 2) 新建即派单（可选）
            if (playerIds.length > 0) {
                await assignDispatch(orderId, { playerIds, remark: '新建订单时派单' });
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
                                    options={projectOptions}
                                    loading={projectLoading}
                                    allowClear
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
                                            form.setFieldValue('playerIds', vals.slice(0, MAX_PLAYERS));
                                        }
                                    }}
                                    allowClear
                                />
                            </Form.Item>
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

                        <Col span={12}>
                            <Form.Item name="customerGameId" label="客户游戏ID/昵称">
                                <Input placeholder="例如：峡谷之巅-xxx" allowClear />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="inviter" label="邀请/推广人">
                                <Input placeholder="可填写昵称/来源" allowClear />
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
