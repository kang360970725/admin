import React, { useRef, useState } from 'react';
import { PageContainer, ProTable, StatisticCard } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Drawer, Tag } from 'antd';
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
      title: '保证金总和',
      dataIndex: 'depositAmount',
      width: 140,
      search: false,
      sorter: (a, b) => Number(a.depositAmount || 0) - Number(b.depositAmount || 0),
      render: (_, record) => (
        <span style={{ color: Number(record.depositAmount || 0) < 0 ? '#ff4d4f' : undefined }}>
          {money(record.depositAmount)}
        </span>
      ),
    },
    {
      title: '流水数',
      dataIndex: 'transactionCount',
      width: 90,
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

  return (
    <PageContainer title="保证金对账">
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
        title={`${detailGroup?.operatorName || '明细'} - 服务者保证金汇总`}
        width={760}
        open={!!detailGroup}
        onClose={() => setDetailGroup(null)}
        destroyOnClose
      >
        <ProTable
          rowKey="userId"
          actionRef={detailActionRef}
          columns={detailColumns}
          scroll={{ x: 760 }}
          pagination={{ pageSize: 20 }}
          request={async (params) => {
            if (!detailGroup?.groupKey) {
              return { data: [], total: 0, success: true };
            }
            const res: any = await getWalletDepositReconciliation({
              operatorKey: detailGroup.groupKey,
              search: params.search,
              page: params.current || 1,
              limit: params.pageSize || 20,
            });
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
