import React, { useState } from 'react';
import { PageContainer, ProForm, ProFormDateRangePicker } from '@ant-design/pro-components';
import { Card, Table, Tag, message } from 'antd';
import { querySettlementBatch } from '@/services/api';

const ExperienceSettlementPage: React.FC = () => {
    const [data, setData] = useState<any>(null);

    return (
        <PageContainer title="体验单结算（每3个自然日）">
            <Card style={{ marginBottom: 16 }}>
                <ProForm
                    submitter={{ searchConfig: { submitText: '查询' } }}
                    onFinish={async (v) => {
                        try {
                            const [start, end] = v.range || [];
                            const res = await querySettlementBatch({
                                batchType: 'EXPERIENCE_3DAY',
                                periodStart: start ? new Date(start).toISOString() : undefined,
                                periodEnd: end ? new Date(end).toISOString() : undefined,
                            });
                            setData(res);
                            return true;
                        } catch (e: any) {
                            message.error(e?.response?.data?.message || '查询失败');
                            return false;
                        }
                    }}
                >
                    <ProFormDateRangePicker name="range" label="时间范围" />
                </ProForm>
            </Card>

            {data && (
                <Card title="汇总">
                    <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                        <div>总收入：<b>¥{Number(data.summary?.totalIncome || 0).toFixed(2)}</b></div>
                        <div>俱乐部收入：<b>¥{Number(data.summary?.clubIncome || 0).toFixed(2)}</b></div>
                        <div>应结款：<b>¥{Number(data.summary?.payableToPlayers || 0).toFixed(2)}</b></div>
                    </div>

                    <Table
                        rowKey="userId"
                        dataSource={data.players || []}
                        pagination={{ pageSize: 10 }}
                        columns={[
                            { title: '陪玩', dataIndex: 'name', render: (_, r) => r.name || r.phone || '-' },
                            { title: '结算类型', dataIndex: 'settlementType', render: (t) => <Tag>{t}</Tag> },
                            { title: '总接单数', dataIndex: 'totalOrders' },
                            { title: '总收益', dataIndex: 'totalEarnings', render: (v) => <b>¥{Number(v).toFixed(2)}</b> },
                        ]}
                    />
                </Card>
            )}
        </PageContainer>
    );
};

export default ExperienceSettlementPage;
