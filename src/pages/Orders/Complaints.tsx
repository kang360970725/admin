import React, { useRef, useState } from 'react';
import { PageContainer, ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Form, Input, InputNumber, message, Modal, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from '@umijs/max';
import { ComplaintWorkOrder, getComplaintWorkOrders, refundComplaintWorkOrder, reviewComplaintWorkOrder } from '@/services/api';

const statusMap: Record<string, { text: string; color: string }> = {
  PENDING_REVIEW: { text: '待审核', color: 'gold' },
  APPROVED: { text: '审核通过', color: 'blue' },
  REJECTED: { text: '已驳回', color: 'default' },
  REFUNDED: { text: '已退款', color: 'green' },
};

const ComplaintOrdersPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const navigate = useNavigate();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [current, setCurrent] = useState<ComplaintWorkOrder | null>(null);
  const [reviewForm] = Form.useForm();
  const [refundForm] = Form.useForm();

  const openReview = (record: ComplaintWorkOrder) => {
    setCurrent(record);
    reviewForm.setFieldsValue({
      reviewRemark: record.reviewRemark || '',
      approvedRefundAmount: record.approvedRefundAmount ?? record.suggestedRefundAmount ?? record.order?.amount ?? 0,
    });
    setReviewOpen(true);
  };

  const openRefund = (record: ComplaintWorkOrder) => {
    setCurrent(record);
    refundForm.setFieldsValue({
      refundAmount: record.approvedRefundAmount ?? record.suggestedRefundAmount ?? record.order?.amount ?? 0,
      refundRemark: record.refundRemark || record.reviewRemark || '',
    });
    setRefundOpen(true);
  };

  const submitReview = async (action: 'APPROVE' | 'REJECT') => {
    if (!current) return;
    try {
      const values = await reviewForm.validateFields();
      setReviewLoading(true);
      await reviewComplaintWorkOrder(current.id, {
        action,
        reviewRemark: values.reviewRemark,
        approvedRefundAmount: action === 'APPROVE' ? Number(values.approvedRefundAmount || 0) : undefined,
      });
      message.success(action === 'APPROVE' ? '审核通过' : '已驳回');
      setReviewOpen(false);
      actionRef.current?.reload();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '提交失败');
    } finally {
      setReviewLoading(false);
    }
  };

  const submitRefund = async () => {
    if (!current) return;
    try {
      const values = await refundForm.validateFields();
      setRefundLoading(true);
      await refundComplaintWorkOrder(current.id, {
        refundAmount: Number(values.refundAmount || 0),
        refundRemark: values.refundRemark,
      });
      message.success('退款成功');
      setRefundOpen(false);
      actionRef.current?.reload();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '退款失败');
    } finally {
      setRefundLoading(false);
    }
  };

  return (
    <PageContainer>
      <ProTable<ComplaintWorkOrder>
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 20 }}
        request={async (params) => {
          const res: any = await getComplaintWorkOrders({
            page: params.current,
            limit: params.pageSize,
            status: params.status as string,
            keyword: params.keyword as string,
          });
          return {
            data: res?.data || [],
            total: res?.total || 0,
            success: true,
          };
        }}
        columns={[
          { title: '工单号', dataIndex: 'ticketNo', width: 180 },
          {
            title: '订单号',
            dataIndex: ['order', 'orderNo'],
            width: 180,
            render: (_, record) => (
              <Typography.Link onClick={() => navigate(`/orders/${record.orderId}`)}>
                {record.order?.orderNo || `#${record.orderId}`}
              </Typography.Link>
            ),
          },
          { title: '商品', dataIndex: ['order', 'serviceName'], search: false, ellipsis: true, width: 180 },
          { title: '会员', dataIndex: ['order', 'customerName'], search: false, width: 120 },
          { title: '原因', dataIndex: 'reason', ellipsis: true, width: 180 },
          {
            title: '状态',
            dataIndex: 'status',
            valueEnum: Object.fromEntries(Object.entries(statusMap).map(([k, v]) => [k, { text: v.text }])),
            render: (_, record) => <Tag color={statusMap[String(record.status || '')]?.color || 'default'}>{statusMap[String(record.status || '')]?.text || record.status}</Tag>,
            width: 120,
          },
          {
            title: '退款渠道',
            dataIndex: ['order', 'paymentChannel'],
            search: false,
            width: 140,
            render: (_, record) => record.order?.paymentChannel || record.paymentChannel || '--',
          },
          {
            title: '可退款',
            dataIndex: 'refundSupported',
            width: 120,
            valueEnum: { true: { text: '支持' }, false: { text: '不支持' } },
            render: (_, record) => record.refundSupported ? <Tag color="green">支持</Tag> : <Tag color="red">不支持</Tag>,
          },
          {
            title: '建议退款',
            dataIndex: 'suggestedRefundAmount',
            search: false,
            width: 120,
            render: (v) => `¥${Number(v || 0).toFixed(2)}`,
          },
          {
            title: '审核退款',
            dataIndex: 'approvedRefundAmount',
            search: false,
            width: 120,
            render: (v) => (v == null ? '--' : `¥${Number(v).toFixed(2)}`),
          },
          {
            title: '提交时间',
            dataIndex: 'createdAt',
            search: false,
            width: 170,
            render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '--'),
          },
          {
            title: '操作',
            key: 'option',
            valueType: 'option',
            width: 220,
            render: (_, record) => (
              <Space>
                {record.status === 'PENDING_REVIEW' ? <Button type="link" onClick={() => openReview(record)}>审核</Button> : null}
                {record.status === 'APPROVED' ? (
                  <Button type="link" onClick={() => openRefund(record)} disabled={!record.refundSupported}>执行退款</Button>
                ) : null}
                {!record.refundSupported ? <Typography.Text type="secondary">仅支持原路退款</Typography.Text> : null}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="审核客诉工单"
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        confirmLoading={reviewLoading}
        footer={[
          <Button key="cancel" onClick={() => setReviewOpen(false)}>取消</Button>,
          <Button key="reject" danger loading={reviewLoading} onClick={() => submitReview('REJECT')}>驳回</Button>,
          <Button key="approve" type="primary" loading={reviewLoading} onClick={() => submitReview('APPROVE')}>审核通过</Button>,
        ]}
      >
        <Form form={reviewForm} layout="vertical">
          <Form.Item label="订单信息">
            <div>
              <div>{current?.order?.serviceName || '--'}</div>
              <div style={{ color: '#999' }}>{current?.order?.orderNo || '--'} · 实付 ¥{Number(current?.order?.amount || 0).toFixed(2)}</div>
            </div>
          </Form.Item>
          <Form.Item label="客诉原因">
            <div>{current?.reason || '--'}</div>
          </Form.Item>
          <Form.Item label="问题描述">
            <div>{current?.description || '--'}</div>
          </Form.Item>
          <Form.Item name="approvedRefundAmount" label="审核退款金额" rules={[{ required: true, message: '请输入退款金额' }]}>
            <InputNumber min={0.01} precision={2} style={{ width: '100%' }} addonBefore="¥" />
          </Form.Item>
          <Form.Item name="reviewRemark" label="审核说明">
            <Input.TextArea rows={4} placeholder="填写审核结论说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="执行原路退款"
        open={refundOpen}
        onCancel={() => setRefundOpen(false)}
        onOk={submitRefund}
        confirmLoading={refundLoading}
        okText="确认退款"
      >
        <Form form={refundForm} layout="vertical">
          <Form.Item label="退款限制说明">
            <div>
              <div>退款仅支持原路退回。</div>
              <div style={{ color: '#999' }}>代付下单等渠道不支持售后退款。</div>
            </div>
          </Form.Item>
          <Form.Item name="refundAmount" label="退款金额" rules={[{ required: true, message: '请输入退款金额' }]}>
            <InputNumber min={0.01} precision={2} style={{ width: '100%' }} addonBefore="¥" />
          </Form.Item>
          <Form.Item name="refundRemark" label="退款说明">
            <Input.TextArea rows={4} placeholder="填写退款说明" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default ComplaintOrdersPage;
