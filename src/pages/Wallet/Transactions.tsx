import * as React from 'react';
import type { ActionType } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { message, Tag } from 'antd';
import dayjs from 'dayjs';
import { getEnumDicts, getWalletTransactions } from '@/services/api';

type WalletTransactionRow = {
    id: number;
    userId: number;
    direction: 'IN' | 'OUT';
    bizType: string;
    amount: number;
    status: string;

    orderId?: number | null;
    orderAutoSerial?: string | null;

    reversalOfTxId?: number | null;
    availableAfter?: number | null;
    frozenAfter?: number | null;

    createdAt?: string;
    sourceType?: string;
    remark?: string | null;
};

export default function WalletTransactions() {
    const actionRef = React.useRef<ActionType>();
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

    // 颜色/符号风格保持与你现有页面一致
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

    const resolveBizTypeLabel = (row: WalletTransactionRow) => {
        // 罚单扣款当前复用 DEPOSIT_DEDUCT 枚举，但展示应以业务来源优先
        if (String((row as any)?.sourceType || '') === 'PENALTY_TICKET') {
            return '罚单扣款';
        }
        return getEnumText('WalletBizType', row.bizType);
    };

    const isReversedSourceTx = (row: WalletTransactionRow) =>
        String(row.status || '') === 'REVERSED' &&
        ['SETTLEMENT_EARNING', 'SETTLEMENT_EARNING_BASE', 'SETTLEMENT_EARNING_CARRY', 'SETTLEMENT_EARNING_CS', 'SETTLEMENT_BOMB_LOSS'].includes(
            String(row.bizType || ''),
        );

    const getAmountSign = (row: WalletTransactionRow) => {
        if (isReversedSourceTx(row)) return '-';
        return row.direction === 'IN' ? '+' : '-';
    };

    const columns: any = [
        {
            title: '流向',
            dataIndex: 'direction',
            search: false,
            width: 90,
            valueEnum: enums?.WalletDirection
                ? Object.fromEntries(Object.entries(enums.WalletDirection).map(([k, v]) => [k, { text: v }]))
                : undefined,
            render: (_: any, r: WalletTransactionRow) => {
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
            valueEnum: enums?.WalletBizType
                ? Object.fromEntries(Object.entries(enums.WalletBizType).map(([k, v]) => [k, { text: v }]))
                : undefined,
            render: (_: any, r: WalletTransactionRow) => {
                const label = resolveBizTypeLabel(r);
                const color = bizTypeColorMap[r.bizType] ?? 'default';
                if (String(r.status || '') === 'REVERSED' && ['SETTLEMENT_EARNING', 'SETTLEMENT_EARNING_BASE', 'SETTLEMENT_EARNING_CARRY', 'SETTLEMENT_EARNING_CS', 'SETTLEMENT_BOMB_LOSS'].includes(String(r.bizType || ''))) {
                    return <Tag color="default">{label}（已冲正）</Tag>;
                }
                return <Tag color={color}>{label}</Tag>;
            },
        },

        {
            title: '金额',
            dataIndex: 'amount',
            width: 160,
            align: 'right',
            search: false,
            render: (v: any, r: WalletTransactionRow) => {
                const n = Number(v ?? 0);
                const sign = getAmountSign(r);
                const color = sign === '+' ? '#52c41a' : '#ff4d4f';
                return (
                    <span style={{ color, fontWeight: 500 }}>
            {sign}
                        {Number.isFinite(n) ? n.toFixed(1) : '0.0'}
          </span>
                );
            },
        },

        {
            title: '状态',
            dataIndex: 'status',
            width: 120,
            valueEnum: enums?.WalletTxStatus
                ? Object.fromEntries(Object.entries(enums.WalletTxStatus).map(([k, v]) => [k, { text: v }]))
                : undefined,
            render: (_: any, r: WalletTransactionRow) => {
                const label = getEnumText('WalletTxStatus', r.status);
                return <Tag>{label}</Tag>;
            },
        },

        {
            title: '钱包余额',
            dataIndex: 'totalAfter',
            width: 160,
            search: false,
            align: 'right',
            render: (_: any, row: WalletTransactionRow) => {
                if (String(row.status || '') === 'REVERSED') return <span style={{ color: '#999' }}>已冲正</span>;
                const a = (row as any).availableAfter;
                const f = (row as any).frozenAfter;
                if (a === null || a === undefined || f === null || f === undefined) return '-';
                return <span>{(Number(a) + Number(f)).toFixed(2)}</span>;
            },
        },

        {
            title: '订单编号',
            dataIndex: 'orderAutoSerial',
            width: 160,
            render: (_: any, r: WalletTransactionRow) => r.orderAutoSerial || '--',
        },
        {
            title: '备注',
            dataIndex: 'remark',
            width: 320,
            search: false,
            ellipsis: true,
            render: (v: any) => v || '--',
        },

        {
            title: '时间',
            dataIndex: 'createdAt',
            width: 220,
            search: false,
            render: (_: any, r: WalletTransactionRow) =>
                r.createdAt ? dayjs(r.createdAt).format('YYYY-MM-DD HH:mm') : '--',
        },
    ];

    return (
        <PageContainer>
            <ProTable<WalletTransactionRow>
                actionRef={actionRef}
                rowKey="id"
                columns={columns}
                search={{ labelWidth: 'auto' }}
                pagination={{ pageSize: 20 }}
                request={async (params) => {
                    try {
                        const { current, pageSize, ...rest } = params as any;

                        const res = await getWalletTransactions({
                            page: current ?? 1,
                            limit: pageSize ?? 20,
                            ...(rest || {}),
                        });

                        return {
                            data: (res as any).data ?? [],
                            total: (res as any).total ?? 0,
                            success: true,
                        };
                    } catch (e) {
                        message.error('获取钱包流水失败');
                        return { data: [], total: 0, success: false };
                    }
                }}
                summary={(pageData) => {
                    let inSum = 0;
                    let outSum = 0;

                    for (const row of pageData) {
                        const amt = Number(row.amount ?? 0);
                        if (!Number.isFinite(amt)) continue;
                        const sign = getAmountSign(row);
                        if (sign === '+') inSum += amt;
                        if (sign === '-') outSum += amt;
                    }

                    const net = inSum - outSum;

                    return (
                        <ProTable.Summary>
                            <ProTable.Summary.Row>
                                <ProTable.Summary.Cell index={1} colSpan={6}>
                                    <strong>本页合计(仅作参考，解冻流水会重复计算)</strong>
                                </ProTable.Summary.Cell>

                                <ProTable.Summary.Cell index={2} colSpan={6} align="right">
                                    <div>
                                        <span style={{ color: '#52c41a', marginRight: 20 }}>收入:+{inSum.toFixed(1)}</span>
                                        <span style={{ color: '#ff4d4f', marginRight: 20 }}>支出:-{outSum.toFixed(1)}</span>
                                        <span>净额:{net.toFixed(1)}</span>
                                    </div>
                                </ProTable.Summary.Cell>
                            </ProTable.Summary.Row>
                        </ProTable.Summary>
                    );
                }}
            />
        </PageContainer>
    );
}
