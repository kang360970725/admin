import React, { useRef, useState } from 'react';
import { PageContainer, ProTable, StatisticCard } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Alert, Button, Drawer, Space, Table, Tabs, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { getWalletDepositReconciliation } from '@/services/api';
import { maskPhone } from '@/utils/privacy';

const employmentStatusMap: Record<string, { text: string; color: string }> = {
  ACTIVE: { text: '正常', color: 'green' },
  FROZEN: { text: '冻结', color: 'orange' },
  EXITED: { text: '已退出', color: 'red' },
  BLACKLISTED: { text: '黑名单', color: 'black' },
};

const money = (value: any) => {
  const amount = Number(value || 0);
  return `${amount < 0 ? '-' : ''}¥${Math.abs(amount).toFixed(2)}`;
};

export default function DepositReconciliationPage() {
  const actionRef = useRef<ActionType>();
  const detailActionRef = useRef<ActionType>();
  const [summary, setSummary] = useState<any>({});
  const [detailGroup, setDetailGroup] = useState<any>(null);
  const [staffScope, setStaffScope] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [auditSummary, setAuditSummary] = useState<any>({});

  const bizTypeMap: Record<string, string> = {
    WITHDRAW_PERCENT: '提现自动补充',
    REWARD_TRANSFER: '奖励转保证金',
    MANUAL_DEPOSIT: '管理员手动录入',
    PENALTY_DEDUCT: '处罚扣除',
    DEPOSIT_REFUND: '退还保证金',
    STAFF_EXIT_RELEASE: '退店退还',
    STAFF_EXIT_CLEAR: '退店清算',
    ACTIVITY_PENALTY: '活跃度扣罚',
  };
  const manualSourceMap: Record<string, string> = {
    OFFLINE_PAYMENT: '真实线下缴纳',
    BALANCE_ADJUSTMENT: '余额调整',
    HISTORICAL_CORRECTION: '历史修正',
    OTHER: '其他',
  };

  const groupColumns: ProColumns<any>[] = [
    {
      title: '搜索',
      dataIndex: 'search',
      hideInTable: true,
      fieldProps: {
        placeholder: '录入人 / 手机号 / 系统',
      },
    },
    {
      title: '录入来源',
      dataIndex: 'operatorName',
      width: 220,
      search: false,
      render: (_, record) => (
        <div>
          <div>{record.operatorName || '-'}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{record.operatorPhone || '-'}</div>
        </div>
      ),
    },
    {
      title: '来源类型',
      dataIndex: 'sourceType',
      width: 120,
      search: false,
      render: (_, record) => (
        record.sourceType === 'SYSTEM'
          ? <Tag color="orange">系统扣费/处理</Tag>
          : <Tag color="blue">手动录入</Tag>
      ),
    },
    {
      title: '保证金总额',
      dataIndex: 'totalAmount',
      width: 150,
      search: false,
      sorter: (a, b) => Number(a.totalAmount || 0) - Number(b.totalAmount || 0),
      render: (_, record) => (
        <Button
          type="link"
          style={{ padding: 0, color: Number(record.totalAmount || 0) < 0 ? '#ff4d4f' : undefined }}
          onClick={() => {
            setDetailGroup(record);
            setStaffScope('ACTIVE');
            setTimeout(() => detailActionRef.current?.reload?.(), 0);
          }}
        >
          {money(record.totalAmount)}
        </Button>
      ),
    },
    {
      title: '服务者数',
      dataIndex: 'staffCount',
      width: 110,
      search: false,
    },
    {
      title: '流水数',
      dataIndex: 'transactionCount',
      width: 100,
      search: false,
    },
    {
      title: '最近变动',
      dataIndex: 'latestAt',
      width: 170,
      search: false,
      render: (_, record) => record.latestAt ? dayjs(record.latestAt).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  const detailColumns: ProColumns<any>[] = [
    {
      title: '搜索',
      dataIndex: 'search',
      hideInTable: true,
      fieldProps: {
        placeholder: '服务者ID / 姓名 / 手机号',
      },
    },
    {
      title: '服务者',
      dataIndex: 'name',
      width: 220,
      search: false,
      render: (_, record) => (
        <div>
          <div>{record.realName || record.name || '-'}</div>
          <div style={{ color: '#999', fontSize: 12 }}>
            ID：{record.userId}　{maskPhone(record.phone)}
          </div>
        </div>
      ),
    },
    {
      title: '当前状态',
      dataIndex: 'staffEmploymentStatus',
      width: 120,
      search: false,
      render: (_, record) => {
        const item = employmentStatusMap[record.staffEmploymentStatus] || {
          text: record.staffEmploymentStatus || '-',
          color: 'default',
        };
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
    {
      title: '当前保证金',
      dataIndex: 'currentDepositBalance',
      width: 140,
      search: false,
      sorter: (a, b) => Number(a.currentDepositBalance || 0) - Number(b.currentDepositBalance || 0),
      render: (_, record) => (
        <span style={{ color: Number(record.currentDepositBalance || 0) < 0 ? '#ff4d4f' : undefined }}>
          {money(record.currentDepositBalance)}
        </span>
      ),
    },
    {
      title: '流水净额',
      dataIndex: 'transactionNetAmount',
      width: 120,
      search: false,
      render: (_, record) => money(record.transactionNetAmount),
    },
    {
      title: '流水数',
      dataIndex: 'transactionCount',
      width: 90,
      search: false,
    },
    {
      title: '待核对流水',
      dataIndex: 'unexplainedCount',
      width: 110,
      search: false,
      render: (_, record) => Number(record.unexplainedCount || 0) > 0
        ? <Tag color="red">{record.unexplainedCount} 笔</Tag>
        : <Tag color="green">已完整</Tag>,
    },
    {
      title: '最近变动',
      dataIndex: 'latestAt',
      width: 170,
      search: false,
      render: (_, record) => record.latestAt ? dayjs(record.latestAt).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  return (
    <PageContainer
      title="保证金对账"
      extra={[
        <Button
          key="staff-audit"
          type="primary"
          onClick={() => {
            setDetailGroup({ operatorName: '全部人员' });
            setStaffScope('ACTIVE');
            setTimeout(() => detailActionRef.current?.reload?.(), 0);
          }}
        >
          逐人核对保证金总额
        </Button>,
      ]}
    >
      <StatisticCard.Group style={{ marginBottom: 16 }}>
        <StatisticCard statistic={{ title: '分组数', value: Number(summary.groupCount || 0) }} />
        <StatisticCard statistic={{ title: '涉及服务者', value: Number(summary.staffCount || 0) }} />
        <StatisticCard statistic={{ title: '保证金流水总额', value: money(summary.totalAmount), valueStyle: { color: '#1677ff' } }} />
        <StatisticCard statistic={{ title: '手动录入合计', value: money(summary.manualOperatorAmount) }} />
        <StatisticCard statistic={{ title: '系统扣费/处理合计', value: money(summary.systemAmount), valueStyle: { color: Number(summary.systemAmount || 0) < 0 ? '#ff4d4f' : undefined } }} />
      </StatisticCard.Group>

      <ProTable
        rowKey="groupKey"
        actionRef={actionRef}
        columns={groupColumns}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 20 }}
        request={async (params) => {
          const res: any = await getWalletDepositReconciliation({
            search: params.search,
            page: params.current || 1,
            limit: params.pageSize || 20,
          });
          setSummary(res?.summary || {});
          return {
            data: res?.data || [],
            total: res?.total || 0,
            success: true,
          };
        }}
      />

      <Drawer
        title="服务者保证金逐人核对"
        width="92vw"
        open={!!detailGroup}
        onClose={() => setDetailGroup(null)}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="历史手动录入流水如缺少来源或说明，将标记为待人工核对；系统不会自行推断其是否为真实线下缴纳。"
        />
        <Space wrap style={{ marginBottom: 12 }}>
          <Typography.Text strong>当前保证金：{money(auditSummary.currentDepositBalance)}</Typography.Text>
          <Typography.Text>流水净额：{money(auditSummary.transactionNetAmount)}</Typography.Text>
          <Typography.Text>流水：{Number(auditSummary.transactionCount || 0)} 笔</Typography.Text>
          <Typography.Text type={Number(auditSummary.unexplainedCount || 0) > 0 ? 'danger' : undefined}>
            待核对：{Number(auditSummary.unexplainedCount || 0)} 笔
          </Typography.Text>
        </Space>
        <Tabs
          activeKey={staffScope}
          onChange={(key) => {
            setStaffScope(key as 'ACTIVE' | 'INACTIVE');
            setTimeout(() => detailActionRef.current?.reloadAndRest?.(), 0);
          }}
          items={[
            { key: 'ACTIVE', label: '在店人员' },
            { key: 'INACTIVE', label: '已退店 / 拉黑' },
          ]}
        />
        <ProTable
          rowKey="userId"
          actionRef={detailActionRef}
          columns={detailColumns}
          scroll={{ x: 1050 }}
          pagination={{ pageSize: 20 }}
          expandable={{
            expandedRowRender: (record) => (
              <Table
                rowKey={(row: any) => `${row.id}-${row.createdAt}`}
                size="small"
                pagination={false}
                dataSource={record.transactions || []}
                locale={{ emptyText: '该人员暂无保证金流水' }}
                scroll={{ x: 1050 }}
                columns={[
                  { title: '发生时间', dataIndex: 'createdAt', width: 170, render: (v: any) => dayjs(v).format('YYYY-MM-DD HH:mm:ss') },
                  { title: '金额', dataIndex: 'amount', width: 110, render: (v: any) => <Typography.Text type={Number(v) < 0 ? 'danger' : 'success'}>{money(v)}</Typography.Text> },
                  { title: '业务类型', dataIndex: 'bizType', width: 140, render: (v: any) => bizTypeMap[v] || v || '-' },
                  {
                    title: '录入来源', dataIndex: 'manualSource', width: 150,
                    render: (v: any, row: any) => row.bizType !== 'MANUAL_DEPOSIT'
                      ? <Tag>系统业务</Tag>
                      : v ? <Tag color={v === 'OFFLINE_PAYMENT' ? 'blue' : 'gold'}>{manualSourceMap[v] || v}</Tag> : <Tag color="red">来源未记录</Tag>,
                  },
                  { title: '原因 / 备注', dataIndex: 'remark', width: 260, render: (v: any, row: any) => v || (row.bizType === 'MANUAL_DEPOSIT' ? <Typography.Text type="danger">原因未填写</Typography.Text> : '-') },
                  { title: '操作人', dataIndex: 'operatorName', width: 150, render: (v: any, row: any) => <div><div>{v || '系统'}</div><Typography.Text type="secondary">{maskPhone(row.operatorPhone)}</Typography.Text></div> },
                ]}
              />
            ),
            rowExpandable: () => true,
          }}
          request={async (params) => {
            if (!detailGroup) {
              return { data: [], total: 0, success: true };
            }
            const res: any = await getWalletDepositReconciliation({
              staffScope,
              search: params.search,
              page: params.current || 1,
              limit: params.pageSize || 20,
            });
            setAuditSummary(res?.summary || {});
            return {
              data: res?.data || [],
              total: res?.total || 0,
              success: true,
            };
          }}
        />
      </Drawer>
    </PageContainer>
  );
}
