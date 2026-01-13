import React, { useEffect, useState } from 'react';
import { PageContainer, ProCard, ProDescriptions } from '@ant-design/pro-components';
import { message, Statistic, Row, Col, Divider } from 'antd';
import { getWalletAccount, type WalletAccount } from '@/services/api';

// ✅ 直接复用你现有的提现页面组件（不搬逻辑，最小改动）
import WithdrawalMine from './Withdrawals/Mine';

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

    const available = Number((account as any)?.availableBalance ?? 0);
    const frozen = Number((account as any)?.frozenBalance ?? 0);
    const total = available + frozen;

    return (
        <PageContainer>
            <ProCard loading={loading} bordered>
                <Row gutter={16}>
                    <Col span={8}>
                        <Statistic title="可用余额" value={available} precision={2} />
                    </Col>
                    <Col span={8}>
                        <Statistic title="冻结余额" value={frozen} precision={2} />
                    </Col>
                    <Col span={8}>
                        <Statistic title="总资产" value={total} precision={2} />
                    </Col>
                </Row>

                <Divider />

                <ProDescriptions
                    title="账户信息"
                    column={2}
                    dataSource={account as any}
                    columns={[
                        { title: '钱包ID', dataIndex: 'id' },
                        { title: '钱包UID', dataIndex: 'walletUid' },
                        // { title: '用户ID', dataIndex: 'userId' },
                        { title: '开户时间', dataIndex: 'createdAt' },
                        // { title: '更新时间', dataIndex: 'updatedAt' },
                    ]}
                />
            </ProCard>

            <Divider />

            <WithdrawalMine />
            {/*<ProCard title="提现（申请 + 我的记录）" bordered>*/}
            {/*</ProCard>*/}
        </PageContainer>
    );
}
