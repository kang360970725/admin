import React, { useEffect, useMemo, useRef, useState } from 'react';
import {ActionType, PageContainer} from '@ant-design/pro-components';
import {
    Badge,
    Button,
    Card,
    Col,
    DatePicker,
    Drawer,
    Form,
    Input,
    InputNumber,
    message,
    Row,
    Select,
    Space,
    Tabs,
    Tag,
    Typography,
    FloatButton,
    Checkbox,
    List,
    Pagination,
} from 'antd';
import {
    AppstoreOutlined,
    WalletOutlined,
    ProfileOutlined,
    ReloadOutlined,
    SearchOutlined,
    ThunderboltOutlined,
    PlusOutlined,
    CheckCircleOutlined,
    CopyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {history, useNavigate} from '@umijs/max';
import {
    assignDispatch,
    createOrder,
    getGameProjectOptions,
    getOrders,
    getPlayerOptions,
    getUserCoupons,
    updatePlayerWorkMode,
} from '@/services/api';
import { useIsMobile } from '@/utils/useIsMobile';
import OrderUpsertModal from "@/pages/Orders/components/OrderForm";

const { Text } = Typography;

const MAX_PLAYERS = 2;

const statusText: Record<string, { text: string; color?: string }> = {
    WAIT_ASSIGN: { text: '待派单', color: 'default' },
    WAIT_ACCEPT: { text: '待接单', color: 'orange' },
    ACCEPTED: { text: '已接单', color: 'blue' },
    ARCHIVED: { text: '已存单', color: 'purple' },
    COMPLETED: { text: '已结单', color: 'green' },
    WAIT_REVIEW: { text: '待评价', color: 'gold' },
    REVIEWED: { text: '已评价', color: 'cyan' },
    WAIT_AFTERSALE: { text: '待售后', color: 'volcano' },
    AFTERSALE_DONE: { text: '已售后', color: 'magenta' },
    REFUNDED: { text: '已退款', color: 'red' },
};

type OptionItem = { label: string; value: number };
type ProjectOptionItem = { label: string; value: number; baseAmount?: number | null; price?: number | null };
type PlayerManageItem = {
    id: number;
    name?: string;
    phone?: string;
    ratingName?: string;
    todayHandledCount?: number;
    workMode?: 'ONLINE' | 'OFFLINE';
    offlineJoinedAt?: string | null;
    workStatus?: string;
};

type OrderRow = {
    id: number;
    autoSerial?: string;
    status: string;
    paidAmount?: number;
    customerGameId?: string;
    createdAt?: string;
    project?: { name?: string } | null;
    dispatcher?: { name?: string } | null;
    currentDispatch?: {
        participants?: Array<{ user?: { name?: string; phone?: string } | null }>;
    } | null;
};

const safeArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);

/** 截断 1 位小数（不四舍五入） */
const trunc1 = (x: any) => {
    const n = Number(x);
    if (!Number.isFinite(n)) return 0;
    return Math.trunc(n * 10) / 10;
};

// ✅ 兼容不同接口返回结构
const normalizeList = (res: any): any[] => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.list)) return res.list;
    if (Array.isArray(res?.rows)) return res.rows;
    return [];
};

const getPlayerWorkStateMeta = (player: PlayerManageItem) => {
    if (player.workMode === 'OFFLINE') {
        return { text: '离线', color: 'default' as const };
    }
    if (String(player.workStatus || '').toUpperCase() === 'WORKING') {
        return { text: '接单中', color: 'blue' as const };
    }
    return { text: '空闲', color: 'green' as const };
};

// 简易防抖：减少移动端搜索抖动请求
const useDebouncedFn = (fn: (...args: any[]) => void, delay = 250) => {
    const timer = useRef<number | null>(null);
    return (...args: any[]) => {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => fn(...args), delay);
    };
};

