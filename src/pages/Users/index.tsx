import React, {useEffect, useRef, useState} from 'react';
import {PageContainer, ProTable} from '@ant-design/pro-components';
import {Badge, Button, message, Popconfirm, Space, Tag, Tooltip, Card, Statistic, Row, Col, Switch, Modal, Drawer, Descriptions, List, Form, Select, Checkbox, Input, Divider, InputNumber} from 'antd';
import {useAccess, useLocation} from 'umi';
import dayjs from 'dayjs';
import {adjustMemberGrowth, clearStaffAssets, createUserMemberGameCard, deleteUser, deleteUserMemberGameCard, exitStaffShop, getAvailableRatings, getCouponTemplates, getMemberRechargePlans, getStaffExitPreview, getStaffRuleEngineConfig, getStaffWalletStatistics, getUserById, getUserMemberGameCards, getUsers, manualMemberRecharge, setUserMemberGameCardPrimary, updateUser} from '@/services/api';
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

const renderReviewSummary = (record: any) => {
    const avg = Number(record?.reviewStats?.averageScore ?? 0);
    const count = Number(record?.reviewStats?.reviewCount ?? 0);
    if (!count) return <Tag>暂无评价</Tag>;
    return (
        <div style={{ lineHeight: '18px' }}>
            <div style={{ color: '#1677ff', fontSize: 12, fontWeight: 600 }}>
                {avg.toFixed(1)} 分
            </div>
            <div style={{ color: '#666', fontSize: 12 }}>
                共 {count} 条评价
            </div>
        </div>
    );
};

const renderRecentReviews = (record: any) => {
    const rows = Array.isArray(record?.recentReviews) ? record.recentReviews : [];
    if (!rows.length) return <Tag>暂无历史评价</Tag>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.slice(0, 3).map((item: any, idx: number) => (
                <div key={`${record?.id || 'user'}_${item?.orderId || idx}_${idx}`} style={{ padding: '6px 8px', background: '#fafafa', borderRadius: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ color: '#1677ff', fontSize: 12 }}>
                            {item?.ratingLabel || '评价'} · {Number(item?.score || 0).toFixed(1)} 分
                        </span>
                        <span style={{ color: '#999', fontSize: 12 }}>
                            {item?.createdAt ? dayjs(item.createdAt).format('MM-DD HH:mm') : '-'}
                        </span>
                    </div>
                    <div style={{ color: '#333', fontSize: 12, marginTop: 4 }}>
                        {String(item?.reviewRemark || '').trim() || '用户未填写文字评价'}
                    </div>
                </div>
            ))}
        </div>
    );
};

const isAnonymousUserRecord = (record: any) => {
    const phone = String(record?.phone || '').trim().toLowerCase();
    const name = String(record?.name || '').trim();
    return phone.startsWith('guest_') || name.startsWith('访客');
};

