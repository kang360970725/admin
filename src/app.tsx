import type { RuntimeConfig } from '@umijs/max';
import React from 'react';
import {Avatar, Badge, Button, Dropdown, Input, List, message, Modal, Popover, Result, Space, Typography, notification} from 'antd';
import { BellOutlined, InfoCircleFilled, UserOutlined } from '@ant-design/icons';
import {
    appealMyPenaltyTicket,
    confirmMyPenaltyTicket,
    getMyPenaltyPendingStats,
    getMyPenaltyTickets,
    clearAllRealtimeNotifications,
    clearOneRealtimeNotification,
    getCurrentUser,
    getPublicLatestAppVersion,
    getRealtimeStreamUrl,
    myAnnouncements,
    myPendingForceAnnouncements,
    myRealtimeNotifications,
    readAnnouncement,
    RealtimeNotificationItem,
} from './services/api';
import { useIsMobile } from '@/utils/useIsMobile';
import './global.less';
import { history } from '@umijs/max';

const { Text } = Typography;

interface CurrentUser {
    id: number;
    phone: string;
    name: string;
    userType: string;
    level: number;
    balance: number;
    avatar?: string;
    permissions?: string[];
    needResetPwd?: boolean;
}

interface VersionManifest {
    version?: string;
    buildId?: string;
    releasedAt?: string;
    forceRefresh?: boolean;
    title?: string;
    notes?: string[];
}

const loginPath = '/login';
const LOCAL_APP_VERSION = String(process.env.APP_VERSION || '');
const LOCAL_APP_BUILD_ID = String(process.env.APP_BUILD_ID || '');
const DEV_VERSION_ACK_STORAGE_KEY = 'DEV_VERSION_REFRESH_ACK_KEY';

async function fetchVersionManifest(): Promise<VersionManifest | null> {
    try {
        const remote: any = await getPublicLatestAppVersion();
        const version = String(remote?.version || '').trim();
        const buildId = String(remote?.buildId || '').trim();
        if (!version || !buildId) {
            // 后台未初始化版本记录，或返回为空对象时，不触发强刷弹窗
            return null;
        }
        return {
            version,
            buildId,
            releasedAt: String(remote.releasedAt || '').trim(),
            forceRefresh: Boolean(remote.forceRefresh),
            title: String(remote.title || '').trim(),
            notes: Array.isArray(remote.notes) ? remote.notes : [],
        };
    } catch (e: any) {
        console.warn('[app-version] load failed, skip popup', e?.message || e);
        return null;
    }
}

function buildVersionKey(manifest?: VersionManifest | null) {
    const version = String(manifest?.version || 'unknown').trim();
    const buildId = String(manifest?.buildId || 'unknown').trim();
    return `${version}#${buildId}`;
}

function formatBeijingDateTime(input?: string) {
    const raw = String(input || '').trim();
    if (!raw) return '-';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

function stripNoteTrailingTime(input?: string) {
    return String(input || '')
        .replace(/\s*[（(]?\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日)?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?[)）]?\s*$/g, '')
        .trim();
}

function doLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.href = loginPath;
}

function getDisplayName(u?: Partial<CurrentUser>) {
    return u?.name || u?.phone || '当前陪玩';
}

function getLevelText(u?: Partial<CurrentUser>) {
    const lv = Number(u?.level || 0);
    if (!lv) return '未评级';
    return `Lv.${lv}`;
}

/**
 * 全局初始化数据配置
 */
