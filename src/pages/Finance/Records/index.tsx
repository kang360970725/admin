import React, { useMemo, useRef, useState } from 'react';
import { Card, DatePicker, Row, Col, Statistic, Select, Space, Tag } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { postFinanceRecordList } from '@/services/api';

const { RangePicker } = DatePicker;

const money = (v: any) => Number(v ?? 0).toFixed(2);

const FinanceRecordsPage: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const [summary, setSummary] = useState<any>({});

    const [dateRange, setDateRange] = useState<any>([
        dayjs().startOf('month'),
        dayjs().endOf('month'),
    ]);

    const columns: ProColumns<any>[] = [
        {
            title: '统计日期',
            dataIndex: 'statsDate',
            width: 110,
            search: false,
        },
        {
            title: '订单ID',
            dataIndex: 'orderId',
            width: 100,
            search: false,
        },
        {
            title: '客户ID',
            dataIndex: 'customerUserId',
            width: 100,
            search: false,
        },
        {
            title: '计费模式',
            dataIndex: 'billingMode',
            width: 100,
            valueType: 'select',
            valueEnum: {
                HOURLY: { text: '小时单' },
                GUARANTEED: { text: '保底单' },
                MODE_PLAY: { text: '玩法单' },
            },
        },
        {
            title: '订单类型',
            dataIndex: 'orderType',
            width: 110,
            valueType: 'select',
            valueEnum: {
                EXPERIENCE: { text: '体验单' },
                FUN: { text: '娱乐单' },
                ESCORT: { text: '护航单' },
                LUCKY_BAG: { text: '福袋单' },
                BLIND_BOX: { text: '盲盒单' },
                CUSTOM: { text: '自定义单' },
                CUSTOMIZED: { text: '定制单' },
            },
        },
        {
            title: '项目ID',
            dataIndex: 'projectId',
            width: 90,
            search: false,
        },
        {
            title: '业务线',
            dataIndex: 'bizLine',
            width: 120,
            search: false,
        },
        {
            title: '应收',
            dataIndex: 'receivableAmount',
            width: 110,
            search: false,
            render: (_, r) => `¥${money(r.receivableAmount)}`,
        },
        {
            title: '实收',
            dataIndex: 'paidAmount',
            width: 110,
            search: false,
            render: (_, r) => `¥${money(r.paidAmount)}`,
        },
        {
            title: '总优惠',
            dataIndex: 'discountAmount',
            width: 110,
            search: false,
            render: (_, r) => `¥${money(r.discountAmount)}`,
        },
        {
            title: '优惠券优惠',
            dataIndex: 'couponDiscountAmount',
            width: 120,
            search: false,
            render: (_, r) => `¥${money(r.couponDiscountAmount)}`,
        },
        {
            title: '其他优惠',
            dataIndex: 'otherDiscountAmount',
            width: 120,
            search: false,
            render: (_, r) => `¥${money(r.otherDiscountAmount)}`,
        },
        {
            title: '打手成本',
            dataIndex: 'playerCostAmount',
            width: 110,
            search: false,
            render: (_, r) => `¥${money(r.playerCostAmount)}`,
        },
        {
            title: '客服成本',
            dataIndex: 'csCostAmount',
            width: 110,
            search: false,
            render: (_, r) => `¥${money(r.csCostAmount)}`,
        },
        {
            title: '运营成本',
            dataIndex: 'operationCostAmount',
            width: 110,
            search: false,
            render: (_, r) => `¥${money(r.operationCostAmount)}`,
        },
        {
            title: '渠道成本',
            dataIndex: 'channelCostAmount',
            width: 110,
            search: false,
            render: (_, r) => `¥${money(r.channelCostAmount)}`,
        },
        {
            title: '售后成本',
            dataIndex: 'afterSaleCostAmount',
            width: 110,
            search: false,
            render: (_, r) => `¥${money(r.afterSaleCostAmount)}`,
        },
        {
            title: '赔付成本',
            dataIndex: 'complaintPenaltyAmount',
            width: 110,
            search: false,
            render: (_, r) => `¥${money(r.complaintPenaltyAmount)}`,
        },
        {
            title: '毛利润',
            dataIndex: 'grossProfitAmount',
            width: 110,
            search: false,
            render: (_, r) => `¥${money(r.grossProfitAmount)}`,
        },
        {
            title: '投诉',
            dataIndex: 'isComplained',
            width: 80,
            valueType: 'select',
            valueEnum: {
                true: { text: '是' },
                false: { text: '否' },
            },
            render: (_, r) => (r.isComplained ? <Tag color="red">投诉</Tag> : '-'),
        },
        {
            title: '售后',
            dataIndex: 'isAfterSale',
            width: 80,
            valueType: 'select',
            valueEnum: {
                true: { text: '是' },
                false: { text: '否' },
            },
            render: (_, r) => (r.isAfterSale ? <Tag color="orange">售后</Tag> : '-'),
        },
        {
            title: '取消',
            dataIndex: 'isCancelled',
            width: 80,
            valueType: 'select',
            valueEnum: {
                true: { text: '是' },
                false: { text: '否' },
            },
            render: (_, r) => (r.isCancelled ? <Tag>取消</Tag> : '-'),
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            valueType: 'select',
            valueEnum: {
                EFFECTIVE: { text: '有效', status: 'Success' },
                VOIDED: { text: '作废', status: 'Default' },
            },
        },
        {
            title: '备注',
            dataIndex: 'remark',
            width: 180,
            search: false,
            ellipsis: true,
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 180,
            search: false,
            valueType: 'dateTime',
        },
    ];

    return (
        <div>
            <Card style={{ marginBottom: 16 }}>
                <Space wrap>
                    <RangePicker value={dateRange} onChange={(val) => setDateRange(val)} />
                </Space>
            </Card>

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8} lg={4}>
                    <Card>
                        <Statistic title="订单数" value={summary.orderCount || 0} />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={4}>
                    <Card>
                        <Statistic title="实付营收" value={money(summary.paidAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={4}>
                    <Card>
                        <Statistic title="订单总支出" value={money(summary.orderTotalCost)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={4}>
                    <Card>
                        <Statistic title="毛利润" value={money(summary.grossProfitAmountTotal)} prefix="¥" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={4}>
                    <Card>
                        <Statistic title="毛利率" value={money(summary.grossProfitRate)} suffix="%" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8} lg={4}>
                    <Card>
                        <Statistic title="营销成本" value={money(summary.marketingCostTotal)} prefix="¥" />
                    </Card>
                </Col>
            </Row>

            <ProTable<any>
                rowKey="id"
                actionRef={actionRef}
                columns={columns}
                scroll={{ x: 2600 }}
                search={{
                    labelWidth: 88,
                }}
                pagination={{
                    pageSize: 20,
                }}
                request={async (params) => {
                    const [start, end] = dateRange || [];

                    const res = await postFinanceRecordList({
                        page: params.current,
                        pageSize: params.pageSize,

                        startDate: start ? dayjs(start).format('YYYY-MM-DD') : undefined,
                        endDate: end ? dayjs(end).format('YYYY-MM-DD') : undefined,

                        billingMode: params.billingMode,
                        orderType: params.orderType,
                        status: params.status,

                        isComplained:
                            params.isComplained === 'true'
                                ? true
                                : params.isComplained === 'false'
                                    ? false
                                    : undefined,

                        isAfterSale:
                            params.isAfterSale === 'true'
                                ? true
                                : params.isAfterSale === 'false'
                                    ? false
                                    : undefined,

                        isCancelled:
                            params.isCancelled === 'true'
                                ? true
                                : params.isCancelled === 'false'
                                    ? false
                                    : undefined,
                    });

                    setSummary(res?.data?.summary || {});

                    return {
                        data: res?.data?.list || [],
                        success: res?.success ?? true,
                        total: res?.data?.total || 0,
                    };
                }}
            />
        </div>
    );
};

export default FinanceRecordsPage;