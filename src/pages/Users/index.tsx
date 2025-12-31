import React, {useEffect, useRef, useState} from 'react';
import {PageContainer, ProTable} from '@ant-design/pro-components';
import {Badge, Button, message, Popconfirm, Space, Tag, Tooltip} from 'antd';
import {useAccess} from 'umi';
import dayjs from 'dayjs';
import {deleteUser, getAvailableRatings, getUsers, updateUser} from '@/services/api';
import CreateUserModal from './components/CreateUserModal';
import EditUserModal from './components/EditUserModal';
import ChangeLevelModal from './components/ChangeLevelModal';
import ResetPasswordModal from './components/ResetPasswordModal';
import AssignRoleModal from '@/components/AssignRoleModal';

// 用户类型映射
const userTypeMap = {
    SUPER_ADMIN: { text: '超级管理员', color: 'red' },
    ADMIN: { text: '管理员', color: 'orange' },
    STAFF: { text: '员工', color: 'blue' },
    CUSTOMER_SERVICE: { text: '客服', color: 'green' },
    OPERATION: { text: '运营', color: 'purple' },
    FINANCE: { text: '财务', color: 'cyan' },
    REGISTERED_USER: { text: '注册用户', color: 'default' },
};

const userStatusMap = {
    ACTIVE: { text: '正常', status: 'success' },
    FROZEN: { text: '冻结', status: 'warning' },
    DISABLED: { text: '禁用', status: 'default' },
};

