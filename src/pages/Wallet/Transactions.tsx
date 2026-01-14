import React, {useRef} from 'react';
import type {ActionType} from '@ant-design/pro-components';
import {PageContainer, ProTable} from '@ant-design/pro-components';
import {message, Tag} from 'antd';
import dayjs from 'dayjs';
import {getWalletTransactions} from '@/services/api';

// ⚠️ 这里不强依赖你 services 里 WalletTransaction 的类型（因为你后端刚加了 orderSerial）
// 如果你 services/api.ts 里已经有 WalletTransaction 类型，可以把下面这段删掉，
// 然后在 columns 用 any 或你自己的 WalletTransaction 即可。
type WalletTransactionRow = {
    id: number;
    userId: number;
    direction: 'IN' | 'OUT';
    bizType: string;
    amount: number;
    status: string;

    sourceType?: string | null;
    sourceId?: number | null;

    orderId?: number | null;
    orderSerial?: string | null; // ✅ 新增：后端返回订单编号 autoSerial

    // ✅ 你要求屏蔽展示，但后端可能仍返回；不展示即可
    dispatchId?: number | null;
    settlementId?: number | null;

    reversalOfTxId?: number | null;
    createdAt?: string;
};

export default function WalletTransactions() {
    const actionRef = useRef<ActionType>();

    // ✅ 前端展示字典（先写死，后续从 /meta/enums 补齐后再统一改成取字典）
    const directionMetaMap: Record<string,
        { color: string; text: string; icon: React.ReactNode }> = {
        IN: {
            color: 'green',
            text: '收入',
            icon: <span style={{fontWeight: 700}}>↑</span>,
        },
        OUT: {
            color: 'red',
            text: '支出',
            icon: <span style={{fontWeight: 700}}>↓</span>,
        },
    };
    const bizTypeEnum: Record<string, { text: string }> = {
        // 兼容历史
        SETTLEMENT_EARNING: {text: '结算收益'},

        // ✅ 新的业务类型
        SETTLEMENT_EARNING_BASE: {text: '结算收益'},
        SETTLEMENT_EARNING_CARRY: {text: '补单收益'},
        SETTLEMENT_BOMB_LOSS: {text: '炸单损耗'},
        SETTLEMENT_EARNING_CS: {text: '客服分红'},

        RELEASE_FROZEN: {text: '解冻入账'},
        REFUND_REVERSAL: {text: '退款冲正'},

        WITHDRAW_RESERVE: {text: '提现预扣'},
        WITHDRAW_RELEASE: {text: '提现退回'},
        WITHDRAW_PAYOUT: {text: '提现出款'},
    };

    const bizTypeColorMap: Record<string, string> = {
        // === 结算相关 ===
        SETTLEMENT_EARNING: 'green',            // 兼容历史
        SETTLEMENT_EARNING_BASE: 'green',       // 基础结算收益
        SETTLEMENT_EARNING_CARRY: 'geekblue',   // 补单收益（从炸单池补）
        SETTLEMENT_BOMB_LOSS: 'red',             // 炸单损耗（负收益）
        SETTLEMENT_EARNING_CS: 'orange',         // 客服分红

        // === 钱包流转 ===
        RELEASE_FROZEN: 'blue',                  // 解冻入账
        REFUND_REVERSAL: 'volcano',              // 退款冲正

        // === 提现 ===
        WITHDRAW_RESERVE: 'purple',
        WITHDRAW_RELEASE: 'cyan',
        WITHDRAW_PAYOUT: 'magenta',
    };

    const txStatusEnum: Record<string, { text: string }> = {
        FROZEN: {text: '冻结'},
        AVAILABLE: {text: '可用'},
        REVERSED: {text: '已冲正'},
    };

    const columns: any = [
        // { title: 'ID', dataIndex: 'id', width: 80, search: false },

        // { title: '用户ID', dataIndex: 'userId', width: 90, search: false },

        {
            title: '流向',
            dataIndex: 'direction',
            width: 90,
            valueEnum: {
                IN: {text: '收入'},
                OUT: {text: '支出'},
            },
            render: (_, r) => {
                const meta = directionMetaMap[r.direction];
                if (!meta) return '-';

                return (
                    <Tag color={meta.color}>
                        {meta.icon} {meta.text}
                    </Tag>
                );
            },
        },

        {
            title: '类型',
            dataIndex: 'bizType',
            width: 160,
            valueEnum: bizTypeEnum,
            render: (_, r) => {
                const label = bizTypeEnum[r.bizType]?.text ?? r.bizType ?? '--';
                const color = bizTypeColorMap[r.bizType] ?? 'default';
                // 想要更醒目一点就用 Tag
                return <Tag color={color}>{label}</Tag>;
            },
        },

        {
            title: '金额',
            dataIndex: 'amount',
            width: 160,
            align: 'right',
            render: (v, r) => {
                const isIn = r.direction === 'IN';
                return (
                    <span style={{color: isIn ? '#52c41a' : '#ff4d4f', fontWeight: 500}}>
        {isIn ? '+' : '-'}
                        {Number(v).toFixed(1)}
      </span>
                );
            },
        },

        {
            title: '状态',
            dataIndex: 'status',
            width: 120,
            valueEnum: txStatusEnum,
            render: (_, r) => {
                const label = txStatusEnum[r.status]?.text ?? r.status ?? '--';
                // ✅ 这里不指定颜色（你没要求），只做文本
                return <Tag>{label}</Tag>;
            },
        },

        // ✅ 订单编号：展示 + 支持搜索
        {
            title: '订单编号',
            dataIndex: 'orderSerial',
            width: 160,
            // 搜索框默认是 input，不需要 valueType
            render: (_, r) => r.orderSerial || '--',
        },
        {
            title: '可用余额',
            dataIndex: 'availableBalance',
            width: 120,
            search: false,
            render: (_, row) => {
                const v = (row as any).availableBalance;
                if (v === null || v === undefined) return '-';
                return <span>{Number(v).toFixed(2)}</span>;
            },
        },
        {
            title: '冻结余额',
            dataIndex: 'frozenBalance',
            width: 120,
            search: false,
            render: (_, row) => {
                const v = (row as any).frozenBalance;
                if (v === null || v === undefined) return '-';
                return <span>{Number(v).toFixed(2)}</span>;
            },
        },

        // ✅ 订单ID：不展示（你要求订单ID改为展示订单编号）
        // 如果你仍希望保留“可搜索 orderId”但不展示，可用 hideInTable
        // {
        //   title: '订单ID',
        //   dataIndex: 'orderId',
        //   hideInTable: true,
        // },

        // ✅ 屏蔽派单批次/结算ID（两列直接删掉）

        // {
        //     title: '来源',
        //     dataIndex: 'sourceType',
        //     width: 200,
        //     search: false,
        //     render: (_, r) => {
        //         const st = r.sourceType ?? '--';
        //         const sid = r.sourceId ?? '--';
        //         return `${st}:${sid}`;
        //     },
        // },

        {
            title: '时间',
            dataIndex: 'createdAt',
            width: 160,
            search: false,
            render: (_, r) => (r.createdAt ? dayjs(r.createdAt).format('YYYY-MM-DD HH:mm') : '--'),
        },
    ];

    return (
        <PageContainer>
            <ProTable<WalletTransactionRow>
                actionRef={actionRef}
                rowKey="id"
                columns={columns}
                search={{labelWidth: 'auto'}}
                pagination={{pageSize: 20}}
                request={async (params) => {
                    try {
                        const {current, pageSize, ...rest} = params as any;

                        // ✅ 这里的 rest 会包含：
                        // - direction / bizType / status
                        // - orderSerial（我们新增的搜索字段）
                        //
                        // ⚠️ 要求后端 getWalletTransactions 支持 orderSerial 过滤（你已经在改后端了）
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
                        return {data: [], total: 0, success: false};
                    }
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
                                <ProTable.Summary.Cell index={1} colSpan={2}>
                                    <strong>本页合计(仅作参考，解冻流水会重复计算)</strong>
                                </ProTable.Summary.Cell>

                                <ProTable.Summary.Cell index={2} colSpan={3} align="right">
                                    <div>
                                        <span style={{ color: '#52c41a',marginRight:20 }}>收入:+{inSum.toFixed(1)}</span>
                                        <span style={{ color: '#ff4d4f',marginRight:20 }}>支出:-{outSum.toFixed(1)}</span>
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
