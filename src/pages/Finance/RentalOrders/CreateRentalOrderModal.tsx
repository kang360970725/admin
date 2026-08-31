import React from 'react';
import { Col, DatePicker, Form, Input, InputNumber, message, Modal, Row, Statistic, theme } from 'antd';
import { useIsMobile } from '@/utils/useIsMobile';
import './responsive.less';
import dayjs from 'dayjs';
import { createRentalOrder } from '@/services/api';

export const apiError = (e: any) => e?.data?.message || e?.response?.data?.message || e?.message || '操作失败';
export const yuan = (n: any) => `¥${Number(n || 0).toFixed(2)}`;
export function defaultRentalStart(now = new Date()) {
  const local = new Date(now.getTime() + 8 * 3600000);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnight + (local.getTime() - midnight > 14 * 3600000 ? 86400000 : 0)).toISOString().slice(0, 10);
}

export default function CreateRentalOrderModal({ staff, onClose, onSuccess }: {
  staff: any; onClose: () => void; onSuccess: () => void;
}) {
  const [form] = Form.useForm();
  const isMobile = useIsMobile(768);
  const { token } = theme.useToken();
  const [saving, setSaving] = React.useState(false);
  const prepaid = Form.useWatch('prepaidAmount', form);
  const deposit = Form.useWatch('depositAmount', form);
  const total = Math.round((Number(prepaid || 0) + Number(deposit || 0)) * 100) / 100;
  const available = Number(staff?.wallet?.availableBalance || 0);
  const earning = Number(staff?.wallet?.earningFrozenBalance ?? staff?.wallet?.nonWithdrawFrozenBalance ?? 0);
  const assets = available + earning;
  const start = defaultRentalStart();
  React.useEffect(() => { form.resetFields(); }, [staff?.id, form]);

  return <Modal className="rental-modal" width={640} title={`创建租号订单 · ${staff?.nickname || staff?.name || ''}`} open={!!staff}
    onCancel={onClose} confirmLoading={saving} okText="确认扣款并创建" destroyOnClose
    onOk={async () => {
      if (saving) return;
      try {
        const values = await form.validateFields();
        setSaving(true);
        await createRentalOrder({ ...values, staffUserId: staff.id, depositAmount: values.depositAmount ?? 0,
          forcedSettlementDate: values.forcedSettlementDate.format('YYYY-MM-DD') });
        message.success('租号订单已创建，租金与押金已扣除'); onSuccess(); onClose();
      } catch (e: any) { if (!e?.errorFields) message.error(apiError(e)); }
      finally { setSaving(false); }
    }}>
    <Row style={{ marginBottom: 20, padding: 16, background: token.colorFillAlter, borderRadius: token.borderRadiusLG }}>
      <Col span={12}><Statistic title="参考资产" value={assets} precision={2} prefix="¥" valueStyle={{ fontSize: 22 }} /></Col>
      <Col span={12}><Statistic title="本次实扣" value={total} precision={2} prefix="¥" valueStyle={{ fontSize: 22, color: token.colorPrimary }} /></Col>
    </Row>
    <Form form={form} layout="vertical" scrollToFirstError initialValues={{ depositAmount: 0 }}>
      <Row gutter={16}>
        <Col xs={24} sm={12}><Form.Item name="prepaidAmount" label="预扣租金（不含押金）" rules={[{ required: true }]}><InputNumber min={0.01} max={99999999.99} precision={2} addonBefore="¥" /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item name="depositAmount" label="租号订单押金（可不填）"><InputNumber min={0} max={99999999.99} precision={2} addonBefore="¥" /></Form.Item></Col>
      </Row>
      <Form.Item name="accountSourceNo" label="号源编号" rules={[{ required: true, whitespace: true }]}><Input maxLength={100} /></Form.Item>
      <Row gutter={16}>
        <Col xs={24} sm={12}><Form.Item label="开始日期（自动）" extra="上海时间14:00后顺延至次日。"><Input value={start} disabled /></Form.Item></Col>
        <Col xs={24} sm={12}><Form.Item name="forcedSettlementDate" label="强制结算日期" rules={[{ required: true }]}>
          <DatePicker inputReadOnly={isMobile} style={{ width: '100%' }} disabledDate={(d) => d && d.isBefore(dayjs(start), 'day')} />
        </Form.Item></Col>
      </Row>
    </Form>
  </Modal>;
}
