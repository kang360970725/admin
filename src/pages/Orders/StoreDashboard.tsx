import { PageContainer } from '@ant-design/pro-components';
import { Alert, Button, Card, Col, DatePicker, Row, Space, Statistic, Table, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { getStoreDashboard } from '@/services/api';
import type { StoreDashboardData, StoreOrderCounts } from '@/services/api';

const categories: { key: keyof StoreOrderCounts; label: string }[] = [
    { key: 'EXPERIENCE', label: '体验单' },
    { key: 'GUARANTEED', label: '保底单' },
    { key: 'MODE_PLAY', label: '玩法单' },
    { key: 'HOURLY', label: '小时单' },
    { key: 'OTHER', label: '其他' },
];

const shanghaiDate = (daysAgo = 0) =>
    new Date(Date.now() + 8 * 3_600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10);

const share = (count: number, total: number) => `${(total ? count / total * 100 : 0).toFixed(1)}%`;
const countAndShare = (count: number, total: number) => `${count} 单（${share(count, total)}）`;

type StaffRow = StoreDashboardData['staff'][number];

export default function StoreDashboard() {
    const [date, setDate] = useState(() => shanghaiDate());
    const [data, setData] = useState<StoreDashboardData>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let current = true;
        setLoading(true);
        setError(false);
        getStoreDashboard(date).then((response) => {
            if (current) setData(response.data);
        }).catch(() => {
            if (current) setError(true);
        }).finally(() => {
            if (current) setLoading(false);
        });
        return () => { current = false; };
    }, [date, retry]);

    const report = !loading && !error && data?.date === date ? data : undefined;
    const orderTotal = report ? Object.values(report.orderTypes).reduce((total, count) => total + count, 0) : 0;

    return (
        <PageContainer title="店长经营看板">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Space wrap>
                    <Button type={date === shanghaiDate() ? 'primary' : 'default'} onClick={() => setDate(shanghaiDate())}>今日</Button>
                    <Button type={date === shanghaiDate(1) ? 'primary' : 'default'} onClick={() => setDate(shanghaiDate(1))}>昨日</Button>
                    <DatePicker aria-label="统计日期" allowClear={false} value={dayjs(date)}
                        onChange={(value) => { if (value) setDate(value.format('YYYY-MM-DD')); }} />
                    <Typography.Text type="secondary">北京时间 00:00 至次日 00:00</Typography.Text>
                </Space>
                {error && <Alert type="error" showIcon message="看板加载失败"
                    action={<Button size="small" onClick={() => setRetry((value) => value + 1)}>重试</Button>} />}
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                        <Card loading={loading}>
                            <Statistic title="客服派单操作数（含改派）" value={report?.dispatchCount ?? '—'} />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Card loading={loading}>
                            <Statistic title="订单收款总额（按收款时间，退款前）" prefix="¥" precision={2} value={report?.paidAmount ?? '—'} />
                        </Card>
                    </Col>
                </Row>
                <Card title="客服派单的订单类型分布" loading={loading}>
                    <Table rowKey="key" pagination={false} size="small" dataSource={report ? categories : []}
                        columns={[
                            { title: '订单类型', dataIndex: 'label' },
                            { title: '订单数（去重）', render: (_, row) => report?.orderTypes[row.key] },
                            { title: '占比', render: (_, row) => share(report?.orderTypes[row.key] ?? 0, orderTotal) },
                        ]} />
                </Card>
                <Card title="服务者接单排行">
                    <Typography.Paragraph type="secondary">按服务者确认接单的轮次计数，近 7 天和近 30 天均包含所选日期。</Typography.Paragraph>
                    <Table<StaffRow> key={date} rowKey="userId" loading={loading} dataSource={report?.staff ?? []}
                        scroll={{ x: 620 }} pagination={{ defaultPageSize: 20 }}
                        locale={{ emptyText: '暂无接单记录' }}
                        columns={[
                            { title: '服务者', render: (_, row) => row.name || `服务者 #${row.userId}` },
                            { title: '所选日接单量', dataIndex: 'selectedCount', align: 'right' },
                            { title: '近 7 天接单量', dataIndex: 'count7', align: 'right' },
                            { title: '近 30 天接单量', dataIndex: 'count30', align: 'right' },
                        ]}
                        expandable={{ expandedRowRender: (row) => (
                            <Table rowKey="key" pagination={false} size="small" dataSource={categories}
                                columns={[
                                    { title: '订单类型', dataIndex: 'label' },
                                    { title: '近 7 天接单量及占比', render: (_, type) => countAndShare(row.types7[type.key], row.count7) },
                                    { title: '近 30 天接单量及占比', render: (_, type) => countAndShare(row.types30[type.key], row.count30) },
                                ]} />
                        ) }} />
                </Card>
            </Space>
        </PageContainer>
    );
}
