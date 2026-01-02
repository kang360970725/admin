import React from 'react';
import { Card, Space, Typography, Button, Tag } from 'antd';
import { useModel, useNavigate } from 'umi';

const { Title, Paragraph, Text } = Typography;

export default function WelcomePage() {
    const navigate = useNavigate();
    const { initialState } = useModel('@@initialState');
    const user = initialState?.currentUser;

    const name = user?.name || user?.phone || '当前陪玩';
    const userType = user?.userType || '陪玩';

    return (
        <div style={{ padding: 24 }}>
            <Card>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Title level={3} style={{ margin: 0 }}>
                        欢迎回来，{name} 👋
                    </Title>

                    <Paragraph style={{ marginBottom: 0 }}>
                        <Text type="secondary">当前身份：</Text>
                        <Tag style={{ marginLeft: 8 }}>{userType}</Tag>
                    </Paragraph>

                    {/*<Paragraph style={{ marginBottom: 0 }}>*/}
                    {/*    你可以从下面快捷入口开始使用系统：*/}
                    {/*</Paragraph>*/}

                    {/*<Space wrap>*/}
                    {/*    <Button type="primary" onClick={() => navigate('/staff/workbench')}>*/}
                    {/*        打手工作台*/}
                    {/*    </Button>*/}
                    {/*    <Button onClick={() => navigate('/orders')}>订单列表</Button>*/}
                    {/*    <Button onClick={() => navigate('/users')}>用户管理</Button>*/}
                    {/*    <Button onClick={() => navigate('/system/role-management')}>角色管理</Button>*/}
                    {/*    <Button onClick={() => navigate('/system/permission-management')}>权限管理</Button>*/}
                    {/*</Space>*/}
                </Space>
            </Card>
        </div>
    );
}
