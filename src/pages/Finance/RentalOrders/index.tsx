import React from 'react';
import { PageContainer, ProTable, ActionType } from '@ant-design/pro-components';
import { Alert, Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, message, Modal, Row, Space, Statistic, Switch, Table, Tag, theme } from 'antd';
import { history, useAccess } from '@umijs/max';
import { getRentalOrder, listRentalOrders, settleRentalOrder, voidRentalOrder } from '@/services/api';
import { apiError, yuan } from './CreateRentalOrderModal';
import { useIsMobile } from '@/utils/useIsMobile';
import './responsive.less';

const statusMap: any = { RUNNING: { text: '进行中', status: 'Processing' }, SETTLED: { text: '已结算', status: 'Success' }, VOIDED: { text: '已废除', status: 'Default' } };
const date = (s: any) => s ? String(s).slice(0, 10) : '-';
const time = (s: any) => s ? new Date(new Date(s).getTime() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ') : '-';
const transactionNames: any = { RENTAL_ORDER_PREPAY: '预扣租金', RENTAL_ORDER_DEPOSIT: '租号押金', RENTAL_ORDER_REFUND: '结算退回', RENTAL_ORDER_EXCESS_CHARGE: '租号费用溢出补差', RENTAL_ORDER_VOID_REFUND: '废除返还' };

export default function RentalOrdersPage() {
  const access = useAccess();
  const isMobile = useIsMobile(768);
  const { token } = theme.useToken();
  const actionRef = React.useRef<ActionType>();
  const [stats, setStats] = React.useState<any>({});
  const [detail, setDetail] = React.useState<any>();
  const [settling, setSettling] = React.useState<any>();
  const [voiding, setVoiding] = React.useState<any>();
  const [busy, setBusy] = React.useState(false);
  const [form] = Form.useForm();
  const [voidForm] = Form.useForm();
  const [serverOffset, setServerOffset] = React.useState(0);
  const noRefund = Form.useWatch('noRefundDifference', form);
  const refund = Form.useWatch('refundDifferenceAmount', form);
  const loss = Form.useWatch('lossAmount', form);
  const abnormal = Form.useWatch('hasAbnormalCompensation', form);
  const compensation = Form.useWatch('abnormalCompensationAmount', form);
  const actual = Number(settling?.prepaidAmount || 0) - (noRefund ? 0 : Number(refund || 0)) + Number(loss || 0) + (abnormal ? Number(compensation || 0) : 0);
  const net = Math.round((Number(settling?.prepaidAmount || 0) + Number(settling?.depositAmount || 0) - actual) * 100) / 100;
  const openDetail = async (row: any) => { try { setDetail(await getRentalOrder(row.id)); } catch (e) { message.error(apiError(e)); } };
  const canVoid = (row: any) => row.status === 'RUNNING' && Date.now() + serverOffset - new Date(row.createdAt).getTime() <= 7200000;
  const renderActions = (row: any) => <div className="rental-record-actions">
    <Button onClick={() => openDetail(row)}>详情</Button>
    {row.status === 'RUNNING' && access.canSettleRentalOrder && <Button type="primary" onClick={() => { form.resetFields(); setSettling(row); }}>结算</Button>}
    {canVoid(row) && access.canVoidRentalOrder && <Button danger onClick={() => { voidForm.resetFields(); setVoiding(row); }}>废除</Button>}
  </div>;

  return <PageContainer className="rental-page" title="租号订单">
    <Alert type="info" showIcon message={`今日统计 · ${stats.date || '-'}（上海时间，不随列表筛选变化）`} description="创建金额不含押金，废除订单不计出租统计；结算按实际结算日统计。强制结算日到期仅提示，需工作人员核实费用后结算。" style={{ marginBottom: 12 }} />
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      {[
        ['当日出租数量', stats.createdCount, false], ['当日租号金额（不含押金）', stats.rentalAmount, true],
        ['当日结算订单数量', stats.settledCount, false], ['服务者结算金额', stats.staffSettlementAmount, true], ['号主结算金额', stats.ownerSettlementAmount, true],
      ].map(([label, value, isMoney]) => <Col xs={12} lg={8} xl={4} key={String(label)}><Card size="small"><Statistic title={label} value={value || 0} precision={isMoney ? 2 : 0} prefix={isMoney ? '¥' : undefined} /></Card></Col>)}
    </Row>
    <ProTable actionRef={actionRef} rowKey="id" scroll={isMobile ? undefined : { x: 1400 }}
      search={{ labelWidth: 'auto', span: isMobile ? 24 : undefined, defaultCollapsed: false, collapseRender: isMobile ? false : undefined }}
      options={isMobile ? false : undefined} showHeader={!isMobile}
      headerTitle="租号订单记录" pagination={{ defaultPageSize: 20, simple: isMobile, showSizeChanger: !isMobile }}
      toolBarRender={() => access.canViewStaffRentalRisk ? [<Button key="create" onClick={() => history.push('/merchant-business/rental-risk')}>查询服务者并创建</Button>] : []}
      request={async ({ current, pageSize, ...params }) => {
        const result = await listRentalOrders({ page: current, limit: pageSize, ...params });
        setStats(result.stats); setServerOffset(new Date(result.serverNow).getTime() - Date.now());
        return { data: result.list, total: result.total, success: true };
      }} columns={[
        { title: '查询', dataIndex: 'search', hideInTable: true, fieldProps: { placeholder: '流水号 / 号源编号 / 服务者' } },
        { title: '仅逾期', dataIndex: 'overdue', hideInTable: true, valueType: 'select', valueEnum: { true: '是' } },
        { title: '租号流水编号', dataIndex: 'serialNo', search: false, width: 160 },
        { title: '服务者', dataIndex: 'staffNameSnapshot', search: false },
        { title: '号源编号', dataIndex: 'accountSourceNo', search: false },
        { title: '状态', dataIndex: 'status', valueEnum: statusMap },
        { title: '租金 / 押金', search: false, render: (_: any, row: any) => <>{yuan(row.prepaidAmount)} / {yuan(row.depositAmount)}</> },
        { title: '开始日期', dataIndex: 'startDate', search: false, renderText: date },
        { title: '强制结算日期', dataIndex: 'forcedSettlementDate', search: false, render: (_: any, row: any) => <>{date(row.forcedSettlementDate)} {row.status === 'RUNNING' && date(row.forcedSettlementDate) < stats.date && <Tag color="red">逾期</Tag>}</> },
        { title: '实际费用', dataIndex: 'actualAmount', search: false, renderText: (v: any) => v == null ? '-' : yuan(v) },
        { title: '创建时间', dataIndex: 'createdAt', search: false, renderText: time, width: 175 },
        { title: '操作', valueType: 'option', fixed: 'right', width: 190, render: (_: any, row: any) => [
          <a key="view" onClick={() => openDetail(row)}>详情</a>,
          row.status === 'RUNNING' && access.canSettleRentalOrder && <a key="settle" onClick={() => { form.resetFields(); setSettling(row); }}>结算</a>,
          canVoid(row) && access.canVoidRentalOrder && <a key="void" style={{ color: '#ff4d4f' }} onClick={() => { voidForm.resetFields(); setVoiding(row); }}>废除</a>,
        ].filter(Boolean) },
      ].map((column) => isMobile ? { ...column, hideInTable: true, fixed: undefined } : column).concat(isMobile ? [{
        title: '租号订单', dataIndex: 'mobileCard', search: false,
        render: (_: any, row: any) => <div className="rental-mobile-record">
          <div className="rental-record-heading"><strong>{row.serialNo}</strong><Tag color={row.status === 'RUNNING' ? 'blue' : row.status === 'SETTLED' ? 'green' : 'default'}>{statusMap[row.status]?.text}</Tag></div>
          <div className="rental-record-facts">
            <div><label>服务者</label>{row.staffNameSnapshot}</div><div><label>号源编号</label>{row.accountSourceNo}</div>
            <div><label>租金 / 押金</label>{yuan(row.prepaidAmount)} / {yuan(row.depositAmount)}</div><div><label>实际费用</label>{row.actualAmount == null ? '-' : yuan(row.actualAmount)}</div>
            <div><label>开始日期</label>{date(row.startDate)}</div><div><label>强制结算日期</label>{date(row.forcedSettlementDate)} {row.status === 'RUNNING' && date(row.forcedSettlementDate) < stats.date && <Tag color="red">逾期</Tag>}</div>
            <div style={{ gridColumn: '1 / -1' }}><label>创建时间</label>{time(row.createdAt)}</div>
          </div>{renderActions(row)}
        </div>,
      }] : []) as any} />

    <Modal className="rental-modal" title={`结算 · ${settling?.serialNo || ''}`} open={!!settling} width={720} confirmLoading={busy} okText="确认结算"
      onCancel={() => setSettling(undefined)} onOk={async () => {
        if (busy) return;
        try {
          const values = await form.validateFields(); setBusy(true);
          await settleRentalOrder(settling.id, { ...values, version: settling.version,
            refundDifferenceAmount: values.noRefundDifference ? 0 : values.refundDifferenceAmount || 0,
            abnormalCompensationAmount: values.hasAbnormalCompensation ? values.abnormalCompensationAmount || 0 : 0,
          });
          message.success('租号订单已结算'); setSettling(undefined); actionRef.current?.reload();
        } catch (e: any) { if (!e?.errorFields) message.error(apiError(e)); } finally { setBusy(false); }
      }}>
      <Row style={{ marginBottom: 16, padding: 16, background: token.colorFillAlter, borderRadius: token.borderRadiusLG }}>
        <Col span={12}><Statistic title="实际费用" value={actual} precision={2} prefix="¥" valueStyle={{ fontSize: 22 }} /></Col>
        <Col span={12}><Statistic title={net < 0 ? '本次补扣' : net > 0 ? '本次退回' : '无需补退'}
          value={Math.abs(net)} precision={2} prefix="¥"
          valueStyle={{ fontSize: 22, color: net < 0 ? token.colorError : net > 0 ? token.colorSuccess : token.colorTextSecondary }} /></Col>
      </Row>
      <Form form={form} layout="vertical" scrollToFirstError initialValues={{ noRefundDifference: true, refundDifferenceAmount: 0, lossAmount: 0, hasAbnormalCompensation: false, abnormalCompensationAmount: 0 }}>
        <section className="rental-form-section">
          <div className="rental-section-heading"><strong>租金退差</strong><span>无退差<Form.Item name="noRefundDifference" noStyle valuePropName="checked"><Switch aria-label="无退差" /></Form.Item></span></div>
          {!noRefund && <Row gutter={[16, 12]}>
            <Col xs={24} sm={8}><Form.Item name="refundDifferenceAmount" label="退差金额" rules={[{ required: true }]}><InputNumber addonBefore="¥" min={0} max={Number(settling?.prepaidAmount || 0)} precision={2} /></Form.Item></Col>
            <Col xs={24} sm={16}><Form.Item name="refundDifferenceRemark" label="退差说明" rules={[{ required: true, whitespace: true }]}><Input.TextArea placeholder="说明退差原因" autoSize={{ minRows: 2, maxRows: 4 }} maxLength={2000} /></Form.Item></Col>
          </Row>}
        </section>
        <section className="rental-form-section">
          <div className="rental-section-heading"><strong>损耗费用</strong></div>
          <Row gutter={[16, 12]}>
            <Col xs={24} sm={8}><Form.Item name="lossAmount" label="损耗金额"><InputNumber addonBefore="¥" min={0} max={99999999.99} precision={2} /></Form.Item></Col>
            <Col xs={24} sm={16}><Form.Item name="lossDetail" label="损耗详情" rules={[{ required: Number(loss) > 0, whitespace: true }]}><Input.TextArea placeholder="填写损耗项目及说明" autoSize={{ minRows: 2, maxRows: 4 }} maxLength={2000} /></Form.Item></Col>
          </Row>
        </section>
        <section className="rental-form-section">
          <div className="rental-section-heading"><strong>异常赔付</strong><Form.Item name="hasAbnormalCompensation" noStyle valuePropName="checked"><Switch aria-label="异常赔付" /></Form.Item></div>
          {abnormal && <Row gutter={[16, 12]}>
            <Col xs={24} sm={8}><Form.Item name="abnormalCompensationAmount" label="赔付金额" rules={[{ required: true }]}><InputNumber addonBefore="¥" min={0} max={99999999.99} precision={2} /></Form.Item></Col>
            <Col xs={24} sm={16}><Form.Item name="abnormalCompensationRemark" label="赔付原因及规则" rules={[{ required: true, whitespace: true }]}><Input.TextArea placeholder="填写赔付原因和适用规则" autoSize={{ minRows: 2, maxRows: 4 }} maxLength={2000} /></Form.Item></Col>
          </Row>}
        </section>
        <section className="rental-form-section">
          <div className="rental-section-heading"><strong>号主结算</strong><span style={{ color: token.colorTextSecondary }}>仅登记，不自动出款</span></div>
          <Row><Col span={24}><Form.Item name="ownerSettlementAmount" label="号主结算金额" rules={[{ required: true }]}><InputNumber addonBefore="¥" min={0} max={99999999.99} precision={2} /></Form.Item></Col></Row>
        </section>
      </Form>
    </Modal>

    <Modal className="rental-modal" title={`废除 · ${voiding?.serialNo || ''}`} open={!!voiding} confirmLoading={busy} okText="确认废除并退款" okButtonProps={{ danger: true }}
      onCancel={() => setVoiding(undefined)} onOk={async () => {
        if (busy) return;
        try { const v = await voidForm.validateFields(); setBusy(true);
          await voidRentalOrder(voiding.id, { version: voiding.version, reason: v.reason });
          message.success('已废除，租金和押金已返还'); setVoiding(undefined); actionRef.current?.reload();
        } catch (e: any) { if (!e?.errorFields) message.error(apiError(e)); } finally { setBusy(false); }
      }}>
      <Alert type="warning" message={`将返还 ${yuan(Number(voiding?.prepaidAmount || 0) + Number(voiding?.depositAmount || 0))} 至服务者可用余额。仅创建2小时内可操作，最终以服务端校验为准。`} />
      <Form form={voidForm} layout="vertical" style={{ marginTop: 16 }}><Form.Item name="reason" label="废除原因" rules={[{ required: true, whitespace: true }]}><Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} maxLength={2000} /></Form.Item></Form>
    </Modal>

    <Drawer className="rental-detail" open={!!detail} width={isMobile ? '100%' : 900} title={`订单详情 · ${detail?.serialNo || ''}`} onClose={() => setDetail(undefined)}>
      {detail && <><Descriptions bordered column={1} size="small">
        {[
          ['服务者', `${detail.staffNameSnapshot}（ID ${detail.staffUserId}）`], ['状态', statusMap[detail.status]?.text],
          ['号源编号', detail.accountSourceNo], ['预扣租金 / 押金', `${yuan(detail.prepaidAmount)} / ${yuan(detail.depositAmount)}`],
          ['开始 / 强制结算日期', `${date(detail.startDate)} / ${date(detail.forcedSettlementDate)}`],
          ['退差 / 说明', `${yuan(detail.refundDifferenceAmount)} · ${detail.refundDifferenceRemark || '-'}`],
          ['损耗 / 详情', `${yuan(detail.lossAmount)} · ${detail.lossDetail || '-'}`],
          ['异常赔付 / 原因及规则', `${detail.hasAbnormalCompensation ? yuan(detail.abnormalCompensationAmount) : '无'} · ${detail.abnormalCompensationRemark || '-'}`],
          ['实际费用', detail.actualAmount == null ? '-' : yuan(detail.actualAmount)],
          ['号主结算金额', detail.ownerSettlementAmount == null ? '-' : yuan(detail.ownerSettlementAmount)],
          ['净退款（负数为补扣）', detail.settlementNetRefund == null ? '-' : yuan(detail.settlementNetRefund)],
          ['创建时间 / 操作人', `${time(detail.createdAt)} / ${detail.createdByName || '-'}`],
          ['结算时间 / 操作人', `${time(detail.settledAt)} / ${detail.settledByName || '-'}`],
          ['废除时间 / 操作人', `${time(detail.voidedAt)} / ${detail.voidedByName || '-'}`], ['废除原因', detail.voidReason || '-'],
        ].map(([label, value]) => <Descriptions.Item key={label} label={label}>{value}</Descriptions.Item>)}
      </Descriptions>{isMobile ? <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>{(detail.transactions || []).map((r: any) => <Card size="small" key={r.id}>
        <div className="rental-mobile-record"><div className="rental-record-heading"><strong>{transactionNames[r.bizType] || r.bizType}</strong><span>{r.direction === 'IN' ? '+' : '-'}{yuan(r.amount)}</span></div>
          <div>变动后可用：{yuan(r.availableAfter)}</div><div style={{ color: token.colorTextSecondary }}>{time(r.createdAt)}</div><div style={{ marginTop: 8 }}>{r.remark || '-'}</div>
        </div></Card>)}</Space> : <Table style={{ marginTop: 20 }} size="small" rowKey="id" pagination={false} dataSource={detail.transactions} scroll={{ x: 650 }} columns={[
        { title: '流水类型', dataIndex: 'bizType', render: (v) => transactionNames[v] || v },
        { title: '金额', render: (_, r: any) => `${r.direction === 'IN' ? '+' : '-'}${yuan(r.amount)}` },
        { title: '变动后可用', dataIndex: 'availableAfter', render: yuan },
        { title: '时间', dataIndex: 'createdAt', render: time }, { title: '备注', dataIndex: 'remark' },
      ]} />}</>}
    </Drawer>
  </PageContainer>;
}
