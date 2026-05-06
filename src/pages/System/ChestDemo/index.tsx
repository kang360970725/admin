import React, { useEffect, useRef, useState } from 'react';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ActionType } from '@ant-design/pro-components';
import { Button, Card, Form, Input, InputNumber, Modal, QRCode, Select, Space, Switch, message } from 'antd';
import {
  getChestRewardItems,
  getChestAdminConfig,
  postChestAdminConfig,
  postChestCodeHistory,
  postChestCodeHistoryVerify,
  postChestCodeList,
  postChestCodeRedeemByAdmin,
  postChestRewardDelete,
  postChestRewardSave,
  postChestGenerateCodes,
} from '@/services/api';

export default function ChestDemoPage() {
  const formatBjt = (raw: any) => {
    if (!raw) return '-';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '-';
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const pick = (t: string) => parts.find((p) => p.type === t)?.value || '00';
    return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}`;
  };

  const formatPercent = (v: any) => {
    const n = Number(v || 0);
    if (!Number.isFinite(n) || n <= 0) return '0%';
    if (n < 0.0001) return '<0.0001%';
    if (n < 0.01) return `${n.toFixed(6)}%`;
    if (n < 1) return `${n.toFixed(4)}%`;
    return `${n.toFixed(2)}%`;
  };

  const [form] = Form.useForm();
  const [redeemForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const actionRef = useRef<ActionType>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCode, setHistoryCode] = useState('');
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [qrLink, setQrLink] = useState('');
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardForm] = Form.useForm();
  const [rewardList, setRewardList] = useState<any[]>([]);

  const loadRewards = async () => {
    const list: any = await getChestRewardItems();
    setRewardList(Array.isArray(list) ? list : []);
  };

  const loadConfig = async () => {
    const cfg: any = await getChestAdminConfig();
    form.setFieldsValue({
      title: cfg?.title || '开宝箱活动',
      enabled: !!cfg?.enabled,
      defaultKeyCount: Number(cfg?.defaultKeyCount || 1),
      genCount: 1,
    });
  };

  useEffect(() => {
    void loadConfig();
    void loadRewards();
  }, []);

  const saveConfig = async () => {
    const values = await form.validateFields();
    await postChestAdminConfig(values);
    message.success('配置已保存');
  };

  const generateCodes = async () => {
    const values = await form.validateFields(['genKeyCount', 'genPrefix']);
    setLoading(true);
    try {
      const res: any = await postChestGenerateCodes({
        count: 1,
        keyCount: Number(values.genKeyCount || 1),
        prefix: values.genPrefix || 'BX',
      });
      message.success(`已生成 ${Number(res?.count || 0)} 条抽奖码`);
      actionRef.current?.reload();
    } finally {
      setLoading(false);
    }
  };

  const generateSingleCode = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields(['genPrefix']);
      const res: any = await postChestGenerateCodes({
        count: 1,
        keyCount: 1,
        prefix: values.genPrefix || 'BX',
      });
      message.success(`已生成单次抽奖码：${res?.list?.[0]?.code || ''}`);
      actionRef.current?.reload();
    } finally {
      setLoading(false);
    }
  };

  const openHistory = async (code: string) => {
    setHistoryCode(code);
    setHistoryOpen(true);
    const res: any = await postChestCodeHistory({ code, page: 1, pageSize: 200 });
    setHistoryList(res?.list || []);
  };

  const verifyHistoryRow = async (row: any, verified: boolean) => {
    await postChestCodeHistoryVerify({
      recordId: Number(row?.id || 0),
      verified,
      remark: verified ? '后台核销' : '取消核销',
    });
    message.success(verified ? '已核销' : '已取消核销');
    if (historyCode) {
      const res: any = await postChestCodeHistory({ code: historyCode, page: 1, pageSize: 200 });
      setHistoryList(res?.list || []);
    }
  };

  const openRedeem = (code: string) => {
    setRedeemCode(code);
    redeemForm.setFieldsValue({ code, userId: undefined, phone: undefined });
    setRedeemOpen(true);
  };

  const submitRedeem = async () => {
    const values = await redeemForm.validateFields();
    await postChestCodeRedeemByAdmin({
      code: String(values.code || '').trim(),
      userId: values.userId ? Number(values.userId) : undefined,
      phone: values.phone ? String(values.phone).trim() : undefined,
    });
    message.success('后台兑换成功');
    setRedeemOpen(false);
    actionRef.current?.reload();
  };

  const openQr = (code: string) => {
    const origin = window.location.origin;
    const link = `${origin}/chest-event?code=${encodeURIComponent(String(code || '').trim())}`;
    setQrCode(code);
    setQrLink(link);
    setQrOpen(true);
  };

  const openRewardEditor = (row?: any) => {
    rewardForm.setFieldsValue({
      id: row?.id,
      name: row?.name || '',
      type: row?.type || 'COUPON',
      quantity: Number(row?.quantity || 1),
      weight: Number(row?.weight || 1),
      stock: row?.stock ?? null,
      enabled: row?.enabled !== false,
      sortOrder: Number(row?.sortOrder || 100),
      minDrawCount: Number(row?.minDrawCount || 0),
      blockBeforeDays: row?.blockBeforeDays ?? null,
      rampEveryDays: row?.rampEveryDays ?? null,
      rampStep: row?.rampStep ?? null,
      rampMaxExtra: row?.rampMaxExtra ?? null,
      dynamicMode: row?.dynamicMode || undefined,
      publicRuleText: row?.publicRuleText || '',
    });
    setRewardOpen(true);
  };

  const saveReward = async () => {
    const values = await rewardForm.validateFields();
    await postChestRewardSave(values);
    message.success('奖品配置已保存');
    setRewardOpen(false);
    await loadRewards();
  };

  const deleteReward = async (row: any) => {
    await postChestRewardDelete({ id: Number(row?.id || 0) });
    message.success('奖品已删除');
    await loadRewards();
  };

  return (
    <PageContainer>
      <Card title="活动配置" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" initialValues={{ enabled: false, defaultKeyCount: 1, genCount: 10, genKeyCount: 1, genPrefix: 'BX' }}>
          <Form.Item name="title" label="活动标题" rules={[{ required: true }]}>
            <Input style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="enabled" label="活动开关" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="defaultKeyCount" label="默认钥匙">
            <InputNumber min={1} max={999} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={saveConfig}>保存配置</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="生成抽奖码" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline">
          <Form.Item label="生成数量">
            <InputNumber value={1} disabled />
          </Form.Item>
          <Form.Item name="genKeyCount" label="每码钥匙" rules={[{ required: true }]}>
            <InputNumber min={1} max={999} />
          </Form.Item>
          <Form.Item name="genPrefix" label="前缀">
            <Input style={{ width: 100 }} maxLength={6} />
          </Form.Item>
          <Form.Item>
            <Button loading={loading} type="primary" onClick={generateCodes}>生成</Button>
          </Form.Item>
          <Form.Item>
            <Button loading={loading} onClick={generateSingleCode}>生成单次码(1次)</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="抽奖码列表">
        <ProTable<any>
          actionRef={actionRef}
          rowKey="id"
          scroll={{ x: 1700 }}
          search={{
            labelWidth: 90,
          }}
          columns={[
            { title: '抽奖码', dataIndex: 'code', copyable: true, width: 220, fixed: 'left' },
            { title: '搜索抽奖码', dataIndex: 'searchCode', hideInTable: true },
            { title: '搜索手机号', dataIndex: 'searchPhone', hideInTable: true },
            { title: '钥匙数', dataIndex: 'keyCount', width: 100 },
            {
              title: '状态',
              dataIndex: 'usageStatus',
              width: 120,
              render: (_: any, row: any) => {
                if (row?.usageStatus === 'USED') return '已使用';
                if (row?.usageStatus === 'IN_USE') return '使用中';
                return '未使用';
              },
            },
            { title: '已用次数', dataIndex: 'usedKeys', width: 100 },
            { title: '剩余次数', dataIndex: 'remainingKeys', width: 100 },
            { title: '用户', dataIndex: ['redeemedUser', 'name'], width: 140, render: (_: any, row: any) => row?.redeemedUser?.name || '-' },
            { title: '手机号', dataIndex: ['redeemedUser', 'phone'], width: 140, render: (_: any, row: any) => row?.redeemedUser?.phone || '-' },
            { title: '抽奖时间', dataIndex: 'redeemedAt', width: 180, render: (_: any, row: any) => formatBjt(row?.redeemedAt) },
            { title: '创建时间', dataIndex: 'createdAt', width: 180, render: (_: any, row: any) => formatBjt(row?.createdAt) },
            {
              title: '操作',
              valueType: 'option',
              width: 220,
              fixed: 'right',
              render: (_: any, row: any) => [
                <a key="history" onClick={() => openHistory(String(row?.code || ''))}>抽奖记录</a>,
                row?.usageStatus === 'USED' ? (
                  <span key="qr-disabled" style={{ color: '#999', cursor: 'not-allowed' }}>已使用不可生成</span>
                ) : (
                  <a key="qr" onClick={() => openQr(String(row?.code || ''))}>生成二维码</a>
                ),
              ],
            },
          ]}
          request={async (params) => {
            const resp: any = await postChestCodeList({
              page: Number(params.current || 1),
              pageSize: Number(params.pageSize || 20),
              status: 'ALL',
              code: String(params.searchCode || '').trim() || undefined,
              phone: String(params.searchPhone || '').trim() || undefined,
            });
            return {
              data: resp?.list || [],
              success: true,
              total: Number(resp?.total || 0),
            };
          }}
        />
      </Card>

      <Card title="奖池配置" style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={() => openRewardEditor()}>新增奖品</Button>
          <Button onClick={() => void loadRewards()}>刷新</Button>
        </Space>
        <ProTable<any>
          rowKey="id"
          search={false}
          options={false}
          pagination={false}
          dataSource={rewardList}
          columns={[
            { title: '排序', dataIndex: 'sortOrder', width: 80 },
            { title: '奖品', dataIndex: 'name', width: 160 },
            { title: '类型', dataIndex: 'type', width: 100 },
            { title: '数量', dataIndex: 'quantity', width: 80 },
            { title: '权重', dataIndex: 'weight', width: 80 },
            {
              title: '概率',
              dataIndex: 'probability',
              width: 120,
              render: (_: any, row: any) => formatPercent(row?.probability),
            },
            { title: '命中比', dataIndex: 'oddsText', width: 110, render: (_: any, row: any) => row?.oddsText || '-' },
            { title: '库存', dataIndex: 'stock', width: 80, render: (_: any, row: any) => (row?.stock === null ? '不限' : row?.stock) },
            { title: '最低抽次', dataIndex: 'minDrawCount', width: 90 },
            { title: '规则说明', dataIndex: 'publicRuleText', width: 220, ellipsis: true },
            { title: '启用', dataIndex: 'enabled', width: 80, render: (_: any, row: any) => (row?.enabled ? '是' : '否') },
            {
              title: '操作',
              valueType: 'option',
              width: 140,
              render: (_: any, row: any) => [
                <a key="edit" onClick={() => openRewardEditor(row)}>编辑</a>,
                <a key="del" onClick={() => void deleteReward(row)}>删除</a>,
              ],
            },
          ]}
        />
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Space>
          <span>管理端移动入口：</span>
          <a href="/m/chest" target="_blank" rel="noreferrer">/m/chest</a>
          <span style={{ marginLeft: 20 }}>外部直达链接：</span>
          <a href="/chest-event" target="_blank" rel="noreferrer">/chest-event</a>
        </Space>
      </Card>

      <Modal
        title={`抽奖码记录：${historyCode}`}
        open={historyOpen}
        onCancel={() => setHistoryOpen(false)}
        width={900}
        footer={[
          <Button key="redeem" type="primary" onClick={() => openRedeem(historyCode)}>
            后台兑换此码
          </Button>,
          <Button key="close" onClick={() => setHistoryOpen(false)}>
            关闭
          </Button>,
        ]}
      >
        <ProTable<any>
          rowKey={(r: any, i: number) => `${r?.id || 'x'}-${i}`}
          search={false}
          options={false}
          pagination={false}
          dataSource={historyList}
          columns={[
            { title: '中奖时间', dataIndex: 'createdAt', width: 180, render: (_: any, row: any) => formatBjt(row?.createdAt) },
            { title: '用户ID', dataIndex: ['user', 'id'], width: 90 },
            { title: '用户', dataIndex: ['user', 'name'], width: 120, render: (_: any, row: any) => row?.user?.name || '-' },
            { title: '手机号', dataIndex: ['user', 'phone'], width: 140, render: (_: any, row: any) => row?.user?.phone || '-' },
            { title: '抽中物品', dataIndex: 'rewardName', width: 180 },
            { title: '物品类型', dataIndex: 'rewardType', width: 120 },
            { title: '消耗钥匙', dataIndex: 'costKeys', width: 100 },
            {
              title: '核销状态',
              width: 120,
              render: (_: any, row: any) => (row?.verifiedAt ? '已核销' : '未核销'),
            },
            { title: '核销时间', dataIndex: 'verifiedAt', width: 180, render: (_: any, row: any) => formatBjt(row?.verifiedAt) },
            { title: '核销备注', dataIndex: 'verifyRemark', width: 150, render: (_: any, row: any) => row?.verifyRemark || '-' },
            {
              title: '操作',
              valueType: 'option',
              width: 120,
              render: (_: any, row: any) => [
                row?.verifiedAt ? (
                  <span key="verified" style={{ color: '#999' }}>已核销</span>
                ) : (
                  <a key="verify" onClick={() => verifyHistoryRow(row, true)}>核销</a>
                ),
              ],
            },
          ]}
        />
      </Modal>

      <Modal title={`后台发放：${redeemCode}`} open={redeemOpen} onCancel={() => setRedeemOpen(false)} onOk={submitRedeem} okText="确认发放">
        <Form form={redeemForm} layout="vertical">
          <Form.Item name="code" label="抽奖码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="userId" label="用户ID">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="与用户ID二选一，优先userId" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="奖品配置" open={rewardOpen} onCancel={() => setRewardOpen(false)} onOk={saveReward} okText="保存">
        <Form form={rewardForm} layout="vertical" initialValues={{ type: 'COUPON', quantity: 1, weight: 1, enabled: true, sortOrder: 100 }}>
          <Form.Item name="id" hidden><Input /></Form.Item>
          <Form.Item name="name" label="奖品名称" rules={[{ required: true }]}><Input maxLength={120} /></Form.Item>
          <Form.Item name="type" label="奖品类型" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '优惠券', value: 'COUPON' },
                { label: '积分', value: 'BONUS' },
                { label: '道具', value: 'ITEM' },
                { label: '游戏道具', value: 'GAME_ITEM' },
                { label: '代金券', value: 'VOUCHER' },
                { label: '抵扣券', value: 'DEDUCT_COUPON' },
                { label: '实物', value: 'PHYSICAL' },
                { label: '现金', value: 'CASH' },
              ]}
            />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="weight" label="权重(概率基数)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="stock" label="库存(空=不限)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="minDrawCount" label="最低抽奖次数"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="blockBeforeDays" label="前N天限制"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="rampEveryDays" label="每N天增加门槛"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="rampStep" label="每档增加抽次"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="rampMaxExtra" label="门槛最多增加"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="dynamicMode" label="动态模式">
            <Select allowClear options={[{ label: '随机50-500万(高概率100-200万)', value: 'WAN_50_500_PEAK_100_200' }]} />
          </Form.Item>
          <Form.Item name="publicRuleText" label="前台公示说明"><Input maxLength={255} /></Form.Item>
          <Form.Item name="sortOrder" label="排序"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`抽奖码二维码：${qrCode}`}
        open={qrOpen}
        onCancel={() => setQrOpen(false)}
        footer={[
          <Button
            key="copy"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(qrLink);
                message.success('链接已复制');
              } catch {
                message.warning('复制失败，请手动复制');
              }
            }}
          >
            复制链接
          </Button>,
          <Button key="close" type="primary" onClick={() => setQrOpen(false)}>
            关闭
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: '100%', alignItems: 'center' }}>
          <QRCode value={qrLink || '-'} size={220} />
          <Input value={qrLink} readOnly />
        </Space>
      </Modal>
    </PageContainer>
  );
}
