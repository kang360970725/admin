import React from 'react';
import { Modal, Form, Input, Alert, message, Button } from 'antd';
import { resetUserPassword, User } from '@/services/api';

const { TextArea } = Input;

interface ResetPasswordModalProps {
    visible: boolean;
    user: User | null;
    onCancel: () => void;
    onSuccess: () => void;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
                                                                   visible,
                                                                   user,
                                                                   onCancel,
                                                                   onSuccess,
                                                               }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = React.useState(false);
    const [tempPassword, setTempPassword] = React.useState<string>('');

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            if (user) {
                const result = await resetUserPassword(user.id, values);

                // 显示临时密码
                setTempPassword(result.tempPassword || '');

                // 不立即关闭，让用户复制密码
                if (result.tempPassword) {
                    message.success('密码重置成功，请复制临时密码');
                } else {
                    message.success('密码重置成功');
                    handleClose();
                    onSuccess();
                }
            }
        } catch (error: any) {
            if (error.errorFields) {
                message.error('请完善表单信息');
            } else {
                message.error(error?.response?.data?.message || '重置密码失败');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        form.resetFields();
        setTempPassword('');
        onCancel();
    };

    const handleCopyPassword = () => {
        if (tempPassword) {
            navigator.clipboard.writeText(tempPassword);
            message.success('临时密码已复制到剪贴板');
            handleClose();
            onSuccess();
        }
    };

    const handleContinue = () => {
        handleClose();
        onSuccess();
    };

    return (
        <Modal
            title={`重置密码 - ${user?.name || user?.phone}`}
            open={visible}
            onOk={tempPassword ? undefined : handleOk}
            onCancel={handleClose}
            confirmLoading={loading}
            width={500}
            destroyOnClose
            footer={
                tempPassword
                    ? [
                        <Button key="copy" type="primary" onClick={handleCopyPassword}>
                            复制密码并关闭
                        </Button>,
                        <Button key="continue" onClick={handleContinue}>
                            直接关闭
                        </Button>,
                    ]
                    : [
                        <Button key="cancel" onClick={handleClose}>
                            取消
                        </Button>,
                        <Button key="submit" type="primary" loading={loading} onClick={handleOk}>
                            确认重置
                        </Button>,
                    ]
            }
        >
            {!tempPassword ? (
                <>
                    <Alert
                        message="安全提醒"
                        description="重置密码后，系统将生成一个随机临时密码。用户首次登录时需要修改密码。"
                        type="warning"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />

                    <Form
                        form={form}
                        layout="vertical"
                        name="resetPasswordForm"
                        initialValues={{
                            remark: `为用户 ${user?.name || user?.phone} 重置密码`,
                        }}
                    >
                        <Form.Item
                            label="重置说明"
                            name="remark"
                            rules={[{ required: true, message: '请填写重置说明' }]}
                        >
                            <TextArea
                                placeholder="请填写重置密码的原因..."
                                rows={3}
                                maxLength={200}
                                showCount
                            />
                        </Form.Item>
                    </Form>

                    <div style={{
                        padding: '12px',
                        backgroundColor: '#fff2e8',
                        borderRadius: '4px',
                        border: '1px solid #ffbb96'
                    }}>
                        <div style={{ fontWeight: 'bold', color: '#d46b08' }}>
                            操作影响:
                        </div>
                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: '#d46b08' }}>
                            <li>用户当前密码将立即失效</li>
                            <li>系统会生成8位随机临时密码</li>
                            <li>用户首次登录必须修改密码</li>
                            <li>操作将被记录到日志中</li>
                        </ul>
                    </div>
                </>
            ) : (
                <>
                    <Alert
                        message="密码重置成功"
                        description="请将以下临时密码提供给用户，并提醒用户首次登录后立即修改密码。"
                        type="success"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />

                    <div style={{
                        padding: '16px',
                        backgroundColor: '#f6ffed',
                        borderRadius: '4px',
                        border: '1px solid #b7eb8f',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '12px', color: '#52c41a', marginBottom: '8px' }}>
                            临时密码（点击下方按钮复制）
                        </div>
                        <div style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: '#389e0d',
                            fontFamily: 'monospace',
                            letterSpacing: '2px',
                            padding: '8px',
                            backgroundColor: '#f0fdf4',
                            borderRadius: '4px',
                            border: '1px dashed #73d13d'
                        }}>
                            {tempPassword}
                        </div>
                    </div>

                    <div style={{
                        marginTop: '16px',
                        padding: '12px',
                        backgroundColor: '#e6f7ff',
                        borderRadius: '4px',
                        border: '1px solid #91d5ff'
                    }}>
                        <div style={{ fontWeight: 'bold', color: '#0958d9' }}>
                            后续操作提醒:
                        </div>
                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: '#0958d9' }}>
                            <li>请确保用户收到临时密码</li>
                            <li>提醒用户首次登录后立即修改密码</li>
                            <li>建议用户设置强密码</li>
                            <li>此临时密码仅显示一次，请妥善保存</li>
                        </ul>
                    </div>
                </>
            )}
        </Modal>
    );
};

export default ResetPasswordModal;
