import * as React from 'react';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Space,
  Statistic,
  Tabs,
  Tag,
  message,
} from 'antd';
import dayjs from 'dayjs';
import {
  getWalletAnomalies,
  getWalletReplayPreview,
  getWalletTransactions,
  repairWalletAnomalies,
  type WalletReplayPreview,
} from '@/services/api';
import { useLocation } from '@umijs/max';
import { maskPhone } from '@/utils/privacy';

type ReplayRow = WalletReplayPreview['replayRows'][number];
type WalletTxRow = any;

const BIZ_LABELS: Record<string, string> = {
  SETTLEMENT_EARNING: '结算收益',
  SETTLEMENT_EARNING_BASE: '基础结算收益',
  SETTLEMENT_EARNING_CARRY: '补差收益',
  SETTLEMENT_EARNING_CS: '客服收益',
  SETTLEMENT_BOMB_LOSS: '炸单扣款',
  ORDER_RENEWAL_BONUS: '续单额外分红',
  ORDER_RENEWAL_BONUS_REVERSAL: '续单分红冲正',
  RELEASE_FROZEN: '收益解冻',
  REFUND_REVERSAL: '退款冲正',
  WITHDRAW_RESERVE: '提现预扣',
  WITHDRAW_RELEASE: '提现退回',
  WITHDRAW_PAYOUT: '提现出款',
  DEPOSIT_REFUND: '押金返还',
  DEPOSIT_ADD: '押金变动',
  DEPOSIT_DEDUCT: '押金扣减',
  OFFLINE_FEE_PAYMENT: '线下费用',
  EQUIPMENT_RENTAL_FEE: '设备租赁费',
  RENTAL_ORDER_PREPAY: '租号预扣租金',
  RENTAL_ORDER_DEPOSIT: '租号订单押金',
  RENTAL_ORDER_REFUND: '租号结算退回',
  RENTAL_ORDER_EXCESS_CHARGE: '租号费用溢出补差',
  RENTAL_ORDER_VOID_REFUND: '租号废除返还',
  SETTLEMENT_REVERSAL: '结算冲正',
  SETTLEMENT_RECALC: '结算重算',
  MEMBER_RECHARGE: '会员充值',
  MEMBER_RECHARGE_BONUS: '会员充值赠送',
  MEMBER_ORDER_CONSUME: '会员订单消费',
  MEMBER_RECHARGE_REFUND: '会员充值退款',
  STAFF_EXIT_RELEASE: '退店解冻转可用',
  STAFF_EXIT_CLEAR: '退店一键清零',
};

const STATUS_LABELS: Record<string, string> = {
  FROZEN: '冻结',
  AVAILABLE: '可用',
  REVERSED: '已冲正',
  RELEASED: '已释放',
};

const DIRECTION_LABELS: Record<string, string> = {
  IN: '收入',
  OUT: '支出',
};

const formatNumber = (value: any) => Number(value || 0).toFixed(2);
const formatTime = (value: any) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--');
const bizLabel = (value: any) => BIZ_LABELS[String(value || '')] || String(value || '--');
const statusLabel = (value: any) => STATUS_LABELS[String(value || '')] || String(value || '--');
const directionLabel = (value: any) => DIRECTION_LABELS[String(value || '')] || String(value || '--');