export async function getInitialState(): Promise<{
    currentUser?: CurrentUser;
    loading?: boolean;
    fetchUserInfo?: () => Promise<CurrentUser | undefined>;
}> {
    const fetchUserInfo = async (): Promise<CurrentUser | undefined> => {
        const token = localStorage.getItem('token');
        // ✅ 未登录是正常状态：不要 throw，否则会进入 catch 并清存储
        if (!token) return undefined;

        try {
            const userInfo = await getCurrentUser();

            // （可选）缓存 currentUser
            if (userInfo) localStorage.setItem('currentUser', JSON.stringify(userInfo));

            if (userInfo?.needResetPwd && window.location.pathname !== '/reset-password') {
                window.location.href = '/reset-password';
            }

            return userInfo;
        } catch (error) {
            localStorage.removeItem('token');
            localStorage.removeItem('currentUser');
            console.error('获取用户信息失败:', error);
            return undefined;
        }
    };

    // 如果是登录页面，不执行
    if (window.location.pathname !== '/login') {
        const currentUser = await fetchUserInfo();
        return { fetchUserInfo, currentUser };
    }

    return { fetchUserInfo };
}

/**
 * ✅ Layout：PC 维持 ProLayout；/m/* 移动端走“纯内容页”
 */
export const layout: RuntimeConfig['layout'] = ({ location }) => {
    const pathname = location?.pathname || window.location.pathname;
    const isMobileShell = pathname.startsWith('/m');
    const isMobile = useIsMobile(768);
    const [announcementOpen, setAnnouncementOpen] = React.useState(false);
    const [announcementList, setAnnouncementList] = React.useState<any[]>([]);
    const [forceUnread, setForceUnread] = React.useState<any[]>([]);
    const [realtimeOpen, setRealtimeOpen] = React.useState(false);
    const [realtimeList, setRealtimeList] = React.useState<RealtimeNotificationItem[]>([]);
    const [realtimeUnreadCount, setRealtimeUnreadCount] = React.useState(0);
    const [penaltyPendingTickets, setPenaltyPendingTickets] = React.useState<any[]>([]);
    const [penaltyAppealContent, setPenaltyAppealContent] = React.useState('');
    const [penaltyActionLoading, setPenaltyActionLoading] = React.useState(false);
    const [api, contextHolder] = notification.useNotification();
    // 仅记录“本次进入已确认”的强制公告，刷新或重新登录后会再次弹出
    const [confirmedForceIds, setConfirmedForceIds] = React.useState<number[]>([]);
    const [loadingAnnouncements, setLoadingAnnouncements] = React.useState(false);
    const [versionManifest, setVersionManifest] = React.useState<VersionManifest | null>(null);
    const [versionModalOpen, setVersionModalOpen] = React.useState(false);
    const [forceReadReachedBottom, setForceReadReachedBottom] = React.useState(false);
    const realtimeEventSourceRef = React.useRef<EventSource | null>(null);
    const forceReadContentRef = React.useRef<HTMLDivElement | null>(null);
    const versionPromptedRef = React.useRef<string>('');
    const isDevEnv = String(process.env.UMI_ENV || '') === 'development';
    const forceQueue = React.useMemo(
        () => forceUnread.filter((item) => !confirmedForceIds.includes(Number(item?.id))),
        [forceUnread, confirmedForceIds],
    );
    const currentUser = React.useMemo(() => {
        try {
            const raw = localStorage.getItem('currentUser');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }, []);
    const isCustomerService = String(currentUser?.userType || '') === 'CUSTOMER_SERVICE';
    const isStaffUser = String(currentUser?.userType || '') === 'STAFF';
    const activePenaltyTicket = penaltyPendingTickets[0] || null;
    const penaltyForceOpen = isStaffUser && penaltyPendingTickets.length > 0;
    const currentForceAnnouncement = forceQueue[0] || null;

    const checkForceReadReachedBottom = React.useCallback(() => {
        const el = forceReadContentRef.current;
        if (!el) return;
        const reached = el.scrollHeight - el.scrollTop - el.clientHeight <= 8;
        setForceReadReachedBottom(reached);
    }, []);

    const isPenaltyForceItem = React.useCallback((item?: RealtimeNotificationItem | null) => {
        if (!item) return false;
        const force = Boolean((item as any)?.payload?.force);
        if (!force) return false;
        return ['PENALTY_TICKET', 'PENALTY_APPEAL_REVIEW'].includes(String(item.type || ''));
    }, []);

    const loadAnnouncements = React.useCallback(async () => {
        try {
            setLoadingAnnouncements(true);
            const [list, force] = await Promise.all([myAnnouncements(), myPendingForceAnnouncements()]);
            setAnnouncementList(Array.isArray(list) ? list : []);
            setForceUnread(Array.isArray(force?.list) ? force.list : []);
        } catch (e: any) {
            console.error('[announcement] load failed', e?.message || e);
        } finally {
            setLoadingAnnouncements(false);
        }
    }, []);

    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        setConfirmedForceIds([]);
        loadAnnouncements();
    }, [loadAnnouncements]);

    React.useEffect(() => {
        setForceReadReachedBottom(false);
        const timer = window.setTimeout(() => checkForceReadReachedBottom(), 0);
        return () => window.clearTimeout(timer);
    }, [currentForceAnnouncement?.id, checkForceReadReachedBottom]);

    const loadPenaltyPendingTickets = React.useCallback(async () => {
        const token = String(localStorage.getItem('token') || '').trim();
        if (!token || !isStaffUser) return;
        try {
            // 仅“待确认/待申诉”需要强制动作，不包含 APPEAL_PENDING
            const listRes: any = await getMyPenaltyTickets({
                page: 1,
                limit: 20,
                status: 'PENDING_CONFIRM',
            });
            const list = Array.isArray(listRes?.data) ? listRes.data : [];
            setPenaltyPendingTickets(list);
            if (!list.length) setPenaltyAppealContent('');
        } catch (e: any) {
            console.error('[penalty-force] load failed', e?.message || e);
        }
    }, [isStaffUser]);

    React.useEffect(() => {
        void loadPenaltyPendingTickets();
    }, [loadPenaltyPendingTickets]);

    const loadRealtimeNotifications = React.useCallback(async () => {
        try {
            const res = await myRealtimeNotifications();
            const list = Array.isArray(res?.list) ? res.list : [];
            setRealtimeList(list);
            setRealtimeUnreadCount(Number(res?.unreadCount || list.length));
        } catch (e: any) {
            console.error('[realtime-notification] load failed', e?.message || e);
        }
    }, []);

    const handleRealtimeJump = React.useCallback((item: RealtimeNotificationItem) => {
        if (!item?.route) return;
        const shouldOpenInNewTab =
            Boolean((item as any)?.payload?.openInNewTab) ||
            item.type === 'DISPATCH_ARCHIVED' ||
            item.type === 'DISPATCH_COMPLETED';

        if (shouldOpenInNewTab) {
            window.open(item.route, '_blank', 'noopener,noreferrer');
            return;
        }
        history.push(item.route);
    }, []);

    React.useEffect(() => {
        const token = String(localStorage.getItem('token') || '').trim();
        if (!token) return;

        loadRealtimeNotifications();

        // 复用浏览器原生 SSE，减少前端依赖；服务端通过 query.token 鉴权
        const eventSource = new EventSource(getRealtimeStreamUrl(token));
        realtimeEventSourceRef.current = eventSource;

        eventSource.onmessage = (evt) => {
            try {
                const payload = JSON.parse(evt.data || '{}');
                const msg = payload?.data ?? payload;
                if (msg?.type === 'snapshot') {
                    const items = Array.isArray(msg?.items) ? msg.items : [];
                    setRealtimeList(items);
                    setRealtimeUnreadCount(Number(msg?.unreadCount || items.length));
                    return;
                }
                if (msg?.type === 'message' && msg?.item) {
                    const item = msg.item as RealtimeNotificationItem;
                    setRealtimeList((prev) => [msg.item as RealtimeNotificationItem, ...prev].slice(0, 200));
                    setRealtimeUnreadCount(Number(msg?.unreadCount || 0));
                    if (isPenaltyForceItem(item)) {
                        void loadPenaltyPendingTickets();
                    }
                    // 弱提示：右上角实时弹出，可点击直接跳转
                    api.open({
                        key: item.id,
                        message: item.title || '消息通知',
                        description: item.content || '',
                        placement: 'topRight',
                        icon: <InfoCircleFilled style={{ color: '#d46b08' }} />,
                        style: {
                            background: '#fff7e6',
                            border: '1px solid #ffd591',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
                        },
                        // 弱提示保留更久，便于客服/打手在忙碌中注意到消息
                        duration: 180,
                        onClick: () => {
                            handleRealtimeJump(item);
                        },
                    });
                    return;
                }
                if (msg?.type === 'clear_one' || msg?.type === 'clear_all') {
                    setRealtimeUnreadCount(Number(msg?.unreadCount || 0));
                }
            } catch (e) {
                console.error('[realtime-notification] parse failed', e);
            }
        };

        eventSource.onerror = () => {
            // 连接中断时静默重连（浏览器会自动重连）
            console.warn('[realtime-notification] stream disconnected, browser will retry');
            // 兜底拉取，避免重连间隙错过提醒
            loadRealtimeNotifications();
        };

        return () => {
            eventSource.close();
            realtimeEventSourceRef.current = null;
        };
    }, [loadRealtimeNotifications, api, handleRealtimeJump, isPenaltyForceItem, loadPenaltyPendingTickets]);

    React.useEffect(() => {
        const token = String(localStorage.getItem('token') || '').trim();
        if (!token) return;
        // SSE 兜底：低频轮询，防止偶发网络抖动导致完全无提醒
        const timer = window.setInterval(() => {
            loadRealtimeNotifications();
        }, 15000);
        return () => window.clearInterval(timer);
    }, [loadRealtimeNotifications]);

    React.useEffect(() => {
        const token = String(localStorage.getItem('token') || '').trim();
        if (!token || !isStaffUser) return;
        const timer = window.setInterval(() => {
            void loadPenaltyPendingTickets();
        }, 10000);
        return () => window.clearInterval(timer);
    }, [isStaffUser, loadPenaltyPendingTickets]);

    const submitPenaltyConfirmInModal = React.useCallback(async () => {
        if (!activePenaltyTicket?.id) return;
        try {
            setPenaltyActionLoading(true);
            await confirmMyPenaltyTicket({ ticketId: Number(activePenaltyTicket.id) });
            message.success('处罚已确认');
            setPenaltyAppealContent('');
            await loadPenaltyPendingTickets();
        } catch (e: any) {
            message.error(e?.data?.message || e?.response?.data?.message || e?.message || '确认处罚失败');
        } finally {
            setPenaltyActionLoading(false);
        }
    }, [activePenaltyTicket, loadPenaltyPendingTickets]);

    const submitPenaltyAppealInModal = React.useCallback(async () => {
        if (!activePenaltyTicket?.id) return;
        const content = String(penaltyAppealContent || '').trim();
        if (!content) {
            message.warning('请先填写申诉说明');
            return;
        }
        try {
            setPenaltyActionLoading(true);
            await appealMyPenaltyTicket({
                ticketId: Number(activePenaltyTicket.id),
                content,
            });
            message.success('申诉已提交');
            setPenaltyAppealContent('');
            await loadPenaltyPendingTickets();
        } catch (e: any) {
            message.error(e?.data?.message || e?.response?.data?.message || e?.message || '提交申诉失败');
        } finally {
            setPenaltyActionLoading(false);
        }
    }, [activePenaltyTicket, penaltyAppealContent, loadPenaltyPendingTickets]);

    React.useEffect(() => {
        const token = String(localStorage.getItem('token') || '').trim();
        if (!token) return;

        const checkVersionManifest = async () => {
            try {
                const manifest = await fetchVersionManifest();
                if (!manifest) {
                    console.warn('[app-version] no active release record, skip popup');
                    return;
                }
                const remoteVersion = String(manifest?.version || '').trim();
                const remoteBuildId = String(manifest?.buildId || '').trim();
                const forceRefresh = Boolean(manifest?.forceRefresh);
                if (!forceRefresh) return;

                // 优先按 buildId 判定；若本地 buildId 丢失，退化到 version 判定；
                // 如远端有 buildId 但本地缺失，也按“需刷新”处理，避免漏弹窗。
                const mismatchByBuildId = Boolean(
                    remoteBuildId && LOCAL_APP_BUILD_ID && remoteBuildId !== LOCAL_APP_BUILD_ID,
                );
                const mismatchByVersion = Boolean(
                    remoteVersion && LOCAL_APP_VERSION && remoteVersion !== LOCAL_APP_VERSION,
                );
                const mismatchByMissingLocalBuildId = Boolean(remoteBuildId && !LOCAL_APP_BUILD_ID);
                const needRefresh = mismatchByBuildId || mismatchByVersion || mismatchByMissingLocalBuildId;
                if (!needRefresh) return;

                const remoteKey = `${remoteVersion || 'unknown'}#${remoteBuildId || 'unknown'}`;
                if (isDevEnv) {
                    // 开发环境避免循环弹窗：同一版本只提示一次，便于联调
                    const ackKey = String(sessionStorage.getItem(DEV_VERSION_ACK_STORAGE_KEY) || '').trim();
                    if (ackKey === remoteKey) return;
                }
                if (versionPromptedRef.current === remoteKey) return;
                versionPromptedRef.current = remoteKey;

                setVersionManifest(manifest);
                setVersionModalOpen(true);
            } catch (e: any) {
                console.error('[version-manifest] check failed', e?.message || e);
            }
        };

        checkVersionManifest();
    }, [isDevEnv]);

    return {
        logo: 'https://img.alicdn.com/tfs/TB1YHEpwUT1gK0jSZFhXXaAtVXa-28-27.svg',
        title: '蓝猫陪玩管理系统',
        collapsible: false,

        // ✅ 关键：移动端隐藏 ProLayout 外壳
        menuRender: isMobile ? false : undefined,
        menuHeaderRender: isMobile ? false : undefined,
        headerRender: isMobile ? false : undefined,
        footerRender: isMobile ? false : undefined,
        collapsedButtonRender: isMobile ? false : undefined,
        siderWidth: isMobile ? 0 : undefined,
        pageTitleRender: isMobile ? false : undefined,

        // ✅ 关键：移动端去掉内容区域 padding，让页面成为“纯内容”
        contentStyle: isMobile ? { padding: 0, margin: 0 } : undefined,

        // ✅ pure 模式（可选，支持则更干净）
        pure: isMobile ? true : undefined,

        // ✅ 右上角个人信息区域（保留你原逻辑）
        avatarProps: {
            size: 'small',
            title: '当前陪玩',
            render: (_props: any, _defaultDom: React.ReactNode) => {
                let currentUser: Partial<CurrentUser> | undefined;
                try {
                    const cached = localStorage.getItem('currentUser');
                    if (cached) currentUser = JSON.parse(cached);
                } catch (e) {
                    // ignore
                }

                const name = getDisplayName(currentUser);
                const levelText = getLevelText(currentUser);
                const menuItems = [{ key: 'logout', label: '退出登录' }];

                return (
                    <Dropdown
                        menu={{
                            items: menuItems,
                            onClick: ({ key }) => {
                                if (key === 'logout') doLogout();
                            },
                        }}
                    >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              {currentUser?.avatar ? (
                  <Avatar size="small" src={currentUser.avatar} />
              ) : (
                  <Avatar size="small" icon={<UserOutlined />} />
              )}
                <Text>{name}</Text>
                {/* 你之前的“评级文案”，保留但不抢眼 */}
                <Text type="secondary" style={{ fontSize: 12 }}>
                {levelText}
              </Text>
            </span>
                    </Dropdown>
                );
            },
        },

        actionsRender: () => [
            <Popover
                key="realtime-popover"
                trigger="click"
                placement="bottomRight"
                open={realtimeOpen}
                onOpenChange={async (open) => {
                    setRealtimeOpen(open);
                    if (open) await loadRealtimeNotifications();
                }}
                content={(
                    <div style={{ width: 360, maxHeight: 460, overflow: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <Text strong>实时消息</Text>
                            <Button
                                danger
                                size="small"
                                onClick={async () => {
                                    await clearAllRealtimeNotifications();
                                    setRealtimeList([]);
                                    setRealtimeUnreadCount(0);
                                    message.success('已全部清空');
                                }}
                            >
                                全部清空
                            </Button>
                        </div>
                        <List
                            dataSource={realtimeList}
                            locale={{ emptyText: '暂无实时消息' }}
                            renderItem={(item) => (
                                <List.Item
                                    actions={[
                                        item.route ? (
                                            <a
                                                key="goto"
                                                onClick={() => {
                                                    handleRealtimeJump(item);
                                                    setRealtimeOpen(false);
                                                }}
                                            >
                                                跳转
                                            </a>
                                        ) : null,
                                        <a
                                            key="clear-one"
                                            onClick={async () => {
                                                await clearOneRealtimeNotification({ id: item.id });
                                                setRealtimeList((prev) => prev.filter((x) => x.id !== item.id));
                                                setRealtimeUnreadCount((prev) => Math.max(0, prev - 1));
                                            }}
                                        >
                                            清空
                                        </a>,
                                    ].filter(Boolean as any)}
                                >
                                    <List.Item.Meta
                                        title={<Space><span>{item.title}</span><Text type="secondary">{item.type}</Text></Space>}
                                        description={(
                                            <div>
                                                <div>{item.content}</div>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    {new Date(item.createdAt).toLocaleString()}
                                                </Text>
                                            </div>
                                        )}
                                    />
                                </List.Item>
                            )}
                        />
                    </div>
                )}
            >
                <Badge key="realtime-badge" count={realtimeUnreadCount} offset={[-2, 4]}>
                    <Button
                        key="realtime-notifications"
                        type={realtimeUnreadCount > 0 ? 'primary' : 'text'}
                        icon={<BellOutlined />}
                    >
                        消息中心
                    </Button>
                </Badge>
            </Popover>,
            <Badge key="announcements-badge" count={forceQueue.length} offset={[-2, 4]}>
                <Button
                    key="announcements"
                    type={forceQueue.length > 0 ? 'primary' : 'text'}
                    danger={forceQueue.length > 0}
                    icon={<BellOutlined />}
                    onClick={async () => {
                        setAnnouncementOpen(true);
                        await loadAnnouncements();
                    }}
                >
                    公告中心
                </Button>
            </Badge>,
        ],

        onPageChange: ({ location }: any) => {
            const token = localStorage.getItem('token');
            const path = window.location.pathname;
            const allowAnonymous = path === '/login' || path === '/reset-password';

            if (!token && !allowAnonymous) {
                window.location.href = '/login';
            }

            const pathname = location?.pathname || window.location.pathname;

            const isMobileRoute =
                pathname.startsWith('/workbench') ||
                pathname.startsWith('/orders/') || // 订单详情
                pathname.startsWith('/m/'); // 如果你后面有 m 端路由

            const cls = 'bc-mobile-fullscreen';
            if (isMobileRoute) {
                document.body.classList.add(cls);
            } else {
                document.body.classList.remove(cls);
            }
        },
        childrenRender: (children) => {
            // ✅ 兜底：清掉历史遗留 403 标记，防止全站被截胡
            try {
                sessionStorage.removeItem('LAST_403_CODE');
                sessionStorage.removeItem('LAST_403_MESSAGE');
            } catch {}
            return (
                <>
                    {contextHolder}
                    {children}

                    <Modal
                        title="公告中心"
                        open={announcementOpen}
                        width="min(960px, calc(100vw - 32px))"
                        styles={{
                            body: {
                                maxHeight: 'calc(100vh - 220px)',
                                overflowY: 'auto',
                                overflowX: 'hidden',
                            },
                        }}
                        footer={null}
                        onCancel={() => setAnnouncementOpen(false)}
                    >
                        <List
                            loading={loadingAnnouncements}
                            dataSource={announcementList}
                            locale={{ emptyText: '暂无公告' }}
                            renderItem={(item: any) => (
                                <List.Item
                                    actions={[
                                        item.isRead ? (
                                            <Typography.Text key="read" type="secondary">已读</Typography.Text>
                                        ) : (
                                            <a
                                                key="markRead"
                                                onClick={async () => {
                                                    await readAnnouncement({ announcementId: item.id });
                                                    await loadAnnouncements();
                                                }}
                                            >
                                                标记已读
                                            </a>
                                        ),
                                    ]}
                                >
                                    <List.Item.Meta
                                        title={
                                            <Space>
                                                <span>{item.title}</span>
                                                {item.forceRead ? <Typography.Text type="danger">强制阅读</Typography.Text> : null}
                                            </Space>
                                        }
                                        description={
                                            <div
                                                style={{ maxHeight: 200, overflow: 'auto' }}
                                                dangerouslySetInnerHTML={{ __html: item.content || '' }}
                                            />
                                        }
                                    />
                                </List.Item>
                            )}
                        />
                    </Modal>

                    <Modal
                        title="强制阅读公告（每次进入需确认）"
                        // 客服不自动强弹，避免在订单详情/列表频繁跳转时影响效率；
                        // 客服仍可在“公告中心”查看并手动已读。
                        open={!versionModalOpen && !isCustomerService && forceQueue.length > 0}
                        closable={false}
                        maskClosable={false}
                        width="min(960px, calc(100vw - 32px))"
                        styles={{
                            body: {
                                paddingTop: 12,
                                maxHeight: 'calc(100vh - 230px)',
                                overflow: 'hidden',
                            },
                        }}
                        okButtonProps={{ disabled: !forceReadReachedBottom }}
                        cancelButtonProps={{ style: { display: 'none' } }}
                        okText="已阅读，下一条"
                        onOk={async () => {
                            const current = currentForceAnnouncement;
                            if (!current) return;
                            await readAnnouncement({ announcementId: current.id });
                            setConfirmedForceIds((prev) => [...prev, Number(current.id)]);
                            setForceReadReachedBottom(false);
                        }}
                    >
                        {currentForceAnnouncement ? (
                            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 290px)' }}>
                                <Typography.Title level={5} style={{ marginBottom: 12 }}>
                                    {currentForceAnnouncement.title}
                                </Typography.Title>
                                <div
                                    ref={forceReadContentRef}
                                    onScroll={checkForceReadReachedBottom}
                                    style={{
                                        flex: 1,
                                        minHeight: 160,
                                        overflowY: 'auto',
                                        overflowX: 'hidden',
                                        paddingRight: 8,
                                    }}
                                    dangerouslySetInnerHTML={{ __html: currentForceAnnouncement.content || '' }}
                                />
                                <Typography.Text type="secondary" style={{ marginTop: 10 }}>
                                    请先阅读到底，再点击“已阅读，下一条”
                                </Typography.Text>
                            </div>
                        ) : null}
                    </Modal>

                    <Modal
                        title={versionManifest?.title || '版本更新说明'}
                        open={versionModalOpen}
                        closable={false}
                        maskClosable={false}
                        keyboard={false}
                        cancelButtonProps={{ style: { display: 'none' } }}
                        okText="立即刷新"
                        onOk={() => {
                            if (isDevEnv) {
                                sessionStorage.setItem(DEV_VERSION_ACK_STORAGE_KEY, buildVersionKey(versionManifest));
                            }
                            window.location.reload();
                        }}
                    >
                        <Space direction="vertical" style={{ width: '100%' }} size={10}>
                            <Text>
                                检测到系统已发布新版本，为避免功能异常，请立即刷新页面加载最新资源。
                            </Text>
                            <Text type="secondary">
                                当前版本：{LOCAL_APP_VERSION || '-'}（{LOCAL_APP_BUILD_ID || '-'}）
                            </Text>
                            <Text type="secondary">
                                最新版本：{versionManifest?.version || '-'}（{versionManifest?.buildId || '-'}）
                            </Text>
                            <Text type="secondary">
                                发布时间：{formatBeijingDateTime(versionManifest?.releasedAt)}
                            </Text>
                            <List
                                size="small"
                                bordered
                                dataSource={(Array.isArray(versionManifest?.notes) ? versionManifest?.notes : [])
                                    .map((x) => stripNoteTrailingTime(String(x || '')))
                                    .filter(Boolean)}
                                locale={{ emptyText: '暂无更新说明' }}
                                renderItem={(note) => <List.Item>{note}</List.Item>}
                            />
                        </Space>
                    </Modal>

                    <Modal
                        title="强提醒：罚单待处理"
                        open={penaltyForceOpen}
                        closable={false}
                        maskClosable={false}
                        keyboard={false}
                        footer={(
                            <Space>
                                <Button
                                    loading={penaltyActionLoading}
                                    onClick={submitPenaltyAppealInModal}
                                >
                                    提交申诉
                                </Button>
                                <Button
                                    type="primary"
                                    danger
                                    loading={penaltyActionLoading}
                                    onClick={submitPenaltyConfirmInModal}
                                >
                                    确认处罚
                                </Button>
                            </Space>
                        )}
                    >
                        {activePenaltyTicket ? (
                            <div>
                                <Typography.Title level={5}>
                                    你有待处理罚单（必须确认处罚或提交申诉）
                                </Typography.Title>
                                <div style={{ marginBottom: 8 }}>罚单号：{activePenaltyTicket.ticketNo || '-'}</div>
                                <div style={{ marginBottom: 8 }}>处罚金额：{activePenaltyTicket.finalAmount ?? '-'}</div>
                                <div style={{ marginBottom: 8 }}>当前剩余待处理：{penaltyPendingTickets.length}</div>
                                <Input.TextArea
                                    rows={4}
                                    placeholder="如需申诉，请填写申诉说明（必填）"
                                    value={penaltyAppealContent}
                                    onChange={(e) => setPenaltyAppealContent(e.target.value)}
                                    maxLength={2000}
                                />
                            </div>
                        ) : null}
                    </Modal>
                </>
            );
        },

    };
};

