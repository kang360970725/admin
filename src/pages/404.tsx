import React from 'react';
import { Button, Card, Result, Space, Typography } from 'antd';
import { history } from '@umijs/max';

const { Text } = Typography;

export default function NotFoundPage() {
    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                background:
                    'radial-gradient(1200px 600px at 20% 10%, rgba(22,119,255,0.18), transparent 60%), radial-gradient(900px 500px at 80% 30%, rgba(245,34,45,0.12), transparent 60%), linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.01))',
            }}
        >
            <Card
                style={{
                    width: '100%',
                    maxWidth: 520,
                    borderRadius: 18,
                    border: '1px solid rgba(0,0,0,0.06)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
                }}
                bodyStyle={{ padding: 22 }}
            >
                <Result
                    status="404"
                    title="页面不见了"
                    subTitle={
                        <Space direction="vertical" size={6}>
                            <Text type="secondary">可能链接失效、权限不足，或页面已被迁移。</Text>
                            <Text type="secondary">你可以返回首页，或回到上一页继续操作。</Text>
                        </Space>
                    }
                    extra={
                        <Space>
                            <Button type="primary" onClick={() => history.push('/welcome')} style={{ borderRadius: 12 }}>
                                返回首页
                            </Button>
                            <Button onClick={() => history.back()} style={{ borderRadius: 12 }}>
                                返回上一页
                            </Button>
                        </Space>
                    }
                />
            </Card>
        </div>
    );
}
