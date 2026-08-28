import React from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Descriptions, message, Modal, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { getCouponTemplates, getMemberRechargeOrders } from '@/services/api';
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

    React.useEffect(() => {
        (async () => {
            try {
                const couponRes: any = await getCouponTemplates({ page: 1, limit: 500, status: 'ACTIVE' });
                const rows = Array.isArray(couponRes?.data) ? couponRes.data : [];
                setCouponOptions(rows.map((item: any) => ({
                    value: Number(item.id),
                    label: `${item.name}（模板ID ${item.id}）`,
                })));
            } catch (_e) {
                setCouponOptions([]);
            }
        })();
    }, []);

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
        const giftPoints = Math.max(0, Math.floor(Number(record?.giftPoints ?? 0)));
        const giftGrowthValue = Math.max(0, Math.floor(Number(record?.giftGrowthValue ?? 0)));
        const baseGrowthValue = Math.max(0, Math.floor(rechargeAmount));
        const totalGrowthValue = baseGrowthValue + giftGrowthValue;
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
            `新增成长值：${baseGrowthValue} + ${giftGrowthValue} = ${totalGrowthValue}`,
            `新增积分：${giftPoints}`,
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
                { label: '新增成长值', value: `${baseGrowthValue} + ${giftGrowthValue} = ${totalGrowthValue}` },
                { label: '新增积分', value: `${giftPoints}` },
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
                    <span>赠金 {money(record?.bonusAmount)} · 积分 {Number(record?.giftPoints ?? 0)} · 成长值 {Number(record?.giftGrowthValue ?? 0)}</span>
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
            width: 100,
            render: (_: any, record: any) => [
                <Button key="receipt" type="link" size="small" onClick={() => openReceipt(record)}>
                    充值小票
                </Button>,
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
        </PageContainer>
    );
}
