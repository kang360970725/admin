import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Table, Button, Space, message, Modal, Form, Input, Select, InputNumber, Tag, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { getGameProjects, createGameProject, updateGameProject } from '@/services/api';

const { Option } = Select;
const { TextArea } = Input;

const GameProjectManagement: React.FC = () => {
    const [projects, setProjects] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [coverImage, setCoverImage] = useState<string>('');

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const data = await getGameProjects();
            setProjects(data);
        } catch (error) {
            message.error('加载项目列表失败');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingProject(null);
        setCoverImage('');
        setModalVisible(true);
    };

    const handleEdit = (record: any) => {
        setEditingProject(record);
        setCoverImage(record.coverImage || '');
        setModalVisible(true);
    };

    const handleSubmit = async (values: any) => {
        try {
            const submitData = {
                ...values,
                coverImage: coverImage || undefined,
            };

            if (editingProject) {
                await updateGameProject(editingProject.id, submitData);
                message.success('更新成功');
            } else {
                await createGameProject(submitData);
                message.success('创建成功');
            }
            setModalVisible(false);
            loadProjects();
        } catch (error: any) {
            message.error(error.response?.data?.message || '操作失败');
        }
    };

    const handleImageUpload = (info: any) => {
        if (info.file.status === 'done') {
            // 这里需要实现图片上传逻辑，暂时用模拟URL
            setCoverImage('https://example.com/uploaded-image.jpg');
            message.success('图片上传成功');
        }
    };

    const handleDelete = async (record: any) => {
        Modal.confirm({
            title: '确认停用',
            content: `确定要停用项目 "${record.name}" 吗？`,
            onOk: async () => {
                try {
                    await updateGameProject(record.id, { status: 'INACTIVE' });
                    message.success('停用成功');
                    loadProjects();
                } catch (error) {
                    message.error('停用失败');
                }
            },
        });
    };

    const handleActivate = async (record: any) => {
        try {
            await updateGameProject(record.id, { status: 'ACTIVE' });
            message.success('启用成功');
            loadProjects();
        } catch (error) {
            message.error('启用失败');
        }
    };

    const typeMap = {
        EXPERIENCE: { text: '体验单', color: 'green', splitMode: '固定10%抽成' },
        FUN: { text: '趣味玩法单', color: 'cyan', splitMode: '按评级分成' },
        ESCORT: { text: '护航单', color: 'blue', splitMode: '按评级分成' },
        LUCKY_BAG: { text: '福袋单', color: 'orange', splitMode: '按评级分成' },
        BLIND_BOX: { text: '盲盒单', color: 'purple', splitMode: '0抽成' },
        CUSTOM: { text: '定制单', color: 'red', splitMode: '按评级分成' },
        CUSTOMIZED: { text: '自定义单', color: 'default', splitMode: '按评级分成' },
    };

    const columns = [
        {
            title: '封面',
            dataIndex: 'coverImage',
            key: 'coverImage',
            render: (image: string) =>
                image ? <img src={image} style={{ width: 50, height: 50, objectFit: 'cover' }} /> : '-',
        },
        {
            title: '项目名称',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: '价格',
            dataIndex: 'price',
            key: 'price',
            render: (price: number) => `¥${price}`,
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => {
                const config = typeMap[type] || { text: type, color: 'default' };
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: '计费模式',
            dataIndex: 'billingMode',
            key: 'billingMode',
            render: (mode: string) => (
                <Tag color={mode === 'HOURLY' ? 'geekblue' : 'gold'}>
                    {mode === 'HOURLY' ? '小时单' : '保底单'}
                </Tag>
            ),
        },
        {
            title: '保底数额',
            dataIndex: 'baseAmount',
            key: 'baseAmount',
            render: (amount: number) => amount ? `${amount}W` : '无保底',
        },
        {
            title: '固定抽成',
            dataIndex: 'clubRate',
            key: 'clubRate',
            render: (rate: number) => rate ? `${(rate * 100).toFixed(0)}%` : '按评级分成',
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>
                    {status === 'ACTIVE' ? '启用' : '停用'}
                </Tag>
            ),
        },
        {
            title: '操作',
            key: 'action',
            width: 200,
            render: (_: any, record: any) => (
                <Space>
                    <Button type="link" size="small" onClick={() => handleEdit(record)}>
                        编辑
                    </Button>
                    {record.status === 'ACTIVE' ? (
                        <Button
                            type="link"
                            size="small"
                            danger
                            onClick={() => handleDelete(record)}
                        >
                            停用
                        </Button>
                    ) : (
                        <Button
                            type="link"
                            size="small"
                            onClick={() => handleActivate(record)}
                        >
                            启用
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <PageContainer>
            <Card
                title="菜单项目管理"
                extra={
                    <Button type="primary" onClick={handleCreate}>
                        新增项目
                    </Button>
                }
            >
                <Table
                    columns={columns}
                    dataSource={projects}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                />
            </Card>

            <Modal
                title={editingProject ? '编辑项目' : '新增项目'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                width={700}
                destroyOnClose
            >
                <Form
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={
                        editingProject || {
                            type: 'EXPERIENCE',
                            billingMode: 'GUARANTEED',
                            status: 'ACTIVE',
                        }
                    }
                >
                    <Form.Item
                        name="name"
                        label="项目名称"
                        rules={[{ required: true, message: '请输入项目名称' }]}
                    >
                        <Input placeholder="例如：99保底488W哈夫币绝密单" />
                    </Form.Item>

                    <Form.Item
                        name="price"
                        label="价格"
                        rules={[{ required: true, message: '请输入价格' }]}
                    >
                        <InputNumber
                            min={0}
                            step={1}
                            precision={0}
                            placeholder="请输入价格"
                            style={{ width: '100%' }}
                            formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={value => value?.replace(/¥\s?|(,*)/g, '') as any}
                        />
                    </Form.Item>

                    <Form.Item
                        name="type"
                        label="订单类型"
                        rules={[{ required: true, message: '请选择订单类型' }]}
                    >
                        <Select placeholder="请选择订单类型">
                            <Option value="EXPERIENCE">体验单</Option>
                            <Option value="FUN">趣味玩法单</Option>
                            <Option value="ESCORT">护航单</Option>
                            <Option value="LUCKY_BAG">福袋单</Option>
                            <Option value="BLIND_BOX">盲盒单</Option>
                            <Option value="CUSTOM">定制单</Option>
                            <Option value="CUSTOMIZED">自定义单</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="billingMode"
                        label="计费模式"
                        rules={[{ required: true, message: '请选择计费模式' }]}
                    >
                        <Select placeholder="请选择计费模式">
                            <Option value="GUARANTEED">保底单</Option>
                            <Option value="HOURLY">小时单</Option>
                            <Option value="MODE_PLAY">玩法单</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="baseAmount"
                        label="保底哈夫币数额"
                    >
                        <InputNumber
                            min={0}
                            step={1}
                            precision={0}
                            placeholder="留空表示无保底要求"
                            style={{ width: '100%' }}
                            formatter={value => `${value} W`}
                            parser={value => value?.replace(/\s?W/g, '') as any}
                        />
                    </Form.Item>

                    <Form.Item
                        name="clubRate"
                        label="俱乐部固定抽成比例"
                    >
                        <InputNumber
                            min={0}
                            max={1}
                            step={0.01}
                            precision={2}
                            placeholder="留空表示按陪玩评级比例分成"
                            style={{ width: '100%' }}
                            formatter={value => value ? `${(value * 100).toFixed(0)}%` : ''}
                            parser={value => parseFloat(value?.replace('%', '') || '0') / 100}
                        />
                    </Form.Item>

                    <Form.Item label="封面图片">
                        <Upload
                            listType="picture"
                            showUploadList={false}
                            onChange={handleImageUpload}
                        >
                            <Button icon={<UploadOutlined />}>上传封面</Button>
                        </Upload>
                        {coverImage && (
                            <div style={{ marginTop: 8 }}>
                                <img src={coverImage} style={{ width: 100, height: 100, objectFit: 'cover' }} />
                            </div>
                        )}
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="项目描述（富文本）"
                    >
                        <TextArea
                            rows={4}
                            placeholder="支持富文本描述，可插入图片等"
                        />
                    </Form.Item>

                    {editingProject && (
                        <Form.Item
                            name="status"
                            label="状态"
                        >
                            <Select>
                                <Option value="ACTIVE">启用</Option>
                                <Option value="INACTIVE">停用</Option>
                            </Select>
                        </Form.Item>
                    )}

                    <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                        <Space>
                            <Button onClick={() => setModalVisible(false)}>取消</Button>
                            <Button type="primary" htmlType="submit">
                                {editingProject ? '更新' : '创建'}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </PageContainer>
    );
};

export default GameProjectManagement;
