import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Table, Button, Space, message, Modal, Form, Input, Tree, Tag } from 'antd';
import { getRoles, createRole, updateRole, deleteRole } from '@/services/api';
import { getPermissionTree } from '@/services/api';

const RoleManagement: React.FC = () => {
    const [roles, setRoles] = useState<any[]>([]);
    const [permissionTree, setPermissionTree] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingRole, setEditingRole] = useState<any>(null);
    const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rolesRes, permissionsRes] = await Promise.all([
                getRoles(),
                getPermissionTree()
            ]);
            setRoles(rolesRes);
            setPermissionTree(permissionsRes);
        } catch (error) {
            message.error('数据加载失败');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingRole(null);
        setSelectedPermissions([]);
        setModalVisible(true);
    };

    const handleEdit = (record: any) => {
        setEditingRole(record);
        setSelectedPermissions(record.permissions.map((p: any) => p.id));
        setModalVisible(true);
    };

    const handleSubmit = async (values: any) => {
        try {
            const data = {
                ...values,
                permissionIds: selectedPermissions
            };

            if (editingRole) {
                await updateRole(editingRole.id, data);
                message.success('更新成功');
            } else {
                await createRole(data);
                message.success('创建成功');
            }
            setModalVisible(false);
            loadData();
        } catch (error: any) {
            message.error(error.response?.data?.message || '操作失败');
        }
    };

    const handleDelete = async (record: any) => {
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除角色 "${record.name}" 吗？`,
            onOk: async () => {
                try {
                    await deleteRole(record.id);
                    message.success('删除成功');
                    loadData();
                } catch (error: any) {
                    message.error(error.response?.data?.message || '删除失败');
                }
            },
        });
    };

    const columns = [
        {
            title: '角色名称',
            dataIndex: 'name',
            render: (text: string) => <strong>{text}</strong>
        },
        {
            title: '描述',
            dataIndex: 'description',
            render: (text: string) => text || '-'
        },
        {
            title: '权限数量',
            dataIndex: 'permissions',
            render: (perms: any[]) => <Tag color="blue">{perms?.length || 0}</Tag>
        },
        {
            title: '用户数',
            dataIndex: ['_count', 'users'],
            render: (count: number) => <Tag>{count || 0}</Tag>
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            render: (date: string) => new Date(date).toLocaleString()
        },
        {
            title: '操作',
            width: 150,
            render: (_: any, record: any) => (
                <Space>
                    <Button type="link" size="small" onClick={() => handleEdit(record)}>
                        编辑
                    </Button>
                    <Button
                        type="link"
                        size="small"
                        danger
                        onClick={() => handleDelete(record)}
                        disabled={record._count?.users > 0}
                    >
                        删除
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <PageContainer>
            <Card
                title="角色管理"
                extra={
                    <Button type="primary" onClick={handleCreate}>
                        新增角色
                    </Button>
                }
            >
                <Table
                    columns={columns}
                    dataSource={roles}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                />
            </Card>

            <Modal
                title={editingRole ? '编辑角色' : '新增角色'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={700}
                destroyOnClose
            >
                <Form
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={editingRole || {}}
                >
                    <Form.Item
                        name="name"
                        label="角色名称"
                        rules={[{ required: true, message: '请输入角色名称' }]}
                    >
                        <Input placeholder="请输入角色名称" />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="角色描述"
                    >
                        <Input.TextArea
                            placeholder="请输入角色描述"
                            rows={3}
                        />
                    </Form.Item>

                    <Form.Item label="权限配置">
                        <Tree
                            checkable
                            treeData={permissionTree}
                            checkedKeys={selectedPermissions}
                            onCheck={(checked: any) => setSelectedPermissions(checked)}
                            fieldNames={{
                                title: 'name',
                                key: 'id',
                                children: 'children'
                            }}
                            height={300}
                            style={{ border: '1px solid #d9d9d9', padding: '16px' }}
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Space>
                            <Button onClick={() => setModalVisible(false)}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                {editingRole ? '更新' : '创建'}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </PageContainer>
    );
};

export default RoleManagement;
