import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, message } from 'antd';
import { getRoles } from '@/services/api';

const { Option } = Select;

interface AssignRoleModalProps {
    visible: boolean;
    onCancel: () => void;
    onOk: (values: any) => Promise<void>;
    user: any;
    loading?: boolean;
}

const AssignRoleModal: React.FC<AssignRoleModalProps> = ({
                                                             visible,
                                                             onCancel,
                                                             onOk,
                                                             user,
                                                             loading = false,
                                                         }) => {
    const [form] = Form.useForm();
    const [roles, setRoles] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (visible) {
            loadRoles();
            form.setFieldsValue({
                roleId: user?.roleId || undefined,
            });
        }
    }, [visible, user]);

    const loadRoles = async () => {
        try {
            const data = await getRoles();
            setRoles(data);
        } catch (error) {
            message.error('角色列表加载失败');
        }
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            await onOk(values);
            form.resetFields();
        } catch (error) {
            // 验证失败
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onCancel();
    };

    return (
        <Modal
            title="分配角色"
            open={visible}
            onOk={handleOk}
            onCancel={handleCancel}
            confirmLoading={loading || submitting}
            destroyOnClose
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={{
                    roleId: user?.roleId || undefined,
                }}
            >
                <Form.Item
                    name="roleId"
                    label="选择角色"
                    rules={[{ required: true, message: '请选择角色' }]}
                >
                    <Select placeholder="请选择角色" allowClear>
                        {roles.map(role => (
                            <Option key={role.id} value={role.id}>
                                {role.name}
                                {role.description && ` - ${role.description}`}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <div style={{ color: '#666', fontSize: 12 }}>
                    <p>当前用户：{user?.name} ({user?.phone})</p>
                    <p>分配角色后，用户将拥有该角色的所有权限</p>
                </div>
            </Form>
        </Modal>
    );
};

export default AssignRoleModal;
