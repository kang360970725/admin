import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Table, Button, Space, message, Modal, Form, Input, Tree, Transfer } from 'antd';
import { getRoles, createRole, updateRole, deleteRole } from '@/services/role';
import { getPermissionTree } from '@/services/permission';

const RoleManagement: React.FC = () => {
    const [roles, setRoles] = useState([]);
    const [permissionTree, setPermissionTree] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingRole, setEditingRole] = useState<any>(null);
    const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [rolesRes, permissionsRes] = await Promise.all([
            getRoles(),
            getPermissionTree()
        ]);
        setRoles(rolesRes);
        setPermissionTree(permissionsRes);
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
            const data = { ...values, permissionIds: selectedPermissions };
            if (editingRole) {
                await updateRole(editingRole.id, data);
                message.success('更新成功');
            } else {
                await createRole(data);
                message.success('创建成功');
            }
            setModalVisible(false);
            loadData();
        } catch (error) {
            message.error('操作失败');
        }
    };

    const columns = [
        { title: '角色名称', dataIndex: 'name' },
        { title: '描述', dataIndex: 'description' },
        { title: '权限数量', dataIndex: 'permissions', render: (perms: any[]) => perms.length },
        { title: '用户数', dataIndex: ['_count', 'users'] },
        {
            title: '操作',
            render: (_, record) => (
                <Space>
                    <Button type="link" onClick={() => handleEdit(record)}>编辑</Button>
                    <Button type="link" danger onClick={() => handleDelete(record)}>删除</Button>
                </Space>
            ),
        },
    ];

    return (
        <PageContainer>
            <Card
                title="角色管理"
                extra={<Button type="primary" onClick={handleCreate}>新增角色</Button>}
            >
                <Table columns={columns} dataSource={roles} rowKey="id" />
            </Card>

            <Modal
                title={editingRole ? '编辑角色' : '新增角色'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={600}
            >
                <Form layout="vertical" onFinish={handleSubmit} initialValues={editingRole}>
                    <Form.Item name="name" label="角色名称" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="description" label="角色描述">
                        <Input.TextArea />
                    </Form.Item>
                    <Form.Item label="权限配置">
                        <Tree
                            checkable
                            treeData={permissionTree}
                            checkedKeys={selectedPermissions}
                            onCheck={(checked: any) => setSelectedPermissions(checked)}
                            fieldNames={{ title: 'name', key: 'id', children: 'children' }}
                        />
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">保存</Button>
                            <Button onClick={() => setModalVisible(false)}>取消</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </PageContainer>
    );
};

export default RoleManagement;
