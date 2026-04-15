import React from 'react';
import {
    Drawer,
    Tabs,
    Row,
    Col,
    Statistic,
    Tag,
    message,
    Button,
    Modal,
    InputNumber,
    Input,
} from 'antd';
import { ProTable } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import {
    getEnumDicts,
    getWalletTransactions,
    getWalletDepositTransactions,
    manualDeposit,
} from '@/services/api';

export default function UserWalletDrawer(props: any) {
    const { visible, user, onClose } = props;

    const wallet = user?.wallet || {};

    const available = Number(wallet?.availableBalance ?? 0);
    const frozen = Number(wallet?.frozenBalance ?? 0);
    const deposit = Number(wallet?.depositBalance ?? 0);
    const total = Number(wallet?.totalBalance ?? 0);

    const [depositModal, setDepositModal] = React.useState(false);
    const [depositAmount, setDepositAmount] = React.useState<number>(0);
    const [depositRemark, setDepositRemark] = React.useState('');

    const [enums, setEnums] = React.useState<any>({});

    React.useEffect(() => {
        (async () => {
            try {
                const dicts = await getEnumDicts();
                setEnums(dicts || {});
            } catch (e: any) {
                message.warning(e?.message || '加载字典失败');
            }
        })();
    }, []);

    const getEnumText = (groupKey: string, code?: string) => {
        if (!code) return '--';
        const dict = enums?.[groupKey] || {};
        return dict?.[code] || code;
    };

    const resolveBizTypeLabel = (row: any) => {
        // 罚单扣款当前复用 DEPOSIT_DEDUCT 枚举，但展示应以业务来源优先
        if (String(row?.sourceType || '') === 'PENALTY_TICKET') {
            return '罚单扣款';
        }
        return getEnumText('WalletBizType', row?.bizType);
    };

    const directionMetaMap: Record<string, { color: string; icon: React.ReactNode }> = {
        IN: { color: 'green', icon: <span style={{ fontWeight: 700 }}>↑</span> },
        OUT: { color: 'red', icon: <span style={{ fontWeight: 700 }}>↓</span> },
    };

    const bizTypeColorMap: Record<string, string> = {
        SETTLEMENT_EARNING: 'green',
        SETTLEMENT_EARNING_BASE: 'green',
        SETTLEMENT_EARNING_CARRY: 'geekblue',
        SETTLEMENT_REVERSAL: 'red',
        SETTLEMENT_RECALC: 'green',
        SETTLEMENT_BOMB_LOSS: 'red',
        SETTLEMENT_EARNING_CS: 'orange',
        RELEASE_FROZEN: 'blue',
        REFUND_REVERSAL: 'volcano',
        WITHDRAW_RESERVE: 'purple',
        WITHDRAW_RELEASE: 'cyan',
        WITHDRAW_PAYOUT: 'magenta',
    };

    const walletColumns: any = [
        {
            title: '流向',
            dataIndex: 'direction',
            width: 90,
            render: (_: any, r: any) => {
                const meta = directionMetaMap[r.direction];
                const label = getEnumText('WalletDirection', r.direction);
                if (!meta) return label;

                return (
                    <Tag color={meta.color}>
                        {meta.icon} {label}
                    </Tag>
                );
            },
        },

        {
            title: '类型',
            dataIndex: 'bizType',
            width: 160,
            render: (_: any, r: any) => {
                const label = resolveBizTypeLabel(r);
                const color = bizTypeColorMap[r.bizType] ?? 'default';
                return <Tag color={color}>{label}</Tag>;
            },
        },

        {
            title: '金额',
            dataIndex: 'amount',
            width: 140,
            align: 'right',
            search: false,
            render: (v: any, r: any) => {
                const isIn = r.direction === 'IN';
                const n = Number(v ?? 0);

                return (
                    <span style={{ color: isIn ? '#52c41a' : '#ff4d4f', fontWeight: 500 }}>
            {isIn ? '+' : '-'}
                        {Number.isFinite(n) ? n.toFixed(1) : '0.0'}
          </span>
                );
            },
        },

        {
            title: '状态',
            dataIndex: 'status',
            width: 120,
            render: (_: any, r: any) => {
                const label = getEnumText('WalletTxStatus', r.status);
                return <Tag>{label}</Tag>;
            },
        },

        {
            title: '钱包余额',
            width: 140,
            align: 'right',
            search: false,
            render: (_: any, row: any) => {
                const a = row.availableAfter;
                const f = row.frozenAfter;
                if (a === null || a === undefined || f === null || f === undefined) return '-';
                return <span>{(Number(a) + Number(f)).toFixed(2)}</span>;
            },
        },

        {
            title: '订单编号',
            dataIndex: 'orderAutoSerial',
            width: 160,
            render: (_: any, r: any) => r.orderAutoSerial || '--',
        },

        {
            title: '时间',
            dataIndex: 'createdAt',
            width: 200,
            search: false,
            render: (_: any, r: any) =>
                r.createdAt ? dayjs(r.createdAt).format('YYYY-MM-DD HH:mm:ss') : '--',
        },
    ];

    const depositColumns: any = [
        {
            title: '类型',
            dataIndex: 'bizType',
            width: 160,
            render: (_: any, r: any) => (
                <Tag color="blue">{getEnumText('DepositBizType', r.bizType)}</Tag>
            ),
        },

        {
            title: '金额',
            dataIndex: 'amount',
            width: 140,
            align: 'right',
            render: (v: any) => (
                <span style={{ color: '#1677ff', fontWeight: 500 }}>
          {Number(v ?? 0).toFixed(1) > 0 ? '+' : ''}{Number(v ?? 0).toFixed(1)}
        </span>
            ),
        },

        {
            title: '备注',
            dataIndex: 'remark',
            ellipsis: true,
        },

        {
            title: '操作人',
            dataIndex: 'operatorId',
            width: 120,
        },

        {
            title: '时间',
            dataIndex: 'createdAt',
            width: 200,
            render: (_: any, r: any) =>
                r.createdAt ? dayjs(r.createdAt).format('YYYY-MM-DD HH:mm:ss') : '--',
        },
    ];

    return (
        <Drawer
            title={`用户钱包 - ${user?.phone ?? ''}`}
            width={950}
            open={visible}
            onClose={onClose}
            destroyOnClose
        >
            <Tabs
                items={[
                    {
                        key: 'overview',
                        label: '钱包概览',
                        children: (
                            <>
                                <Row gutter={24} style={{ marginTop: 10 }}>
                                    <Col span={6}>
                                        <Statistic title="可用余额" value={available} precision={1} prefix="¥" />
                                    </Col>

                                    <Col span={6}>
                                        <Statistic title="冻结余额" value={frozen} precision={1} prefix="¥" />
                                    </Col>

                                    <Col span={6}>
                                        <Statistic title="保证金账户" value={deposit} precision={1} prefix="¥" />
                                    </Col>

                                    <Col span={6}>
                                        <Statistic title="总余额" value={total} precision={1} prefix="¥" />
                                    </Col>
                                </Row>

                                <Row style={{ marginTop: 24 }}>
                                    <Button
                                        type="primary"
                                        onClick={() => {
                                            setDepositAmount(0);
                                            setDepositRemark('');
                                            setDepositModal(true);
                                        }}
                                    >
                                        手动缴纳押金
                                    </Button>
                                </Row>
                            </>
                        ),
                    },

                    {
                        key: 'transactions',
                        label: '钱包流水',
                        children: (
                            <ProTable
                                rowKey="id"
                                columns={walletColumns}
                                search={{ labelWidth: 'auto' }}
                                pagination={{ pageSize: 20 }}
                                request={async (params) => {
                                    const { current, pageSize, ...rest } = params;

                                    const res = await getWalletTransactions({
                                        userId: user?.id,
                                        page: current ?? 1,
                                        limit: pageSize ?? 20,
                                        ...(rest || {}),
                                    });

                                    return {
                                        data: res?.data ?? [],
                                        total: res?.total ?? 0,
                                        success: true,
                                    };
                                }}
                            />
                        ),
                    },

                    {
                        key: 'deposit',
                        label: '保证金流水',
                        children: (
                            <ProTable
                                rowKey="id"
                                columns={depositColumns}
                                search={false}
                                pagination={{ pageSize: 20 }}
                                request={async (params) => {
                                    const { current, pageSize } = params;

                                    const res = await getWalletDepositTransactions({
                                        userId: user?.id,
                                        page: current ?? 1,
                                        limit: pageSize ?? 20,
                                    });

                                    return {
                                        data: res?.data ?? [],
                                        total: res?.total ?? 0,
                                        success: true,
                                    };
                                }}
                            />
                        ),
                    },
                ]}
            />

            <Modal
                title="手动缴纳保证金"
                open={depositModal}
                onCancel={() => setDepositModal(false)}
                onOk={async () => {
                    try {
                        if (!depositAmount || depositAmount <= 0) {
                            message.error('请输入正确金额');
                            return;
                        }

                        await manualDeposit({
                            userId: user?.id,
                            amount: depositAmount,
                            remark: depositRemark,
                        });

                        message.success('保证金缴纳成功');

                        setDepositModal(false);
                    } catch (e: any) {
                        message.error(e?.message || '操作失败');
                    }
                }}
            >
                <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 6 }}>保证金账户</div>
                    <InputNumber
                        style={{ width: '100%' }}
                        min={1}
                        value={depositAmount}
                        onChange={(v) => setDepositAmount(Number(v || 0))}
                    />
                </div>

                <div>
                    <div style={{ marginBottom: 6 }}>备注</div>
                    <Input
                        value={depositRemark}
                        onChange={(e) => setDepositRemark(e.target.value)}
                        placeholder="填写说明"
                    />
                </div>
            </Modal>
        </Drawer>
    );
}
