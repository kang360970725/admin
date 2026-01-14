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
} from 'antd';
import {
    ReloadOutlined,
    SearchOutlined,
    ThunderboltOutlined,
    PlusOutlined,
    CheckCircleOutlined,
    CopyOutlined
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

/** 截断 1 位小数（不四舍五入）- 你之前的口径，这里用于金额输入展示/入参兜底 */
const trunc1 = (x: any) => {
    const n = Number(x);
    if (!Number.isFinite(n)) return 0;
    return Math.trunc(n * 10) / 10;
};

export default function CSWorkbenchPage() {
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

    // 打手 options（复用：创建订单立即派单 + 列表派单）
    const [playerLoading, setPlayerLoading] = useState(false);
    const [playerOptions, setPlayerOptions] = useState<OptionItem[]>([]);

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
            const arr = Array.isArray(res) ? res : (res as any)?.data ?? [];
            const options: ProjectOptionItem[] = safeArray(arr).map((p: any) => ({
                value: Number(p.id),
                label: `${p.name}${p.price != null ? `（¥${p.price}）` : ''}`,
                baseAmount: p.baseAmount ?? null,
                price: p.price ?? null,
            }));
            setProjectOptions(options);
        } catch (e) {
            console.error(e);
        } finally {
            setProjectLoading(false);
        }
    };

    const fetchPlayers = async (kw?: string) => {
        setPlayerLoading(true);
        try {
            const res = await getPlayerOptions({ keyword: kw || '', onlyIdle: true });
            const arr = Array.isArray(res) ? res : (res as any)?.data ?? [];
            const options: OptionItem[] = safeArray(arr).map((u: any) => ({
                value: Number(u.id),
                label: `${u.name || '未命名'}（${u.phone || '-'}）`,
            }));
            setPlayerOptions(options);
        } catch (e) {
            console.error(e);
        } finally {
            setPlayerLoading(false);
        }
    };

    const fetchOrders = async (nextPage?: number) => {
        if (tab === 'create') return; // 创建 TAB 不拉列表
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
        // 初始加载 options（创建/派单都要用）
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
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // 切换到列表 TAB 自动拉取
        if (tab !== 'create') void fetchOrders(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    // ============ 列表派单 ============
    const openDispatch = (order: OrderRow) => {
        setActiveOrder(order);
        setDispatchOpen(true);
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
            // 只有 https / localhost 才能稳定用 Clipboard API（微信内 H5 也通常 ok）
            const text = await navigator.clipboard.readText();
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

            // ✅ 手机端最易错点：金额/空值
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
                baseAmountWan: values.baseAmountWan != null && values.baseAmountWan !== '' ? Number(values.baseAmountWan) : undefined,
                customerGameId: customerId || undefined,
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
                            手机端快捷创建
                        </Tag>
                        <Text type="secondary">必填项尽量少，减少误填；高级项可展开。</Text>
                    </Space>

                    <Form
                        form={createForm}
                        layout="vertical"
                        requiredMark={false}
                        style={{ marginTop: 6 }}
                    >
                        {/* 1) 项目（必选） */}
                        <Form.Item
                            name="projectId"
                            label="项目"
                            rules={[{ required: true, message: '请选择项目' }]}
                        >
                            <Select
                                showSearch
                                allowClear
                                placeholder="搜索/选择项目"
                                options={projectOptions as any}
                                loading={projectLoading}
                                onSearch={(v) => fetchProjects(v)}
                                onChange={(_, option: any) => {
                                    // ✅ 选择项目后：同步保底（万）+ 默认应收/实付（如果有 price）
                                    const base = option?.baseAmount;
                                    const price = option?.price;

                                    // 保底（万）
                                    if (base !== undefined) {
                                        createForm.setFieldsValue({ baseAmountWan: base != null ? Number(base) : null });
                                    }

                                    // 金额：如果你希望默认应收=项目价格，可打开下面两行
                                    if (price != null && Number.isFinite(Number(price))) {
                                        const p = trunc1(price);
                                        // 如果用户还没填过金额（或金额=0），才自动填，避免“覆盖用户手输”
                                        const currentReceivable = Number(createForm.getFieldValue('receivableAmount') ?? 0);
                                        const currentPaid = Number(createForm.getFieldValue('paidAmount') ?? 0);
                                        if (!currentReceivable) createForm.setFieldsValue({ receivableAmount: p });
                                        if (!currentPaid) createForm.setFieldsValue({ paidAmount: p });
                                    }
                                }}
                                style={{ width: '100%' }}
                            />
                        </Form.Item>

                        {/* 2) 金额（手机端最易错：强约束 + 轻提示） */}
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
                                <Form.Item
                                    name="paidAmount"
                                    label="实付"
                                    rules={[{ required: true, message: '请填写实付金额' }]}
                                >
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

                        {/* 3) 客户游戏ID（可选，但经常要填） */}
                        <Form.Item name="customerGameId" label="客户游戏ID">
                            <Input
                                allowClear
                                placeholder="游戏内ID或昵称"
                                style={{ borderRadius: 12 }}
                                // ✅ 失焦自动 trim（首尾去空格）
                                onBlur={(e) => {
                                    const v = (e?.target?.value ?? '').trim();
                                    createForm.setFieldsValue({ customerGameId: v });
                                }}
                                // ✅ 一键读取剪切板（右侧按钮）
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

                        {/* 4) 立即派单（可选） */}
                        <Form.Item name="playerIds" label={`立即派单（可选，最多 ${MAX_PLAYERS} 名）`}>
                            <Select
                                mode="multiple"
                                allowClear
                                showSearch
                                placeholder="搜索/选择空闲打手（可不选，先创建订单）"
                                options={playerOptions}
                                loading={playerLoading}
                                maxTagCount={2}
                                onSearch={(v) => fetchPlayers(v)}
                                onChange={(vals) => {
                                    const arr = safeArray<any>(vals);
                                    if (arr.length > MAX_PLAYERS) {
                                        message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
                                        createForm.setFieldValue('playerIds', arr.slice(0, MAX_PLAYERS));
                                    }
                                }}
                                style={{ width: '100%' }}
                            />
                        </Form.Item>

                        {/* 5) 高级项：收起（手机端减少误填） */}
                        <details style={{ marginTop: 2 }}>
                            <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <Text type="secondary">展开高级项（比例/邀请人/自定义保底/备注/时间）</Text>
                            </summary>

                            <div style={{ height: 10 }} />

                            <Row gutter={10}>
                                <Col span={12}>
                                    <Form.Item name="baseAmountWan" label="订单保底（万）">
                                        <InputNumber
                                            min={0}
                                            precision={2}
                                            style={{ width: '100%', borderRadius: 12 }}
                                            placeholder="可不填"
                                        />
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

                            <Row gutter={10}>
                                <Col span={12}>
                                    <Form.Item name="orderTime" label="下单时间">
                                        {/* 你现有 New.tsx 用了 DatePicker，这里用 DatePicker 也可以；
                        为了兼容你项目里是否已全局引入 DatePicker 依赖，这里不强塞组件，
                        仍用字符串输入也能跑；但你 New.tsx 已使用 DatePicker，说明可用。
                        如果你想我也换成 DatePicker，我下一步给你微调。 */}
                                        <Input
                                            placeholder="默认当前时间（可不填）"
                                            style={{ borderRadius: 12 }}
                                            disabled
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="paymentTime" label="支付时间">
                                        <Input placeholder="默认当前时间（可不填）" style={{ borderRadius: 12 }} disabled />
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
                                    });
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

                        <div style={{ height: 10 }} />
                        <Card
                            style={{ borderRadius: 16, border: '1px dashed rgba(0,0,0,0.12)' }}
                            bodyStyle={{ padding: 12 }}
                        >
                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                <Text type="secondary">操作建议（防出错）</Text>
                                <Text type="secondary">1）先选项目，再填金额（金额默认可跟随项目价）。</Text>
                                <Text type="secondary">2）“立即派单”可选：不选也能先创建，后续在列表里派单。</Text>
                                <Text type="secondary">3）高级项默认收起，避免手机端误触比例字段。</Text>
                            </Space>
                        </Card>
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
                                                {row.paidAmount != null ? (
                                                    <Tag color="geekblue">实付 ¥{row.paidAmount}</Tag>
                                                ) : null}
                                            </Space>

                                            <Space size={10} wrap>
                                                <Text type="secondary">项目：{row.project?.name || '-'}</Text>
                                                <Text type="secondary">创建：{createdAt}</Text>
                                                {row.dispatcher?.name ? (
                                                    <Text type="secondary">派单客服：{row.dispatcher?.name}</Text>
                                                ) : null}
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

            {/* 派单抽屉（移动端 bottom sheet 风格） */}
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
                                showSearch
                                placeholder="搜索/选择空闲打手"
                                options={playerOptions}
                                loading={playerLoading}
                                maxTagCount={2}
                                onSearch={(v) => fetchPlayers(v)}
                                onChange={(vals) => {
                                    const arr = safeArray<any>(vals);
                                    if (arr.length > MAX_PLAYERS) {
                                        message.warning(`最多选择 ${MAX_PLAYERS} 名打手`);
                                        dispatchForm.setFieldValue('playerIds', arr.slice(0, MAX_PLAYERS));
                                    }
                                }}
                                style={{ width: '100%' }}
                            />
                        </Form.Item>

                        <Form.Item name="remark" label="派单备注（可选）">
                            <Input.TextArea
                                autoSize={{ minRows: 2, maxRows: 4 }}
                                placeholder="例如：优先接单 / 注意事项..."
                            />
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
        <PageContainer
            title="客服工作台"
            subTitle="手机端创建订单 / 快速派单"
            extra={[
                tab !== 'create' ? (
                    <Button
                        key="toCreate"
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setTab('create')}
                        style={{ borderRadius: 12 }}
                    >
                        创建订单
                    </Button>
                ) : null,
            ]}
        >
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
        </PageContainer>
    );
}
