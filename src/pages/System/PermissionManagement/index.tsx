import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Button, Tree, Modal, Form, Input, Select, Space, message } from 'antd';
import { getPermissionTree, createPermission, deletePermission } from '@/services/api';

const { Option } = Select;

const PermissionManagement: React.FC = () => {
    const [permissionTree, setPermissionTree] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadPermissions();
    }, []);

    const loadPermissions = async () => {
        setLoading(true);
        try {
            const data = await getPermissionTree();
            setPermissionTree(data);
        } catch (error) {
            message.error('权限数据加载失败');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = (node: any = null) => {
        setSelectedNode(node);
        setModalVisible(true);
    };

    const handleSubmit = async (values: any) => {
        try {
            const data = {
                ...values,
                parentId: selectedNode?.id || null,
            };
            await createPermission(data);
            message.success('创建成功');
            setModalVisible(false);
            loadPermissions();
        } catch (error) {
            message.error('创建失败');
        }
    };

    const handleDelete = (node: any) => {
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除权限 "${node.name}" 吗？这将同时删除所有子权限。`,
            onOk: async () => {
                try {
                    await deletePermission(node.id);
                    message.success('删除成功');
                    loadPermissions();
                } catch (error) {
                    message.error('删除失败');
                }
            },
        });
    };

    const titleRender = (node: any) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
      <span>
        {node.name}
          <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
          ({node.key})
        </span>
      </span>
            <Space>
                <Button type="link" size="small" onClick={() => handleAdd(node)}>
                    添加子权限
                </Button>
                <Button type="link" size="small" danger onClick={() => handleDelete(node)}>
                    删除
                </Button>
            </Space>
        </div>
    );

    return (
        <PageContainer>
            <Card
                title="权限管理"
                extra={
                    <Button type="primary" onClick={() => handleAdd()}>
                        添加根权限
                    </Button>
                }
            >
                <Tree
                    treeData={permissionTree}
                    titleRender={titleRender}
                    loading={loading}
                    defaultExpandAll
                    fieldNames={{
                        title: 'name',
                        key: 'id',
                        children: 'children',
                    }}
                />
            </Card>

            <Modal
                title={selectedNode ? `在"${selectedNode.name}"下添加权限` : '添加根权限'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={500}
            >
                <Form layout="vertical" onFinish={handleSubmit}>
                    <Form.Item
                        name="key"
                        label="权限键"
                        rules={[{ required: true, message: '请输入权限键' }]}
                    >
                        <Input placeholder="如：canAccessUserManager" />
                    </Form.Item>

                    <Form.Item
                        name="name"
                        label="权限名称"
                        rules={[{ required: true, message: '请输入权限名称' }]}
                    >
                        <Input placeholder="如：用户管理访问权限" />
                    </Form.Item>

                    <Form.Item
                        name="module"
                        label="模块名称"
                        rules={[{ required: true, message: '请输入模块名称' }]}
                    >
                        <Input placeholder="如：userManager" />
                    </Form.Item>

                    <Form.Item
                        name="type"
                        label="权限类型"
                        rules={[{ required: true, message: '请选择权限类型' }]}
                    >
                        <Select placeholder="请选择权限类型">
                            <Option value="PAGE">页面权限</Option>
                            <Option value="BUTTON">按钮权限</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                        <Space>
                            <Button onClick={() => setModalVisible(false)}>取消</Button>
                            <Button type="primary" htmlType="submit">创建</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </PageContainer>
    );
};

export default PermissionManagement;
