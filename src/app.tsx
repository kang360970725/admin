import type { RuntimeConfig } from '@umijs/max';
import React from 'react';
import {Avatar, Badge, Button, Dropdown, List, message, Modal, Popover, Result, Space, Typography, notification} from 'antd';
import { BellOutlined, UserOutlined } from '@ant-design/icons';
import {
    clearAllRealtimeNotifications,
    clearOneRealtimeNotification,
    getCurrentUser,
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

const loginPath = '/login';

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
    const [api, contextHolder] = notification.useNotification();
    // 仅记录“本次进入已确认”的强制公告，刷新或重新登录后会再次弹出
    const [confirmedForceIds, setConfirmedForceIds] = React.useState<number[]>([]);
    const [loadingAnnouncements, setLoadingAnnouncements] = React.useState(false);
    const realtimeEventSourceRef = React.useRef<EventSource | null>(null);
    const forceQueue = React.useMemo(
        () => forceUnread.filter((item) => !confirmedForceIds.includes(Number(item?.id))),
        [forceUnread, confirmedForceIds],
    );

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
                if (payload?.type === 'snapshot') {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    setRealtimeList(items);
                    setRealtimeUnreadCount(Number(payload?.unreadCount || items.length));
                    return;
                }
                if (payload?.type === 'message' && payload?.item) {
                    const item = payload.item as RealtimeNotificationItem;
                    setRealtimeList((prev) => [payload.item as RealtimeNotificationItem, ...prev].slice(0, 200));
                    setRealtimeUnreadCount(Number(payload?.unreadCount || 0));
                    // 弱提示：右上角实时弹出，可点击直接跳转
                    api.open({
                        key: item.id,
                        message: item.title || '消息通知',
                        description: item.content || '',
                        placement: 'topRight',
                        duration: 4.5,
                        onClick: () => {
                            if (item.route) history.push(item.route);
                        },
                    });
                    return;
                }
                if (payload?.type === 'clear_one' || payload?.type === 'clear_all') {
                    setRealtimeUnreadCount(Number(payload?.unreadCount || 0));
                }
            } catch (e) {
                console.error('[realtime-notification] parse failed', e);
            }
        };

        eventSource.onerror = () => {
            // 连接中断时静默重连（浏览器会自动重连）
            console.warn('[realtime-notification] stream disconnected, browser will retry');
        };

        return () => {
            eventSource.close();
            realtimeEventSourceRef.current = null;
        };
    }, [loadRealtimeNotifications]);

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
                                                    history.push(item.route!);
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
                        width={760}
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
                        open={forceQueue.length > 0}
                        closable={false}
                        maskClosable={false}
                        cancelButtonProps={{ style: { display: 'none' } }}
                        okText="已阅读，下一条"
                        onOk={async () => {
                            const current = forceQueue[0];
                            if (!current) return;
                            await readAnnouncement({ announcementId: current.id });
                            setConfirmedForceIds((prev) => [...prev, Number(current.id)]);
                        }}
                    >
                        {forceQueue[0] ? (
                            <div>
                                <Typography.Title level={5}>{forceQueue[0].title}</Typography.Title>
                                <div dangerouslySetInnerHTML={{ __html: forceQueue[0].content || '' }} />
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
    responseInterceptors: [(response: any) => response],
};
