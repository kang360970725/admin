import React, { useState } from 'react';
import { Alert, Button, Card, Descriptions, Empty, InputNumber, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import {
  clearMiniappWechatBindingForTest,
  getMiniappWechatBindingForTest,
  MiniappWechatBindingTestUser,
} from '@/services/api';

const WechatBindingTestPage: React.FC = () => {
  const [userId, setUserId] = useState<number>();
  const [user, setUser] = useState<MiniappWechatBindingTestUser>();
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const queryUser = async () => {
    if (!userId || userId <= 0) {
      message.warning('请输入有效的用户 ID');
      return;
    }
    setLoading(true);
    try {
      const data = await getMiniappWechatBindingForTest(userId);
      setUser(data);
    } catch (error: any) {
      setUser(undefined);
      message.error(error?.data?.message || error?.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const confirmClear = () => {
    if (!user?.id || !user.wechatBindings?.length) return;
    Modal.confirm({
      title: `确认清除用户 ${user.id} 的小程序微信绑定？`,
      content: '仅删除 MINIAPP 绑定，不删除用户、钱包、积分、优惠券或订单。该操作会记录后台操作日志。',
      okText: '确认清除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setClearing(true);
        try {
          const result = await clearMiniappWechatBindingForTest(user.id);
          message.success(result?.message || `已清除 ${result?.deletedCount || 0} 条绑定`);
          await queryUser();
        } catch (error: any) {
          message.error(error?.data?.message || error?.message || '清除失败');
          throw error;
        } finally {
          setClearing(false);
        }
      },
    });
  };

  return (
    <PageContainer title="微信绑定测试" subTitle="仅用于测试小程序首次授权与资料完善流程">
      <Alert
        type="warning"
        showIcon
        message="这是测试辅助工具，请勿用于正常解绑业务"
        description="清除后，小程序端原有 JWT 不会自动失效。请在小程序“我的 → 接口环境”切换一次以清除登录态，或在微信开发者工具中清除缓存，再重新进入授权流程。再次授权可能生成新的测试用户。"
        style={{ marginBottom: 16 }}
      />
      <Card>
        <Space wrap>
          <InputNumber
            min={1}
            precision={0}
            value={userId}
            placeholder="输入用户 ID"
            style={{ width: 240 }}
            onChange={(value) => {
              setUserId(value ? Number(value) : undefined);
              setUser(undefined);
            }}
            onPressEnter={queryUser}
          />
          <Button type="primary" loading={loading} onClick={queryUser}>查询绑定</Button>
        </Space>

        {user ? (
          <>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ marginTop: 24 }}>
              <Descriptions.Item label="用户 ID">{user.id}</Descriptions.Item>
              <Descriptions.Item label="昵称">{user.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="手机号">{user.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="用户类型">{user.userType || '-'}</Descriptions.Item>
              <Descriptions.Item label="账号状态">{user.status || '-'}</Descriptions.Item>
              <Descriptions.Item label="资料状态">
                <Tag color={user.profileCompleted ? 'green' : 'orange'}>{user.profileCompleted ? '已完善' : '待完善'}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Table
              rowKey="id"
              size="small"
              pagination={false}
              style={{ marginTop: 20 }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有小程序微信绑定" /> }}
              dataSource={user.wechatBindings || []}
              columns={[
                { title: '平台', dataIndex: 'platform', width: 100 },
                { title: 'AppID', dataIndex: 'appId' },
                { title: 'OpenID（脱敏）', dataIndex: 'openId' },
                { title: '昵称', dataIndex: 'nickname', render: (value) => value || '-' },
                { title: '最后绑定', dataIndex: 'lastBindAt', render: (value) => value ? new Date(value).toLocaleString() : '-' },
                { title: '最后登录', dataIndex: 'lastLoginAt', render: (value) => value ? new Date(value).toLocaleString() : '-' },
              ]}
            />

            <Space style={{ marginTop: 20 }}>
              <Button danger type="primary" disabled={!user.wechatBindings?.length} loading={clearing} onClick={confirmClear}>
                清除小程序微信绑定
              </Button>
              <Typography.Text type="secondary">其他微信平台绑定及用户业务数据不会受影响</Typography.Text>
            </Space>
          </>
        ) : null}
      </Card>
    </PageContainer>
  );
};

export default WechatBindingTestPage;
