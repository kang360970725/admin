import React from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Descriptions, Form, Input, message, Modal, Select, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { getCouponTemplates, getMemberLevelConfigs, getMemberRechargeOrders, previewMemberRechargeRefund, refundMemberRecharge } from '@/services/api';
import { generateMemberRechargeReceiptImage } from '@/utils/receiptImage';
import { maskPhone } from '@/utils/privacy';

const statusMap: Record<string, { text: string; color?: string }> = {
    PENDING: { text: '待支付', color: 'orange' },
    SUCCESS: { text: '充值成功', color: 'green' },
    FAILED: { text: '充值失败', color: 'red' },
    CLOSED: { text: '已关闭', color: 'default' },
};

const channelMap: Record<string, { text: string; color?: string }> = {
    MANUAL: { text: '后台手动', color: 'blue' },
    WECHAT: { text: '微信支付', color: 'green' },
    MINIAPP_WECHAT: { text: '小程序微信', color: 'green' },
};

const money = (value: any) => `¥${Number(value ?? 0).toFixed(2)}`;
const time = (value: any) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-');

export default function MemberRechargesPage() {
    const actionRef = React.useRef<ActionType>();
    const [receiptOpen, setReceiptOpen] = React.useState(false);
    const [receiptImage, setReceiptImage] = React.useState<string | null>(null);
    const [receiptText, setReceiptText] = React.useState('');
    const [couponOptions, setCouponOptions] = React.useState<Array<{ label: string; value: number }>>([]);
    const [levelOptions, setLevelOptions] = React.useState<any[]>([]);
    const [refundOpen, setRefundOpen] = React.useState(false);
    const [refundPreview, setRefundPreview] = React.useState<any>(null);
    const [refundLoading, setRefundLoading] = React.useState(false);
    const [refundForm] = Form.useForm();

    React.useEffect(() => {
        (async () => {
            try {
                const [couponRes, levelsRes]: any[] = await Promise.all([
                    getCouponTemplates({ page: 1, limit: 500, status: 'ACTIVE' }),
                    getMemberLevelConfigs(),
                ]);
                const rows = Array.isArray(couponRes?.data) ? couponRes.data : [];
                setCouponOptions(rows.map((item: any) => ({
                    value: Number(item.id),
                    label: `${item.name}（模板ID ${item.id}）`,
                })));
                setLevelOptions((Array.isArray(levelsRes) ? levelsRes : []).filter((item: any) => item?.enabled !== false));
            } catch (_e) {
                setCouponOptions([]);
            }
        })();
    }, []);

    const openRefund = async (record: any) => {
        try {
            setRefundLoading(true);
            const preview: any = await previewMemberRechargeRefund(Number(record.id));
            setRefundPreview(preview);
            refundForm.setFieldsValue({ levelAfterRefund: preview?.suggestedLevelCode || preview?.levelBeforeRefund, remark: '' });
            setRefundOpen(true);
        } catch (e: any) {
            message.error(e?.response?.data?.message || e?.data?.message || e?.message || '退款试算失败');
        } finally { setRefundLoading(false); }
    };

    const buildCouponText = (record: any) => {
        const rows = Array.isArray(record?.couponBenefits) ? record.couponBenefits : [];
        if (!rows.length) return '无';
        return rows
            .map((item: any) => {
                const templateId = Number(item?.templateId || 0);
                const count = Math.max(1, Math.floor(Number(item?.count || 1)));
                const label = couponOptions.find((option) => Number(option.value) === templateId)?.label || `优惠券模板ID ${templateId || '-'}`;
                return `${label.replace(/（模板ID\s*\d+）$/, '')} ×${count}`;
            })
            .join('、');
    };

    const openReceipt = async (record: any) => {
        const rechargeAmount = Number(record?.amount ?? record?.payAmount ?? 0);
        const bonusAmount = Number(record?.bonusAmount ?? 0);
        const grantedAmount = Number(record?.grantedAmount ?? rechargeAmount + bonusAmount);
        const couponText = buildCouponText(record);
        const user = record?.user || {};
        const receiptNo = record?.rechargeNo || `ID ${record?.id || '-'}`;
        const receiptTime = record?.createdAt ? dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss');
        const textLines = [
            '会员储值小票',
            `会员：${user?.name || maskPhone(user?.phone) || '-'}`,
            `手机号：${maskPhone(user?.phone)}`,
            `会员编码：${user?.memberProfile?.memberCode || '-'}`,
            `充值单号：${receiptNo}`,
            `本次储值：${money(rechargeAmount)}`,
            `赠送金额：${money(bonusAmount)}`,
            `到账合计：${money(grantedAmount)}`,
            `会员等级：独立人工维护`,
            `赠送优惠券：${couponText}`,
            `备注：${record?.remark || '-'}`,
            `操作时间：${receiptTime}`,
        ];
        const nextReceiptText = textLines.join('\n');
        const nextReceiptImage = await generateMemberRechargeReceiptImage(
            '蓝猫爽打 · 会员储值小票',
            [
                { label: '会员', value: user?.name || maskPhone(user?.phone) || '-' },
                { label: '手机号', value: maskPhone(user?.phone) },
                { label: '会员编码', value: user?.memberProfile?.memberCode || '-' },
                { label: '充值单号', value: receiptNo },
                { label: '本次储值', value: money(rechargeAmount), highlight: true },
                { label: '赠送金额', value: money(bonusAmount) },
                { label: '到账合计', value: money(grantedAmount), highlight: true },
                { label: '会员等级', value: '独立人工维护' },
                { label: '赠送优惠券', value: couponText },
                { label: '备注', value: record?.remark || '-' },
                { label: '操作时间', value: receiptTime },
            ],
            {
                subtitle: '会员储值到账凭证',
                footerTips: ['该小票用于老板核对会员储值到账。', '最终数据以后台充值记录、会员钱包流水和优惠券发放记录为准。'],
            },
        );
        setReceiptText(nextReceiptText);
        setReceiptImage(nextReceiptImage);
        setReceiptOpen(true);
    };

    const columns: ProColumns<any>[] = [
        {
            title: '关键词',
            dataIndex: 'keyword',
            hideInTable: true,
            fieldProps: { placeholder: '充值单号/会员/手机号/会员码/备注' },
        },
        {
            title: '充值时间',
            dataIndex: 'createdAtRange',
            valueType: 'dateTimeRange',
            hideInTable: true,
            search: {
                transform: (value: any) => ({
                    startAt: value?.[0],
                    endAt: value?.[1],
                }),
            },
        },
        {
            title: '充值单号',
            dataIndex: 'rechargeNo',
            width: 180,
            search: false,
            render: (_: any, record: any) => record?.rechargeNo || `ID ${record?.id || '-'}`,
        },
        {
            title: '会员',
            dataIndex: ['user', 'name'],
            width: 180,
            search: false,
            render: (_: any, record: any) => (
                <Space direction="vertical" size={0}>
                    <span>{record?.user?.name || maskPhone(record?.user?.phone)}</span>
                    <span style={{ color: '#999', fontSize: 12 }}>{maskPhone(record?.user?.phone)}</span>
                </Space>
            ),
        },
        {
            title: '会员编码',
            dataIndex: ['user', 'memberProfile', 'memberCode'],
            width: 130,
            search: false,
            render: (_: any, record: any) => record?.user?.memberProfile?.memberCode || '-',
        },
        {
            title: '充值方案',
            dataIndex: ['plan', 'title'],
            width: 150,
            search: false,
            render: (_: any, record: any) => record?.plan?.title || '-',
        },
        {
            title: '支付金额',
            dataIndex: 'payAmount',
            width: 110,
            search: false,
            render: (value: any) => money(value),
        },
        {
            title: '到账合计',
            dataIndex: 'grantedAmount',
            width: 110,
            search: false,
            render: (value: any) => <span style={{ color: '#1677ff', fontWeight: 600 }}>{money(value)}</span>,
        },
        {
            title: '赠送权益',
            dataIndex: 'benefits',
            width: 240,
            search: false,
            render: (_: any, record: any) => (
                <Space direction="vertical" size={0}>
                    <span>赠送余额 {money(record?.bonusAmount)}</span>
                    <span style={{ color: '#999', fontSize: 12 }}>{buildCouponText(record)}</span>
                </Space>
            ),
        },
        {
            title: '渠道',
            dataIndex: 'channel',
            width: 110,
            valueEnum: {
                MANUAL: { text: '后台手动' },
                WECHAT: { text: '微信支付' },
                MINIAPP_WECHAT: { text: '小程序微信' },
            },
            render: (_: any, record: any) => {
                const meta = channelMap[String(record?.channel || '').toUpperCase()] || { text: record?.channel || '-', color: 'default' };
                return <Tag color={meta.color}>{meta.text}</Tag>;
            },
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 110,
            valueEnum: {
                PENDING: { text: '待支付' },
                SUCCESS: { text: '充值成功' },
                FAILED: { text: '充值失败' },
                CLOSED: { text: '已关闭' },
            },
            render: (_: any, record: any) => {
                const meta = statusMap[String(record?.status || '').toUpperCase()] || { text: record?.status || '-', color: 'default' };
                return <Tag color={meta.color}>{meta.text}</Tag>;
            },
        },
        {
            title: '充值时间',
            dataIndex: 'createdAt',
            width: 170,
            search: false,
            render: (value: any) => time(value),
        },
        {
            title: '操作',
            valueType: 'option',
            width: 180,
            render: (_: any, record: any) => [
                <Button key="receipt" type="link" size="small" onClick={() => openReceipt(record)}>
                    充值小票
                </Button>,
                record?.status === 'SUCCESS' && !(Array.isArray(record?.refunds) && record.refunds.length) ? (
                    <Button key="refund" danger type="link" size="small" loading={refundLoading} onClick={() => openRefund(record)}>退款</Button>
                ) : null,
                Array.isArray(record?.refunds) && record.refunds.length ? <Tag key="refunded" color="red">已退款</Tag> : null,
            ],
        },
    ];

    return (
        <PageContainer>
            <ProTable
                rowKey="id"
                actionRef={actionRef}
                columns={columns}
                scroll={{ x: 1500 }}
                request={async (params) => {
                    const res: any = await getMemberRechargeOrders({
                        page: params.current,
                        limit: params.pageSize,
                        keyword: params.keyword,
                        status: params.status,
                        channel: params.channel,
                        startAt: params.startAt,
                        endAt: params.endAt,
                    });
                    return {
                        data: Array.isArray(res?.data) ? res.data : [],
                        total: Number(res?.total || 0),
                        success: true,
                    };
                }}
                pagination={{ defaultPageSize: 20, showSizeChanger: true }}
                search={{ labelWidth: 90 }}
            />

            <Modal
                title="会员储值小票"
                open={receiptOpen}
                onCancel={() => setReceiptOpen(false)}
                width={560}
                footer={[
                    <Button
                        key="copy"
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(receiptText);
                                message.success('小票文字已复制');
                            } catch (_e) {
                                message.warning('当前浏览器不支持直接复制，请手动复制小票内容');
                            }
                        }}
                    >
                        复制文字
                    </Button>,
                    <Button key="close" type="primary" onClick={() => setReceiptOpen(false)}>
                        关闭
                    </Button>,
                ]}
            >
                {receiptImage ? (
                    <img
                        src={receiptImage}
                        alt="会员储值小票"
                        style={{ width: '100%', borderRadius: 12, border: '1px solid #f0f0f0' }}
                    />
                ) : (
                    <Descriptions column={1} size="small" bordered>
                        {receiptText.split('\n').map((line) => {
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
                title="会员充值退款确认"
                open={refundOpen}
                width={680}
                destroyOnClose
                onCancel={() => { setRefundOpen(false); setRefundPreview(null); refundForm.resetFields(); }}
                okText="确认退款并调整等级"
                okButtonProps={{ danger: true, disabled: !refundPreview?.canRefund }}
                onOk={async () => {
                    try {
                        const values = await refundForm.validateFields();
                        setRefundLoading(true);
                        await refundMemberRecharge(Number(refundPreview?.orderId), values);
                        message.success('退款记录已生成，余额和会员等级已同步调整');
                        setRefundOpen(false); setRefundPreview(null); refundForm.resetFields(); actionRef.current?.reload();
                    } catch (e: any) {
                        if (!e?.errorFields) message.error(e?.response?.data?.message || e?.data?.message || e?.message || '退款失败');
                    } finally { setRefundLoading(false); }
                }}
                confirmLoading={refundLoading}
            >
                {refundPreview ? <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    {!refundPreview.canRefund ? <Alert type="error" showIcon message="当前钱包余额不足以收回本次充值剩余资产，暂不可退款" /> : null}
                    <Descriptions bordered size="small" column={2}>
                        <Descriptions.Item label="原充值本金">{money(refundPreview.originalPrincipal)}</Descriptions.Item>
                        <Descriptions.Item label="已消费本金">{money(refundPreview.consumedPrincipal)}</Descriptions.Item>
                        <Descriptions.Item label="剩余本金">{money(refundPreview.principalRemaining)}</Descriptions.Item>
                        <Descriptions.Item label="收回赠送金">{money(refundPreview.recoveredBonus)}</Descriptions.Item>
                        <Descriptions.Item label="已使用权益价值">-{money(refundPreview.usedBenefitValue)}</Descriptions.Item>
                        <Descriptions.Item label="其中已用赠券优惠">-{money(refundPreview.usedCouponValue)}</Descriptions.Item>
                        <Descriptions.Item label="待作废赠券">{Number(refundPreview.unusedCouponCount || 0)}张</Descriptions.Item>
                        <Descriptions.Item label="可退本金">{money(refundPreview.refundablePrincipal)}</Descriptions.Item>
                        <Descriptions.Item label="30%服务费">-{money(refundPreview.serviceFeeAmount)}</Descriptions.Item>
                        <Descriptions.Item label="实际退款"><strong style={{ color: '#cf1322' }}>{money(refundPreview.actualRefundAmount)}</strong></Descriptions.Item>
                        <Descriptions.Item label="退款前等级">{refundPreview.levelBeforeRefund}</Descriptions.Item>
                        <Descriptions.Item label="建议回退等级">{refundPreview.suggestedLevelCode}</Descriptions.Item>
                    </Descriptions>
                    <Form form={refundForm} layout="vertical">
                        <Form.Item name="levelAfterRefund" label="退款后会员等级" rules={[{ required: true, message: '请选择退款后的会员等级' }]}>
                            <Select options={levelOptions.map((item: any) => ({ label: `${item.code} · ${item.name}`, value: item.code }))} />
                        </Form.Item>
                        <Form.Item name="remark" label="退款原因" rules={[{ required: true, message: '请填写退款原因' }]}>
                            <Input.TextArea rows={3} maxLength={255} />
                        </Form.Item>
                    </Form>
                    <Alert type="warning" showIcon message="确认后将收回该资金批次的剩余本金和赠送金，并按所选等级记录人工降级。实际退款需按页面金额完成线下出款。" />
                </Space> : null}
            </Modal>
        </PageContainer>
    );
}
