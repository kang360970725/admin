import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, InputNumber, message, Tag } from 'antd';
import { updateUser, User } from '@/services/api';

const { Option } = Select;

interface EditUserModalProps {
    visible: boolean;
    user: User | null;
    onCancel: () => void;
    onSuccess: () => void;
    availableRatings?: any[]; // 新增：可用评级列表
}

const EditUserModal: React.FC<EditUserModalProps> = ({
                                                         visible,
                                                         user,
                                                         onCancel,
                                                         onSuccess,
                                                         availableRatings = [],
                                                     }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = React.useState(false);
    const [userType, setUserType] = useState('REGISTERED_USER');
    console.log("==========user");
    console.log(user);
    // 监听用户类型变化
    const handleUserTypeChange = (value: string) => {
        setUserType(value);
    };

    // 当用户数据变化时，更新表单
    useEffect(() => {
        if (user && visible) {
            const currentUserType = user.userType;
            setUserType(currentUserType);

            form.setFieldsValue({
                name: user.name,
                email: user.email,
                userType: currentUserType,
                status: user.status,
                realName: user.realName,
                idCard: user.idCard,
                avatar: user.avatar,
                level: user.level,
                rating: user.rating,
                balance: user.balance,
                needResetPwd: user.needResetPwd,
            });
        }
    }, [user, visible, form]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            if (user) {
                await updateUser(user.id, values);
                form.resetFields();
                onSuccess();
            }
        } catch (error: any) {
            if (error.errorFields) {
                message.error('请完善表单信息');
            } else {
                message.error(error?.response?.data?.message || '更新用户信息失败');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        if (user) {
            setUserType(user.userType); // 重置为用户原始类型
        }
        onCancel();
    };

    // 判断是否为员工类型
    const isStaff = userType === 'STAFF';

    // 获取当前用户的评级信息
    const currentRating = user?.staffRating;

    return (
        <Modal
            title={`编辑用户 - ${user?.name || user?.phone}`}
            open={visible}
            onOk={handleOk}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={600}
            destroyOnClose
        >
            <Form
                form={form}
                layout="vertical"
                name="editUserForm"
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* 第一列 */}
                    <div>
                        <Form.Item
                            label="手机号"
                        >
                            <Input value={user?.phone} disabled />
                        </Form.Item>

                        <Form.Item
                            label="用户身份"
                            name="userType"
                            rules={[{ required: true, message: '请选择用户身份' }]}
                        >
                            <Select
                                placeholder="请选择用户身份"
                                onChange={handleUserTypeChange}
                            >
                                <Option value="REGISTERED_USER">注册用户</Option>
                                <Option value="STAFF">员工</Option>
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

                        <Form.Item
                            label="需重置密码"
                            name="needResetPwd"
                        >
                            <Select placeholder="请选择">
                                <Option value={true}>是</Option>
                                <Option value={false}>否</Option>
                            </Select>
                        </Form.Item>
                    </div>

                    {/* 第二列 */}
                    <div>
                        <Form.Item
                            label="姓名"
                            name="name"
                        >
                            <Input placeholder="请输入姓名" />
                        </Form.Item>

                        <Form.Item
                            label="邮箱"
                            name="email"
                            rules={[{ type: 'email', message: '邮箱格式不正确' }]}
                        >
                            <Input placeholder="请输入邮箱" />
                        </Form.Item>

                        {/* 员工专属字段 */}
                        {isStaff && (
                            <>
                                <Form.Item
                                    label="真实姓名"
                                    name="realName"
                                    rules={[{ required: true, message: '员工必须填写真实姓名' }]}
                                >
                                    <Input placeholder="请输入真实姓名" />
                                </Form.Item>

                                <Form.Item
                                    label="身份证号"
                                    name="idCard"
                                    rules={[
                                        { required: true, message: '员工必须填写身份证号' },
                                        { pattern: /^\d{17}[\dXx]$/, message: '身份证号格式不正确' }
                                    ]}
                                >
                                    <Input placeholder="请输入身份证号" />
                                </Form.Item>
                            </>
                        )}

                        {/* 非员工时的普通字段 */}
                        {!isStaff && (
                            <>
                                <Form.Item
                                    label="真实姓名"
                                    name="realName"
                                >
                                    <Input placeholder="请输入真实姓名" />
                                </Form.Item>

                                <Form.Item
                                    label="身份证号"
                                    name="idCard"
                                >
                                    <Input placeholder="请输入身份证号" />
                                </Form.Item>
                            </>
                        )}
                    </div>
                </div>

                {/* 底部一行 - 动态显示评级字段 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <Form.Item
                        label="等级"
                        name="level"
                    >
                        <InputNumber
                            min={1}
                            max={10}
                            placeholder="等级"
                            style={{ width: '100%' }}
                        />
                    </Form.Item>

                    {/* 员工专属：评级字段 */}
                    {isStaff && (
                        <Form.Item
                            label="员工评级"
                            name="rating"
                            rules={[{ required: true, message: '员工必须设置评级' }]}
                        >
                            <Select placeholder="请选择评级" style={{ width: '100%' }}>
                                {availableRatings.map(rating => (
                                    <Option key={rating.id} value={rating.id}>
                                        {rating.name}
                                        <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>
                                            ({rating.scope === 'BOTH' ? '通用' : rating.scope === 'ONLINE' ? '线上' : '线下'})
                                        </span>
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    )}

                    {/* 非员工时显示普通位置 */}
                    {!isStaff && (
                        <Form.Item
                            label="评级"
                            name="rating"
                        >
                            <InputNumber
                                min={1}
                                max={5}
                                placeholder="评级"
                                style={{ width: '100%' }}
                                disabled
                            />
                        </Form.Item>
                    )}

                    <Form.Item
                        label="余额"
                        name="balance"
                    >
                        <InputNumber
                            min={0}
                            step={0.01}
                            precision={2}
                            placeholder="余额"
                            style={{ width: '100%' }}
                            formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={value => value?.replace(/¥\s?|(,*)/g, '') as any}
                        />
                    </Form.Item>
                </div>

                {/* 当前评级信息显示 */}
                {isStaff && currentRating && (
                    <div style={{
                        padding: '12px',
                        backgroundColor: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        borderRadius: '4px',
                        marginBottom: '16px'
                    }}>
                        <div style={{ fontWeight: 'bold', color: '#52c41a' }}>
                            当前评级信息:
                        </div>
                        <div>
                            <Tag color="blue">{currentRating.name}</Tag>
                            <span style={{ marginLeft: 8 }}>
                                分红比例: {(currentRating.rate * 100).toFixed(0)}% |
                                适用范围: {currentRating.scope === 'BOTH' ? '线上线下' : currentRating.scope === 'ONLINE' ? '线上' : '线下'}
                            </span>
                        </div>
                    </div>
                )}

                <Form.Item
                    label="头像URL"
                    name="avatar"
                >
                    <Input placeholder="请输入头像URL地址" />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EditUserModal;
