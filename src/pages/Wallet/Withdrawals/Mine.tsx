import React, { useMemo, useRef, useState } from 'react';
import { Button, message, Tag } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ModalForm, ProFormDigit, ProFormTextArea, ProTable } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { applyWithdrawal, getMyWithdrawals, type WalletWithdrawalRequest } from '@/services/api';

/**
 * ✅ 我的提现（admin 里临时放：申请 + 我的记录）
 * - 后续你接 H5/微信授权后，可迁移到打手端
 */
const WithdrawalMine: React.FC = () => {
    const actionRef = useRef<ActionType>();
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

    // ✅ 简单 uuid（无需额外依赖）
    const genIdempotencyKey = () => {
        // RFC4122 v4 简版
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    };

    const columns: ProColumns<WalletWithdrawalRequest>[] = [
        { title: '申请单号', dataIndex: 'requestNo', width: 160, copyable: true },
        { title: '金额', dataIndex: 'amount', width: 120, render: (_, row) => <span>{Number(row.amount || 0).toFixed(2)}</span> },
        {
            title: '状态',
            dataIndex: 'status',
            width: 140,
            render: (_, row) => {
                const s = row.status;
                if (s === 'PENDING_REVIEW') return <Tag color="processing">待审核</Tag>;
                if (s === 'APPROVED') return <Tag color="success">已通过</Tag>;
                if (s === 'REJECTED') return <Tag color="error">已驳回</Tag>;
                if (s === 'PAYING') return <Tag color="warning">打款中</Tag>;
                if (s === 'PAID') return <Tag color="success">已打款</Tag>;
                if (s === 'FAILED') return <Tag color="error">打款失败</Tag>;
                return <Tag>{s}</Tag>;
            },
        },
        { title: '渠道', dataIndex: 'channel', width: 100, render: (_, row) => (row.channel === 'WECHAT' ? <Tag>微信</Tag> : <Tag>人工</Tag>) },
        { title: '审批备注', dataIndex: 'reviewRemark', search: false, ellipsis: true },
        { title: '失败原因', dataIndex: 'failReason', search: false, ellipsis: true },
        { title: '申请时间', dataIndex: 'createdAt', width: 180, search: false },
    ];

    return (
        <>
            <ProTable<WalletWithdrawalRequest>
                headerTitle="我的提现（申请 + 记录）"
                rowKey="id"
                actionRef={actionRef}
                search={false}
                toolBarRender={() => [
                    <Button
                        key="apply"
                        type="primary"
                        onClick={() => {
                            if (!userId) {
                                message.error('未获取到当前登录用户信息，请重新登录');
                                return;
                            }
                            setOpen(true);
                        }}
                    >
                        申请提现
                    </Button>,
                    <Button key="refresh" onClick={() => actionRef.current?.reload()}>
                        刷新
                    </Button>,
                ]}
                request={async () => {
                    if (!userId) return { data: [], success: true };
                    const list = await getMyWithdrawals(userId);
                    return { data: Array.isArray(list) ? list : [], success: true };
                }}
                columns={columns}
                pagination={{ pageSize: 20 }}
            />

            <ModalForm<{ amount: number; remark?: string }>
                title="申请提现"
                open={open}
                modalProps={{
                    destroyOnClose: true,
                    onCancel: () => setOpen(false),
                }}
                onFinish={async (values) => {
                    try {
                        // ✅ 幂等键：防止重复提交（比如用户连续点击）
                        const idempotencyKey = genIdempotencyKey();

                        await applyWithdrawal({
                            userId,
                            amount: Number(values.amount),
                            idempotencyKey,
                            remark: values.remark || '',
                            channel: 'MANUAL', // ✅ 你后续接微信后，这里可切换为 WECHAT
                        });

                        message.success('提现申请已提交，等待审核');
                        setOpen(false);
                        actionRef.current?.reload();
                        return true;
                    } catch (e: any) {
                        const msg = e?.data?.message || e?.response?.data?.message || e?.message || '申请失败';
                        message.error(msg);
                        return false;
                    }
                }}
            >
                <ProFormDigit
                    name="amount"
                    label="提现金额"
                    min={0.01}
                    fieldProps={{ precision: 2 }}
                    rules={[{ required: true, message: '请输入提现金额' }]}
                />
                <ProFormTextArea
                    name="remark"
                    label="备注"
                    placeholder="可选：填写申请说明"
                    fieldProps={{ rows: 3, maxLength: 200 }}
                />
            </ModalForm>
        </>
    );
};

export default WithdrawalMine;
