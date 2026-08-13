import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Card, Col, DatePicker, Radio, Row, Space, Statistic, Tag, Typography } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { history } from '@umijs/max';
import { getRenewalLeaderboard } from '@/services/api';

dayjs.extend(isoWeek);

type Dimension = 'DAY' | 'WEEK' | 'MONTH';

type RenewalLeaderboardRow = {
    rank: number;
    groupKey: string;
    memberUserIds: Array<number | string | Record<string, any>>;
    memberNames: Array<string | Record<string, any>>;
    memberNameText: string;
    renewalOrderCount: number;
    renewalAmount: number;
    bonusTotalAmount: number;
    avgBonusRate: number;
    currentExcellentUserIds?: number[];
    hasCurrentExcellentStaff?: boolean;
    lastSettledAt?: string;
    lastOrderId?: number;
    lastOrderAutoSerial?: string;
};

const dimensionText: Record<Dimension, string> = {
    DAY: '按日',
    WEEK: '按周',
    MONTH: '按月',
};

const money = (value: any) => `¥${Number(value || 0).toFixed(2)}`;

const formatMemberValue = (value: any, fields: string[]) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
    if (typeof value === 'object') {
        for (const field of fields) {
            const fieldValue = value?.[field];
            if (fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim()) {
                return String(fieldValue).trim();
            }
        }
    }
    return '';
};

const getMemberNameText = (row: RenewalLeaderboardRow) => {
    const directText = String(row.memberNameText || '').trim();
    if (directText && !directText.includes('[object Object]')) return directText;
    const names = Array.isArray(row.memberNames)
        ? row.memberNames
            .map((item) => formatMemberValue(item, ['nickname', 'name', 'realName', 'displayName', 'username', 'userId', 'id']))
            .filter(Boolean)
        : [];
    return names.join('、') || String(row.groupKey || '-');
};

const getMemberIdText = (row: RenewalLeaderboardRow) => {
    const ids = Array.isArray(row.memberUserIds)
        ? row.memberUserIds
            .map((item) => formatMemberValue(item, ['userId', 'id', 'value']))
            .filter(Boolean)
        : [];
    return ids.join('、') || String(row.groupKey || '-');
};

const normalizeMemberIds = (row: RenewalLeaderboardRow) => (
    Array.isArray(row.memberUserIds)
        ? row.memberUserIds
            .map((item) => Number(formatMemberValue(item, ['userId', 'id', 'value'])))
            .filter((id) => Number.isFinite(id) && id > 0)
        : []
);

const buildRange = (dimension: Dimension, value: Dayjs) => {
    if (dimension === 'WEEK') {
        return {
            startAt: value.startOf('isoWeek').toISOString(),
            endAt: value.endOf('isoWeek').toISOString(),
            label: `${value.startOf('isoWeek').format('YYYY-MM-DD')} 至 ${value.endOf('isoWeek').format('YYYY-MM-DD')}`,
        };
    }
    if (dimension === 'MONTH') {
        return {
            startAt: value.startOf('month').toISOString(),
            endAt: value.endOf('month').toISOString(),
            label: value.format('YYYY-MM'),
        };
    }
    return {
        startAt: value.startOf('day').toISOString(),
        endAt: value.endOf('day').toISOString(),
        label: value.format('YYYY-MM-DD'),
    };
};

