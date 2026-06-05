import React, {useEffect, useRef, useState} from 'react';
import {PageContainer, ProTable} from '@ant-design/pro-components';
import {Badge, Button, message, Popconfirm, Space, Tag, Tooltip, Card, Statistic, Row, Col, Switch, Modal} from 'antd';
import {useAccess, useLocation} from 'umi';
import dayjs from 'dayjs';
import {deleteUser, getAvailableRatings, getUsers, getWalletStatistics, updateUser} from '@/services/api';
import CreateUserModal from './components/CreateUserModal';
import EditUserModal from './components/EditUserModal';
import ChangeLevelModal from './components/ChangeLevelModal';
import ResetPasswordModal from './components/ResetPasswordModal';
import AssignRoleModal from '@/components/AssignRoleModal';
import UserWalletDrawer from './components/UserWalletDrawer';

const formatDaysAgo = (date?: string) => {
    if (!date) return '从未';

    const diff = dayjs().diff(dayjs(date), 'day');

    if (diff <= 0) return '今天';

    return `${diff || '-'}天前`;
};
// 用户类型映射
const userTypeMap = {
    SUPER_ADMIN: { text: '超级管理员', color: 'red' },
    ADMIN: { text: '管理员', color: 'orange' },
    STAFF: { text: '员工', color: 'blue' },
    CUSTOMER_SERVICE: { text: '客服', color: 'green' },
    OPERATION: { text: '运营', color: 'purple' },
    FINANCE: { text: '财务', color: 'cyan' },
    REGISTERED_USER: { text: '会员', color: 'default' },
};

const userStatusMap = {
    ACTIVE: { text: '正常', status: 'success' },
    FROZEN: { text: '冻结', status: 'warning' },
    DISABLED: { text: '禁用', status: 'default' },
};

