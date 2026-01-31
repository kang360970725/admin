import React, {useMemo, useRef, useState} from 'react';
import type {FormInstance} from 'antd';
import {Alert, Button, message, Space, Tag, Tooltip, Typography, Upload,} from 'antd';
import type {ActionType, ProColumns} from '@ant-design/pro-components';
import {
    ModalForm,
    ProFormDependency,
    ProFormDigit,
    ProFormRadio,
    ProFormTextArea,
    ProTable,
} from '@ant-design/pro-components';
import {useModel} from '@umijs/max';
import {AlipayOutlined, UploadOutlined, WechatOutlined} from '@ant-design/icons';
import {
    applyWithdrawal,
    getMyWithdrawals,
    type WalletWithdrawalRequest,
    // ✅ 新增：二维码上传/获取
    getWithdrawQrCodeUrl,
    uploadWithdrawQrCode,
} from '@/services/api';

const {Text} = Typography;

type Props = {
    availableBalance: number;
    onApplied?: () => void; // ✅ 提现申请成功后，让父组件刷新余额
};

/**
 * ✅ 我的提现（admin 里临时放：申请 + 我的记录）
 */
const WithdrawalMine: React.FC<Props> = (props) => {
    const {availableBalance, onApplied} = props;

    const actionRef = useRef<ActionType>();
    const formRef = useRef<FormInstance>();

    const {initialState} = useModel('@@initialState');
    const userId = Number((initialState as any)?.currentUser?.id || 0);

    const [open, setOpen] = useState(false);
    const [hasPending, setHasPending] = useState(false);

    // ✅ 收款二维码：仅人工审核时展示/校验
    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [qrUploading, setQrUploading] = useState(false);

    // ✅ 最大可提（本期简单：<= availableBalance，且按 10 整数）
    const maxWithdraw = useMemo(() => {
        const n = Number(availableBalance || 0);
        if (!Number.isFinite(n) || n <= 0) return 0;
        // 仅 10 的整数
        return Math.floor(n / 10) * 10;
    }, [availableBalance]);

    const genIdempotencyKey = () =>
        `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const fetchQrCodeUrl = async () => {
        try {
            setQrLoading(true);
            const res = await getWithdrawQrCodeUrl();
            setQrUrl(res?.url || null);
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

            // ✅ api.ts: uploadWithdrawQrCode(file: File)
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

    const columns: ProColumns<WalletWithdrawalRequest>[] = [
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
                                // 打开弹窗时先 reset（避免上次残留）
                                formRef.current?.resetFields();
                                setQrUrl(null);

                                // ✅ 先打开
                                setOpen(true);

                                // ✅ 默认是 MANUAL：打开弹窗就拉一次收款码（仅用于展示/校验）
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

            <ModalForm<{ amount: number; channel: 'MANUAL' | 'WECHAT' | 'ALIPAY'; remark?: string }>
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
                        if (amount > maxWithdraw) {
                            message.error(`提现金额不能超过可用余额上限（${maxWithdraw}）`);
                            return false;
                        }

                        // ✅ 仅当选择“人工审核”时：要求已上传收款码
                        const channel = (values.channel || 'MANUAL') as any;
                        if (channel === 'MANUAL') {
                            if (!qrUrl) {
                                message.error('请先上传收款二维码（仅一次）');
                                return false;
                            }
                        }

                        const idempotencyKey = genIdempotencyKey();

                        await applyWithdrawal({
                            userId,
                            amount,
                            idempotencyKey,
                            remark: values.remark || '',
                            channel,
                        });

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
                                        <Text strong>人工审核</Text>
                                        <Text type="secondary">（手动转款）</Text>
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
                            {
                                label: (
                                    <Space>
                                        <AlipayOutlined style={{color: '#1677ff'}}/>
                                        <Text strong style={{color: '#1677ff'}}>
                                            支付宝
                                        </Text>
                                        <Text type="secondary">（即将上线）</Text>
                                    </Space>
                                ),
                                value: 'ALIPAY',
                                disabled: true,
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
                                        手动转款审批时间为：每日 12:00 - 18:00。请提前上传微信收款码。请合理安排提现申请时间。
                                    </Tag>
                                    {qrUrl ? (
                                        <Alert
                                            type="success"
                                            showIcon
                                            message={<span style={{ fontSize: 13, fontWeight: 600 }}>收款二维码已上传</span>}
                                            description={<span style={{ fontSize: 12 }}>已完成配置，无需重复上传。</span>}
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
                                    onClick={() => formRef.current?.setFieldsValue({amount: maxWithdraw})}
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
                                    if (n > maxWithdraw) throw new Error(`不能提现超过 ${maxWithdraw}`);
                                },
                            },
                        ]}
                    />

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
