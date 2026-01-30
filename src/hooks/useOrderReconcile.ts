// src/hooks/useOrderReconcile.ts
import { useMemo } from 'react';

type WalletTxStatus = 'FROZEN' | 'AVAILABLE' | 'REVERSED';

export type WalletEarningsSummary = {
    total: number;
    frozen: number;
    available: number;
};

export type ReconcileHint = {
    status: 'MATCHED' | 'MISMATCHED' | 'EMPTY';
    settlementTotal: number;
    walletTotal: number;
    diff: number; // wallet - settlement
};

export type EarningsSummary = {
    income: number;

    // 你现有的“参考”拆分口径（兼容旧字段）
    payoutIncome: number;
    payoutExpenseAbs: number;
    platformSuggested: number;

    // 兼容旧字段（你页面 Mobile 还在用 payout/platform） :contentReference[oaicite:1]{index=1}
    payout: number;
    platform: number;

    perUserList: Array<{
        userId: number;
        name: string;
        phone: string;
        income: number;
        expense: number; // 正数展示为支出
        net: number;
    }>;
};

const toCents = (v: any) => {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
};

const centsToMoney = (cents: number) => {
    const n = Number(cents ?? 0);
    const yuan = n / 100;
    return Number.isFinite(yuan) ? yuan.toFixed(2) : '0.00';
};

