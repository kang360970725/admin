import * as React from 'react';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Card, Col, DatePicker, Form, InputNumber, Radio, Row, Space, Statistic, Tag, message } from 'antd';
import dayjs from 'dayjs';
import { getWalletReplayPreview, type WalletReplayPreview } from '@/services/api';
import { history, useLocation } from '@umijs/max';

type MismatchRow = WalletReplayPreview['mismatchRows'][number];
type NegativeRow = WalletReplayPreview['negativeRows'][number];

export default function WalletReplayPreviewPage() {
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<WalletReplayPreview | null>(null);

  const relatedOrderIds = React.useMemo(() => {
    if (!result) return [];
    const ids = new Set<number>();

    [...(result.mismatchRows || []), ...(result.negativeRows || [])].forEach((row) => {
      const orderId = Number(row?.orderId || 0);
      if (Number.isFinite(orderId) && orderId > 0) {
        ids.add(orderId);
      }
    });

    return Array.from(ids.values());
  }, [result]);

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      const userId = Number(values.userId);
      const range = values.range as [dayjs.Dayjs, dayjs.Dayjs] | undefined;

      setLoading(true);
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

          <Alert
            type={relatedOrderIds.length > 0 ? 'error' : 'info'}
            showIcon
            style={{ marginBottom: 16 }}
            message={relatedOrderIds.length > 0 ? '已找到可进入修复的关联订单' : '当前结果未定位到可直接修复的关联订单'}
            description={
              relatedOrderIds.length > 0 ? (
                <Space wrap>
                  {relatedOrderIds.slice(0, 8).map((orderId) => (
                    <Button
                      key={orderId}
                      type="primary"
                      onClick={() => history.push(`/orders/${orderId}`)}
                    >
                      前往订单#{orderId}修复
                    </Button>
                  ))}
                  {relatedOrderIds.length > 8 ? <Tag>其余 {relatedOrderIds.length - 8} 个订单请在明细表继续定位</Tag> : null}
                </Space>
              ) : (
                '当前页只有预核算能力。真正的修复动作仍在订单详情页“工具：重新结算 / 钱包对齐”中执行；若本次异常未关联订单，需要补后端用户级修复接口。'
              )
            }
          />

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
