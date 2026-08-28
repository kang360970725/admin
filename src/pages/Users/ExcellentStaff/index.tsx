import React, { useRef, useState } from 'react';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Alert, Button, Card, Form, Input, message, Modal, Select, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useAccess } from 'umi';
import {
  addExcellentStaff,
  getExcellentStaffCandidates,
  getExcellentStaffList,
  removeExcellentStaff,
} from '@/services/api';
import { maskPhone } from '@/utils/privacy';

type ExcellentStaffRow = {
  userId: number;
  name: string;
  realName?: string;
  phone?: string;
  staffEmploymentStatus?: string;
  accountStatus?: string;
  workMode?: string;
  ratingName?: string;
  excellentStatus?: string;
  assignedAt?: string;
  remark?: string;
};

const statusText: Record<string, string> = {
  ACTIVE: '正常',
  FROZEN: '冻结',
  EXITED: '已退出',
  BLACKLISTED: '限制服务',
  DISABLED: '停用',
};

const ExcellentStaffPage: React.FC = () => {
  const access = useAccess();
  const actionRef = useRef<ActionType>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [candidateOptions, setCandidateOptions] = useState<any[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadCandidates = async (keyword?: string) => {
    setCandidateLoading(true);
    try {
      const rows: any = await getExcellentStaffCandidates({ keyword, limit: 80 });
      setCandidateOptions((Array.isArray(rows) ? rows : []).map((item: any) => ({
        label: `${item.name || `#${item.userId}`}（${maskPhone(item.phone)}）${item.isExcellent ? ' · 已入围' : ''}`,
        value: Number(item.userId),
        disabled: Boolean(item.isExcellent),
      })));
    } catch {
      message.error('加载候选服务者失败');
    } finally {
      setCandidateLoading(false);
    }
  };

  const submitAdd = async () => {
    const values = await form.validateFields();
    const userIds = Array.isArray(values.userIds) ? values.userIds.map((id: any) => Number(id)).filter(Boolean) : [];
    if (!userIds.length) {
      message.warning('请选择服务者');
      return;
    }
    setSubmitting(true);
    try {
      await addExcellentStaff({ userIds, remark: values.remark });
      message.success('已设为优秀服务者');
      setModalOpen(false);
      form.resetFields();
      setCandidateOptions([]);
      actionRef.current?.reload();
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const batchRemove = async (userIds: number[]) => {
    if (!userIds.length) return;
    setSubmitting(true);
    try {
      await removeExcellentStaff({ userIds });
      message.success('已移出优秀服务者');
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ProColumns<ExcellentStaffRow>[] = [
    {
      title: '服务者',
      dataIndex: 'keyword',
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{row.name || '-'}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            ID：{row.userId}　手机号：{maskPhone(row.phone)}
          </Typography.Text>
        </Space>
      ),
      fieldProps: { placeholder: '搜索姓名/手机号' },
    },
    {
      title: '状态',
      width: 150,
      search: false,
      render: (_, row) => (
        <Space>
          <Tag color={row.accountStatus === 'FROZEN' ? 'orange' : 'green'}>
            账号{statusText[row.accountStatus || ''] || row.accountStatus || '-'}
          </Tag>
          <Tag color={row.staffEmploymentStatus === 'FROZEN' ? 'orange' : 'blue'}>
            服务{statusText[row.staffEmploymentStatus || ''] || row.staffEmploymentStatus || '-'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '评级/模式',
      width: 140,
      search: false,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Tag>{row.ratingName || '未评级'}</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.workMode || '-'}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '入围时间',
      dataIndex: 'assignedAt',
      width: 180,
      search: false,
      render: (_, row) => row.assignedAt ? dayjs(row.assignedAt).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      search: false,
      ellipsis: true,
    },
    {
      title: '操作',
      width: 110,
      valueType: 'option',
      render: (_, row) => access.canManageExcellentStaff ? [
        <Button key="remove" type="link" danger size="small" onClick={() => batchRemove([Number(row.userId)])}>
          移出
        </Button>,
      ] : [],
    },
  ];

  return (
    <PageContainer title="优秀服务者管理" subTitle="用于续单额外分红资格；分红资格在派单创建续单时固化快照">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="规则说明"
        description="只有当前入围优秀服务者、且在派单时被勾选为续单服务者的人，才会在订单结算时享受续单额外分红。后续名单轮换不会影响已派单订单。"
      />
      <Card>
        <ProTable<ExcellentStaffRow>
          actionRef={actionRef}
          rowKey="userId"
          columns={columns}
          search={{ labelWidth: 90 }}
          toolBarRender={() => [
            access.canManageExcellentStaff ? (
              <Button
                key="add"
                type="primary"
                onClick={() => {
                  setModalOpen(true);
                  void loadCandidates();
                }}
              >
                选入优秀服务者
              </Button>
            ) : null,
            access.canManageExcellentStaff ? (
              <Button
                key="remove"
                danger
                disabled={!selectedRowKeys.length}
                onClick={() => batchRemove(selectedRowKeys.map((id) => Number(id)).filter(Boolean))}
              >
                批量移出
              </Button>
            ) : null,
          ].filter(Boolean) as any}
          rowSelection={access.canManageExcellentStaff ? {
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          } : undefined}
          request={async (params) => {
            const res: any = await getExcellentStaffList({
              page: params.current || 1,
              limit: params.pageSize || 20,
              keyword: params.keyword ? String(params.keyword).trim() : undefined,
              status: 'ACTIVE',
            });
            return {
              data: Array.isArray(res?.data) ? res.data : [],
              total: Number(res?.total || 0),
              success: true,
            };
          }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title="选入优秀服务者"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submitAdd}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="userIds" label="服务者" rules={[{ required: true, message: '请选择服务者' }]}>
            <Select
              mode="multiple"
              showSearch
              filterOption={false}
              loading={candidateLoading}
              options={candidateOptions}
              placeholder="搜索并选择未退出平台的服务者"
              onSearch={(value) => loadCandidates(value)}
              onFocus={() => loadCandidates()}
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="例如：本周续单表现优秀、主管评选入围" maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default ExcellentStaffPage;
