// 示例方法，没有实际意义
export function trim(str: string) {
  return str.trim();
}
// src/utils/finance/repairWalletPreview.ts

export type CsDiffRow = {
  key: string;

  // 给客服看的字段（业务语言）
  roundText: string;     // 第几轮 + 已结单/已存单
  playerText: string;    // 打手展示（先用 ID，后面可换昵称）
  oldIncome: number;     // 原结算收益（oldFinal）
  newIncome: number;     // 重算后收益（expectedFinal）
  deltaIncome: number;   // 差额（expectedFinal - oldFinal）

  walletBefore: number;  // 钱包原影响（currentEffect）
  walletAfter: number;   // 钱包新影响（expectedEffect）
  walletDelta: number;   // 钱包差额（walletAfter - walletBefore）

  blocked: boolean;      // 是否存在风险（blockedReason 不为空）
  blockedReason?: string; // 中文原因（给客服/主管看）
  suggestion?: string;    // 处理建议（给客服/主管看）

  // 给“主管/研发”可选展示的字段（不放在主表，但可以展开）
  raw?: any;
};

export type CsSummary = {
  affectedCount: number;       // 差异条数（delta != 0 或 blocked）
  changedCount: number;        // delta != 0 的条数（可修/不可修都算变化）
  blockedCount: number;        // 风险条数
  totalDeltaIncome: number;    // 结算差额合计
  totalDeltaWallet: number;    // 钱包差额合计（用于提示写入钱包影响）
};

const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const mapDispatchStatusText = (s: any) => {
  const v = String(s || '');
  if (v === 'COMPLETED') return '已结单';
  if (v === 'ARCHIVED') return '已存单';
  return v || '-';
};

/**
 * ✅ 把后端 plan[].preview 翻译成“客服可读”的行数据
 * - 默认隐藏 settlementId/walletTxId 等技术字段
 * - blockedReason 统一翻译成客服能理解的风险原因
 */
export const translateWalletRepairPreviewToCs = (res: any): { rows: CsDiffRow[]; summary: CsSummary } => {
  const plan: any[] = Array.isArray(res?.plan) ? res.plan : [];
  const previews: any[] = plan.map((p: any) => p?.preview).filter(Boolean);

  const rows: CsDiffRow[] = previews.map((r: any) => {
    const w = r?.wallet || {};
    const oldIncome = toNum(r?.oldFinal);
    const newIncome = toNum(r?.expectedFinal);
    const deltaIncome = toNum(r?.deltaFinal, newIncome - oldIncome);

    const walletBefore = toNum(w?.currentEffect);
    const walletAfter = toNum(w?.expectedEffect);
    const walletDelta = walletAfter - walletBefore;

    const rawBlocked = w?.blockedReason ? String(w?.blockedReason) : '';
    const blocked = Boolean(rawBlocked);

    // ✅ blocked 中文化 + 处理建议（纯前端，不依赖后端）
    // 你后端 blockedReason 未来可以更规范，这里先做最小可读化
    let blockedReasonCN: string | undefined;
    let suggestion: string | undefined;
    if (blocked) {
      blockedReasonCN = '该打手的钱包记录已发生变动（可能已解冻/已入账），系统不建议自动覆盖修复。';
      suggestion = '请联系主管/技术核对后，走“人工调整”处理（或先清空钱包并全量重建：仅限内测无提现场景）。';
    } else {
      suggestion = deltaIncome === 0 && walletDelta === 0 ? '无需处理。' : '可自动修复（确认无误后执行覆盖修正）。';
    }

    const dispatchRound = toNum(r?.dispatchRound, 0);
    const dispatchStatusText = mapDispatchStatusText(r?.dispatchStatus);

    return {
      key: `${r?.dispatchId ?? ''}_${dispatchRound}_${r?.userId ?? ''}_${r?.settlementType ?? ''}`,
      roundText: `第 ${dispatchRound || '-'} 轮（${dispatchStatusText}）`,
      playerText: `打手ID ${r?.userId ?? '-'}`,

      oldIncome,
      newIncome,
      deltaIncome,

      walletBefore,
      walletAfter,
      walletDelta,

      blocked,
      blockedReason: blockedReasonCN,
      suggestion,

      raw: r,
    };
  });

  const changedCount = rows.filter((x) => x.deltaIncome !== 0 || x.walletDelta !== 0).length;
  const blockedCount = rows.filter((x) => x.blocked).length;
  const affectedCount = rows.filter((x) => x.blocked || x.deltaIncome !== 0 || x.walletDelta !== 0).length;

  const totalDeltaIncome = rows.reduce((sum, x) => sum + toNum(x.deltaIncome), 0);
  const totalDeltaWallet = rows.reduce((sum, x) => sum + toNum(x.walletDelta), 0);

  return {
    rows,
    summary: {
      affectedCount,
      changedCount,
      blockedCount,
      totalDeltaIncome,
      totalDeltaWallet,
    },
  };
};
type ModePlayRoundRow = {
  key: string;
  dispatchId: number;
  round: number;
  participantIds: number[];
  participantNames: string[]; // ✅ 新增：用于展示
  participantCount: number;
  income: number; // 本轮收入（客服填）
};
export const validateModePlayAlloc = (rows: ModePlayRoundRow[], paidAmount: number) => {
  const paid = toNum(paidAmount);
  let sum = 0;

  for (const r of rows) {
    const n = Number(r?.income);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, sum, err: '存在非法金额（必须为 ≥ 0 的数字）' };
    }
    sum += n;
  }

  if (sum - paid > 1e-6) {
    return { ok: false, sum, err: `分配合计 ¥${sum.toFixed(2)} 不能大于实付金额 ¥${paid.toFixed(2)}` };
  }

  // ✅ 允许小于等于
  return { ok: true, sum, err: null as string | null };
};

export const seedModePlayEqualByRound = (rows: ModePlayRoundRow[], paidAmount: number) => {
  const paid = toNum(paidAmount);
  const n = rows.length;
  if (n <= 0) return rows;

  // 以分为单位避免浮点误差（两位小数）
  const totalCents = Math.round(paid * 100);
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;

  return rows.map((r, idx) => {
    const cents = base + (idx === n - 1 ? remainder : 0); // ✅ 最后一轮吃尾差
    return { ...r, income: cents / 100 };
  });
};
