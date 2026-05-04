import React, { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Space, Spin, Tag, Typography } from 'antd';
import { history, useParams } from '@umijs/max';
import { getPublicMenuDetail, type PublicMenuDetail } from '@/services/api';
import './menu.less';

const { Title, Paragraph } = Typography;

export default function PublicMenuDetailPage() {
    const params = useParams<{ id: string }>();
    const id = Number(params?.id || 0);
    const [loading, setLoading] = useState(false);
    const [detail, setDetail] = useState<PublicMenuDetail | null>(null);

    useEffect(() => {
        if (!id) return;
        (async () => {
            setLoading(true);
            try {
                const res = await getPublicMenuDetail(id);
                setDetail(res || null);
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    return (
        <div className="public-menu-page">
            <Card bordered={false} className="public-menu-toolbar">
                <Space>
                    <Button onClick={() => history.push('/menu')}>返回菜单</Button>
                    <Title level={4} style={{ margin: 0 }}>
                        菜单详情
                    </Title>
                </Space>
            </Card>

            <Spin spinning={loading}>
                {!detail ? null : (
                    <Card className="public-menu-detail" bordered={false}>
                        <img
                            className="public-menu-detail-cover"
                            alt={detail.name}
                            src={detail.coverImage || 'https://dummyimage.com/1080x480/f3f4f6/9ca3af&text=DETAIL'}
                        />
                        <div style={{ marginTop: 16 }}>
                            <Title level={3} style={{ marginBottom: 8 }}>
                                {detail.name}
                            </Title>
                            <Space wrap size={[8, 8]}>
                                {detail.gameType ? <Tag color="blue">{detail.gameType}</Tag> : null}
                                {detail.projectType ? <Tag color="geekblue">{detail.projectType}</Tag> : null}
                                {detail.category ? <Tag color="green">{detail.category}</Tag> : null}
                                <Tag>{detail.billingMode}</Tag>
                            </Space>
                            <div className="public-menu-price">¥{Number(detail.price || 0).toFixed(2)}</div>
                            <Paragraph style={{ marginTop: 8 }}>{detail.description || '暂无简介'}</Paragraph>
                        </div>

                        <Descriptions column={2} bordered size="small" style={{ marginTop: 12 }}>
                            <Descriptions.Item label="游戏类型">{detail.gameType || '-'}</Descriptions.Item>
                            <Descriptions.Item label="项目类型">{detail.projectType || '-'}</Descriptions.Item>
                            <Descriptions.Item label="分类">{detail.category || '-'}</Descriptions.Item>
                            <Descriptions.Item label="计费模式">{detail.billingMode || '-'}</Descriptions.Item>
                        </Descriptions>

                        <Card size="small" style={{ marginTop: 16 }} title="图文详情">
                            <div
                                className="public-menu-rich"
                                dangerouslySetInnerHTML={{ __html: detail.richContent || '<p>暂无图文内容</p>' }}
                            />
                        </Card>
                    </Card>
                )}
            </Spin>
        </div>
    );
}
