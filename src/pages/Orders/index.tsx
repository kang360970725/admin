import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useModel, useNavigate} from '@umijs/max';
import {Button, Card, Checkbox, Col, Collapse, DatePicker, Form, Input, InputNumber, List, message, Modal, Pagination, Row, Select, Space, Tag, Tooltip, Typography} from 'antd';
import {
    createOrder,
    deleteOrder,
    getOrderSourceOptions,
    getOrders,
    markOrderPaid,
    postFinanceReconciliation,
} from '@/services/api';
import OrderUpsertModal from './components/OrderForm';
import {PageContainer, ProTable, type ActionType} from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { useIsMobile } from '@/utils/useIsMobile';

/**
 * ✅ 订单状态字典（前端兜底）
 * - 新增：COMPLETED_PENDING_CONFIRM（已结单待确认）
 * - 其余保持原样，不动你的历史状态（最小改动）
 */
const statusText: Record<string, { text: string; color?: string }> = {
    WAIT_ASSIGN: {text: '待派单', color: 'default'},
    WAIT_ACCEPT: {text: '待接单', color: 'orange'},
    ACCEPTED: {text: '已接单', color: 'blue'},
    ARCHIVED: {text: '已存单', color: 'purple'},

    // ✅ 方案 C：结单两段式
    COMPLETED_PENDING_CONFIRM: {text: '已结单待确认', color: 'gold'},
    COMPLETED: {text: '已结单', color: 'green'},

    WAIT_REVIEW: {text: '待评价', color: 'gold'},
    REVIEWED: {text: '已评价', color: 'cyan'},
    WAIT_AFTERSALE: {text: '待售后', color: 'volcano'},
    AFTERSALE_DONE: {text: '已售后', color: 'magenta'},
    REFUNDED: {text: '已退款', color: 'red'},
};

const { Text } = Typography;

