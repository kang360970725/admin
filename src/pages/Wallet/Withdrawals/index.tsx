import React, { useMemo, useRef, useState } from 'react';
import {Button, message, Tag, Space, Alert, Descriptions, Image, Card, Row, Col, Statistic} from 'antd';
import type { ActionType } from '@ant-design/pro-components';
import { ModalForm, ProFormRadio, ProFormTextArea, ProTable } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { getPendingWithdrawals, reviewWithdrawal, type WalletWithdrawalRequest } from '@/services/api';

/**
 * ✅ 提现审批页（管理端）
 */
const WithdrawalsPage: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const { initialState } = useModel('@@initialState');

    const reviewerId = useMemo(() => {
        const cur = (initialState as any)?.currentUser;
        return Number(cur?.id || 0);
    }, [initialState]);

    const [reviewOpen, setReviewOpen] = useState(false);
    const [currentRow, setCurrentRow] = useState<any>(null);

    // ✅ 新增统计状态
    const [pendingCount, setPendingCount] = useState<number>(0);
    const [pendingAmount, setPendingAmount] = useState<number>(0);

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
            title: '用户昵称',
            dataIndex: 'user',
            width: 160,
            search: false,
            render: (_: any, row: any) => {
                const u = row?.user;
                return <span>{u?.nickname || u?.name || '-'}</span>;
            },
        },
        {
            title: '金额',
            dataIndex: 'amount',
            width: 120,
            search: false,
            render: (_: any, row: any) => <span>{Number(row.amount || 0).toFixed(2)}</span>,
        },
        {
            title: '渠道',
            dataIndex: 'channel',
            width: 100,
            search: false,
            render: (_: any, row: any) => {
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
            render: (_: any, row: any) => {
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
            render: (_: any, row: any) => {
                const disabled = row.status !== 'PENDING_REVIEW';

                return [
                    <Button
                        key="review"
                        type="primary"
                        disabled={disabled}
                        onClick={() => {
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
            {/* ✅ 顶部统计 */}
            <Card style={{ marginBottom: 16 }}>
                <Row gutter={24}>
                    <Col>
                        <Statistic title="待审核笔数" value={pendingCount} />
                    </Col>
                    <Col>
                        <Statistic
                            title="待审核总金额"
                            value={pendingAmount}
                            precision={2}
                            prefix="¥"
                            valueStyle={{ color: '#cf1322' }}
                        />
                    </Col>
                </Row>
            </Card>

            <ProTable<WalletWithdrawalRequest>
                headerTitle="待审核提现"
                rowKey="id"
                actionRef={actionRef}
                search={false}
                request={async () => {
                    const res = await getPendingWithdrawals();

                    const list = Array.isArray(res)
                        ? res
                        : (res as any)?.list || [];

                    if (!Array.isArray(res)) {
                        setPendingCount((res as any)?.count || 0);
                        setPendingAmount((res as any)?.totalAmount || 0);
                    }

                    return { data: list as any, success: true };
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
                        setReviewOpen(false);
                        setCurrentRow(null);
                        actionRef.current?.reload();
                        return true;
                    } catch (e: any) {
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
                {/* ✅ 审批详情：钱包数据 + 收款码 */}
                {currentRow ? (
                    <Space direction="vertical" style={{ width: '100%' }} size={12}>
                        <Alert
                            type="info"
                            showIcon
                            message={`申请人：${currentRow?.user?.nickname || currentRow?.user?.name || currentRow.userId}`}
                            description={`申请金额：${Number(currentRow.amount || 0).toFixed(2)} 元`}
                        />

                        <Descriptions bordered size="small" column={1}>
                            {(() => {
                                const w = currentRow?.wallet;
                                const available = Number(w?.availableBalance || 0);
                                const frozen = Number(w?.frozenBalance || 0);
                                const total = available + frozen;
                                return (
                                    <>
                                        <Descriptions.Item label="总余额">
                                            {total.toFixed(2)}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="可用余额">
                                            {available.toFixed(2)}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="冻结余额">
                                            {frozen.toFixed(2)}
                                        </Descriptions.Item>
                                    </>
                                );
                            })()}
                        </Descriptions>

                        <Alert
                            type={currentRow?.withdrawQrCodeUrl ? 'success' : 'warning'}
                            showIcon
                            message={currentRow?.withdrawQrCodeUrl ? '已获取收款二维码' : '未获取到收款二维码（请提醒用户上传）'}
                            description={
                                currentRow?.withdrawQrCodeUrl ? (
                                    <Image
                                        src={currentRow.withdrawQrCodeUrl}
                                        width={180}
                                        style={{ borderRadius: 12 }}
                                    />
                                ) : (
                                    <span>该用户未上传或二维码不可用</span>
                                )
                            }
                        />
                    </Space>
                ) : null}

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
