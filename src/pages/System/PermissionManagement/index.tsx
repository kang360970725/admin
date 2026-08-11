import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Button, Spin, Tree, Modal, Form, Input, Select, Space, message, Tag, Typography } from 'antd';
import { getPermissionTree, createPermission, updatePermission, deletePermission } from '@/services/api';

const { Option } = Select;

const PermissionManagement: React.FC = () => {
    const [form] = Form.useForm();
    const [permissionTree, setPermissionTree] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [editingNode, setEditingNode] = useState<any>(null);
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
        setEditingNode(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (node: any) => {
        setSelectedNode(null);
        setEditingNode(node);
        form.setFieldsValue({
            key: node.key,
            name: node.name,
            module: node.module,
            type: node.type,
        });
        setModalVisible(true);
    };

    const handleSubmit = async (values: any) => {
        try {
            const data = {
                ...values,
                key: String(values?.key || '').trim(),
                name: String(values?.name || '').trim(),
                module: String(values?.module || '').trim(),
                parentId: selectedNode?.id || null,
            };
            if (editingNode) {
                await updatePermission(editingNode.id, {
                    ...data,
                    parentId: editingNode.parentId ?? null,
                });
                message.success('更新成功');
            } else {
                await createPermission(data);
                message.success('创建成功');
            }
            setModalVisible(false);
            setEditingNode(null);
            setSelectedNode(null);
            form.resetFields();
            loadPermissions();
        } catch (error) {
            message.error(editingNode ? '更新失败' : '创建失败');
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
      <Space size={6}>
        <span>{node.name}</span>
          {String(node?.key || '').startsWith('menu:') ? <Tag color="blue">目录</Tag> : <Tag>{node.type}</Tag>}
          <Typography.Text type="secondary">{node.key}</Typography.Text>
          <Typography.Text type="secondary">模块：{node.module}</Typography.Text>
      </Space>
            <Space>
                <Button type="link" size="small" onClick={(e) => {
                    e.stopPropagation();
                    handleAdd(node);
                }}>
                    添加子权限
                </Button>
                <Button type="link" size="small" onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(node);
                }}>
                    编辑
                </Button>
                <Button type="link" size="small" danger onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(node);
                }}>
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
                <Spin spinning={loading}>
                    <Tree
                        treeData={permissionTree}
                        titleRender={titleRender}
                        defaultExpandAll
                        showLine
                        fieldNames={{
                            title: 'name',
                            key: 'id',
                            children: 'children',
                        }}
                    />
                </Spin>
            </Card>

            <Modal
                title={editingNode ? `编辑权限：${editingNode.name}` : selectedNode ? `在"${selectedNode.name}"下添加权限` : '添加根权限'}
                open={modalVisible}
                onCancel={() => {
                    form.resetFields();
                    setEditingNode(null);
                    setSelectedNode(null);
                    setModalVisible(false);
                }}
                footer={null}
                width={500}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item
                        name="key"
                        label="权限键"
                        rules={[{ required: true, message: '请输入权限键' }]}
                    >
                        <Input
                            placeholder="如：canAccessUserManager"
                            onBlur={(e) => {
                                const value = String(e?.target?.value || '').trim();
                                form.setFieldValue?.('key', value);
                            }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="name"
                        label="权限名称"
                        rules={[{ required: true, message: '请输入权限名称' }]}
                    >
                        <Input
                            placeholder="如：用户管理访问权限"
                            onBlur={(e) => {
                                const value = String(e?.target?.value || '').trim();
                                form.setFieldValue?.('name', value);
                            }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="module"
                        label="模块名称"
                        rules={[{ required: true, message: '请输入模块名称' }]}
                    >
                        <Input
                            placeholder="如：userManager"
                            onBlur={(e) => {
                                const value = String(e?.target?.value || '').trim();
                                form.setFieldValue?.('module', value);
                            }}
                        />
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
                            <Button onClick={() => {
                                form.resetFields();
                                setEditingNode(null);
                                setSelectedNode(null);
                                setModalVisible(false);
                            }}>取消</Button>
                            <Button type="primary" htmlType="submit">{editingNode ? '更新' : '创建'}</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </PageContainer>
    );
};

export default PermissionManagement;
