import React, { useRef, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Space, Tag, message, Badge } from 'antd';
import { useAccess } from 'umi';
import { getUsers, deleteUser, User } from '@/services/api';
import CreateUserModal from './components/CreateUserModal';
import EditUserModal from './components/EditUserModal';
import ChangeLevelModal from './components/ChangeLevelModal';
import ResetPasswordModal from './components/ResetPasswordModal';

// 用户类型映射和状态映射保持不变...
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
    FROZEN: { text: '冻结', status: 'error' },
    DISABLED: { text: '停用', status: 'default' },
};

export default function UsersPage() {
    const access = useAccess();
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [changeLevelModalVisible, setChangeLevelModalVisible] = useState(false);
    const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [changingLevelUser, setChangingLevelUser] = useState<User | null>(null);
    const [resettingPasswordUser, setResettingPasswordUser] = useState<User | null>(null);
    const actionRef = useRef<any>();

    // 列配置
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
            title: '用户身份',
            dataIndex: 'userType',
            key: 'userType',
            width: 100,
            render: (userType: keyof typeof userTypeMap) => (
                <Tag color={userTypeMap[userType]?.color}>
                    {userTypeMap[userType]?.text}
                </Tag>
            ),
            valueEnum: userTypeMap,
        },
        {
            title: '账号状态',
            dataIndex: 'status',
            key: 'status',
            width: 80,
            render: (status: keyof typeof userStatusMap) => (
                <Badge
                    status={userStatusMap[status]?.status as any}
                    text={userStatusMap[status]?.text}
                />
            ),
            valueEnum: userStatusMap,
        },
        {
            title: '真实姓名',
            dataIndex: 'realName',
            key: 'realName',
            width: 100,
        },
        {
            title: '等级',
            dataIndex: 'level',
            key: 'level',
            width: 80,
            render: (level: number) => <Tag color="blue">Lv.{level}</Tag>,
        },
        {
            title: '评级',
            dataIndex: 'rating',
            key: 'rating',
            width: 80,
            render: (rating: number) => rating ? <Tag color="gold">{rating}星</Tag> : '-',
        },
        {
            title: '余额',
            dataIndex: 'balance',
            key: 'balance',
            width: 100,
            render: (balance: number) => `¥${balance.toFixed(2)}`,
        },
        {
            title: '需重置密码',
            dataIndex: 'needResetPwd',
            key: 'needResetPwd',
            width: 100,
            render: (needResetPwd: boolean) => (
                <Tag color={needResetPwd ? 'red' : 'green'}>
                    {needResetPwd ? '是' : '否'}
                </Tag>
            ),
        },
        {
            title: '注册时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            valueType: 'dateTime',
        },
        {
            title: '操作',
            key: 'action',
            width: 200,
            fixed: 'right',
            render: (_, record: User) => (
                <Space>
                    <Button type="link" size="small" onClick={() => handleEdit(record)}>
                        编辑
                    </Button>
                    {/*{access.canChangeLevel && record.userType === 'STAFF' && (*/}
                    {/*    <Button type="link" size="small" onClick={() => handleChangeLevel(record)}>*/}
                    {/*        升降级*/}
                    {/*    </Button>*/}
                    {/*)}*/}
                    {access.canResetPassword && (
                        <Button type="link" size="small" onClick={() => handleResetPassword(record)}>
                            重置密码
                        </Button>
                    )}
                    {access.canDeleteUser && (
                        <Button
                            type="link"
                            size="small"
                            danger
                            onClick={() => handleDelete(record)}
                        >
                            删除
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    // 操作处理函数
    const handleEdit = (record: User) => {
        setEditingUser(record);
        setEditModalVisible(true);
    };

    const handleChangeLevel = (record: User) => {
        message.info(`调整等级: ${record.name}`);
        // 后续实现等级调整弹窗
    };

    const handleResetPassword = (record: User) => {
        setResettingPasswordUser(record);
        setResetPasswordModalVisible(true);
        // 后续实现重置密码弹窗
    };

    const handleDelete = async (record: User) => {
        if (confirm(`确定要删除用户 ${record.name || record.phone} 吗？`)) {
            try {
                await deleteUser(record.id);
                message.success('删除成功');
                // 刷新表格
                actionRef.current?.reload();
            } catch (error) {
                message.error('删除失败');
            }
        }
    };

    const handleAdd = () => {
        setCreateModalVisible(true);
    };

    const handleCreateSuccess = () => {
        setCreateModalVisible(false);
        message.success('用户创建成功');
        // 刷新表格
        actionRef.current?.reload();
    };

    const handleCreateCancel = () => {
        setCreateModalVisible(false);
    };

    const handleEditSuccess = () => {
        setEditModalVisible(false);
        setEditingUser(null);
        message.success('用户信息更新成功');
        actionRef.current?.reload();
    };

    const handleEditCancel = () => {
        setEditModalVisible(false);
        setEditingUser(null);
    };

    const handleChangeLevelSuccess = () => {
        setChangeLevelModalVisible(false);
        setChangingLevelUser(null);
        message.success('员工等级调整成功');
        actionRef.current?.reload();
    };

    const handleChangeLevelCancel = () => {
        setChangeLevelModalVisible(false);
        setChangingLevelUser(null);
    };

    const handleResetPasswordSuccess = () => {
        setResetPasswordModalVisible(false);
        setResettingPasswordUser(null);
        // 成功消息在弹窗内显示
        actionRef.current?.reload();
    };

    const handleResetPasswordCancel = () => {
        setResetPasswordModalVisible(false);
        setResettingPasswordUser(null);
    };

    return (
        <PageContainer>
            <ProTable<User>
                columns={columns}
                request={async (params) => {
                    try {

                        const { current, pageSize, ...rest } = params;
                        const query = {
                            page: current ?? 1,
                            limit: pageSize ?? 10,
                            ...rest, // search 表单字段会在这里（例如 search/userType/status）
                        };
                        const response = await getUsers(query);
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
                    defaultCollapsed: false,
                }}
                toolBarRender={() => [
                    access.canCreateUser && (
                        <Button key="add" type="primary" onClick={handleAdd}>
                            添加用户
                        </Button>
                    ),
                ]}
                scroll={{ x: 1300 }}
                pagination={{
                    showSizeChanger: true,
                    showQuickJumper: true,
                    pageSize: 20,
                }}
                actionRef={actionRef}
            />

            {/* 添加用户弹窗 */}
            <CreateUserModal
                visible={createModalVisible}
                onCancel={handleCreateCancel}
                onSuccess={handleCreateSuccess}
            />
            {/* 编辑用户弹窗 */}
            <EditUserModal
                visible={editModalVisible}
                user={editingUser}
                onCancel={handleEditCancel}
                onSuccess={handleEditSuccess}
            />

            {/* 升降级弹窗 */}
            <ChangeLevelModal
                visible={changeLevelModalVisible}
                user={changingLevelUser}
                onCancel={handleChangeLevelCancel}
                onSuccess={handleChangeLevelSuccess}
            />

            {/* 重置密码弹窗 */}
            <ResetPasswordModal
                visible={resetPasswordModalVisible}
                user={resettingPasswordUser}
                onCancel={handleResetPasswordCancel}
                onSuccess={handleResetPasswordSuccess}
            />
        </PageContainer>
    );
}
