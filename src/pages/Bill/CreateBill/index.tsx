import React, { useState, useEffect, useRef } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import {
    Card,
    Form,
    Input,
    Select,
    InputNumber,
    DatePicker,
    Button,
    message,
    Space,
    Table,
    Tag,
    Modal,
    Alert,
    Row,
    Col,
    Statistic
} from 'antd';
import { createBill, getGameProjects, getUsers } from '@/services/api';
import { useAccess } from 'umi';
import moment from 'moment';

const { Option } = Select;
const { TextArea } = Input;

const CreateBill: React.FC = () => {
    const [form] = Form.useForm();
    const access = useAccess();
    const [projects, setProjects] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [parsedData, setParsedData] = useState<any>(null);
    const [parsing, setParsing] = useState(false);
    const [unmatchedPlayers, setUnmatchedPlayers] = useState<string[]>([]);
    const [earningsPreview, setEarningsPreview] = useState<any>(null);
    const descriptionRef = useRef<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [projectsData, usersData] = await Promise.all([
                getGameProjects(),
                getUsers({ page: 1, limit: 1000 })
            ]);
            setProjects(projectsData.data || projectsData);
            setUsers(usersData.data || usersData);
        } catch (error) {
            message.error('数据加载失败');
        }
    };

    // 简化的文本解析
    const parseFullOrder = (description: string) => {
        const result: any = {
            players: [],
            supplementPlayers: [],
            supplementAmount: 0,
            orderStatus: 'PENDING',
        };

        const lines = description.split('\n');

        lines.forEach(line => {
            const trimmed = line.trim();

            // 解析单号
            if (trimmed.includes('单') && !result.manualSerial) {
                const match = trimmed.match(/单\s*(\d+)/);
                if (match) result.manualSerial = `单${match[1]}`;
            }

            // 解析客户ID
            if ((trimmed.includes('客户id') || trimmed.includes('客户ID')) && !result.customerGameId) {
                const match = trimmed.split(/[：:]/)[1]?.trim();
                if (match) result.customerGameId = match;
            }

            // 解析派单客服
            if (trimmed.includes('派单客服') && !result.dispatcher) {
                const match = trimmed.split(/[：:]/)[1]?.trim();
                if (match) result.dispatcher = match;
            }

            // 解析接单时间
            if (trimmed.includes('接单时间') && !result.acceptTime) {
                const timePart = trimmed.split(/[：:]/)[1]?.trim();
                if (timePart) result.acceptTime = parseTimeString(timePart);
            }

            // 解析接单陪玩
            if (trimmed.includes('接单陪玩') && result.players.length === 0) {
                const match = trimmed.split(/[：:]/)[1]?.trim();
                if (match) {
                    result.players = match.split(/\s+/).filter((p: string) => p);
                }
            }

            // 解析补单信息
            if ((trimmed.includes('+') || trimmed.includes('加保底')) && !result.supplementAmount) {
                const match = trimmed.match(/(\d+)[wW万]/);
                if (match) {
                    result.supplementAmount = parseInt(match[1]) * 10000;
                    // 提取补单玩家
                    const playerMatch = trimmed.match(/([\u4e00-\u9fa5]{2,3})\s+([\u4e00-\u9fa5]{2,3})/);
                    if (playerMatch) {
                        result.supplementPlayers = [playerMatch[1], playerMatch[2]];
                    }
                }
            }

            // 解析已完成陪玩
            if (trimmed.includes('已打完') && !trimmed.includes('+')) {
                const playerMatch = trimmed.match(/[\u4e00-\u9fa5]{2,3}/g);
                if (playerMatch) {
                    playerMatch.forEach(player => {
                        if (!result.players.includes(player) && !['已打完', '已打'].includes(player)) {
                            result.players.push(player);
                        }
                    });
                }
            }
        });

        return result;
    };

    const parseTimeString = (timeStr: string): string => {
        const cleanTime = timeStr.replace(/[：:\.．]/g, ':').trim();
        const timeMatch = cleanTime.match(/(\d{1,2}):(\d{1,2})/);
        if (timeMatch) {
            const hours = timeMatch[1].padStart(2, '0');
            const minutes = timeMatch[2].padStart(2, '0');
            return `${hours}:${minutes}`;
        }
        return '';
    };

    const handleParseText = () => {
        // 通过 ref 获取 textarea 的值
        const description = descriptionRef.current?.resizableTextArea?.textArea?.value;

        if (!description) {
            message.warning('请先输入订单文本');
            return;
        }

        setParsing(true);
        try {
            const parsed = parseFullOrder(description);
            setParsedData(parsed);

            // 自动填充表单字段
            const updates: any = {};

            if (parsed.manualSerial) updates.manualSerial = parsed.manualSerial;
            if (parsed.customerGameId) updates.customerGameId = parsed.customerGameId;
            if (parsed.dispatcher) updates.dispatcher = parsed.dispatcher;
            if (parsed.supplementAmount) updates.supplementAmount = parsed.supplementAmount;

            // 时间处理
            if (parsed.acceptTime) {
                const today = new Date().toISOString().split('T')[0];
                updates.acceptTime = moment(`${today} ${parsed.acceptTime}`);
            }

            form.setFieldsValue(updates);

            // 匹配玩家到用户ID
            const unmatched: string[] = [];
            const allPlayers = [...parsed.players, ...parsed.supplementPlayers];
            const playerUserIds = matchPlayersToUserIds(allPlayers, users, unmatched);

            form.setFieldValue('players', playerUserIds);
            setUnmatchedPlayers(unmatched);

            if (unmatched.length > 0) {
                message.warning(`有 ${unmatched.length} 个陪玩未匹配到系统用户`);
            } else {
                message.success('解析完成！所有陪玩都已匹配');
            }

        } catch (error) {
            console.error('解析错误:', error);
            message.error('文本解析失败');
        } finally {
            setParsing(false);
        }
    };

    const matchPlayersToUserIds = (playerNames: string[], userList: any[], unmatched: string[]): number[] => {
        return playerNames.map(playerName => {
            const user = userList.find(u =>
                u.name === playerName || u.realName === playerName ||
                u.name?.includes(playerName) || playerName.includes(u.name)
            );
            if (!user) unmatched.push(playerName);
            return user?.id;
        }).filter(id => id);
    };

    // 计算收益预览 - 使用正确的算法
    const calculateEarningsPreview = () => {
        try {
            const values = form.getFieldsValue();
            const project = projects.find(p => p.id === values.projectId);

            if (!project) return null;

            const orderAmount = values.actualAmount || project.price;
            const clubRate = values.customClubRate || project.clubRate || 0.1;
            const supplementAmount = values.supplementAmount || 0;
            const selectedPlayers = values.players || [];

            if (selectedPlayers.length === 0) return null;

            // 1. 俱乐部抽成
            const clubEarnings = orderAmount * clubRate;
            const remainingAmount = orderAmount - clubEarnings;

            // 2. 识别补单玩家（从解析数据中获取）
            const supplementPlayers = parsedData?.supplementPlayers || [];
            const supplementPlayerIds = matchPlayersToUserIds(supplementPlayers, users, []);

            // 3. 分离主力玩家和补单玩家
            const mainPlayers = selectedPlayers.filter((id: number) => !supplementPlayerIds.includes(id));
            const actualSupplementPlayers = selectedPlayers.filter((id: number) => supplementPlayerIds.includes(id));

            const earnings = [];

            // 4. 计算补单负收益
            if (supplementAmount > 0 && actualSupplementPlayers.length > 0 && project.baseAmount) {
                const supplementPerPlayer = - (supplementAmount / (project.baseAmount / orderAmount)) / actualSupplementPlayers.length;
                actualSupplementPlayers.forEach((userId: number) => {
                    const user = users.find(u => u.id === userId);
                    earnings.push({
                        userId,
                        name: user?.name || `用户${userId}`,
                        baseEarnings: 0,
                        supplementEarnings: supplementPerPlayer,
                        finalEarnings: supplementPerPlayer,
                        isSupplement: true,
                        supplementAmount: Math.abs(supplementPerPlayer)
                    });
                });
            }

            // 5. 计算主力玩家正收益（重新分配补单金额）
            if (mainPlayers.length > 0) {
                const totalDistribution = remainingAmount + Math.abs(supplementAmount);
                const earningPerPlayer = totalDistribution / mainPlayers.length;
                mainPlayers.forEach((userId: number) => {
                    const user = users.find(u => u.id === userId);
                    earnings.push({
                        userId,
                        name: user?.name || `用户${userId}`,
                        baseEarnings: earningPerPlayer,
                        supplementEarnings: 0,
                        finalEarnings: earningPerPlayer,
                        isSupplement: false,
                        supplementAmount: 0
                    });
                });
            }

            // 6. 处理未匹配的玩家（显示为虚拟玩家）
            unmatchedPlayers.forEach(playerName => {
                earnings.push({
                    userId: -1,
                    name: `${playerName} (未匹配)`,
                    baseEarnings: 0,
                    supplementEarnings: supplementPlayers.includes(playerName) ? -50 : 0, // 示例值
                    finalEarnings: supplementPlayers.includes(playerName) ? -50 : 0,
                    isSupplement: supplementPlayers.includes(playerName),
                    supplementAmount: supplementPlayers.includes(playerName) ? 50 : 0,
                    isUnmatched: true
                });
            });

            return {
                clubEarnings: clubEarnings || 0,
                playerEarnings: earnings,
                clubRate: (clubRate * 100) || 0,
                totalOrderAmount: orderAmount
            };
        } catch (error) {
            console.error('收益计算错误:', error);
            return null;
        }
    };

    const handlePreview = () => {
        const earnings = calculateEarningsPreview();
        setEarningsPreview(earnings);
        setPreviewVisible(true);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            await createBill(values);
            message.success('订单创建成功');
            form.resetFields();
            setPreviewVisible(false);
            setParsedData(null);
            setUnmatchedPlayers([]);
            // 清空 textarea
            if (descriptionRef.current) {
                descriptionRef.current.resizableTextArea.textArea.value = '';
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || '创建订单失败');
        } finally {
            setLoading(false);
        }
    };

    const staffUsers = users.filter(user =>
        ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(user.userType)
    );

    return (
        <PageContainer>
            <Card title="创建订单">
                {/* 文本解析区域 */}
                <Card title="订单文本解析" style={{ marginBottom: 16 }} size="small">
                    <Form.Item
                        name="description"
                        rules={[{ required: true, message: '请输入订单详情' }]}
                    >
                        <TextArea
                            ref={descriptionRef}
                            rows={4}
                            placeholder={`请粘贴订单文本，然后点击解析...\n示例：\n11月9号 单42\n项目：199保底1288w绝密体验单\n客户id：183315512791612597747\n派单客服：晨\n接单时间：20：47\n接单陪玩：康康 阿乐 小苗 可乐\n备注：康康 阿乐+222w\n小苗可乐已打完`}
                        />
                    </Form.Item>

                    <Space>
                        <Button onClick={handleParseText} loading={parsing} type="primary">
                            解析文本
                        </Button>
                        {unmatchedPlayers.length > 0 && (
                            <Alert
                                message={`未匹配陪玩: ${unmatchedPlayers.join(', ')}`}
                                type="warning"
                                showIcon
                                style={{ display: 'inline-flex', alignItems: 'center' }}
                            />
                        )}
                    </Space>
                </Card>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{ players: [] }}
                >
                    <Row gutter={16}>
                        {/* 第一列 */}
                        <Col span={8}>
                            <Form.Item name="manualSerial" label="手输单号">
                                <Input placeholder="单42" />
                            </Form.Item>

                            <Form.Item name="projectId" label="项目" rules={[{ required: true }]}>
                                <Select placeholder="选择项目">
                                    {projects.map(project => (
                                        <Option key={project.id} value={project.id}>
                                            {project.name}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item name="customerGameId" label="客户游戏ID">
                                <Input />
                            </Form.Item>

                            <Form.Item name="dispatcher" label="派单客服">
                                <Input />
                            </Form.Item>
                        </Col>

                        {/* 第二列 */}
                        <Col span={8}>
                            <Form.Item name="actualAmount" label="实付金额">
                                <InputNumber
                                    style={{ width: '100%' }}
                                    min={0}
                                    placeholder="留空使用项目价格"
                                />
                            </Form.Item>

                            <Form.Item name="customClubRate" label="抽成比例">
                                <InputNumber
                                    style={{ width: '100%' }}
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    placeholder="留空使用项目比例"
                                    formatter={value => value ? `${(value * 100).toFixed(0)}%` : ''}
                                />
                            </Form.Item>

                            <Form.Item name="supplementAmount" label="补单数额">
                                <InputNumber
                                    style={{ width: '100%' }}
                                    placeholder="炸单补保底金额"
                                />
                            </Form.Item>

                            <Form.Item name="acceptTime" label="接单时间">
                                <DatePicker showTime style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>

                        {/* 第三列 */}
                        <Col span={8}>
                            <Form.Item name="inviter" label="邀请人">
                                <Input />
                            </Form.Item>

                            <Form.Item name="orderTime" label="下单时间">
                                <DatePicker showTime style={{ width: '100%' }} />
                            </Form.Item>

                            <Form.Item name="paymentTime" label="付款时间">
                                <DatePicker showTime style={{ width: '100%' }} />
                            </Form.Item>

                            <Form.Item name="startTime" label="开单时间">
                                <DatePicker showTime style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* 陪玩选择区域 - 合并为一个列表 */}
                    <Card title="参与陪玩" size="small" style={{ marginTop: 16 }}>
                        <Form.Item name="players" rules={[{ required: true, message: '请选择至少一个陪玩' }]}>
                            <Select
                                mode="multiple"
                                placeholder="选择参与陪玩"
                                optionLabelProp="label"
                            >
                                {staffUsers.map(user => {
                                    const isSupplement = parsedData?.supplementPlayers.includes(user.name);
                                    const label = isSupplement
                                        ? `${user.name} (炸单补${parsedData?.supplementAmount / 10000}W)`
                                        : user.name;

                                    return (
                                        <Option key={user.id} value={user.id} label={label}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>{user.name} ({user.phone})</span>
                                                {isSupplement && (
                                                    <Tag color="red">
                                                        炸单补{parsedData?.supplementAmount / 10000}W
                                                    </Tag>
                                                )}
                                            </div>
                                        </Option>
                                    );
                                })}
                            </Select>
                        </Form.Item>
                        {parsedData?.supplementAmount > 0 && (
                            <Alert
                                message={`检测到炸单补保底: ${parsedData.supplementAmount / 10000}W，相关陪玩将承担负收益`}
                                type="warning"
                                showIcon
                            />
                        )}
                    </Card>

                    <Form.Item style={{ textAlign: 'center', marginTop: 24 }}>
                        <Space>
                            <Button onClick={handlePreview} type="default">
                                预览收益
                            </Button>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                创建订单
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>

            {/* 收益预览弹窗 */}
            <Modal
                title="收益预览"
                open={previewVisible}
                onCancel={() => setPreviewVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setPreviewVisible(false)}>取消</Button>,
                    <Button key="submit" type="primary" onClick={handleSubmit} loading={loading}>
                        确认创建
                    </Button>,
                ]}
                width={700}
            >
                {earningsPreview ? (
                    <div>
                        <Alert
                            message={`订单总额: ¥${earningsPreview.totalOrderAmount} | 俱乐部抽成: ${earningsPreview.clubRate}% (¥${earningsPreview.clubEarnings.toFixed(2)})`}
                            type="info"
                            style={{ marginBottom: 16 }}
                        />

                        <Table
                            columns={[
                                {
                                    title: '陪玩',
                                    dataIndex: 'name',
                                    render: (name: string, record: any) => (
                                        <span style={{ color: record.isUnmatched ? '#ff4d4f' : 'inherit' }}>
                                            {name}
                                        </span>
                                    )
                                },
                                {
                                    title: '类型',
                                    render: (_, record) => (
                                        <Tag color={record.isSupplement ? 'red' : record.isUnmatched ? 'orange' : 'blue'}>
                                            {record.isUnmatched ? '未匹配' : record.isSupplement ? '炸单' : '主力'}
                                        </Tag>
                                    )
                                },
                                {
                                    title: '基础收益',
                                    render: (_, record) => `¥${record.baseEarnings.toFixed(2)}`
                                },
                                {
                                    title: '补单收益',
                                    render: (_, record) => (
                                        <span style={{
                                            color: record.supplementEarnings < 0 ? '#ff4d4f' :
                                                record.supplementEarnings > 0 ? '#52c41a' : '#999'
                                        }}>
                                            {record.supplementEarnings !== 0 ? `¥${record.supplementEarnings.toFixed(2)}` : '-'}
                                        </span>
                                    )
                                },
                                {
                                    title: '最终收益',
                                    render: (_, record) => (
                                        <span style={{
                                            color: record.finalEarnings < 0 ? '#ff4d4f' :
                                                record.finalEarnings > 0 ? '#52c41a' : '#999',
                                            fontWeight: 'bold'
                                        }}>
                                            ¥{record.finalEarnings.toFixed(2)}
                                        </span>
                                    )
                                },
                            ]}
                            dataSource={earningsPreview.playerEarnings}
                            pagination={false}
                            size="small"
                        />

                        <Card size="small" style={{ marginTop: 16 }}>
                            <Row gutter={16}>
                                <Col span={6}>
                                    <Statistic
                                        title="俱乐部收益"
                                        value={earningsPreview.clubEarnings}
                                        precision={2}
                                        prefix="¥"
                                    />
                                </Col>
                                <Col span={6}>
                                    <Statistic
                                        title="抽成比例"
                                        value={earningsPreview.clubRate}
                                        precision={0}
                                        suffix="%"
                                    />
                                </Col>
                                <Col span={6}>
                                    <Statistic
                                        title="陪玩总收益"
                                        value={earningsPreview.playerEarnings.reduce((sum, p) => sum + p.finalEarnings, 0)}
                                        precision={2}
                                        prefix="¥"
                                    />
                                </Col>
                                <Col span={6}>
                                    <Statistic
                                        title="订单总额"
                                        value={earningsPreview.totalOrderAmount}
                                        precision={2}
                                        prefix="¥"
                                    />
                                </Col>
                            </Row>
                        </Card>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                        无法计算收益，请检查订单信息是否完整
                    </div>
                )}
            </Modal>
        </PageContainer>
    );
};

export default CreateBill;
