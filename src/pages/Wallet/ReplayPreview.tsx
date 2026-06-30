import * as React from 'react';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Card, Col, DatePicker, Descriptions, Form, Input, InputNumber, Radio, Row, Space, Statistic, Tag, message } from 'antd';
import dayjs from 'dayjs';
import { getWalletAnomalies, getWalletReplayPreview, repairWalletAnomalies, rollbackWalletRepairAdjustments, type WalletReplayPreview } from '@/services/api';
import { useLocation } from '@umijs/max';

type MismatchRow = WalletReplayPreview['mismatchRows'][number];
type NegativeRow = WalletReplayPreview['negativeRows'][number];

export default function WalletReplayPreviewPage() {
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<WalletReplayPreview | null>(null);
  const [repairLoading, setRepairLoading] = React.useState(false);
  const [repairReason, setRepairReason] = React.useState('');
  const [repairPreview, setRepairPreview] = React.useState<any>(null);
  const [repairApplied, setRepairApplied] = React.useState<any>(null);
  const [repairBlocked, setRepairBlocked] = React.useState<any>(null);
  const [rollbackLoading, setRollbackLoading] = React.useState(false);
  const [rollbackPreview, setRollbackPreview] = React.useState<any>(null);
  const [rollbackApplied, setRollbackApplied] = React.useState<any>(null);
  const [rollbackBlocked, setRollbackBlocked] = React.useState<any>(null);
  const [rollbackReason, setRollbackReason] = React.useState('');
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [auditResult, setAuditResult] = React.useState<any>(null);
  const [batchRollbackLoading, setBatchRollbackLoading] = React.useState(false);
  const [batchRollbackResult, setBatchRollbackResult] = React.useState<any>(null);

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      const userId = Number(values.userId);
      const range = values.range as [dayjs.Dayjs, dayjs.Dayjs] | undefined;

      setLoading(true);
      setRepairPreview(null);
      setRepairApplied(null);
      setRepairBlocked(null);
      setRollbackPreview(null);
      setRollbackApplied(null);
      setRollbackBlocked(null);
      const data = await getWalletReplayPreview({
        userId,
        startAt: range?.[0] ? range[0].startOf('day').toISOString() : undefined,
        endAt: range?.[1] ? range[1].endOf('day').toISOString() : undefined,
        limitMismatches: 200,
        mode: values.mode || 'full',
      });
      setResult(data || null);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '预核算失败');
    } finally {
      setLoading(false);
    }
  };

  const runRollback = async (apply: boolean) => {
    try {
      const values = await form.validateFields();
      const userId = Number(values.userId);
      if (!Number.isFinite(userId) || userId <= 0) {
        message.error('请输入有效的用户ID');
        return;
      }

      setRollbackLoading(true);
      setRollbackBlocked(null);

      const res = await rollbackWalletRepairAdjustments({
        userId,
        apply,
        onlyBalanceIncrease: true,
        reason: rollbackReason.trim() || undefined,
      });

      if (apply) {
        const applied = Array.isArray(res?.appliedItems) ? res.appliedItems[0] : null;
        const blocked = Array.isArray(res?.blockedItems) ? res.blockedItems[0] : null;
        setRollbackApplied(applied);
        setRollbackPreview(null);
        setRollbackBlocked(blocked);
        if (applied) {
          message.success('已执行异常修复回滚');
          await onSubmit();
        } else {
          message.error(blocked?.blockedReason || '未执行回滚');
        }
        return;
      }

      const preview = Array.isArray(res?.previewItems) ? res.previewItems[0] : null;
      const blocked = Array.isArray(res?.blockedItems) ? res.blockedItems[0] : null;
      setRollbackPreview(preview);
      setRollbackApplied(null);
      setRollbackBlocked(blocked);
      if (preview) {
        message.success('已生成回滚预览');
      } else {
        message.error(blocked?.blockedReason || '未找到可回滚数据');
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '生成回滚失败');
    } finally {
      setRollbackLoading(false);
    }
  };

  const columns: any[] = [
    { title: '流水ID', dataIndex: 'id', width: 90 },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
    { title: '类型', dataIndex: 'bizType', width: 160 },
    { title: '状态', dataIndex: 'status', width: 100 },
    { title: '方向', dataIndex: 'direction', width: 80 },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 100,
      render: (v: number) => Number(v || 0).toFixed(2),
    },
    {
      title: '存量可用/冻结',
      dataIndex: 'stored',
      width: 180,
      render: (_: any, r: MismatchRow) => `${Number(r.storedAvailableAfter || 0).toFixed(2)} / ${Number(r.storedFrozenAfter || 0).toFixed(2)}`,
    },
    {
      title: '重放可用/冻结',
      dataIndex: 'replay',
      width: 180,
      render: (_: any, r: MismatchRow) => `${Number(r.replayAvailableAfter || 0).toFixed(2)} / ${Number(r.replayFrozenAfter || 0).toFixed(2)}`,
    },
    {
      title: '差额(可用/冻结)',
      dataIndex: 'delta',
      width: 170,
      render: (_: any, r: MismatchRow) => {
        const da = Number(r.deltaAvailable || 0);
        const df = Number(r.deltaFrozen || 0);
        const bad = Math.abs(da) > 0.01 || Math.abs(df) > 0.01;
        return <span style={{ color: bad ? '#cf1322' : undefined }}>{da.toFixed(2)} / {df.toFixed(2)}</span>;
      },
    },
  ];

  const negativeColumns: any[] = [
    { title: '流水ID', dataIndex: 'id', width: 90 },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
    { title: '类型', dataIndex: 'bizType', width: 160 },
    { title: '状态', dataIndex: 'status', width: 100 },
    { title: '方向', dataIndex: 'direction', width: 80 },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 100,
      render: (v: number) => Number(v || 0).toFixed(2),
    },
    {
      title: '回放后可用/冻结',
      dataIndex: 'replayAfter',
      width: 190,
      render: (_: any, r: NegativeRow) =>
        `${Number(r.replayAvailableAfter || 0).toFixed(2)} / ${Number(r.replayFrozenAfter || 0).toFixed(2)}`,
    },
  ];

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
          message.success('钱包异常修复已执行');
          await onSubmit();
        } else {
          message.error(blocked?.blockedReason || '未执行修复');
        }
        return;
      }

      const preview = Array.isArray(res?.previewItems) ? res.previewItems[0] : null;
      const blocked = Array.isArray(res?.blockedItems) ? res.blockedItems[0] : null;
      setRepairPreview(preview);
      setRepairApplied(null);
      setRepairBlocked(blocked);
      if (preview) {
        message.success('已生成异常修复预览');
      } else {
        message.error(blocked?.blockedReason || '未生成修复预览');
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '钱包异常修复失败');
    } finally {
      setRepairLoading(false);
    }
  };

  const runBatchAudit = async () => {
    try {
      setAuditLoading(true);
      const res = await getWalletAnomalies({
        onlyIssues: true,
        limit: 500,
      });
      setAuditResult(res || null);
      message.success('已完成批量核查');
    } catch (e: any) {
      message.error(e?.message || '批量核查失败');
    } finally {
      setAuditLoading(false);
    }
  };

  const runBatchRollback = async (apply: boolean) => {
    try {
      setBatchRollbackLoading(true);
      const res = await rollbackWalletRepairAdjustments({
        apply,
        limit: 500,
        onlyBalanceIncrease: true,
        reason: rollbackReason.trim() || '批量回滚错误版本异常修复',
      });
      setBatchRollbackResult(res || null);
      if (apply) {
        message.success(`已执行批量回滚 ${Number(res?.appliedCount || 0)} 条`);
      } else {
        message.success(`已生成批量回滚预览 ${Number(res?.rollbackableCount || 0)} 条`);
      }
    } catch (e: any) {
      message.error(e?.message || '批量回滚失败');
    } finally {
      setBatchRollbackLoading(false);
    }
  };

  React.useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const userId = Number(params.get('userId') || 0);
    const mode = params.get('mode') || 'full';
    const autostart = params.get('autostart') === '1';

    if (!Number.isFinite(userId) || userId <= 0) return;

    form.setFieldsValue({
      userId,
      mode,
    });

    if (autostart) {
      onSubmit();
    }
  }, [form, location.search]);

  return (
    <PageContainer>
      <Card style={{ marginBottom: 16 }} title="批量核查">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space wrap>
              <Button type="primary" loading={auditLoading} onClick={runBatchAudit}>
                核查全部异常用户
              </Button>
              <Button loading={batchRollbackLoading} onClick={() => runBatchRollback(false)}>
                预览批量回滚
              </Button>
              <Button danger loading={batchRollbackLoading} onClick={() => runBatchRollback(true)}>
                执行批量回滚
              </Button>
            </Space>
          <Input.TextArea
            rows={2}
            value={rollbackReason}
            onChange={(e) => setRollbackReason(e.target.value)}
            placeholder="批量回滚原因，例如 回滚线上错误自动修复补额"
          />
          {auditResult?.summary ? (
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="扫描用户">{auditResult.scannedUsers}</Descriptions.Item>
              <Descriptions.Item label="异常用户">{auditResult.returnedUsers}</Descriptions.Item>
              <Descriptions.Item label="冻结缺口用户">{auditResult.summary?.deficitUsers ?? 0}</Descriptions.Item>
              <Descriptions.Item label="负余额用户">{auditResult.summary?.negativeBalanceUsers ?? 0}</Descriptions.Item>
              <Descriptions.Item label="负快照用户">{auditResult.summary?.negativeSnapshotUsers ?? 0}</Descriptions.Item>
              <Descriptions.Item label="缺口总额">¥{Number(auditResult.summary?.totalDeficitAmount || 0).toFixed(2)}</Descriptions.Item>
            </Descriptions>
          ) : null}
          {batchRollbackResult ? (
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="可回滚数">{batchRollbackResult.rollbackableCount ?? 0}</Descriptions.Item>
              <Descriptions.Item label="已回滚数">{batchRollbackResult.appliedCount ?? 0}</Descriptions.Item>
              <Descriptions.Item label="阻断数">{batchRollbackResult.blockedCount ?? 0}</Descriptions.Item>
              <Descriptions.Item label="仅处理补额">{batchRollbackResult.onlyBalanceIncrease ? '是' : '否'}</Descriptions.Item>
            </Descriptions>
          ) : null}
          {Array.isArray(batchRollbackResult?.previewItems) && batchRollbackResult.previewItems.length > 0 ? (
            <ProTable<any>
              rowKey={(row) => `${row.userId}-${row.sourceToken}`}
              search={false}
              options={false}
              pagination={{ pageSize: 20 }}
              dataSource={batchRollbackResult.previewItems}
              columns={[
                { title: '用户ID', dataIndex: 'userId', width: 100 },
                { title: '修复标记', dataIndex: 'sourceToken', width: 220, ellipsis: true },
                { title: '原补额', dataIndex: 'repairTotalDelta', width: 120, render: (v: any) => Number(v || 0).toFixed(2) },
                { title: '回滚后总额', dataIndex: 'targetTotal', width: 120, render: (v: any) => Number(v || 0).toFixed(2) },
                { title: '回滚说明', dataIndex: 'remark', ellipsis: true },
              ]}
            />
          ) : null}
          {Array.isArray(auditResult?.items) && auditResult.items.length > 0 ? (
            <ProTable<any>
              rowKey="userId"
              search={false}
              options={false}
              pagination={{ pageSize: 20 }}
              dataSource={auditResult.items}
              columns={[
                { title: '用户ID', dataIndex: 'userId', width: 100 },
                { title: '姓名', dataIndex: 'name', width: 140, render: (v: any) => v || '--' },
                { title: '手机', dataIndex: 'phone', width: 140, render: (v: any) => v || '--' },
                { title: '当前可用', dataIndex: 'currentAvailable', width: 120, render: (v: any) => Number(v || 0).toFixed(2) },
                { title: '当前冻结', dataIndex: 'currentFrozen', width: 120, render: (v: any) => Number(v || 0).toFixed(2) },
                { title: '缺口', dataIndex: 'deficitAmount', width: 120, render: (v: any) => Number(v || 0).toFixed(2) },
                {
                  title: '状态',
                  width: 120,
                  render: (_: any, row: any) =>
                    Number(row?.deficitAmount || 0) > 0 ? <Tag color="red">deficit</Tag> : <Tag color="gold">bucket异常</Tag>,
                },
              ]}
            />
          ) : null}
        </Space>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" initialValues={{ userId: undefined, mode: 'full' }}>
          <Form.Item name="userId" label="打手用户ID" rules={[{ required: true, message: '请输入用户ID' }]}>
            <InputNumber min={1} precision={0} placeholder="例如 10086" style={{ width: 180 }} />
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
              <Button type="primary" onClick={onSubmit} loading={loading}>
                开始预核算
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  setResult(null);
                }}
              >
                清空
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {result && (
        <>
          <Alert
            type={result.mode === 'full' ? 'warning' : 'info'}
            showIcon
            style={{ marginBottom: 16 }}
            message={result.mode === 'full' ? '当前为完整回放口径' : '当前为旧口径'}
            description={
              result.mode === 'full'
                ? '完整回放会把提现预扣、提现打款、提现释放、收益解冻全部纳入余额回放，可用于核查冻结余额被占用、负余额时刻和提现缺口。'
                : '旧口径会忽略提现预扣、提现打款、提现释放和收益解冻，仅适合历史结算口径对比，不适合排查提现冻结事故。'
            }
          />

          <Card style={{ marginBottom: 16 }} title="钱包异常修复">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Input.TextArea
                rows={2}
                value={repairReason}
                onChange={(e) => setRepairReason(e.target.value)}
                placeholder="可选：填写修复原因，例如 提现审核前修复冻结缺口 / 核对流水后修复"
              />
              <Space wrap>
                <Button loading={repairLoading} type="primary" onClick={() => runRepair(false)}>
                  生成修复预览
                </Button>
                <Button
                  loading={repairLoading}
                  danger
                  disabled={!repairPreview || !repairPreview?.repairPreview?.totalUnchanged}
                  onClick={() => runRepair(true)}
                >
                  确认异常修复
                </Button>
              </Space>

              {repairBlocked ? (
                <Alert
                  type="error"
                  showIcon
                  message="异常修复已阻断"
                  description={repairBlocked?.blockedReason || '当前用户无法自动修复，请联系研发处理。'}
                />
              ) : null}

              {repairPreview?.repairPreview ? (
                <>
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="修复说明">
                    {repairPreview.repairPreview.remark}
                  </Descriptions.Item>
                  <Descriptions.Item label="修复前">
                    冻结 {Number(repairPreview.repairPreview.currentFrozen || 0).toFixed(2)} / 可用 {Number(repairPreview.repairPreview.currentAvailable || 0).toFixed(2)} / 总余额 {Number(repairPreview.repairPreview.currentTotal || 0).toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="修复后">
                    冻结 {Number(repairPreview.repairPreview.targetFrozen || 0).toFixed(2)} / 可用 {Number(repairPreview.repairPreview.targetAvailable || 0).toFixed(2)} / 总余额 {Number(repairPreview.repairPreview.targetTotal || 0).toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="变动">
                    冻结 {Number(repairPreview.repairPreview.frozenDelta || 0).toFixed(2)} / 可用 {Number(repairPreview.repairPreview.availableDelta || 0).toFixed(2)} / 总余额 {Number(repairPreview.repairPreview.totalDelta || 0).toFixed(2)}
                  </Descriptions.Item>
                </Descriptions>
                {!repairPreview?.repairPreview?.totalUnchanged ? (
                  <Alert
                    type="error"
                    showIcon
                    message="本次修复会改动账户总余额，已自动阻断"
                    description={`重放总额与当前总额差值为 ${Number(repairPreview?.repairPreview?.totalGap || 0).toFixed(2)}，存在资金风险，不能自动修复。`}
                  />
                ) : null}
                </>
              ) : null}

              {repairApplied?.repairPreview ? (
                <Alert
                  type="success"
                  showIcon
                  message="异常修复已落库"
                  description={repairApplied?.repairPreview?.remark}
                />
              ) : null}
            </Space>
          </Card>

          <Card style={{ marginBottom: 16 }} title="异常修复回滚">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Alert
                type="warning"
                showIcon
                message="只回滚错误版本写入的异常修复流水"
                description="当前回滚只处理曾经抬高总余额的异常修复记录，不回滚正常业务流水。"
              />
              <Input.TextArea
                rows={2}
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="可选：填写回滚原因，例如 线上错误自动修复回滚 / 核对后撤销异常补额"
              />
              <Space wrap>
                <Button loading={rollbackLoading} onClick={() => runRollback(false)}>
                  生成回滚预览
                </Button>
                <Button
                  loading={rollbackLoading}
                  danger
                  disabled={!rollbackPreview || rollbackPreview?.canApply === false}
                  onClick={() => runRollback(true)}
                >
                  确认回滚
                </Button>
              </Space>

              {rollbackBlocked ? (
                <Alert
                  type="error"
                  showIcon
                  message="回滚已阻断"
                  description={rollbackBlocked?.blockedReason || '当前用户不存在可自动回滚的异常修复流水。'}
                />
              ) : null}

              {rollbackPreview ? (
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="回滚说明">{rollbackPreview.remark}</Descriptions.Item>
                  <Descriptions.Item label="原修复标记">{rollbackPreview.sourceToken}</Descriptions.Item>
                  <Descriptions.Item label="原修复抬高总额">
                    {Number(rollbackPreview.repairTotalDelta || 0).toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="当前拟回滚变动">
                    可用 {Number(rollbackPreview.availableDelta || 0).toFixed(2)} / 冻结 {Number(rollbackPreview.frozenDelta || 0).toFixed(2)} / 总余额 {Number(rollbackPreview.totalDelta || 0).toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="回滚前">
                    冻结 {Number(rollbackPreview.currentFrozen || 0).toFixed(2)} / 可用 {Number(rollbackPreview.currentAvailable || 0).toFixed(2)} / 总余额 {Number(rollbackPreview.currentTotal || 0).toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="回滚后">
                    冻结 {Number(rollbackPreview.targetFrozen || 0).toFixed(2)} / 可用 {Number(rollbackPreview.targetAvailable || 0).toFixed(2)} / 总余额 {Number(rollbackPreview.targetTotal || 0).toFixed(2)}
                  </Descriptions.Item>
                </Descriptions>
              ) : null}

              {rollbackApplied ? (
                <Alert
                  type="success"
                  showIcon
                  message="异常修复回滚已落库"
                  description={rollbackApplied?.remark || rollbackApplied?.transactions?.[0]?.remark}
                />
              ) : null}
            </Space>
          </Card>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card>
                <Statistic title="当前总余额" value={result.currentBalance.total} precision={2} prefix="¥" />
                <div>可用: {result.currentBalance.available.toFixed(2)} / 冻结: {result.currentBalance.frozen.toFixed(2)}</div>
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="重放总余额" value={result.replayBalance.total} precision={2} prefix="¥" />
                <div>可用: {result.replayBalance.available.toFixed(2)} / 冻结: {result.replayBalance.frozen.toFixed(2)}</div>
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="账户差额(重放-当前)" value={result.diff.total} precision={2} prefix="¥" valueStyle={{ color: Math.abs(result.diff.total) > 0.01 ? '#cf1322' : '#389e0d' }} />
                <div>可用: {result.diff.available.toFixed(2)} / 冻结: {result.diff.frozen.toFixed(2)}</div>
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card>
                <Statistic title="重放结算收益总和" value={result.settlementSummary?.replayTotal || 0} precision={2} prefix="¥" />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="历史结算收益总和" value={result.settlementSummary?.historyTotal || 0} precision={2} prefix="¥" />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="结算差值(重放-历史)"
                  value={result.settlementSummary?.diff || 0}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: (result.settlementSummary?.diff || 0) < 0 ? '#cf1322' : '#389e0d' }}
                />
                <div style={{ color: '#8c8c8c' }}>
                  负数=历史多结算，正数=历史少结算
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card>
                <Statistic title="重放提现总和" value={result.withdrawalSummary?.replayTotal || 0} precision={2} prefix="¥" />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="历史提现总和" value={result.withdrawalSummary?.historyTotal || 0} precision={2} prefix="¥" />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="提现差值(重放-历史)"
                  value={result.withdrawalSummary?.diff || 0}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: Math.abs(result.withdrawalSummary?.diff || 0) > 0.01 ? '#cf1322' : '#389e0d' }}
                />
              </Card>
            </Col>
          </Row>

          <Card style={{ marginBottom: 16 }} title="预核算统计">
            <Space wrap>
              <Tag>流水数: {result.stats.txCount}</Tag>
              <Tag color="orange">忽略数: {result.stats.ignoredCount}</Tag>
              <Tag color={result.stats.mismatchCount > 0 ? 'red' : 'green'}>快照不一致: {result.stats.mismatchCount}</Tag>
              <Tag color={result.stats.negativeMoments > 0 ? 'red' : 'blue'}>负余额时刻: {result.stats.negativeMoments}</Tag>
            </Space>
            <div style={{ marginTop: 12 }}>
              不改余额类型：
              <Space wrap style={{ marginLeft: 8 }}>
                {(result.stats.noBalanceBizTypes || []).map((x) => (
                  <Tag key={x}>{x}</Tag>
                ))}
              </Space>
            </div>
          </Card>

          <ProTable<NegativeRow>
            rowKey="id"
            search={false}
            options={false}
            pagination={{ pageSize: 20 }}
            columns={negativeColumns}
            dataSource={result.negativeRows || []}
            toolBarRender={false}
            headerTitle="负余额时刻（Top N）"
          />

          <ProTable<MismatchRow>
            rowKey="id"
            search={false}
            options={false}
            pagination={{ pageSize: 20 }}
            columns={columns}
            dataSource={result.mismatchRows || []}
            toolBarRender={false}
            headerTitle="快照不一致明细（Top N）"
          />
        </>
      )}
    </PageContainer>
  );
}