const getStaffEmploymentTag = (record: any) => {
    const status = String(record?.staffEmploymentStatus || 'ACTIVE');
    if (record?.userType !== 'STAFF' || status === 'ACTIVE') return null;
    if (status === 'BLACKLISTED') {
        return <Tag color="red">黑名单陪玩</Tag>;
    }
    if (status === 'FROZEN') {
        return <Tag color="orange">冻结中</Tag>;
    }
    return <Tag color="default">退店用户</Tag>;
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
    const [memberDetailVisible, setMemberDetailVisible] = useState(false);
    const [memberDetailLoading, setMemberDetailLoading] = useState(false);
    const [memberDetail, setMemberDetail] = useState<any>(null);
    const [memberGameCardVisible, setMemberGameCardVisible] = useState(false);
    const [memberGameCards, setMemberGameCards] = useState<any[]>([]);
    const [memberGameCardCategories, setMemberGameCardCategories] = useState<any[]>([]);
    const [memberGameCardSubmitting, setMemberGameCardSubmitting] = useState(false);
    const [memberGameCardForm] = Form.useForm();
    const [memberRechargeVisible, setMemberRechargeVisible] = useState(false);
    const [memberRechargeSubmitting, setMemberRechargeSubmitting] = useState(false);
    const [memberRechargePlans, setMemberRechargePlans] = useState<any[]>([]);
    const [memberCouponTemplateOptions, setMemberCouponTemplateOptions] = useState<Array<{ label: string; value: number }>>([]);
    const [memberRechargeForm] = Form.useForm();
    const [memberGrowthVisible, setMemberGrowthVisible] = useState(false);
    const [memberGrowthSubmitting, setMemberGrowthSubmitting] = useState(false);
    const [memberGrowthForm] = Form.useForm();
    const [staffExitVisible, setStaffExitVisible] = useState(false);
    const [staffExitLoading, setStaffExitLoading] = useState(false);
    const [staffExitUser, setStaffExitUser] = useState<any>(null);
    const [staffExitPreview, setStaffExitPreview] = useState<any>(null);
    const [staffExitForm] = Form.useForm();
    const [staffClearVisible, setStaffClearVisible] = useState(false);
    const [staffClearLoading, setStaffClearLoading] = useState(false);
    const [staffClearUser, setStaffClearUser] = useState<any>(null);
    const [staffClearForm] = Form.useForm();
    const [staffTagOptions, setStaffTagOptions] = useState<Array<{ label: string; value: string }>>([]);

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
        if (sceneConfig.key === 'MEMBER') {
            setStaffTagOptions([]);
            return;
        }
        const loadStaffRuleEngine = async () => {
            try {
                const config = await getStaffRuleEngineConfig();
                const tags = Array.isArray(config?.tags) ? config.tags : [];
                setStaffTagOptions(
                    tags
                        .filter((item: any) => item?.enabled !== false)
                        .map((item: any) => ({ label: item?.name || item?.code, value: item?.code })),
                );
            } catch (error) {
                console.error('加载员工标签失败:', error);
            }
        };
        loadStaffRuleEngine();
    }, [sceneConfig.key]);

    useEffect(() => {
        if (sceneConfig.key === 'STAFF') {
            loadWalletStats();
            return;
        }
        setWalletStats(null);
    }, [sceneConfig.key]);

    const loadWalletStats = async () => {
        try {
            const res = await getStaffWalletStatistics();
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

    const openStaffExit = async (record: any) => {
        try {
            setStaffExitLoading(true);
            const preview = await getStaffExitPreview(Number(record.id));
            setStaffExitUser(record);
            setStaffExitPreview(preview);
            staffExitForm.setFieldsValue({
                mode: 'RELEASE_TO_AVAILABLE',
                addToBlacklist: false,
            });
            setStaffExitVisible(true);
        } catch (error: any) {
            message.error(error?.response?.data?.message || '加载退店预览失败');
        } finally {
            setStaffExitLoading(false);
        }
    };

    const handleStaffExitSubmit = async () => {
        try {
            const values = await staffExitForm.validateFields();
            if (!staffExitUser?.id) return;
            setStaffExitLoading(true);
            await exitStaffShop(Number(staffExitUser.id), values);
            message.success('退店处理成功');
            setStaffExitVisible(false);
            setStaffExitUser(null);
            setStaffExitPreview(null);
            staffExitForm.resetFields();
            actionRef.current?.reload();
            if (sceneConfig.key === 'STAFF') {
                loadWalletStats();
            }
        } catch (error: any) {
            if (!error?.errorFields) {
                message.error(error?.response?.data?.message || '退店处理失败');
            }
        } finally {
            setStaffExitLoading(false);
        }
    };

    const openStaffClear = async (record: any) => {
        setStaffClearUser(record);
        staffClearForm.setFieldsValue({
            addToBlacklist: false,
            remark: '',
        });
        setStaffClearVisible(true);
    };

    const handleStaffClearSubmit = async () => {
        try {
            const values = await staffClearForm.validateFields();
            if (!staffClearUser?.id) return;
            setStaffClearLoading(true);
            await clearStaffAssets(Number(staffClearUser.id), values);
            message.success('清退处理成功');
            setStaffClearVisible(false);
            setStaffClearUser(null);
            staffClearForm.resetFields();
            actionRef.current?.reload();
            if (sceneConfig.key === 'STAFF') {
                loadWalletStats();
            }
        } catch (error: any) {
            if (!error?.errorFields) {
                message.error(error?.response?.data?.message || '清退处理失败');
            }
        } finally {
            setStaffClearLoading(false);
        }
    };

    const openWallet = (record: any) => {
        setWalletUser(record);
        setWalletVisible(true);
    };

    const loadMemberGameCardData = async (userId: number) => {
        const res = await getUserMemberGameCards(userId);
        setMemberGameCards(Array.isArray(res?.cards) ? res.cards : []);
        setMemberGameCardCategories(Array.isArray(res?.categories) ? res.categories : []);
    };

    const loadMemberDetailData = async (userId: number) => {
        const [detail] = await Promise.all([
            getUserById(userId),
            loadMemberGameCardData(userId),
        ]);
        setMemberDetail(detail);
    };

    const loadMemberBenefitOptions = async () => {
        const [plansRes, couponRes]: any = await Promise.all([
            getMemberRechargePlans(),
            getCouponTemplates({ page: 1, limit: 200, status: 'ACTIVE' }),
        ]);
        const plans = Array.isArray(plansRes) ? plansRes : [];
        const coupons = Array.isArray(couponRes?.data) ? couponRes.data : [];
        setMemberRechargePlans(plans.filter((item: any) => item?.enabled !== false));
        setMemberCouponTemplateOptions(
            coupons.map((item: any) => ({
                value: Number(item.id),
                label: `${item.name} #${item.id}`,
            })),
        );
    };

    const openMemberRecharge = async () => {
        if (!memberDetail?.id) return;
        try {
            await loadMemberBenefitOptions();
            memberRechargeForm.resetFields();
            memberRechargeForm.setFieldsValue({
                userId: Number(memberDetail.id),
                amount: undefined,
                bonusAmount: 0,
                giftPoints: 0,
                giftGrowthValue: 0,
                couponBenefitTemplateIds: [],
                remark: '',
            });
            setMemberRechargeVisible(true);
        } catch (_e) {
            message.error('加载充值方案失败');
        }
    };

    const handleMemberRechargePlanChange = (planId: number) => {
        const plan = memberRechargePlans.find((item: any) => Number(item?.id) === Number(planId));
        if (!plan) return;
        memberRechargeForm.setFieldsValue({
            amount: Number(plan?.amount ?? 0),
            bonusAmount: Number(plan?.bonusAmount ?? 0),
            giftPoints: Number(plan?.giftPoints ?? 0),
            giftGrowthValue: Number(plan?.giftGrowthValue ?? 0),
            couponBenefitTemplateIds: (Array.isArray(plan?.couponBenefits) ? plan.couponBenefits : [])
                .map((item: any) => Number(item?.templateId))
                .filter((id: number) => Number.isFinite(id) && id > 0),
        });
    };

    const submitMemberRecharge = async () => {
        try {
            const values = await memberRechargeForm.validateFields();
            if (!memberDetail?.id) return;
            setMemberRechargeSubmitting(true);
            await manualMemberRecharge({
                userId: Number(memberDetail.id),
                planId: values?.planId ? Number(values.planId) : undefined,
                amount: values?.amount != null ? Number(values.amount) : undefined,
                bonusAmount: values?.bonusAmount != null ? Number(values.bonusAmount) : undefined,
                giftPoints: values?.giftPoints != null ? Number(values.giftPoints) : undefined,
                giftGrowthValue: values?.giftGrowthValue != null ? Number(values.giftGrowthValue) : undefined,
                couponBenefits: Array.isArray(values?.couponBenefitTemplateIds)
                    ? values.couponBenefitTemplateIds.map((templateId: number) => ({ templateId: Number(templateId), count: 1 }))
                    : [],
                remark: values?.remark ? String(values.remark).trim() : undefined,
            });
            message.success('会员手动充值成功');
            setMemberRechargeVisible(false);
            memberRechargeForm.resetFields();
            await loadMemberDetailData(Number(memberDetail.id));
            actionRef.current?.reload?.();
        } catch (error: any) {
            if (!error?.errorFields) {
                message.error(error?.response?.data?.message || '会员手动充值失败');
            }
        } finally {
            setMemberRechargeSubmitting(false);
        }
    };

    const openMemberGrowthAdjust = () => {
        if (!memberDetail?.id) return;
        memberGrowthForm.resetFields();
        memberGrowthForm.setFieldsValue({
            growthValue: 0,
            remark: '',
        });
        setMemberGrowthVisible(true);
    };

    const submitMemberGrowthAdjust = async () => {
        try {
            const values = await memberGrowthForm.validateFields();
            if (!memberDetail?.id) return;
            setMemberGrowthSubmitting(true);
            await adjustMemberGrowth({
                userId: Number(memberDetail.id),
                growthValue: Number(values.growthValue),
                remark: values?.remark ? String(values.remark).trim() : undefined,
            });
            message.success('会员成长值已更新');
            setMemberGrowthVisible(false);
            memberGrowthForm.resetFields();
            await loadMemberDetailData(Number(memberDetail.id));
            actionRef.current?.reload?.();
        } catch (error: any) {
            if (!error?.errorFields) {
                message.error(error?.response?.data?.message || '成长值调整失败');
            }
        } finally {
            setMemberGrowthSubmitting(false);
        }
    };

    const openMemberDetail = async (record: any) => {
        try {
            setMemberDetailVisible(true);
            setMemberDetailLoading(true);
            await loadMemberDetailData(Number(record.id));
        } catch (e) {
            message.error('加载会员详情失败');
        } finally {
            setMemberDetailLoading(false);
        }
    };

    const openMemberGameCardModal = () => {
        memberGameCardForm.setFieldsValue({
            gameCategoryId: undefined,
            gameUniqueId: '',
            gameNickname: '',
            isPrimary: memberGameCards.length <= 0,
        });
        setMemberGameCardVisible(true);
    };

    const handleCreateMemberGameCard = async () => {
        try {
            if (!memberDetail?.id) return;
            const values = await memberGameCardForm.validateFields();
            setMemberGameCardSubmitting(true);
            await createUserMemberGameCard(Number(memberDetail.id), values);
            message.success('游戏名片新增成功');
            setMemberGameCardVisible(false);
            memberGameCardForm.resetFields();
            await loadMemberGameCardData(Number(memberDetail.id));
        } catch (error: any) {
            if (!error?.errorFields) {
                message.error(error?.response?.data?.message || '新增游戏名片失败');
            }
        } finally {
            setMemberGameCardSubmitting(false);
        }
    };

    const handleSetPrimaryGameCard = async (cardId: number) => {
        try {
            if (!memberDetail?.id) return;
            await setUserMemberGameCardPrimary(Number(memberDetail.id), cardId);
            message.success('已设为主要游戏名片');
            await loadMemberGameCardData(Number(memberDetail.id));
        } catch (error: any) {
            message.error(error?.response?.data?.message || '设置主要游戏名片失败');
        }
    };

    const handleDeleteGameCard = async (cardId: number) => {
        try {
            if (!memberDetail?.id) return;
            await deleteUserMemberGameCard(Number(memberDetail.id), cardId);
            message.success('游戏名片已删除');
            await loadMemberGameCardData(Number(memberDetail.id));
        } catch (error: any) {
            message.error(error?.response?.data?.message || '删除游戏名片失败');
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
            title: '搜索',
            dataIndex: 'search',
            hideInTable: true,
            valueType: 'text',
            fieldProps: {
                placeholder: 'ID / 手机号 / 姓名',
            },
        },
        {
            title: '匿名用户',
            dataIndex: 'anonymousOnly',
            hideInTable: true,
            valueType: 'select',
            fieldProps: {
                options: [
                    { label: '全部用户', value: 'false' },
                    { label: '仅匿名用户', value: 'true' },
                ],
            },
            initialValue: 'false',
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
            fixed: 'left',
            render: (_: any, record: any) => (
                <Space size={4}>
                    <span>{record?.phone || '-'}</span>
                    {isAnonymousUserRecord(record) ? <Tag color="volcano">匿名</Tag> : null}
                </Space>
            ),
        },
        {
            title: '姓名',
            dataIndex: 'name',
            search: false,
            key: 'name',
            width: 100,
            fixed: 'left',
            render: (_: any, record: any) => (
                <Space size={4} wrap>
                    <span>{record?.name || '-'}</span>
                    {getStaffEmploymentTag(record)}
                </Space>
            ),
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
            title: '会员编码',
            dataIndex: ['memberProfile', 'memberCode'],
            key: 'memberCode',
            search: false,
            width: 130,
            hideInTable: sceneConfig.key !== 'MEMBER',
            render: (_: any, record: any) => record?.memberProfile?.memberCode || '-',
        },
        {
            title: '会员等级',
            dataIndex: ['memberProfile', 'levelCode'],
            key: 'memberLevel',
            search: false,
            width: 100,
            hideInTable: sceneConfig.key !== 'MEMBER',
            render: (_: any, record: any) => <Tag color="gold">{record?.memberProfile?.levelCode || 'NONE'}</Tag>,
        },
        {
            title: '储值余额',
            dataIndex: ['wallet', 'availableBalance'],
            key: 'memberWallet',
            search: false,
            width: 120,
            hideInTable: sceneConfig.key !== 'MEMBER',
            render: (_: any, record: any) => `¥${Number(record?.wallet?.availableBalance ?? 0).toFixed(2)}`,
        },
        {
            title: '积分',
            dataIndex: ['memberPointAccount', 'availablePoints'],
            key: 'memberPoints',
            search: false,
            width: 90,
            hideInTable: sceneConfig.key !== 'MEMBER',
            render: (_: any, record: any) => Number(record?.memberPointAccount?.availablePoints ?? 0),
        },
        {
            title: '成长值',
            dataIndex: ['memberProfile', 'annualContribution'],
            key: 'memberGrowth',
            search: false,
            width: 100,
            hideInTable: sceneConfig.key !== 'MEMBER',
            render: (_: any, record: any) => Number(record?.memberProfile?.annualContribution ?? 0),
        },
        {
            title: '累计充值',
            dataIndex: ['memberProfile', 'totalRechargeAmount'],
            key: 'totalRechargeAmount',
            search: false,
            width: 120,
            hideInTable: sceneConfig.key !== 'MEMBER',
            render: (_: any, record: any) => `¥${Number(record?.memberProfile?.totalRechargeAmount ?? 0).toFixed(2)}`,
        },
        {
            title: '累计消费',
            dataIndex: ['memberProfile', 'totalConsumeAmount'],
            key: 'totalConsumeAmount',
            search: false,
            width: 120,
            hideInTable: sceneConfig.key !== 'MEMBER',
            render: (_: any, record: any) => `¥${Number(record?.memberProfile?.totalConsumeAmount ?? 0).toFixed(2)}`,
        },
        {
            title: '最近充值',
            dataIndex: ['memberProfile', 'lastRechargeAt'],
            key: 'lastRechargeAt',
            search: false,
            width: 140,
            hideInTable: sceneConfig.key !== 'MEMBER',
            render: (_: any, record: any) => record?.memberProfile?.lastRechargeAt ? dayjs(record.memberProfile.lastRechargeAt).format('YYYY-MM-DD HH:mm') : '-',
        },
        {
            title: '角色',
            dataIndex: 'Role',
            key: 'role',
            search: false,
            width: 120,
            hideInTable: sceneConfig.key === 'MEMBER',
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
        sceneConfig.showWorkMetrics ? {
            title: '综合评分',
            dataIndex: 'reviewStats',
            key: 'reviewStats',
            search: false,
            width: 110,
            render: (_: any, record: any) => renderReviewSummary(record),
        } : null,
        sceneConfig.showWorkMetrics ? {
            title: '历史评价',
            dataIndex: 'recentReviews',
            key: 'recentReviews',
            search: false,
            width: 260,
            render: (_: any, record: any) => {
                const rows = Array.isArray(record?.recentReviews) ? record.recentReviews : [];
                if (!rows.length) return <Tag>暂无历史评价</Tag>;
                return (
                    <Tooltip
                        placement="left"
                        title={<div style={{ maxWidth: 360 }}>{renderRecentReviews(record)}</div>}
                    >
                        <div style={{ lineHeight: '18px', cursor: 'pointer' }}>
                            <div style={{ color: '#333', fontSize: 12 }}>
                                {String(rows[0]?.reviewRemark || '').trim() || `${rows[0]?.ratingLabel || '评价'} · ${Number(rows[0]?.score || 0).toFixed(1)} 分`}
                            </div>
                            <div style={{ color: '#999', fontSize: 12 }}>
                                最近 {rows.length} 条，悬停查看
                            </div>
                        </div>
                    </Tooltip>
                );
            },
        } : null,
        {
            title: '等级',
            dataIndex: 'level',
            key: 'level',
            search: false,
            width: 80,
            hideInTable: sceneConfig.key === 'MEMBER',
        },
        {
            title: '微信绑定',
            dataIndex: 'wechatBindings',
            key: 'wechatBindings',
            width: 180,
            search: false,
            hideInTable: sceneConfig.key === 'MEMBER',
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
            title: '员工标签',
            dataIndex: 'staffTags',
            width: 180,
            search: false,
            hideInTable: sceneConfig.key === 'MEMBER',
            render: (tags: string[]) => {
                const rows = Array.isArray(tags) ? tags : [];
                if (!rows.length) return <Tag>未设置</Tag>;
                return (
                    <Space size={4} wrap>
                        {rows.map((item) => <Tag key={item}>{item}</Tag>)}
                    </Space>
                );
            },
        },
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
            dataIndex: 'matchedDepositAmount',
            width: 120,
            search: false,
            hideInTable: sceneConfig.key === 'MEMBER',
            render: (v, record) => (
                <Tag color="gold">
                    ¥{Number(v ?? record?.depositLimit ?? 500)}
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
            title: sceneConfig.key === 'STAFF' ? '员工状态' : '账号状态',
            dataIndex: sceneConfig.key === 'STAFF' ? 'staffEmploymentStatus' : 'status',
            key: sceneConfig.key === 'STAFF' ? 'staffEmploymentStatus' : 'status',
            width: 80,
            valueType: 'select',
            valueEnum: sceneConfig.key === 'STAFF'
                ? {
                    ACTIVE: { text: '正常' },
                    FROZEN: { text: '冻结' },
                    EXITED: { text: '退店' },
                    BLACKLISTED: { text: '黑名单' },
                }
                : {
                    ACTIVE: { text: '正常' },
                    DISABLED: { text: '禁用' },
                },

            initialValue: 'ACTIVE',
            render: (_, record) => (
                <Badge
                    status={
                        record?.userType === 'STAFF'
                            ? (
                                String(record?.staffEmploymentStatus || 'ACTIVE') === 'ACTIVE'
                                    ? 'success'
                                    : String(record?.staffEmploymentStatus || 'ACTIVE') === 'FROZEN'
                                        ? 'warning'
                                        : 'default'
                            ) as any
                            : userStatusMap[record.status as keyof typeof userStatusMap]?.status as any
                    }
                    text={
                        record?.userType === 'STAFF'
                            ? (
                                String(record?.staffEmploymentStatus || 'ACTIVE') === 'ACTIVE'
                                    ? '正常'
                                    : String(record?.staffEmploymentStatus || 'ACTIVE') === 'FROZEN'
                                        ? '冻结中'
                                        : String(record?.staffEmploymentStatus || 'ACTIVE') === 'BLACKLISTED'
                                            ? '黑名单'
                                            : '退店'
                            )
                            : userStatusMap[record.status as keyof typeof userStatusMap]?.text
                    }
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
                    {sceneConfig.key === 'MEMBER' ? (
                        <Button type="link" size="small" onClick={() => openMemberDetail(record)}>
                            详情
                        </Button>
                    ) : null}
                    {sceneConfig.key === 'MEMBER' ? (
                        <Button type="link" size="small" onClick={() => openWallet(record)}>
                            钱包
                        </Button>
                    ) : null}
                    <Button type="link" size="small" onClick={() => handleEdit(record)}>
                        编辑
                    </Button>
                    {sceneConfig.key !== 'MEMBER' ? (
                        <Button type="link" size="small" onClick={() => handleAssignRole(record)}>
                            分配角色
                        </Button>
                    ) : null}
                    {sceneConfig.key !== 'MEMBER' ? (
                        <Button type="link" size="small" onClick={() => handleChangeLevel(record)}>
                            升降级
                        </Button>
                    ) : null}
                    <Button type="link" size="small" onClick={() => handleResetPassword(record)}>
                        重置密码
                    </Button>
                    {sceneConfig.key === 'STAFF' && String(record?.staffEmploymentStatus || 'ACTIVE') !== 'BLACKLISTED' ? (
                        <Button type="link" size="small" danger onClick={() => openStaffExit(record)}>
                            退店
                        </Button>
                    ) : null}
                    {sceneConfig.key === 'STAFF' ? (
                        <Button type="link" size="small" danger onClick={() => openStaffClear(record)}>
                            清退
                        </Button>
                    ) : null}
                    {isAnonymousUserRecord(record) ? (
                        <Popconfirm
                            title="确定删除这个匿名用户吗？"
                            description="删除后无法恢复。"
                            onConfirm={() => handleDelete(record.id)}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button type="link" size="small" danger>
                                删除
                            </Button>
                        </Popconfirm>
                    ) : null}
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
            message.error((error as any)?.response?.data?.message || '更新失败');
        }
    };

    return (
        <PageContainer title={sceneConfig.title}>
            {sceneConfig.key === 'STAFF' ? (
            <Row gutter={16} style={{ marginBottom: 20 }}>

                <Col span={6}>
                    <Card>
                        <Statistic
                            title="员工可用余额"
                            value={walletStats?.totalAvailableBalance ?? 0}
                            precision={1}
                            prefix="¥"
                        />
                    </Card>
                </Col>

                <Col span={6}>
                    <Card>
                        <Statistic
                            title="员工冻结余额"
                            value={walletStats?.totalFrozenBalance ?? 0}
                            precision={1}
                            prefix="¥"
                        />
                    </Card>
                </Col>

                <Col span={6}>
                    <Card>
                        <Statistic
                            title="员工保证金"
                            value={walletStats?.totalDepositBalance ?? 0}
                            precision={1}
                            prefix="¥"
                        />
                    </Card>
                </Col>

                <Col span={6}>
                    <Card>
                        <Statistic
                            title="员工钱包总额"
                            value={walletStats?.totalBalance ?? 0}
                            precision={1}
                            prefix="¥"
                        />
                    </Card>
                </Col>

            </Row>
            ) : null}
            <ProTable
                columns={columns}
                scroll={{
                    x: 'max-content',
                }}
                request={async (params) => {
                    try {
                        const { current, pageSize, ...rest } = params;
                        const query = {
                            page: current ?? 1,
                            limit: pageSize ?? 10,
                            scene: sceneConfig.key,
                            includeStaffMembers: sceneConfig.key === 'MEMBER' ? 'true' : undefined,
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
                staffTagOptions={staffTagOptions}
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
                staffTagOptions={staffTagOptions}
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

            <Modal
                title={`员工退店 - ${staffExitUser?.name || staffExitUser?.phone || ''}`}
                open={staffExitVisible}
                onOk={handleStaffExitSubmit}
                onCancel={() => {
                    setStaffExitVisible(false);
                    setStaffExitUser(null);
                    setStaffExitPreview(null);
                    staffExitForm.resetFields();
                }}
                confirmLoading={staffExitLoading}
                destroyOnClose
            >
                <Form form={staffExitForm} layout="vertical">
                    <div style={{ background: '#fafafa', padding: 12, borderRadius: 8, marginBottom: 16, lineHeight: '22px' }}>
                        <div>标签：{(staffExitPreview?.staffTags || []).join('、') || '未设置'}</div>
                        <div>命中规则：{staffExitPreview?.matchedStaffRule?.name || '未命中，走默认规则'}</div>
                        <div>入店天数：{Number(staffExitPreview?.inShopDays ?? 0)} 天</div>
                        <div>退店冷却期：{Number(staffExitPreview?.quitCoolingDays ?? 180)} 天</div>
                        <div>押金不退限制：{Number(staffExitPreview?.depositForfeitDays ?? 0)} 天</div>
                        <div>当前可用/冻结/保证金：¥{Number(staffExitPreview?.availableBalance ?? 0)} / ¥{Number(staffExitPreview?.frozenBalance ?? 0)} / ¥{Number(staffExitPreview?.depositBalance ?? 0)}</div>
                        <div>本次应退保证金：¥{Number(staffExitPreview?.refundDepositAmount ?? 0)}</div>
                        <div>本次不退保证金：¥{Number(staffExitPreview?.forfeitDepositAmount ?? 0)}</div>
                        <div>退店后转入可用余额：¥{Number(staffExitPreview?.releaseAmount ?? 0)}</div>
                    </div>
                    <Form.Item label="退店方式" name="mode" rules={[{ required: true, message: '请选择退店方式' }]}>
                        <Select
                            options={[
                                { label: '正常退店：仅释放冻结金额与规则允许退回的保证金', value: 'RELEASE_TO_AVAILABLE' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name="addToBlacklist" valuePropName="checked">
                        <Checkbox>同时加入黑名单</Checkbox>
                    </Form.Item>
                    <div style={{ color: '#999', fontSize: 12, lineHeight: '20px' }}>
                        普通退店默认进入规则配置的冷却期。加入黑名单后不可再次入店。
                    </div>
                    <div style={{ color: '#999', fontSize: 12, lineHeight: '20px', marginTop: 8 }}>
                        若勾选黑名单，系统会校验退店后可用余额必须为 0；有余额时请改用“清退”。
                    </div>
                </Form>
            </Modal>

            <Modal
                title={`员工清退 - ${staffClearUser?.name || staffClearUser?.phone || ''}`}
                open={staffClearVisible}
                onOk={handleStaffClearSubmit}
                onCancel={() => {
                    setStaffClearVisible(false);
                    setStaffClearUser(null);
                    staffClearForm.resetFields();
                }}
                confirmLoading={staffClearLoading}
                destroyOnClose
            >
                <Form form={staffClearForm} layout="vertical">
                    <div style={{ background: '#fff7e6', padding: 12, borderRadius: 8, marginBottom: 16, lineHeight: '22px' }}>
                        <div>可用余额：¥{Number(staffClearUser?.wallet?.availableBalance ?? 0)}</div>
                        <div>冻结金额：¥{Number(staffClearUser?.wallet?.frozenBalance ?? 0)}</div>
                        <div>保证金：¥{Number(staffClearUser?.wallet?.depositBalance ?? 0)}</div>
                        <div>本操作会将以上金额全部清零，并记录正常流水。</div>
                    </div>
                    <Form.Item name="addToBlacklist" valuePropName="checked">
                        <Checkbox>同时加入黑名单</Checkbox>
                    </Form.Item>
                    <Form.Item label="备注" name="remark" rules={[{ required: true, message: '请输入清退备注' }]}>
                        <Input.TextArea rows={3} placeholder="请输入清退原因或说明" maxLength={255} />
                    </Form.Item>
                </Form>
            </Modal>

            <Drawer
                title={`会员详情 - ${memberDetail?.name || memberDetail?.phone || ''}`}
                width={760}
                open={memberDetailVisible}
                onClose={() => {
                    setMemberDetailVisible(false);
                    setMemberDetail(null);
                    setMemberGameCards([]);
                    setMemberGameCardCategories([]);
                }}
                destroyOnClose
                loading={memberDetailLoading}
            >
                {memberDetail ? (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Space wrap>
                            <Button type="primary" onClick={openMemberRecharge}>手动充值</Button>
                            <Button onClick={openMemberGrowthAdjust}>调整成长值</Button>
                        </Space>
                        <Descriptions bordered size="small" column={2}>
                            <Descriptions.Item label="会员编码">{memberDetail?.memberProfile?.memberCode || '-'}</Descriptions.Item>
                            <Descriptions.Item label="会员等级">{memberDetail?.memberProfile?.levelCode || 'NONE'}</Descriptions.Item>
                            <Descriptions.Item label="手机号">{memberDetail?.phone || '-'}</Descriptions.Item>
                            <Descriptions.Item label="昵称">{memberDetail?.name || '-'}</Descriptions.Item>
                            <Descriptions.Item label="储值余额">¥{Number(memberDetail?.walletAccount?.availableBalance ?? 0).toFixed(2)}</Descriptions.Item>
                            <Descriptions.Item label="冻结余额">¥{Number(memberDetail?.walletAccount?.frozenBalance ?? 0).toFixed(2)}</Descriptions.Item>
                            <Descriptions.Item label="当前积分">{Number(memberDetail?.memberPointAccount?.availablePoints ?? 0)}</Descriptions.Item>
                            <Descriptions.Item label="成长值">{Number(memberDetail?.memberProfile?.annualContribution ?? 0)}</Descriptions.Item>
                            <Descriptions.Item label="累计充值">¥{Number(memberDetail?.memberProfile?.totalRechargeAmount ?? 0).toFixed(2)}</Descriptions.Item>
                            <Descriptions.Item label="累计消费">¥{Number(memberDetail?.memberProfile?.totalConsumeAmount ?? 0).toFixed(2)}</Descriptions.Item>
                            <Descriptions.Item label="最近登录">{memberDetail?.lastLoginAt ? dayjs(memberDetail.lastLoginAt).format('YYYY-MM-DD HH:mm:ss') : '从未'}</Descriptions.Item>
                            <Descriptions.Item label="最近充值">{memberDetail?.memberProfile?.lastRechargeAt ? dayjs(memberDetail.memberProfile.lastRechargeAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
                        </Descriptions>

                        <Card size="small" title="最近订单">
                            <List
                                size="small"
                                dataSource={Array.isArray(memberDetail?.customerOrders) ? memberDetail.customerOrders : []}
                                locale={{ emptyText: '暂无订单' }}
                                renderItem={(item: any) => (
                                    <List.Item>
                                        <div style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <span>{item?.autoSerial || `#${item?.id}`}</span>
                                                <span>{item?.project?.name || '-'}</span>
                                                <Tag>{item?.status || '-'}</Tag>
                                            </div>
                                            <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                                                实付 ¥{Number(item?.paidAmount ?? item?.finalPayableAmount ?? 0).toFixed(2)} · {item?.createdAt ? dayjs(item.createdAt).format('YYYY-MM-DD HH:mm') : '-'}
                                            </div>
                                        </div>
                                    </List.Item>
                                )}
                            />
                        </Card>

                        <Card size="small" title="最近充值">
                            <List
                                size="small"
                                dataSource={Array.isArray(memberDetail?.memberRechargeOrders) ? memberDetail.memberRechargeOrders : []}
                                locale={{ emptyText: '暂无充值记录' }}
                                renderItem={(item: any) => (
                                    <List.Item>
                                        <div style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <span>{item?.rechargeNo || `#${item?.id}`}</span>
                                                <Space size={8}>
                                                    <Tag>{item?.channel || '-'}</Tag>
                                                    <Tag color={String(item?.status || '') === 'SUCCESS' ? 'green' : 'default'}>{item?.status || '-'}</Tag>
                                                </Space>
                                            </div>
                                            <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                                                充值 ¥{Number(item?.payAmount ?? 0).toFixed(2)} / 到账 ¥{Number(item?.grantedAmount ?? 0).toFixed(2)} · {item?.createdAt ? dayjs(item.createdAt).format('YYYY-MM-DD HH:mm') : '-'}
                                            </div>
                                            <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                                                赠送积分 {Number(item?.giftPoints ?? 0)} · 赠送成长值 {Number(item?.giftGrowthValue ?? 0)}
                                            </div>
                                            {item?.remark ? (
                                                <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                                                    备注：{item.remark}
                                                </div>
                                            ) : null}
                                        </div>
                                    </List.Item>
                                )}
                            />
                        </Card>

                        <Card size="small" title="最近优惠券">
                            <List
                                size="small"
                                dataSource={Array.isArray(memberDetail?.userCoupons) ? memberDetail.userCoupons : []}
                                locale={{ emptyText: '暂无优惠券' }}
                                renderItem={(item: any) => (
                                    <List.Item>
                                        <div style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <span>{item?.template?.name || `优惠券 #${item?.id}`}</span>
                                                <Tag>{item?.status || '-'}</Tag>
                                            </div>
                                            <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                                                {item?.expiresAt ? `有效期至 ${dayjs(item.expiresAt).format('YYYY-MM-DD HH:mm')}` : '长期有效'}
                                            </div>
                                        </div>
                                    </List.Item>
                                )}
                            />
                        </Card>

                        <Card
                            size="small"
                            title="游戏名片"
                            extra={(
                                <Button type="link" size="small" onClick={openMemberGameCardModal}>
                                    维护游戏名片
                                </Button>
                            )}
                        >
                            <List
                                size="small"
                                dataSource={memberGameCards}
                                locale={{ emptyText: '暂无游戏名片' }}
                                renderItem={(item: any) => (
                                    <List.Item
                                        actions={[
                                            item?.isPrimary ? (
                                                <Tag color="gold" key="primary">主要</Tag>
                                            ) : (
                                                <Button
                                                    key="set-primary"
                                                    type="link"
                                                    size="small"
                                                    onClick={() => handleSetPrimaryGameCard(Number(item.id))}
                                                >
                                                    设为主要
                                                </Button>
                                            ),
                                            <Popconfirm
                                                key="delete"
                                                title="确定删除这张游戏名片吗？"
                                                description="删除后如需恢复，请重新新增。"
                                                onConfirm={() => handleDeleteGameCard(Number(item.id))}
                                                okText="确定"
                                                cancelText="取消"
                                            >
                                                <Button type="link" size="small" danger>
                                                    删除
                                                </Button>
                                            </Popconfirm>,
                                        ]}
                                    >
                                        <div style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <span>{item?.gameCategoryName || '-'}</span>
                                                <span style={{ color: '#999', fontSize: 12 }}>
                                                    {item?.createdAt ? dayjs(item.createdAt).format('YYYY-MM-DD HH:mm') : '-'}
                                                </span>
                                            </div>
                                            <div style={{ color: '#333', fontSize: 12, marginTop: 4 }}>
                                                游戏数字ID：{item?.gameUniqueId || '-'}
                                            </div>
                                            <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                                                游戏昵称：{String(item?.gameNickname || '').trim() || '未填写'}
                                            </div>
                                        </div>
                                    </List.Item>
                                )}
                            />
                        </Card>
                    </Space>
                ) : null}
            </Drawer>

            <Modal
                title={`会员手动充值 - ${memberDetail?.name || memberDetail?.phone || ''}`}
                open={memberRechargeVisible}
                onOk={submitMemberRecharge}
                onCancel={() => {
                    setMemberRechargeVisible(false);
                    memberRechargeForm.resetFields();
                }}
                confirmLoading={memberRechargeSubmitting}
                destroyOnClose
            >
                <Form form={memberRechargeForm} layout="vertical">
                    <Form.Item label="充值方案" name="planId">
                        <Select
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            options={memberRechargePlans.map((item: any) => ({
                                value: Number(item.id),
                                label: `${item.title} · 充${Number(item.amount ?? 0).toFixed(2)} 送${Number(item.bonusAmount ?? 0).toFixed(2)}`,
                            }))}
                            placeholder="可选，选择后自动带出福利"
                            onChange={handleMemberRechargePlanChange}
                        />
                    </Form.Item>
                    <Form.Item label="充值金额" name="amount" rules={[{ required: true, message: '请输入充值金额' }]}>
                        <InputNumber style={{ width: '100%' }} min={0.01} precision={2} placeholder="请输入实际充值金额" />
                    </Form.Item>
                    <Form.Item label="赠送本金" name="bonusAmount">
                        <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="选填，默认取方案值" />
                    </Form.Item>
                    <Form.Item label="赠送积分" name="giftPoints">
                        <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder="选填，默认取方案值" />
                    </Form.Item>
                    <Form.Item label="赠送成长值" name="giftGrowthValue">
                        <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder="选填，默认取方案值" />
                    </Form.Item>
                    <Form.Item label="赠送优惠券" name="couponBenefitTemplateIds">
                        <Select
                            mode="multiple"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            options={memberCouponTemplateOptions}
                            placeholder="可选，支持绑定赠送优惠券"
                        />
                    </Form.Item>
                    <Form.Item label="充值备注" name="remark" rules={[{ required: true, message: '请填写充值备注' }]}>
                        <Input.TextArea rows={3} placeholder="例如：线下转账补录 / 活动赠送 / 客诉补偿" />
                    </Form.Item>
                    <div style={{ color: '#999', fontSize: 12, lineHeight: '20px' }}>
                        手动充值会生成成功充值单，并同步到账储值余额、赠送本金、积分、成长值和赠送优惠券。
                    </div>
                </Form>
            </Modal>

            <Modal
                title={`调整会员成长值 - ${memberDetail?.name || memberDetail?.phone || ''}`}
                open={memberGrowthVisible}
                onOk={submitMemberGrowthAdjust}
                onCancel={() => {
                    setMemberGrowthVisible(false);
                    memberGrowthForm.resetFields();
                }}
                confirmLoading={memberGrowthSubmitting}
                destroyOnClose
            >
                <Form form={memberGrowthForm} layout="vertical">
                    <Form.Item
                        label="成长值调整"
                        name="growthValue"
                        rules={[
                            { required: true, message: '请输入成长值调整值' },
                            {
                                validator: async (_rule, value) => {
                                    if (!Number(value)) throw new Error('成长值调整值不能为 0');
                                },
                            },
                        ]}
                    >
                        <InputNumber style={{ width: '100%' }} precision={0} placeholder="支持正负数，正数增加，负数扣减" />
                    </Form.Item>
                    <Form.Item label="调整原因" name="remark" rules={[{ required: true, message: '请填写调整原因' }]}>
                        <Input.TextArea rows={3} placeholder="请输入本次人工调整成长值的原因" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="维护游戏名片"
                open={memberGameCardVisible}
                onOk={handleCreateMemberGameCard}
                onCancel={() => {
                    setMemberGameCardVisible(false);
                    memberGameCardForm.resetFields();
                }}
                confirmLoading={memberGameCardSubmitting}
                destroyOnClose
            >
                <Form form={memberGameCardForm} layout="vertical">
                    <Form.Item label="所属游戏" name="gameCategoryId" rules={[{ required: true, message: '请选择所属游戏' }]}>
                        <Select
                            showSearch
                            optionFilterProp="label"
                            options={memberGameCardCategories.map((item: any) => ({
                                label: item?.name || '-',
                                value: item?.id || '',
                            }))}
                            placeholder="请选择一级游戏分类"
                        />
                    </Form.Item>
                    <Form.Item
                        label="游戏数字ID"
                        name="gameUniqueId"
                        rules={[
                            { required: true, message: '请输入游戏数字ID' },
                            { pattern: /^[0-9]{1,64}$/, message: '请填写正确的游戏数字ID' },
                        ]}
                    >
                        <Input maxLength={64} placeholder="请输入游戏数字ID" />
                    </Form.Item>
                    <Form.Item label="游戏昵称" name="gameNickname">
                        <Input maxLength={64} placeholder="选填" />
                    </Form.Item>
                    <Form.Item name="isPrimary" valuePropName="checked">
                        <Checkbox>设为主要游戏名片</Checkbox>
                    </Form.Item>
                    <div style={{ color: '#999', fontSize: 12, lineHeight: '20px' }}>
                        后台可新增、删除并调整主要名片。同一游戏最多 2 张，游戏数字ID在同类游戏下全局唯一。
                    </div>
                </Form>
            </Modal>
        </PageContainer>
    );
}