export const request: RuntimeConfig['request'] = {
    timeout: 10000,
    errorConfig: {
        errorHandler: (error: any) => {
            const status = error?.response?.status;
            const data = error?.data; // umi-request 常见在这里

            if (status === 401) {
                message.error(data?.message || '登录已过期，请重新登录');
                doLogout();
                return;
            }
            if (status === 403) {
                const code = data?.code || '';
                const msg = data?.message || '无权访问';

                // 冻结：引导去钱包（仍在 Layout 内跳转，不刷新）
                if (code === 'ACCOUNT_FROZEN') {
                    message.warning(msg);
                    history.push('/wallet/overview');
                    return;
                }

                // 禁用：清登录态并去登录页
                if (code === 'ACCOUNT_DISABLED') {
                    message.error(msg);
                    localStorage.removeItem('token');
                    localStorage.removeItem('currentUser');
                    history.push('/login');
                    return;
                }

                // 其他 403：最简单——进 403 路由（Layout 仍然保留）
                message.error(msg);
                history.push(`/403?code=${encodeURIComponent(code)}&msg=${encodeURIComponent(msg)}`);
                return;
            }





            if (status && status >= 400) {
                message.error(data?.message || '请求失败');
                return;
            }

            message.error('网络错误，请检查网络连接');
            console.error('请求错误:', error);
        },
    },
    requestInterceptors: [
        (url: string, options: any) => {
            const token = localStorage.getItem('token');
            const headers = { ...(options?.headers || {}) };

            if (token) headers.Authorization = `Bearer ${token}`;
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';

            return { url, options: { ...options, headers } };
        },
    ],
    responseInterceptors: [
        (response: any) => {
            const refreshedToken = String(response?.headers?.get?.('x-access-token') || '').trim();
            if (refreshedToken) {
                localStorage.setItem('token', refreshedToken);
            }
            return response;
        },
    ],
};
