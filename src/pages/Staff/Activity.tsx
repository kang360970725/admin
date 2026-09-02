import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, InputNumber, message, Modal, Row, Space, Statistic, Tabs, Tag, Typography } from 'antd';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useLocation } from 'umi';
import dayjs from 'dayjs';
import { adminGetStaffActivityStats, adminListStaffActivityCharges, adminListStaffLeaves, createMyStaffLeave, getMyStaffActivityOverview, listMyStaffActivityCharges, listMyStaffLeaves } from '@/services/api';

const statusText: Record<string, string> = { SCHEDULED: '待生效', ACTIVE: '请假中', COMPLETED: '正常结束', EARLY_ENDED: '接单提前结束', CANCELED: '已取消' };
const money = (v: any) => `¥${Number(v || 0).toFixed(2)}`;

export default function StaffActivityPage() {
  const location = useLocation();
  const adminMode = location.pathname === '/users/staff-leaves';
  const [overview, setOverview] = useState<any>({});
  const [stats, setStats] = useState<any>({});
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [form] = Form.useForm();
  const [reloadKey, setReloadKey] = useState(0);
  const load = async () => adminMode ? setStats(await adminGetStaffActivityStats()) : setOverview(await getMyStaffActivityOverview());
  useEffect(() => { void load(); }, [adminMode, reloadKey]);

  const leaveColumns: any[] = [
    ...(adminMode ? [{ title: '服务者', dataIndex: 'keyword', render: (_: any, r: any) => `${r.user?.name || '-'} ${r.user?.phone || ''}` }] : []),
    { title: '状态', dataIndex: 'status', valueEnum: statusText, render: (_: any, r: any) => <Tag>{statusText[r.status] || r.status}</Tag> },
    { title: '天数', dataIndex: 'days', search: false },
    { title: '开始时间', dataIndex: 'startAt', search: false, render: (_: any, r: any) => dayjs(r.startAt).format('YYYY-MM-DD HH:mm') },
    { title: '截止时间', dataIndex: 'endAt', search: false, render: (_: any, r: any) => dayjs(r.endAt).format('YYYY-MM-DD HH:mm') },
    { title: '实际结束', dataIndex: 'actualEndAt', search: false, render: (_: any, r: any) => r.actualEndAt ? dayjs(r.actualEndAt).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '原因', dataIndex: 'reason', search: false, ellipsis: true },
  ];
  const chargeColumns: any[] = [
    ...(adminMode ? [{ title: '服务者', dataIndex: 'keyword', render: (_: any, r: any) => `${r.user?.name || '-'} ${r.user?.phone || ''}` }] : []),
    { title: '计划扣款时间', dataIndex: 'scheduledAt', search: false, render: (_: any, r: any) => dayjs(r.scheduledAt).format('YYYY-MM-DD HH:mm') },
    { title: '闲置小时', dataIndex: 'inactivityHours', search: false },
    { title: '档位', dataIndex: 'rateTier', search: false, render: (_: any, r: any) => `${r.rateTier}元/24小时` },
    { title: '余额实扣', dataIndex: 'availableDeducted', search: false, render: (_: any, r: any) => money(r.availableDeducted) },
    { title: '保证金实扣', dataIndex: 'depositDeducted', search: false, render: (_: any, r: any) => money(r.depositDeducted) },
    { title: '自动退店', dataIndex: 'exitTriggered', search: false, render: (_: any, r: any) => r.exitTriggered ? <Tag color="red">是</Tag> : <Tag>否</Tag> },
  ];
  const table = (kind: 'leave' | 'charge') => <ProTable key={`${kind}-${reloadKey}`} rowKey="id" search={adminMode ? { labelWidth: 80 } : false} columns={kind === 'leave' ? leaveColumns : chargeColumns} request={async p => { const fn: any = adminMode ? (kind === 'leave' ? adminListStaffLeaves : adminListStaffActivityCharges) : (kind === 'leave' ? listMyStaffLeaves : listMyStaffActivityCharges); const res: any = await fn({ page: p.current, limit: p.pageSize, keyword: p.keyword, status: p.status }); return { data: res.data || [], total: Number(res.total || 0), success: true }; }} />;

  return <PageContainer title={adminMode ? '服务者请假与活跃度考核' : '请假报备'}>
    {adminMode ? <Row gutter={[12, 12]} style={{ marginBottom: 16 }}><Col xs={12} md={4}><Card><Statistic title="今日扣款人数" value={stats.userCount || 0}/></Card></Col><Col xs={12} md={4}><Card><Statistic title="扣款笔数" value={stats.chargeCount || 0}/></Card></Col><Col xs={12} md={4}><Card><Statistic title="应扣" prefix="¥" value={stats.expectedAmount || 0}/></Card></Col><Col xs={12} md={4}><Card><Statistic title="余额实扣" prefix="¥" value={stats.availableDeducted || 0}/></Card></Col><Col xs={12} md={4}><Card><Statistic title="保证金实扣" prefix="¥" value={stats.depositDeducted || 0}/></Card></Col><Col xs={12} md={4}><Card><Statistic title="自动退店" value={stats.exitCount || 0}/></Card></Col></Row> : <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}><Alert type="warning" showIcon message="请假结束后仅有16小时接单缓冲期" description="超过缓冲时间仍未产生有效存单或结单，将恢复活跃度扣款。"/><Card><Space wrap><Tag color={overview.activityAssessmentEnabled ? 'green' : 'default'}>{overview.activityAssessmentEnabled ? '活跃度考核已开启' : '活跃度考核已关闭'}</Tag><Typography.Text>下次预计扣款：{overview.activityNextChargeAt ? dayjs(overview.activityNextChargeAt).format('YYYY-MM-DD HH:mm') : '-'}</Typography.Text><Button type="primary" disabled={!overview.activityAssessmentEnabled || Boolean(overview.leave)} onClick={() => setLeaveOpen(true)}>发起请假</Button></Space></Card></Space>}
    <Tabs items={[{ key: 'leaves', label: '请假记录', children: table('leave') }, { key: 'charges', label: '活跃度扣款', children: table('charge') }]}/>
    <Modal title="发起请假" open={leaveOpen} onCancel={() => setLeaveOpen(false)} onOk={async () => { const v = await form.validateFields(); await createMyStaffLeave(v); message.success('请假报备成功'); setLeaveOpen(false); form.resetFields(); setReloadKey(x => x + 1); }}><Alert style={{ marginBottom: 16 }} type="warning" showIcon message="请假从次日00:00开始，结束后仅有16小时接单缓冲期。"/><Form form={form} layout="vertical"><Form.Item name="days" label="请假天数" rules={[{ required: true }]}><InputNumber min={1} max={60} precision={0} style={{ width: '100%' }} addonAfter="天"/></Form.Item><Form.Item name="reason" label="请假原因"><Input.TextArea maxLength={255} rows={3}/></Form.Item></Form></Modal>
  </PageContainer>;
}
