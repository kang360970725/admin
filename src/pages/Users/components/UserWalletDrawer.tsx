import React from 'react';
import {Drawer, Tabs, Row, Col, Statistic, Tag, message} from 'antd';
import {ProTable} from '@ant-design/pro-components';
import dayjs from 'dayjs';
import {getEnumDicts, getWalletTransactions} from '@/services/api';

export default function UserWalletDrawer(props: any) {

    const {visible, user, onClose} = props;

    const wallet = user?.wallet || {};

    const available = Number(wallet?.availableBalance ?? 0);
    const frozen = Number(wallet?.frozenBalance ?? 0);
    const total = Number(wallet?.totalBalance ?? 0);

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

    const getEnumText = (groupKey: string, code?: string) => {
        if (!code) return '--';
        const dict = enums?.[groupKey] || {};
        return dict?.[code] || code;
    };

    const columns: any = [

        {
            title: '流向',
            dataIndex: 'direction',
            width: 90,
            valueEnum: enums?.WalletDirection
                ? Object.fromEntries(
                    Object.entries(enums.WalletDirection).map(([k, v]) => [k, {text: v}])
                )
                : undefined,
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
            valueType: 'select',
            valueEnum: enums?.WalletBizType
                ? Object.fromEntries(
                    Object.entries(enums.WalletBizType).map(([k, v]) => [k, {text: v}])
                )
                : undefined,
            render: (_: any, r: any) => {
                const label = getEnumText('WalletBizType', r.bizType);
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
                    <span style={{color: isIn ? '#52c41a' : '#ff4d4f', fontWeight: 500}}>
                        {isIn ? '+' : '-'}{Number.isFinite(n) ? n.toFixed(1) : '0.0'}
                    </span>
                );
            },
        },

        {
            title: '状态',
            dataIndex: 'status',
            width: 120,
            valueType: 'select',
            valueEnum: enums?.WalletTxStatus
                ? Object.fromEntries(
                    Object.entries(enums.WalletTxStatus).map(([k, v]) => [k, {text: v}])
                )
                : undefined,
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

    return (
        <Drawer
            title={`用户钱包 - ${user?.phone ?? ''}`}
            width={900}
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
                            <Row gutter={24} style={{marginTop: 10}}>

                                <Col span={8}>
                                    <Statistic
                                        title="可用余额"
                                        value={available}
                                        precision={1}
                                        prefix="¥"
                                    />
                                </Col>

                                <Col span={8}>
                                    <Statistic
                                        title="冻结余额"
                                        value={frozen}
                                        precision={1}
                                        prefix="¥"
                                    />
                                </Col>

                                <Col span={8}>
                                    <Statistic
                                        title="总余额"
                                        value={total}
                                        precision={1}
                                        prefix="¥"
                                    />
                                </Col>

                            </Row>
                        )
                    },

                    {
                        key: 'transactions',
                        label: '钱包流水',
                        children: (
                            <ProTable
                                rowKey="id"
                                columns={columns}
                                search={{labelWidth: 'auto'}}
                                pagination={{pageSize: 20}}
                                request={async (params) => {

                                    const {current, pageSize, ...rest} = params;

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

                                summary={(pageData) => {

                                    let inSum = 0;
                                    let outSum = 0;

                                    for (const row of pageData) {
                                        const amt = Number(row.amount ?? 0);
                                        if (!Number.isFinite(amt)) continue;

                                        if (row.direction === 'IN') inSum += amt;
                                        if (row.direction === 'OUT') outSum += amt;
                                    }

                                    const net = inSum - outSum;

                                    return (
                                        <ProTable.Summary>
                                            <ProTable.Summary.Row>

                                                <ProTable.Summary.Cell index={1} colSpan={4}>
                                                    <strong>本页合计</strong>
                                                </ProTable.Summary.Cell>

                                                <ProTable.Summary.Cell index={2} colSpan={4} align="right">
                                                    <span style={{color: '#52c41a', marginRight: 20}}>
                                                        收入:+{inSum.toFixed(1)}
                                                    </span>

                                                    <span style={{color: '#ff4d4f', marginRight: 20}}>
                                                        支出:-{outSum.toFixed(1)}
                                                    </span>

                                                    <span>净额:{net.toFixed(1)}</span>
                                                </ProTable.Summary.Cell>

                                            </ProTable.Summary.Row>
                                        </ProTable.Summary>
                                    );
                                }}
                            />
                        )
                    }
                ]}
            />

        </Drawer>
    );
}
