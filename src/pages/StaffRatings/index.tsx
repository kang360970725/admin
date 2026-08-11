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
    ONLINE: { text: '线上服务', color: 'blue' },
    OFFLINE: { text: '线下服务', color: 'green' },
    BOTH: { text: '线上线下', color: 'purple' },
};

function formatBeijingTime(raw: any) {
    if (!raw) return '-';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '-';
    const parts = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const pick = (type: string) => parts.find((part) => part.type === type)?.value || '00';
    return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}`;
}

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

    const columns: any[] = [
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
            render: (text: any) => (
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
            render: (scope: any) => (
                <Tag color={scopeMap[scope as keyof typeof scopeMap]?.color}>
                    {scopeMap[scope as keyof typeof scopeMap]?.text}
                </Tag>
            ),
        },
        {
            title: '分红比例',
            dataIndex: 'rate',
            key: 'rate',
            width: 100,
            render: (rate: any) => `${(Number(rate || 0) * 100).toFixed(0)}%`,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 80,
            valueEnum: ratingStatusMap,
            render: (status: any) => (
                <Badge
                    status={ratingStatusMap[status as keyof typeof ratingStatusMap]?.status as any}
                    text={ratingStatusMap[status as keyof typeof ratingStatusMap]?.text}
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
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 170,
            search: false,
            render: (value: any) => formatBeijingTime(value),
        },
        {
            title: '修改时间',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            width: 170,
            search: false,
            render: (value: any) => formatBeijingTime(value),
        },
        {
            title: '操作',
            key: 'action',
            width: 150,
            render: (_: any, record: any) => (
                <Space>
                    {access.canEditRating && (
                        <Button type="link" size="small" onClick={() => handleEdit(record)}>
                            编辑
                        </Button>
                    )}
                    {access.canDeleteRating && (
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
                headerTitle="服务者评级"
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
                    access.canCreateRating && (
                        <Button
                            key="add"
                            type="primary"
                            onClick={() => setCreateModalVisible(true)}
                        >
                            添加服务者评级
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