export default function CSWorkbenchPage() {
    const actionRef = useRef<ActionType>();
    const navigate = useNavigate();
    const isMobile = useIsMobile(768);

    const [createOpen, setCreateOpen] = useState(false);

    // TAB：create / archived / wait_assign / wait_accept
    const [tab, setTab] = useState<'create' | 'ARCHIVED' | 'WAIT_ASSIGN' | 'WAIT_ACCEPT'>('create');

    // 列表筛选
    const [loading, setLoading] = useState(false);
    const [keyword, setKeyword] = useState<string>(''); // 订单编号 autoSerial
    const [customerGameId, setCustomerGameId] = useState<string>('');
    const [orderMonth, setOrderMonth] = useState<string>('');

    // 列表数据
    const [list, setList] = useState<OrderRow[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [consumptionSummary, setConsumptionSummary] = useState<any>(null);

    // 派单抽屉（列表里的立即派单）
    const [dispatchOpen, setDispatchOpen] = useState(false);
    const [dispatching, setDispatching] = useState(false);
    const [activeOrder, setActiveOrder] = useState<OrderRow | null>(null);
    const [dispatchForm] = Form.useForm();

    // ===== 创建订单（手机端） =====
    const [createForm] = Form.useForm();
    const [creating, setCreating] = useState(false);

    // 项目 options
    const [projectLoading, setProjectLoading] = useState(false);
    const [projectOptions, setProjectOptions] = useState<ProjectOptionItem[]>([]);
    const [projectKeyword, setProjectKeyword] = useState(''); // ✅ 下拉内搜索关键字（移动端不唤起键盘遮挡）

    // 打手 options（复用：创建订单立即派单 + 列表派单）
    const [playerLoading, setPlayerLoading] = useState(false);
    const [playerOptions, setPlayerOptions] = useState<OptionItem[]>([]);
    const [playerMap, setPlayerMap] = useState<Record<number, string>>({});
    const [onlinePlayers, setOnlinePlayers] = useState<PlayerManageItem[]>([]);
    const [onlinePlayerLoading, setOnlinePlayerLoading] = useState(false);
    const [onlinePlayerKeyword, setOnlinePlayerKeyword] = useState('');
    const [onlinePlayerPage, setOnlinePlayerPage] = useState(1);
    const [onlinePlayerPageSize] = useState(20);
    const [onlinePlayerTotal, setOnlinePlayerTotal] = useState(0);
    const [playerKeywordCreate, setPlayerKeywordCreate] = useState('');
    const [playerKeywordDispatch, setPlayerKeywordDispatch] = useState('');
    const [playerPickerOpenCreate, setPlayerPickerOpenCreate] = useState(false);
    const [playerPickerOpenDispatch, setPlayerPickerOpenDispatch] = useState(false);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponOptions, setCouponOptions] = useState<Array<{ label: string; value: number }>>([]);

    const lastFetchRef = useRef<string>('');
    const now = useMemo(() => dayjs(), []);

    const statusFilter = useMemo(() => {
        if (tab === 'create') return undefined;
        return tab;
    }, [tab]);

    const fetchProjects = async (kw?: string) => {
        setProjectLoading(true);
        try {
            const res = await getGameProjectOptions({ keyword: kw || '' });
            const arr = normalizeList(res);
            const options: ProjectOptionItem[] = safeArray(arr).map((p: any) => ({
                value: Number(p.id),
                label: `${p.name}${p.price != null ? `（¥${p.price}）` : ''}`,
                baseAmount: p.baseAmount ?? null,
                price: p.price ?? null,
            }));
            setProjectOptions(options);
        } catch (e) {
            console.error(e);
            setProjectOptions([]);
        } finally {
            setProjectLoading(false);
        }
    };

    const fetchPlayers = async (kw?: string) => {
        setPlayerLoading(true);
        try {
            const res = await getPlayerOptions({ keyword: kw || '', onlyIdle: true, onlyOnline: true });
            const arr = normalizeList(res);
            const map: Record<number, string> = {};
            const options: OptionItem[] = safeArray(arr).map((u: any) => ({
                value: Number(u.id),
                label: `${u.name || '未命名'}（${u.phone || '-'}）`,
            }));
            safeArray(arr).forEach((u: any) => {
                const id = Number(u.id);
                if (Number.isFinite(id) && id > 0) {
                    map[id] = String(u.name || u.phone || '未命名');
                }
            });
            setPlayerOptions(options);
            setPlayerMap((prev) => ({ ...prev, ...map }));
        } catch (e) {
            console.error(e);
            setPlayerOptions([]);
        } finally {
            setPlayerLoading(false);
        }
    };

    const fetchOnlinePlayers = async (kw?: string, page?: number) => {
        setOnlinePlayerLoading(true);
        try {
            const queryPage = Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;
            const res: any = await getPlayerOptions({
                keyword: kw || '',
                onlyIdle: false,
                onlyOnline: true,
                paginate: true,
                page: queryPage,
                limit: onlinePlayerPageSize,
            });
            const arr = normalizeList(res?.data ?? res);
            const items: PlayerManageItem[] = safeArray(arr).map((u: any) => ({
                id: Number(u.id),
                name: String(u.name || '未命名'),
                phone: String(u.phone || '-'),
                ratingName: String(u.ratingName || u?.staffRating?.name || '-'),
                todayHandledCount: Number(u.todayHandledCount ?? 0),
                workMode: u.workMode === 'OFFLINE' ? 'OFFLINE' : 'ONLINE',
                offlineJoinedAt: u.offlineJoinedAt ?? null,
                workStatus: String(u.workStatus || 'IDLE'),
            }));
            setOnlinePlayers(items);
            setOnlinePlayerPage(Number(res?.page ?? queryPage));
            setOnlinePlayerTotal(Number(res?.total ?? items.length ?? 0));
        } catch (e) {
            console.error(e);
            setOnlinePlayers([]);
            setOnlinePlayerTotal(0);
        } finally {
            setOnlinePlayerLoading(false);
        }
    };

    const fetchCoupons = async () => {
        setCouponLoading(true);
        try {
            const res: any = await getUserCoupons({ page: 1, limit: 100, status: 'UNUSED' });
            const rows = Array.isArray(res?.data) ? res.data : [];
            const options = rows.map((row: any) => {
                const uid = row?.user?.id ? `用户#${row.user.id}` : '用户#-';
                const uname = row?.user?.name || row?.user?.phone || '-';
                const tname = row?.template?.name || `模板#${row?.templateId ?? '-'}`;
                return {
                    value: Number(row.id),
                    label: `券#${row.id} ${tname} / ${uid} ${uname}`,
                };
            });
            setCouponOptions(options);
        } catch (e) {
            console.error(e);
            setCouponOptions([]);
        } finally {
            setCouponLoading(false);
        }
    };

    const debouncedFetchProjects = useDebouncedFn(fetchProjects, 250);
    const debouncedFetchPlayers = useDebouncedFn(fetchPlayers, 250);
    const debouncedFetchOnlinePlayers = useDebouncedFn(fetchOnlinePlayers, 250);

    const watchedCreatePlayerIds = Form.useWatch('playerIds', createForm) || [];
    const watchedDispatchPlayerIds = Form.useWatch('playerIds', dispatchForm) || [];
    const visibleOnlinePlayers = useMemo(
        () => {
            const rows = Array.isArray(onlinePlayers) ? onlinePlayers : [];
            return rows.filter((player) => player.workMode === 'ONLINE');
        },
        [onlinePlayers],
    );

    const syncSettlementAmount = (value?: any) => {
        const next = Number(value ?? 0);
        createForm.setFieldsValue({
            settlementAmount: Number.isFinite(next) ? next : 0,
        });
    };

    const updatePlayerSelection = (targetForm: any, nextIds: number[]) => {
        const limitedIds = nextIds.slice(0, MAX_PLAYERS);
        const names = limitedIds.map((id) => playerMap?.[Number(id)]).filter(Boolean);
        targetForm.setFieldsValue({
            playerIds: limitedIds,
            playerNames: names,
        });
    };

    const toggleCreatePlayer = (playerId: number) => {
        const current = Array.isArray(watchedCreatePlayerIds)
            ? watchedCreatePlayerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
            : [];
        const exists = current.includes(playerId);
        if (!exists && current.length >= MAX_PLAYERS) {
            message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
            return;
        }
        updatePlayerSelection(createForm, exists ? current.filter((id) => id !== playerId) : [...current, playerId]);
    };

    const toggleDispatchPlayer = (playerId: number) => {
        const current = Array.isArray(watchedDispatchPlayerIds)
            ? watchedDispatchPlayerIds.map((x: any) => Number(x)).filter((n: number) => !Number.isNaN(n))
            : [];
        const exists = current.includes(playerId);
        if (!exists && current.length >= MAX_PLAYERS) {
            message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
            return;
        }
        updatePlayerSelection(dispatchForm, exists ? current.filter((id) => id !== playerId) : [...current, playerId]);
    };

    const handleTogglePlayerWorkMode = async (playerId: number, nextMode: 'ONLINE' | 'OFFLINE') => {
        try {
            await updatePlayerWorkMode(playerId, { workMode: nextMode });
            message.success(nextMode === 'ONLINE' ? '已设为在线' : '已设为离线');
            void fetchOnlinePlayers(onlinePlayerKeyword, onlinePlayerPage);
            void fetchPlayers(playerKeywordCreate || '');
            void fetchPlayers(playerKeywordDispatch || '');
        } catch (e: any) {
            console.error(e);
            message.error(e?.response?.data?.message || e?.message || '状态更新失败');
        }
    };

    const fetchOrders = async (nextPage?: number) => {
        if (tab === 'create') return;
        const p = Math.max(1, Number(nextPage ?? page ?? 1));

        const signature = JSON.stringify({
            tab,
            statusFilter,
            keyword,
            customerGameId,
            orderMonth,
            p,
        });
        lastFetchRef.current = signature;

        setLoading(true);
        try {
            const res = await getOrders({
                page: p,
                limit: 20,
                serial: keyword?.trim() || undefined,
                status: statusFilter,
                customerGameId: customerGameId?.trim() || undefined,
                orderMonth: orderMonth || undefined,
            });

            if (lastFetchRef.current !== signature) return;

            setList(safeArray<OrderRow>((res as any)?.data));
            setTotal(Number((res as any)?.total ?? 0));
            const queryCustomerGameId = String(customerGameId || '').trim();
            if (queryCustomerGameId) {
                setConsumptionSummary({
                    customerGameId: queryCustomerGameId,
                    orderMonth: orderMonth || undefined,
                    orderCount: Number((res as any)?.total ?? 0),
                    receivableAmount: Number((res as any)?.summary?.receivableAmount ?? 0),
                    paidAmount: Number((res as any)?.summary?.paidAmount ?? 0),
                });
            } else {
                setConsumptionSummary(null);
            }
            setPage(p);
        } catch (e: any) {
            console.error(e);
            message.error(e?.response?.data?.message || e?.message || '获取订单失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchProjects('');
        void fetchPlayers('');
            void fetchOnlinePlayers('', 1);
        void fetchCoupons();

        // 创建表单默认值（减少手机端输入）
        createForm.setFieldsValue({
            orderTime: now,
            paymentTime: now,
            receivableAmount: 0,
            paidAmount: 0,
            settlementAmount: 0,
            playerIds: [],
            remark: '客服工作台创建',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (tab !== 'create') void fetchOrders(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    useEffect(() => {
        if (!isMobile) {
            void fetchOnlinePlayers(onlinePlayerKeyword, 1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMobile]);

    // ============ 列表派单 ============
    const openDispatch = (order: OrderRow) => {
        setActiveOrder(order);
        setDispatchOpen(true);
        setPlayerKeywordDispatch('');
        dispatchForm.resetFields();
        dispatchForm.setFieldsValue({
            remark: '客服工作台派单',
            playerIds: [],
        });
    };

    const submitDispatch = async () => {
        try {
            const values = await dispatchForm.validateFields();
            const order = activeOrder;
            if (!order?.id) return;

            const playerIds: number[] = safeArray(values.playerIds)
                .map((x: any) => Number(x))
                .filter((n: number) => !Number.isNaN(n));

            if (playerIds.length < 1 || playerIds.length > MAX_PLAYERS) {
                message.warning(`请选择 1~${MAX_PLAYERS} 名打手`);
                return;
            }

            setDispatching(true);
            await assignDispatch(order.id, {
                playerIds,
                remark: values.remark?.trim() || '客服工作台派单',
            });

            message.success('派单成功');
            setDispatchOpen(false);
            setActiveOrder(null);
            void fetchOrders(page);
        } catch (e: any) {
            console.error(e);
            message.error(e?.response?.data?.message || e?.message || '派单失败');
        } finally {
            setDispatching(false);
        }
    };

    const pasteCustomerGameIdFromClipboard = async () => {
        try {
            const readText = navigator?.clipboard?.readText;
            if (!readText) {
                message.warning('当前环境不支持一键读取剪切板，请手动长按粘贴');
                return;
            }
            const text = await readText();
            const trimmed = (text ?? '').trim();

            if (!trimmed) {
                message.warning('剪切板为空或只有空格');
                return;
            }

            createForm.setFieldsValue({ customerGameId: trimmed });
            message.success('已从剪切板粘贴客户游戏ID');
        } catch (e) {
            console.error(e);
            message.error('读取剪切板失败：请确认已允许权限，或手动长按粘贴');
        }
    };

    const onCreateFormValuesChange = (changed: any) => {
        if (changed?.paidAmount != null) {
            syncSettlementAmount(changed.paidAmount);
        }

        if (changed?.projectId) {
            const selected = projectOptions.find((item) => Number(item.value) === Number(changed.projectId));
            const selectedPrice = (selected as any)?.price;
            if (selectedPrice != null && Number.isFinite(Number(selectedPrice))) {
                const p = trunc1(selectedPrice);
                const currentPaid = Number(createForm.getFieldValue('paidAmount') ?? 0);
                if (!currentPaid) {
                    createForm.setFieldsValue({ paidAmount: p });
                }
                syncSettlementAmount(currentPaid || p);
            }
        }
    };

    // ============ 创建订单（手机端） ============
    const submitCreateOrder = async () => {
        try {
            const values = await createForm.validateFields();

            const customerId = (values.customerGameId ?? '').trim();
            createForm.setFieldsValue({ customerGameId: customerId });

            const playerIds: number[] = safeArray(values.playerIds)
                .map((x: any) => Number(x))
                .filter((n: number) => !Number.isNaN(n));

            if (playerIds.length > MAX_PLAYERS) {
                message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
                return;
            }

            const projectId = Number(values.projectId);
            const receivableAmount = trunc1(values.receivableAmount);
            const paidAmount = trunc1(values.paidAmount);

            if (!projectId) {
                message.warning('请选择项目');
                return;
            }

            setCreating(true);

            const payload: any = {
                projectId,
                receivableAmount,
                paidAmount,
                settlementAmount: values.settlementAmount != null && values.settlementAmount !== '' ? Number(values.settlementAmount) : Number(values.paidAmount),
                baseAmountWan:
                    values.baseAmountWan != null && values.baseAmountWan !== '' ? Number(values.baseAmountWan) : undefined,
                customerGameId: customerId || undefined,

                orderTime: values.orderTime ? dayjs(values.orderTime).toISOString() : now.toISOString(),
                paymentTime: values.paymentTime ? dayjs(values.paymentTime).toISOString() : now.toISOString(),
                inviter: values.inviter?.trim() || undefined,
                csRate: values.csRate != null && values.csRate !== '' ? Number(values.csRate) : undefined,
                inviteRate: values.inviteRate != null && values.inviteRate !== '' ? Number(values.inviteRate) : undefined,
                customClubRate: values.customClubRate != null && values.customClubRate !== '' ? Number(values.customClubRate) : undefined,
                userCouponId: values.userCouponId != null && values.userCouponId !== '' ? Number(values.userCouponId) : undefined,
                remark: values.remark?.trim() || undefined,
            };

            const created = await createOrder(payload);
            const orderId = Number((created as any)?.id ?? (created as any)?.data?.id);
            if (!orderId) throw new Error('创建订单失败：未返回订单ID');

            if (playerIds.length > 0) {
                await assignDispatch(orderId, { playerIds, remark: '新建订单时派单' });
            }

            message.success('创建成功');
            history.push(`/orders/${orderId}`);
        } catch (e: any) {
            console.error(e);
            message.error(e?.response?.data?.message || e?.message || '创建失败');
        } finally {
            setCreating(false);
        }
    };

    const renderPlayers = (row: OrderRow) => {
        const players =
            row.currentDispatch?.participants?.map((p: any) => p?.user?.name || p?.user?.phone).filter(Boolean) || [];
        if (!players.length) return <Text type="secondary">-</Text>;
        return (
            <Space size={6} wrap>
                {players.map((n: any, idx: number) => (
                    <Tag key={`${n}-${idx}`}>{String(n)}</Tag>
                ))}
            </Space>
        );
    };

    const renderStatus = (s: string) => {
        const meta = statusText[s] || { text: s };
        return <Tag color={meta.color}>{meta.text}</Tag>;
    };

    // ✅ Select 通用：下拉挂到 body + 限高，减少被容器裁剪
    const commonSelectProps = {
        getPopupContainer: () => document.body,
        dropdownStyle: { maxHeight: '60vh', overflow: 'auto' as const },
        virtual: false,
    };

    // ✅ 移动端：项目下拉内部搜索（避免 showSearch 唤起键盘挡住下拉）
    const projectDropdown = (menu: React.ReactNode) => (
        <>
            <div style={{ padding: 8, borderBottom: '1px solid rgba(0,0,0,.06)' }}>
                <Input
                    allowClear
                    value={projectKeyword}
                    placeholder="搜索项目名称"
                    onChange={(e) => {
                        const kw = e.target.value;
                        setProjectKeyword(kw);
                        debouncedFetchProjects(kw);
                    }}
                />
            </div>
            {menu}
            <div style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,.06)' }}>
                <Button block loading={projectLoading} onClick={() => fetchProjects(projectKeyword)}>
                    刷新项目
                </Button>
            </div>
        </>
    );

    // ✅ 移动端：打手下拉内部搜索（创建）
    const playerDropdownCreate = (menu: React.ReactNode) => (
        <>
            <div style={{ padding: 8, borderBottom: '1px solid rgba(0,0,0,.06)' }}>
                <Input
                    allowClear
                    value={playerKeywordCreate}
                    placeholder="搜索打手姓名/手机号"
                    onChange={(e) => {
                        const kw = e.target.value;
                        setPlayerKeywordCreate(kw);
                        debouncedFetchPlayers(kw);
                    }}
                />
            </div>
            {menu}
            <div style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,.06)' }}>
                <Button block loading={playerLoading} onClick={() => fetchPlayers(playerKeywordCreate)}>
                    刷新列表
                </Button>
            </div>
        </>
    );

    // ✅ 移动端：打手下拉内部搜索（派单抽屉）
    const playerDropdownDispatch = (menu: React.ReactNode) => (
        <>
            <div style={{ padding: 8, borderBottom: '1px solid rgba(0,0,0,.06)' }}>
                <Input
                    allowClear
                    value={playerKeywordDispatch}
                    placeholder="搜索打手姓名/手机号"
                    onChange={(e) => {
                        const kw = e.target.value;
                        setPlayerKeywordDispatch(kw);
                        debouncedFetchPlayers(kw);
                    }}
                />
            </div>
            {menu}
            <div style={{ padding: 8, borderTop: '1px solid rgba(0,0,0,.06)' }}>
                <Button block loading={playerLoading} onClick={() => fetchPlayers(playerKeywordDispatch)}>
                    刷新列表
                </Button>
            </div>
        </>
    );

    const ListHeader = (
        <div style={{ maxWidth: 920 }}>
            <Card
                bodyStyle={{ padding: 14 }}
                style={{
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, rgba(22,119,255,0.08), rgba(245,34,45,0.05))',
                    border: '1px solid rgba(0,0,0,0.06)',
                }}
            >
                <Row gutter={[10, 10]} align="middle">
                    <Col flex="auto">
                        <Input
                            allowClear
                            prefix={<SearchOutlined />}
                            placeholder="输入订单编号（autoSerial）快速定位"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onPressEnter={() => fetchOrders(1)}
                            style={{ borderRadius: 12 }}
                        />
                    </Col>
                    <Col>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => fetchOrders(1)}
                            loading={loading}
                            style={{ borderRadius: 12 }}
                        >
                            刷新
                        </Button>
                    </Col>
                </Row>

                <div style={{ height: 10 }} />

                <Row gutter={[10, 10]}>
                    <Col span={24}>
                        <Input
                            allowClear
                            placeholder="客户游戏ID"
                            value={customerGameId}
                            onChange={(e) => setCustomerGameId(e.target.value)}
                            onPressEnter={() => fetchOrders(1)}
                            style={{ borderRadius: 12 }}
                        />
                    </Col>
                    <Col span={24}>
                        <DatePicker
                            picker="month"
                            allowClear
                            placeholder="查询月份"
                            value={orderMonth ? dayjs(orderMonth, 'YYYY-MM') : null}
                            onChange={(value) => setOrderMonth(value ? value.format('YYYY-MM') : '')}
                            style={{ width: '100%', borderRadius: 12 }}
                        />
                    </Col>

                    <Col span={24}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text type="secondary">
                                当前：{total} 条（第 {page} 页）
                            </Text>
                            <Space>
                                <Button
                                    onClick={() => fetchOrders(Math.max(1, page - 1))}
                                    disabled={page <= 1 || loading}
                                    style={{ borderRadius: 12 }}
                                >
                                    上一页
                                </Button>
                                <Button
                                    onClick={() => fetchOrders(page + 1)}
                                    disabled={loading || list.length < 1}
                                    style={{ borderRadius: 12 }}
                                >
                                    下一页
                                </Button>
                            </Space>
                        </Space>
                    </Col>
                    {consumptionSummary?.customerGameId ? (
                        <Col span={24}>
                            <div style={{ border: '1px solid #f0f0f0', borderRadius: 12, padding: '10px 12px', background: '#fafafa' }}>
                                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                    <Text strong style={{ wordBreak: 'break-all' }}>
                                        客户游戏ID：{consumptionSummary.customerGameId}
                                    </Text>
                                    <Space size={16} wrap>
                                        <Text type="secondary">月份：{consumptionSummary.orderMonth || '全部'}</Text>
                                        <Text type="secondary">订单数：{Number(consumptionSummary.orderCount || 0)}</Text>
                                        <Text type="secondary">应付：¥{Number(consumptionSummary.receivableAmount || 0).toFixed(2)}</Text>
                                        <Text type="secondary">实付：¥{Number(consumptionSummary.paidAmount || 0).toFixed(2)}</Text>
                                    </Space>
                                </Space>
                            </div>
                        </Col>
                    ) : null}
                </Row>
            </Card>
        </div>
    );

    const CreatePanel = (
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <Card
                style={{
                    borderRadius: 16,
                    border: '1px solid rgba(0,0,0,0.06)',
                    background: 'linear-gradient(135deg, rgba(22,119,255,0.06), rgba(0,0,0,0))',
                }}
                bodyStyle={{ padding: 14 }}
            >
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Space align="center">
                        <Tag color="blue" style={{ borderRadius: 999, padding: '2px 10px' }}>
                            快捷创建
                        </Tag>
                        <Text type="secondary">高级项可展开。</Text>
                    </Space>

                    <Form form={createForm} layout="vertical" requiredMark={false} style={{ marginTop: 6 }} onValuesChange={onCreateFormValuesChange}>
                        <Form.Item name="projectId" label="项目" rules={[{ required: true, message: '请选择项目' }]}>
                            <Select
                                allowClear
                                placeholder="选择项目（移动端下拉内搜索）"
                                options={projectOptions as any}
                                loading={projectLoading}
                                // ✅ 移动端禁用 Select 内置搜索（避免键盘遮挡）
                                showSearch={false}
                                dropdownRender={projectDropdown}
                                onDropdownVisibleChange={(open) => {
                                    if (open) (document.activeElement as any)?.blur?.();
                                }}
                                onChange={(_, option: any) => {
                                    const base = option?.baseAmount;
                                    const price = option?.price;

                                    if (base !== undefined) {
                                        createForm.setFieldsValue({ baseAmountWan: base != null ? Number(base) : null });
                                    }

                                    if (price != null && Number.isFinite(Number(price))) {
                                        const p = trunc1(price);
                                        const currentReceivable = Number(createForm.getFieldValue('receivableAmount') ?? 0);
                                        const currentPaid = Number(createForm.getFieldValue('paidAmount') ?? 0);
                                        if (!currentReceivable) createForm.setFieldsValue({ receivableAmount: p });
                                        if (!currentPaid) createForm.setFieldsValue({ paidAmount: p });
                                    }
                                }}
                                style={{ width: '100%' }}
                                {...commonSelectProps}
                            />
                        </Form.Item>

                        <Row gutter={10}>
                            <Col span={12}>
                                <Form.Item
                                    name="receivableAmount"
                                    label="应收"
                                    rules={[{ required: true, message: '请填写应收金额' }]}
                                >
                                    <InputNumber
                                        min={0}
                                        precision={1}
                                        step={10}
                                        style={{ width: '100%', borderRadius: 12 }}
                                        placeholder="应收金额"
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="paidAmount" label="实付" rules={[{ required: true, message: '请填写实付金额' }]}>
                                    <InputNumber
                                        min={0}
                                        precision={1}
                                        step={10}
                                        style={{ width: '100%', borderRadius: 12 }}
                                        placeholder="实付金额"
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item name="settlementAmount" label="结算金额" rules={[{ required: true, message: '请填写结算金额' }]}>
                            <InputNumber
                                min={0}
                                precision={1}
                                step={10}
                                style={{ width: '100%', borderRadius: 12 }}
                                placeholder="默认与实付一致"
                            />
                        </Form.Item>

                        <Form.Item name="customerGameId" label="客户游戏ID">
                            <Input
                                allowClear
                                placeholder="游戏内ID或昵称"
                                style={{ borderRadius: 12 }}
                                onBlur={(e) => {
                                    const v = (e?.target?.value ?? '').trim();
                                    createForm.setFieldsValue({ customerGameId: v });
                                }}
                                addonAfter={
                                    <Button
                                        type="link"
                                        icon={<CopyOutlined />}
                                        onClick={pasteCustomerGameIdFromClipboard}
                                        style={{ padding: 0, height: 22 }}
                                    >
                                        粘贴
                                    </Button>
                                }
                            />
                        </Form.Item>

                        <Form.Item name="userCouponId" label="优惠券（可选）">
                            <Select
                                allowClear
                                showSearch
                                optionFilterProp="label"
                                placeholder="选择用户券后按券规则计算"
                                options={couponOptions}
                                loading={couponLoading}
                                style={{ width: '100%' }}
                                {...commonSelectProps}
                            />
                        </Form.Item>

                        <Form.Item name="playerIds" label={`立即派单（可选，最多 ${MAX_PLAYERS} 名）`}>
                            {isMobile ? (
                                <div>
                                    <Button
                                        block
                                        loading={playerLoading}
                                        onClick={() => setPlayerPickerOpenCreate(true)}
                                    >
                                        {Array.isArray(watchedCreatePlayerIds) && watchedCreatePlayerIds.length
                                            ? `已选 ${watchedCreatePlayerIds.length} 人，点击修改`
                                            : '选择陪玩'}
                                    </Button>

                                    <div style={{ marginTop: 8, minHeight: 20 }}>
                                        {Array.isArray(watchedCreatePlayerIds) && watchedCreatePlayerIds.length ? (
                                            <Space size={6} wrap>
                                                {watchedCreatePlayerIds.map((id: any) => (
                                                    <Tag
                                                        key={Number(id)}
                                                        closable
                                                        onClose={(e) => {
                                                            e.preventDefault();
                                                            updatePlayerSelection(
                                                                createForm,
                                                                watchedCreatePlayerIds
                                                                    .map((x: any) => Number(x))
                                                                    .filter((n: number) => !Number.isNaN(n) && n !== Number(id))
                                                            );
                                                        }}
                                                    >
                                                        {playerMap?.[Number(id)] || `#${id}`}
                                                    </Tag>
                                                ))}
                                            </Space>
                                        ) : (
                                            <div style={{ color: 'rgba(0,0,0,.45)', fontSize: 12 }}>
                                                未选择陪玩
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <Select
                                    mode="multiple"
                                    allowClear
                                    placeholder="选择空闲打手（下拉内搜索，不弹键盘遮挡）"
                                    options={playerOptions}
                                    loading={playerLoading}
                                    maxTagCount={2}
                                    // ✅ 移动端同理：禁用 showSearch，改用 dropdownRender
                                    showSearch={false}
                                    dropdownRender={playerDropdownCreate}
                                    onDropdownVisibleChange={(open) => {
                                        if (open) (document.activeElement as any)?.blur?.();
                                    }}
                                    onChange={(vals) => {
                                        const arr = safeArray<any>(vals);
                                        if (arr.length > MAX_PLAYERS) {
                                            message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
                                            createForm.setFieldValue('playerIds', arr.slice(0, MAX_PLAYERS));
                                        }
                                    }}
                                    style={{ width: '100%' }}
                                    {...commonSelectProps}
                                />
                            )}
                        </Form.Item>

                        <details style={{ marginTop: 2 }}>
                            <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <Text type="secondary">展开高级项（比例/邀请人/自定义保底/备注/时间）</Text>
                            </summary>

                            <div style={{ height: 10 }} />

                            <Row gutter={10}>
                                <Col span={12}>
                                    <Form.Item name="baseAmountWan" label="订单保底（万）">
                                        <InputNumber min={0} precision={2} style={{ width: '100%', borderRadius: 12 }} placeholder="可不填" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="inviter" label="邀请人（可选）">
                                        <Input allowClear placeholder="邀请人" style={{ borderRadius: 12 }} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={10}>
                                <Col span={8}>
                                    <Form.Item name="csRate" label="客服比例">
                                        <InputNumber min={0} max={1} step={0.01} precision={2} style={{ width: '100%', borderRadius: 12 }} />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item name="inviteRate" label="邀请比例">
                                        <InputNumber min={0} max={1} step={0.01} precision={2} style={{ width: '100%', borderRadius: 12 }} />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item name="customClubRate" label="俱乐部分成">
                                        <InputNumber min={0} max={1} step={0.01} precision={2} style={{ width: '100%', borderRadius: 12 }} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item name="remark" label="备注（可选）">
                                <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="例如：客户要求/注意事项..." />
                            </Form.Item>
                        </details>

                        <Space style={{ width: '100%', justifyContent: 'space-between', marginTop: 6 }}>
                            <Button
                                onClick={() => {
                                    createForm.resetFields();
                                    createForm.setFieldsValue({
                                        orderTime: now,
                                        paymentTime: now,
                                        receivableAmount: 0,
                                        paidAmount: 0,
                                        settlementAmount: 0,
                                        playerIds: [],
                                        remark: '客服工作台创建',
                                    });
                                    setProjectKeyword('');
                                    setPlayerKeywordCreate('');
                                }}
                                style={{ borderRadius: 12 }}
                            >
                                重置
                            </Button>

                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                onClick={submitCreateOrder}
                                loading={creating}
                                style={{ borderRadius: 12, minWidth: 150 }}
                            >
                                创建订单
                            </Button>
                        </Space>
                    </Form>
                </Space>
            </Card>
        </div>
    );

    const ListPanel = (
        <>
            {ListHeader}

            <div style={{ maxWidth: 920, margin: '12px auto 0' }}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {list.map((row) => {
                        const sMeta = statusText[row.status] || { text: row.status, color: 'default' };
                        const createdAt = row.createdAt ? dayjs(row.createdAt).format('MM-DD HH:mm') : '-';

                        return (
                            <Card
                                key={row.id}
                                hoverable
                                style={{ borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)' }}
                                bodyStyle={{ padding: 14 }}
                                onClick={() => history.push(`/orders/${row.id}`)}
                            >
                                <Row gutter={[10, 10]} align="middle">
                                    <Col flex="auto">
                                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                            <Space size={8} wrap>
                                                <Badge color={sMeta.color || 'default'} />
                                                <Text strong style={{ fontSize: 15 }}>
                                                    {row.autoSerial || `订单#${row.id}`}
                                                </Text>
                                                {renderStatus(row.status)}
                                                {row.paidAmount != null ? <Tag color="geekblue">实付 ¥{row.paidAmount}</Tag> : null}
                                            </Space>

                                            <Space size={10} wrap>
                                                <Text type="secondary">项目：{row.project?.name || '-'}</Text>
                                                <Text type="secondary">创建：{createdAt}</Text>
                                                {row.dispatcher?.name ? <Text type="secondary">派单客服：{row.dispatcher?.name}</Text> : null}
                                            </Space>

                                            <div>
                                                <Text type="secondary">当前陪玩：</Text> {renderPlayers(row)}
                                            </div>

                                            {row.customerGameId ? (
                                                <div>
                                                    <Text type="secondary">客户游戏ID：</Text>
                                                    <Text>{row.customerGameId}</Text>
                                                </div>
                                            ) : null}
                                        </Space>
                                    </Col>

                                    <Col>
                                        <Space direction="vertical" size={8}>
                                            <Button
                                                type="primary"
                                                icon={<ThunderboltOutlined />}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openDispatch(row);
                                                }}
                                                style={{ borderRadius: 12 }}
                                            >
                                                立即派单
                                            </Button>

                                            <Button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    history.push(`/orders/${row.id}`);
                                                }}
                                                style={{ borderRadius: 12 }}
                                            >
                                                详情
                                            </Button>
                                        </Space>
                                    </Col>
                                </Row>
                            </Card>
                        );
                    })}

                    {!loading && list.length === 0 ? (
                        <Card style={{ borderRadius: 16, border: '1px dashed rgba(0,0,0,0.15)' }}>
                            <Text type="secondary">暂无数据。可用订单编号搜索，或刷新列表。</Text>
                        </Card>
                    ) : null}
                </Space>
            </div>

            <Drawer
                title="派单"
                placement="bottom"
                height="70vh"
                open={dispatchOpen}
                onClose={() => {
                    setDispatchOpen(false);
                    setActiveOrder(null);
                }}
                styles={{
                    header: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
                    body: { paddingBottom: 24 },
                }}
            >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Card
                        bodyStyle={{ padding: 12 }}
                        style={{
                            borderRadius: 16,
                            background: 'rgba(22,119,255,0.04)',
                            border: '1px solid rgba(22,119,255,0.12)',
                        }}
                    >
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            <Text type="secondary">订单</Text>
                            <Text strong style={{ fontSize: 16 }}>
                                {activeOrder?.autoSerial || (activeOrder?.id ? `订单#${activeOrder.id}` : '-')}
                            </Text>
                            <Space size={8} wrap>
                                {activeOrder?.status ? renderStatus(activeOrder.status) : null}
                                {activeOrder?.project?.name ? <Tag>{activeOrder.project.name}</Tag> : null}
                            </Space>
                        </Space>
                    </Card>

                    <Form form={dispatchForm} layout="vertical" requiredMark={false}>
                        <Form.Item
                            name="playerIds"
                            label={`选择打手（最多 ${MAX_PLAYERS} 名）`}
                            rules={[{ required: true, message: '请选择打手' }]}
                        >
                            {isMobile ? (
                                <div>
                                    <Button
                                        block
                                        loading={playerLoading}
                                        onClick={() => setPlayerPickerOpenDispatch(true)}
                                    >
                                        {Array.isArray(watchedDispatchPlayerIds) && watchedDispatchPlayerIds.length
                                            ? `已选 ${watchedDispatchPlayerIds.length} 人，点击修改`
                                            : '选择陪玩'}
                                    </Button>

                                    <div style={{ marginTop: 8, minHeight: 20 }}>
                                        {Array.isArray(watchedDispatchPlayerIds) && watchedDispatchPlayerIds.length ? (
                                            <Space size={6} wrap>
                                                {watchedDispatchPlayerIds.map((id: any) => (
                                                    <Tag
                                                        key={Number(id)}
                                                        closable
                                                        onClose={(e) => {
                                                            e.preventDefault();
                                                            updatePlayerSelection(
                                                                dispatchForm,
                                                                watchedDispatchPlayerIds
                                                                    .map((x: any) => Number(x))
                                                                    .filter((n: number) => !Number.isNaN(n) && n !== Number(id))
                                                            );
                                                        }}
                                                    >
                                                        {playerMap?.[Number(id)] || `#${id}`}
                                                    </Tag>
                                                ))}
                                            </Space>
                                        ) : (
                                            <div style={{ color: 'rgba(0,0,0,.45)', fontSize: 12 }}>
                                                未选择陪玩
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <Select
                                    mode="multiple"
                                    allowClear
                                    placeholder="选择空闲打手（下拉内搜索，不弹键盘遮挡）"
                                    options={playerOptions}
                                    loading={playerLoading}
                                    maxTagCount={2}
                                    showSearch={false}
                                    dropdownRender={playerDropdownDispatch}
                                    onDropdownVisibleChange={(open) => {
                                        if (open) (document.activeElement as any)?.blur?.();
                                    }}
                                    onChange={(vals) => {
                                        const arr = safeArray<any>(vals);
                                        if (arr.length > MAX_PLAYERS) {
                                            message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
                                            dispatchForm.setFieldValue('playerIds', arr.slice(0, MAX_PLAYERS));
                                        }
                                    }}
                                    style={{ width: '100%' }}
                                    {...commonSelectProps}
                                />
                            )}
                        </Form.Item>

                        <Form.Item name="remark" label="派单备注（可选）">
                            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="例如：优先接单 / 注意事项..." />
                        </Form.Item>

                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Button
                                onClick={() => {
                                    setDispatchOpen(false);
                                    setActiveOrder(null);
                                }}
                                style={{ borderRadius: 12 }}
                            >
                                取消
                            </Button>

                            <Button
                                type="primary"
                                onClick={submitDispatch}
                                loading={dispatching}
                                style={{ borderRadius: 12, minWidth: 120 }}
                            >
                                确认派单
                            </Button>
                        </Space>
                    </Form>
                </Space>
            </Drawer>

            <Drawer
                title="选择陪玩"
                placement="bottom"
                height="86vh"
                open={playerPickerOpenCreate}
                destroyOnClose
                onClose={() => setPlayerPickerOpenCreate(false)}
                styles={{
                    header: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
                    body: { paddingBottom: 24 },
                }}
            >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center">
                        <div style={{ fontWeight: 600 }}>创建订单选陪玩</div>
                        <Button type="primary" onClick={() => setPlayerPickerOpenCreate(false)}>
                            完成
                        </Button>
                    </Space>

                    <Input.Search
                        allowClear
                        value={playerKeywordCreate}
                        placeholder="搜索昵称或手机号"
                        onChange={(e) => {
                            const kw = e.target.value;
                            setPlayerKeywordCreate(kw);
                            void fetchPlayers(kw);
                        }}
                    />

                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
                        已选 {Array.isArray(watchedCreatePlayerIds) ? watchedCreatePlayerIds.length : 0}/{MAX_PLAYERS} 人，点击列表项即可切换。
                    </div>

                    <List
                        loading={playerLoading}
                        dataSource={playerOptions}
                        locale={{ emptyText: '暂无可选陪玩' }}
                        renderItem={(item) => {
                            const selected = Array.isArray(watchedCreatePlayerIds)
                                ? watchedCreatePlayerIds.map((x: any) => Number(x)).includes(item.value)
                                : false;
                            const selectedCount = Array.isArray(watchedCreatePlayerIds) ? watchedCreatePlayerIds.length : 0;
                            const canAddMore = selected || selectedCount < MAX_PLAYERS;
                            return (
                                <List.Item
                                    onClick={() => {
                                        if (!selected && !canAddMore) {
                                            message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
                                            return;
                                        }
                                        toggleCreatePlayer(item.value);
                                    }}
                                    style={{ cursor: 'pointer', paddingLeft: 0, paddingRight: 0 }}
                                >
                                    <Space align="start" size={12} style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 500 }}>{playerMap?.[item.value] || item.label}</div>
                                            <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>{item.label}</div>
                                        </div>
                                        <Checkbox checked={selected} />
                                    </Space>
                                </List.Item>
                            );
                        }}
                    />
                </Space>
            </Drawer>

            <Drawer
                title="选择陪玩"
                placement="bottom"
                height="86vh"
                open={playerPickerOpenDispatch}
                destroyOnClose
                onClose={() => setPlayerPickerOpenDispatch(false)}
                styles={{
                    header: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
                    body: { paddingBottom: 24 },
                }}
            >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center">
                        <div style={{ fontWeight: 600 }}>派单选陪玩</div>
                        <Button type="primary" onClick={() => setPlayerPickerOpenDispatch(false)}>
                            完成
                        </Button>
                    </Space>

                    <Input.Search
                        allowClear
                        value={playerKeywordDispatch}
                        placeholder="搜索昵称或手机号"
                        onChange={(e) => {
                            const kw = e.target.value;
                            setPlayerKeywordDispatch(kw);
                            void fetchPlayers(kw);
                        }}
                    />

                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
                        已选 {Array.isArray(watchedDispatchPlayerIds) ? watchedDispatchPlayerIds.length : 0}/{MAX_PLAYERS} 人，点击列表项即可切换。
                    </div>

                    <List
                        loading={playerLoading}
                        dataSource={playerOptions}
                        locale={{ emptyText: '暂无可选陪玩' }}
                        renderItem={(item) => {
                            const selected = Array.isArray(watchedDispatchPlayerIds)
                                ? watchedDispatchPlayerIds.map((x: any) => Number(x)).includes(item.value)
                                : false;
                            const selectedCount = Array.isArray(watchedDispatchPlayerIds) ? watchedDispatchPlayerIds.length : 0;
                            const canAddMore = selected || selectedCount < MAX_PLAYERS;
                            return (
                                <List.Item
                                    onClick={() => {
                                        if (!selected && !canAddMore) {
                                            message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
                                            return;
                                        }
                                        toggleDispatchPlayer(item.value);
                                    }}
                                    style={{ cursor: 'pointer', paddingLeft: 0, paddingRight: 0 }}
                                >
                                    <Space align="start" size={12} style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 500 }}>{playerMap?.[item.value] || item.label}</div>
                                            <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>{item.label}</div>
                                        </div>
                                        <Checkbox checked={selected} />
                                    </Space>
                                </List.Item>
                            );
                        }}
                    />
                </Space>
            </Drawer>
        </>
    );

    const DesktopPanel = (
        <PageContainer title="客服工作台">
            <Space direction="vertical" size={12} style={{ width: '100%', maxWidth: 960, margin: '0 auto' }}>
                <Card
                    title="打手在线管理"
                    extra={
                        <Space>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => void fetchOnlinePlayers(onlinePlayerKeyword, onlinePlayerPage)}
                                loading={onlinePlayerLoading}
                            >
                                刷新状态
                            </Button>
                        </Space>
                    }
                    style={{ borderRadius: 16 }}
                >
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Row gutter={[12, 12]} align="middle">
                            <Col xs={24} md={12}>
                                <Input.Search
                                    allowClear
                                    placeholder="搜索打手姓名 / 手机号"
                                    value={onlinePlayerKeyword}
                                    onChange={(e) => {
                                        const kw = e.target.value;
                                        setOnlinePlayerKeyword(kw);
                                        setOnlinePlayerPage(1);
                                        debouncedFetchOnlinePlayers(kw, 1);
                                    }}
                                />
                            </Col>
                            <Col xs={24} md={12}>
                                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                    <Text type="secondary">
                                        在线 {Array.isArray(onlinePlayers) ? onlinePlayers.filter((p) => p.workMode === 'ONLINE').length : 0} / 接单中{' '}
                                        {Array.isArray(onlinePlayers) ? onlinePlayers.filter((p) => String(p.workStatus || '').toUpperCase() === 'WORKING').length : 0} / 总数{' '}
                                        {Array.isArray(onlinePlayers) ? onlinePlayers.length : 0}
                                    </Text>
                                    <Text type="secondary">可上下线、可刷新状态</Text>
                                </Space>
                            </Col>
                        </Row>

                        <Row gutter={[12, 12]}>
                            {visibleOnlinePlayers.map((player) => {
                                const isOnline = player.workMode !== 'OFFLINE';
                                const workStateMeta = getPlayerWorkStateMeta(player);
                                return (
                                    <Col key={player.id} xs={24} md={12} lg={8}>
                                        <Card
                                            size="small"
                                            style={{
                                                borderRadius: 14,
                                                border: isOnline ? '1px solid rgba(82,196,26,0.25)' : '1px solid rgba(0,0,0,0.06)',
                                                background: isOnline ? 'rgba(82,196,26,0.04)' : '#fff',
                                            }}
                                            bodyStyle={{ padding: 12 }}
                                        >
                                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                                <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>{player.name || '未命名'}</div>
                                                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
                                                            {player.phone || '-'} · {player.ratingName || '-'}
                                                        </div>
                                                    </div>
                                                    <Tag color={workStateMeta.color}>{workStateMeta.text}</Tag>
                                                </Space>

                                                <Space size={8} wrap>
                                                    <Tag>今日接单 {player.todayHandledCount ?? 0}</Tag>
                                                    {player.workMode === 'OFFLINE' && player.offlineJoinedAt ? (
                                                        <Tag color="default">
                                                            离线 {dayjs(player.offlineJoinedAt).format('MM-DD HH:mm')}
                                                        </Tag>
                                                    ) : null}
                                                </Space>

                                                <Space wrap>
                                                    <Button
                                                        size="small"
                                                        type={isOnline ? 'default' : 'primary'}
                                                        onClick={() => void handleTogglePlayerWorkMode(player.id, 'ONLINE')}
                                                        loading={onlinePlayerLoading}
                                                    >
                                                        设为在线
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        danger={isOnline}
                                                        onClick={() => void handleTogglePlayerWorkMode(player.id, 'OFFLINE')}
                                                        loading={onlinePlayerLoading}
                                                    >
                                                        设为离线
                                                    </Button>
                                                </Space>
                                            </Space>
                                        </Card>
                                    </Col>
                                );
                            })}
                        </Row>

                        {!visibleOnlinePlayers.length ? (
                            <Card size="small" style={{ borderRadius: 14, border: '1px dashed rgba(0,0,0,0.12)' }}>
                                <Text type="secondary">暂无打手在线数据。</Text>
                            </Card>
                        ) : null}

                        {onlinePlayerTotal > 0 ? (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                                <Pagination
                                    size="small"
                                    current={onlinePlayerPage}
                                    pageSize={onlinePlayerPageSize}
                                    total={onlinePlayerTotal}
                                    showSizeChanger={false}
                                    showLessItems
                                    onChange={(pageNo) => {
                                        setOnlinePlayerPage(pageNo);
                                        void fetchOnlinePlayers(onlinePlayerKeyword, pageNo);
                                    }}
                                />
                            </div>
                        ) : null}
                    </Space>
                </Card>

                <Card style={{ borderRadius: 16, maxWidth: 720, margin: '0 auto' }}>
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 12 }} onClick={() => setCreateOpen(true)}>
                            快捷发单
                        </Button>
                    </Space>
                </Card>
            </Space>

            <OrderUpsertModal
                open={createOpen}
                title="创建订单"
                showPlayers
                onCancel={() => setCreateOpen(false)}
                onSubmit={async (payload) => {
                    const created = await createOrder({
                        projectId: payload?.projectId,
                        receivableAmount: payload?.receivableAmount,
                        paidAmount: payload?.paidAmount,
                        baseAmountWan: payload?.baseAmountWan ?? undefined,
                        customerGameId: payload?.customerGameId,
                        orderTime: payload?.orderTime,
                        paymentTime: payload?.paymentTime,
                        csRate: payload?.csRate,
                        inviteRate: payload?.inviteRate,
                        inviter: payload?.inviter,
                        customClubRate: payload?.customClubRate,
                        remark: payload?.remark,
                        // ✅ 新增：赠送单标识
                        isGifted: Boolean(payload?.isGifted),
                        userCouponId: payload?.userCouponId != null ? Number(payload.userCouponId) : undefined,
                    });

                    const orderId = Number((created as any)?.id ?? (created as any)?.data?.id);
                    if (!orderId) throw new Error('创建订单失败：未返回订单ID');

                    if (payload?.playerIds?.length) {
                        await assignDispatch(orderId, { playerIds: payload?.playerIds, remark: '新建订单时派单' });
                    }

                    message.success('创建成功');
                    setCreateOpen(false);
                    actionRef.current?.reload?.();
                    navigate(`/orders/${orderId}`);
                }}
            />
        </PageContainer>
    );

    return (
        isMobile ? (
            <PageContainer title="客服工作台" subTitle="手机端创建订单 / 快速派单">
                <div style={{ maxWidth: 980, margin: '0 auto' }}>
                    <Tabs
                        activeKey={tab}
                        onChange={(k) => setTab(k as any)}
                        items={[
                            { key: 'create', label: '创建订单', children: CreatePanel },
                            { key: 'ARCHIVED', label: '存单', children: ListPanel },
                            { key: 'WAIT_ASSIGN', label: '待派单', children: ListPanel },
                            { key: 'WAIT_ACCEPT', label: '待接单', children: ListPanel },
                        ]}
                    />
                </div>

                <FloatButton.Group
                    trigger="click"
                    type="primary"
                    style={{ right: 16, bottom: 16 }}
                    icon={<AppstoreOutlined />}
                >
                    <FloatButton
                        icon={<ReloadOutlined />}
                        tooltip="刷新"
                        onClick={() => {
                            if (tab === 'create') {
                                void fetchProjects(projectKeyword || '');
                                void fetchPlayers(playerKeywordCreate || '');
                                message.success('已刷新选项');
                                return;
                            }
                            void fetchOrders(1);
                        }}
                    />
                    <FloatButton icon={<ProfileOutlined />} tooltip="订单" onClick={() => history.push('/orders')} />
                    <FloatButton icon={<WalletOutlined />} tooltip="钱包" onClick={() => history.push('/wallet/overview')} />
                    <FloatButton icon={<ThunderboltOutlined />} tooltip="工作台" onClick={() => history.push('/workbench')} />
                </FloatButton.Group>
            </PageContainer>
        ) : (
            DesktopPanel
        )
    );
}
