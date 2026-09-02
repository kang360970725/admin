import React, {useEffect, useRef, useState} from 'react';
import {PageContainer, ProTable} from '@ant-design/pro-components';
import {Alert, Badge, Button, Empty, message, Popconfirm, Space, Tag, Tooltip, Card, Statistic, Row, Col, Switch, Modal, Drawer, Descriptions, List, Form, Select, Checkbox, Input, Divider, InputNumber, Tabs, DatePicker} from 'antd';
import {useAccess, useLocation} from 'umi';
import dayjs from 'dayjs';
import {adminSetStaffActivityEnabled, adjustMemberGrowth, clearStaffAssets, createUserMemberGameCard, deleteUser, deleteUserMemberGameCard, exitStaffShop, getAvailableRatings, getCouponTemplates, getMemberRechargePlans, getStaffExitPreview, getStaffRuleEngineConfig, getStaffWalletStatistics, getUserById, getUserMemberGameCards, getUsers, grantUserCoupon, manualMemberRecharge, setUserMemberGameCardPrimary, updateUser} from '@/services/api';
import type { StaffRuleEngineConfig } from '@/services/api';
import CreateUserModal from './components/CreateUserModal';
import EditUserModal from './components/EditUserModal';
import ChangeLevelModal from './components/ChangeLevelModal';
import ResetPasswordModal from './components/ResetPasswordModal';
import AssignRoleModal from '@/components/AssignRoleModal';
import UserWalletDrawer from './components/UserWalletDrawer';
import {useIsMobile} from '@/utils/useIsMobile';
import {generateMemberRechargeReceiptImage} from '@/utils/receiptImage';
import { maskPhone } from '@/utils/privacy';
import CreateRentalOrderModal from '@/pages/Finance/RentalOrders/CreateRentalOrderModal';

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
    STAFF: { text: '服务者', color: 'blue' },
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

const orderStatusMap: Record<string, { text: string; color?: string }> = {
    WAIT_ASSIGN: { text: '待派单', color: 'default' },
    WAIT_ACCEPT: { text: '待接单', color: 'orange' },
    ACCEPTED: { text: '已接单', color: 'blue' },
    ARCHIVED: { text: '已存单', color: 'purple' },
    COMPLETED_PENDING_CONFIRM: { text: '已结单待确认', color: 'gold' },
    COMPLETED: { text: '已结单', color: 'green' },
    WAIT_REVIEW: { text: '待评价', color: 'gold' },
    REVIEWED: { text: '已评价', color: 'cyan' },
    WAIT_AFTERSALE: { text: '待售后', color: 'volcano' },
    AFTERSALE_DONE: { text: '已售后', color: 'magenta' },
    REFUNDED: { text: '已退款', color: 'red' },
};

const memberRechargeStatusMap: Record<string, { text: string; color?: string }> = {
    PENDING: { text: '待支付', color: 'orange' },
    SUCCESS: { text: '充值成功', color: 'green' },
    FAILED: { text: '充值失败', color: 'red' },
    CLOSED: { text: '已关闭', color: 'default' },
};

const memberRechargeChannelMap: Record<string, { text: string; color?: string }> = {
    MANUAL: { text: '后台手动', color: 'blue' },
    WECHAT: { text: '微信支付', color: 'green' },
    MINIAPP_WECHAT: { text: '小程序微信', color: 'green' },
};

const userCouponStatusMap: Record<string, { text: string; color?: string }> = {
    UNUSED: { text: '未使用', color: 'green' },
    USED: { text: '已使用', color: 'default' },
    EXPIRED: { text: '已过期', color: 'red' },
    LOCKED: { text: '已锁定', color: 'orange' },
};

const DEFAULT_STAFF_RULE_GROUP_CODE = 'default_rule';

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
        return <Tag color="red">限制服务</Tag>;
    }
    if (status === 'FROZEN') {
        return <Tag color="orange">冻结中</Tag>;
    }
    return <Tag color="default">已退出平台</Tag>;
};

const canExitOrClearStaff = (record: any) => {
    if (record?.userType !== 'STAFF') return false;
    const status = String(record?.staffEmploymentStatus || 'ACTIVE');
    return status === 'ACTIVE' || status === 'FROZEN';
};

const getRentalRiskLevel = (referenceBalance: number) => {
    if (referenceBalance < 500) {
        return {
            color: '#ff4d4f',
            tagColor: 'red',
            text: '高风险',
            desc: '低于500，建议先收取押金或确认风险',
        };
    }
    if (referenceBalance < 1000) {
        return {
            color: '#faad14',
            tagColor: 'gold',
            text: '需谨慎',
            desc: '500-1000，建议人工复核',
        };
    }
    return {
        color: '#52c41a',
        tagColor: 'green',
        text: '较安全',
        desc: '1000以上，可作为免押参考',
    };
};

