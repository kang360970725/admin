import React, {useState} from 'react';
import {LockOutlined, UserOutlined} from '@ant-design/icons';
import {LoginForm, ProFormText} from '@ant-design/pro-components';
import {Alert, message, Typography} from 'antd';
import {useModel, useNavigate} from 'umi';
import {login} from '@/services/api';

const {Text} = Typography;

function getErrorMessage(err: any) {
    const msg = err?.response?.data?.message;
    if (Array.isArray(msg)) return msg.join('；');
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (err?.message?.includes('Network Error')) return '网络异常，请检查网络或接口地址';
    if (err?.code === 'ECONNABORTED') return '请求超时，请稍后再试';
    return '登录失败，请检查手机号和密码';
}

export default function LoginPage() {
    const navigate = useNavigate();
    const {initialState, setInitialState} = useModel('@@initialState');

    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    const handleSubmit = async (values: any) => {
        setFormError('');
        setSubmitting(true);

        try {
            const response: any = await login(values);

            // ✅ 方案1：业务失败走这里（不会进 catch）
            if (response?.success === false) {
                const text = response?.message || '手机号或密码错误';
                message.error(text);
                return;
            }

            // ✅ 兼容：如果以后后端忘记带 success，也能兜住
            if (!response?.access_token) {
                message.error(response?.message || '登录失败：未返回 token');
                return;
            }


            localStorage.setItem('token', response.access_token);

            let userInfo = response.user;
            if (initialState?.fetchUserInfo) {
                const fetched = await initialState.fetchUserInfo();
                if (fetched) userInfo = fetched;
            }

            localStorage.setItem('currentUser', JSON.stringify(userInfo));

            await setInitialState((s: any) => ({
                ...s,
                currentUser: userInfo,
            }));

            message.success('登录成功！');

            if (userInfo?.needResetPwd) {
                navigate('/reset-password');
                return true;
            }

            navigate('/welcome');
            return true;
        } catch (error: any) {
            console.error('登录错误:', error);
            const text = getErrorMessage(error);
            setFormError(text);
            message.error(text);
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bc-login">
            {/* 背景层：PC 科技风，移动端更柔和 */}
            <div className="bc-bg">
                <div className="bc-grid"/>
                <div className="bc-glow bc-glow-a"/>
                <div className="bc-glow bc-glow-b"/>
                <div className="bc-noise"/>
            </div>

            {/* PC：单卡片窗口（合并） */}
            <div className="bc-shell">
                <div className="bc-card">
                    <div className="bc-head">
                        <div className="bc-logo" aria-hidden/>
                        <div>
                            <div className="bc-title">蓝猫陪玩管理系统</div>
                            <div className="bc-sub">后台管理登录 · BlueCat Console</div>
                        </div>
                    </div>

                    <LoginForm
                        title={false}
                        subTitle={false}
                        onFinish={handleSubmit}
                        submitter={{
                            searchConfig: {submitText: '登录'},
                            submitButtonProps: {
                                size: 'large',
                                loading: submitting,
                                className: 'bc-submit',
                            },
                        }}
                    >
                        {formError ? (
                            <Alert
                                type="error"
                                showIcon
                                message="登录失败"
                                description={formError}
                                className="bc-alert"
                            />
                        ) : null}

                        <ProFormText
                            name="phone"
                            fieldProps={{
                                size: 'large',
                                prefix: <UserOutlined/>,
                                autoComplete: 'username',
                                className: 'bc-input',
                            }}
                            placeholder="手机号"
                            rules={[
                                {required: true, message: '请输入手机号!'},
                                {pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确!'},
                            ]}
                        />

                        <ProFormText.Password
                            name="password"
                            fieldProps={{
                                size: 'large',
                                prefix: <LockOutlined/>,
                                autoComplete: 'current-password',
                                className: 'bc-input',
                            }}
                            placeholder="密码"
                            rules={[{required: true, message: '请输入密码！'}]}
                        />

                        <div className="bc-foot">
                            <span className="bc-foot-left">忘记密码请联系管理员</span>
                            <span className="bc-foot-right">BlueCat © {new Date().getFullYear()}</span>
                        </div>
                    </LoginForm>
                </div>

                {/* 移动端：顶部信息 + 轻卡片（避免显示不全） */}
                <div className="bc-mobile">
                    <div className="bc-m-top">
                        <div className="bc-m-logo" aria-hidden/>
                        <div className="bc-m-title">蓝猫陪玩</div>
                        <div className="bc-m-sub">移动端快捷登录</div>
                    </div>

                    <div className="bc-m-card">
                        <div className="bc-m-card-head">
                            <div className="bc-m-card-title">登录</div>
                            <div className="bc-m-card-sub">请输入手机号与密码</div>
                        </div>

                        <LoginForm
                            title={false}
                            subTitle={false}
                            onFinish={handleSubmit}
                            submitter={{
                                searchConfig: {submitText: '登录'},
                                submitButtonProps: {
                                    size: 'large',
                                    loading: submitting,
                                    className: 'bc-submit bc-submit-m',
                                },
                            }}
                        >
                            {formError ? (
                                <Alert
                                    type="error"
                                    showIcon
                                    message="登录失败"
                                    description={formError}
                                    className="bc-alert"
                                />
                            ) : null}

                            <ProFormText
                                name="phone"
                                fieldProps={{
                                    size: 'large',
                                    prefix: <UserOutlined/>,
                                    autoComplete: 'username',
                                    className: 'bc-input',
                                }}
                                placeholder="手机号"
                                rules={[
                                    {required: true, message: '请输入手机号!'},
                                    {pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确!'},
                                ]}
                            />

                            <ProFormText.Password
                                name="password"
                                fieldProps={{
                                    size: 'large',
                                    prefix: <LockOutlined/>,
                                    autoComplete: 'current-password',
                                    className: 'bc-input',
                                }}
                                placeholder="密码"
                                rules={[{required: true, message: '请输入密码！'}]}
                            />

                            <div className="bc-m-foot">
                                <Text style={{color: 'rgba(255,255,255,0.55)', fontSize: 12}}>
                                    登录后如需重置密码，将自动跳转
                                </Text>
                            </div>
                        </LoginForm>
                    </div>

                    <div className="bc-m-bottom">BlueCat Console · {new Date().getFullYear()}</div>
                </div>
            </div>

            <style>
                {`
        /* ===== 通用背景（PC） ===== */
        .bc-login{
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          background: #070A12;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .bc-bg{ position:absolute; inset:0; pointer-events:none; }
        .bc-grid{
          position:absolute; inset:-20%;
          background-image:
            linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px);
          background-size: 48px 48px;
          transform: rotate(-8deg);
          opacity: 0.12;
        }
        .bc-glow{
          position:absolute;
          width: 680px;
          height: 680px;
          border-radius: 999px;
          filter: blur(44px);
          opacity: .78;
          mix-blend-mode: screen;
        }
        .bc-glow-a{
          left: -220px;
          top: -220px;
          background: radial-gradient(circle at 30% 30%, rgba(56,189,248,.55), rgba(56,189,248,0) 60%),
                      radial-gradient(circle at 70% 70%, rgba(167,139,250,.45), rgba(167,139,250,0) 58%);
        }
        .bc-glow-b{
          right: -260px;
          bottom: -260px;
          background: radial-gradient(circle at 30% 30%, rgba(34,197,94,.30), rgba(34,197,94,0) 60%),
                      radial-gradient(circle at 70% 70%, rgba(59,130,246,.40), rgba(59,130,246,0) 60%);
        }
        .bc-noise{
          position:absolute; inset:0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.25'/%3E%3C/svg%3E");
          opacity: .16;
        }

        /* ===== 框架 ===== */
        .bc-shell{
          position: relative;
          z-index: 1;
          width: 100%;
          padding: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* ===== PC 单窗口卡片 ===== */
        .bc-card{
          width: 440px;
          max-width: 92vw;
          border-radius: 22px;
          padding: 18px 16px 14px;
          border: 1px solid rgba(255,255,255,0.14);
          background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05));
          box-shadow: 0 28px 78px rgba(0,0,0,0.62);
          backdrop-filter: blur(14px);
          position: relative;
          overflow: hidden;
        }
        .bc-card:before{
          content:'';
          position:absolute;
          inset:-2px;
          background:
            radial-gradient(800px 240px at 20% 0%, rgba(56,189,248,0.18), transparent 60%),
            radial-gradient(700px 220px at 90% 10%, rgba(167,139,250,0.14), transparent 58%);
          pointer-events:none;
        }
        .bc-card > *{ position: relative; z-index: 1; }

        .bc-head{
          display:flex;
          align-items:center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .bc-logo{
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(59,130,246,1), rgba(167,139,250,1));
          box-shadow: 0 18px 40px rgba(59,130,246,0.25);
        }
        .bc-title{
          color: rgba(255,255,255,0.92);
          font-weight: 900;
          font-size: 20px;
          letter-spacing: .4px;
          line-height: 1.2;
        }
        .bc-sub{
          margin-top: 6px;
          color: rgba(255,255,255,0.55);
          font-size: 12px;
          letter-spacing: .2px;
        }

        .bc-alert{
          border-radius: 14px !important;
          margin-bottom: 12px !important;
          background: rgba(255, 0, 0, 0.08) !important;
          border: 1px solid rgba(255, 90, 90, 0.25) !important;
        }

        /* 输入框 */
        .bc-login .ant-input-affix-wrapper{
          background: rgba(255,255,255,0.06) !important;
          border: 1px solid rgba(255,255,255,0.14) !important;
          border-radius: 14px !important;
          transition: all .18s ease;
        }
        .bc-login .ant-input-affix-wrapper:hover{
          border-color: rgba(56,189,248,0.45) !important;
        }
        .bc-login .ant-input-affix-wrapper-focused{
          border-color: rgba(56,189,248,0.70) !important;
          box-shadow: 0 0 0 3px rgba(56,189,248,0.18) !important;
        }
        .bc-login .ant-input{
          background: transparent !important;
          color: rgba(255,255,255,0.92) !important;
        }
        .bc-login .ant-input::placeholder{
          color: rgba(255,255,255,0.38) !important;
        }
        .bc-login .ant-input-prefix{
          color: rgba(255,255,255,0.55) !important;
        }

        .bc-submit{
          width: 100% !important;
          height: 44px !important;
          border-radius: 14px !important;
          font-weight: 800 !important;
          letter-spacing: .6px !important;
          border: none !important;
          background: linear-gradient(90deg, rgba(59,130,246,1), rgba(167,139,250,1)) !important;
          box-shadow: 0 18px 40px rgba(59,130,246,0.25);
        }

        .bc-foot{
          margin-top: 8px;
          display:flex;
          justify-content: space-between;
          align-items:center;
          gap: 10px;
          color: rgba(255,255,255,0.45);
          font-size: 12px;
        }

        /* ===== 移动端专用（单独风格、避免溢出） ===== */
        .bc-mobile{ display:none; }

        @media (max-width: 767px){
          /* 移动端换成更柔和的背景（不跟 PC 强绑定） */
          .bc-login{
            background: linear-gradient(180deg, #070A12 0%, #0B1224 45%, #070A12 100%);
            align-items: stretch;
          }

          .bc-shell{
            padding: 0;
            width: 100%;
            align-items: stretch;
          }

          /* 隐藏 PC 卡片，展示移动端布局 */
          .bc-card{ display:none; }
          .bc-mobile{
            display:flex;
            flex-direction: column;
            width: 100%;
            min-height: 100vh;
            padding: 18px 16px 14px;
            box-sizing: border-box;
          }

          .bc-m-top{
            padding-top: 12px;
            display:flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
          }
          .bc-m-logo{
            width: 54px;
            height: 54px;
            border-radius: 18px;
            background: linear-gradient(135deg, rgba(56,189,248,1), rgba(167,139,250,1));
            box-shadow: 0 22px 60px rgba(56,189,248,0.16);
          }
          .bc-m-title{
            margin-top: 10px;
            color: rgba(255,255,255,0.92);
            font-size: 24px;
            font-weight: 900;
            letter-spacing: .4px;
          }
          .bc-m-sub{
            color: rgba(255,255,255,0.55);
            font-size: 13px;
          }

          .bc-m-card{
            margin-top: 16px;
            border-radius: 20px;
            padding: 16px 14px 12px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.06);
            box-shadow: 0 24px 70px rgba(0,0,0,0.55);
            backdrop-filter: blur(12px);
            display: grid;
            flex-direction: column;
            gap: 10px;
          }
          .bc-m-card-head{
            margin-bottom: 10px;
          }
          .bc-m-card-title{
            color: rgba(255,255,255,0.90);
            font-size: 18px;
            font-weight: 900;
          }
          .bc-m-card-sub{
            margin-top: 6px;
            color: rgba(255,255,255,0.52);
            font-size: 12px;
          }

          .bc-submit-m{
            height: 46px !important;
            border-radius: 16px !important;
          }

          .bc-m-foot{
            margin-top: 6px;
            text-align: left;
          }
          .bc-m-bottom{
            margin-top: auto;
            padding-top: 16px;
            color: rgba(255,255,255,0.35);
            font-size: 12px;
            text-align: center;
          }

          /* 移动端输入框更紧凑一点，避免“显示不全” */
          .bc-login .ant-form-item{
            margin-bottom: 12px !important;
          }
        }

        /* 再小屏（iPhone SE）兜底：进一步压缩间距 */
        @media (max-width: 360px){
          .bc-mobile{ padding: 14px 12px 12px; }
          .bc-m-title{ font-size: 22px; }
          .bc-m-card{ padding: 14px 12px 10px; }
          .bc-login .ant-form-item{ margin-bottom: 10px !important; }
        }
        `}
            </style>
        </div>
    );
}
