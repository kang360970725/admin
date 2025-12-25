
// src/constants/status.ts
// 统一维护：订单状态 / 派单状态 的展示文案与 Tag 色值
// - 业务文案优先：后端 /meta/enums（若页面已加载 dicts）
// - 这里作为“前端统一兜底字典 + 颜色规范”
// - 使用时尽量走 helper，避免各页面散落硬编码

export type TagColor =
    | 'default'
    | 'processing'
    | 'success'
    | 'warning'
    | 'error'
    | 'blue'
    | 'purple'
    | 'orange'
    | 'green'
    | 'red'
    | string;

export type StatusMeta = { text: string; color?: TagColor };

// 订单状态（OrderStatus）
export const ORDER_STATUS_META: Record<string, StatusMeta> = {
    WAIT_ASSIGN: { text: '待派单', color: 'default' },
    WAIT_ACCEPT: { text: '待接单', color: 'orange' },
    ACCEPTED: { text: '已接单', color: 'blue' },
    ARCHIVED: { text: '已存单', color: 'purple' },
    COMPLETED: { text: '已结单', color: 'green' },
    WAIT_REVIEW: { text: '待评价', color: 'default' },
    REVIEWED: { text: '已评价', color: 'default' },
    WAIT_AFTERSALE: { text: '待售后', color: 'default' },
    AFTERSALE_DONE: { text: '已售后', color: 'default' },
    REFUNDED: { text: '已退款', color: 'red' },
};

// 派单状态（DispatchStatus）
export const DISPATCH_STATUS_META: Record<string, StatusMeta> = {
    WAIT_ASSIGN: { text: '待派单', color: 'default' },
    WAIT_ACCEPT: { text: '待接单', color: 'orange' },
    ACCEPTED: { text: '已接单', color: 'blue' },
    ARCHIVED: { text: '已存单', color: 'purple' },
    COMPLETED: { text: '已结单', color: 'green' },
    CANCELLED: { text: '已取消', color: 'red' },
};

// 统一取文案：优先 dicts[group][key]，否则走本地 meta.text，再否则 fallback/key
export function pickStatusText(args: {
    dicts?: Record<string, Record<string, string>>;
    group: 'OrderStatus' | 'DispatchStatus';
    key: any;
    fallback?: string;
}) {
    const k = String(args.key ?? '');
    const fromDict = args.dicts?.[args.group]?.[k];
    if (fromDict) return fromDict;
    const meta = (args.group === 'OrderStatus' ? ORDER_STATUS_META : DISPATCH_STATUS_META)[k];
    return meta?.text || args.fallback || k || '-';
}

export function pickStatusColor(args: { group: 'OrderStatus' | 'DispatchStatus'; key: any }) {
    const k = String(args.key ?? '');
    const meta = (args.group === 'OrderStatus' ? ORDER_STATUS_META : DISPATCH_STATUS_META)[k];
    return meta?.color || 'default';
}
