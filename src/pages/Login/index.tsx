import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { message } from 'antd';
import { useNavigate, useModel } from 'umi';
import { login } from '@/services/api';

export default function LoginPage() {
    const navigate = useNavigate();
    const { initialState, setInitialState } = useModel('@@initialState');

    const handleSubmit = async (values: any) => {
        try {
            const response = await login(values);

            if (response.access_token) {
                // 存储 token 到 localStorage
                localStorage.setItem('token', response.access_token);
                localStorage.setItem('currentUser', JSON.stringify(response.user));

                // 更新全局初始状态
                await setInitialState((s) => ({
                    ...s,
                    currentUser: response.user,
                }));

                message.success('登录成功！');
                navigate('/');
            }
        } catch (error: any) {
            console.error('登录错误:', error);
            message.error(error?.response?.data?.message || '登录失败，请检查手机号和密码');
        }
    };

    return (
        <div style={{ backgroundColor: 'white', height: '100vh' }}>
            <LoginForm
                title="蓝猫陪玩管理系统"
                subTitle="欢迎登录管理后台"
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
                        {
                            required: true,
                            message: '请输入手机号!',
                        },
                        {
                            pattern: /^1[3-9]\d{9}$/,
                            message: '手机号格式不正确!',
                        },
                    ]}
                />
                <ProFormText.Password
                    name="password"
                    fieldProps={{
                        size: 'large',
                        prefix: <LockOutlined />,
                    }}
                    placeholder="密码"
                    rules={[
                        {
                            required: true,
                            message: '请输入密码！',
                        },
                    ]}
                />
            </LoginForm>
        </div>
    );
}
