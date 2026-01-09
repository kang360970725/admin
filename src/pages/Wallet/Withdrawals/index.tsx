import React, { useMemo, useRef, useState } from 'react';
import { Button, message, Tag } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ModalForm, ProFormRadio, ProFormTextArea, ProTable } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { getPendingWithdrawals, reviewWithdrawal, type WalletWithdrawalRequest } from '@/services/api';

/**
 * ✅ 提现审批页（管理端）
 * - 展示：待审核列表（PENDING_REVIEW）
 * - 操作：通过 / 驳回（都需要审批备注可选）
 * - 注意：后端要求传 reviewerId（审批人ID），这里从 currentUser.id 获取
 */
const WithdrawalsPage: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const { initialState } = useModel('@@initialState');

    // 当前登录用户（审批人）
    const reviewerId = useMemo(() => {
        // 1) 优先用 initialState（标准）
        const idFromState = (initialState as any)?.currentUser?.id;
        if (idFromState) return Number(idFromState);

        // 2) 兜底读 localStorage（你 app.tsx 里有写入 currentUser）:contentReference[oaicite:7]{index=7}
        try {
            const cached = localStorage.getItem('currentUser');
            if (cached) {
                const u = JSON.parse(cached);
                if (u?.id) return Number(u.id);
            }
        } catch (e) {
            // ignore
        }
        return 0;
    }, [initialState]);

    // 审批弹窗状态
    const [reviewOpen, setReviewOpen] = useState(false);
    const [currentRow, setCurrentRow] = useState<WalletWithdrawalRequest | null>(null);

    const columns: any = [
        {
            title: '申请单号',
            dataIndex: 'requestNo',
            width: 160,
            copyable: true,
        },
        {
            title: '申请人ID',
            dataIndex: 'userId',
            width: 100,
            search: false,
        },
        {
            title: '金额',
            dataIndex: 'amount',
            width: 120,
            search: false,
            render: (_, row) => <span>{Number(row.amount || 0).toFixed(2)}</span>,
        },
        {
            title: '渠道',
            dataIndex: 'channel',
            width: 100,
            search: false,
            render: (_, row) => {
                const ch = row.channel;
                if (ch === 'WECHAT') return <Tag>微信</Tag>;
                return <Tag>人工</Tag>;
            },
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 140,
            search: false,
            render: (_, row) => {
                // 本页默认只看 PENDING_REVIEW，但仍做兜底显示
                const s = row.status;
                if (s === 'PENDING_REVIEW') return <Tag color="processing">待审核</Tag>;
                if (s === 'APPROVED') return <Tag color="success">已通过</Tag>;
                if (s === 'REJECTED') return <Tag color="error">已驳回</Tag>;
                if (s === 'PAYING') return <Tag color="warning">打款中</Tag>;
                if (s === 'PAID') return <Tag color="success">已打款</Tag>;
                if (s === 'FAILED') return <Tag color="error">打款失败</Tag>;
                if (s === 'CANCELED') return <Tag>已取消</Tag>;
                return <Tag>{s}</Tag>;
            },
        },
        {
            title: '申请时间',
            dataIndex: 'createdAt',
            width: 180,
            search: false,
        },
        {
            title: '备注',
            dataIndex: 'remark',
            search: false,
            ellipsis: true,
        },
        {
            title: '操作',
            valueType: 'option',
            width: 180,
            render: (_, row) => {
                // ✅ 仅待审核可操作
                const disabled = row.status !== 'PENDING_REVIEW';

                return [
                    <Button
                        key="review"
                        type="primary"
                        disabled={disabled}
                        onClick={() => {
                            // reviewerId 为 0 说明没取到当前用户（鉴权异常/缓存缺失）
                            if (!reviewerId) {
                                message.error('未获取到当前登录用户信息（reviewerId），请重新登录');
                                return;
                            }
                            setCurrentRow(row);
                            setReviewOpen(true);
                        }}
                    >
                        审批
                    </Button>,
                ];
            },
        },
    ];

    return (
        <>
            <ProTable<WalletWithdrawalRequest>
                headerTitle="提现审批（待审核）"
                rowKey="id"
                actionRef={actionRef}
                search={false}
                toolBarRender={() => [
                    <Button
                        key="refresh"
                        onClick={() => actionRef.current?.reload()}
                    >
                        刷新
                    </Button>,
                ]}
                request={async () => {
                    // ✅ 这里按你的后端：GET /wallet/withdrawals/pending
                    // 返回是数组；ProTable 期望 { data, success }
                    const list = await getPendingWithdrawals();
                    return {
                        data: Array.isArray(list) ? list : [],
                        success: true,
                    };
                }}
                columns={columns}
                pagination={{ pageSize: 20 }}
            />

            {/* ✅ 审批弹窗：通过/驳回 */}
            <ModalForm<{
                approve: boolean;
                reviewRemark?: string;
            }>
                title={currentRow ? `审批提现 - ${currentRow.requestNo}` : '审批提现'}
                open={reviewOpen}
                modalProps={{
                    destroyOnClose: true,
                    onCancel: () => {
                        setReviewOpen(false);
                        setCurrentRow(null);
                    },
                }}
                initialValues={{
                    approve: true,
                    reviewRemark: '',
                }}
                onFinish={async (values) => {
                    if (!currentRow) return false;

                    try {
                        await reviewWithdrawal({
                            requestId: currentRow.id,
                            reviewerId,
                            approve: Boolean(values.approve),
                            reviewRemark: values.reviewRemark || '',
                        });

                        message.success(values.approve ? '已通过' : '已驳回');

                        // 关闭弹窗并刷新列表
                        setReviewOpen(false);
                        setCurrentRow(null);
                        actionRef.current?.reload();
                        return true;
                    } catch (e: any) {
                        // ✅ 统一错误提示：兼容 umi-request 的错误结构
                        const msg =
                            e?.data?.message ||
                            e?.response?.data?.message ||
                            e?.message ||
                            '审批失败';
                        message.error(msg);
                        return false;
                    }
                }}
            >
                <ProFormRadio.Group
                    name="approve"
                    label="审批结果"
                    rules={[{ required: true, message: '请选择审批结果' }]}
                    options={[
                        { label: '通过', value: true },
                        { label: '驳回', value: false },
                    ]}
                />
                <ProFormTextArea
                    name="reviewRemark"
                    label="审批备注"
                    placeholder="可选：填写审批说明（通过/驳回原因）"
                    fieldProps={{ rows: 3, maxLength: 200 }}
                />
            </ModalForm>
        </>
    );
};

export default WithdrawalsPage;
