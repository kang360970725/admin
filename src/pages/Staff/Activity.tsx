import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Form, Input, InputNumber, message, Modal, Row, Space, Statistic, Tabs, Tag, Typography } from 'antd';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useAccess, useLocation } from 'umi';
import dayjs from 'dayjs';
import { adminGetStaffActivityStats, adminListStaffActivityCharges, adminListStaffLeaves, adminPreviewStaffLeaveRejection, adminRejectStaffLeave, createMyStaffLeave, getMyStaffActivityOverview, listMyStaffActivityCharges, listMyStaffLeaves } from '@/services/api';

const statusText: Record<string, string> = { SCHEDULED: '待生效', ACTIVE: '请假中', COMPLETED: '正常结束', EARLY_ENDED: '接单提前结束', CANCELED: '已取消', REJECTED: '已驳回' };
const money = (v: any) => `¥${Number(v || 0).toFixed(2)}`;

export default function StaffActivityPage() {
  const location = useLocation();
  const access = useAccess();
  const adminMode = location.pathname === '/users/staff-leaves';
  const [overview, setOverview] = useState<any>({});
  const [stats, setStats] = useState<any>({});
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [form] = Form.useForm();
  const [reloadKey, setReloadKey] = useState(0);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectRecord, setRejectRecord] = useState<any>(null);
  const [rejectPreview, setRejectPreview] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
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
    { title: '驳回原因', dataIndex: 'rejectReason', search: false, ellipsis: true, render: (v: any) => v || '-' },
    ...(adminMode && access.canRejectStaffLeave ? [{
      title: '操作', valueType: 'option', fixed: 'right', width: 90,
      render: (_: any, r: any) => ['SCHEDULED', 'ACTIVE'].includes(String(r.status)) ? <Button type="link" danger onClick={async () => {
        setRejectRecord(r); setRejectPreview(null); setRejectReason(''); setRejectOpen(true); setRejectLoading(true);
        try { setRejectPreview(await adminPreviewStaffLeaveRejection({ leaveId: Number(r.id) })); }
        catch (error: any) { message.error(error?.message || '获取驳回预算失败'); setRejectOpen(false); }
        finally { setRejectLoading(false); }
      }}>驳回</Button> : '-',
    }] : []),
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
    {adminMode ? <Row gutter={[12, 12]} style={{ marginBottom: 16 }}><Col xs={12} md={6} xl={3}><Card><Statistic title="累计实扣罚款" prefix="¥" value={stats.totalPenaltyAmount || 0} precision={2}/></Card></Col><Col xs={12} md={6} xl={3}><Card><Statistic title="累计扣款笔数" value={stats.totalChargeCount || 0}/></Card></Col><Col xs={12} md={6} xl={3}><Card><Statistic title="今日扣款人数" value={stats.userCount || 0}/></Card></Col><Col xs={12} md={6} xl={3}><Card><Statistic title="今日扣款笔数" value={stats.chargeCount || 0}/></Card></Col><Col xs={12} md={6} xl={3}><Card><Statistic title="今日应扣" prefix="¥" value={stats.expectedAmount || 0}/></Card></Col><Col xs={12} md={6} xl={3}><Card><Statistic title="今日余额实扣" prefix="¥" value={stats.availableDeducted || 0}/></Card></Col><Col xs={12} md={6} xl={3}><Card><Statistic title="今日保证金实扣" prefix="¥" value={stats.depositDeducted || 0}/></Card></Col><Col xs={12} md={6} xl={3}><Card><Statistic title="今日自动退店" value={stats.exitCount || 0}/></Card></Col></Row> : <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}><Alert type="warning" showIcon message="请假结束后仅有16小时接单缓冲期" description="超过缓冲时间仍未产生有效存单或结单，将恢复活跃度扣款。"/><Card><Space wrap><Tag color={overview.activityAssessmentEnabled ? 'green' : 'default'}>{overview.activityAssessmentEnabled ? '活跃度考核已开启' : '活跃度考核已关闭'}</Tag><Typography.Text>下次预计扣款：{overview.activityNextChargeAt ? dayjs(overview.activityNextChargeAt).format('YYYY-MM-DD HH:mm') : '-'}</Typography.Text><Button type="primary" disabled={!overview.activityAssessmentEnabled || Boolean(overview.leave)} onClick={() => setLeaveOpen(true)}>发起请假</Button></Space></Card></Space>}
    <Tabs items={[{ key: 'leaves', label: '请假记录', children: table('leave') }, { key: 'charges', label: '活跃度扣款', children: table('charge') }]}/>
    <Modal title="发起请假" open={leaveOpen} onCancel={() => setLeaveOpen(false)} onOk={async () => { const v = await form.validateFields(); await createMyStaffLeave(v); message.success('请假报备成功'); setLeaveOpen(false); form.resetFields(); setReloadKey(x => x + 1); }}><Alert style={{ marginBottom: 16 }} type="warning" showIcon message="请假从次日00:00开始，结束后仅有16小时接单缓冲期。"/><Form form={form} layout="vertical"><Form.Item name="days" label="请假天数" rules={[{ required: true }]}><InputNumber min={1} max={60} precision={0} style={{ width: '100%' }} addonAfter="天"/></Form.Item><Form.Item name="reason" label="请假原因"><Input.TextArea maxLength={255} rows={3}/></Form.Item></Form></Modal>
    <Modal
      title={`驳回请假${rejectRecord?.user?.name ? ` · ${rejectRecord.user.name}` : ''}`}
      open={rejectOpen}
      confirmLoading={rejectLoading}
      okText="确认驳回并恢复考核"
      okButtonProps={{ danger: true, disabled: !rejectPreview }}
      onCancel={() => { if (!rejectLoading) setRejectOpen(false); }}
      onOk={async () => {
        const reason = rejectReason.trim();
        if (!reason) { message.warning('请填写驳回原因'); return; }
        setRejectLoading(true);
        try {
          await adminRejectStaffLeave({ leaveId: Number(rejectRecord.id), reason });
          message.success('请假已驳回，活跃度考核已恢复并已通知服务者');
          setRejectOpen(false); setReloadKey(x => x + 1);
        } catch (error: any) { message.error(error?.message || '驳回失败'); }
        finally { setRejectLoading(false); }
      }}
    >
      {rejectPreview ? <>
        <Alert
          showIcon
          type={rejectPreview.estimate?.willChargeImmediately ? 'error' : 'warning'}
          style={{ marginBottom: 16 }}
          message={rejectPreview.estimate?.willChargeImmediately ? `驳回后将立即进入待扣款，预计扣款 ${money(rejectPreview.estimate?.estimatedPenaltyAmount)}` : '驳回后将恢复原活跃度考核时间轴'}
          description={rejectPreview.estimate?.willChargeImmediately ? '不会重新给予72小时或16小时缓冲，定时任务下一次检查时会执行扣款。' : `下次预计扣款：${dayjs(rejectPreview.estimate?.nextChargeAt).format('YYYY-MM-DD HH:mm')}`}
        />
        <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="已空闲">{rejectPreview.estimate?.inactivityDays || 0}天 {rejectPreview.estimate?.inactivityRemainingHours || 0}小时</Descriptions.Item>
          <Descriptions.Item label="预计档位">{money(rejectPreview.estimate?.estimatedPenaltyAmount)}/24小时</Descriptions.Item>
          <Descriptions.Item label="余额预计扣除">{money(rejectPreview.estimate?.estimatedAvailableDeducted)}</Descriptions.Item>
          <Descriptions.Item label="保证金预计扣除">{money(rejectPreview.estimate?.estimatedDepositDeducted)}</Descriptions.Item>
        </Descriptions>
        {rejectPreview.estimate?.mayAutoExit ? <Alert type="error" showIcon style={{ marginBottom: 16 }} message="账户余额与保证金可能不足，本次扣款可能触发自动退店"/> : null}
      </> : <Card loading />}
      <Typography.Text strong>驳回原因</Typography.Text>
      <Input.TextArea value={rejectReason} onChange={e => setRejectReason(e.target.value)} maxLength={255} showCount rows={3} placeholder="必填；该原因会随消息通知发送给服务者" style={{ marginTop: 8 }}/>
    </Modal>
  </PageContainer>;
}
