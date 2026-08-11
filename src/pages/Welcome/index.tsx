import React, { useEffect, useMemo } from 'react';
import { Card, Space, Typography, Tag, Spin } from 'antd';
import { useModel, useNavigate } from 'umi';

const { Title, Paragraph, Text } = Typography;

function isMobileByUA() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

function safeStr(v: any) {
    return v == null ? '' : String(v);
}

export default function WelcomePage() {
    const navigate = useNavigate();
    const { initialState } = useModel('@@initialState');
    const user: any = initialState?.currentUser;

    const name = user?.name || user?.phone || '当前用户';

    // ✅ 是否移动端：优先用视口宽度，其次 UA
    const isMobile = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia?.('(max-width: 767px)')?.matches || isMobileByUA();
    }, []);

    // ✅ 身份判断（只处理打手/客服，其他不跳转）
    const roleText = useMemo(() => {
        // 兼容：userType / roleName / roles[]
        return (
            safeStr(user?.userType) ||
            safeStr(user?.role?.name) ||
            safeStr(user?.roleName) ||
            safeStr(Array.isArray(user?.roles) ? user.roles?.[0]?.name : '') ||
            '未知'
        );
    }, [user]);

    const { isPlayer, isCS } = useMemo(() => {
        const ut = safeStr(user?.userType).toUpperCase();
        const rn = safeStr(user?.role?.name || user?.roleName).toUpperCase();
        const roles = Array.isArray(user?.roles) ? user.roles : [];
        const rolesText = roles.map((r: any) => safeStr(r?.name).toUpperCase()).join(',');

        const merged = `${ut}|${rn}|${rolesText}`;

        // ✅ 这里做“宽松但安全”的匹配（不会因为字段缺失报错）
        // 你如果有明确枚举值，后续我可以帮你收紧到最精准的判断
        const player =
            merged.includes('PLAYER') ||
            merged.includes('STAFF') ||
            merged.includes('打手') ||
            merged.includes('陪玩');

        const cs =
            merged.includes('CS') ||
            merged.includes('CUSTOMER_SERVICE') ||
            merged.includes('客服');

        return { isPlayer: player, isCS: cs };
    }, [user]);

    useEffect(() => {
        // ✅ PC 不处理
        if (!isMobile) return;

        // ✅ 移动端：仅处理打手/客服
        if (isPlayer) {
            navigate('/staff/workbench', { replace: true });
            return;
        }
        if (isCS) {
            navigate('/workbench', { replace: true });
            return;
        }
    }, [isMobile, isPlayer, isCS, navigate]);

    // ✅ 移动端：在跳转前给个“正在进入工作台”的过渡
    // （如果不是打手/客服，则会停留在欢迎页）
    const shouldAutoGo = isMobile && (isPlayer || isCS);

    return (
        <div style={{ padding: 24 }}>
            <Card>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Title level={3} style={{ margin: 0 }}>
                        欢迎回来，{name} 👋
                    </Title>

                    <Paragraph style={{ marginBottom: 0 }}>
                        <Text type="secondary">当前身份：</Text>
                        <Tag style={{ marginLeft: 8 }}>{roleText}</Tag>
                    </Paragraph>

                    {shouldAutoGo ? (
                        <div style={{ marginTop: 8 }}>
                            <Spin />
                            <div style={{ marginTop: 10, color: 'rgba(0,0,0,0.65)' }}>
                                正在进入{isPlayer ? '服务者工作台' : '服务者在线看板'}…
                            </div>
                        </div>
                    ) : (
                        <Paragraph style={{ marginBottom: 0, color: 'rgba(0,0,0,0.6)' }}>
                            请使用左侧菜单进入功能模块。
                        </Paragraph>
                    )}
                </Space>
            </Card>
        </div>
    );
}
