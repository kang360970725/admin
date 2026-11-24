import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Modal, message, Segmented, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { generateEquipmentRentalBills, listEquipmentRentalBills, listEquipmentRentalContracts } from '@/services/api';
import type { EquipmentRentalBill, EquipmentRentalContract } from '@/services/api';

const formatMoney = (amount: number) => `¥${amount.toFixed(2)}`;
const dayKey = (date?: string | null) => date?.slice(0, 10) || '';
const filters = ['待核对', '有差异', '已处理', '核对通过', '全部'] as const;
type ReviewStatus = typeof filters[number];

async function readPages<T>(read: (page: number) => Promise<{ list: T[]; total: number }>) {
  const first = await read(1);
  const rest = await Promise.all(Array.from({ length: Math.max(0, Math.ceil(first.total / 100) - 1) }, (_, index) =>
    read(index + 2)));
  return [first, ...rest].flatMap((page) => page.list);
}

function review(contract: EquipmentRentalContract, bills: EquipmentRentalBill[], month: string) {
  const first = dayjs(month + '-01');
  const days = Array.from({ length: first.daysInMonth() }, (_, index) => first.add(index, 'day').format('YYYY-MM-DD'));
  const start = dayKey(contract.startDate) || contract.startMonth + '-01';
  const end = dayKey(contract.endDate)
    || (contract.endMonth ? dayjs(contract.endMonth + '-01').endOf('month').format('YYYY-MM-DD') : '');
  const unknown = contract.status === 'INACTIVE' && !end;
  const relevant = bills.filter((bill) => dayKey(bill.periodStart) <= days[days.length - 1]
    && dayKey(bill.periodEnd) >= days[0]);
  if (!relevant.length && (start > days[days.length - 1] || (end && end < days[0]))) return null;
  const voided = relevant.filter((bill) => Number(bill.amount) === 0 && /^已作废[：:]/.test(bill.remark || ''));
  const active = relevant.filter((bill) => !voided.includes(bill));
  const covered = days.map((date) => {
    const ids = active.filter((bill) => dayKey(bill.periodStart) <= date && dayKey(bill.periodEnd) >= date).map((bill) => bill.id);
    const inContract = date >= start && (!end || date <= end);
    const issue = ids.length > 1 ? '重叠' : ids.length && !inContract ? '超合同日期'
      : !ids.length && inContract && !unknown ? '空档' : '';
    return { date, ids, issue, inContract };
  });
  const spans: { from: string; to: string; ids: number[]; issue: string }[] = [];
  covered.filter((entry) => entry.ids.length || entry.issue).forEach(({ date, ids, issue }) => {
    const previous = spans[spans.length - 1];
    if (previous && dayjs(previous.to).add(1, 'day').format('YYYY-MM-DD') === date
      && previous.issue === issue && previous.ids.join(',') === ids.join(',')) {
      previous.to = date;
    } else {
      spans.push({ from: date, to: date, ids, issue });
    }
  });
  const count = (issue: string) => covered.filter((entry) => entry.issue === issue).length;
  const coverageIssues = ['空档', '重叠', '超合同日期'].filter((issue) => count(issue))
    .map((issue) => `${issue} ${count(issue)} 天`);
  const expectedDays = covered.filter((entry) => entry.inContract).length;
  const expected = Math.round(Number(contract.monthlyAmount) * expectedDays / days.length * 100) / 100;
  const wholeMonthBills = active.every((bill) => dayKey(bill.periodStart) >= days[0]
    && dayKey(bill.periodEnd) <= days[days.length - 1] && bill.billingSlot === 0);
  const amount = active.reduce((sum, bill) => sum + Number(bill.amount), 0);
  const comparable = !unknown && wholeMonthBills;
  const amountChanged = comparable && Math.abs(amount - expected) >= 0.01;
  const handled = relevant.some((bill) => voided.includes(bill) || /已线下处理|截止日修正/.test(bill.remark || ''));
  const notes = [...coverageIssues, ...(amountChanged ? [`金额差额 ${formatMoney(Math.abs(amount - expected))}`] : [])];
  const status: ReviewStatus = notes.length ? '有差异' : unknown || !comparable ? '待核对' : handled ? '已处理' : '核对通过';
  return { contract, relevant, spans, notes, status, unknown, comparable, expectedDays, daysInMonth: days.length, expected, amount };
}

type Review = NonNullable<ReturnType<typeof review>>;

