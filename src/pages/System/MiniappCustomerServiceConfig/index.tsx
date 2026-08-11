import React, { useEffect, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Form, Image, Input, Space, Typography, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import {
  getMiniappCustomerServiceConfig,
  MiniappCustomerServiceConfig,
  upsertMiniappCustomerServiceConfig,
} from '@/services/api';
import { uploadFileToCosBySts } from '@/utils/cosUpload';

const { Paragraph, Text } = Typography;

const defaultConfig: MiniappCustomerServiceConfig = {
  consultText: '详询客服',
  qrCodeUrl: '',
  remark: '',
};

const MiniappCustomerServiceConfigPage: React.FC = () => {
  const [form] = Form.useForm<MiniappCustomerServiceConfig>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const config = await getMiniappCustomerServiceConfig();
      const next = { ...defaultConfig, ...(config || {}) };
      form.setFieldsValue(next);
      setQrCodeUrl(String(next.qrCodeUrl || '').trim());
    } catch (error: any) {
      message.error(error?.message || '加载客服二维码配置失败');
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
        remark: String(values.remark || '').trim(),
      };
      await upsertMiniappCustomerServiceConfig(config);
      message.success('客服二维码配置已保存');
      await reload();
    } catch (error: any) {
      message.error(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer title="客服二维码配置">
      <Card loading={loading}>
        <Paragraph type="secondary">
          该配置用于公开菜单页商品无图片详情时的弹窗提示，后续也可复用到小程序客服入口。
        </Paragraph>

        <Form form={form} layout="vertical" initialValues={defaultConfig}>
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
