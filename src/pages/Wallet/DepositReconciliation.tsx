import React, { useRef, useState } from 'react';
import { PageContainer, ProTable, StatisticCard } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Space, Switch, Tag } from 'antd';
import dayjs from 'dayjs';
import { getWalletDepositReconciliation } from '@/services/api';

const employmentStatusMap: Record<string, { text: string; color: string }> = {
  ACTIVE: { text: '正常', color: 'green' },
  FROZEN: { text: '冻结', color: 'orange' },
  EXITED: { text: '已退店', color: 'red' },
  BLACKLISTED: { text: '黑名单', color: 'black' },
};

const depositStateMap: Record<string, { text: string; color: string }> = {
  EFFECTIVE: { text: '有效', color: 'green' },
  EXITED_OR_BLACKLISTED: { text: '退店/黑名单', color: 'red' },
  ZERO: { text: '无保证金', color: 'default' },
};

const userTypeMap: Record<string, string> = {
  STAFF: '员工',
  CUSTOMER_SERVICE: '客服',
  OPERATION: '运营',
  FINANCE: '财务',
  ADMIN: '管理员',
  SUPER_ADMIN: '超级管理员',
  REGISTERED_USER: '注册用户',
};

const money = (value: any) => `¥${Number(value || 0).toFixed(2)}`;

export default function DepositReconciliationPage() {
  const actionRef = useRef<ActionType>();
  const [summary, setSummary] = useState<any>({});

  const columns: ProColumns<any>[] = [
    {
      title: '搜索',
      dataIndex: 'search',
      hideInTable: true,
      fieldProps: {
        placeholder: 'ID / 手机号 / 姓名 / 身份证',
      },
    },
    {
      title: '保证金状态',
      dataIndex: 'depositState',
      hideInTable: true,
      valueType: 'select',
      initialValue: 'ALL',
      valueEnum: {
        ALL: { text: '全部' },
        EFFECTIVE: { text: '有效保证金' },
        INVALID: { text: '无效/需处理' },
        EXITED_OR_BLACKLISTED: { text: '退店/黑名单' },
        ZERO: { text: '无保证金' },
      },
    },
    {
      title: '员工状态',
      dataIndex: 'employmentStatus',
      hideInTable: true,
      valueType: 'select',
      valueEnum: {
        ACTIVE: { text: '正常' },
        FROZEN: { text: '冻结' },
        EXITED: { text: '已退店' },
        BLACKLISTED: { text: '黑名单' },
      },
    },
    {
      title: '仅线下录入',
      dataIndex: 'manualOnly',
      hideInTable: true,
      renderFormItem: () => <Switch checkedChildren="是" unCheckedChildren="否" />,
    },
    {
      title: 'ID',
      dataIndex: 'userId',
      width: 70,
      search: false,
    },
    {
      title: '员工',
      dataIndex: 'name',
      width: 180,
      search: false,
      render: (_, record) => (
        <div>
          <div>{record.realName || record.name || '-'}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{record.phone || '-'}</div>
        </div>
      ),
    },
    {
      title: '员工状态',
      dataIndex: 'staffEmploymentStatus',
      width: 100,
      search: false,
      render: (_, record) => {
        const item = employmentStatusMap[record.staffEmploymentStatus] || { text: record.staffEmploymentStatus || '-', color: 'default' };
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
    {
      title: '用户身份',
      dataIndex: 'userType',
      width: 100,
      search: false,
      render: (_, record) => <Tag>{userTypeMap[record.userType] || record.userType || '-'}</Tag>,
    },
    {
      title: '保证金状态',
      dataIndex: 'depositState',
      width: 120,
      search: false,
      render: (_, record) => {
        const item = depositStateMap[record.depositState] || { text: record.depositStateLabel || '-', color: 'default' };
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
    {
      title: '员工规则分组',
      dataIndex: 'staffTags',
      width: 180,
      search: false,
      render: (_, record) => (
        <Space size={[4, 4]} wrap>
          {(Array.isArray(record.staffTags) ? record.staffTags : []).length
            ? record.staffTags.map((tag: string) => <Tag key={tag}>{tag}</Tag>)
            : <Tag>未设置</Tag>}
        </Space>
      ),
    },
    {
      title: '当前保证金',
      dataIndex: 'depositBalance',
      width: 120,
      search: false,
      sorter: (a, b) => Number(a.depositBalance || 0) - Number(b.depositBalance || 0),
      render: (_, record) => money(record.depositBalance),
    },
    {
      title: '规则应交',
      dataIndex: 'requiredDeposit',
      width: 110,
      search: false,
      render: (_, record) => record.requiredDeposit === null || record.requiredDeposit === undefined ? '-' : money(record.requiredDeposit),
    },
    {
      title: '差额',
      dataIndex: 'gapToRule',
      width: 110,
      search: false,
      render: (_, record) => {
        if (record.gapToRule === null || record.gapToRule === undefined) return '-';
        const value = Number(record.gapToRule || 0);
        return <span style={{ color: value < 0 ? '#ff4d4f' : undefined }}>{money(value)}</span>;
      },
    },
    {
      title: '线下手动录入',
      dataIndex: 'manualDepositAmount',
      width: 130,
      search: false,
      render: (_, record) => (
        <div>
          <div>{money(record.manualDepositAmount)}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{Number(record.manualTransactionCount || 0)} 笔</div>
          {record.latestManualOperatorName || record.latestManualOperatorPhone ? (
            <div style={{ color: '#999', fontSize: 12 }}>
              最近录入：{record.latestManualOperatorName || record.latestManualOperatorPhone}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: '净变动',
      dataIndex: 'depositNetAmount',
      width: 110,
      search: false,
      render: (_, record) => money(record.depositNetAmount),
    },
    {
      title: '流水数',
      dataIndex: 'transactionCount',
      width: 90,
      search: false,
    },
    {
      title: '最近流水',
      dataIndex: 'latestDepositAt',
      width: 160,
      search: false,
      render: (_, record) => record.latestDepositAt ? dayjs(record.latestDepositAt).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  return (
    <PageContainer title="保证金对账">
      <StatisticCard.Group style={{ marginBottom: 16 }}>
        <StatisticCard statistic={{ title: '筛选员工数', value: Number(summary.staffCount || 0) }} />
        <StatisticCard statistic={{ title: '当前保证金合计', value: money(summary.totalDepositBalance), valueStyle: { color: '#1677ff' } }} />
        <StatisticCard statistic={{ title: '有效保证金', value: money(summary.effectiveDepositBalance), description: `${Number(summary.effectiveCount || 0)} 人` }} />
        <StatisticCard statistic={{ title: '无效/需处理', value: money(summary.invalidDepositBalance), description: `${Number(summary.invalidCount || 0)} 人` }} />
        <StatisticCard statistic={{ title: '线下手动录入', value: money(summary.totalManualDepositAmount) }} />
      </StatisticCard.Group>

      <ProTable
        rowKey="userId"
        actionRef={actionRef}
        columns={columns}
        scroll={{ x: 1500 }}
        pagination={{ pageSize: 20 }}
        request={async (params) => {
          const res: any = await getWalletDepositReconciliation({
            search: params.search,
            depositState: params.depositState,
            employmentStatus: params.employmentStatus,
            page: params.current || 1,
            limit: params.pageSize || 20,
            manualOnly: params.manualOnly === true ? 'true' : undefined,
          });
          setSummary(res?.summary || {});
          return {
            data: res?.data || [],
            total: res?.total || 0,
            success: true,
          };
        }}
      />
    </PageContainer>
  );
}
