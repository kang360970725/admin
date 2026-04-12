import React, {useEffect, useMemo, useRef, useState} from 'react';
import type {FormInstance} from 'antd';
import {Alert, Button, Divider, Form, message, Space, Tag, Tooltip, Typography, Upload} from 'antd';
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
import {UploadOutlined, WechatOutlined} from '@ant-design/icons';
import {getOfflineFeeGuardInfo, getWithdrawInfo} from "@/services/api";
import {
    applyWithdrawal,
    getMyWithdrawals,
    type WalletWithdrawalRequest,
    getWithdrawQrCodeUrl,
    uploadWithdrawQrCode,
} from '@/services/api';

const {Text} = Typography;

type Props = {
    availableBalance: number;
    onApplied?: () => void;
};

const WithdrawalMine: React.FC<Props> = (props) => {
    const {availableBalance, onApplied} = props;

    const actionRef = useRef<ActionType>();
    const formRef = useRef<FormInstance>();

    const {initialState} = useModel('@@initialState');
    const userId = Number((initialState as any)?.currentUser?.id || 0);
    const currentUser = (initialState as any)?.currentUser;

    const isStaff = currentUser?.userType === 'STAFF';

    const [depositBalance, setDepositBalance] = useState(0);
    const [depositLimit, setDepositLimit] = useState(2000);
    const [offlineFeeGuard, setOfflineFeeGuard] = useState<{
        hasOutstanding: boolean;
        partialMinPay: number;
        bill: any | null;
        availableBalance: number;
        frozenBalance: number;
        walletTotal: number;
        canPartialPayByWalletRule: boolean;
    }>({
        hasOutstanding: false,
        partialMinPay: 100,
        bill: null,
        availableBalance: 0,
        frozenBalance: 0,
        walletTotal: 0,
        canPartialPayByWalletRule: true,
    });

    const [open, setOpen] = useState(false);
    const [hasPending, setHasPending] = useState(false);

    const withdrawAmount = Form.useWatch('amount', formRef.current);
    const payOfflineFeeAmountWatch = Form.useWatch('payOfflineFeeAmount', formRef.current);

    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [qrUploading, setQrUploading] = useState(false);

    /**
     * ✅ 与后端一致的押金计算
     */
    const depositPreview = useMemo(() => {

        if (!withdrawAmount || !isStaff) return 0;

        const amount = Number(withdrawAmount);

        const depositNeed = depositLimit - depositBalance;

        const depositByRate = Math.floor(amount * 0.1);

        if (depositNeed <= 0) return 0;

        return Math.min(depositNeed, depositByRate);

    }, [withdrawAmount, depositBalance, depositLimit, isStaff]);

    const fetchWithdrawInfo = async () => {
        try {

            const [res, guardInfo] = await Promise.all([
                getWithdrawInfo(),
                getOfflineFeeGuardInfo(),
            ]);

            setDepositBalance(Number(res.depositBalance || 0));
            setDepositLimit(Number(res.depositLimit || 500));
            setOfflineFeeGuard({
                hasOutstanding: Boolean(guardInfo?.hasOutstanding),
                partialMinPay: Number(guardInfo?.partialMinPay || 100),
                bill: guardInfo?.bill || null,
                availableBalance: Number(guardInfo?.availableBalance || 0),
                frozenBalance: Number(guardInfo?.frozenBalance || 0),
                walletTotal: Number(guardInfo?.walletTotal || 0),
                canPartialPayByWalletRule: Boolean(guardInfo?.canPartialPayByWalletRule ?? true),
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

    const arrivePreview = useMemo(() => {

        if (!withdrawAmount) return 0;

        return Number(withdrawAmount) - depositPreview;

    }, [withdrawAmount, depositPreview]);

    const maxWithdraw = useMemo(() => {
        const n = Number(availableBalance || 0);
        if (!Number.isFinite(n) || n <= 0) return 0;
        return Math.floor(n / 10) * 10;
    }, [availableBalance]);

    const maxWithdrawByOfflineFee = useMemo(() => {
        if (!offlineFeeGuard.hasOutstanding) return maxWithdraw;

        const rawPay = Number(payOfflineFeeAmountWatch || 0);
        const remaining = Number(offlineFeeGuard?.bill?.remainingAmount || 0);
        const pay = Math.max(0, Math.min(rawPay, remaining));

        const n = Number(availableBalance || 0) - pay;
        if (!Number.isFinite(n) || n <= 0) return 0;
        return Math.floor(n / 10) * 10;
    }, [offlineFeeGuard, payOfflineFeeAmountWatch, availableBalance, maxWithdraw]);

    useEffect(() => {
        if (!open) return;

        const currentAmount = Number(formRef.current?.getFieldValue('amount') || 0);
        if (currentAmount > maxWithdrawByOfflineFee) {
            formRef.current?.setFieldsValue({ amount: maxWithdrawByOfflineFee });
        }
    }, [open, maxWithdrawByOfflineFee]);

    const genIdempotencyKey = () =>
        `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

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
            title: '金额',
            dataIndex: 'amount',
            width: 120,
            search: false,
            render: (_, row) => <span>{Number((row as any).amount || 0).toFixed(2)}</span>,
        },
        {
            title: '渠道',
            dataIndex: 'channel',
            width: 100,
            search: false,
            render: (_, row) =>
                (row as any).channel === 'WECHAT' ? <Tag>微信</Tag> : <Tag>人工</Tag>,
        },
        {title: '审批备注', dataIndex: 'reviewRemark', search: false, ellipsis: true},
        {title: '失败原因', dataIndex: 'failReason', search: false, ellipsis: true},
        {title: '申请时间', dataIndex: 'createdAt', width: 220, search: false},
    ];

    return (
        <>
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
                                formRef.current?.resetFields();
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

            <ModalForm<{ amount: number; channel: 'MANUAL' | 'WECHAT'; remark?: string; payOfflineFeeAmount?: number }>
                title="申请提现"
                formRef={formRef}
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

                        if (amount > maxWithdrawByOfflineFee) {
                            message.error(`提现金额不能超过当前上限（${maxWithdrawByOfflineFee}）`);
                            return false;
                        }

                        const channel = (values.channel || 'MANUAL') as any;
                        const payOfflineFeeAmount = Number(values.payOfflineFeeAmount || 0) || 0;

                        if (offlineFeeGuard.hasOutstanding) {
                            const remaining = Number(offlineFeeGuard?.bill?.remainingAmount || 0);
                            const isPartialPay = payOfflineFeeAmount > 0 && payOfflineFeeAmount < remaining;
                            if (isPartialPay && !offlineFeeGuard.canPartialPayByWalletRule) {
                                message.error('当前钱包总额度（可用+冻结）不满足部分补缴条件，请选择全额缴纳');
                                return false;
                            }
                        }

                        if (channel === 'MANUAL') {
                            if (!qrUrl) {
                                message.error('请先上传收款二维码（仅一次）');
                                return false;
                            }
                        }

                        const idempotencyKey = genIdempotencyKey();

                        const res = await applyWithdrawal({
                            userId,
                            amount,
                            idempotencyKey,
                            remark: values.remark || '',
                            channel,
                            payOfflineFeeAmount: payOfflineFeeAmount || undefined,
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
                                <Text type="secondary">（本次最多可提：{maxWithdrawByOfflineFee}，最少提现10元）</Text>
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
                            {
                                label: (
                                    <Space>
                                        <WechatOutlined style={{color: '#07C160'}}/>
                                        <Text strong style={{color: '#07C160'}}>
                                            微信
                                        </Text>
                                        <Text type="secondary">（即将上线）</Text>
                                    </Space>
                                ),
                                value: 'WECHAT',
                                disabled: true,
                            },
                            // {
                            // label: (
                            // <Space>
                            // <AlipayOutlined style={{color: '#1677ff'}}/>
                            // <Text strong style={{color: '#1677ff'}}>
                            // 支付宝
                            // </Text>
                            // <Text type="secondary">（即将上线）</Text>
                            // </Space>
                            // ),
                            // value: 'ALIPAY',
                            // disabled: true,
                            // }
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
                        max={maxWithdrawByOfflineFee}
                        fieldProps={{
                            precision: 0,
                            step: 10,
                            placeholder: '最少提现10元',
                            addonAfter: (
                                <Button
                                    size="small"
                                    type="link"
                                    disabled={hasPending || maxWithdrawByOfflineFee <= 0}
                                    onClick={() => formRef.current?.setFieldsValue({amount: maxWithdrawByOfflineFee})}
                                >
                                    全部提现
                                </Button>
                            ),
                        }}
                        rules={[
                            {required: true, message: '请输入提现金额'},
                            {
                                validator: async (_, v) => {
                                    const n = Number(v);
                                    if (!Number.isFinite(n) || n <= 0) throw new Error('提现金额非法');
                                    if (n % 10 !== 0) throw new Error('提现金额必须是 10 的整数');
                                    if (n > maxWithdrawByOfflineFee) throw new Error(`不能提现超过 ${maxWithdrawByOfflineFee}`);
                                },
                            },
                        ]}
                    />

                    {isStaff && withdrawAmount ? (
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
                            type="warning"
                            showIcon
                            message={
                                `上月线下费用未缴：${Number(offlineFeeGuard?.bill?.remainingAmount || 0).toFixed(2)}`
                            }
                            description={
                                offlineFeeGuard?.bill?.enforceFullPayment
                                    ? '当前账单已强制全额缴纳，必须本次补齐。'
                                    : `本次可部分补缴，最低 ${offlineFeeGuard.partialMinPay}。`
                            }
                        />
                    ) : null}

                    {offlineFeeGuard.hasOutstanding && !offlineFeeGuard.canPartialPayByWalletRule ? (
                        <Alert
                            type="error"
                            showIcon
                            message="当前钱包总额度不足以支持“部分补缴”"
                            description={
                                `钱包总额度（可用+冻结）${offlineFeeGuard.walletTotal.toFixed(2)}，` +
                                `未缴金额 ${Number(offlineFeeGuard?.bill?.remainingAmount || 0).toFixed(2)}。请本次全额缴纳。`
                            }
                        />
                    ) : null}

                    {offlineFeeGuard.hasOutstanding ? (
                        <ProFormDigit
                            name="payOfflineFeeAmount"
                            label="本次补缴线下费用"
                            min={
                                offlineFeeGuard?.bill?.enforceFullPayment
                                    ? Number(offlineFeeGuard?.bill?.remainingAmount || 0)
                                    : 0
                            }
                            max={Number(offlineFeeGuard?.bill?.remainingAmount || 0)}
                            fieldProps={{
                                precision: 2,
                                step: 10,
                                addonAfter: (
                                    <Button
                                        size="small"
                                        type="link"
                                        onClick={() =>
                                            {
                                                const fullPay = Number(offlineFeeGuard?.bill?.remainingAmount || 0);
                                                const nextMax = Math.floor(Math.max(0, Number(availableBalance || 0) - fullPay) / 10) * 10;
                                                const currentAmount = Number(formRef.current?.getFieldValue('amount') || 0);

                                                formRef.current?.setFieldsValue({
                                                    payOfflineFeeAmount: fullPay,
                                                    // 若当前提现金额超限，自动收敛到联动上限，避免提交时报余额不足
                                                    amount: currentAmount > nextMax ? nextMax : currentAmount,
                                                });
                                            }
                                        }
                                    >
                                        全额缴纳
                                    </Button>
                                ),
                            }}
                            rules={[
                                {
                                    validator: async (_, v) => {
                                        const remaining = Number(offlineFeeGuard?.bill?.remainingAmount || 0);
                                        const partialMinPay = Number(offlineFeeGuard?.partialMinPay || 100);
                                        const enforce = Boolean(offlineFeeGuard?.bill?.enforceFullPayment);
                                        const n = Number(v || 0);

                                        if (remaining <= 0) return;
                                        if (!Number.isFinite(n) || n <= 0) {
                                            throw new Error(`请填写补缴金额（最低 ${partialMinPay}）`);
                                        }
                                        if (n > remaining) throw new Error('补缴金额不能超过未缴金额');
                                        if (enforce && n < remaining) throw new Error('该账单要求强制全额缴纳');
                                        if (!enforce && n < remaining && !offlineFeeGuard.canPartialPayByWalletRule) {
                                            throw new Error('当前钱包总额度不满足部分补缴条件，请全额缴纳');
                                        }
                                        if (!enforce && n < partialMinPay && n < remaining) {
                                            throw new Error(`部分补缴最低为 ${partialMinPay}`);
                                        }
                                    },
                                },
                            ]}
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
