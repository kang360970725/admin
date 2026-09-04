import React, { useEffect, useRef, useState } from 'react';
import { PageContainer, ProFormDigit, ProFormSwitch, ProFormText, ProTable, ModalForm } from '@ant-design/pro-components';
import { Button, DatePicker, Form, InputNumber, message, Select, Space, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { createMemberRechargePlan, getCouponTemplates, getMemberRechargePlans, updateMemberRechargePlan } from '@/services/api';

export default function RechargePlansPage() {
    const actionRef = useRef<any>();
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [couponOptions, setCouponOptions] = useState<Array<{ label: string; value: number }>>([]);
    const [form] = Form.useForm();
    const watchedAmount = Number(Form.useWatch('amount', form) || 0);
    const watchedBonusAmount = Number(Form.useWatch('bonusAmount', form) || 0);
    const watchedGiftPoints = Math.max(0, Math.floor(Number(Form.useWatch('giftPoints', form) || 0)));
    const watchedGiftGrowthValue = Math.max(0, Math.floor(Number(Form.useWatch('giftGrowthValue', form) || 0)));

    useEffect(() => {
        const loadCoupons = async () => {
            try {
                const res: any = await getCouponTemplates({ page: 1, limit: 200, status: 'ACTIVE' });
                const rows = Array.isArray(res?.data) ? res.data : [];
                setCouponOptions(rows.map((item: any) => ({
                    value: Number(item.id),
                    label: `${item.name}（模板ID ${item.id}）`,
                })));
            } catch (_e) {
                setCouponOptions([]);
            }
        };
        loadCoupons();
    }, []);

    const formatTime = (value: any) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '不限';
    const getEffectiveMeta = (record: any) => {
        if (record?.enabled === false) return { text: '停用', color: 'default' };
        const now = dayjs();
        if (record?.effectiveFrom && dayjs(record.effectiveFrom).isAfter(now)) return { text: '未生效', color: 'gold' };
        if (record?.effectiveTo && dayjs(record.effectiveTo).isBefore(now)) return { text: '已截止', color: 'red' };
        return { text: '生效中', color: 'green' };
    };

    const columns: any[] = [
        { title: 'ID', dataIndex: 'id', width: 70, search: false },
        { title: '标题', dataIndex: 'title', width: 140, search: false },
        { title: '充值金额', dataIndex: 'amount', width: 120, search: false, render: (v: any) => `¥${Number(v ?? 0).toFixed(2)}` },
        { title: '赠送金额', dataIndex: 'bonusAmount', width: 120, search: false, render: (v: any) => `¥${Number(v ?? 0).toFixed(2)}` },
        { title: '赠送积分', dataIndex: 'giftPoints', width: 100, search: false },
        { title: '赠送成长值', dataIndex: 'giftGrowthValue', width: 110, search: false },
        {
            title: '赠券',
            dataIndex: 'couponBenefits',
            search: false,
            render: (_: any, record: any) => {
                const rows = Array.isArray(record?.couponBenefits) ? record.couponBenefits : [];
                if (!rows.length) return '-';
                return rows.map((item: any) => `模板ID ${item?.templateId} ×${Math.max(1, Math.floor(Number(item?.count || 1)))}`).join('，');
            },
        },
        { title: '角标', dataIndex: 'badgeText', width: 100, search: false, render: (v: string) => v ? <Tag color="orange">{v}</Tag> : '-' },
        { title: '券文案', dataIndex: 'couponText', search: false, ellipsis: true },
        {
            title: '有效期',
            dataIndex: 'effectivePeriod',
            width: 250,
            search: false,
            render: (_: any, record: any) => (
                <Space direction="vertical" size={0}>
                    <span>{formatTime(record?.effectiveFrom)} 至</span>
                    <span>{formatTime(record?.effectiveTo)}</span>
                </Space>
            ),
        },
        { title: '排序', dataIndex: 'sortOrder', width: 90, search: false },
        {
            title: '状态',
            dataIndex: 'enabled',
            width: 120,
            search: false,
            render: (_: any, record: any) => {
                const meta = getEffectiveMeta(record);
                return <Tag color={meta.color}>{meta.text}</Tag>;
            },
        },
        {
            title: '操作',
            valueType: 'option',
            width: 100,
            render: (_: any, record: any) => [
                <Button
                    key="edit"
                    type="link"
                    onClick={() => {
                        setEditing(record);
                        form.setFieldsValue({
                            ...record,
                            effectiveFrom: record?.effectiveFrom ? dayjs(record.effectiveFrom) : null,
                            effectiveTo: record?.effectiveTo ? dayjs(record.effectiveTo) : null,
                            couponBenefits: (Array.isArray(record?.couponBenefits) ? record.couponBenefits : [])
                                .map((item: any) => ({
                                    templateId: Number(item?.templateId),
                                    count: Math.max(1, Math.floor(Number(item?.count || 1))),
                                }))
                                .filter((item: any) => Number.isFinite(item.templateId) && item.templateId > 0),
                        });
                        setOpen(true);
                    }}
                >
                    编辑
                </Button>,
            ],
        },
    ];

    return (
        <PageContainer>
            <ProTable
                rowKey="id"
                actionRef={actionRef}
                search={false}
                columns={columns}
                request={async () => {
                    const data: any = await getMemberRechargePlans();
                    return { data: Array.isArray(data) ? data : [], success: true };
                }}
                toolBarRender={() => [
                    <Button
                        key="create"
                        type="primary"
                        onClick={() => {
                            setEditing(null);
                            form.resetFields();
                            form.setFieldsValue({ enabled: true, sortOrder: 100, giftPoints: 0, giftGrowthValue: 0, bonusAmount: 0, effectiveFrom: null, effectiveTo: null, couponBenefits: [] });
                            setOpen(true);
                        }}
                    >
                        新增方案
                    </Button>,
                ]}
            />

            <ModalForm
                title={editing ? '编辑充值方案' : '新增充值方案'}
                open={open}
                form={form}
                layout="vertical"
                width={920}
                modalProps={{ destroyOnClose: true, onCancel: () => setOpen(false), className: 'bc-admin-form-modal' }}
                initialValues={editing || { enabled: true, sortOrder: 100, giftPoints: 0, giftGrowthValue: 0, bonusAmount: 0 }}
                onFinish={async (values) => {
                    try {
                        const payload = {
                            ...values,
                            effectiveFrom: values?.effectiveFrom ? values.effectiveFrom.toISOString() : null,
                            effectiveTo: values?.effectiveTo ? values.effectiveTo.toISOString() : null,
                            couponBenefits: Array.isArray(values?.couponBenefits)
                                ? values.couponBenefits.map((item: any) => ({
                                    templateId: Number(item?.templateId),
                                    count: Math.max(1, Math.floor(Number(item?.count || 1))),
                                }))
                                : [],
                        };
                        if (editing?.id) {
                            await updateMemberRechargePlan(editing.id, payload);
                        } else {
                            await createMemberRechargePlan(payload);
                        }
                        message.success('保存成功');
                        setOpen(false);
                        actionRef.current?.reload();
                        return true;
                    } catch (e: any) {
                        message.error(e?.message || '保存失败');
                        return false;
                    }
                }}
            >
                <div className="bc-admin-form">
                    <div className="bc-admin-form-summary">
                        <div className="bc-admin-form-summary-card info">
                            <div className="bc-admin-form-summary-label">本次充值</div>
                            <div className="bc-admin-form-summary-value">¥{watchedAmount.toFixed(2)}</div>
                        </div>
                        <div className="bc-admin-form-summary-card success">
                            <div className="bc-admin-form-summary-label">到账合计</div>
                            <div className="bc-admin-form-summary-value">¥{(watchedAmount + watchedBonusAmount).toFixed(2)}</div>
                        </div>
                        <div className="bc-admin-form-summary-card warning">
                            <div className="bc-admin-form-summary-label">赠送积分</div>
                            <div className="bc-admin-form-summary-value">{watchedGiftPoints}</div>
                        </div>
                        <div className="bc-admin-form-summary-card warning">
                            <div className="bc-admin-form-summary-label">赠送成长值</div>
                            <div className="bc-admin-form-summary-value">{watchedGiftGrowthValue}</div>
                        </div>
                    </div>

                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">基础信息</div>
                        <div className="bc-admin-form-grid">
                            <div className="bc-admin-form-grid-full">
                                <ProFormText name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]} />
                            </div>
                            <ProFormDigit name="amount" label="充值金额" min={0.01} fieldProps={{ precision: 2 }} rules={[{ required: true, message: '请输入充值金额' }]} />
                            <ProFormDigit name="bonusAmount" label="赠送金额" min={0} fieldProps={{ precision: 2 }} />
                        </div>
                    </div>

                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">赠送权益</div>
                        <div className="bc-admin-form-grid">
                            <ProFormDigit name="giftPoints" label="赠送积分" min={0} fieldProps={{ precision: 0 }} />
                            <ProFormDigit name="giftGrowthValue" label="赠送成长值" min={0} fieldProps={{ precision: 0 }} />
                            <div className="bc-admin-form-grid-full">
                                <Form.Item label="赠送优惠券">
                                    <Form.List name="couponBenefits">
                                        {(fields, { add, remove }) => (
                                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                                {fields.map((field) => (
                                                    <div key={field.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 150px 32px', gap: 8, alignItems: 'start' }}>
                                                        <Form.Item
                                                            {...field}
                                                            name={[field.name, 'templateId']}
                                                            rules={[{ required: true, message: '请选择优惠券' }]}
                                                            style={{ marginBottom: 0 }}
                                                        >
                                                            <Select
                                                                showSearch
                                                                optionFilterProp="label"
                                                                placeholder="选择优惠券模板"
                                                                options={couponOptions}
                                                            />
                                                        </Form.Item>
                                                        <Form.Item
                                                            {...field}
                                                            name={[field.name, 'count']}
                                                            rules={[{ required: true, message: '请填写张数' }]}
                                                            style={{ width: 150, marginBottom: 0 }}
                                                        >
                                                            <InputNumber min={1} max={999} precision={0} addonAfter="张" style={{ width: '100%' }} />
                                                        </Form.Item>
                                                        <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                                                    </div>
                                                ))}
                                                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ count: 1 })} block>
                                                    添加优惠券权益
                                                </Button>
                                            </Space>
                                        )}
                                    </Form.List>
                                </Form.Item>
                            </div>
                            <ProFormText name="badgeText" label="角标文案" />
                            <ProFormText name="couponText" label="券/权益文案" />
                        </div>
                    </div>

                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">上架与排序</div>
                        <div className="bc-admin-form-grid">
                            <Form.Item label="生效时间" name="effectiveFrom">
                                <DatePicker showTime style={{ width: '100%' }} placeholder="不填表示立即生效" />
                            </Form.Item>
                            <Form.Item
                                label="截止时间"
                                name="effectiveTo"
                                dependencies={['effectiveFrom']}
                                rules={[
                                    ({ getFieldValue }) => ({
                                        validator(_, value) {
                                            const start = getFieldValue('effectiveFrom');
                                            if (start && value && value.isBefore(start)) {
                                                return Promise.reject(new Error('截止时间不能早于生效时间'));
                                            }
                                            return Promise.resolve();
                                        },
                                    }),
                                ]}
                            >
                                <DatePicker showTime style={{ width: '100%' }} placeholder="不填表示长期有效" />
                            </Form.Item>
                            <ProFormDigit name="sortOrder" label="排序" min={0} fieldProps={{ precision: 0 }} />
                            <ProFormSwitch name="enabled" label="启用" />
                            <div className="bc-admin-form-grid-full bc-admin-form-muted">
                                生效期只影响前台/小程序展示和后台手动充值选择；已产生的充值记录不会受后续方案有效期调整影响。
                            </div>
                        </div>
                    </div>
                </div>
            </ModalForm>
        </PageContainer>
    );
}