export default function WalletReplayPreviewPage() {
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<WalletReplayPreview | null>(null);
  const [walletTxLoading, setWalletTxLoading] = React.useState(false);
  const [walletTxResult, setWalletTxResult] = React.useState<{ data: WalletTxRow[]; total: number; page: number; limit: number } | null>(null);
  const [repairLoading, setRepairLoading] = React.useState(false);
  const [repairReason, setRepairReason] = React.useState('');
  const [repairPreview, setRepairPreview] = React.useState<any>(null);
  const [repairApplied, setRepairApplied] = React.useState<any>(null);
  const [repairBlocked, setRepairBlocked] = React.useState<any>(null);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [auditResult, setAuditResult] = React.useState<any>(null);

  const loadWalletTransactions = React.useCallback(async (page = 1, limit = 50) => {
    const values = form.getFieldsValue();
    const userId = Number(values.userId);
    if (!Number.isFinite(userId) || userId <= 0) return;
    const range = values.range as [dayjs.Dayjs, dayjs.Dayjs] | undefined;

    setWalletTxLoading(true);
    try {
      const res = await getWalletTransactions({
        userId,
        page,
        limit,
        includeReleaseFrozen: true,
        startAt: range?.[0] ? range[0].startOf('day').toISOString() : undefined,
        endAt: range?.[1] ? range[1].endOf('day').toISOString() : undefined,
      });
      setWalletTxResult(res || null);
    } catch (e: any) {
      message.error(e?.message || '查询钱包流水失败');
    } finally {
      setWalletTxLoading(false);
    }
  }, [form]);

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      const userId = Number(values.userId);
      const range = values.range as [dayjs.Dayjs, dayjs.Dayjs] | undefined;

      setLoading(true);
      setRepairPreview(null);
      setRepairApplied(null);
      setRepairBlocked(null);

      const data = await getWalletReplayPreview({
        userId,
        startAt: range?.[0] ? range[0].startOf('day').toISOString() : undefined,
        endAt: range?.[1] ? range[1].endOf('day').toISOString() : undefined,
        limitMismatches: 500,
        mode: values.mode || 'full',
      });
      setResult(data || null);
      await loadWalletTransactions(1, 50);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '预核算失败');
    } finally {
      setLoading(false);
    }
  };

  const runRepair = async (apply: boolean) => {
    try {
      const values = await form.validateFields();
      const userId = Number(values.userId);
      if (!Number.isFinite(userId) || userId <= 0) {
        message.error('请输入有效的用户ID');
        return;
      }

      setRepairLoading(true);
      setRepairBlocked(null);

      const res = await repairWalletAnomalies({
        userId,
        apply,
        includeDeficitUsers: true,
        reason: repairReason.trim() || undefined,
      });

      if (apply) {
        const applied = Array.isArray(res?.appliedItems) ? res.appliedItems[0] : null;
        const blocked = Array.isArray(res?.blockedItems) ? res.blockedItems[0] : null;
        setRepairApplied(applied);
        setRepairPreview(null);
        setRepairBlocked(blocked);
        if (applied) {
          message.success('单用户修正已执行');
          await onSubmit();
        } else {
          message.error(blocked?.blockedReason || '未执行修正');
        }
        return;
      }

      const preview = Array.isArray(res?.previewItems) ? res.previewItems[0] : null;
      const blocked = Array.isArray(res?.blockedItems) ? res.blockedItems[0] : null;
      setRepairPreview(preview);
      setRepairApplied(null);
      setRepairBlocked(blocked);
      if (preview) {
        message.success('已生成单用户修正预览');
      } else {
        message.error(blocked?.blockedReason || '未生成修正预览');
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '单用户修正失败');
    } finally {
      setRepairLoading(false);
    }
  };

  const runBatchAudit = async () => {
    try {
      setAuditLoading(true);
      const res = await getWalletAnomalies({ onlyIssues: true, limit: 500 });
      setAuditResult(res || null);
      message.success('已完成批量核查');
    } catch (e: any) {
      message.error(e?.message || '批量核查失败');
    } finally {
      setAuditLoading(false);
    }
  };


  React.useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const userId = Number(params.get('userId') || 0);
    const mode = params.get('mode') || 'full';
    const autostart = params.get('autostart') === '1';

    if (!Number.isFinite(userId) || userId <= 0) return;

    form.setFieldsValue({ userId, mode });
    if (autostart) onSubmit();
  }, [form, location.search]);

  const replayColumns: any[] = [
    { title: '流水ID', dataIndex: 'id', width: 90 },
    { title: '时间', dataIndex: 'createdAt', width: 170, render: formatTime },
    { title: '类型', dataIndex: 'bizType', width: 150, render: bizLabel },
    { title: '方向', dataIndex: 'direction', width: 90, render: directionLabel },
    { title: '状态', dataIndex: 'status', width: 90, render: statusLabel },
    { title: '金额', dataIndex: 'amount', width: 100, render: formatNumber },
    {
      title: '处理结果',
      width: 120,
      render: (_: any, row: ReplayRow) => row.ignored ? <Tag color="gold">{row.ignoredReason || '忽略'}</Tag> : <Tag color="green">计入</Tag>,
    },
    {
      title: '实时总余额',
      width: 120,
      render: (_: any, row: ReplayRow) => formatNumber(row.replayTotalAfter),
    },
    {
      title: '实时可用/冻结',
      width: 180,
      render: (_: any, row: ReplayRow) => `${formatNumber(row.replayAvailableAfter)} / ${formatNumber(row.replayFrozenAfter)}`,
    },
  ];

  const walletTxColumns: any[] = [
    { title: '流水ID', dataIndex: 'id', width: 90 },
    { title: '时间', dataIndex: 'createdAt', width: 170, render: formatTime },
    { title: '类型', dataIndex: 'bizType', width: 150, render: bizLabel },
    { title: '方向', dataIndex: 'direction', width: 90, render: directionLabel },
    { title: '状态', dataIndex: 'status', width: 90, render: statusLabel },
    { title: '金额', dataIndex: 'amount', width: 100, render: formatNumber },
    {
      title: '钱包总余额',
      width: 120,
      render: (_: any, row: WalletTxRow) => formatNumber(Number(row.availableAfter || 0) + Number(row.frozenAfter || 0)),
    },
    {
      title: '可用/冻结',
      width: 180,
      render: (_: any, row: WalletTxRow) => `${formatNumber(row.availableAfter)} / ${formatNumber(row.frozenAfter)}`,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true,
      render: (value: any) => value || '--',
    },
  ];

  return (
    <PageContainer>
      <Card style={{ marginBottom: 16 }} title="批量核查">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Button type="primary" loading={auditLoading} onClick={runBatchAudit}>核查全部异常用户</Button>
          </Space>
          {auditResult?.summary ? (
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="扫描用户">{auditResult.scannedUsers}</Descriptions.Item>
              <Descriptions.Item label="风险用户">{auditResult.returnedUsers}</Descriptions.Item>
              <Descriptions.Item label="多算用户">{auditResult.summary?.deficitUsers ?? 0}</Descriptions.Item>
              <Descriptions.Item label="负余额用户">{auditResult.summary?.negativeBalanceUsers ?? 0}</Descriptions.Item>
              <Descriptions.Item label="负快照用户">{auditResult.summary?.negativeSnapshotUsers ?? 0}</Descriptions.Item>
              <Descriptions.Item label="多算总额">¥{formatNumber(auditResult.summary?.totalDeficitAmount)}</Descriptions.Item>
            </Descriptions>
          ) : null}
          {Array.isArray(auditResult?.items) && auditResult.items.length > 0 ? (
            <ProTable<any>
              rowKey="userId"
              search={false}
              options={false}
              toolBarRender={false}
              pagination={{ pageSize: 20 }}
              dataSource={auditResult.items}
              columns={[
                { title: '用户ID', dataIndex: 'userId', width: 100 },
                { title: '姓名', dataIndex: 'name', width: 120, render: (v: any) => v || '--' },
                { title: '手机', dataIndex: 'phone', width: 140, render: (v: any) => maskPhone(v) },
                { title: '当前总余额', width: 120, render: (_: any, row: any) => formatNumber(Number(row?.currentAvailable || 0) + Number(row?.currentFrozen || 0)) },
                {
                  title: '数据差额',
                  width: 180,
                  render: (_: any, row: any) => (
                    <div>
                      <div>总额 {formatNumber(row?.totalGap)}</div>
                      <div>可用 {formatNumber(row?.availableGap)} / 冻结 {formatNumber(row?.frozenGap)}</div>
                    </div>
                  ),
                },
                { title: '风险差额', dataIndex: 'totalGap', width: 120, render: formatNumber },
                {
                  title: '状态',
                  width: 120,
                  render: () => <Tag color="red">余额偏高</Tag>,
                },
                {
                  title: '操作',
                  width: 100,
                  render: (_: any, row: any) => (
                    <Button
                      type="link"
                      onClick={() => {
                        form.setFieldsValue({ userId: Number(row.userId) });
                        message.success(`已带入用户 ${row.userId}`);
                      }}
                    >
                      带入核算
                    </Button>
                  ),
                },
              ]}
            />
          ) : null}
        </Space>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" initialValues={{ mode: 'full' }}>
          <Form.Item name="userId" label="打手用户ID" rules={[{ required: true, message: '请输入用户ID' }]}>
            <InputNumber min={1} precision={0} placeholder="例如 142" style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="range" label="时间范围">
            <DatePicker.RangePicker showTime />
          </Form.Item>
          <Form.Item name="mode" label="回放口径">
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: '完整回放', value: 'full' },
                { label: '旧口径', value: 'legacy' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" loading={loading} onClick={onSubmit}>开始预核算</Button>
              <Button onClick={() => { form.resetFields(); setResult(null); setWalletTxResult(null); }}>清空</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {result ? (
        <>
          <Alert
            type={result.mode === 'full' ? 'warning' : 'info'}
            showIcon
            style={{ marginBottom: 16 }}
            message={result.mode === 'full' ? '当前为完整回放口径' : '当前为旧口径'}
            description={result.mode === 'full'
              ? '完整回放会纳入最终有效收益、提现出款和在途冻结；预扣与释放等过程态会按规则过滤。'
              : '旧口径会忽略提现与收益释放链路，只适合旧历史对比。'}
          />

          <Card style={{ marginBottom: 16 }} title="单用户修正">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Input.TextArea rows={2} value={repairReason} onChange={(e) => setRepairReason(e.target.value)} placeholder="可选：填写重放修复原因" />
              <Space wrap>
                <Button loading={repairLoading} type="primary" onClick={() => runRepair(false)}>生成重放修复预览</Button>
                <Button loading={repairLoading} danger disabled={!repairPreview || !repairPreview?.repairPreview?.canApplyByReplay} onClick={() => runRepair(true)}>确认重放修复</Button>
              </Space>
              {repairBlocked ? <Alert type="error" showIcon message="重放修复已阻断" description={repairBlocked?.blockedReason || '当前用户无法自动执行重放修复'} /> : null}
              {repairPreview?.repairPreview ? (
                <>
                  <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="修复说明">{repairPreview.repairPreview.remark}</Descriptions.Item>
                    <Descriptions.Item label="修复前">冻结 {formatNumber(repairPreview.repairPreview.currentFrozen)} / 可用 {formatNumber(repairPreview.repairPreview.currentAvailable)} / 总余额 {formatNumber(repairPreview.repairPreview.currentTotal)}</Descriptions.Item>
                    <Descriptions.Item label="修复后">冻结 {formatNumber(repairPreview.repairPreview.targetFrozen)} / 可用 {formatNumber(repairPreview.repairPreview.targetAvailable)} / 总余额 {formatNumber(repairPreview.repairPreview.targetTotal)}</Descriptions.Item>
                    <Descriptions.Item label="变动">冻结 {formatNumber(repairPreview.repairPreview.frozenDelta)} / 可用 {formatNumber(repairPreview.repairPreview.availableDelta)} / 总余额 {formatNumber(repairPreview.repairPreview.totalDelta)}</Descriptions.Item>
                  </Descriptions>
                  {!repairPreview?.repairPreview?.canApplyByReplay ? (
                    <Alert
                      type="error"
                      showIcon
                      message="本次重放修复会上调总余额，已自动阻断"
                      description={`重放总额与当前总额差值为 ${formatNumber(repairPreview?.repairPreview?.totalGap)}，存在资金风险，不能自动修复。`}
                    />
                  ) : null}
                </>
              ) : null}
              {repairApplied?.repairPreview ? <Alert type="success" showIcon message="重放修复已落库" description={repairApplied?.repairPreview?.remark} /> : null}
            </Space>
          </Card>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Card><Statistic title="当前总余额" value={result.currentBalance.total} precision={2} prefix="¥" /><div>可用 {formatNumber(result.currentBalance.available)} / 冻结 {formatNumber(result.currentBalance.frozen)}</div></Card></Col>
            <Col span={8}><Card><Statistic title="重放总余额" value={result.replayBalance.total} precision={2} prefix="¥" /><div>可用 {formatNumber(result.replayBalance.available)} / 冻结 {formatNumber(result.replayBalance.frozen)}</div></Card></Col>
            <Col span={8}><Card><Statistic title="提现总额" value={result.withdrawalSummary?.historyTotal || 0} precision={2} prefix="¥" /><div>{result.withdrawalSummary?.historyCount || 0} 笔</div></Card></Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Card><Statistic title="重放总收益" value={result.settlementSummary?.replayTotal || 0} precision={2} prefix="¥" /><div>{result.settlementSummary?.replayCount || 0} 笔</div></Card></Col>
            <Col span={8}><Card><Statistic title="重放总提现" value={result.withdrawalSummary?.replayTotal || 0} precision={2} prefix="¥" /><div>{result.withdrawalSummary?.replayCount || 0} 笔</div></Card></Col>
            <Col span={8}><Card><Statistic title="账户差额(重放-当前)" value={result.diff.total} precision={2} prefix="¥" valueStyle={{ color: Math.abs(result.diff.total) > 0.01 ? '#cf1322' : '#389e0d' }} /><div>可用 {formatNumber(result.diff.available)} / 冻结 {formatNumber(result.diff.frozen)}</div></Card></Col>
          </Row>

          <Tabs
            items={[
              {
                key: 'replay',
                label: '全部流水回放',
                children: (
                  <>
                    <Card style={{ marginBottom: 16 }} title="预核算统计">
                      <Space wrap>
                        <Tag>流水数: {result.stats.txCount}</Tag>
                        <Tag color="orange">忽略数: {result.stats.ignoredCount}</Tag>
                        <Tag color={result.stats.mismatchCount > 0 ? 'red' : 'green'}>快照不一致: {result.stats.mismatchCount}</Tag>
                        <Tag color={result.stats.negativeMoments > 0 ? 'red' : 'blue'}>负余额时刻: {result.stats.negativeMoments}</Tag>
                      </Space>
                    </Card>
                    <ProTable<ReplayRow>
                      rowKey="id"
                      search={false}
                      options={false}
                      pagination={{ pageSize: 50 }}
                      columns={replayColumns}
                      dataSource={result.replayRows || []}
                      toolBarRender={false}
                    />
                  </>
                ),
              },
              {
                key: 'wallet',
                label: '钱包流水',
                children: (
                  <ProTable<WalletTxRow>
                    rowKey="id"
                    search={false}
                    options={false}
                    loading={walletTxLoading}
                    dataSource={walletTxResult?.data || []}
                    columns={walletTxColumns}
                    toolBarRender={false}
                    pagination={{
                      current: walletTxResult?.page || 1,
                      pageSize: walletTxResult?.limit || 50,
                      total: walletTxResult?.total || 0,
                      onChange: (page, pageSize) => loadWalletTransactions(page, pageSize),
                    }}
                  />
                ),
              },
            ]}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
