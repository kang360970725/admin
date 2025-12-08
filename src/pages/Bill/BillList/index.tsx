import React, { useRef, useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Space, Tag, message, Popconfirm, Modal, Form, Select, Input, Card } from 'antd';
import { useAccess } from 'umi';
import { getBills, updateBill, confirmBillSettlement, markBillAsPaid } from '@/services/api';

const { Option } = Select;

const BillList: React.FC = () => {
    const access = useAccess();
    const actionRef = useRef<any>();
    const [revisitModalVisible, setRevisitModalVisible] = useState(false);
    const [editingBill, setEditingBill] = useState<any>(null);

    const billStatusMap = {
        PENDING: { text: '未结单', color: 'orange' },
        SETTLED: { text: '已结单', color: 'blue' },
        ARCHIVED: { text: '已存单', color: 'default' },
    };

    const revisitStatusMap = {
        NOT_REVISITED: { text: '未回访', color: 'default' },
        GOOD: { text: '好评', color: 'success' },
        NEUTRAL: { text: '中评', color: 'warning' },
        BAD: { text: '差评', color: 'error' },
        COMPLAINT: { text: '客户投诉', color: 'red' },
    };

    const orderTypeMap = {
        EXPERIENCE: { text: '体验单', color: 'green' },
        FUN: { text: '趣味玩法单', color: 'cyan' },
        ESCORT: { text: '护航单', color: 'blue' },
        LUCKY_BAG: { text: '福袋单', color: 'orange' },
        BLIND_BOX: { text: '盲盒单', color: 'purple' },
        CUSTOM: { text: '定制单', color: 'red' },
        CUSTOMIZED: { text: '自定义单', color: 'default' },
    };

    const handleConfirmSettlement = async (record: any) => {
        try {
            await confirmBillSettlement(record.id);
            message.success('结算确认成功');
            actionRef.current?.reload();
        } catch (error: any) {
            message.error(error.response?.data?.message || '结算确认失败');
        }
    };

    const handleMarkAsPaid = async (record: any) => {
        try {
            await markBillAsPaid(record.id);
            message.success('标记打款成功');
            actionRef.current?.reload();
        } catch (error: any) {
            message.error(error.response?.data?.message || '标记打款失败');
        }
    };

    const handleRevisit = (record: any) => {
        setEditingBill(record);
        setRevisitModalVisible(true);
    };

    const handleRevisitSubmit = async (values: any) => {
        try {
            await updateBill(editingBill.id, values);
            message.success('回访信息更新成功');
            setRevisitModalVisible(false);
            setEditingBill(null);
            actionRef.current?.reload();
        } catch (error: any) {
            message.error(error.response?.data?.message || '更新失败');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await updateBill(id, { status: 'ARCHIVED' });
            message.success('订单已存档');
            actionRef.current?.reload();
        } catch (error: any) {
            message.error(error.response?.data?.message || '存档失败');
        }
    };

    const columns = [
        {
            title: '自动单号',
            dataIndex: 'autoSerial',
            key: 'autoSerial',
            width: 120,
        },
        {
            title: '手输单号',
            dataIndex: 'manualSerial',
            key: 'manualSerial',
            width: 100,
            render: (text: string) => text || '-',
        },
        {
            title: '项目',
            dataIndex: 'project',
            key: 'project',
            width: 200,
            render: (project: any) => project?.name || '-',
        },
        {
            title: '类型',
            dataIndex: 'project',
            key: 'type',
            width: 100,
            render: (project: any) => {
                const config = orderTypeMap[project?.type] || { text: project?.type, color: 'default' };
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: '客户游戏ID',
            dataIndex: 'customerGameId',
            key: 'customerGameId',
            width: 120,
            render: (text: string) => text || '-',
        },
        {
            title: '实付金额',
            dataIndex: 'actualAmount',
            key: 'actualAmount',
            width: 100,
            render: (amount: number) => amount ? `¥${amount}` : '-',
        },
        {
            title: '派单客服',
            dataIndex: 'dispatcher',
            key: 'dispatcher',
            width: 100,
            render: (text: string) => text || '-',
        },
        {
            title: '参与陪玩',
            dataIndex: 'billPlayers',
            key: 'players',
            width: 150,
            render: (players: any[]) =>
                players?.slice(0, 2).map(p => p.user?.name).join(', ') +
                (players?.length > 2 ? `等${players.length}人` : ''),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 80,
            render: (status: string) => {
                const config = billStatusMap[status] || { text: status, color: 'default' };
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: '回访状态',
            dataIndex: 'revisitStatus',
            key: 'revisitStatus',
            width: 100,
            render: (status: string) => {
                const config = revisitStatusMap[status] || { text: status, color: 'default' };
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 120,
            render: (date: string) => new Date(date).toLocaleDateString(),
        },
        {
            title: '操作',
            key: 'action',
            width: 200,
            render: (_: any, record: any) => (
                <Space direction="vertical" size="small">
                    <Space>
                        <Button type="link" size="small" onClick={() => handleRevisit(record)}>
                            回访
                        </Button>
                        {record.status === 'PENDING' && (
                            <Button
                                type="link"
                                size="small"
                                onClick={() => handleConfirmSettlement(record)}
                            >
                                确认结算
                            </Button>
                        )}
                        {record.status === 'SETTLED' && (
                            <Button
                                type="link"
                                size="small"
                                onClick={() => handleMarkAsPaid(record)}
                            >
                                标记打款
                            </Button>
                        )}
                    </Space>
                    <Space>
                        <Popconfirm
                            title="确定要存档这个订单吗？"
                            onConfirm={() => handleDelete(record.id)}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button type="link" size="small" danger>
                                存档
                            </Button>
                        </Popconfirm>
                    </Space>
                </Space>
            ),
        },
    ];

    // if (!access.canAccessBillManager) {
    //     return (
    //         <PageContainer>
    //             <Card>
    //                 <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
    //                     无权限访问订单管理
    //                 </div>
    //             </Card>
    //         </PageContainer>
    //     );
    // }

    return (
        <PageContainer>
            <ProTable
                columns={columns}
                request={async (params) => {
                    try {
                        const response = await getBills(params);
                        return {
                            data: response.data,
                            success: true,
                            total: response.total,
                        };
                    } catch (error) {
                        message.error('获取订单列表失败');
                        return {
                            data: [],
                            success: false,
                            total: 0,
                        };
                    }
                }}
                rowKey="id"
                search={{
                    labelWidth: 'auto',
                }}
                toolBarRender={() => [
                    <Button
                        key="create"
                        type="primary"
                        onClick={() => window.location.href = '/bill/create'}
                    >
                        创建订单
                    </Button>,
                ]}
                pagination={{
                    pageSize: 10,
                }}
                actionRef={actionRef}
            />

            {/* 回访弹窗 */}
            <Modal
                title="客户回访"
                open={revisitModalVisible}
                onCancel={() => {
                    setRevisitModalVisible(false);
                    setEditingBill(null);
                }}
                footer={null}
                width={500}
            >
                <Form
                    layout="vertical"
                    onFinish={handleRevisitSubmit}
                    initialValues={editingBill || {}}
                >
                    <Form.Item
                        name="revisitStatus"
                        label="回访状态"
                        rules={[{ required: true, message: '请选择回访状态' }]}
                    >
                        <Select placeholder="请选择回访状态">
                            <Option value="NOT_REVISITED">未回访</Option>
                            <Option value="GOOD">好评</Option>
                            <Option value="NEUTRAL">中评</Option>
                            <Option value="BAD">差评</Option>
                            <Option value="COMPLAINT">客户投诉</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="revisitDetail"
                        label="回访详情"
                        rules={[
                            {
                                required: editingBill?.revisitStatus === 'COMPLAINT',
                                message: '客户投诉必须填写详情'
                            }
                        ]}
                    >
                        <Input.TextArea
                            rows={4}
                            placeholder="请输入回访详情，如果是客户投诉请详细描述问题"
                        />
                    </Form.Item>

                    <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                        <Space>
                            <Button onClick={() => setRevisitModalVisible(false)}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                保存
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </PageContainer>
    );
};

export default BillList;
