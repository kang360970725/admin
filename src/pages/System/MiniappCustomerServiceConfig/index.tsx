import React, { useEffect, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Alert, Button, Card, Form, Image, Input, Space, Switch, Typography, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import {
  getMiniappCustomerServiceConfig,
  MiniappCustomerServiceConfig,
  upsertMiniappCustomerServiceConfig,
} from '@/services/api';
import { uploadFileToCosBySts } from '@/utils/cosUpload';

const { Paragraph, Text } = Typography;

type CustomerServiceFormValues = MiniappCustomerServiceConfig & {
  wechatReviewVersionsText?: string;
};

const defaultConfig: MiniappCustomerServiceConfig = {
  consultText: '详询客服',
  qrCodeUrl: '',
  wechatCustomerServiceEnabled: false,
  wechatCustomerServiceCorpId: '',
  wechatCustomerServiceUrl: '',
  customerServiceCardImage: '',
  wechatReviewMode: false,
  wechatReviewVersions: [],
  remark: '',
};

const MiniappCustomerServiceConfigPage: React.FC = () => {
  const [form] = Form.useForm<CustomerServiceFormValues>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const config = await getMiniappCustomerServiceConfig();
      const next = {
        ...defaultConfig,
        ...(config || {}),
        wechatReviewVersionsText: (Array.isArray(config?.wechatReviewVersions) ? config.wechatReviewVersions : []).join(', '),
      };
      form.setFieldsValue(next);
      setQrCodeUrl(String(next.qrCodeUrl || '').trim());
    } catch (error: any) {
      message.error(error?.message || '加载小程序客服配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadFileToCosBySts({
        module: 'miniapp-customer-service',
        scene: 'image',
        file,
      });
      const url = String((res as any)?.url || (res as any)?.fileUrl || '').trim();
      if (!url) throw new Error('上传结果缺少图片地址');
      form.setFieldValue('qrCodeUrl', url);
      setQrCodeUrl(url);
      message.success('客服二维码上传成功');
    } catch (error: any) {
      message.error(error?.message || '上传失败');
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const config = {
        consultText: String(values.consultText || defaultConfig.consultText).trim() || defaultConfig.consultText,
        qrCodeUrl: String(values.qrCodeUrl || '').trim(),
        wechatCustomerServiceEnabled: Boolean(values.wechatCustomerServiceEnabled),
        wechatCustomerServiceCorpId: String(values.wechatCustomerServiceCorpId || '').trim(),
        wechatCustomerServiceUrl: String(values.wechatCustomerServiceUrl || '').trim(),
        customerServiceCardImage: String(values.customerServiceCardImage || '').trim(),
        wechatReviewMode: Boolean(values.wechatReviewMode),
        wechatReviewVersions: String(values.wechatReviewVersionsText || '')
          .split(/[,，\s]+/)
          .map((item) => item.trim())
          .filter((item, index, list) => Boolean(item) && list.indexOf(item) === index),
        remark: String(values.remark || '').trim(),
      };
      await upsertMiniappCustomerServiceConfig(config);
      message.success('小程序客服配置已保存');
      await reload();
    } catch (error: any) {
      message.error(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer title="小程序客服配置">
      <Card loading={loading}>
        <Paragraph type="secondary">
          小程序咨询入口优先拉起微信客服会话并携带当前订单或服务卡片，调用失败时自动回退到企业微信二维码。
        </Paragraph>
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="微信审核模式"
          description="建议开启后同时填写本次提审版本号。小程序仅在指定版本的开发、体验或审核环境展示受限版，正式发布后会自动恢复常规版。H5 公开菜单 /menu 不受影响。"
        />

        <Form form={form} layout="vertical" initialValues={defaultConfig}>
          <Form.Item name="wechatReviewMode" label="微信审核模式" valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item
            name="wechatReviewVersionsText"
            label="审核受限版本号"
            extra="填写本次小程序构建版本号（默认取 client-miniapp/package.json 的 version，也可用 MINIAPP_BUILD_VERSION 覆盖），多个可用逗号分隔。配置后，正式 release 环境不会进入审核模式。留空则为旧的全局审核开关，请谨慎使用。"
          >
            <Input placeholder="例如：1.0.3" maxLength={200} />
          </Form.Item>

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="微信客服原生会话"
            description="需先在小程序管理后台绑定同主体企业微信客服，再填写企业 ID（CorpID）与微信客服链接。"
          />

          <Form.Item name="wechatCustomerServiceEnabled" label="启用微信客服原生会话" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>

          <Form.Item name="wechatCustomerServiceCorpId" label="企业微信 CorpID">
            <Input placeholder="例如：wwxxxxxxxxxxxxxxxx" maxLength={64} />
          </Form.Item>

          <Form.Item
            name="wechatCustomerServiceUrl"
            label="微信客服链接"
            rules={[{ type: 'url', message: '请输入完整的微信客服链接' }]}
          >
            <Input placeholder="https://work.weixin.qq.com/kfid/kfc..." />
          </Form.Item>

          <Form.Item
            name="customerServiceCardImage"
            label="默认客服卡片封面"
            rules={[{ type: 'url', message: '请输入完整的图片 URL' }]}
          >
            <Input placeholder="订单或商品没有封面时使用，可留空" />
          </Form.Item>

          <Form.Item
            name="consultText"
            label="弹窗提示文字"
            rules={[{ required: true, message: '请输入弹窗提示文字' }]}
          >
            <Input placeholder="例如：详询客服" maxLength={30} />
          </Form.Item>

          <Form.Item name="qrCodeUrl" label="客服二维码图片地址">
            <Input
              placeholder="上传后自动填充，也可手动填写图片 URL"
              onChange={(event) => setQrCodeUrl(String(event.target.value || '').trim())}
            />
          </Form.Item>

          <Form.Item label="上传客服二维码">
            <Space align="start">
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  void handleUpload(file as File);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  上传二维码
                </Button>
              </Upload>
              {qrCodeUrl ? (
                <Image width={140} src={qrCodeUrl} alt="客服二维码" style={{ borderRadius: 8 }} />
              ) : (
                <Text type="secondary">暂无二维码</Text>
              )}
            </Space>
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="仅后台可见，可记录二维码用途或更新说明" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" loading={saving} onClick={handleSave}>
                保存配置
              </Button>
              <Button onClick={reload}>重新加载</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </PageContainer>
  );
};

export default MiniappCustomerServiceConfigPage;