const RenewalLeaderboardPage: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const [dimension, setDimension] = useState<Dimension>('DAY');
    const [dateValue, setDateValue] = useState<Dayjs>(dayjs());
    const [summary, setSummary] = useState<any>({});
    const currentRange = useMemo(() => buildRange(dimension, dateValue || dayjs()), [dimension, dateValue]);

    useEffect(() => {
        actionRef.current?.reload();
    }, [dimension, dateValue]);

    const columns: ProColumns<RenewalLeaderboardRow>[] = [
        {
            title: '排名',
            dataIndex: 'rank',
            width: 80,
            search: false,
            render: (_, row) => {
                const rank = Number(row.rank || 0);
                const color = rank === 1 ? 'gold' : rank === 2 ? 'blue' : rank === 3 ? 'purple' : 'default';
                return <Tag color={color}>#{rank}</Tag>;
            },
        },
        {
            title: '续单组合',
            dataIndex: 'keyword',
            render: (_, row) => (
                <Space direction="vertical" size={2}>
                    <Space wrap size={[4, 4]}>
                        {(() => {
                            const names = getMemberNameText(row).split('、').filter(Boolean);
                            const ids = normalizeMemberIds(row);
                            const excellentSet = new Set((row.currentExcellentUserIds || []).map((id) => Number(id)));
                            if (!names.length) return <Typography.Text strong>{getMemberNameText(row)}</Typography.Text>;
                            return names.map((name, index) => {
                                const isExcellent = excellentSet.has(Number(ids[index]));
                                return (
                                    <Tag key={`${name}_${index}`} color={isExcellent ? 'gold' : 'blue'}>
                                        {name}{isExcellent ? ' · 当前优秀' : ''}
                                    </Tag>
                                );
                            });
                        })()}
                    </Space>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        ID：{getMemberIdText(row)}
                    </Typography.Text>
                    {row.hasCurrentExcellentStaff ? (
                        <Typography.Text type="warning" style={{ fontSize: 12 }}>
                            当前有成员入围优秀服务者，仅作当前名单高亮，不影响历史分红快照
                        </Typography.Text>
                    ) : null}
                </Space>
            ),
            fieldProps: {
                placeholder: '搜索打手姓名 / ID / 订单号',
            },
        },
        {
            title: '续单单数',
            dataIndex: 'renewalOrderCount',
            width: 120,
            search: false,
            sorter: false,
            render: (_, row) => `${Number(row.renewalOrderCount || 0)} 单`,
        },
        {
            title: '续单金额',
            dataIndex: 'renewalAmount',
            width: 130,
            search: false,
            render: (_, row) => money(row.renewalAmount),
        },
        {
            title: '续单分红',
            dataIndex: 'bonusTotalAmount',
            width: 130,
            search: false,
            render: (_, row) => <Typography.Text type="success">{money(row.bonusTotalAmount)}</Typography.Text>,
        },
        {
            title: '平均分红比例',
            dataIndex: 'avgBonusRate',
            width: 130,
            search: false,
            render: (_, row) => `${Number(row.avgBonusRate || 0).toFixed(2)}%`,
        },
        {
            title: '最近结算',
            dataIndex: 'lastSettledAt',
            width: 210,
            search: false,
            render: (_, row) => (
                <Space direction="vertical" size={2}>
                    <Typography.Link
                        onClick={() => row.lastOrderId && history.push(`/orders/${row.lastOrderId}`)}
                    >
                        {row.lastOrderAutoSerial || '-'}
                    </Typography.Link>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {row.lastSettledAt ? dayjs(row.lastSettledAt).format('YYYY-MM-DD HH:mm') : '-'}
                    </Typography.Text>
                </Space>
            ),
        },
    ];

    return (
        <PageContainer
            title="续单榜单"
            subTitle="按续单组合统计已结算续单，支持日/周/月时间筛选"
        >
            <Card style={{ marginBottom: 16 }}>
                <Row gutter={[16, 16]} align="middle">
                    <Col flex="none">
                        <Space>
                            <Radio.Group
                                optionType="button"
                                buttonStyle="solid"
                                value={dimension}
                                options={[
                                    { label: '按日', value: 'DAY' },
                                    { label: '按周', value: 'WEEK' },
                                    { label: '按月', value: 'MONTH' },
                                ]}
                                onChange={(e) => {
                                    setDimension(e.target.value);
                                }}
                            />
                            <DatePicker
                                picker={dimension === 'MONTH' ? 'month' : dimension === 'WEEK' ? 'week' : 'date'}
                                value={dateValue}
                                allowClear={false}
                                onChange={(value) => {
                                    setDateValue(value || dayjs());
                                }}
                            />
                            <Tag color="blue">{dimensionText[dimension]}：{currentRange.label}</Tag>
                        </Space>
                    </Col>
                    <Col flex="auto" />
                    <Col>
                        <Statistic title="上榜组合" value={Number(summary.totalGroups || 0)} suffix="组" />
                    </Col>
                    <Col>
                        <Statistic title="续单单数" value={Number(summary.totalRenewalOrders || 0)} suffix="单" />
                    </Col>
                    <Col>
                        <Statistic title="续单金额" value={Number(summary.totalRenewalAmount || 0)} precision={2} prefix="¥" />
                    </Col>
                    <Col>
                        <Statistic title="续单分红" value={Number(summary.totalBonusAmount || 0)} precision={2} prefix="¥" />
                    </Col>
                </Row>
            </Card>

            <ProTable<RenewalLeaderboardRow>
                actionRef={actionRef}
                rowKey="groupKey"
                columns={columns}
                search={{ labelWidth: 100 }}
                options={{ density: false }}
                request={async (params) => {
                    const range = buildRange(dimension, dateValue || dayjs());
                    const res: any = await getRenewalLeaderboard({
                        dimension,
                        startAt: range.startAt,
                        endAt: range.endAt,
                        keyword: params.keyword ? String(params.keyword).trim() : undefined,
                        page: params.current || 1,
                        limit: params.pageSize || 20,
                    });
                    setSummary(res?.summary || {});
                    return {
                        data: Array.isArray(res?.items) ? res.items : [],
                        total: Number(res?.total || 0),
                        success: true,
                    };
                }}
                pagination={{ defaultPageSize: 20, showSizeChanger: true }}
            />
        </PageContainer>
    );
};

export default RenewalLeaderboardPage;
