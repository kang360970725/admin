import React, { useState } from 'react';
import { Button, Card, Form, Input, message, Select, Space, Typography } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { adminSendTestRealtimePush } from '@/services/api';

const mockTypeOptions = [
  { label: '打手-已派单待接单', value: 'DISPATCH_ASSIGNED' },
  { label: '客服-已存单待处理', value: 'DISPATCH_ARCHIVED' },
  { label: '客服-已结单待确认', value: 'DISPATCH_COMPLETED' },
  { label: '代班提醒', value: 'CS_DUTY_SUBSTITUTION' },
  { label: '系统公告', value: 'SYSTEM_ANNOUNCEMENT' },
  { label: '自定义', value: 'CUSTOM' },
];

const targetRoleOptions = [
  { label: '仅打手', value: 'STAFF' },
  { label: '仅客服', value: 'CUSTOMER_SERVICE' },
  { label: '打手+客服', value: 'BOTH' },
];

const NotificationTestPushPage: React.FC = () => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  return (
    <PageContainer title="测试推送中心" subTitle="实时消息，不落库，适合联调验证">
      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            targetRole: 'BOTH',
            mockType: 'DISPATCH_ASSIGNED',
            title: '[测试] 实时推送',
            content: '这是一条实时测试推送',
          }}
        >
          <Form.Item label="目标角色" name="targetRole" rules={[{ required: true, message: '请选择目标角色' }]}>
            <Select options={targetRoleOptions} />
          </Form.Item>

          <Form.Item label="消息模板" name="mockType" rules={[{ required: true, message: '请选择消息模板' }]}>
            <Select options={mockTypeOptions} />
          </Form.Item>

          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input maxLength={120} />
          </Form.Item>

          <Form.Item label="内容" name="content" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={4} maxLength={500} />
          </Form.Item>

          <Form.Item
            label="额外指定用户ID（可选，叠加到角色范围）"
            tooltip="例如：1001,1002。为空则只按角色匹配。"
            name="targetUserIdsRaw"
          >
            <Input placeholder="用英文逗号分隔，如 1001,1002" />
          </Form.Item>

          <Space>
            <Button
              type="primary"
              loading={submitting}
              onClick={async () => {
                try {
                  const values = await form.validateFields();
                  setSubmitting(true);

                  const targetUserIds = String(values.targetUserIdsRaw || '')
                    .split(',')
                    .map((x: string) => Number(x.trim()))
                    .filter((x: number) => Number.isFinite(x) && x > 0);

                  const res = await adminSendTestRealtimePush({
                    targetRole: values.targetRole,
                    mockType: values.mockType,
                    title: values.title,
                    content: values.content,
                    targetUserIds,
                  });

                  message.success(`推送完成，命中 ${Number((res as any)?.pushed || 0)} 人`);
                } catch (e: any) {
                  if (!e?.errorFields) message.error(e?.data?.message || e?.message || '发送失败');
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              发送测试推送
            </Button>
          </Space>
        </Form>

        <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
          说明：该页面用于联调实时消息中心，不创建订单、不写入持久化通知表。
        </Typography.Paragraph>
      </Card>
    </PageContainer>
  );
};

export default NotificationTestPushPage;
