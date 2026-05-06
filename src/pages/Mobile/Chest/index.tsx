import React, { useEffect, useState } from 'react';
import { Button, Card, Input, Space, Typography, message } from 'antd';
import { getChestMyStatus, postChestOpen, postChestRedeem } from '@/services/api';

const { Title, Text } = Typography;

export default function MobileChestPage() {
  const [status, setStatus] = useState<any>({ enabled: false, title: '开宝箱活动', keyCount: 0 });
  const [redeemCode, setRedeemCode] = useState('');
  const [opening, setOpening] = useState(false);
  const [rewards, setRewards] = useState<any[]>([]);

  const load = async () => {
    const resp: any = await getChestMyStatus();
    setStatus(resp || { enabled: false, title: '开宝箱活动', keyCount: 0 });
  };

  useEffect(() => {
    void load();
  }, []);

  const redeem = async () => {
    if (!redeemCode.trim()) {
      message.warning('请输入兑换码');
      return;
    }
    const resp: any = await postChestRedeem({ code: redeemCode.trim() });
    message.success(`兑换成功，+${resp?.added || 0} 把钥匙`);
    setRedeemCode('');
    await load();
  };

  const openOne = async () => {
    setOpening(true);
    try {
      const resp: any = await postChestOpen({ costKeys: 1 });
      setRewards(Array.isArray(resp?.rewards) ? resp.rewards : []);
      await load();
    } finally {
      setOpening(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fc', padding: 12 }}>
      <Card bordered={false} style={{ borderRadius: 16 }}>
        <Title level={3} style={{ marginBottom: 6 }}>{status?.title || '开宝箱活动'}</Title>
        <Text type={status?.enabled ? 'success' : 'secondary'}>
          {status?.enabled ? '活动进行中' : '活动未开启'}
        </Text>
        <div style={{ marginTop: 14, fontSize: 28, fontWeight: 700 }}>
          我的钥匙：{Number(status?.keyCount || 0)}
        </div>
      </Card>

      <Card title="兑换码换钥匙" bordered={false} style={{ borderRadius: 16, marginTop: 12 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
            placeholder="输入兑换码"
          />
          <Button type="primary" onClick={redeem}>兑换</Button>
        </Space.Compact>
      </Card>

      <Card title="开宝箱" bordered={false} style={{ borderRadius: 16, marginTop: 12 }}>
        <Button block size="large" type="primary" loading={opening} disabled={!status?.enabled} onClick={openOne}>
          消耗1把钥匙开箱
        </Button>
        <div style={{ marginTop: 10 }}>
          <Text type="secondary">说明：Demo 奖池为模拟结果，后续可替换为正式奖励策略。</Text>
        </div>
      </Card>

      <Card title="本次开箱结果" bordered={false} style={{ borderRadius: 16, marginTop: 12 }}>
        {rewards.length ? rewards.map((r, i) => (
          <div key={`${r?.name}-${i}`} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
            <Text strong>{r?.name || '-'}</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>{r?.type || '-'}</Text>
          </div>
        )) : <Text type="secondary">暂无开箱记录</Text>}
      </Card>
    </div>
  );
}

