import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import {
    Badge,
    Button,
    Card,
    Col,
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
import { history } from '@umijs/max';
import {
    assignDispatch,
    createOrder,
    getGameProjectOptions,
    getOrders,
    getPlayerOptions,
} from '@/services/api';
import { useIsMobile } from '@/utils/useIsMobile';

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

// 简易防抖：减少移动端搜索抖动请求
const useDebouncedFn = (fn: (kw?: string) => void, delay = 250) => {
    const timer = useRef<number | null>(null);
    return (kw?: string) => {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => fn(kw), delay);
    };
};

export default function CSWorkbenchPage() {
    const isMobile = useIsMobile(768);

    // ======================
    // ✅ PC 端：只显示“发单按钮”
    // ======================
    if (!isMobile) {
        return (
            <PageContainer title="客服工作台">
                <Card style={{ borderRadius: 16, maxWidth: 720, margin: '0 auto' }}>
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Text type="secondary">
                            PC 端客服派单建议仍在订单列表完成，这里仅保留“发单入口”以减少维护成本。
                        </Text>

                        {/* TODO(PC_WORKBENCH_UPSERT):
                这里仅展示一个“发单”按钮，点击后弹出你现成的“创建订单/派单组件”（你说已有现成代码）
                你将订单列表页的弹窗组件搬过来即可。
            */}
                        <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 12 }}>
                            发单（TODO：弹出创建订单组件）
                        </Button>
                    </Space>
                </Card>
            </PageContainer>
        );
    }

    // TAB：create / archived / wait_assign / wait_accept
    const [tab, setTab] = useState<'create' | 'ARCHIVED' | 'WAIT_ASSIGN' | 'WAIT_ACCEPT'>('create');

    // 列表筛选
    const [loading, setLoading] = useState(false);
    const [keyword, setKeyword] = useState<string>(''); // 订单编号 autoSerial
    const [customerGameId, setCustomerGameId] = useState<string>('');

    // 列表数据
    const [list, setList] = useState<OrderRow[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [page, setPage] = useState<number>(1);

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
    const [playerKeywordCreate, setPlayerKeywordCreate] = useState('');
    const [playerKeywordDispatch, setPlayerKeywordDispatch] = useState('');

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
            const res = await getPlayerOptions({ keyword: kw || '', onlyIdle: true });
            const arr = normalizeList(res);
            const options: OptionItem[] = safeArray(arr).map((u: any) => ({
                value: Number(u.id),
                label: `${u.name || '未命名'}（${u.phone || '-'}）`,
            }));
            setPlayerOptions(options);
        } catch (e) {
            console.error(e);
            setPlayerOptions([]);
        } finally {
            setPlayerLoading(false);
        }
    };

    const debouncedFetchProjects = useDebouncedFn(fetchProjects, 250);
    const debouncedFetchPlayers = useDebouncedFn(fetchPlayers, 250);

    const fetchOrders = async (nextPage?: number) => {
        if (tab === 'create') return;
        const p = Math.max(1, Number(nextPage ?? page ?? 1));

        const signature = JSON.stringify({
            tab,
            statusFilter,
            keyword,
            customerGameId,
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
            });

            if (lastFetchRef.current !== signature) return;

            setList(safeArray<OrderRow>((res as any)?.data));
            setTotal(Number((res as any)?.total ?? 0));
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

        // 创建表单默认值（减少手机端输入）
        createForm.setFieldsValue({
            orderTime: now,
            paymentTime: now,
            receivableAmount: 0,
            paidAmount: 0,
            playerIds: [],
            remark: '客服工作台创建',
            isGifted: false, // ✅ 赠送单：补上字段（移动端之前“丢了”）
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (tab !== 'create') void fetchOrders(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

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
                baseAmountWan:
                    values.baseAmountWan != null && values.baseAmountWan !== '' ? Number(values.baseAmountWan) : undefined,
                customerGameId: customerId || undefined,

                // ✅ 赠送单：补上（不改业务逻辑，只是让后端字段能接到）
                isGifted: Boolean(values.isGifted),

                orderTime: values.orderTime ? dayjs(values.orderTime).toISOString() : now.toISOString(),
                paymentTime: values.paymentTime ? dayjs(values.paymentTime).toISOString() : now.toISOString(),
                inviter: values.inviter?.trim() || undefined,
                csRate: values.csRate != null && values.csRate !== '' ? Number(values.csRate) : undefined,
                inviteRate: values.inviteRate != null && values.inviteRate !== '' ? Number(values.inviteRate) : undefined,
                customClubRate: values.customClubRate != null && values.customClubRate !== '' ? Number(values.customClubRate) : undefined,
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

                    <Form form={createForm} layout="vertical" requiredMark={false} style={{ marginTop: 6 }}>
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

                        {/* ✅ 赠送单选项：补回 */}
                        <Form.Item name="isGifted" valuePropName="checked" label="赠送单">
                            <Checkbox>勾选后不计入营业额统计，但仍正常结算</Checkbox>
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

                        <Form.Item name="playerIds" label={`立即派单（可选，最多 ${MAX_PLAYERS} 名）`}>
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
                                        playerIds: [],
                                        remark: '客服工作台创建',
                                        isGifted: false,
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
        </>
    );

    return (
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
    );
}
