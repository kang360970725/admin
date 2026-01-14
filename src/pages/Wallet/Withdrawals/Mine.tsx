import React, { useMemo, useRef, useState } from 'react';
import { Button, message, Tag, Space, Typography, Alert, Tooltip } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ModalForm, ProFormDigit, ProFormTextArea, ProTable } from '@ant-design/pro-components';
import type { FormInstance } from 'antd';
import { useModel } from '@umijs/max';
import { applyWithdrawal, getMyWithdrawals, type WalletWithdrawalRequest } from '@/services/api';
import { WechatOutlined, AlipayOutlined } from '@ant-design/icons';
import { ProFormRadio } from '@ant-design/pro-components';


const { Text } = Typography;

type Props = {
    availableBalance: number;
    onApplied?: () => void; // ✅ 提现申请成功后，让父组件刷新余额
};

/**
 * ✅ 我的提现（admin 里临时放：申请 + 我的记录）
 * - 后续你接 H5/微信授权后，可迁移到打手端
 */
const WithdrawalMine: React.FC<Props> = ({ availableBalance, onApplied }) => {
    const actionRef = useRef<ActionType>();
    const formRef = useRef<FormInstance>();
    const { initialState } = useModel('@@initialState');

    const userId = useMemo(() => {
        const idFromState = (initialState as any)?.currentUser?.id;
        if (idFromState) return Number(idFromState);
        try {
            const cached = localStorage.getItem('currentUser');
            if (cached) {
                const u = JSON.parse(cached);
                if (u?.id) return Number(u.id);
            }
        } catch {}
        return 0;
    }, [initialState]);

    const [open, setOpen] = useState(false);
    const [withdrawals, setWithdrawals] = useState<WalletWithdrawalRequest[]>([]);

    // ✅ 简单 uuid（无需额外依赖）
    const genIdempotencyKey = () => {
        // RFC4122 v4 简版
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    };

    // ✅ 有正在审批/进行中的提现：禁止再次申请
    const hasPending = useMemo(() => {
        const list = Array.isArray(withdrawals) ? withdrawals : [];
        return list.some((w: any) => w?.status === 'PENDING_REVIEW' || w?.status === 'PAYING');
    }, [withdrawals]);

    // ✅ 最大可提：必须是 10 的倍数，且 <= 可用余额
    const maxWithdraw = useMemo(() => {
        const av = Number(availableBalance ?? 0);
        if (!Number.isFinite(av) || av <= 0) return 0;
        // 只允许 10 的整数：向下取整到 10 的倍数
        return Math.floor(av / 10) * 10;
    }, [availableBalance]);

    const columns: any = [
        { title: '申请单号', dataIndex: 'requestNo', width: 160, copyable: true },
        {
            title: '金额',
            dataIndex: 'amount',
            width: 120,
            render: (_, row) => <span>{Number((row as any).amount || 0).toFixed(2)}</span>,
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 140,
            render: (_, row) => {
                const s = (row as any).status;
                if (s === 'PENDING_REVIEW') return <Tag color="processing">待审核</Tag>;
                if (s === 'APPROVED') return <Tag color="success">已通过</Tag>;
                if (s === 'REJECTED') return <Tag color="error">已驳回</Tag>;
                if (s === 'PAYING') return <Tag color="warning">打款中</Tag>;
                if (s === 'PAID') return <Tag color="success">已打款</Tag>;
                if (s === 'FAILED') return <Tag color="error">打款失败</Tag>;
                return <Tag>{String(s || '-')}</Tag>;
            },
        },
        {
            title: '渠道',
            dataIndex: 'channel',
            width: 100,
            render: (_, row) => ((row as any).channel === 'WECHAT' ? <Tag>微信</Tag> : <Tag>人工</Tag>),
        },
        { title: '审批备注', dataIndex: 'reviewRemark', search: false, ellipsis: true },
        { title: '失败原因', dataIndex: 'failReason', search: false, ellipsis: true },
        { title: '申请时间', dataIndex: 'createdAt', width: 220, search: false },
    ];

    return (
        <>
            <ProTable<WalletWithdrawalRequest>
                headerTitle="提现记录"
                rowKey="id"
                actionRef={actionRef}
                search={false}
                toolBarRender={() => [
                    <Tooltip
                        key="apply"
                        title={hasPending ? '存在待审核/打款中的提现申请，暂不可重复申请' : ''}
                    >
                        <Button
                            type="primary"
                            disabled={hasPending || maxWithdraw <= 0}
                            onClick={() => {
                                if (!userId) {
                                    message.error('未获取到当前登录用户信息，请重新登录');
                                    return;
                                }
                                if (hasPending) {
                                    message.warning('存在待审核/打款中的提现申请，暂不可重复申请');
                                    return;
                                }
                                if (maxWithdraw <= 0) {
                                    message.warning('可用余额不足，无法申请提现（需至少 10 元）');
                                    return;
                                }

                                // ✅ 打开时默认填一个合理值：maxWithdraw
                                setOpen(true);
                                setTimeout(() => {
                                    formRef.current?.setFieldsValue({ amount: maxWithdraw });
                                }, 0);
                            }}
                        >
                            申请提现
                        </Button>
                    </Tooltip>,
                    <Button key="refresh" onClick={() => actionRef.current?.reload()}>
                        刷新
                    </Button>,
                ]}
                request={async () => {
                    if (!userId) return { data: [], success: true };
                    const list = await getMyWithdrawals(userId);
                    const arr = Array.isArray(list) ? (list as any[]) : [];
                    setWithdrawals(arr as any);
                    return { data: arr as any, success: true };
                }}
                columns={columns}
                pagination={{ pageSize: 20 }}
            />

            <ModalForm<{ amount: number; channel: 'MANUAL' | 'WECHAT' | 'ALIPAY'; remark?: string }>
                title="申请提现"
                formRef={formRef}
                open={open}
                modalProps={{
                    destroyOnClose: true,
                    onCancel: () => setOpen(false),
                }}
                submitter={{
                    searchConfig: { submitText: '提交申请' },
                }}
                onFinish={async (values) => {
                    try {
                        if (hasPending) {
                            message.warning('存在待审核/打款中的提现申请，暂不可重复申请');
                            return false;
                        }

                        const amount = Number(values.amount);
                        if (!Number.isFinite(amount) || amount <= 0) {
                            message.error('提现金额非法');
                            return false;
                        }
                        if (amount % 10 !== 0) {
                            message.error('提现金额必须是 10 的整数');
                            return false;
                        }
                        if (amount > maxWithdraw) {
                            message.error(`提现金额不能超过可用余额上限（${maxWithdraw}）`);
                            return false;
                        }

                        // ✅ 幂等键：防止重复提交（比如用户连续点击）
                        const idempotencyKey = genIdempotencyKey();

                        await applyWithdrawal({
                            userId,
                            amount,
                            idempotencyKey,
                            remark: values.remark || '',
                            channel: values.channel || 'MANUAL', // ✅ 本期只能选 MANUAL，但这里直接按表单值传
                        });

                        message.success('提现申请已提交，等待审核');
                        setOpen(false);
                        actionRef.current?.reload();
                        onApplied?.(); // ✅ 刷新父组件余额
                        return true;
                    } catch (e: any) {
                        const msg = e?.data?.message || e?.response?.data?.message || e?.message || '申请失败';
                        message.error(msg);
                        return false;
                    }
                }}
            >
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    <Alert
                        type="info"
                        showIcon
                        message={
                            <Space>
                                <Text>可用余额：</Text>
                                <Text strong>{Number(availableBalance || 0).toFixed(2)}</Text>
                                <Text type="secondary">（本次最多可提：{maxWithdraw}，最少提现10元）</Text>
                            </Space>
                        }
                    />

                    {hasPending ? (
                        <Alert
                            type="warning"
                            showIcon
                            message="你有一笔提现正在审核/打款中，当前无法再次申请提现。"
                        />
                    ) : null}
                    <ProFormRadio.Group
                        name="channel"
                        label="提现渠道"
                        initialValue="MANUAL"
                        rules={[{ required: true, message: '请选择提现渠道' }]}
                        options={[
                            {
                                label: (
                                    <Space>
                                        <Tag color="gold">线下</Tag>
                                        <Text strong>人工审核</Text>
                                        <Text type="secondary">（手动转款）</Text>
                                    </Space>
                                ),
                                value: 'MANUAL',
                            },
                            {
                                label: (
                                    <Space>
                                        <WechatOutlined style={{ color: '#07C160' }} />
                                        <Text strong style={{ color: '#07C160' }}>
                                            微信
                                        </Text>
                                        <Text type="secondary">（即将上线）</Text>
                                    </Space>
                                ),
                                value: 'WECHAT',
                                disabled: true, // ✅ 本期置灰不可选
                            },
                            {
                                label: (
                                    <Space>
                                        <AlipayOutlined style={{ color: '#1677ff' }} />
                                        <Text strong style={{ color: '#1677ff' }}>
                                            支付宝
                                        </Text>
                                        <Text type="secondary">（即将上线）</Text>
                                    </Space>
                                ),
                                value: 'ALIPAY',
                                disabled: true, // ✅ 本期置灰不可选
                            },
                        ]}
                    />

                    <Text type="secondary" style={{ display: 'block', marginTop: -6 }}>
                        线上渠道功能即将上线，敬请期待～
                    </Text>


                    <ProFormDigit
                        name="amount"
                        label="提现金额"
                        min={10}
                        max={maxWithdraw}
                        fieldProps={{
                            precision: 0, // ✅ 强制整数
                            step: 10,
                            placeholder: '最少提现10元',
                            addonAfter: (
                                <Button
                                    size="small"
                                    type="link"
                                    disabled={hasPending || maxWithdraw <= 0}
                                    onClick={() => formRef.current?.setFieldsValue({ amount: maxWithdraw })}
                                >
                                    全部提现
                                </Button>
                            ),
                        }}
                        rules={[
                            { required: true, message: '请输入提现金额' },
                            {
                                validator: async (_, v) => {
                                    const n = Number(v);
                                    if (!Number.isFinite(n) || n <= 0) throw new Error('提现金额非法');
                                    if (n % 10 !== 0) throw new Error('提现金额必须是 10 的整数');
                                    if (n > maxWithdraw) throw new Error(`不能提现超过 ${maxWithdraw}`);
                                },
                            },
                        ]}
                    />

                    <ProFormTextArea
                        name="remark"
                        label="备注"
                        placeholder="可选：填写申请说明"
                        fieldProps={{ rows: 3, maxLength: 200 }}
                    />
                </Space>
            </ModalForm>
        </>
    );
};

export default WithdrawalMine;