export function useOrderReconcile(order: any): {
    earningsSummary: EarningsSummary;
    walletEarningsSummary: WalletEarningsSummary | null;
    reconcileHint: ReconcileHint | null;
    settlementTotal: number; // 结算参考总额（给后续按人拆分做铺垫）
} {
    // ✅ 结算参考总额
    const settlementTotal = useMemo(() => {
        const list = Array.isArray(order?.settlements) ? order.settlements : [];
        return list.reduce((sum: number, s: any) => sum + Number(s?.finalEarnings || 0), 0);
    }, [order]);

    // ✅ 1) 参考收益概览（保持你现有逻辑不变，只是搬家） :contentReference[oaicite:2]{index=2}
    const earningsSummary = useMemo<EarningsSummary>(() => {
        const incomeCents = order?.isGifted ? 0 : toCents(order?.paidAmount);
        const list = Array.isArray(order?.settlements) ? order.settlements : [];

        let payoutIncomeCents = 0;     // 正向收益合计（分）
        let payoutExpenseAbsCents = 0; // 支出合计（分，绝对值）

        const perUser: Record<
            string,
            { userId: number; name: string; phone: string; incomeCents: number; expenseAbsCents: number; netCents: number }
            > = {};

        for (const s of list as any[]) {
            const v = Number(s?.finalEarnings ?? 0);
            if (!Number.isFinite(v) || v === 0) continue;

            const centsAbs = Math.abs(toCents(v));
            const isLoss = v < 0;

            const u = (s as any)?.user || {};
            const key = String(s?.userId ?? u?.id ?? '0');

            if (!perUser[key]) {
                perUser[key] = {
                    userId: Number(s?.userId ?? u?.id ?? 0),
                    name: u?.name || '-',
                    phone: u?.phone || '-',
                    incomeCents: 0,
                    expenseAbsCents: 0,
                    netCents: 0,
                };
            }

            if (isLoss) {
                payoutExpenseAbsCents += centsAbs;
                perUser[key].expenseAbsCents += centsAbs;
                perUser[key].netCents -= centsAbs;
            } else {
                payoutIncomeCents += centsAbs;
                perUser[key].incomeCents += centsAbs;
                perUser[key].netCents += centsAbs;
            }
        }

        const platformSuggestedCents = incomeCents - payoutIncomeCents + payoutExpenseAbsCents;

        const perUserList = Object.values(perUser)
            .map((r) => ({
                userId: r.userId,
                name: r.name,
                phone: r.phone,
                income: Number(centsToMoney(r.incomeCents)),
                expense: Number(centsToMoney(r.expenseAbsCents)),
                net: Number(centsToMoney(r.netCents)),
            }))
            .sort((a, b) => b.net - a.net);

        return {
            income: Number(centsToMoney(incomeCents)),
            payoutIncome: Number(centsToMoney(payoutIncomeCents)),
            payoutExpenseAbs: Number(centsToMoney(payoutExpenseAbsCents)),
            platformSuggested: Number(centsToMoney(platformSuggestedCents)),

            // 兼容旧字段（你现在页面还在用 payout/platform） :contentReference[oaicite:3]{index=3}
            payout: Number(centsToMoney(payoutIncomeCents - payoutExpenseAbsCents)),
            platform: Number(centsToMoney(incomeCents - (payoutIncomeCents - payoutExpenseAbsCents))),

            perUserList,
        };
    }, [order]);

    // ✅ 2) 钱包真实收益概览（优先用后端返回）
    const walletEarningsSummary = useMemo<WalletEarningsSummary | null>(() => {
        const ws = order?.walletEarningsSummary;
        if (!ws) return null;
        return {
            total: Number(ws.total || 0),
            frozen: Number(ws.frozen || 0),
            available: Number(ws.available || 0),
        };
    }, [order]);

    // ✅ 3) 对账提示（优先用后端返回；否则用 walletSummary + settlementTotal 推导）
    const reconcileHint = useMemo<ReconcileHint | null>(() => {
        const rh = order?.reconcileHint;
        if (rh) {
            return {
                status: rh.status,
                settlementTotal: Number(rh.settlementTotal || 0),
                walletTotal: Number(rh.walletTotal || 0),
                diff: Number(rh.diff || 0),
            };
        }

        if (!walletEarningsSummary) return null;

        const walletTotal = Number(walletEarningsSummary.total || 0);
        const diff = Number((walletTotal - settlementTotal).toFixed(2));

        let status: ReconcileHint['status'] = 'MISMATCHED';
        const hasSettlement = Array.isArray(order?.settlements) && order.settlements.length > 0;

        if (!hasSettlement && walletTotal === 0) status = 'EMPTY';
        else if (diff === 0) status = 'MATCHED';

        return { status, settlementTotal, walletTotal, diff };
    }, [order, walletEarningsSummary, settlementTotal]);

    const reconcileHintByUser = useMemo(() => {
        const list = Array.isArray(order?.reconcileHintByUser) ? order.reconcileHintByUser : [];

        return list.map((r: any) => {
            const userId = Number(r?.userId ?? 0);

            // ✅ 兼容字段：walletNet / walletTotal（旧版可能只有 walletTotal，且语义可能是净额）
            const walletNet = Number(r?.walletNet ?? r?.walletTotal ?? 0);
            const walletIn = Number(r?.walletIn ?? 0);
            const walletOut = Number(r?.walletOut ?? 0);

            const settlementTotal = Number(r?.settlementTotal ?? 0);

            // ✅ diff：优先用后端返回；否则用 walletNet - settlementTotal 推导（避免显示 0 假象）
            const diff = Number(
                (r?.diff ?? (walletNet - settlementTotal)).toFixed
                    ? (r?.diff ?? (walletNet - settlementTotal)).toFixed(2)
                    : (r?.diff ?? (walletNet - settlementTotal))
            );

            // ✅ status：优先后端；否则根据 diff 推导
            const status =
                (r?.status as any) ??
                (settlementTotal === 0 && walletNet === 0 && walletIn === 0 && walletOut === 0
                    ? 'EMPTY'
                    : diff === 0
                        ? 'MATCHED'
                        : 'MISMATCHED');

            return {
                userId,
                userName: r?.userName ?? r?.user?.name ?? (userId ? `#${userId}` : '-'),

                settlementTotal,
                walletTotal: walletNet, // ✅ 继续兼容旧字段名：walletTotal=净额
                walletNet,
                walletIn,
                walletOut,

                diff: Number(diff),
                status,
            };
        });
    }, [order]);



    return {
        earningsSummary,
        walletEarningsSummary,
        reconcileHint,
        reconcileHintByUser,
        settlementTotal,
    };
}