const OrdersPage: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const navigate = useNavigate();
    const isMobile = useIsMobile(768);
    const [createOpen, setCreateOpen] = useState(false);
    const [todayOverview, setTodayOverview] = useState<any>(null);
    const [overviewLoading, setOverviewLoading] = useState(false);
    const [consumptionSummary, setConsumptionSummary] = useState<any>(null);

    // ✅ 当前用户（用于：敏感字段 customerGameId 在“已结单”状态下脱敏展示）
    const {initialState} = useModel('@@initialState');
    const currentUser: any = initialState?.currentUser;
    const hasOrderPermission = (key: string) => {
        const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
        const userType = String(currentUser?.userType || '').trim().toUpperCase();
        const roleName = String(currentUser?.role?.name || currentUser?.Role?.name || currentUser?.roleName || '').trim().toUpperCase();
        const roleCode = String(currentUser?.role?.code || currentUser?.Role?.code || currentUser?.roleCode || currentUser?.roleKey || '').trim().toUpperCase();
        return userType === 'SUPER_ADMIN' || roleName === 'SUPER_ADMIN' || roleCode === 'SUPER_ADMIN' || permissions.includes(key);
    };
    const canViewOrderOverview = useMemo(() => {
        const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
        const userType = String(currentUser?.userType || '').trim().toUpperCase();
        const roleName = String(currentUser?.role?.name || currentUser?.Role?.name || currentUser?.roleName || '').trim().toUpperCase();
        const roleCode = String(currentUser?.role?.code || currentUser?.Role?.code || currentUser?.roleCode || currentUser?.roleKey || '').trim().toUpperCase();
        return (
            permissions.includes('orders:detail:page') ||
            permissions.includes('finance:dashboard:view') ||
            userType === 'ADMIN' ||
            userType === 'SUPER_ADMIN' ||
            roleName === 'SUPER_ADMIN' ||
            roleCode === 'SUPER_ADMIN'
        );
    }, [currentUser]);
    /**
     * ✅ 是否允许查看“已结单后的 customerGameId”
     * 后端也会做强制脱敏/不返回，这里是前端兜底防漏。
     *
     * 你要求：仅【超级管理员、客服主管】可见。
     * - SUPER_ADMIN：通常是 userType
     * - 客服主管：你的项目里可能是 role.name / role.code / roleKey 等字段（这里做兼容判断）
     *
     * 若你后续告诉我“客服主管”的真实字段/枚举值，我会把这里进一步收敛到唯一判断。
     */
    const canViewCustomerGameIdAfterCompleted = useMemo(() => {
        if (!currentUser) return false;

        // 1) 常见：userType
        if (String(currentUser?.userType || '').trim().toUpperCase() === 'SUPER_ADMIN') return true;

        // 2) 常见：role / roles
        const roleName = String(currentUser?.role?.name || currentUser?.roleName || '').trim();
        const roleCode = String(currentUser?.role?.code || currentUser?.roleCode || currentUser?.roleKey || '').trim();
        if (roleName.toUpperCase() === 'SUPER_ADMIN' || roleCode.toUpperCase() === 'SUPER_ADMIN') return true;

        // 你提到的是“客服主管”，这里做最小兼容：包含关键字即可（后续可再收敛）
        if (roleName.includes('客服主管')) return true;

        // 若你后端有固定 code，可在这里补齐（不影响现有逻辑）
        const allowRoleCodes = new Set([
            'CS_SUPERVISOR',
            'CUSTOMER_SERVICE_SUPERVISOR',
            'CS_MANAGER',
            'CUSTOMER_SERVICE_MANAGER',
        ]);
        if (allowRoleCodes.has(roleCode)) return true;

        return false;
    }, [currentUser]);

    /**
     * ✅ 已结单状态判定（用于：customerGameId 脱敏）
     * - 你要求：已结单状态不允许返回/展示 customerGameId
     * - 这里覆盖：COMPLETED_PENDING_CONFIRM + COMPLETED（以及稳妥起见包含 REFUNDED）
     */
    const isCompletedLikeStatus = (status?: any) => {
        const s = String(status || '');
        return s === 'COMPLETED_PENDING_CONFIRM' || s === 'COMPLETED' || s === 'REFUNDED';
    };

    // ✅ 确认收款弹窗（列表页快捷操作）
    const [markPaidOpen, setMarkPaidOpen] = useState(false);
    const [markPaidSubmitting, setMarkPaidSubmitting] = useState(false);
    const [markPaidOrder, setMarkPaidOrder] = useState<any>(null);
    const [markPaidForm] = Form.useForm();
    const [orderSourceOptions, setOrderSourceOptions] = useState<Array<{ label: string; value: string }>>([]);
    const [mobileLoading, setMobileLoading] = useState(false);
    const [mobileOrders, setMobileOrders] = useState<any[]>([]);
    const [mobileTotal, setMobileTotal] = useState(0);
    const [mobilePage, setMobilePage] = useState(1);
    const [mobileFilters, setMobileFilters] = useState<{
        keyword?: string;
        status?: string;
        isPaid?: boolean;
        customerGameId?: string;
        orderMonth?: string;
        orderSource?: string;
    }>({});

    useEffect(() => {
        (async () => {
            try {
                const res: any = await getOrderSourceOptions();
                const list = Array.isArray(res) ? res : (res?.data ?? []);
                setOrderSourceOptions(
                    list
                        .map((item: any) => ({
                            value: String(item?.value || '').trim(),
                            label: String(item?.label || item?.value || '').trim(),
                        }))
                        .filter((item: any) => item.value && item.label),
                );
            } catch (e) {
                console.error(e);
                setOrderSourceOptions([]);
            }
        })();
    }, []);

    const orderSourceValueEnum = useMemo(
        () => Object.fromEntries(orderSourceOptions.map((item) => [item.value, { text: item.label }])),
        [orderSourceOptions],
    );

    const loadOverview = async () => {
        setOverviewLoading(true);
        try {
            if (!canViewOrderOverview) {
                setTodayOverview(null);
                return;
            }

            const date = dayjs().format('YYYY-MM-DD');
            const [dailyRes] = await Promise.allSettled([
                postFinanceReconciliation({ startDate: date, endDate: date }),
            ]);

            setTodayOverview(dailyRes.status === 'fulfilled' ? dailyRes.value?.data?.summary || null : null);
        } finally {
            setOverviewLoading(false);
        }
    };

    useEffect(() => {
        void loadOverview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id, canViewOrderOverview]);

    const openMarkPaidModal = (row: any) => {
        setMarkPaidOrder(row);

        // 进入弹窗时：默认带出当前实付金额，方便一并修正“实收金额”
        markPaidForm.setFieldsValue({
            paidAmount: row?.paidAmount,
            remark: '',
            // 勾选含义：确认款项已经收进来了（列表页的“确认收款”按钮默认勾上）
            confirmPaid: true,
        });

        setMarkPaidOpen(true);
    };

    const confirmDeleteOrder = (row: any) => {
        Modal.confirm({
            title: '删除订单',
            content: '该操作将删除当前订单记录。已存在强外键关联的数据会按数据库规则自动处理，操作不可撤销。',
            okText: '确认删除',
            okButtonProps: { danger: true },
            cancelText: '取消',
            onOk: async () => {
                try {
                    await deleteOrder({ id: Number(row?.id), remark: '后台列表页手动删除订单' });
                    message.success('订单已删除');
                    if (isMobile) {
                        await loadMobileOrders(mobilePage, mobileFilters);
                    } else {
                        actionRef.current?.reload?.();
                    }
                } catch (e: any) {
                    message.error(e?.response?.data?.message || '删除订单失败');
                }
            },
        });
    };

    const renderCustomerGameId = (row: any) => {
        const raw = row?.customerGameId;
        if (raw == null || raw === '') return '-';
        if (!isCompletedLikeStatus(row?.status)) return String(raw);
        if (canViewCustomerGameIdAfterCompleted) return String(raw);
        return '******';
    };

    const getCurrentPlayerNames = (row: any) => {
        return row?.currentDispatch?.participants
            ?.map((p: any) => p?.user?.name || p?.user?.phone)
            ?.filter(Boolean) || [];
    };

    const loadMobileOrders = async (page = mobilePage, filters = mobileFilters) => {
        setMobileLoading(true);
        try {
            const res: any = await getOrders({
                page,
                limit: 10,
                serial: undefined,
                status: filters.status,
                customerGameId: String(filters.customerGameId || '').trim(),
                orderMonth: filters.orderMonth,
                keyword: filters.keyword,
                isPaid: filters.isPaid,
                orderSource: filters.orderSource,
            });
            const customerGameId = String(filters.customerGameId || '').trim();
            if (customerGameId) {
                setConsumptionSummary({
                    customerGameId,
                    orderMonth: filters.orderMonth,
                    orderCount: Number(res.total || 0),
                    receivableAmount: Number(res?.summary?.receivableAmount || 0),
                    paidAmount: Number(res?.summary?.paidAmount || 0),
                });
            } else {
                setConsumptionSummary(null);
            }
            setMobileOrders(Array.isArray(res?.data) ? res.data : []);
            setMobileTotal(Number(res?.total || 0));
            setMobilePage(page);
        } catch (e: any) {
            message.error(e?.response?.data?.message || '获取订单列表失败');
        } finally {
            setMobileLoading(false);
        }
    };

    useEffect(() => {
        if (!isMobile) return;
        void loadMobileOrders(1, mobileFilters);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMobile]);

    const renderMobileOrderCard = (row: any) => {
        const s = statusText[row?.status] || { text: row?.status || '-' };
        const players = getCurrentPlayerNames(row);
        const canQuickMarkPaid = !row?.isGifted && row?.isPaid === false;
        return (
            <List.Item style={{ padding: 0, borderBlockEnd: 'none' }}>
                <Card
                    size="small"
                    hoverable
                    onClick={() => navigate(`/orders/${row.id}`)}
                    style={{
                        width: '100%',
                        borderRadius: 12,
                        borderColor: row?.isPaid === false && !row?.isGifted ? 'rgba(255,77,79,.35)' : '#f0f0f0',
                    }}
                    bodyStyle={{ padding: 12 }}
                >
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25, wordBreak: 'break-all' }}>
                                    {row?.autoSerial || `#${row?.id}`}
                                </div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {row?.createdAt ? dayjs(row.createdAt).format('MM-DD HH:mm') : '-'}
                                </Text>
                            </div>
                            <Space size={4} wrap style={{ justifyContent: 'flex-end' }}>
                                <Tag color={s.color}>{s.text}</Tag>
                                {row?.isGifted ? <Tag>赠送</Tag> : row?.isPaid === false ? <Tag color="red">未收款</Tag> : <Tag color="green">已收款</Tag>}
                            </Space>
                        </Space>

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>项目</Text>
                                <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{row?.project?.name || '-'}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>实付</Text>
                                <div style={{ fontWeight: 800, fontSize: 18 }}>¥{Number(row?.paidAmount || 0).toFixed(2)}</div>
                            </div>
                        </div>

                        <Space size={6} wrap>
                            {row?.orderSourceLabel ? <Tag>{row.orderSourceLabel}</Tag> : null}
                            <Tag>客户：{renderCustomerGameId(row)}</Tag>
                            {players.length ? players.map((name: string, idx: number) => <Tag key={`${name}-${idx}`}>{name}</Tag>) : <Tag>未派单</Tag>}
                        </Space>

                        <Space style={{ width: '100%', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                            {canQuickMarkPaid ? (
                                <Button size="small" type="primary" onClick={() => openMarkPaidModal(row)}>
                                    确认收款
                                </Button>
                            ) : null}
                            {hasOrderPermission('orders:list:delete:button') ? (
                                <Button size="small" danger onClick={() => confirmDeleteOrder(row)}>
                                    删除
                                </Button>
                            ) : null}
                            <Button size="small" onClick={() => navigate(`/orders/${row.id}`)}>
                                详情
                            </Button>
                        </Space>
                    </Space>
                </Card>
            </List.Item>
        );
    };

    const submitMarkPaid = async () => {
        try {
            const v = await markPaidForm.validateFields();
            setMarkPaidSubmitting(true);

            // ✅ 后端新接口：确认收款（同时允许修正 paidAmount）
            await markOrderPaid({
                id: Number(markPaidOrder?.id),
                paidAmount: Number(v.paidAmount),
                remark: v.remark || undefined,
                confirmPaid: v.confirmPaid !== false,
            });

            message.success('已确认收款');
            setMarkPaidOpen(false);
            if (isMobile) {
                await loadMobileOrders(mobilePage, mobileFilters);
            } else {
                actionRef.current?.reload?.();
            }
        } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || '确认收款失败');
        } finally {
            setMarkPaidSubmitting(false);
        }
    };

    const columns: any = [
        {
            title: '单号',
            dataIndex: 'autoSerial',
            width: 160,
            copyable: true,
            ellipsis: true,
            search: false
        },
        {
            title: '搜索',
            dataIndex: 'keyword',
            hideInTable: true, // ✅ 只出现在搜索区
            renderFormItem: () => (
                <Input
                    allowClear
                    placeholder="订单号 / 客服 / 陪玩昵称"
                />
            ),
        },
        {
            title: '项目',
            dataIndex: ['project', 'name'],
            ellipsis: true,
        },
        {
            title: '渠道来源',
            dataIndex: 'orderSource',
            width: 150,
            valueType: 'select',
            valueEnum: orderSourceValueEnum,
            hideInTable: isMobile,
            render: (_: any, row: any) => row?.orderSourceLabel ? <Tag>{row.orderSourceLabel}</Tag> : '-',
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 130,
            hideInTable: false,
            render: (_: any, row: any) => {
                const s = statusText[row.status] || {text: row.status};
                return <Tag color={s?.color}>{s.text}</Tag>;
            },
            valueType: 'select',
            valueEnum: Object.fromEntries(Object.entries(statusText).map(([k, v]) => [k, {text: v.text}])),
        },

        // ✅ 收款状态筛选 + 未付款显示
        {
            title: '收款',
            dataIndex: 'isPaid',
            width: 110,
            hideInTable: false,
            valueType: 'select',
            valueEnum: {
                true: {text: '已收款'},
                false: {text: '未收款'},
            },
            render: (_: any, row: any) => {
                // 赠送单：保持“赠送”展示
                if (row?.isGifted) return <Tag>赠送</Tag>;
                if (row?.isPaid === false) return <Tag color="red">未收款</Tag>;
                return <Tag color="green">已收款</Tag>;
            },
        },

        {
            title: '实付',
            dataIndex: 'paidAmount',
            width: 90,
            hideInTable: false,
            render: (_: any, row: any) => `¥${row.paidAmount}`,
            search: false,
        },

        /**
         * ✅ customerGameId 脱敏兜底（仅影响“已结单状态”）
         * - 后端会做强制脱敏/不返回，这里只是前端兜底，避免意外泄露
         * - 为了“最小改动”，仍保留该列、也保留 search 入参（你后端若禁止，会自然无结果）
         */
        {
            title: '客户游戏ID',
            dataIndex: 'customerGameId',
            ellipsis: true,
            hideInTable: isMobile,
            render: (_: any, row: any) => {
                const value = renderCustomerGameId(row);
                if (value !== '******') return value;
                return (
                    <Tooltip title="已结单订单：非超级管理员/客服主管不允许查看客户游戏ID">
                        <span style={{letterSpacing: 2}}>******</span>
                    </Tooltip>
                );
            },

            // 搜索框是否显示：如果你希望“非允许角色”不能用 customerGameId 搜索，也可以关掉
            // 这里按“最小改动”默认保留搜索输入框：后端会自行校验/限制返回
        },

        {
            title: '查询月份',
            dataIndex: 'orderMonth',
            hideInTable: true,
            renderFormItem: () => <DatePicker picker="month" allowClear style={{ width: '100%' }} />,
        },

        {
            title: '派单客服',
            dataIndex: ['dispatcher', 'name'],
            width: 110,
            hideInTable: isMobile,
            search: false,
        },
        {
            title: '当前陪玩',
            dataIndex: 'currentPlayers',
            search: false,
            hideInTable: isMobile,
            render: (_: any, row: any) => {
                const players = row.currentDispatch?.participants?.map((p: any) => p.user?.name || p.user?.phone) || [];
                if (players.length === 0) return '-';
                return (
                    <Space wrap>
                        {players.map((n: string) => (
                            <Tag key={n}>{n}</Tag>
                        ))}
                    </Space>
                );
            },
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            valueType: 'dateTime',
            width: 170,
            hideInTable: isMobile,
            search: false,
        },
        {
            title: '操作',
            valueType: 'option',
            width: 260,
            render: (_: any, row: any) => {
                // ✅ 列表快捷“确认收款”：排除赠送单 + 未收款
                const canQuickMarkPaid = !row?.isGifted && row?.isPaid === false;

                return [
                    // <a key="detail" onClick={() => navigate(`/orders/${row.id}`)}>
                    <a
                        href={`/orders/${row.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        详情
                    </a>,
                    hasOrderPermission('orders:list:delete:button') ? (
                        <a
                            key="delete"
                            style={{ color: '#ff4d4f' }}
                            onClick={() => confirmDeleteOrder(row)}
                        >
                            删除
                        </a>
                    ) : null,


                    // canQuickMarkPaid ? (
                    //     <a
                    //         key="markPaid"
                    //         style={{ color: '#1677ff', fontWeight: 500 }}
                    //         onClick={() => openMarkPaidModal(row)}
                    //     >
                    //         确认收款
                    //     </a>
                    // ) : null,
                ].filter(Boolean);
            },
        },
    ];

    return (
        <PageContainer>
            {/* ✅ 未付款行高亮（最小侵入：只在本页加样式，不动全局） */}
            <style>
                {`
                .orders-row-unpaid td{
                    background: rgba(255, 77, 79, 0.08) !important;
                }
                `}
            </style>

            <Card
                loading={overviewLoading}
                size="small"
                style={{marginBottom: 12, borderRadius: 12}}
                bodyStyle={{padding: isMobile ? '8px 10px' : '10px 12px'}}
            >
                <Space direction="vertical" size={isMobile ? 6 : 8} style={{width: '100%'}}>
                    <Row gutter={[8, 8]}>
                        <Col xs={12} sm={8}>
                            <div style={{padding: isMobile ? '4px 8px' : '6px 10px', borderRadius: 8, background: '#fafafa', border: '1px solid #f0f0f0'}}>
                                <div style={{fontSize: 11, color: 'rgba(0,0,0,.45)', lineHeight: 1.1}}>今日订单</div>
                                <div style={{fontSize: isMobile ? 16 : 18, fontWeight: 600, lineHeight: 1.15}}>
                                    {Number(todayOverview?.orderCount || 0)}
                                </div>
                            </div>
                        </Col>
                        <Col xs={12} sm={8}>
                            <div style={{padding: isMobile ? '4px 8px' : '6px 10px', borderRadius: 8, background: '#fafafa', border: '1px solid #f0f0f0'}}>
                                <div style={{fontSize: 11, color: 'rgba(0,0,0,.45)', lineHeight: 1.1}}>今日营收</div>
                                <div style={{fontSize: isMobile ? 16 : 18, fontWeight: 600, lineHeight: 1.15}}>
                                    ¥{Number(todayOverview?.allPaidAmountTotal || 0).toFixed(2)}
                                </div>
                            </div>
                        </Col>
                        <Col xs={12} sm={8}>
                            <div style={{padding: isMobile ? '4px 8px' : '6px 10px', borderRadius: 8, background: '#fafafa', border: '1px solid #f0f0f0'}}>
                                <div style={{fontSize: 11, color: 'rgba(0,0,0,.45)', lineHeight: 1.1}}>收钱吧</div>
                                <div style={{fontSize: isMobile ? 16 : 18, fontWeight: 600, lineHeight: 1.15}}>
                                    ¥{Number(todayOverview?.manualReceiptAmountTotal || 0).toFixed(2)}
                                </div>
                            </div>
                        </Col>
                    </Row>

                    <Collapse
                        ghost
                        size="small"
                        items={[
                            {
                                key: 'detail',
                                label: '查看统计说明',
                                children: (
                                    <Space direction="vertical" size={6} style={{width: '100%'}}>
                                        <div style={{fontSize: 12, color: 'rgba(0,0,0,.45)'}}>
                                            统计按付款时间计算。仅展示今日经营数据与收钱吧总额。
                                        </div>
                                    </Space>
                                ),
                            },
                        ]}
                    />
                </Space>
            </Card>

            {consumptionSummary?.customerGameId ? (
                <Card
                    size="small"
                    style={{marginBottom: 12, borderRadius: 12}}
                    bodyStyle={{padding: isMobile ? '8px 10px' : '10px 12px'}}
                >
                    <Row gutter={[8, 8]}>
                        <Col xs={24} sm={8}>
                            <div style={{fontSize: 11, color: 'rgba(0,0,0,.45)', lineHeight: 1.1}}>客户游戏ID</div>
                            <div style={{fontSize: isMobile ? 15 : 16, fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-all'}}>
                                {consumptionSummary.customerGameId}
                            </div>
                            <div style={{fontSize: 12, color: 'rgba(0,0,0,.45)', marginTop: 2}}>
                                {consumptionSummary.orderMonth ? `月份：${consumptionSummary.orderMonth}` : '月份：全部'}
                            </div>
                        </Col>
                        <Col xs={8} sm={4}>
                            <div style={{fontSize: 11, color: 'rgba(0,0,0,.45)', lineHeight: 1.1}}>订单数</div>
                            <div style={{fontSize: isMobile ? 16 : 18, fontWeight: 600, lineHeight: 1.15}}>
                                {Number(consumptionSummary.orderCount || 0)}
                            </div>
                        </Col>
                        <Col xs={8} sm={6}>
                            <div style={{fontSize: 11, color: 'rgba(0,0,0,.45)', lineHeight: 1.1}}>应付合计</div>
                            <div style={{fontSize: isMobile ? 16 : 18, fontWeight: 600, lineHeight: 1.15}}>
                                ¥{Number(consumptionSummary.receivableAmount || 0).toFixed(2)}
                            </div>
                        </Col>
                        <Col xs={8} sm={6}>
                            <div style={{fontSize: 11, color: 'rgba(0,0,0,.45)', lineHeight: 1.1}}>实付合计</div>
                            <div style={{fontSize: isMobile ? 16 : 18, fontWeight: 600, lineHeight: 1.15}}>
                                ¥{Number(consumptionSummary.paidAmount || 0).toFixed(2)}
                            </div>
                        </Col>
                    </Row>
                </Card>
            ) : null}

            {isMobile ? (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Card size="small" style={{ borderRadius: 12 }} bodyStyle={{ padding: 12 }}>
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                            <Input.Search
                                allowClear
                                placeholder="订单号 / 客服 / 陪玩昵称"
                                enterButton="搜索"
                                value={mobileFilters.keyword}
                                onChange={(e) => setMobileFilters((prev) => ({ ...prev, keyword: e.target.value }))}
                                onSearch={(value) => {
                                    const next = { ...mobileFilters, keyword: value };
                                    setMobileFilters(next);
                                    void loadMobileOrders(1, next);
                                }}
                            />
                            <Row gutter={[8, 8]}>
                                <Col span={12}>
                                    <Select
                                        allowClear
                                        placeholder="状态"
                                        value={mobileFilters.status}
                                        options={Object.entries(statusText).map(([value, meta]) => ({ value, label: meta.text }))}
                                        onChange={(value) => setMobileFilters((prev) => ({ ...prev, status: value }))}
                                        style={{ width: '100%' }}
                                    />
                                </Col>
                                <Col span={12}>
                                    <Select
                                        allowClear
                                        placeholder="收款"
                                        value={mobileFilters.isPaid as any}
                                        options={[
                                            { value: true, label: '已收款' },
                                            { value: false, label: '未收款' },
                                        ]}
                                        onChange={(value) => setMobileFilters((prev) => ({ ...prev, isPaid: value }))}
                                        style={{ width: '100%' }}
                                    />
                                </Col>
                                <Col span={12}>
                                    <Select
                                        allowClear
                                        placeholder="渠道"
                                        value={mobileFilters.orderSource}
                                        options={orderSourceOptions}
                                        onChange={(value) => setMobileFilters((prev) => ({ ...prev, orderSource: value }))}
                                        style={{ width: '100%' }}
                                    />
                                </Col>
                                <Col span={12}>
                                    <DatePicker
                                        picker="month"
                                        allowClear
                                        placeholder="月份"
                                        value={mobileFilters.orderMonth ? dayjs(mobileFilters.orderMonth, 'YYYY-MM') : undefined}
                                        style={{ width: '100%' }}
                                        onChange={(value) => setMobileFilters((prev) => ({
                                            ...prev,
                                            orderMonth: value ? dayjs(value).format('YYYY-MM') : undefined,
                                        }))}
                                    />
                                </Col>
                                <Col span={24}>
                                    <Input
                                        allowClear
                                        placeholder="客户游戏ID"
                                        value={mobileFilters.customerGameId}
                                        onChange={(e) => setMobileFilters((prev) => ({ ...prev, customerGameId: e.target.value }))}
                                    />
                                </Col>
                            </Row>
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Button
                                    onClick={() => {
                                        setMobileFilters({});
                                        void loadMobileOrders(1, {});
                                    }}
                                >
                                    重置
                                </Button>
                                <Space>
                                    <Button onClick={() => void loadMobileOrders(1, mobileFilters)}>筛选</Button>
                                    {hasOrderPermission('orders:list:create:button') ? (
                                        <Button type="primary" onClick={() => setCreateOpen(true)}>
                                            新建
                                        </Button>
                                    ) : null}
                                </Space>
                            </Space>
                        </Space>
                    </Card>

                    <List
                        loading={mobileLoading}
                        dataSource={mobileOrders}
                        rowKey={(row: any) => String(row.id)}
                        renderItem={renderMobileOrderCard}
                        locale={{ emptyText: '暂无订单' }}
                        split={false}
                        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 12px' }}>
                        <Pagination
                            simple
                            current={mobilePage}
                            pageSize={10}
                            total={mobileTotal}
                            onChange={(page) => void loadMobileOrders(page, mobileFilters)}
                        />
                    </div>
                </Space>
            ) : (
                <ProTable<any>
                    rowKey="id"
                actionRef={actionRef}
                columns={columns}
                search={isMobile ? { labelWidth: 72, defaultCollapsed: true } : { labelWidth: 90 }}
                options={isMobile ? false : undefined}
                pagination={{
                    pageSize: isMobile ? 10 : 20,
                    showSizeChanger: !isMobile,
                    simple: isMobile,
                }}
                scroll={isMobile ? { x: 760 } : undefined}
                toolbar={{
                    actions: [
                        hasOrderPermission('orders:list:create:button') ? (
                            <Button key="new" type="primary" onClick={() => setCreateOpen(true)} style={isMobile ? {width: '100%'} : undefined}>
                                新建订单
                            </Button>
                        ) : null,
                    ],
                }}
                // ✅ 未付款高亮（排除赠送单）
                rowClassName={(row: any) => {
                    if (row?.isGifted) return '';
                    return row?.isPaid === false ? 'orders-row-unpaid' : '';
                }}
                request={async (params) => {
                    // ProTable select 可能传 string，这里做一次规范化
                    const isPaidParam =
                        params.isPaid === undefined
                            ? undefined
                            : params.isPaid === 'true'
                            ? true
                            : params.isPaid === 'false'
                                ? false
                                : Boolean(params.isPaid);

                    const customerGameId = String(params.customerGameId || '').trim();
                    const orderMonth = params.orderMonth ? dayjs(params.orderMonth as any).format('YYYY-MM') : undefined;
                    const res = await getOrders({
                        page: Number(params.current || 1),
                        limit: Number(params.pageSize || 20),
                        serial: params.autoSerial,
                        status: params.status,
                        customerGameId,
                        orderMonth,
                        // ✅ 新增：综合搜索
                        keyword: params.keyword,
                        // ✅ 收款筛选
                        isPaid: isPaidParam,
                        orderSource: params.orderSource,

                        // projectId/playerId/dispatcherId 你后续加筛选控件后再传
                    });
                    if (customerGameId) {
                        setConsumptionSummary({
                            customerGameId,
                            orderMonth,
                            orderCount: Number(res.total || 0),
                            receivableAmount: Number(res?.summary?.receivableAmount || 0),
                            paidAmount: Number(res?.summary?.paidAmount || 0),
                        });
                    } else {
                        setConsumptionSummary(null);
                    }

                    return {
                        data: res.data || [],
                        success: true,
                        total: res.total || 0,
                    };
                }}
                />
            )}

            <OrderUpsertModal
                open={createOpen}
                title="创建订单"
                showPlayers
                onCancel={() => setCreateOpen(false)}
                onSubmit={async (payload) => {
                    const created = await createOrder({
                        source: 'LIST',
                        projectId: payload?.projectId,
                        receivableAmount: payload?.receivableAmount,
                        paidAmount: payload?.paidAmount,
                        settlementAmount: payload?.settlementAmount,
                        baseAmountWan: payload?.baseAmountWan ?? undefined,
                        customerGameId: payload?.customerGameId,
                        orderSource: payload?.orderSource,
                        orderTime: payload?.orderTime,
                        paymentTime: payload?.paymentTime,
                        csRate: payload?.csRate,
                        inviteRate: payload?.isRenewal ? 0 : payload?.inviteRate,
                        inviter: payload?.isRenewal ? undefined : payload?.inviter,
                        customClubRate: payload?.customClubRate,
                        remark: payload?.remark,
                        isGifted: Boolean(payload?.isGifted),
                        playerIds: payload?.playerIds,
                        isRenewal: Boolean(payload?.isRenewal),
                        renewalPlayerIds: payload?.isRenewal ? payload?.renewalPlayerIds : undefined,

                        // ✅ 是否已收款（不再由 paymentTime 推断）
                        isPaid: Boolean(payload?.isPaid),
                    });

                    const orderId = Number((created as any)?.id ?? (created as any)?.data?.id);
                    if (!orderId) throw new Error('创建订单失败：未返回订单ID');

                    message.success('创建成功');
                    setCreateOpen(false);
                    actionRef.current?.reload?.();
                    navigate(`/orders/${orderId}`);
                }}
            />

            {/* ✅ 列表页：确认收款弹窗（可修正实收金额） */}
            <Modal
                open={markPaidOpen}
                title={`确认收款：${markPaidOrder?.autoSerial || ''}`}
                onCancel={() => setMarkPaidOpen(false)}
                onOk={submitMarkPaid}
                confirmLoading={markPaidSubmitting}
                okText="确认"
            >
                <Form form={markPaidForm} layout="vertical">
                    <Form.Item
                        label="实收金额（实付）"
                        name="paidAmount"
                        rules={[{required: true, message: '请输入实收金额'}]}
                    >
                        <InputNumber style={{width: '100%'}} min={0} step={1}/>
                    </Form.Item>

                    <Form.Item label="备注" name="remark">
                        <Input.TextArea rows={3} placeholder="可填写收款备注（可不填）"/>
                    </Form.Item>

                    <Form.Item name="confirmPaid" valuePropName="checked" initialValue={true}>
                        <Checkbox>确认订单已经收款入账</Checkbox>
                    </Form.Item>
                </Form>
            </Modal>
        </PageContainer>
    );
};

export default OrdersPage;
