import React, { useEffect, useMemo, useState } from 'react';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { DatePicker, message, Statistic, Row, Col, Space, Button, Divider } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { getRevenueOverview, RevenueOverviewRes } from '@/services/api';

const { RangePicker } = DatePicker;

export default function RevenueOverview() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<RevenueOverviewRes | null>(null);

    // 默认：今天（和后端默认一致）
    const defaultRange = useMemo<[Dayjs, Dayjs]>(() => {
        const start = dayjs().startOf('day');
        const end = dayjs().endOf('day');
        return [start, end];
    }, []);

    const [range, setRange] = useState<[Dayjs, Dayjs]>(defaultRange);

    const fetchData = async (r?: [Dayjs, Dayjs]) => {
        try {
            setLoading(true);
            const rr = r ?? range;
            const startAt = rr[0].toDate().toISOString();
            const endAt = rr[1].toDate().toISOString();
            const res = await getRevenueOverview({ startAt, endAt });
            setData(res as any);
        } catch (e) {
            message.error('获取营业额看板数据失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(defaultRange);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const totalOrders = data?.totalOrders ?? 0;
    const totalRevenue = Number(data?.totalRevenue ?? 0);

    const refundedOrders = data?.refundedOrders ?? 0;
    const refundedAmount = Number(data?.refundedAmount ?? 0);

    const costEstimated = Number(data?.costEstimated ?? 0);
    const profitEstimated = Number(data?.profitEstimated ?? 0);
    const profitRate = Number(data?.profitRate ?? 0);

    const giftedCost = Number(data?.giftedCost ?? 0);

    return (
        <PageContainer
            title="营业额数据看板"
            extra={
                <Space>
                    <RangePicker
                        value={range}
                        onChange={(v) => {
                            if (v && v[0] && v[1]) setRange([v[0], v[1]]);
                        }}
                        showTime={false}
                        allowClear={false}
                    />
                    <Button type="primary" loading={loading} onClick={() => fetchData()}>
                        查询
                    </Button>
                    <Button
                        loading={loading}
                        onClick={() => {
                            setRange(defaultRange);
                            fetchData(defaultRange);
                        }}
                    >
                        今天
                    </Button>
                </Space>
            }
        >
            <ProCard loading={loading} bordered>
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} lg={6}>
                        <Statistic title="总订单数" value={totalOrders} />
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Statistic title="总收益（营业额）" value={totalRevenue} precision={2} />
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Statistic title="退款订单数" value={refundedOrders} />
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Statistic title="退款金额" value={refundedAmount} precision={2} />
                    </Col>
                </Row>

                <Divider />

                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} lg={6}>
                        <Statistic title="成本预估（分出去的）" value={costEstimated} precision={2} />
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Statistic title="收益预估（利润）" value={profitEstimated} precision={2} />
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Statistic title="收益百分比" value={profitRate} precision={2} suffix="%" />
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Statistic title="赠送单成本" value={giftedCost} precision={2} />
                    </Col>
                </Row>

                <Divider />

                <div style={{ color: 'rgba(0,0,0,0.45)' }}>
                    说明：
                    <br />
                    1) 时间口径按订单 createdAt；营业额与退款金额默认排除赠送单（isGifted=true）。
                    <br />
                    2) 成本预估来自钱包结算收益流水（排除已冲正 REVERSED）；并扣除赠送单对应成本。
                </div>
            </ProCard>
        </PageContainer>
    );
}
