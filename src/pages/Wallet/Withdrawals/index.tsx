import React, { useMemo, useRef, useState } from 'react';
import {Button, message, Tag, Space, Alert, Image, Card, Row, Col, Statistic, DatePicker, Popconfirm} from 'antd';
import type { ActionType } from '@ant-design/pro-components';
import { ModalForm, ProFormRadio, ProFormTextArea, ProTable } from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { cancelWithdrawal, getPendingWithdrawals, reviewWithdrawal, type WalletWithdrawalRequest } from '@/services/api';
import dayjs from "dayjs";

/**
 * ✅ 提现审批页（管理端）
 */
const formatDateTime = (value?: string) => {
    if (!value) return '-';
    return dayjs(value).format('YYYY-MM-DD HH:mm');
};
const WithdrawalsPage: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const { initialState } = useModel('@@initialState');

    const reviewerId = useMemo(() => {
        const cur = (initialState as any)?.currentUser;
        return Number(cur?.id || 0);
    }, [initialState]);

    const [reviewOpen, setReviewOpen] = useState(false);
    const [currentRow, setCurrentRow] = useState<any>(null);
    const [reviewError, setReviewError] = useState('');
    const [reviewSummaryDate, setReviewSummaryDate] = useState(dayjs());
    const reviewSummaryDateRef = useRef(dayjs().format('YYYY-MM-DD'));

    // ✅ 新增统计状态
    const [pendingCount, setPendingCount] = useState<number>(0);
    const [pendingAmount, setPendingAmount] = useState<number>(0);
    const [todayReviewSummary, setTodayReviewSummary] = useState<any>({
        approvedAmount: 0,
        approvedCount: 0,
        paidAmount: 0,
        paidCount: 0,
    });

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
                if (s === 'CANCELED') return <Tag>已废除</Tag>;
                return <Tag>{s}</Tag>;
            },
        },
        {
            title: '申请时间',
            dataIndex: 'createdAt',
            width: 180,
            renderText: (v:any) => formatDateTime(v),
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
            width: 240,
            render: (_: any, row: any) => {
                const disabled = row.status !== 'PENDING_REVIEW';

                const actions = [
                    <Button
                        key="review"
                        type="primary"
                        disabled={disabled}
                        onClick={() => {
                            if (!reviewerId) {
                                message.error('未获取到当前登录用户信息（reviewerId），请重新登录');
                                return;
                            }
                            setReviewError('');
                            setCurrentRow(row);
                            setReviewOpen(true);
                        }}
                    >
                        审批
                    </Button>,
                ];

                if (!['PAID', 'REJECTED', 'CANCELED'].includes(String(row.status || ''))) {
                    actions.push(
                        <Popconfirm
                            key="cancel"
                            title="直接废除该提现申请？"
                            description="用于处理账户已清零、冻结流水已冲正但提现申请仍残留的历史异常；如仍存在提现冻结，会同步释放回可用余额。"
                            okText="确认废除"
                            cancelText="取消"
                            onConfirm={async () => {
                                try {
                                    await cancelWithdrawal({
                                        requestId: Number(row.id),
                                        remark: '管理员在提现审批页直接废除历史异常提现申请',
                                    });
                                    message.success('提现申请已废除');
                                    actionRef.current?.reload();
                                } catch (e: any) {
                                    message.error(e?.data?.message || e?.response?.data?.message || e?.message || '废除失败');
                                }
                            }}
                        >
                            <Button danger>直接废除</Button>
                        </Popconfirm>,
                    );
                }

                return <Space>{actions}</Space>;
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
                    <Col>
                        <DatePicker
                            allowClear={false}
                            value={reviewSummaryDate}
                            onChange={(value) => {
                                const next = value || dayjs();
                                reviewSummaryDateRef.current = next.format('YYYY-MM-DD');
                                setReviewSummaryDate(next);
                                setTimeout(() => actionRef.current?.reload(), 0);
                            }}
                        />
                        <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>审核统计日期</div>
                    </Col>
                    <Col>
                        <Statistic
                            title={`${reviewSummaryDate.format('YYYY-MM-DD')} 审核通过总计`}
                            value={todayReviewSummary.approvedAmount}
                            precision={2}
                            prefix="¥"
                        />
                        <div style={{ color: '#666', fontSize: 12 }}>笔数：{todayReviewSummary.approvedCount}</div>
                    </Col>
                    <Col>
                        <Statistic
                            title={`${reviewSummaryDate.format('YYYY-MM-DD')} 审核放款总计`}
                            value={todayReviewSummary.paidAmount}
                            precision={2}
                            prefix="¥"
                            valueStyle={{ color: '#389e0d' }}
                        />
                        <div style={{ color: '#666', fontSize: 12 }}>笔数：{todayReviewSummary.paidCount}</div>
                    </Col>
                </Row>
            </Card>

            <ProTable<WalletWithdrawalRequest>
                headerTitle="待审核提现"
                rowKey="id"
                actionRef={actionRef}
                search={false}
                request={async () => {
                    const res = await getPendingWithdrawals({
                        reviewDate: reviewSummaryDateRef.current,
                    });

                    const list = Array.isArray(res)
                        ? res
                        : (res as any)?.list || [];

                    if (!Array.isArray(res)) {
                        setPendingCount((res as any)?.count || 0);
                        setPendingAmount((res as any)?.totalAmount || 0);
                        setTodayReviewSummary((res as any)?.todayReviewSummary || {
                            approvedAmount: 0,
                            approvedCount: 0,
                            paidAmount: 0,
                            paidCount: 0,
                        });
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
                layout="vertical"
                width={820}
                modalProps={{
                    destroyOnClose: true,
                    className: 'bc-admin-form-modal',
                    onCancel: () => {
                        setReviewOpen(false);
                        setCurrentRow(null);
                        setReviewError('');
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
                        setReviewError('');
                        actionRef.current?.reload();
                        return true;
                    } catch (e: any) {
                        const msg =
                            e?.data?.message ||
                            e?.response?.data?.message ||
                            e?.message ||
                            '审批失败';
                        setReviewError(msg);
                        message.error(msg);
                        return false;
                    }
                }}
            >
                {/* ✅ 审批详情：钱包数据 + 收款码 */}
                <div className="bc-admin-form">
                    {currentRow ? (
                        <Space direction="vertical" style={{ width: '100%' }} size={12}>
                            <div className="bc-admin-form-summary">
                                <div className="bc-admin-form-summary-card info">
                                    <div className="bc-admin-form-summary-label">申请人</div>
                                    <div className="bc-admin-form-summary-value">{currentRow?.user?.nickname || currentRow?.user?.name || currentRow.userId}</div>
                                </div>
                                <div className="bc-admin-form-summary-card danger">
                                    <div className="bc-admin-form-summary-label">申请金额</div>
                                    <div className="bc-admin-form-summary-value">¥{Number(currentRow.amount || 0).toFixed(2)}</div>
                                </div>
                                <div className="bc-admin-form-summary-card info">
                                    <div className="bc-admin-form-summary-label">可用余额</div>
                                    <div className="bc-admin-form-summary-value">¥{Number(currentRow?.wallet?.availableBalance || 0).toFixed(2)}</div>
                                </div>
                                <div className="bc-admin-form-summary-card warning">
                                    <div className="bc-admin-form-summary-label">冻结余额</div>
                                    <div className="bc-admin-form-summary-value">¥{Number(currentRow?.wallet?.frozenBalance || 0).toFixed(2)}</div>
                                </div>
                            </div>

                            <div className="bc-admin-form-section">
                                <div className="bc-admin-form-section-title">审核提示</div>
                                <Alert
                                    type={reviewError.includes('钱包冻结余额存在缺口') ? 'error' : 'info'}
                                    showIcon
                                    message={reviewError || '如遇冻结余额缺口，可直接进入单用户异常修复页排查'}
                                    action={
                                        <Button
                                            size="small"
                                            type="primary"
                                            onClick={() => {
                                                const userId = Number(currentRow?.userId || 0);
                                                if (!Number.isFinite(userId) || userId <= 0) {
                                                    message.error('缺少用户ID，无法跳转异常修复');
                                                    return;
                                                }
                                                history.push(`/wallet/replay-preview?userId=${userId}&mode=full&autostart=1`);
                                            }}
                                        >
                                            前往异常修复
                                        </Button>
                                    }
                                />
                            </div>

                            <div className="bc-admin-form-section">
                                <div className="bc-admin-form-section-title">收款信息</div>
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
                            </div>
                        </Space>
                    ) : null}

                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">审批结论</div>
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
                    </div>
                </div>
            </ModalForm>
        </>
    );
};

export default WithdrawalsPage;
