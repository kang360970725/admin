import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Form, Input, Select, InputNumber, message, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { createUser } from '@/services/api';

const { Option } = Select;

interface CreateUserModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
    availableRatings?: any[];
    staffTagOptions?: Array<{ label: string; value: string }>;
    defaultUserType?: string;
    lockUserType?: boolean;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({
    visible,
    onCancel,
    onSuccess,
    availableRatings = [],
    staffTagOptions = [],
    defaultUserType = 'REGISTERED_USER',
    lockUserType = false,
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = React.useState(false);
    const initialUserType = useMemo(() => defaultUserType || 'REGISTERED_USER', [defaultUserType]);
    const [userType, setUserType] = useState(initialUserType);
    const [workMode, setWorkMode] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');

    useEffect(() => {
        if (!visible) return;
        setUserType(initialUserType);
        setWorkMode('ONLINE');
        form.setFieldsValue({
            userType: initialUserType,
            balance: 0,
            workMode: 'ONLINE',
            offlineJoinedAt: null,
        });
    }, [visible, initialUserType, form]);

    const handleUserTypeChange = (value: string) => {
        setUserType(value);

        // 非服务者时不再保留线下相关字段，避免误传
        if (value !== 'STAFF') {
            setWorkMode('ONLINE');
            form.setFieldsValue({ workMode: 'ONLINE', offlineJoinedAt: null });
        } else {
            form.setFieldsValue({ workMode: 'ONLINE' });
        }
    };

    const handleWorkModeChange = (value: 'ONLINE' | 'OFFLINE') => {
        setWorkMode(value);

        // 切回线上时清空线下入职时间
        if (value === 'ONLINE') {
            form.setFieldsValue({ offlineJoinedAt: null });
        }
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload: any = { ...values };

            if (values.userType === 'STAFF') {
                payload.staffTags = values.staffTags ? [values.staffTags] : [];
                payload.workMode = (values.workMode || 'ONLINE') as 'ONLINE' | 'OFFLINE';
                payload.offlineJoinedAt =
                    payload.workMode === 'OFFLINE' && values.offlineJoinedAt
                        ? dayjs(values.offlineJoinedAt).startOf('day').toISOString()
                        : null;
            } else {
                delete payload.workMode;
                delete payload.offlineJoinedAt;
            }

            await createUser(payload);
            form.resetFields();
            setUserType(initialUserType);
            setWorkMode('ONLINE');
            onSuccess();
        } catch (error: any) {
            if (error.errorFields) {
                message.error('请完善表单信息');
            } else {
                const data = error?.data || error?.response?.data || {};
                const code = data?.code;
                const errorMessage = data?.message || error?.message || '创建用户失败';
                if (code === 'STAFF_REJOIN_COOLDOWN_CONFIRM_REQUIRED') {
                    Modal.confirm({
                        title: '确认重新入驻？',
                        content: (
                            <div style={{ lineHeight: '22px' }}>
                                <div>{errorMessage}</div>
                                <div style={{ marginTop: 8, color: '#ff4d4f' }}>
                                    确认后会复用历史服务者账号，并清零账户中的所有正数余额；负数余额不会处理。
                                </div>
                            </div>
                        ),
                        okText: '确认重新入驻',
                        cancelText: '取消',
                        okButtonProps: { danger: true },
                        onOk: async () => {
                            const retryValues = await form.validateFields();
                            const retryPayload: any = { ...retryValues, forceRejoin: true };
                            retryPayload.staffTags = retryValues.staffTags ? [retryValues.staffTags] : [];
                            retryPayload.workMode = (retryValues.workMode || 'ONLINE') as 'ONLINE' | 'OFFLINE';
                            retryPayload.offlineJoinedAt =
                                retryPayload.workMode === 'OFFLINE' && retryValues.offlineJoinedAt
                                    ? dayjs(retryValues.offlineJoinedAt).startOf('day').toISOString()
                                    : null;
                            await createUser(retryPayload);
                            message.success('服务者已重新入驻');
                            form.resetFields();
                            setUserType(initialUserType);
                            setWorkMode('ONLINE');
                            onSuccess();
                        },
                    });
                } else {
                    message.error(errorMessage);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setUserType(initialUserType);
        setWorkMode('ONLINE');
        onCancel();
    };

    const isStaff = userType === 'STAFF';

    return (
        <Modal
            title="添加用户"
            open={visible}
            onOk={handleOk}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={820}
            className="bc-admin-form-modal"
            destroyOnClose
        >
            <Form
                form={form}
                layout="vertical"
                className="bc-admin-form"
                name="createUserForm"
                initialValues={{
                    userType: initialUserType,
                    status: 'ACTIVE',
                    level: 1,
                    balance: 0,
                    workMode: 'ONLINE',
                }}
            >
                <div className="bc-admin-form-section">
                    <div className="bc-admin-form-section-title">账号信息</div>
                <div className="bc-admin-form-grid">
                    <div>
                        <Form.Item
                            label="手机号"
                            name="phone"
                            rules={[
                                { required: true, message: '请输入手机号' },
                                { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
                            ]}
                        >
                            <Input placeholder="请输入手机号" />
                        </Form.Item>

                        <Form.Item
                            label="密码"
                            name="password"
                            rules={[
                                { required: true, message: '请输入密码' },
                                { min: 6, message: '密码至少6位' },
                            ]}
                        >
                            <Input.Password placeholder="请输入密码" />
                        </Form.Item>

                        <Form.Item
                            label="用户身份"
                            name="userType"
                            rules={[{ required: true, message: '请选择用户身份' }]}
                        >
                            <Select placeholder="请选择用户身份" onChange={handleUserTypeChange} disabled={lockUserType}>
                                <Option value="REGISTERED_USER">注册用户</Option>
                                <Option value="STAFF">服务者</Option>
                                <Option value="CUSTOMER_SERVICE">客服</Option>
                                <Option value="OPERATION">运营</Option>
                                <Option value="FINANCE">财务</Option>
                                <Option value="ADMIN">管理员</Option>
                                <Option value="SUPER_ADMIN">超级管理员</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            label="账号状态"
                            name="status"
                            rules={[{ required: true, message: '请选择账号状态' }]}
                        >
                            <Select placeholder="请选择账号状态">
                                <Option value="ACTIVE">正常</Option>
                                <Option value="FROZEN">冻结</Option>
                                <Option value="DISABLED">停用</Option>
                            </Select>
                        </Form.Item>
                    </div>

                    <div>
                        <Form.Item label="昵称" name="name">
                            <Input placeholder="请输入昵称" />
                        </Form.Item>

                        <Form.Item
                            label="邮箱"
                            name="email"
                            rules={[{ type: 'email', message: '邮箱格式不正确' }]}
                        >
                            <Input placeholder="请输入邮箱" />
                        </Form.Item>

                        <>
                            <Form.Item
                                label="真实姓名"
                                name="realName"
                                rules={isStaff ? [{ required: true, message: '服务者必须填写真实姓名' }] : undefined}
                            >
                                <Input placeholder="请输入真实姓名" />
                            </Form.Item>

                            <Form.Item
                                label="身份证号"
                                name="idCard"
                                rules={isStaff ? [{ required: true, message: '服务者必须填写身份证号' }] : undefined}
                            >
                                <Input placeholder="请输入身份证号" />
                            </Form.Item>
                        </>
                    </div>
                </div>
                </div>

                <div className="bc-admin-form-section">
                    <div className="bc-admin-form-section-title">业务配置</div>
                <div className="bc-admin-form-grid">
                    <Form.Item label="等级" name="level">
                        <InputNumber min={1} max={10} placeholder="等级" style={{ width: '100%' }} />
                    </Form.Item>

                    {isStaff ? (
                        <Form.Item
                            label="服务者评级"
                            name="rating"
                            rules={[{ required: true, message: '服务者必须设置评级' }]}
                        >
                            <Select placeholder="请选择评级" style={{ width: '100%' }}>
                                {availableRatings.map((rating) => (
                                    <Option key={rating.id} value={rating.id}>
                                        {rating.name}
                                        <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>
                                            ({rating.scope === 'BOTH' ? '通用' : rating.scope === 'ONLINE' ? '线上' : '线下'})
                                        </span>
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    ) : (
                        <Form.Item label="评级" name="rating">
                            <InputNumber min={1} max={5} placeholder="评级" style={{ width: '100%' }} disabled />
                        </Form.Item>
                    )}

                    {isStaff && (
                        <Form.Item
                            label="服务者规则分组"
                            name="staffTags"
                            rules={[{ required: true, message: '服务者必须选择规则分组' }]}
                        >
                            <Select
                                allowClear
                                options={staffTagOptions}
                                placeholder="请选择服务者规则分组"
                            />
                        </Form.Item>
                    )}

                    <Form.Item label="初始余额" name="balance">
                        <InputNumber
                            min={0}
                            step={0.01}
                            precision={2}
                            placeholder="初始余额"
                            style={{ width: '100%' }}
                            disabled
                            formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(value) => value?.replace(/¥\s?|(,*)/g, '') as any}
                        />
                    </Form.Item>
                </div>
                </div>

                {isStaff && (
                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">服务者信息</div>
                    <div className="bc-admin-form-grid">
                        <Form.Item
                            label="服务者工作模式"
                            name="workMode"
                            rules={[{ required: true, message: '请选择服务者工作模式' }]}
                        >
                            <Select onChange={handleWorkModeChange}>
                                <Option value="ONLINE">线上</Option>
                                <Option value="OFFLINE">线下</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            label="线下入驻时间"
                            name="offlineJoinedAt"
                            rules={[
                                {
                                    validator: async (_, value) => {
                                        const mode = form.getFieldValue('workMode');
                                        if (mode === 'OFFLINE' && !value) {
                                            throw new Error('线下服务者必须填写入驻时间');
                                        }
                                    },
                                },
                            ]}
                        >
                            <DatePicker
                                style={{ width: '100%' }}
                                placeholder="请选择线下入职时间"
                                disabled={workMode !== 'OFFLINE'}
                                allowClear
                            />
                        </Form.Item>
                    </div>
                    </div>
                )}

                <div className="bc-admin-form-section">
                    <div className="bc-admin-form-section-title">头像</div>
                <Form.Item label="头像URL" name="avatar">
                    <Input placeholder="请输入头像URL地址" />
                </Form.Item>
                </div>
            </Form>
        </Modal>
    );
};

export default CreateUserModal;
