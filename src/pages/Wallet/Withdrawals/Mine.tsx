import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Button, Divider, Form, List, message, Space, Tag, Tooltip, Typography, Upload} from 'antd';
import type {ActionType} from '@ant-design/pro-components';
import {
    ModalForm,
    ProFormDependency,
    ProFormDigit,
    ProFormRadio,
    ProFormTextArea,
    ProTable,
} from '@ant-design/pro-components';
import {useModel} from '@umijs/max';
import {UploadOutlined} from '@ant-design/icons';
import {
    confirmMyEquipmentRentalBill,
    confirmMyOfflineFeeBill,
    bindWechatH5,
    getOfflineFeeGuardInfo,
    getWechatBindH5Url,
    getWithdrawInfo,
    listMyEquipmentRentalBills,
    listMyOfflineFeeBills,
} from "@/services/api";
import {
    applyWithdrawal,
    getMyWithdrawals,
    type WalletWithdrawalRequest,
    getWithdrawQrCodeUrl,
    uploadWithdrawQrCode,
} from '@/services/api';
import dayjs from 'dayjs';

const {Text} = Typography;

type Props = {
    availableBalance: number;
    deposit?: number;
    onApplied?: () => void;
};

const WithdrawalMine: React.FC<Props> = (props) => {
    const {availableBalance, onApplied} = props;

    const actionRef = useRef<ActionType>();
    const [form] = Form.useForm();

    const {initialState} = useModel('@@initialState');
    const userId = Number((initialState as any)?.currentUser?.id || 0);
    const currentUser = (initialState as any)?.currentUser;

    const [depositBalance, setDepositBalance] = useState(0);
    const [depositLimit, setDepositLimit] = useState(2000);
    const [withdrawUserType, setWithdrawUserType] = useState<string>(String(currentUser?.userType || ''));
    const [withdrawStaffEmploymentStatus, setWithdrawStaffEmploymentStatus] = useState<string>(
        String(currentUser?.staffEmploymentStatus || 'ACTIVE'),
    );
    const [wechatAutoTransfer, setWechatAutoTransfer] = useState<any>(null);
    const [offlineFeeGuard, setOfflineFeeGuard] = useState<{
        hasOutstanding: boolean;
        bill: any | null;
        availableBalance: number;
        frozenBalance: number;
        walletTotal: number;
    }>({
        hasOutstanding: false,
        bill: null,
        availableBalance: 0,
        frozenBalance: 0,
        walletTotal: 0,
    });

    const [open, setOpen] = useState(false);
    const [hasPending, setHasPending] = useState(false);
    const [rentalBills, setRentalBills] = useState<any[]>([]);
    const [rentalLoading, setRentalLoading] = useState(false);
    const [offlineFeeBills, setOfflineFeeBills] = useState<any[]>([]);
    const [offlineFeeLoading, setOfflineFeeLoading] = useState(false);

    const withdrawAmount = Form.useWatch('amount', form);
    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [qrUploading, setQrUploading] = useState(false);

    const isWechatBrowser = () => /micromessenger/i.test(String(navigator?.userAgent || ''));

    /**
     * ✅ 与后端一致的押金计算
     */
    const depositPreview = useMemo(() => {

        const isActiveStaff =
            String(withdrawUserType || '').toUpperCase() === 'STAFF' &&
            String(withdrawStaffEmploymentStatus || 'ACTIVE').toUpperCase() === 'ACTIVE';

        if (!withdrawAmount || !isActiveStaff) return 0;

        const amount = Number(withdrawAmount);

        const depositNeed = depositLimit - depositBalance;

        const depositByRate = Math.floor(amount * 0.1);

        if (depositNeed <= 0) return 0;

        return Math.min(depositNeed, depositByRate);

    }, [withdrawAmount, depositBalance, depositLimit, withdrawUserType, withdrawStaffEmploymentStatus]);

    const fetchWithdrawInfo = async () => {
        try {

            const [res, guardInfo] = await Promise.all([
                getWithdrawInfo(),
                getOfflineFeeGuardInfo(),
            ]);

            setDepositBalance(Number(res.depositBalance || 0));
            setDepositLimit(Number(res.depositLimit || 500));
            setWithdrawUserType(String((res as any)?.userType || currentUser?.userType || ''));
            setWithdrawStaffEmploymentStatus(String((res as any)?.staffEmploymentStatus || currentUser?.staffEmploymentStatus || 'ACTIVE'));
            setWechatAutoTransfer((res as any)?.wechatAutoTransfer || null);
            setOfflineFeeGuard({
                hasOutstanding: Boolean(guardInfo?.hasOutstanding),
                bill: guardInfo?.bill || null,
                availableBalance: Number(guardInfo?.availableBalance || 0),
                frozenBalance: Number(guardInfo?.frozenBalance || 0),
                walletTotal: Number(guardInfo?.walletTotal || 0),
            });

        } catch (e: any) {

            const msg =
                e?.data?.message ||
                e?.response?.data?.message ||
                e?.message ||
                '获取提现信息失败';

            message.error(msg);
        }
    };

    const startWechatBind = async () => {
        if (!isWechatBrowser()) {
            message.warning('请在微信内打开当前移动端页面后绑定微信');
            return;
        }
        const url = new URL(window.location.href);
        url.searchParams.set('wechatBind', '1');
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        const res = await getWechatBindH5Url({ redirectUri: url.toString() });
        if (!res?.success || !res?.url) {
            message.error(res?.message || '获取微信授权地址失败');
            return;
        }
        window.location.href = res.url;
    };

    useEffect(() => {
        const run = async () => {
            const params = new URLSearchParams(window.location.search || '');
            if (params.get('wechatBind') !== '1' || !params.get('code')) return;
            try {
                const res = await bindWechatH5({ code: String(params.get('code') || '') });
                if (!res?.success) {
                    message.error(res?.message || '微信绑定失败');
                    return;
                }
                message.success('微信绑定成功');
                params.delete('wechatBind');
                params.delete('code');
                params.delete('state');
                const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`;
                window.history.replaceState({}, document.title, nextUrl);
                await fetchWithdrawInfo();
            } catch (e: any) {
                message.error(e?.data?.message || e?.response?.data?.message || e?.message || '微信绑定失败');
            }
        };
        void run();
    }, []);

    const arrivePreview = useMemo(() => {

        if (!withdrawAmount) return 0;

        return Number(withdrawAmount) - depositPreview;

    }, [withdrawAmount, depositPreview]);

    const shouldShowDepositPreview = useMemo(() => {
        return (
            String(withdrawUserType || '').toUpperCase() === 'STAFF' &&
            String(withdrawStaffEmploymentStatus || 'ACTIVE').toUpperCase() === 'ACTIVE'
        );
    }, [withdrawUserType, withdrawStaffEmploymentStatus]);

    const maxWithdraw = useMemo(() => {
        const n = Number(availableBalance || 0);
        if (!Number.isFinite(n) || n <= 0) return 0;
        return Math.floor(n / 10) * 10;
    }, [availableBalance]);

    useEffect(() => {
        if (!open) return;

        const currentAmount = Number(form.getFieldValue('amount') || 0);
        if (currentAmount > maxWithdraw) {
            form.setFieldsValue({ amount: maxWithdraw });
        }
    }, [form, open, maxWithdraw]);

    const genIdempotencyKey = () =>
        `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const fetchRentalBills = async () => {
        try {
            setRentalLoading(true);
            const rows = await listMyEquipmentRentalBills();
            setRentalBills(Array.isArray(rows) ? rows : []);
        } catch (e) {
            setRentalBills([]);
        } finally {
            setRentalLoading(false);
        }
    };

    const fetchOfflineFeeBills = async () => {
        try {
            setOfflineFeeLoading(true);
            const rows = await listMyOfflineFeeBills();
            setOfflineFeeBills(Array.isArray(rows) ? rows : []);
        } catch (e) {
            setOfflineFeeBills([]);
        } finally {
            setOfflineFeeLoading(false);
        }
    };

    useEffect(() => {
        void fetchRentalBills();
        void fetchOfflineFeeBills();
    }, []);

    const fetchQrCodeUrl = async () => {
        try {
            setQrLoading(true);
            const res = await getWithdrawQrCodeUrl();
            setQrUrl(res?.url || null);
            if(!res?.url) message.error('还未提供收款码');
        } catch (e: any) {
            const msg =
                e?.data?.message || e?.response?.data?.message || e?.message || '获取收款码失败';
            message.error(msg);
            setQrUrl(null);
        } finally {
            setQrLoading(false);
        }
    };

    const uploadQrCodeOnce = async (file: File) => {
        if (!file) {
            message.error('请选择图片文件');
            return;
        }

        try {
            setQrUploading(true);

            await uploadWithdrawQrCode(file);

            message.success('收款二维码已上传（不可修改）');
            await fetchQrCodeUrl();
        } catch (e: any) {
            const msg =
                e?.data?.message ||
                e?.response?.data?.message ||
                e?.message ||
                '上传失败';
            message.error(msg);
        } finally {
            setQrUploading(false);
        }
    };

    const columns: any = [
        {title: '申请单号', dataIndex: 'requestNo', width: 160, search: false},
        {
            title: '状态',
            dataIndex: 'status',
            width: 120,
            search: false,
            render: (_: any, row: any) => {
                const s = String(row?.status || '');
                if (s === 'PENDING_REVIEW') return <Tag color="processing">待审核</Tag>;
                if (s === 'APPROVED') return <Tag color="success">已通过</Tag>;
                if (s === 'REJECTED') return <Tag color="error">已驳回</Tag>;
                if (s === 'PAYING') return <Tag color="warning">打款中</Tag>;
                if (s === 'PAID') return <Tag color="success">已打款</Tag>;
                if (s === 'FAILED') return <Tag color="error">打款失败</Tag>;
                if (s === 'CANCELED') return <Tag>已废除</Tag>;
                return <Tag>{row?.statusText || s || '-'}</Tag>;
            },
        },
        {
            title: '金额',
            dataIndex: 'amount',
            width: 120,
            search: false,
            render: (_: any, row: any) => <span>{Number((row as any).amount || 0).toFixed(2)}</span>,
        },
        {
            title: '渠道',
            dataIndex: 'channel',
            width: 100,
            search: false,
            render: (_: any, row: any) =>
                (row as any).channel === 'WECHAT' ? <Tag>微信</Tag> : <Tag>人工</Tag>,
        },
        {title: '审批备注', dataIndex: 'reviewRemark', search: false, ellipsis: true},
        {title: '失败原因', dataIndex: 'failReason', search: false, ellipsis: true},
        {
            title: '申请时间',
            dataIndex: 'createdAt',
            width: 180,
            search: false,
            render: (_: any, row: any) => row?.createdAt ? dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-',
        },
        {
            title: '审核时间',
            dataIndex: 'reviewTime',
            width: 180,
            search: false,
            render: (_: any, row: any) => {
                const v = row?.reviewTime || row?.reviewedAt;
                return v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-';
            },
        },
    ];

    return (
        <>
            {rentalBills.length ? (
                <Alert
                    type="warning"
                    showIcon
                    style={{marginBottom: 16}}
                    message="存在待确认设备租赁费"
                    description={(
                        <List
                            size="small"
                            loading={rentalLoading}
                            dataSource={rentalBills}
                            renderItem={(item: any) => (
                                <List.Item
                                    actions={[
                                        <Button
                                            key="confirm"
                                            type="primary"
                                            size="small"
                                            onClick={async () => {
                                                try {
                                                    await confirmMyEquipmentRentalBill({billId: Number(item.id)});
                                                    message.success('设备租赁费已确认扣除');
                                                    await fetchRentalBills();
                                                    onApplied?.();
                                                } catch (e: any) {
                                                    message.error(e?.data?.message || e?.response?.data?.message || e?.message || '确认失败');
                                                }
                                            }}
                                        >
                                            确认扣费
                                        </Button>,
                                    ]}
                                >
                                    {item.billMonth} 设备租赁费 ¥{Number(item.remainingAmount || item.amount || 0).toFixed(2)}
                                </List.Item>
                            )}
                        />
                    )}
                />
            ) : null}

            {offlineFeeBills.length ? (
                <Alert
                    type="warning"
                    showIcon
                    style={{marginBottom: 16}}
                    message="存在待结线下费用账单"
                    description={(
                        <List
                            size="small"
                            loading={offlineFeeLoading}
                            dataSource={offlineFeeBills}
                            renderItem={(item: any) => (
                                <List.Item
                                    actions={[
                                        <Button
                                            key="confirm"
                                            type="primary"
                                            size="small"
                                            onClick={async () => {
                                                try {
                                                    await confirmMyOfflineFeeBill({billId: Number(item.id)});
                                                    message.success('线下费用已确认扣除');
                                                    await fetchOfflineFeeBills();
                                                    await fetchWithdrawInfo();
                                                    onApplied?.();
                                                } catch (e: any) {
                                                    message.error(e?.data?.message || e?.response?.data?.message || e?.message || '确认失败');
                                                }
                                            }}
                                        >
                                            确认扣费
                                        </Button>,
                                    ]}
                                >
                                    {item.billMonth} 线下费用 ¥{Number(item.remainingAmount || item.shouldPayAmount || 0).toFixed(2)}
                                    {item.dueAt ? <Tag style={{marginLeft: 8}}>到期 {dayjs(item.dueAt).format('YYYY-MM-DD')}</Tag> : null}
                                </List.Item>
                            )}
                        />
                    )}
                />
            ) : null}

            <ProTable<WalletWithdrawalRequest>
                headerTitle="提现记录"
                rowKey="id"
                actionRef={actionRef}
                search={false}
                toolBarRender={() => [
                    <Tooltip
                        key="apply"
                        title={hasPending ? '存在待审核/打款中的提现申请，暂不可重复申请' : ''}
                    >
                        <Button
                            type="primary"
                            disabled={hasPending || maxWithdraw <= 0}
                            onClick={async () => {
                                form.resetFields();
                                setQrUrl(null);
                                setOpen(true);
                                await fetchWithdrawInfo();
                                await fetchQrCodeUrl();
                            }}
                        >
                            申请提现
                        </Button>
                    </Tooltip>,
                ]}
                request={async () => {
                    const res = await getMyWithdrawals({userId});
                    const list = Array.isArray(res) ? res : (res as any)?.list || [];
                    const has = list.some((x: any) =>
                        ['PENDING_REVIEW', 'PAYING'].includes(String(x.status || '')),
                    );
                    setHasPending(has);
                    return {data: list as any, success: true};
                }}
                columns={columns}
                pagination={{pageSize: 20}}
            />

            <ModalForm<{ amount: number; channel: 'MANUAL' | 'WECHAT'; remark?: string }>
                title="申请提现"
                form={form}
                open={open}
                modalProps={{
                    destroyOnClose: true,
                    onCancel: () => setOpen(false),
                }}
                submitter={{searchConfig: {submitText: '提交申请'}}}
                onFinish={async (values) => {

                    try {

                        if (hasPending) {
                            message.warning('存在待审核/打款中的提现申请，暂不可重复申请');
                            return false;
                        }

                        const amount = Number(values.amount);

                        if (!Number.isFinite(amount) || amount <= 0) {
                            message.error('提现金额非法');
                            return false;
                        }

                        if (amount % 10 !== 0) {
                            message.error('提现金额必须是 10 的整数');
                            return false;
                        }

                        if (amount > maxWithdraw) {
                            message.error(`提现金额不能超过当前上限（${maxWithdraw}）`);
                            return false;
                        }

                        const channel = (values.channel || 'MANUAL') as any;

                        if (offlineFeeGuard.hasOutstanding) {
                            message.error('存在临近到期的线下费用账单未结清，请先完成账单缴费后再申请提现');
                            return false;
                        }

                        if (channel === 'MANUAL') {
                            if (!qrUrl) {
                                message.error('请先上传收款二维码（仅一次）');
                                return false;
                            }
                        }

                        const idempotencyKey = genIdempotencyKey();

                        const res: any = await applyWithdrawal({
                            userId,
                            amount,
                            idempotencyKey,
                            remark: values.remark || '',
                            channel,
                        });

                        if (!res.id) {
                            message.error(res.message);
                            return;
                        }

                        message.success('提现申请已提交，等待审核');

                        setOpen(false);

                        actionRef.current?.reload();

                        onApplied?.();

                        return true;

                    } catch (e: any) {

                        const msg = e?.data?.message || e?.response?.data?.message || e?.message || '申请失败';

                        message.error(msg);

                        return false;
                    }
                }}
            >

                <Space direction="vertical" style={{width: '100%'}} size={12}>

                    <Alert
                        type="info"
                        showIcon
                        message={
                            <Space>
                                <Text>可用余额：</Text>
                                <Text strong>{Number(availableBalance || 0).toFixed(2)}</Text>
                                <Text type="secondary">（本次最多可提：{maxWithdraw}，最少提现10元）</Text>
                            </Space>
                        }
                    />

                    {hasPending ? (
                        <Alert
                            type="warning"
                            showIcon
                            message="你有一笔提现正在审核/打款中，当前无法再次申请提现。"
                        />
                    ) : null}

                    <ProFormRadio.Group
                        name="channel"
                        label="提现渠道"
                        initialValue="MANUAL"
                        rules={[{required: true, message: '请选择提现渠道'}]}
                        options={[
                            {
                                label: (
                                    <Space>
                                        <Tag color="gold">线下</Tag>
                                        <Text strong>人工审核(仅支持微信)</Text>
                                        <Text type="secondary">（手动分账）</Text>
                                    </Space>
                                ),
                                value: 'MANUAL',
                            },
                        ]}
                    />
                    {/* ✅ 仅人工审核时：展示并校验收款码 */}
                    <ProFormDependency name={['channel']}>
                        {({channel}) => {
                            if (channel !== 'MANUAL') return null;

                            return (
                                <Space direction="vertical" style={{width: '100%',}} size={6}>

                                    <Tag style={{display: 'block'}} color="red">
                                        当日申请财务将在次日23点前处理完毕。法定节假日将顺延(日常单休，周末为休息日)；请合理计划提款时间。
                                    </Tag>
                                    <Tag style={{display: 'block'}} color="red">
                                        单笔金额大于2000.00的申请将依法按《劳务报酬》申报并预扣个税(总额20%起)，次年汇算多退少补。
                                    </Tag>
                                    <Tag style={{display: 'block'}} color="red">
                                        具体申报记录可在个人所得税app查看。
                                    </Tag>
                                    {qrUrl ? (
                                        <Alert
                                            type="success"
                                            showIcon
                                            message={<span style={{fontSize: 13, fontWeight: 600}}>收款二维码已上传</span>}
                                            description={<span style={{fontSize: 12}}>已完成配置，无需重复上传。</span>}
                                            style={{
                                                borderRadius: 12,
                                                border: 'none',
                                                background: '#F6FFED',
                                                padding: '10px 12px',
                                            }}
                                        />
                                    ) : (
                                        <Space>
                                            <Upload
                                                accept="image/*"
                                                maxCount={1}
                                                showUploadList={false}
                                                disabled={qrUploading}
                                                beforeUpload={(file) => {
                                                    uploadQrCodeOnce(file as any);
                                                    return false;
                                                }}
                                            >
                                                <Button type="primary" icon={<UploadOutlined/>} loading={qrUploading}>
                                                    上传收款二维码
                                                </Button>
                                            </Upload>

                                            <Button size="small" type="link" loading={qrLoading}
                                                    onClick={fetchQrCodeUrl}>
                                                我已上传，点此校验
                                            </Button>
                                        </Space>
                                    )}

                                </Space>
                            );
                        }}
                    </ProFormDependency>
                    <ProFormDigit
                        name="amount"
                        label="提现金额"
                        min={10}
                        max={maxWithdraw}
                        fieldProps={{
                            precision: 0,
                            step: 10,
                            placeholder: '最少提现10元',
                            addonAfter: (
                                <Button
                                    size="small"
                                    type="link"
                                    disabled={hasPending || maxWithdraw <= 0}
                                    onClick={() => form.setFieldsValue({amount: maxWithdraw})}
                                >
                                    全部提现
                                </Button>
                            ),
                        }}
                        rules={[
                            {required: true, message: '请输入提现金额'},
                            {
                                validator: async (_: any, v: any) => {
                                    const n = Number(v);
                                    if (!Number.isFinite(n) || n <= 0) throw new Error('提现金额非法');
                                    if (n % 10 !== 0) throw new Error('提现金额必须是 10 的整数');
                                    if (n > maxWithdraw) throw new Error(`不能提现超过 ${maxWithdraw}`);
                                },
                            },
                        ]}
                    />

                    {shouldShowDepositPreview && withdrawAmount ? (
                        <Alert
                            type="info"
                            showIcon
                            message={
                                <Space>
                                    <Text>保证金补充：</Text>
                                    <Text strong>{depositPreview}</Text>
                                    <Text type="secondary">
                                        （当前押金 {depositBalance} / 阈值 {depositLimit}）
                                    </Text>

                                    <Divider type="vertical"/>

                                    <Text>预计到账：</Text>
                                    <Text strong>{arrivePreview}</Text>
                                </Space>
                            }
                        />
                    ) : null}

                    {offlineFeeGuard.hasOutstanding ? (
                        <Alert
                            type="error"
                            showIcon
                            message={
                                `线下费用账单未结清：¥${Number(offlineFeeGuard?.bill?.remainingAmount || 0).toFixed(2)}`
                            }
                            description={
                                offlineFeeGuard?.bill?.dueAt
                                    ? `账单到期日：${dayjs(offlineFeeGuard.bill.dueAt).format('YYYY-MM-DD')}。请先完成线下费用账单缴费后再申请提现。`
                                    : '请先完成线下费用账单缴费后再申请提现。'
                            }
                        />
                    ) : null}

                    <ProFormTextArea
                        name="remark"
                        label="备注"
                        placeholder="可选：填写申请说明"
                        fieldProps={{rows: 3, maxLength: 200}}
                    />

                </Space>
            </ModalForm>
        </>
    );
};

export default WithdrawalMine;
