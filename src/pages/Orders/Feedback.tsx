import React, { useRef, useState } from 'react';
import { PageContainer, ProTable, type ActionType } from '@ant-design/pro-components';
import { Avatar, Button, Drawer, Empty, Input, message, Select, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { FeedbackTicket, getFeedbackTickets, replyFeedbackTicket, updateFeedbackTicketStatus } from '@/services/api';

const statuses: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待处理', color: 'orange' }, PROCESSING: { text: '处理中', color: 'blue' },
  REPLIED: { text: '已回复', color: 'green' }, CLOSED: { text: '已关闭', color: 'default' },
};
const categories: Record<string, string> = { BUG: '功能异常', ORDER: '订单问题', PAYMENT: '支付问题', MEMBER: '账号会员', SUGGESTION: '意见建议', OTHER: '其他' };

export default function FeedbackPage() {
  const actionRef = useRef<ActionType>();
  const [current, setCurrent] = useState<FeedbackTicket>();
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const refresh = () => actionRef.current?.reload();
  const submitReply = async () => {
    if (!current || !reply.trim()) return message.warning('请输入回复内容');
    setLoading(true);
    try { const next = await replyFeedbackTicket(current.id, reply.trim()); setCurrent(next); setReply(''); message.success('已回复用户'); refresh(); }
    catch (e: any) { message.error(e?.message || '回复失败'); } finally { setLoading(false); }
  };
  const changeStatus = async (status: string) => {
    if (!current) return;
    try { const next = await updateFeedbackTicketStatus(current.id, status); setCurrent(next); message.success('状态已更新'); refresh(); }
    catch (e: any) { message.error(e?.message || '更新失败'); }
  };
  return <PageContainer>
    <ProTable<FeedbackTicket> actionRef={actionRef} rowKey="id" pagination={{ pageSize: 20 }} search={{ labelWidth: 'auto' }}
      request={async (params) => { const res = await getFeedbackTickets({ page: params.current, limit: params.pageSize, keyword: params.keyword, status: params.status }); return { data: res.data || [], total: res.total || 0, success: true }; }}
      columns={[
        { title: '关键词', dataIndex: 'keyword', hideInTable: true },
        { title: '工单号', dataIndex: 'ticketNo', search: false, width: 190 },
        { title: '用户', search: false, width: 150, render: (_, r) => <Space><Avatar size="small" src={r.user?.avatar}>{r.user?.name?.[0]}</Avatar><span>{r.user?.name || r.user?.phone || `#${r.user?.id}`}</span></Space> },
        { title: '类型', dataIndex: 'category', search: false, width: 100, render: (v) => categories[String(v)] || String(v) },
        { title: '问题', dataIndex: 'title', search: false, ellipsis: true },
        { title: '状态', dataIndex: 'status', valueEnum: Object.fromEntries(Object.entries(statuses).map(([k, v]) => [k, { text: v.text }])), width: 110, render: (_, r) => <Tag color={statuses[r.status]?.color}>{statuses[r.status]?.text || r.status}</Tag> },
        { title: '更新时间', dataIndex: 'updatedAt', search: false, width: 170, render: (v) => dayjs(String(v)).format('YYYY-MM-DD HH:mm') },
        { title: '操作', valueType: 'option', width: 90, render: (_, r) => <Button type="link" onClick={() => setCurrent(r)}>查看/回复</Button> },
      ]} />
    <Drawer title={current?.title || '问题反馈'} width={560} open={!!current} onClose={() => setCurrent(undefined)}
      extra={<Select value={current?.status} style={{ width: 110 }} onChange={changeStatus} options={Object.entries(statuses).map(([value, x]) => ({ value, label: x.text }))} />}>
      {current ? <>
        <Space direction="vertical" size={2}><Typography.Text type="secondary">{current.ticketNo} · {categories[current.category] || current.category}</Typography.Text><Typography.Paragraph>{current.content}</Typography.Paragraph></Space>
        <div style={{ margin: '20px 0', borderTop: '1px solid #f0f0f0' }} />
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {!current.replies?.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无沟通记录" /> : current.replies.map((item) => <div key={item.id} style={{ padding: 12, borderRadius: 10, background: item.authorType === 'STAFF' ? '#eef4ff' : '#f7f7f7' }}><Space style={{ width: '100%', justifyContent: 'space-between' }}><b>{item.authorType === 'STAFF' ? `客服 · ${item.user?.name || ''}` : `用户 · ${item.user?.name || ''}`}</b><Typography.Text type="secondary">{dayjs(item.createdAt).format('MM-DD HH:mm')}</Typography.Text></Space><div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{item.content}</div></div>)}
        </Space>
        {current.status !== 'CLOSED' && <div style={{ marginTop: 24 }}><Input.TextArea rows={4} value={reply} maxLength={2000} showCount onChange={(e) => setReply(e.target.value)} placeholder="回复后用户会在小程序消息中心收到提醒"/><Button block type="primary" loading={loading} onClick={submitReply} style={{ marginTop: 12 }}>回复用户</Button></div>}
      </> : null}
    </Drawer>
  </PageContainer>;
}
