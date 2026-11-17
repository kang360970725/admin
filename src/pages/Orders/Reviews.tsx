import React, { useRef, useState } from 'react';
import { PageContainer, ProTable, type ActionType } from '@ant-design/pro-components';
import { Avatar, Button, Card, Descriptions, Drawer, Empty, Rate, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from '@umijs/max';
import { getOrderReviews, type OrderReviewRecord } from '@/services/api';

const { Text, Paragraph } = Typography;

const ratingText = (score?: number) => {
    const value = Number(score || 0);
    if (value >= 4) return { text: '好评', color: 'green' };
    if (value >= 3) return { text: '中评', color: 'gold' };
    return { text: '差评', color: 'red' };
};

const Score = ({ value }: { value?: number }) => (
    <Space size={8}>
        <Rate disabled allowHalf value={Number(value || 0)} style={{ fontSize: 15 }} />
        <Text strong>{Number(value || 0).toFixed(1)}</Text>
    </Space>
);

export default function OrderReviewsPage() {
    const actionRef = useRef<ActionType>();
    const navigate = useNavigate();
    const [current, setCurrent] = useState<OrderReviewRecord>();

    return <PageContainer title="订单评价" subTitle="查看小程序提交的商品、服务者及客服评价">
        <ProTable<OrderReviewRecord>
            actionRef={actionRef}
            rowKey="id"
            search={{ labelWidth: 'auto' }}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            request={async (params) => {
                const scoreRange = String(params.rating || '');
                const res = await getOrderReviews({
                    page: params.current,
                    limit: params.pageSize,
                    keyword: params.keyword,
                    anonymous: params.anonymous === '' || params.anonymous == null ? undefined : params.anonymous === 'true',
                    scoreMin: scoreRange === 'GOOD' ? 4 : scoreRange === 'MEDIUM' ? 3 : scoreRange === 'BAD' ? 1 : undefined,
                    scoreMax: scoreRange === 'GOOD' ? 5 : scoreRange === 'MEDIUM' ? 3.99 : scoreRange === 'BAD' ? 2.99 : undefined,
                    startAt: Array.isArray(params.createdAt) ? dayjs(params.createdAt[0]).startOf('day').toISOString() : undefined,
                    endAt: Array.isArray(params.createdAt) ? dayjs(params.createdAt[1]).endOf('day').toISOString() : undefined,
                });
                return { data: res.data || [], total: res.total || 0, success: true };
            }}
            columns={[
                { title: '关键词', dataIndex: 'keyword', hideInTable: true, fieldProps: { placeholder: '订单号、项目、会员或评价内容' } },
                { title: '评价类型', dataIndex: 'rating', hideInTable: true, valueType: 'select', valueEnum: {
                    GOOD: { text: '好评（4-5分）' }, MEDIUM: { text: '中评（3-3.99分）' }, BAD: { text: '差评（1-2.99分）' },
                } },
                { title: '匿名', dataIndex: 'anonymous', hideInTable: true, valueType: 'select', valueEnum: {
                    true: { text: '匿名评价' }, false: { text: '实名评价' },
                } },
                { title: '评价时间', dataIndex: 'createdAt', valueType: 'dateRange', hideInTable: true },
                { title: '订单', width: 165, search: false, render: (_, row) => row.anonymous
                    ? <Tag>匿名保护</Tag>
                    : <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/orders/${row.orderId}`)}>{row.order?.autoSerial || `#${row.orderId}`}</Button> },
                { title: '项目', width: 150, search: false, ellipsis: true, render: (_, row) => row.project?.name || '-' },
                { title: '评价会员', width: 180, search: false, render: (_, row) => <Space>
                    {row.anonymous ? (
                        <span>匿名用户</span>
                    ) : (
                        <><Avatar size="small" src={row.user?.avatar}>{row.user?.name?.[0]}</Avatar><span>{row.user?.name || row.user?.phone || `#${row.user?.id}`}</span></>
                    )}
                </Space> },
                { title: '综合评分', width: 160, search: false, render: (_, row) => <Space><Score value={row.score} /><Tag color={ratingText(row.score).color}>{ratingText(row.score).text}</Tag></Space> },
                { title: '评价内容', search: false, ellipsis: true, render: (_, row) => row.content || <Text type="secondary">未填写文字评价</Text> },
                { title: '服务者评价', width: 105, search: false, render: (_, row) => `${row.playerEvaluations?.length || 0} 人` },
                { title: '提交时间', width: 165, search: false, render: (_, row) => dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') },
                { title: '操作', valueType: 'option', width: 80, render: (_, row) => <Button type="link" onClick={() => setCurrent(row)}>查看</Button> },
            ]}
        />
        <Drawer title="评价详情" width={680} open={Boolean(current)} onClose={() => setCurrent(undefined)}
            extra={current && !current.anonymous && current.orderId ? <Button onClick={() => navigate(`/orders/${current.orderId}`)}>查看订单</Button> : null}>
            {current ? <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card size="small" title="商品与综合评价">
                    <Descriptions size="small" column={1} bordered>
                        <Descriptions.Item label="订单">{current.anonymous ? <Tag>匿名保护</Tag> : (current.order?.autoSerial || `#${current.orderId}`)}</Descriptions.Item>
                        <Descriptions.Item label="项目">{current.project?.name || '-'}</Descriptions.Item>
                        <Descriptions.Item label="会员">{current.anonymous ? <Space><span>匿名用户</span><Tag>匿名评价</Tag></Space> : (current.user?.name || current.user?.phone || `#${current.user?.id}`)}</Descriptions.Item>
                        <Descriptions.Item label="综合评分"><Score value={current.score} /></Descriptions.Item>
                        <Descriptions.Item label="体验标签"><Space wrap>{(current.tags || []).map(tag => <Tag color="blue" key={tag}>{tag}</Tag>)}{!current.tags?.length ? '-' : null}</Space></Descriptions.Item>
                        <Descriptions.Item label="评价内容"><Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{current.content || '未填写'}</Paragraph></Descriptions.Item>
                        <Descriptions.Item label="提交时间">{dayjs(current.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                    </Descriptions>
                </Card>
                <Card size="small" title="服务者评价">
                    {current.playerEvaluations?.length ? <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {current.playerEvaluations.map(item => <Card key={item.id} size="small" type="inner" title={<Space><Avatar size="small" src={item.player?.avatar}>{item.player?.name?.[0]}</Avatar>{item.player?.name || `服务者 #${item.player?.id}`}<Tag color={ratingText(item.score).color}>{item.ratingLabel || ratingText(item.score).text}</Tag></Space>}>
                            <Descriptions size="small" column={1}>
                                <Descriptions.Item label="技术评价"><Score value={item.technicalScore} /></Descriptions.Item>
                                <Descriptions.Item label="服务评价"><Score value={item.serviceScore} /></Descriptions.Item>
                                <Descriptions.Item label="综合评价"><Score value={item.comprehensiveScore} /></Descriptions.Item>
                                <Descriptions.Item label="文字评价"><Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{item.reviewRemark || '未填写'}</Paragraph></Descriptions.Item>
                            </Descriptions>
                        </Card>)}
                    </Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有服务者评价" />}
                </Card>
                <Card size="small" title="客服评价">
                    {current.dispatcherReview ? <Descriptions size="small" column={1} bordered>
                        <Descriptions.Item label="客服">{current.dispatcherReview.dispatcherUserName || `#${current.dispatcherReview.dispatcherUserId || '-'}`}</Descriptions.Item>
                        <Descriptions.Item label="响应及时"><Score value={current.dispatcherReview.responseScore} /></Descriptions.Item>
                        <Descriptions.Item label="服务评价"><Score value={current.dispatcherReview.serviceScore} /></Descriptions.Item>
                        <Descriptions.Item label="综合评价"><Score value={current.dispatcherReview.comprehensiveScore} /></Descriptions.Item>
                        <Descriptions.Item label="文字评价"><Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{current.dispatcherReview.content || '未填写'}</Paragraph></Descriptions.Item>
                    </Descriptions> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有客服评价" />}
                </Card>
            </Space> : null}
        </Drawer>
    </PageContainer>;
}