export default function UsersPage() {
    const access = useAccess();
    const location = useLocation();
    const isMobile = useIsMobile(768);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [rentalOrderStaff, setRentalOrderStaff] = useState<any>(null);
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
    const [memberCouponGrantVisible, setMemberCouponGrantVisible] = useState(false);
    const [memberCouponGrantSubmitting, setMemberCouponGrantSubmitting] = useState(false);
    const [memberCouponGrantForm] = Form.useForm();
    const [memberRechargeReceiptOpen, setMemberRechargeReceiptOpen] = useState(false);
    const [memberRechargeReceiptImage, setMemberRechargeReceiptImage] = useState<string | null>(null);
    const [memberRechargeReceiptText, setMemberRechargeReceiptText] = useState('');
    const watchedMemberRechargeAmount = Number(Form.useWatch('amount', memberRechargeForm) || 0);
    const watchedMemberBonusAmount = Number(Form.useWatch('bonusAmount', memberRechargeForm) || 0);
    const watchedMemberGiftPoints = Math.max(0, Math.floor(Number(Form.useWatch('giftPoints', memberRechargeForm) || 0)));
    const watchedMemberGiftGrowthValue = Math.max(0, Math.floor(Number(Form.useWatch('giftGrowthValue', memberRechargeForm) || 0)));
    const memberRechargeBaseGrowthValue = Math.max(0, Math.floor(watchedMemberRechargeAmount));
    const memberRechargeTotalGrowthValue = memberRechargeBaseGrowthValue + watchedMemberGiftGrowthValue;
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
    const [staffRuleEngineConfig, setStaffRuleEngineConfig] = useState<StaffRuleEngineConfig | null>(null);
    const [staffStatusTab, setStaffStatusTab] = useState<'ACTIVE' | 'FROZEN' | 'EXITED' | 'BLACKLISTED'>('ACTIVE');
    const [memberStateTab, setMemberStateTab] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
    const [hasRentalRiskSearched, setHasRentalRiskSearched] = useState(false);

    const sceneMap: Record<string, { key: string; title: string; defaultUserType?: string; showStaffRating?: boolean; showWorkMetrics?: boolean; readOnly?: boolean }> = {
        '/users/members': { key: 'MEMBER', title: '会员管理', defaultUserType: 'REGISTERED_USER', showStaffRating: false, showWorkMetrics: false },
        '/users/staff': { key: 'STAFF', title: '服务者管理', defaultUserType: 'STAFF', showStaffRating: true, showWorkMetrics: true },
        '/users/rental-risk': { key: 'STAFF_RENTAL_RISK', title: '租号风控查询', defaultUserType: 'STAFF', showStaffRating: false, showWorkMetrics: false, readOnly: true },
        '/merchant-business/rental-risk': { key: 'STAFF_RENTAL_RISK', title: '租号风控查询', defaultUserType: 'STAFF', showStaffRating: false, showWorkMetrics: false, readOnly: true },
        '/users/internal': { key: 'INTERNAL', title: '后台人员管理', showStaffRating: false, showWorkMetrics: false },
        '/users/all': { key: 'ALL', title: '全部用户', showStaffRating: true, showWorkMetrics: true },
    };

    const sceneConfig = sceneMap[location.pathname] || sceneMap['/users/members'];
    const isRentalRiskScene = sceneConfig.key === 'STAFF_RENTAL_RISK';

    useEffect(() => {
        setHasRentalRiskSearched(false);
    }, [location.pathname]);

    useEffect(() => {
        if (sceneConfig.key === 'STAFF') {
            setStaffStatusTab('ACTIVE');
        }
        if (sceneConfig.key === 'MEMBER') {
            setMemberStateTab('ALL');
        }
    }, [sceneConfig.key]);

    // 加载可用的服务者评级
    useEffect(() => {
        if (isRentalRiskScene) {
            setAvailableRatings([]);
            return;
        }
        const loadRatings = async () => {
            try {
                const ratings = await getAvailableRatings();
                setAvailableRatings(ratings);
            } catch (error) {
                console.error('加载服务者评级失败:', error);
            }
        };
        loadRatings();
    }, [isRentalRiskScene]);

    useEffect(() => {
        if (sceneConfig.key === 'MEMBER' || isRentalRiskScene) {
            setStaffTagOptions([]);
            setStaffRuleEngineConfig(null);
            return;
        }
        const loadStaffRuleEngine = async () => {
            try {
                const config = await getStaffRuleEngineConfig();
                setStaffRuleEngineConfig(config || null);
                const tags = Array.isArray(config?.tags) ? config.tags : [];
                const defaultRuleName = String(config?.defaultRule?.name || '默认规则配置').trim() || '默认规则配置';
                const enabledTagOptions = tags
                    .filter((item: any) => item?.enabled !== false)
                    .map((item: any) => ({ label: item?.name || item?.code, value: item?.code }));
                const hasDefaultOption = enabledTagOptions.some((item: any) => item.value === DEFAULT_STAFF_RULE_GROUP_CODE);
                setStaffTagOptions(
                    hasDefaultOption
                        ? enabledTagOptions
                        : [
                            { label: `${defaultRuleName}（默认）`, value: DEFAULT_STAFF_RULE_GROUP_CODE },
                            ...enabledTagOptions,
                        ],
                );
            } catch (error) {
                setStaffRuleEngineConfig(null);
                console.error('加载服务者规则分组失败:', error);
            }
        };
        loadStaffRuleEngine();
    }, [isRentalRiskScene, sceneConfig.key]);

    const formatStaffRuleGroupName = (code: string) => {
        const value = String(code || '').trim();
        if (!value) return '';
        const matched = staffTagOptions.find((item) => item.value === value);
        return String(matched?.label || value).replace(/（默认）$/, '');
    };

    useEffect(() => {
        if (sceneConfig.key === 'STAFF' && access.canViewStaffWalletStats) {
            loadWalletStats();
            return;
        }
        setWalletStats(null);
    }, [sceneConfig.key, access.canViewStaffWalletStats]);

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
        const now = dayjs();
        setMemberRechargePlans(plans.filter((item: any) => {
            if (item?.enabled === false) return false;
            if (item?.effectiveFrom && dayjs(item.effectiveFrom).isAfter(now)) return false;
            if (item?.effectiveTo && dayjs(item.effectiveTo).isBefore(now)) return false;
            return true;
        }));
        setMemberCouponTemplateOptions(
            coupons.map((item: any) => ({
                value: Number(item.id),
                label: `${item.name}（模板ID ${item.id}）`,
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

    const openMemberCouponGrant = async () => {
        if (!memberDetail?.id) return;
        try {
            await loadMemberBenefitOptions();
            memberCouponGrantForm.resetFields();
            memberCouponGrantForm.setFieldsValue({
                userId: Number(memberDetail.id),
                count: 1,
            });
            setMemberCouponGrantVisible(true);
        } catch (e: any) {
            message.error(e?.data?.message || e?.message || '加载优惠券模板失败');
        }
    };

    const submitMemberCouponGrant = async () => {
        if (!memberDetail?.id) return;
        try {
            const values = await memberCouponGrantForm.validateFields();
            setMemberCouponGrantSubmitting(true);
            await grantUserCoupon({
                userId: Number(memberDetail.id),
                templateId: Number(values.templateId),
                count: Number(values.count || 1),
                expiresAt: values.expiresAt ? dayjs(values.expiresAt).toISOString() : undefined,
            });
            message.success('会员发券成功');
            setMemberCouponGrantVisible(false);
            memberCouponGrantForm.resetFields();
            await loadMemberDetailData(Number(memberDetail.id));
        } catch (e: any) {
            if (!e?.errorFields) message.error(e?.data?.message || e?.message || '会员发券失败');
        } finally {
            setMemberCouponGrantSubmitting(false);
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

    const openMemberRechargeReceipt = async (rechargeRecord: any, formValues?: any) => {
        const localOptions = memberCouponTemplateOptions.length
            ? memberCouponTemplateOptions
            : (() => [])();
        let couponOptions = localOptions;
        if (!couponOptions.length) {
            try {
                const couponRes: any = await getCouponTemplates({ page: 1, limit: 200, status: 'ACTIVE' });
                couponOptions = (Array.isArray(couponRes?.data) ? couponRes.data : []).map((item: any) => ({
                    value: Number(item.id),
                    label: `${item.name}（模板ID ${item.id}）`,
                }));
                if (couponOptions.length) setMemberCouponTemplateOptions(couponOptions);
            } catch (_e) {
                couponOptions = [];
            }
        }

        const couponCountMap = new Map<number, number>();
        const receiptCouponBenefits = Array.isArray(rechargeRecord?.couponBenefits)
            ? rechargeRecord.couponBenefits
            : (Array.isArray(formValues?.couponBenefitTemplateIds)
                ? formValues.couponBenefitTemplateIds.map((templateId: number) => ({templateId, count: 1}))
                : []);
        receiptCouponBenefits.forEach((item: any) => {
            const id = Number(item?.templateId ?? item);
            const count = Math.max(1, Math.floor(Number(item?.count ?? 1)));
            if (Number.isFinite(id) && id > 0) {
                couponCountMap.set(id, (couponCountMap.get(id) || 0) + count);
            }
        });
        const couponNames = Array.from(couponCountMap.entries()).map(([templateId, count]) => {
            const optionLabel = couponOptions.find((item) => Number(item.value) === Number(templateId))?.label || `优惠券模板ID ${templateId}`;
            const cleanLabel = optionLabel.replace(/（模板ID\s*\d+）$/, '');
            return `${cleanLabel} ×${count}`;
        });
        const rechargeAmount = Number(rechargeRecord?.amount ?? formValues?.amount ?? rechargeRecord?.payAmount ?? 0);
        const bonusAmount = Number(rechargeRecord?.bonusAmount ?? formValues?.bonusAmount ?? 0);
        const grantedAmount = Number(rechargeRecord?.grantedAmount ?? rechargeAmount + bonusAmount);
        const giftPoints = Math.max(0, Math.floor(Number(rechargeRecord?.giftPoints ?? formValues?.giftPoints ?? 0)));
        const giftGrowthValue = Math.max(0, Math.floor(Number(rechargeRecord?.giftGrowthValue ?? formValues?.giftGrowthValue ?? 0)));
        const baseGrowthValue = Math.max(0, Math.floor(rechargeAmount));
        const totalGrowthValue = baseGrowthValue + giftGrowthValue;
        const receiptNo = rechargeRecord?.rechargeNo || `ID ${rechargeRecord?.id || '-'}`;
        const receiptTime = rechargeRecord?.createdAt
            ? dayjs(rechargeRecord.createdAt).format('YYYY-MM-DD HH:mm:ss')
            : dayjs().format('YYYY-MM-DD HH:mm:ss');
        const receiptTextLines = [
            '会员储值小票',
            `会员：${memberDetail?.name || maskPhone(memberDetail?.phone) || '-'}`,
            `手机号：${maskPhone(memberDetail?.phone)}`,
            `会员编码：${memberDetail?.memberProfile?.memberCode || '-'}`,
            `充值单号：${receiptNo}`,
            `本次储值：¥${rechargeAmount.toFixed(2)}`,
            `赠送金额：¥${bonusAmount.toFixed(2)}`,
            `到账合计：¥${grantedAmount.toFixed(2)}`,
            `新增成长值：${baseGrowthValue} + ${giftGrowthValue} = ${totalGrowthValue}`,
            `新增积分：${giftPoints}`,
            `赠送优惠券：${couponNames.length ? couponNames.join('、') : '无'}`,
            `备注：${rechargeRecord?.remark || formValues?.remark || '-'}`,
            `操作时间：${receiptTime}`,
        ];
        const receiptText = receiptTextLines.join('\n');
        const receiptImage = await generateMemberRechargeReceiptImage(
            '蓝猫爽打 · 会员储值小票',
            [
                {label: '会员', value: memberDetail?.name || maskPhone(memberDetail?.phone) || '-'},
                {label: '手机号', value: maskPhone(memberDetail?.phone)},
                {label: '会员编码', value: memberDetail?.memberProfile?.memberCode || '-'},
                {label: '充值单号', value: receiptNo},
                {label: '本次储值', value: `¥${rechargeAmount.toFixed(2)}`, highlight: true},
                {label: '赠送金额', value: `¥${bonusAmount.toFixed(2)}`},
                {label: '到账合计', value: `¥${grantedAmount.toFixed(2)}`, highlight: true},
                {label: '新增成长值', value: `${baseGrowthValue} + ${giftGrowthValue} = ${totalGrowthValue}`},
                {label: '新增积分', value: `${giftPoints}`},
                {label: '赠送优惠券', value: couponNames.length ? couponNames.join('、') : '无'},
                {label: '备注', value: rechargeRecord?.remark || formValues?.remark || '-'},
                {label: '操作时间', value: receiptTime},
            ],
            {
                subtitle: '后台手动储值到账凭证',
                footerTips: ['该小票用于老板核对会员储值到账。', '最终数据以后台充值记录、会员钱包流水和优惠券发放记录为准。'],
            },
        );
        setMemberRechargeReceiptText(receiptText);
        setMemberRechargeReceiptImage(receiptImage);
        setMemberRechargeReceiptOpen(true);
    };

    const submitMemberRecharge = async () => {
        try {
            const values = await memberRechargeForm.validateFields();
            if (!memberDetail?.id) return;
            setMemberRechargeSubmitting(true);
            const rechargeResult: any = await manualMemberRecharge({
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
            await openMemberRechargeReceipt(rechargeResult, values);
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

    const renderActionButtons = (record: any, compact = false) => {
        if (sceneConfig.readOnly) return null;

        const isStaffScene = sceneConfig.key === 'STAFF';
        const canEditCurrentUser =
            sceneConfig.key === 'MEMBER'
                ? access.canEditMemberUser
                : sceneConfig.key === 'STAFF'
                    ? access.canEditStaffUser
                    : sceneConfig.key === 'INTERNAL'
                        ? access.canEditInternalUser
                        : access.canEditUser;
        const canAssignCurrentRole =
            sceneConfig.key === 'STAFF'
                ? access.canAssignStaffRole
                : sceneConfig.key === 'INTERNAL'
                    ? access.canAssignInternalRole
                    : false;
        const canChangeCurrentLevel = isStaffScene && access.canChangeLevel;
        const canResetCurrentPassword =
            sceneConfig.key === 'STAFF'
                ? access.canResetStaffPassword
                : sceneConfig.key === 'INTERNAL'
                    ? access.canResetInternalPassword
                    : false;
        const canDeleteCurrentUser =
            sceneConfig.key === 'MEMBER'
                ? access.canDeleteMemberUser
                : sceneConfig.key === 'STAFF'
                    ? access.canDeleteStaffUser
                    : sceneConfig.key === 'INTERNAL'
                        ? access.canDeleteInternalUser
                        : access.canDeleteUser;

        return (
            <Space size={compact ? 6 : undefined} wrap={compact}>
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
                {canEditCurrentUser ? (
                    <Button type={compact ? 'default' : 'link'} size="small" onClick={() => handleEdit(record)}>
                        编辑
                    </Button>
                ) : null}
                {canAssignCurrentRole ? (
                    <Button type={compact ? 'default' : 'link'} size="small" onClick={() => handleAssignRole(record)}>
                        分配角色
                    </Button>
                ) : null}
                {canChangeCurrentLevel && sceneConfig.key !== 'MEMBER' ? (
                    <Button type={compact ? 'default' : 'link'} size="small" onClick={() => handleChangeLevel(record)}>
                        升降级
                    </Button>
                ) : null}
                {canResetCurrentPassword ? (
                    <Button type={compact ? 'default' : 'link'} size="small" onClick={() => handleResetPassword(record)}>
                        重置密码
                    </Button>
                ) : null}
                {isStaffScene && access.canStaffExit && canExitOrClearStaff(record) ? (
                    <Button type={compact ? 'default' : 'link'} size="small" danger onClick={() => openStaffExit(record)}>
                        退出平台
                    </Button>
                ) : null}
                {isStaffScene && access.canStaffClear && canExitOrClearStaff(record) ? (
                    <Button type={compact ? 'default' : 'link'} size="small" danger onClick={() => openStaffClear(record)}>
                        清退
                    </Button>
                ) : null}
                {canDeleteCurrentUser && isAnonymousUserRecord(record) ? (
                    <Popconfirm
                        title="确定删除这个匿名用户吗？"
                        description="删除后无法恢复。"
                        onConfirm={() => handleDelete(record.id)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <Button type={compact ? 'default' : 'link'} size="small" danger>
                            删除
                        </Button>
                    </Popconfirm>
                ) : null}
            </Space>
        );
    };

    const renderMobileStaffCard = (_: any, record: any) => {
        const available = Number(record?.wallet?.availableBalance ?? 0);
        const frozen = Number(record?.wallet?.frozenBalance ?? 0);
        const tags = Array.isArray(record?.staffTags) ? record.staffTags : [];
        const ratingName = record?.staffRating?.name || '未设置评级';
        const reviewCount = Number(record?.reviewStats?.reviewCount ?? 0);
        const reviewAvg = Number(record?.reviewStats?.averageScore ?? 0);

        return (
            <Card
                size="small"
                style={{ marginBottom: 12, borderRadius: 14 }}
                bodyStyle={{ padding: 12 }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 15 }}>{record?.name || '-'}</strong>
                            {getStaffEmploymentTag(record)}
                        </div>
                        <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                            #{record?.id} · {maskPhone(record?.phone)}
                        </div>
                    </div>
                    <Badge
                        status={
                            String(record?.staffEmploymentStatus || 'ACTIVE') === 'ACTIVE'
                                ? 'success'
                                : String(record?.staffEmploymentStatus || 'ACTIVE') === 'FROZEN'
                                    ? 'warning'
                                    : 'default'
                        }
                        text={
                            String(record?.staffEmploymentStatus || 'ACTIVE') === 'ACTIVE'
                                ? '正常'
                                : String(record?.staffEmploymentStatus || 'ACTIVE') === 'FROZEN'
                                    ? '冻结中'
                                    : String(record?.staffEmploymentStatus || 'ACTIVE') === 'BLACKLISTED'
                                        ? '限制服务'
                                        : '已退出'
                        }
                    />
                </div>

                <Divider style={{ margin: '10px 0' }} />

                <Row gutter={[8, 8]}>
                    <Col span={12}>
                        <div style={{ color: '#999', fontSize: 12 }}>可用余额</div>
                        <div style={{ color: '#1677ff', fontWeight: 700 }}>¥{available.toFixed(1)}</div>
                    </Col>
                    <Col span={12}>
                        <div style={{ color: '#999', fontSize: 12 }}>冻结余额</div>
                        <div style={{ color: '#fa8c16', fontWeight: 700 }}>¥{frozen.toFixed(1)}</div>
                    </Col>
                    <Col span={12}>
                        <div style={{ color: '#999', fontSize: 12 }}>服务者评级</div>
                        <Tag color={record?.staffRating ? 'blue' : undefined}>{ratingName}</Tag>
                    </Col>
                    <Col span={12}>
                        <div style={{ color: '#999', fontSize: 12 }}>综合评分</div>
                        <div>{reviewCount ? `${reviewAvg.toFixed(1)} 分 / ${reviewCount} 条` : '暂无评价'}</div>
                    </Col>
                    <Col span={12}>
                        <div style={{ color: '#999', fontSize: 12 }}>最后登录</div>
                        <div>{formatDaysAgo(record?.lastLoginAt)}</div>
                    </Col>
                    <Col span={12}>
                        <div style={{ color: '#999', fontSize: 12 }}>最后接单</div>
                        <div>{formatDaysAgo(record?.lastAcceptOrderAt)}</div>
                    </Col>
                </Row>

                <div style={{ marginTop: 10 }}>
                    <div style={{ color: '#999', fontSize: 12, marginBottom: 4 }}>服务者规则分组</div>
                    {tags.length ? (
                        <Space size={4} wrap>
                            {tags.map((item: string) => <Tag key={item}>{formatStaffRuleGroupName(item)}</Tag>)}
                        </Space>
                    ) : (
                        <Tag>未设置</Tag>
                    )}
                </div>

                <Divider style={{ margin: '10px 0' }} />
                {renderActionButtons(record, true)}
            </Card>
        );
    };

    const columns: any[] = [
        {
            title: isRentalRiskScene ? '姓名/昵称' : '搜索',
            dataIndex: 'search',
            hideInTable: true,
            valueType: 'text',
            fieldProps: {
                placeholder: isRentalRiskScene ? '请输入服务者姓名或昵称精确查询' : 'ID / 手机号 / 姓名',
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
                    <span>{maskPhone(record?.phone)}</span>
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
                STAFF: { text: '服务者' },
                SUPER_ADMIN: { text: '超级管理员' },
                OPERATION: { text: '运营' },
                FINANCE: { text: '财务' },
                CUSTOMER_SERVICE: { text: '客服' },
                REGISTERED_USER: { text: '普通用户' },
                ADMIN: { text: '管理员' },
            },

            // ✅ 默认筛选“服务者”
            initialValue: 'STAFF',
            render: (_: any, record: any) => (
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
            hideInTable: sceneConfig.key === 'MEMBER' || isRentalRiskScene,
            render: (role: any) => (
                role ? (
                    <Tag color="purple">{role.name}</Tag>
                ) : (
                    <Tag>未分配</Tag>
                )
            ),
        },
        sceneConfig.showStaffRating ? {
            title: '服务者评级',
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
            title: '活跃度考核',
            dataIndex: 'activityAssessmentEnabled',
            key: 'activityAssessmentEnabled',
            search: false,
            width: 120,
            render: (_: any, record: any) => (
                <Switch
                    checked={record?.activityAssessmentEnabled !== false}
                    disabled={!access.canEditStaffUser || String(record?.staffEmploymentStatus || 'ACTIVE') !== 'ACTIVE'}
                    onChange={async (enabled) => {
                        await adminSetStaffActivityEnabled({ userId: Number(record.id), enabled });
                        message.success(enabled ? '已开启活跃度考核，72小时后开始计算' : '已关闭活跃度考核');
                        actionRef.current?.reload();
                    }}
                />
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
            hideInTable: sceneConfig.key === 'MEMBER' || isRentalRiskScene,
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
            hideInTable: isRentalRiskScene,
            render: (_: any, record: any) => {
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
            title: '服务者规则分组',
            dataIndex: 'staffTags',
            width: 180,
            search: false,
            hideInTable: sceneConfig.key === 'MEMBER' || isRentalRiskScene,
            render: (tags: string[]) => {
                const rows = Array.isArray(tags) ? tags : [];
                if (!rows.length) return <Tag>未设置</Tag>;
                return (
                    <Space size={4} wrap>
                        {rows.map((item) => <Tag key={item}>{formatStaffRuleGroupName(item)}</Tag>)}
                    </Space>
                );
            },
        },
        isRentalRiskScene ? {
            title: '租号风控灯',
            key: 'rentalRisk',
            width: 240,
            search: false,
            fixed: 'left',
            render: (_: any, record: any) => {
                const wallet = record?.wallet || {};
                const available = Number(wallet?.availableBalance ?? 0);
                const frozen = Number(wallet?.frozenBalance ?? 0);
                const deposit = Number(wallet?.depositBalance ?? 0);
                const withdrawFrozen = Number(wallet?.withdrawFrozenBalance ?? 0);
                const nonWithdrawFrozen = Number(wallet?.nonWithdrawFrozenBalance ?? Math.max(0, frozen - withdrawFrozen));
                const reference = Number(wallet?.rentalRiskReferenceBalance ?? (available + nonWithdrawFrozen));
                const risk = getRentalRiskLevel(reference);
                return (
                    <Tooltip title={risk.desc}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, lineHeight: '18px' }}>
                            <span
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 999,
                                    background: risk.color,
                                    boxShadow: `0 0 0 4px ${risk.color}22`,
                                    flex: '0 0 auto',
                                }}
                            />
                            <div>
                                <div>
                                    <Tag color={risk.tagColor as any}>{risk.text}</Tag>
                                    <span style={{ color: '#1677ff', fontWeight: 600 }}>
                                        ¥{reference.toFixed(2)}
                                    </span>
                                </div>
                                <div style={{ color: '#999', fontSize: 12 }}>
                                    参考=可用+非提现冻结（不含保证金）
                                </div>
                            </div>
                        </div>
                    </Tooltip>
                );
            },
        } : null,
        {
            title: '钱包',
            key: 'wallet',
            width: isRentalRiskScene ? 220 : 140,
            search: false,
            render: (_: any, record: any) => {

                const available = Number(record?.wallet?.availableBalance ?? 0);
                const frozen = Number(record?.wallet?.frozenBalance ?? 0);
                const deposit = Number(record?.wallet?.depositBalance ?? 0);
                const withdrawFrozen = Number(record?.wallet?.withdrawFrozenBalance ?? 0);
                const nonWithdrawFrozen = Number(record?.wallet?.nonWithdrawFrozenBalance ?? Math.max(0, frozen - withdrawFrozen));

                return (
                    <div
                        style={{ cursor: isRentalRiskScene ? 'default' : 'pointer', lineHeight: '18px' }}
                        onClick={() => {
                            if (!isRentalRiskScene) openWallet(record);
                        }}
                    >
                        <div style={{ color: '#1677ff', fontSize: 12 }}>
                            可用 ¥{available.toFixed(1)}
                        </div>

                        <div style={{ color: '#faad14', fontSize: 12 }}>
                            冻结 ¥{frozen.toFixed(1)}
                        </div>
                        {isRentalRiskScene ? (
                            <>
                                <div style={{ color: '#52c41a', fontSize: 12 }}>
                                    保证金 ¥{deposit.toFixed(1)}
                                </div>
                                <div style={{ color: withdrawFrozen > 0 ? '#ff4d4f' : '#999', fontSize: 12 }}>
                                    提现冻结 ¥{withdrawFrozen.toFixed(1)}
                                </div>
                                <div style={{ color: '#722ed1', fontSize: 12 }}>
                                    非提现冻结 ¥{nonWithdrawFrozen.toFixed(1)}
                                </div>
                            </>
                        ) : null}
                    </div>
                );
            },
        },
        {
            title: '押金阈值',
            dataIndex: 'matchedDepositAmount',
            width: 120,
            search: false,
            hideInTable: sceneConfig.key === 'MEMBER' || isRentalRiskScene,
            render: (v: any, record: any) => (
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
            hideInTable: isRentalRiskScene,
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
            title: sceneConfig.key === 'STAFF' ? '服务状态' : '账号状态',
            dataIndex: sceneConfig.key === 'STAFF' ? 'staffEmploymentStatus' : 'status',
            key: sceneConfig.key === 'STAFF' ? 'staffEmploymentStatus' : 'status',
            width: 80,
            search: sceneConfig.key !== 'STAFF',
            valueType: 'select',
            valueEnum: sceneConfig.key === 'STAFF'
                ? {
                    ACTIVE: { text: '正常' },
                    FROZEN: { text: '冻结' },
                    EXITED: { text: '已退出平台' },
                    BLACKLISTED: { text: '限制服务' },
                }
                : {
                    ACTIVE: { text: '正常' },
                    DISABLED: { text: '禁用' },
                },
            initialValue: sceneConfig.key === 'STAFF' ? undefined : 'ACTIVE',
            render: (_: any, record: any) => (
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
                                            ? '限制服务'
                                            : '已退出平台'
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
            fixed: 'right',
            hideInTable: isRentalRiskScene && !access.canCreateRentalOrder,
            render: (_: any, record: any) => isRentalRiskScene
                ? <Button type="link" disabled={!['ACTIVE', 'FROZEN'].includes(record.staffEmploymentStatus) || record.status === 'DISABLED'} onClick={() => setRentalOrderStaff(record)}>快捷创建租号订单</Button>
                : renderActionButtons(record),
        },
    ].filter(Boolean) as any[];

    const tableColumns = isMobile && isRentalRiskScene ? [
        ...columns.filter((column) => column.search !== false && column.valueType !== 'option')
            .map((column) => ({ ...column, hideInTable: true, fixed: undefined })),
        { title: '服务者租号风控', key: 'rentalRiskMobile', search: false, render: (_: any, record: any) => {
            const wallet = record.wallet || {};
            const available = Number(wallet.availableBalance || 0);
            const earning = Number(wallet.earningFrozenBalance ?? wallet.nonWithdrawFrozenBalance ?? Math.max(0, Number(wallet.frozenBalance || 0) - Number(wallet.withdrawFrozenBalance || 0)));
            const reference = Number(wallet.rentalRiskReferenceBalance ?? (available + earning));
            const risk = getRentalRiskLevel(reference);
            return <div className="rental-mobile-record">
                <div className="rental-record-heading"><div><strong>{record.nickname || record.name || '-'}</strong><div style={{ color: '#888', fontSize: 12 }}>ID {record.id} · {maskPhone(record.phone)}</div>{getStaffEmploymentTag(record)}</div><Tag color={risk.tagColor as any}>{risk.text}</Tag></div>
                <Statistic title="租号参考资产" value={reference} precision={2} prefix="¥" valueStyle={{ color: risk.color, marginBottom: 16 }} />
                <div className="rental-record-facts">
                    <div><label>可用余额</label>¥{available.toFixed(2)}</div><div><label>收益冻结</label>¥{earning.toFixed(2)}</div>
                    <div><label>提现冻结（不计入）</label>¥{Number(wallet.withdrawFrozenBalance || 0).toFixed(2)}</div><div><label>平台保证金（不计入）</label>¥{Number(wallet.depositBalance || 0).toFixed(2)}</div>
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: '#888' }}>{risk.desc}</div>
                {access.canCreateRentalOrder && <div className="rental-record-actions"><Button type="primary" disabled={!['ACTIVE', 'FROZEN'].includes(record.staffEmploymentStatus) || record.status === 'DISABLED'} onClick={() => setRentalOrderStaff(record)}>快捷创建租号订单</Button></div>}
            </div>;
        } },
    ] : isMobile && sceneConfig.key === 'STAFF'
        ? [
            ...columns
                .filter((column) => column?.hideInTable)
                .map((column) => ({ ...column, fixed: undefined })),
            {
                title: '服务者',
                dataIndex: 'mobileCard',
                search: false,
                render: renderMobileStaffCard,
            },
        ]
        : columns.map((column) => (isMobile ? { ...column, fixed: undefined } : column));

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

    const canCreateCurrentSceneUser =
        isRentalRiskScene
            ? false
            :
        sceneConfig.key === 'MEMBER'
            ? access.canCreateMemberUser
            : sceneConfig.key === 'STAFF'
                ? access.canCreateStaffUser
                : sceneConfig.key === 'INTERNAL'
                    ? access.canCreateInternalUser
                    : access.canCreateUser;

    return (
        <PageContainer className={isRentalRiskScene ? 'rental-page' : undefined} title={sceneConfig.title}>
            <CreateRentalOrderModal staff={rentalOrderStaff} onClose={() => setRentalOrderStaff(null)} onSuccess={() => actionRef.current?.reload()} />
            {isRentalRiskScene ? (
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="租号放号风控参考"
                    description="租号参考资产 = 可用余额 + 非提现冻结金额，不含提现冻结及平台保证金。创建时按真实有效冻结重新校验，租金和租号押金均需覆盖。红色低于500，黄色500-1000，绿色1000以上。"
                />
            ) : null}

            {sceneConfig.key === 'STAFF' && access.canViewStaffWalletStats ? (
            <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} style={{ marginBottom: isMobile ? 12 : 20 }}>

                <Col xs={12} md={6}>
                    <Card>
                        <Statistic
                            title="服务者可用余额"
                            value={walletStats?.totalAvailableBalance ?? 0}
                            precision={1}
                            prefix="¥"
                        />
                    </Card>
                </Col>

                <Col xs={12} md={6}>
                    <Card>
                        <Statistic
                            title="服务者冻结余额"
                            value={walletStats?.totalFrozenBalance ?? 0}
                            precision={1}
                            prefix="¥"
                        />
                    </Card>
                </Col>

                <Col xs={12} md={6}>
                    <Card>
                        <Statistic
                            title="服务者保证金"
                            value={walletStats?.totalDepositBalance ?? 0}
                            precision={1}
                            prefix="¥"
                        />
                    </Card>
                </Col>

                <Col xs={12} md={6}>
                    <Card>
                        <Statistic
                            title="服务者钱包总额"
                            value={walletStats?.totalBalance ?? 0}
                            precision={1}
                            prefix="¥"
                        />
                    </Card>
                </Col>

            </Row>
            ) : null}
            {sceneConfig.key === 'STAFF' ? (
                <Card size="small" bodyStyle={{ padding: isMobile ? '4px 8px 0' : '4px 12px 0' }} style={{ marginBottom: isMobile ? 10 : 12 }}>
                    <Tabs
                        activeKey={staffStatusTab}
                        onChange={(key) => {
                            setStaffStatusTab(key as typeof staffStatusTab);
                            setTimeout(() => actionRef.current?.reload?.(), 0);
                        }}
                        size={isMobile ? 'small' : 'middle'}
                        items={[
                            { key: 'ACTIVE', label: '正常' },
                            { key: 'FROZEN', label: '冻结中' },
                            { key: 'EXITED', label: '已退出' },
                            { key: 'BLACKLISTED', label: '限制服务' },
                        ]}
                    />
                </Card>
            ) : null}
            {sceneConfig.key === 'MEMBER' ? (
                <Card size="small" bodyStyle={{ padding: isMobile ? '4px 8px 0' : '4px 12px 0' }} style={{ marginBottom: isMobile ? 10 : 12 }}>
                    <Tabs
                        activeKey={memberStateTab}
                        onChange={(key) => {
                            setMemberStateTab(key as typeof memberStateTab);
                            setTimeout(() => actionRef.current?.reload?.(), 0);
                        }}
                        size={isMobile ? 'small' : 'middle'}
                        items={[
                            { key: 'ALL', label: '全部会员' },
                            { key: 'ACTIVE', label: '有效会员' },
                            { key: 'INACTIVE', label: '无效会员' },
                        ]}
                    />
                </Card>
            ) : null}
            <ProTable
                columns={tableColumns}
                scroll={isMobile && (sceneConfig.key === 'STAFF' || isRentalRiskScene) ? undefined : { x: 'max-content' }}
                showHeader={!(isMobile && isRentalRiskScene)}
                manualRequest={isRentalRiskScene}
                request={async (params) => {
                    try {
                        if (isRentalRiskScene) {
                            const keyword = String((params as any)?.search || '').trim();
                            if (!keyword && !hasRentalRiskSearched) {
                                return {
                                    data: [],
                                    success: true,
                                    total: 0,
                                };
                            }
                        }
                        const { current, pageSize, ...rest } = params;
                        const { staffEmploymentStatus: _ignoredStaffEmploymentStatus, status: _ignoredStatus, ...queryRest } = rest as any;
                        const query = {
                            page: current ?? 1,
                            limit: pageSize ?? 10,
                            scene: sceneConfig.key,
                            includeStaffMembers: sceneConfig.key === 'MEMBER' ? 'true' : undefined,
                            ...(sceneConfig.key === 'MEMBER' ? { memberState: memberStateTab } : {}),
                            ...(sceneConfig.key === 'STAFF' ? { staffEmploymentStatus: staffStatusTab } : {}),
                            ...(sceneConfig.key !== 'STAFF' && sceneConfig.key !== 'STAFF_RENTAL_RISK' && _ignoredStatus ? { status: _ignoredStatus } : {}),
                            ...queryRest, // search 表单字段会在这里（例如 search/userType/status）
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
                    span: isMobile ? 24 : undefined,
                    collapsed: isMobile && (sceneConfig.key === 'STAFF' || isRentalRiskScene) ? false : undefined,
                    defaultCollapsed: isMobile && (sceneConfig.key === 'STAFF' || isRentalRiskScene) ? false : isMobile,
                    collapseRender: isMobile && (sceneConfig.key === 'STAFF' || isRentalRiskScene) ? false : undefined,
                    searchText: isRentalRiskScene ? '查询' : undefined,
                    resetText: isRentalRiskScene ? '清空' : undefined,
                }}
                form={isRentalRiskScene ? {
                    submitter: {
                        render: (_props: any, doms: any[]) => {
                            const reset = doms?.[0];
                            const submit = doms?.[1];
                            return [
                                reset ? React.cloneElement(reset, {
                                    key: 'reset',
                                    onClick: (...args: any[]) => {
                                        setHasRentalRiskSearched(false);
                                        reset.props?.onClick?.(...args);
                                    },
                                }) : null,
                                submit ? React.cloneElement(submit, {
                                    key: 'submit',
                                    onClick: (...args: any[]) => {
                                        setHasRentalRiskSearched(true);
                                        submit.props?.onClick?.(...args);
                                    },
                                }) : null,
                            ].filter(Boolean);
                        },
                    },
                } : undefined}
                locale={{
                    emptyText: isRentalRiskScene ? (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={hasRentalRiskSearched ? '没有查询到服务者余额信息' : '请输入服务者姓名或昵称后点击查询，仅支持精确查询'}
                        />
                    ) : undefined,
                }}
                toolBarRender={() => [
                    canCreateCurrentSceneUser && (
                        <Button
                            key="add"
                            type="primary"
                            onClick={() => setCreateModalVisible(true)}
                        >
                            {sceneConfig.key === 'STAFF' ? '新增服务者' : '添加用户'}
                        </Button>
                    ),
                ]}
                pagination={{
                    pageSize: isMobile && sceneConfig.key === 'STAFF' ? 10 : 20,
                    simple: isMobile && isRentalRiskScene,
                    showSizeChanger: isMobile && isRentalRiskScene ? false : undefined,
                }}
                options={isMobile && (sceneConfig.key === 'STAFF' || isRentalRiskScene) ? { density: false, fullScreen: false, reload: true, setting: false } : undefined}
                actionRef={actionRef}
            />

            <CreateUserModal
                visible={createModalVisible}
                availableRatings={availableRatings}
                staffTagOptions={staffTagOptions}
                defaultUserType={sceneConfig.defaultUserType}
                lockUserType={sceneConfig.key === 'STAFF'}
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
                staffRuleEngineConfig={staffRuleEngineConfig}
                isSuperAdmin={access.canSeeAdmin}
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
                    message.success('服务者评级调整成功');
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
                title={`服务者退出平台 - ${staffExitUser?.name || maskPhone(staffExitUser?.phone) || ''}`}
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
                width={820}
                className="bc-admin-form-modal"
            >
                <Form form={staffExitForm} layout="vertical" className="bc-admin-form">
                    <div className="bc-admin-form-summary">
                        <div className="bc-admin-form-summary-card info">
                            <div className="bc-admin-form-summary-label">当前可用</div>
                            <div className="bc-admin-form-summary-value">¥{Number(staffExitPreview?.availableBalance ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bc-admin-form-summary-card warning">
                            <div className="bc-admin-form-summary-label">冻结金额</div>
                            <div className="bc-admin-form-summary-value">¥{Number(staffExitPreview?.frozenBalance ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bc-admin-form-summary-card success">
                            <div className="bc-admin-form-summary-label">应退保证金</div>
                            <div className="bc-admin-form-summary-value">¥{Number(staffExitPreview?.refundDepositAmount ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bc-admin-form-summary-card info">
                            <div className="bc-admin-form-summary-label">预计可用</div>
                            <div className="bc-admin-form-summary-value">¥{Number(staffExitPreview?.finalAvailableBalance ?? 0).toFixed(2)}</div>
                        </div>
                    </div>
                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">规则核算</div>
                        <div className="bc-admin-form-grid">
                            <div>
                                规则分组：{(staffExitPreview?.staffTags || []).map(formatStaffRuleGroupName).filter(Boolean).join('、') || '未设置'}
                            </div>
                            <div>命中规则：{staffExitPreview?.matchedStaffRule?.name || '未命中，走默认规则'}</div>
                            <div>入驻天数：{Number(staffExitPreview?.inShopDays ?? 0)} 天</div>
                            <div>有效接单量：{Number(staffExitPreview?.effectiveAcceptedOrderCount ?? 0)} / {Number(staffExitPreview?.minAcceptedOrdersForDepositRefund ?? 50)} 单</div>
                            <div>退出平台冷却期：{Number(staffExitPreview?.quitCoolingDays ?? 180)} 天</div>
                            <div>押金不退限制：{Number(staffExitPreview?.depositForfeitDays ?? 0)} 天</div>
                            <div>保证金阈值：¥{Number(staffExitPreview?.depositAmountRule ?? 0)}</div>
                            <div>本次不退保证金：¥{Number(staffExitPreview?.forfeitDepositAmount ?? 0)}</div>
                            <div>保证金未缴满补扣：¥{Number(staffExitPreview?.depositTopUpForfeitAmount ?? 0)}</div>
                            <div>余额不足未补齐保证金：¥{Number(staffExitPreview?.depositTopUpUnpaidAmount ?? 0)}</div>
                            <div>退出后转入可用余额：¥{Number(staffExitPreview?.releaseAmount ?? 0)}</div>
                            <div>首次提现接单满：{Number(staffExitPreview?.firstWithdrawMinAcceptedOrders ?? 20)} 单</div>
                        </div>
                    </div>
                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">退出确认</div>
                    <Form.Item label="退出方式" name="mode" rules={[{ required: true, message: '请选择退出方式' }]}>
                        <Select
                            options={[
                                { label: '正常退出：仅释放冻结金额与规则允许退回的保证金', value: 'RELEASE_TO_AVAILABLE' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name="addToBlacklist" valuePropName="checked">
                        <Checkbox>同时加入黑名单</Checkbox>
                    </Form.Item>
                    <div style={{ color: '#999', fontSize: 12, lineHeight: '20px' }}>
                        普通退出默认进入规则配置的冷却期。限制服务后不可再次入驻。
                    </div>
                    <div style={{ color: '#999', fontSize: 12, lineHeight: '20px', marginTop: 8 }}>
                        若勾选限制服务，系统会校验退出后可用余额必须为 0；有余额时请改用“清退”。
                    </div>
                    </div>
                </Form>
            </Modal>

            <Modal
                title={`服务者清退 - ${staffClearUser?.name || maskPhone(staffClearUser?.phone) || ''}`}
                open={staffClearVisible}
                onOk={handleStaffClearSubmit}
                onCancel={() => {
                    setStaffClearVisible(false);
                    setStaffClearUser(null);
                    staffClearForm.resetFields();
                }}
                confirmLoading={staffClearLoading}
                destroyOnClose
                width={720}
                className="bc-admin-form-modal"
            >
                <Form form={staffClearForm} layout="vertical" className="bc-admin-form">
                    <div className="bc-admin-form-summary">
                        <div className="bc-admin-form-summary-card danger">
                            <div className="bc-admin-form-summary-label">可用余额</div>
                            <div className="bc-admin-form-summary-value">¥{Number(staffClearUser?.wallet?.availableBalance ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bc-admin-form-summary-card danger">
                            <div className="bc-admin-form-summary-label">冻结金额</div>
                            <div className="bc-admin-form-summary-value">¥{Number(staffClearUser?.wallet?.frozenBalance ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bc-admin-form-summary-card danger">
                            <div className="bc-admin-form-summary-label">保证金</div>
                            <div className="bc-admin-form-summary-value">¥{Number(staffClearUser?.wallet?.depositBalance ?? 0).toFixed(2)}</div>
                        </div>
                    </div>
                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">清退确认</div>
                        <div className="bc-admin-form-muted" style={{ marginBottom: 12 }}>
                            本操作会将以上金额全部清零，并记录正常流水。
                        </div>
                    <Form.Item name="addToBlacklist" valuePropName="checked">
                        <Checkbox>同时加入黑名单</Checkbox>
                    </Form.Item>
                    <Form.Item label="备注" name="remark" rules={[{ required: true, message: '请输入清退备注' }]}>
                        <Input.TextArea rows={3} placeholder="请输入清退原因或说明" maxLength={255} />
                    </Form.Item>
                    </div>
                </Form>
            </Modal>

            <Drawer
                title={`会员详情 - ${memberDetail?.name || maskPhone(memberDetail?.phone) || ''}`}
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
                        {access.canManualMemberRecharge || access.canGrantMemberCoupon || access.canAdjustMemberGrowth ? (
	                            <Space wrap>
	                                {access.canManualMemberRecharge ? (
	                                    <Button type="primary" onClick={openMemberRecharge}>手动充值</Button>
	                                ) : null}
	                                {access.canGrantMemberCoupon ? (
	                                    <Button onClick={openMemberCouponGrant}>发放优惠券</Button>
	                                ) : null}
	                                {access.canAdjustMemberGrowth ? (
	                                    <Button onClick={openMemberGrowthAdjust}>调整成长值</Button>
	                                ) : null}
                            </Space>
                        ) : null}
                        <Descriptions bordered size="small" column={2}>
                            <Descriptions.Item label="会员编码">{memberDetail?.memberProfile?.memberCode || '-'}</Descriptions.Item>
                            <Descriptions.Item label="会员等级">{memberDetail?.memberProfile?.levelCode || 'NONE'}</Descriptions.Item>
                            <Descriptions.Item label="手机号">{maskPhone(memberDetail?.phone)}</Descriptions.Item>
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
                                                {(() => {
                                                    const meta = orderStatusMap[String(item?.status || '')] || { text: item?.status || '-', color: 'default' };
                                                    return <Tag color={meta.color}>{meta.text}</Tag>;
                                                })()}
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
                                renderItem={(item: any, index: number) => (
                                    <List.Item>
                                        <div style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <span>{item?.rechargeNo || `#${item?.id}`}</span>
                                                <Space size={8}>
                                                    {(() => {
                                                        const meta = memberRechargeChannelMap[String(item?.channel || '').toUpperCase()] || {
                                                            text: item?.channel || '-',
                                                            color: 'default',
                                                        };
                                                        return <Tag color={meta.color}>{meta.text}</Tag>;
                                                    })()}
                                                    {(() => {
                                                        const meta = memberRechargeStatusMap[String(item?.status || '').toUpperCase()] || {
                                                            text: item?.status || '-',
                                                            color: 'default',
                                                        };
                                                        return <Tag color={meta.color}>{meta.text}</Tag>;
                                                    })()}
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
                                            {index === 0 ? (
                                                <div style={{ marginTop: 8 }}>
                                                    <Button size="small" onClick={() => openMemberRechargeReceipt(item)}>
                                                        充值小票
                                                    </Button>
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
                                                {(() => {
                                                    const meta = userCouponStatusMap[String(item?.status || '').toUpperCase()] || {
                                                        text: item?.status || '-',
                                                        color: 'default',
                                                    };
                                                    return <Tag color={meta.color}>{meta.text}</Tag>;
                                                })()}
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
                            extra={access.canManageMemberGameCards ? (
                                <Button type="link" size="small" onClick={openMemberGameCardModal}>
                                    维护游戏名片
                                </Button>
                            ) : null}
                        >
                            <List
                                size="small"
                                dataSource={memberGameCards}
                                locale={{ emptyText: '暂无游戏名片' }}
                                renderItem={(item: any) => (
                                    <List.Item
                                        actions={access.canManageMemberGameCards ? [
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
                                        ] : []}
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
                title={`会员手动充值 - ${memberDetail?.name || maskPhone(memberDetail?.phone) || ''}`}
                open={memberRechargeVisible}
                onOk={submitMemberRecharge}
                onCancel={() => {
                    setMemberRechargeVisible(false);
                    memberRechargeForm.resetFields();
                }}
                confirmLoading={memberRechargeSubmitting}
                destroyOnClose
                width={860}
                className="bc-admin-form-modal"
            >
                <Form form={memberRechargeForm} layout="vertical" className="bc-admin-form">
                    <div className="bc-admin-form-summary">
                        <div className="bc-admin-form-summary-card info">
                            <div className="bc-admin-form-summary-label">充值本金</div>
                            <div className="bc-admin-form-summary-value">¥{watchedMemberRechargeAmount.toFixed(2)}</div>
                        </div>
                        <div className="bc-admin-form-summary-card success">
                            <div className="bc-admin-form-summary-label">到账合计</div>
                            <div className="bc-admin-form-summary-value">¥{(watchedMemberRechargeAmount + watchedMemberBonusAmount).toFixed(2)}</div>
                        </div>
                        <div className="bc-admin-form-summary-card warning">
                            <div className="bc-admin-form-summary-label">新增积分</div>
                            <div className="bc-admin-form-summary-value">{watchedMemberGiftPoints}</div>
                        </div>
                        <div className="bc-admin-form-summary-card warning">
                            <div className="bc-admin-form-summary-label">新增成长值</div>
                            <div className="bc-admin-form-summary-value">{memberRechargeTotalGrowthValue}</div>
                        </div>
                    </div>
                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">充值信息</div>
                        <div className="bc-admin-form-grid">
                            <div className="bc-admin-form-grid-full">
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
                            </div>
                            <Form.Item label="充值金额" name="amount" rules={[{ required: true, message: '请输入充值金额' }]}>
                                <InputNumber style={{ width: '100%' }} min={0.01} precision={2} placeholder="请输入实际充值金额" />
                            </Form.Item>
                            <Form.Item label="赠送本金" name="bonusAmount">
                                <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="选填，默认取方案值" />
                            </Form.Item>
                        </div>
                    </div>
                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">赠送权益</div>
                        <div className="bc-admin-form-grid">
                            <Form.Item label="赠送积分" name="giftPoints">
                                <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder="选填，默认取方案值" />
                                <div className="bc-admin-form-muted">消费积分规则：订单消费每 10 元获得 1 积分；这里填写的是额外赠送积分。</div>
                            </Form.Item>
                            <Form.Item label="赠送成长值" name="giftGrowthValue">
                                <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder="选填，默认取方案值" />
                                <div className="bc-admin-form-muted">成长值规则：充值本金每 1 元获得 1 成长值；这里填写的是额外赠送成长值。</div>
                            </Form.Item>
                            <div className="bc-admin-form-grid-full">
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
                            </div>
                        </div>
                    </div>
                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">备注与确认</div>
                        <Form.Item label="充值备注" name="remark" rules={[{ required: true, message: '请填写充值备注' }]}>
                            <Input.TextArea rows={3} placeholder="例如：线下转账补录 / 活动赠送 / 客诉补偿" />
                        </Form.Item>
                        <div className="bc-admin-form-muted">
                            成长值：{memberRechargeBaseGrowthValue}（充值本金） + {watchedMemberGiftGrowthValue}（额外赠送） = {memberRechargeTotalGrowthValue}；积分：{watchedMemberGiftPoints}（额外赠送）。手动充值会生成成功充值单，并同步到账储值余额、权益和小票。
                        </div>
                    </div>
                </Form>
            </Modal>

            <Modal
                title={`会员发放优惠券 - ${memberDetail?.name || maskPhone(memberDetail?.phone) || ''}`}
                open={memberCouponGrantVisible}
                onOk={submitMemberCouponGrant}
                onCancel={() => {
                    setMemberCouponGrantVisible(false);
                    memberCouponGrantForm.resetFields();
                }}
                confirmLoading={memberCouponGrantSubmitting}
                destroyOnClose
                width={560}
                className="bc-admin-form-modal"
            >
                <Form form={memberCouponGrantForm} layout="vertical" className="bc-admin-form" initialValues={{ count: 1 }}>
                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">发券信息</div>
                        <Form.Item label="发放会员">
                            <Input
                                disabled
                                value={`${memberDetail?.name || '未命名会员'}（${maskPhone(memberDetail?.phone)}） #${memberDetail?.id || '-'}`}
                            />
                        </Form.Item>
                        <Form.Item name="templateId" label="优惠券模板" rules={[{ required: true, message: '请选择优惠券模板' }]}>
                            <Select
                                showSearch
                                optionFilterProp="label"
                                options={memberCouponTemplateOptions}
                                placeholder="选择已生效的优惠券模板"
                            />
                        </Form.Item>
                        <Form.Item name="count" label="发放数量">
                            <InputNumber min={1} max={200} precision={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="expiresAt" label="过期时间（可选）">
                            <DatePicker showTime style={{ width: '100%' }} />
                        </Form.Item>
                        <div className="bc-admin-form-muted">
                            手动发券仅支持会员；提交后会写入会员优惠券列表，订单创建时可选择使用。
                        </div>
                    </div>
                </Form>
            </Modal>

            <Modal
                title="会员储值小票"
                open={memberRechargeReceiptOpen}
                onCancel={() => setMemberRechargeReceiptOpen(false)}
                width={560}
                footer={[
                    <Button
                        key="copy"
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(memberRechargeReceiptText);
                                message.success('小票文字已复制');
                            } catch (_e) {
                                message.warning('当前浏览器不支持直接复制，请手动复制小票内容');
                            }
                        }}
                    >
                        复制文字
                    </Button>,
                    <Button key="close" type="primary" onClick={() => setMemberRechargeReceiptOpen(false)}>
                        关闭
                    </Button>,
                ]}
            >
                {memberRechargeReceiptImage ? (
                    <img
                        src={memberRechargeReceiptImage}
                        alt="会员储值小票"
                        style={{ width: '100%', borderRadius: 12, border: '1px solid #f0f0f0' }}
                    />
                ) : (
                    <Descriptions column={1} size="small" bordered>
                        {memberRechargeReceiptText.split('\n').map((line) => {
                            const [label, ...valueParts] = line.split('：');
                            return (
                                <Descriptions.Item key={line} label={valueParts.length ? label : '内容'}>
                                    {valueParts.length ? valueParts.join('：') : line}
                                </Descriptions.Item>
                            );
                        })}
                    </Descriptions>
                )}
                <div style={{ color: '#999', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
                    右键或长按图片保存后，可直接发送给老板核对。
                </div>
            </Modal>

            <Modal
                title={`调整会员成长值 - ${memberDetail?.name || maskPhone(memberDetail?.phone) || ''}`}
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
