import React, { useRef, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Space, Tag, message, Popconfirm, Badge, Tooltip } from 'antd';
import { useAccess } from 'umi';
import {
    getStaffRatings,
    createStaffRating,
    updateStaffRating,
    deleteStaffRating
} from '@/services/api';
import CreateRatingModal from './components/CreateRatingModal';
import EditRatingModal from './components/EditRatingModal';

const ratingStatusMap = {
    ACTIVE: { text: '启用', status: 'success' },
    INACTIVE: { text: '停用', status: 'default' },
};

const scopeMap = {
    ONLINE: { text: '线上陪玩', color: 'blue' },
    OFFLINE: { text: '线下陪玩', color: 'green' },
    BOTH: { text: '线上线下', color: 'purple' },
};

export default function StaffRatingsPage() {
    const access = useAccess();
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingRating, setEditingRating] = useState<any>(null);
    const actionRef = useRef<any>();

    const handleEdit = (record: any) => {
        setEditingRating(record);
        setEditModalVisible(true);
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteStaffRating(id);
            message.success('删除成功');
            actionRef.current?.reload();
        } catch (error) {
            message.error('删除失败');
        }
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 60,
        },
        {
            title: '评级名称',
            dataIndex: 'name',
            key: 'name',
            width: 120,
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
            render: (text: string) => (
                <Tooltip title={text}>
                    <span>{text}</span>
                </Tooltip>
            ),
        },
        {
            title: '适用范围',
            dataIndex: 'scope',
            key: 'scope',
            width: 120,
            render: (scope: keyof typeof scopeMap) => (
                <Tag color={scopeMap[scope]?.color}>
                    {scopeMap[scope]?.text}
                </Tag>
            ),
        },
        {
            title: '分红比例',
            dataIndex: 'rate',
            key: 'rate',
            width: 100,
            render: (rate: number) => `${(rate * 100).toFixed(0)}%`,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 80,
            valueEnum: ratingStatusMap,
            render: (status: keyof typeof ratingStatusMap) => (
                <Badge
                    status={ratingStatusMap[status]?.status as any}
                    text={ratingStatusMap[status]?.text}
                />
            ),
        },
        {
            title: '排序',
            dataIndex: 'sortOrder',
            key: 'sortOrder',
            width: 80,
        },
        {
            title: '操作',
            key: 'action',
            width: 150,
            render: (_, record) => (
                <Space>
                    {!access.canEditRating && (
                        <Button type="link" size="small" onClick={() => handleEdit(record)}>
                            编辑
                        </Button>
                    )}
                    {!access.canDeleteRating && (
                        <Popconfirm
                            title="确定删除这个评级吗？"
                            onConfirm={() => handleDelete(record.id)}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button type="link" size="small" danger>
                                删除
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <PageContainer>
            <ProTable
                columns={columns}
                request={async (params) => {
                    try {
                        const response = await getStaffRatings(params);
                        return {
                            data: response.data,
                            success: true,
                            total: response.total,
                        };
                    } catch (error) {
                        message.error('获取评级列表失败');
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
                    !access.canCreateRating && (
                        <Button
                            key="add"
                            type="primary"
                            onClick={() => setCreateModalVisible(true)}
                        >
                            添加评级
                        </Button>
                    ),
                ]}
                pagination={{
                    pageSize: 10,
                }}
                actionRef={actionRef}
            />

            <CreateRatingModal
                visible={createModalVisible}
                onCancel={() => setCreateModalVisible(false)}
                onSuccess={() => {
                    setCreateModalVisible(false);
                    actionRef.current?.reload();
                }}
            />

            <EditRatingModal
                visible={editModalVisible}
                editingRating={editingRating}
                onCancel={() => {
                    setEditModalVisible(false);
                    setEditingRating(null);
                }}
                onSuccess={() => {
                    setEditModalVisible(false);
                    setEditingRating(null);
                    actionRef.current?.reload();
                }}
            />
        </PageContainer>
    );
}