export default function UsersPage() {
    const access = useAccess();
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [changeLevelModalVisible, setChangeLevelModalVisible] = useState(false);
    const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [availableRatings, setAvailableRatings] = useState<any[]>([]);
    const [assignRoleModalVisible, setAssignRoleModalVisible] = useState(false);
    const actionRef = useRef<any>();

    // 加载可用的员工评级
    useEffect(() => {
        const loadRatings = async () => {
            try {
                const ratings = await getAvailableRatings();
                setAvailableRatings(ratings);
            } catch (error) {
                console.error('加载员工评级失败:', error);
            }
        };
        loadRatings();
    }, []);

    const handleEdit = (record: any) => {
        setEditingUser(record);
        setEditModalVisible(true);
    };

    const handleChangeLevel = (record: any) => {
        setEditingUser(record);  // 使用统一的 editingUser
        setChangeLevelModalVisible(true);
    };

    const handleResetPassword = (record: any) => {
        setEditingUser(record);  // 使用统一的 editingUser
        setResetPasswordModalVisible(true);
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteUser(id);
            message.success('删除成功');
            actionRef.current?.reload();
        } catch (error) {
            message.error('删除失败');
        }
    };

    //分配角色按钮逻辑
    // 在现有处理函数后添加
    const handleAssignRole = (record: any) => {
        setEditingUser(record);
        setAssignRoleModalVisible(true);
    };

    const handleAssignRoleSubmit = async (values: any) => {
        try {
            if (editingUser) {
                await updateUser(editingUser.id, { roleId: values.roleId });
                message.success('角色分配成功');
                setAssignRoleModalVisible(false);
                setEditingUser(null);
                actionRef.current?.reload();
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || '角色分配失败');
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
            title: '手机号',
            dataIndex: 'phone',
            key: 'phone',
            width: 120,
        },
        {
            title: '姓名',
            dataIndex: 'name',
            key: 'name',
            width: 100,
        },
        {
            title: '用户类型',
            dataIndex: 'userType',
            key: 'userType',
            width: 100,
            render: (userType: keyof typeof userTypeMap) => (
                <Tag color={userTypeMap[userType]?.color}>
                    {userTypeMap[userType]?.text}
                </Tag>
            ),
        },
        {
            title: '角色',
            dataIndex: 'Role',
            key: 'role',
            width: 120,
            render: (role: any) => (
                role ? (
                    <Tag color="purple">{role.name}</Tag>
                ) : (
                    <Tag>未分配</Tag>
                )
            ),
        },
        {
            title: '员工评级',
            dataIndex: 'staffRating',
            key: 'rating',
            width: 120,
            render: (staffRating: any) => (
                staffRating ? (
                    <Tooltip title={`适用范围: ${staffRating.scope === 'BOTH' ? '线上线下' : staffRating.scope === 'ONLINE' ? '线上' : '线下'}, 分红比例: ${(staffRating.rate * 100).toFixed(0)}%`}>
                        <Tag color="blue">{staffRating.name}</Tag>
                    </Tooltip>
                ) : (
                    <Tag>未设置</Tag>
                )
            ),
        },
        {
            title: '等级',
            dataIndex: 'level',
            key: 'level',
            width: 80,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 80,
            render: (status: keyof typeof userStatusMap) => (
                <Badge
                    status={userStatusMap[status]?.status as any}
                    text={userStatusMap[status]?.text}
                />
            ),
        },
        {
            title: '最后登录',
            dataIndex: 'lastLoginAt',
            key: 'lastLoginAt',
            width: 120,
            render: (date: string) => {
                if (!date) return '从未登录';
                return dayjs(date).isValid()
                    ? dayjs(date).format('YYYY-MM-DD HH:mm')
                    : '--';
            },
        },
        {
            title: '操作',
            key: 'action',
            width: 200,
            render: (_, record) => (
                // <Space>
                //     {access.canEditUser && (
                //         <Button type="link" size="small" onClick={() => handleEdit(record)}>
                //             编辑
                //         </Button>
                //     )}
                //     {access.canEditUser && (
                //         <Button type="link" size="small" onClick={() => handleAssignRole(record)}>
                //             分配角色
                //         </Button>
                //     )}
                //     {access.canChangeLevel && record?.userType === 'STAFF' && (
                //         <Button type="link" size="small" onClick={() => handleChangeLevel(record)}>
                //             升降级
                //         </Button>
                //     )}
                //     {access.canResetPassword && (
                //         <Button type="link" size="small" onClick={() => handleResetPassword(record)}>
                //             重置密码
                //         </Button>
                //     )}
                //     {access.canDeleteUser && (
                //         <Popconfirm
                //             title="确定删除这个用户吗？"
                //             onConfirm={() => handleDelete(record.id)}
                //             okText="确定"
                //             cancelText="取消"
                //         >
                //             <Button type="link" size="small" danger>
                //                 删除
                //             </Button>
                //         </Popconfirm>
                //     )}
                // </Space>
                <Space>
                    <Button type="link" size="small" onClick={() => handleEdit(record)}>
                        编辑
                    </Button>
                    <Button type="link" size="small" onClick={() => handleAssignRole(record)}>
                        分配角色
                    </Button>
                    <Button type="link" size="small" onClick={() => handleChangeLevel(record)}>
                        升降级
                    </Button>
                    <Button type="link" size="small" onClick={() => handleResetPassword(record)}>
                        重置密码
                    </Button>
                    {/*{access.canDeleteUser && (*/}
                    {/*    <Popconfirm*/}
                    {/*        title="确定删除这个用户吗？"*/}
                    {/*        onConfirm={() => handleDelete(record.id)}*/}
                    {/*        okText="确定"*/}
                    {/*        cancelText="取消"*/}
                    {/*    >*/}
                    {/*        <Button type="link" size="small" danger>*/}
                    {/*            删除*/}
                    {/*        </Button>*/}
                    {/*    </Popconfirm>*/}
                    {/*)}*/}
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
                        const response = await getUsers(params);
                        return {
                            data: response.data,
                            success: true,
                            total: response.total,
                        };
                    } catch (error) {
                        message.error('获取用户列表失败');
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
                    !access.canCreateUser && (
                        <Button
                            key="add"
                            type="primary"
                            onClick={() => setCreateModalVisible(true)}
                        >
                            添加用户
                        </Button>
                    ),
                ]}
                pagination={{
                    pageSize: 10,
                }}
                actionRef={actionRef}
            />

            <CreateUserModal
                visible={createModalVisible}
                availableRatings={availableRatings}
                onCancel={() => setCreateModalVisible(false)}
                onSuccess={() => {
                    setCreateModalVisible(false);
                    actionRef.current?.reload();
                }}
            />

            <EditUserModal
                visible={editModalVisible}
                user={editingUser}
                availableRatings={availableRatings}
                onCancel={() => {
                    setEditModalVisible(false);
                    setEditingUser(null);
                }}
                onSuccess={() => {
                    setEditModalVisible(false);
                    setEditingUser(null);
                    actionRef.current?.reload();
                }}
            />

            {/* 升降级弹窗 */}
            <ChangeLevelModal
                visible={changeLevelModalVisible}
                user={editingUser}
                availableRatings={availableRatings}
                onCancel={() => {
                    setChangeLevelModalVisible(false);
                    setEditingUser(null);
                }}
                onSuccess={() => {
                    setChangeLevelModalVisible(false);
                    setEditingUser(null);
                    message.success('员工评级调整成功');
                    actionRef.current?.reload();
                }}
            />

            {/* 重置密码弹窗 */}
            <ResetPasswordModal
                visible={resetPasswordModalVisible}
                user={editingUser}
                onCancel={() => {
                    setResetPasswordModalVisible(false);
                    setEditingUser(null);
                }}
                onSuccess={() => {
                    setResetPasswordModalVisible(false);
                    setEditingUser(null);
                    actionRef.current?.reload();
                }}
            />
            {/* 角色分配弹窗 */}
            <AssignRoleModal
                visible={assignRoleModalVisible}
                user={editingUser}
                onCancel={() => {
                    setAssignRoleModalVisible(false);
                    setEditingUser(null);
                }}
                onOk={handleAssignRoleSubmit}
            />
        </PageContainer>
    );
}
