import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Tag } from 'antd';
import dayjs from 'dayjs';
import { resetUserWithdrawQrCode, updateUser, User, type StaffRuleEngineConfig, type StaffRuleItem } from '@/services/api';
import { maskPhone } from '@/utils/privacy';

const { Option } = Select;

interface EditUserModalProps {
    visible: boolean;
    user: User | null;
    onCancel: () => void;
    onSuccess: () => void;
    availableRatings?: any[];
    staffTagOptions?: Array<{ label: string; value: string }>;
    staffRuleEngineConfig?: StaffRuleEngineConfig | null;
    isSuperAdmin?: boolean;
}

const DEFAULT_STAFF_RULE_GROUP_CODE = 'default_rule';

const EditUserModal: React.FC<EditUserModalProps> = ({
    visible,
    user,
    onCancel,
    onSuccess,
    availableRatings = [],
    staffTagOptions = [],
    staffRuleEngineConfig = null,
    isSuperAdmin = false,
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = React.useState(false);
    const [resetQrLoading, setResetQrLoading] = React.useState(false);
    const [userType, setUserType] = useState('REGISTERED_USER');
    const watchedStaffRuleGroup = Form.useWatch('staffTags', form);

    const handleUserTypeChange = (value: string) => {
        setUserType(value);

        if (value !== 'STAFF') {
            form.setFieldsValue({ workMode: 'ONLINE', offlineJoinedAt: null });
        }
    };

    useEffect(() => {
        if (user && visible) {
            const currentUserType = user.userType;
            const currentWorkMode = (user.workMode || 'ONLINE') as 'ONLINE' | 'OFFLINE';

            setUserType(currentUserType);

            form.setFieldsValue({
                name: user.name,
                email: user.email,
                userType: currentUserType,
                status: currentUserType === 'STAFF' && user.status === 'FROZEN' ? 'ACTIVE' : user.status,
                staffEmploymentStatus: user.staffEmploymentStatus || 'ACTIVE',
                realName: user.realName,
                idCard: user.idCard,
                avatar: user.avatar,
                level: user.level,
                rating: user.rating,
                balance: user.balance,
                needResetPwd: user.needResetPwd,
                staffTags: Array.isArray(user.staffTags) ? user.staffTags[0] : undefined,
                workMode: currentWorkMode,
                offlineJoinedAt: user.offlineJoinedAt ? dayjs(user.offlineJoinedAt) : null,
            });
        }
    }, [user, visible, form]);

    const isStaff = userType === 'STAFF';
    const staffEditLocked = isStaff && !isSuperAdmin;
    const currentStaffRuleGroup = String(watchedStaffRuleGroup || (Array.isArray(user?.staffTags) ? user?.staffTags?.[0] : '') || DEFAULT_STAFF_RULE_GROUP_CODE);
    const formatStaffRuleGroupName = (code?: string) => {
        const value = String(code || '').trim();
        if (!value || value === DEFAULT_STAFF_RULE_GROUP_CODE) {
            return String(staffRuleEngineConfig?.defaultRule?.name || '默认规则配置').trim() || '默认规则配置';
        }
        return String(staffTagOptions.find((item) => item.value === value)?.label || value).replace(/（默认）$/, '');
    };
    const matchedStaffRule = useMemo<StaffRuleItem | null>(() => {
        const config = staffRuleEngineConfig;
        if (!config) return user?.matchedStaffRule || null;
        const groupCode = String(currentStaffRuleGroup || '').trim();
        if (!groupCode || groupCode === DEFAULT_STAFF_RULE_GROUP_CODE) {
            return config.defaultRule || null;
        }
        const rules = Array.isArray(config.rules) ? config.rules : [];
        return (
            rules
                .filter((rule) => rule?.enabled !== false)
                .filter((rule) => Array.isArray(rule.tagCodes) && rule.tagCodes.includes(groupCode))
                .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))[0] ||
            config.defaultRule ||
            null
        );
    }, [currentStaffRuleGroup, staffRuleEngineConfig, user?.matchedStaffRule]);
    const ruleSummary = {
        depositAmount: Number(matchedStaffRule?.depositAmount ?? user?.matchedDepositAmount ?? user?.depositLimit ?? 0),
        firstWithdrawMinBalance: Number(matchedStaffRule?.firstWithdrawMinBalance ?? user?.matchedFirstWithdrawMinBalance ?? 1000),
        firstWithdrawMinAcceptedOrders: Number(matchedStaffRule?.firstWithdrawMinAcceptedOrders ?? user?.matchedFirstWithdrawMinAcceptedOrders ?? 20),
        quitCoolingDays: Number(matchedStaffRule?.quitCoolingDays ?? user?.matchedQuitCoolingDays ?? 180),
        depositForfeitDays: Number(matchedStaffRule?.depositForfeitDays ?? user?.matchedDepositForfeitDays ?? 0),
        dormantFreezeDays: Number(matchedStaffRule?.dormantFreezeDays ?? 0),
        settlementFreezeExperienceDays: Number(matchedStaffRule?.settlementFreezeExperienceDays ?? 3),
        settlementFreezeRegularDays: Number(matchedStaffRule?.settlementFreezeRegularDays ?? 7),
    };
    const accountStatusOptions = staffEditLocked
        ? [
            { label: '正常', value: 'ACTIVE' },
            { label: '冻结', value: 'FROZEN' },
        ]
        : [
            { label: '正常', value: 'ACTIVE' },
            { label: '冻结', value: 'FROZEN' },
            { label: '停用', value: 'DISABLED' },
        ];

    const handleOk = async () => {
        try {
            const values = staffEditLocked
                ? await form.validateFields(['status', 'staffEmploymentStatus', 'staffTags'])
                : await form.validateFields();

            const buildPayload = () => {
                if (staffEditLocked) {
                    return {
                        status: values.status,
                        staffEmploymentStatus: values.staffEmploymentStatus,
                        staffTags: values.staffTags ? [values.staffTags] : [],
                    };
                }
                const payload: any = { ...values };

                // 统一在前端将服务者工作模式字段转换为后端最终格式
                if (values.userType === 'STAFF') {
                    payload.staffTags = values.staffTags ? [values.staffTags] : [];
                    delete payload.workMode;
                    delete payload.offlineJoinedAt;
                } else {
                    payload.workMode = 'ONLINE';
                    payload.offlineJoinedAt = null;
                }

                return payload;
            };

            setLoading(true);

            if (user) {
                await updateUser(user.id, buildPayload());
                form.resetFields();
                onSuccess();
            }
        } catch (error: any) {
            if (error.errorFields) {
                message.error('请完善表单信息');
            } else {
                message.error(error?.response?.data?.message || '更新用户信息失败');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        if (user) {
            setUserType(user.userType);
        }
        onCancel();
    };

    const currentRating = user?.staffRating;
    const hasWithdrawQrCode = Boolean(user?.withdrawQrCodeKey);

    return (
        <Modal
            title={`编辑用户 - ${user?.name || maskPhone(user?.phone)}`}
            open={visible}
            onOk={handleOk}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={860}
            className="bc-admin-form-modal"
            destroyOnClose
        >
            <Form form={form} layout="vertical" name="editUserForm" className="bc-admin-form">
                <div className="bc-admin-form-section">
                    <div className="bc-admin-form-section-title">账号信息</div>
                <div className="bc-admin-form-grid">
                    <div>
                        <Form.Item label="手机号">
                            <Input value={maskPhone(user?.phone)} disabled />
                        </Form.Item>

                        <Form.Item
                            label="用户身份"
                            name="userType"
                            rules={[{ required: true, message: '请选择用户身份' }]}
                        >
                            <Select placeholder="请选择用户身份" onChange={handleUserTypeChange} disabled={staffEditLocked}>
                                <Option value="REGISTERED_USER">注册用户</Option>
                                <Option value="STAFF">服务者</Option>
                                <Option value="CUSTOMER_SERVICE">客服</Option>
                                <Option value="OPERATION">运营</Option>
                                <Option value="FINANCE">财务</Option>
                                <Option value="ADMIN">管理员</Option>
                                <Option value="SUPER_ADMIN">超级管理员</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            label="账号状态"
                            name="status"
                            rules={[{ required: true, message: '请选择账号状态' }]}
                        >
                            <Select placeholder="请选择账号状态" options={accountStatusOptions} />
                        </Form.Item>

                        <Form.Item label="需重置密码" name="needResetPwd">
                            <Select placeholder="请选择" disabled={staffEditLocked}>
                                <Option value={true}>是</Option>
                                <Option value={false}>否</Option>
                            </Select>
                        </Form.Item>
                    </div>

                    <div>
                        <Form.Item label="姓名" name="name">
                            <Input placeholder="请输入姓名" disabled={staffEditLocked} />
                        </Form.Item>

                        <Form.Item
                            label="邮箱"
                            name="email"
                            rules={[{ type: 'email', message: '邮箱格式不正确' }]}
                        >
                            <Input placeholder="请输入邮箱" disabled={staffEditLocked} />
                        </Form.Item>

                        <>
                            <Form.Item label="真实姓名" name="realName">
                                <Input placeholder="请输入真实姓名" disabled={staffEditLocked} />
                            </Form.Item>

                            <Form.Item label="身份证号" name="idCard">
                                <Input placeholder="请输入身份证号" disabled={staffEditLocked} />
                            </Form.Item>
                        </>
                    </div>
                </div>
                </div>

                <div className="bc-admin-form-section">
                    <div className="bc-admin-form-section-title">业务配置</div>
                <div className="bc-admin-form-grid">
                    <Form.Item label="等级" name="level">
                        <InputNumber min={1} max={10} placeholder="等级" style={{ width: '100%' }} disabled={staffEditLocked} />
                    </Form.Item>

                    {isStaff ? (
                        <Form.Item
                            label="服务者评级"
                            name="rating"
                            rules={[{ required: true, message: '服务者必须设置评级' }]}
                        >
                            <Select placeholder="请选择评级" style={{ width: '100%' }} disabled={staffEditLocked}>
                                {availableRatings.map((rating) => (
                                    <Option key={rating.id} value={rating.id}>
                                        {rating.name}
                                        <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>
                                            ({rating.scope === 'BOTH' ? '通用' : rating.scope === 'ONLINE' ? '线上' : '线下'})
                                        </span>
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    ) : (
                        <Form.Item label="评级" name="rating">
                            <InputNumber min={1} max={5} placeholder="评级" style={{ width: '100%' }} disabled />
                        </Form.Item>
                    )}

                    <Form.Item label="余额" name="balance">
                        <InputNumber
                            min={0}
                            step={0.01}
                            precision={2}
                            placeholder="余额"
                            style={{ width: '100%' }}
                            disabled
                            formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(value) => value?.replace(/¥\s?|(,*)/g, '') as any}
                        />
                    </Form.Item>

                    {isStaff && (
                        <>
                            <Form.Item
                                label="服务状态"
                                name="staffEmploymentStatus"
                                rules={[{ required: true, message: '请选择服务状态' }]}
                            >
                                <Select placeholder="请选择服务状态">
                                    <Option value="ACTIVE">正常</Option>
                                    <Option value="FROZEN">冻结</Option>
                                </Select>
                            </Form.Item>
                            <Form.Item label="当前已交押金">
                                <Tag color="blue">¥{Number(user?.walletAccount?.depositBalance ?? 0)}</Tag>
                            </Form.Item>
                            <Form.Item
                                label="服务者规则分组"
                                name="staffTags"
                            >
                                <Select
                                    allowClear
                                    options={staffTagOptions}
                                    placeholder="请选择服务者规则分组"
                                />
                            </Form.Item>
                        </>
                    )}
                </div>
                </div>

                <div className="bc-admin-form-section">
                    <div className="bc-admin-form-section-title">收款码</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div>
                            <div style={{ fontWeight: 500 }}>收款码</div>
                            <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                                {hasWithdrawQrCode
                                    ? `已上传${user?.withdrawQrCodeUploadedAt ? ` · ${dayjs(user.withdrawQrCodeUploadedAt).format('YYYY-MM-DD HH:mm:ss')}` : ''}`
                                    : '未上传'}
                            </div>
                        </div>
                        <Popconfirm
                            title="清理当前收款码并允许重新上传？"
                            description="清理后用户需要重新上传收款码。"
                            okText="确认清理"
                            cancelText="取消"
                            disabled={!hasWithdrawQrCode || staffEditLocked}
                            onConfirm={async () => {
                                if (!user?.id) return;
                                try {
                                    setResetQrLoading(true);
                                    await resetUserWithdrawQrCode(user.id, {
                                        remark: '会员管理编辑页清理收款码，允许重新上传',
                                    });
                                    message.success('已清理收款码，用户可重新上传');
                                    form.resetFields();
                                    onSuccess();
                                } catch (error: any) {
                                    message.error(error?.response?.data?.message || '清理收款码失败');
                                } finally {
                                    setResetQrLoading(false);
                                }
                            }}
                        >
                            <Button loading={resetQrLoading} disabled={!hasWithdrawQrCode || staffEditLocked}>
                                重新上传收款码
                            </Button>
                        </Popconfirm>
                    </div>
                </div>

                {isStaff && currentRating && (
                    <div
                        style={{
                            padding: '12px',
                            backgroundColor: '#f6ffed',
                            border: '1px solid #b7eb8f',
                            borderRadius: '4px',
                            marginBottom: '16px',
                        }}
                    >
                        <div style={{ fontWeight: 'bold', color: '#52c41a' }}>当前评级信息:</div>
                        <div>
                            <Tag color="blue">{currentRating.name}</Tag>
                            <span style={{ marginLeft: 8 }}>
                                分红比例: {(Number(currentRating.rate || 0) * 100).toFixed(0)}% | 适用范围:{' '}
                                {currentRating.scope === 'BOTH'
                                    ? '线上线下'
                                    : currentRating.scope === 'ONLINE'
                                      ? '线上'
                                      : '线下'}
                            </span>
                        </div>
                    </div>
                )}

                <Form.Item label="头像URL" name="avatar">
                    <Input placeholder="请输入头像URL地址" disabled={staffEditLocked} />
                </Form.Item>

                {isStaff && (
                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">规则核算</div>
                        <div className="bc-admin-form-grid">
                            <div>规则分组：{formatStaffRuleGroupName(currentStaffRuleGroup) || '未设置'}</div>
                            <div>命中规则：{matchedStaffRule?.name || '未命中，走默认规则'}</div>
                            <div>保证金阈值：¥{ruleSummary.depositAmount}</div>
                            <div>首次提现余额限制：¥{ruleSummary.firstWithdrawMinBalance}</div>
                            <div>首次提现接单满：{ruleSummary.firstWithdrawMinAcceptedOrders} 单</div>
                            <div>退出平台冷却期：{ruleSummary.quitCoolingDays} 天</div>
                            <div>押金不退限制：{ruleSummary.depositForfeitDays} 天</div>
                            <div>长期未接单冻结：{ruleSummary.dormantFreezeDays} 天</div>
                            <div>体验单冻结周期：{ruleSummary.settlementFreezeExperienceDays} 天</div>
                            <div>普通单冻结周期：{ruleSummary.settlementFreezeRegularDays} 天</div>
                        </div>
                    </div>
                )}
            </Form>
        </Modal>
    );
};

export default EditUserModal;
