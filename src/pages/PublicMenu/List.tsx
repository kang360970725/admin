import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Input, Select, Space, Tag, Typography } from 'antd';
import { history } from '@umijs/max';
import { postPublicMenuList, type PublicMenuItem } from '@/services/api';
import './menu.less';

const { Title, Text, Paragraph } = Typography;

const ALL = '__ALL__';

export default function PublicMenuListPage() {
    const [keyword, setKeyword] = useState('');
    const [gameType, setGameType] = useState(ALL);
    const [projectType, setProjectType] = useState(ALL);
    const [category, setCategory] = useState(ALL);
    const [loading, setLoading] = useState(false);
    const [list, setList] = useState<PublicMenuItem[]>([]);
    const [filters, setFilters] = useState<{ gameTypes: string[]; projectTypes: string[]; categories: string[] }>({
        gameTypes: [],
        projectTypes: [],
        categories: [],
    });

    const requestData = useMemo(
        () => ({
            keyword: keyword.trim() || undefined,
            gameType: gameType === ALL ? undefined : gameType,
            projectType: projectType === ALL ? undefined : projectType,
            category: category === ALL ? undefined : category,
        }),
        [keyword, gameType, projectType, category],
    );

    const load = async () => {
        try {
            setLoading(true);
            const res = await postPublicMenuList(requestData);
            setList(Array.isArray(res?.list) ? res.list : []);
            setFilters({
                gameTypes: res?.filters?.gameTypes || [],
                projectTypes: res?.filters?.projectTypes || [],
                categories: res?.filters?.categories || [],
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [requestData.gameType, requestData.projectType, requestData.category]);

    return (
        <div className="public-menu-page">
            <div className="public-menu-header">
                <Title level={2}>蓝猫菜单</Title>
                <Text type="secondary">可按游戏类型、项目类型、分类快速筛选</Text>
            </div>

            <Card className="public-menu-toolbar" bordered={false}>
                <Space wrap size={12}>
                    <Input.Search
                        allowClear
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        onSearch={load}
                        placeholder="搜索菜单项目"
                        style={{ width: 240 }}
                    />
                    <Select value={gameType} style={{ width: 180 }} onChange={setGameType}>
                        <Select.Option value={ALL}>全部游戏类型</Select.Option>
                        {filters.gameTypes.map((x) => (
                            <Select.Option key={x} value={x}>
                                {x}
                            </Select.Option>
                        ))}
                    </Select>
                    <Select value={projectType} style={{ width: 180 }} onChange={setProjectType}>
                        <Select.Option value={ALL}>全部项目类型</Select.Option>
                        {filters.projectTypes.map((x) => (
                            <Select.Option key={x} value={x}>
                                {x}
                            </Select.Option>
                        ))}
                    </Select>
                    <Select value={category} style={{ width: 180 }} onChange={setCategory}>
                        <Select.Option value={ALL}>全部分类</Select.Option>
                        {filters.categories.map((x) => (
                            <Select.Option key={x} value={x}>
                                {x}
                            </Select.Option>
                        ))}
                    </Select>
                </Space>
            </Card>

            <div className="public-menu-grid">
                {!loading && list.length === 0 ? (
                    <Card bordered={false}>
                        <Empty description="暂无菜单项目" />
                    </Card>
                ) : null}
                {list.map((item) => (
                    <Card
                        key={item.id}
                        hoverable
                        className="public-menu-card"
                        cover={
                            <img
                                alt={item.name}
                                src={item.coverImage || 'https://dummyimage.com/760x420/f3f4f6/9ca3af&text=MENU'}
                            />
                        }
                        onClick={() => history.push(`/menu/${item.id}`)}
                    >
                        <Title level={4} style={{ marginBottom: 8 }}>
                            {item.name}
                        </Title>
                        <Space wrap size={[6, 6]}>
                            {item.gameType ? <Tag color="blue">{item.gameType}</Tag> : null}
                            {item.projectType ? <Tag color="geekblue">{item.projectType}</Tag> : null}
                            {item.category ? <Tag color="green">{item.category}</Tag> : null}
                            <Tag>{item.billingMode}</Tag>
                        </Space>
                        <Paragraph ellipsis={{ rows: 2 }} style={{ marginTop: 10, minHeight: 44 }}>
                            {item.description || '暂无简介'}
                        </Paragraph>
                        <div className="public-menu-price">¥{Number(item.price || 0).toFixed(2)}</div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