export default function BillingReview({ onBill, revision }: { onBill: (bill: EquipmentRentalBill) => void; revision: number }) {
  const shanghaiMonth = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).format(new Date());
  const [month, setMonth] = useState(() => dayjs(shanghaiMonth() + '-01').subtract(1, 'month'));
  const [filter, setFilter] = useState<ReviewStatus>('全部');
  const [data, setData] = useState<{ contracts: EquipmentRentalContract[]; bills: EquipmentRentalBill[] }>();
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const approve = (row: Review) => {
    Modal.confirm({
      title: `核准修复合同 #${row.contract.id}`,
      content: `按当前合同重新计算 ${month.format('YYYY-MM')} 的账期及应收。已实收账单的差异会列出供复核。`,
      okText: '核准并修复',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await generateEquipmentRentalBills({ month: month.format('YYYY-MM'), contractId: row.contract.id });
          setRefresh((value) => value + 1);
          if (result.reconciliations?.length) {
            Modal.warning({
              title: '仍有账单需要人工核对',
              content: <Space direction="vertical">{result.reconciliations.map((bill) =>
                <div key={bill.billId}>#{bill.billId} · {formatMoney(Number(bill.currentAmount))} → {formatMoney(Number(bill.correctAmount))} · {bill.reason}</div>)}</Space>,
            });
          } else {
            message.success(`已生成或更新 ${result.affected} 张账单，请查看刷新后的核对结果`);
          }
        } catch (error: any) {
          message.error(error?.data?.message || error?.message || '修复失败');
          throw error;
        }
      },
    });
  };
  const [expanded, setExpanded] = useState<React.Key[]>([]);

  useEffect(() => {
    let active = true;
    setError(false);
    setData(undefined);
    Promise.all([
      readPages((page) => listEquipmentRentalContracts({ page, limit: 100 })),
      readPages((page) => listEquipmentRentalBills({ page, limit: 100 })),
    ]).then(([contracts, bills]) => {
      if (active) setData({ contracts, bills });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [refresh, revision]);

  const rows = useMemo(() => (data?.contracts || []).flatMap((contract) => {
    const result = review(contract, data!.bills.filter((bill) => bill.contractId === contract.id), month.format('YYYY-MM'));
    return result ? [result] : [];
  }).sort((a, b) => Number(b.status === '有差异') - Number(a.status === '有差异')
    || Number(b.status === '待核对') - Number(a.status === '待核对')), [data, month]);
  const visible = filter === '全部' ? rows : rows.filter((row) => row.status === filter);

  return (
    <Card>
      <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
        <Space wrap>
          <Typography.Text strong>实际计费月份</Typography.Text>
          <DatePicker picker="month" value={month} allowClear={false}
            disabledDate={(value) => value.format('YYYY-MM') >= shanghaiMonth()}
            onChange={(value) => { if (value) { setMonth(value); setExpanded([]); } }} />
          <Button onClick={() => setRefresh((value) => value + 1)}>刷新核对</Button>
        </Space>
        <Segmented value={filter} onChange={(value) => setFilter(value as ReviewStatus)}
          options={filters.map((value) => ({ value, label: `${value} ${value === '全部' ? rows.length : rows.filter((row) => row.status === value).length}` }))} />
        {error && <Alert type="error" showIcon message="读取合同或账单失败，请刷新重试。" />}
        <Table<Review> rowKey={(row) => row.contract.id} dataSource={visible} loading={!error && !data}
          pagination={false} scroll={{ x: 780 }}
          expandable={{
            expandedRowKeys: expanded,
            onExpandedRowsChange: (keys) => setExpanded([...keys]),
            expandedRowRender: (row) => (
              <Space direction="vertical">
                {row.comparable && <Typography.Text>{formatMoney(Number(row.contract.monthlyAmount))} × {row.expectedDays} ÷ {row.daysInMonth} = {formatMoney(row.expected)}</Typography.Text>}
                {row.spans.map((span) => <Space key={span.from} wrap>
                  <Typography.Text>{span.from} 至 {span.to}</Typography.Text>
                  {span.issue && <Tag color="error">{span.issue}</Tag>}
                  {span.ids.map((id) => <Button key={id} type="link" size="small" onClick={() => {
                    const bill = row.relevant.find((item) => item.id === id);
                    if (bill) onBill(bill);
                  }}>账单 #{id}</Button>)}
                </Space>)}
                {row.relevant.filter((bill) => bill.remark).map((bill) =>
                  <Typography.Text key={bill.id} type="secondary">#{bill.id} {bill.remark}</Typography.Text>)}
              </Space>
            ),
          }}
          columns={[
            { title: '合同 / 员工', render: (_, row) => `#${row.contract.id} · ${row.contract.user?.name || `员工 #${row.contract.userId}`}` },
            { title: '核对结果', render: (_, row) => <Space wrap>
              <Tag color={row.status === '有差异' ? 'error' : row.status === '待核对' ? 'warning' : 'success'}>{row.status}</Tag>
              {row.notes.join('、') || (row.unknown ? '停用日期缺失' : !row.comparable ? '含跨月或旧账，金额待复核' : '')}
            </Space> },
            { title: '账单应收', align: 'right', render: (_, row) => row.comparable ? formatMoney(row.amount) : '见账单明细' },
            { title: '按合同应收', align: 'right', render: (_, row) => row.comparable ? formatMoney(row.expected) : '待复核' },
            { title: '操作', render: (_, row) => row.status === '有差异' && !row.unknown
              ? <Button size="small" onClick={() => approve(row)}>核准并修复</Button> : null },
          ]} />
      </Space>
    </Card>
  );
}