export default function UsersPage() {
    const access = useAccess();
    const location = useLocation();
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [changeLevelModalVisible, setChangeLevelModalVisible] = useState(false);
    const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [availableRatings, setAvailableRatings] = useState<any[]>([]);
    const [assignRoleModalVisible, setAssignRoleModalVisible] = useState(false);
    const actionRef = useRef<any>();
    const [walletVisible, setWalletVisible] = useState(false);
    const [walletUser, setWalletUser] = useState<any>(null);
    const [walletStats, setWalletStats] = useState<any>(null);

    const sceneMap: Record<string, { key: string; title: string; defaultUserType?: string; showStaffRating?: boolean; showWorkMetrics?: boolean }> = {
        '/users/members': { key: 'MEMBER', title: '会员管理', defaultUserType: 'REGISTERED_USER', showStaffRating: false, showWorkMetrics: false },
        '/users/staff': { key: 'STAFF', title: '打手管理', defaultUserType: 'STAFF', showStaffRating: true, showWorkMetrics: true },
        '/users/internal': { key: 'INTERNAL', title: '后台人员管理', showStaffRating: false, showWorkMetrics: false },
        '/users/all': { key: 'ALL', title: '全部用户', showStaffRating: true, showWorkMetrics: true },
    };

    const sceneConfig = sceneMap[location.pathname] || sceneMap['/users/members'];

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

    useEffect(() => {
        loadWalletStats();
    }, []);

    const loadWalletStats = async () => {
        try {
            const res = await getWalletStatistics();
            setWalletStats(res);
        } catch (e) {
            console.error('加载钱包统计失败');
        }
    };

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

    const openWallet = (record: any) => {
        setWalletUser(record);
        setWalletVisible(true);
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
            title: '搜索',
            dataIndex: 'search',
            hideInTable: true,
            valueType: 'text',
            fieldProps: {
                placeholder: 'ID / 手机号 / 姓名',
            },
        },
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            search: false,
            width: 60,
        },
        {
            title: '手机号',
            dataIndex: 'phone',
            search: false,
            key: 'phone',
            width: 120,
        },
        {
            title: '姓名',
            dataIndex: 'name',
            search: false,
            key: 'name',
            width: 100,
        },
        sceneConfig.key === 'ALL' ? {
            title: '用户类型',
            dataIndex: 'userType',
            key: 'userType',
            width: 100,
            valueType: 'select',
            valueEnum: {
                STAFF: { text: '员工' },
                SUPER_ADMIN: { text: '超级管理员' },
                OPERATION: { text: '运营' },
                FINANCE: { text: '财务' },
                CUSTOMER_SERVICE: { text: '客服' },
                REGISTERED_USER: { text: '普通用户' },
                ADMIN: { text: '管理员' },
            },

            // ✅ 默认筛选“员工”
            initialValue: 'STAFF',
            render: (_, record) => (
                <Tag color={userTypeMap[record.userType as keyof typeof userTypeMap]?.color}>
                    {userTypeMap[record.userType as keyof typeof userTypeMap]?.text}
                </Tag>
            )
        } : null,
        {
            title: '角色',
            dataIndex: 'Role',
            key: 'role',
            search: false,
            width: 120,
            render: (role: any) => (
                role ? (
                    <Tag color="purple">{role.name}</Tag>
                ) : (
                    <Tag>未分配</Tag>
                )
            ),
        },
        sceneConfig.showStaffRating ? {
            title: '员工评级',
            dataIndex: 'staffRating',
            key: 'rating',
            search: false,
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
        } : null,
        {
            title: '等级',
            dataIndex: 'level',
            key: 'level',
            search: false,
            width: 80,
        },
        {
            title: '微信绑定',
            dataIndex: 'wechatBindings',
            key: 'wechatBindings',
            width: 180,
            search: false,
            render: (bindings: any[]) => {
                const first = Array.isArray(bindings) ? bindings[0] : null;
                if (!first) return <Tag>未绑定</Tag>;
                return (
                    <div style={{ lineHeight: '18px' }}>
                        <div>
                            <Tag color="green">已绑定微信</Tag>
                        </div>
                        <div style={{ color: '#666', fontSize: 12 }}>
                            openId: {String(first.openId || '').slice(0, 8)}...
                        </div>
                        <div style={{ color: '#999', fontSize: 12 }}>
                            unionId: {first.unionId ? `${String(first.unionId).slice(0, 8)}...` : '无'}
                        </div>
                    </div>
                );
            },
        },
        {
            title: '会员资产',
            key: 'memberAssets',
            width: 180,
            search: false,
            render: (_, record) => {
                const profile = record?.memberProfile || {};
                const points = Number(record?.memberPointAccount?.availablePoints ?? 0);
                return (
                    <div style={{ lineHeight: '18px' }}>
                        <div style={{ color: '#1677ff', fontSize: 12 }}>
                            {profile?.levelCode || 'NONE'} / {profile?.memberCode || '-'}
                        </div>
                        <div style={{ color: '#666', fontSize: 12 }}>
                            积分 {points}
                        </div>
                        <div style={{ color: '#999', fontSize: 12 }}>
                            累充 ¥{Number(profile?.totalRechargeAmount ?? 0).toFixed(2)}
                        </div>
                    </div>
                );
            },
        },
        // {
        //     title: '钱包',
        //     key: 'wallet',
        //     width: 120,
        //     search: false,
        //     render: (_, record) => {
        //         const balance = record?.wallet?.totalBalance ?? 0;
        //
        //         return (
        //             <Button
        //                 type="link"
        //                 onClick={() => openWallet(record)}
        //             >
        //                 ¥{Number(balance).toFixed(1)}
        //             </Button>
        //         );
        //     }
        // },
        {
            title: '钱包',
            key: 'wallet',
            width: 140,
            search: false,
            render: (_, record) => {

                const available = Number(record?.wallet?.availableBalance ?? 0);
                const frozen = Number(record?.wallet?.frozenBalance ?? 0);

                return (
                    <div
                        style={{ cursor: 'pointer', lineHeight: '18px' }}
                        onClick={() => openWallet(record)}
                    >
                        <div style={{ color: '#1677ff', fontSize: 12 }}>
                            可用 ¥{available.toFixed(1)}
                        </div>

                        <div style={{ color: '#faad14', fontSize: 12 }}>
                            冻结 ¥{frozen.toFixed(1)}
                        </div>
                    </div>
                );
            },
        },
        {
            title: '押金阈值',
            dataIndex: 'depositLimit',
            width: 120,
            search: false,
            render: (v) => (
                <Tag color="gold">
                    ¥{Number(v ?? 500)}
                </Tag>
            ),
        },
        {
            title: '允许提现',
            dataIndex: 'canWithdraw',
            width: 90,
            search: false,
            render: (value: boolean, record: any) => (
                <Switch
                    checked={value}
                    checkedChildren="开"
                    unCheckedChildren="关"
                    onChange={(checked) => {
                        Modal.confirm({
                            title: checked ? '确认开启提现权限？' : '确认关闭提现权限？',
                            onOk: () => handleToggleWithdraw(record, checked),
                        });
                    }}
                />
            ),
        },
        {
            title: '账号状态',
            dataIndex: 'status',
            key: 'status',
            width: 80,
            // ✅ 搜索栏改成下拉
            valueType: 'select',
            valueEnum: {
                ACTIVE: { text: '正常' },
                FROZEN: { text: '冻结' },
                DISABLED: { text: '禁用' },
            },

            // ✅ 默认筛选“正常”
            initialValue: 'ACTIVE',
            render: (_, record) => (
                <Badge
                    status={userStatusMap[record.status as keyof typeof userStatusMap]?.status as any}
                    text={userStatusMap[record.status as keyof typeof userStatusMap]?.text}
                />
            ),
        },
        {
            title: '最后登录',
            dataIndex: 'lastLoginAt',
            width: 120,
            search: false,
            render: (date: string) => {

                if (!date) return '从未';

                return (
                    <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm')}>
                        {formatDaysAgo(date)}
                    </Tooltip>
                );
            },
        },
        sceneConfig.showWorkMetrics ? {
            title: '最后接单',
            dataIndex: 'lastAcceptOrderAt',
            width: 120,
            search: false,
            render: (date: string) => {

                if (!date) return '从未';

                return (
                    <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm')}>
                        {formatDaysAgo(date)}
                    </Tooltip>
                );
            },
        } : null,
        {
            title: '未登录天数',
            dataIndex: 'loginInactiveDays',
            hideInTable: true,
            valueType: 'select',
            fieldProps: {
                options: [
                    { label: '3天未登录', value: 3 },
                    { label: '7天未登录', value: 7 },
                    { label: '15天未登录', value: 15 },
                    { label: '30天未登录', value: 30 },
                ],
            },
        },
        sceneConfig.showWorkMetrics ? {
            title: '未接单天数',
            dataIndex: 'acceptInactiveDays',
            hideInTable: true,
            valueType: 'select',
            fieldProps: {
                options: [
                    { label: '3天未接单', value: 3 },
                    { label: '7天未接单', value: 7 },
                    { label: '15天未接单', value: 15 },
                    { label: '30天未接单', value: 30 },
                ],
            },
        } : null,
        {
            title: '操作',
            key: 'action',
            search: false,
            width: 200,
            render: (_, record) => (
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
    ].filter(Boolean);

    const handleToggleWithdraw = async (record: any, checked: boolean) => {
        try {
            await updateUser(record.id, {
                canWithdraw: checked,
            });

            message.success(checked ? '已开启提现权限' : '已关闭提现权限');
            actionRef.current?.reload();
        } catch (error) {
            message.error('更新失败');
        }
    };

    return (
        <PageContainer title={sceneConfig.title}>
            <Row gutter={16} style={{ marginBottom: 20 }}>

                <Col span={8}>
                    <Card>
                        <Statistic
                            title="总可用余额"
                            value={walletStats?.totalAvailableBalance ?? 0}
                            precision={1}
                            prefix="¥"
                        />
                    </Card>
                </Col>

                <Col span={8}>
                    <Card>
                        <Statistic
                            title="总冻结余额"
                            value={walletStats?.totalFrozenBalance ?? 0}
                            precision={1}
                            prefix="¥"
                        />
                    </Card>
                </Col>

                <Col span={8}>
                    <Card>
                        <Statistic
                            title="钱包总余额"
                            value={walletStats?.totalBalance ?? 0}
                            precision={1}
                            prefix="¥"
                        />
                    </Card>
                </Col>

            </Row>
            <ProTable
                columns={columns}
                request={async (params) => {
                    try {
                        const { current, pageSize, ...rest } = params;
                        const query = {
                            page: current ?? 1,
                            limit: pageSize ?? 10,
                            scene: sceneConfig.key,
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
                    pageSize: 20,
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
            <UserWalletDrawer
                visible={walletVisible}
                user={walletUser}
                onClose={() => {
                    setWalletVisible(false);
                    setWalletUser(null);
                }}
            />
        </PageContainer>
    );
}
