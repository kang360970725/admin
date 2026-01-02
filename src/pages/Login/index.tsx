import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { message } from 'antd';
import React from 'react';
import { useNavigate, useModel } from 'umi';
import { login } from '@/services/api';

export default function LoginPage() {
    const navigate = useNavigate();
    const { initialState, setInitialState } = useModel('@@initialState');

    const handleSubmit = async (values: any) => {
        try {
            const response: any = await login(values);

            if (!response?.access_token) {
                message.error('登录失败：未返回 token');
                return;
            }

            // 1) 存 token
            localStorage.setItem('token', response.access_token);

            // 2) 登录后立刻拉 /auth/me（拿到 permissions + needResetPwd），并更新全局状态
            let userInfo = response.user;

            if (initialState?.fetchUserInfo) {
                const fetched = await initialState.fetchUserInfo();
                if (fetched) {
                    userInfo = fetched;
                }
            }

            // 3) 持久化 currentUser（避免权限/页面刷新前短暂不一致）
            localStorage.setItem('currentUser', JSON.stringify(userInfo));

            await setInitialState((s: any) => ({
                ...s,
                currentUser: userInfo,
            }));

            message.success('登录成功！');

            // 4) ✅ 立即强制改密（不用等页面刷新）
            if (userInfo?.needResetPwd) {
                navigate('/reset-password');
                return;
            }

            navigate('/welcome');
        } catch (error: any) {
            console.error('登录错误:', error);
            message.error(error?.response?.data?.message || '登录失败，请检查手机号和密码');
        }
    };

    return (
        <LoginForm
            title="蓝猫陪玩管理系统"
            subTitle="后台管理登录"
            onFinish={handleSubmit}
        >
            <ProFormText
                name="phone"
                fieldProps={{
                    size: 'large',
                    prefix: <UserOutlined />,
                }}
                placeholder="手机号"
                rules={[
                    { required: true, message: '请输入手机号!' },
                    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确!' },
                ]}
            />
            <ProFormText.Password
                name="password"
                fieldProps={{
                    size: 'large',
                    prefix: <LockOutlined />,
                }}
                placeholder="密码"
                rules={[{ required: true, message: '请输入密码！' }]}
            />
        </LoginForm>
    );
}
