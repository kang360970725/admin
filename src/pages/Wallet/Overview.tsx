import React, { useEffect, useState } from 'react';
import { PageContainer, ProCard, ProDescriptions } from '@ant-design/pro-components';
import { message, Statistic, Row, Col } from 'antd';
import { getWalletAccount, WalletAccount } from '@/services/api';

export default function WalletOverview() {
    const [loading, setLoading] = useState(false);
    const [account, setAccount] = useState<WalletAccount | null>(null);

    const load = async () => {
        try {
            setLoading(true);
            const res = await getWalletAccount();
            setAccount(res as any);
        } catch (e) {
            message.error('获取钱包账户失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const available = Number(account?.availableBalance ?? 0);
    const frozen = Number(account?.frozenBalance ?? 0);
    const total = available + frozen;

    return (
        <PageContainer>
            <ProCard loading={loading} bordered>
                <Row gutter={16}>
                    <Col xs={24} sm={8}>
                        <Statistic title="可用余额" value={available} precision={2} />
                    </Col>
                    <Col xs={24} sm={8}>
                        <Statistic title="冻结余额" value={frozen} precision={2} />
                    </Col>
                    <Col xs={24} sm={8}>
                        <Statistic title="总余额" value={total} precision={2} />
                    </Col>
                </Row>
            </ProCard>

            <ProCard style={{ marginTop: 16 }} bordered title="账户信息" loading={loading}>
                <ProDescriptions column={2}>
                    <ProDescriptions.Item label="账户ID">{account?.id ?? '--'}</ProDescriptions.Item>
                    <ProDescriptions.Item label="用户ID">{account?.userId ?? '--'}</ProDescriptions.Item>
                    <ProDescriptions.Item label="创建时间">{account?.createdAt ?? '--'}</ProDescriptions.Item>
                    <ProDescriptions.Item label="更新时间">{account?.updatedAt ?? '--'}</ProDescriptions.Item>
                </ProDescriptions>
            </ProCard>
        </PageContainer>
    );
}
