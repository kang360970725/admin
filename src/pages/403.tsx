import React, { useMemo } from 'react';
import { Result, Button, Space, Typography, Card } from 'antd';
import {
    HomeOutlined,
    WalletOutlined,
    LogoutOutlined,
    LoginOutlined,
    StopOutlined,
    LockOutlined,
} from '@ant-design/icons';
import { history } from '@umijs/max';

const { Text } = Typography;

function doLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    history.push('/login');
}

function useQuery() {
    return useMemo(() => new URLSearchParams(window.location.search), []);
}

type UiKind = 'FROZEN' | 'DISABLED' | 'DENIED';

export default function Page403() {
    const qs = useQuery();
    const code = (qs.get('code') || '').trim();
    const msg = (qs.get('msg') || '').trim();

    const kind: UiKind =
        code === 'ACCOUNT_FROZEN' ? 'FROZEN' : code === 'ACCOUNT_DISABLED' ? 'DISABLED' : 'DENIED';

    const cfg = useMemo(() => {
        if (kind === 'FROZEN') {
            return {
                icon: <LockOutlined />,
                title: '账号功能已受限',
                subTitle: (
                    <div>
                        <div>检测到你的账号当前处于冻结状态，部分功能暂不可用。</div>
                        <div style={{ marginTop: 6 }}>
                            <Text type="secondary">你仍然可以查看余额、处理提现等钱包相关操作。</Text>
                        </div>
                    </div>
                ),
                primary: {
                    text: '去钱包看看',
                    icon: <WalletOutlined />,
                    onClick: () => history.push('/wallet/overview'),
                },
                secondary: [
                    {
                        text: '返回首页',
                        icon: <HomeOutlined />,
                        onClick: () => history.push('/'),
                    },
                    {
                        text: '退出登录',
                        icon: <LogoutOutlined />,
                        danger: true,
                        onClick: doLogout,
                    },
                ],
            };
        }

        if (kind === 'DISABLED') {
            return {
                icon: <StopOutlined />,
                title: '账号已禁用',
                subTitle: (
                    <div>
                        <div>你的账号已被禁用，暂无法继续使用系统功能。</div>
                        <div style={{ marginTop: 6 }}>
                            <Text type="secondary">如需恢复，请联系管理员处理。</Text>
                        </div>
                    </div>
                ),
                primary: {
                    text: '重新登录',
                    icon: <LoginOutlined />,
                    onClick: doLogout,
                },
                secondary: [
                    {
                        text: '返回首页',
                        icon: <HomeOutlined />,
                        onClick: () => history.push('/'),
                    },
                ],
            };
        }

        // 普通无权
        return {
            icon: <LockOutlined />,
            title: '无权访问',
            subTitle: (
                <div>
                    <div>你没有权限访问该页面或该功能。</div>
                    <div style={{ marginTop: 6 }}>
                        <Text type="secondary">如需开通权限，请联系管理员。</Text>
                    </div>
                </div>
            ),
            primary: {
                text: '返回首页',
                icon: <HomeOutlined />,
                onClick: () => history.push('/'),
            },
            secondary: [
                {
                    text: '退出登录',
                    icon: <LogoutOutlined />,
                    danger: true,
                    onClick: doLogout,
                },
            ],
        };
    }, [kind]);

    return (
        <div
            style={{
                padding: 16,
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
            }}
        >
            <Card
                bordered={false}
                style={{
                    width: 560,
                    marginTop: 48,
                    borderRadius: 14,
                    boxShadow: '0 14px 46px rgba(0,0,0,0.08)',
                }}
                bodyStyle={{ padding: '22px 22px 16px' }}
            >
                <Result
                    status="403"
                    icon={<div style={{ fontSize: 36, opacity: 0.8 }}>{cfg.icon}</div>}
                    title={<div style={{ fontSize: 20, marginBottom: 2 }}>{cfg.title}</div>}
                    subTitle={
                        <div style={{ marginTop: 4 }}>
                            {cfg.subTitle}
                            {!!msg && (
                                <div style={{ marginTop: 10, color: '#888' }}>
                                    <Text type="secondary">提示：</Text>
                                    <Text style={{ marginLeft: 6 }}>{msg}</Text>
                                </div>
                            )}
                        </div>
                    }
                    extra={
                        <Space size={8} wrap>
                            <Button type="primary" icon={cfg.primary.icon} onClick={cfg.primary.onClick}>
                                {cfg.primary.text}
                            </Button>

                            {cfg.secondary.map((b: any) => (
                                <Button key={b.text} danger={!!b.danger} icon={b.icon} onClick={b.onClick}>
                                    {b.text}
                                </Button>
                            ))}
                        </Space>
                    }
                />
            </Card>
        </div>
    );
}
