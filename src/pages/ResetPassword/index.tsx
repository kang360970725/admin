import React from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Form, Input, Button, message } from 'antd';
import { useModel } from 'umi';
import { updateUser } from '@/services/api';

export default function ResetPasswordPage() {
    const { initialState } = useModel('@@initialState');
    const [form] = Form.useForm();
    const [loading, setLoading] = React.useState(false);

    const handleSubmit = async (values: any) => {
        try {
            setLoading(true);

            if (values.newPassword !== values.confirmPassword) {
                message.error('两次输入的密码不一致');
                return;
            }

            // 调用更新用户接口，只更新密码
            await updateUser(initialState?.currentUser?.id, {
                password: values.newPassword,
                needResetPwd: false // 重置标记
            });

            message.success('密码修改成功，请重新登录');

            // 清除本地存储并跳转到登录页
            localStorage.removeItem('token');
            localStorage.removeItem('currentUser');
            window.location.href = '/login';

        } catch (error) {
            message.error('密码修改失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageContainer title="修改密码">
            <Card style={{ maxWidth: 500, margin: '0 auto' }}>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        label="新密码"
                        name="newPassword"
                        rules={[
                            { required: true, message: '请输入新密码' },
                            { min: 6, message: '密码至少6位' },
                        ]}
                    >
                        <Input.Password placeholder="请输入新密码" />
                    </Form.Item>

                    <Form.Item
                        label="确认新密码"
                        name="confirmPassword"
                        rules={[
                            { required: true, message: '请确认新密码' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('newPassword') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('两次输入的密码不一致'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password placeholder="请再次输入新密码" />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} block>
                            确认修改
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </PageContainer>
    );
}
