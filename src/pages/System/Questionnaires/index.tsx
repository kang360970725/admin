import React, { useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
    adminCreateQuestionnaire,
    adminGetQuestionnaireDetail,
    adminListQuestionnaires,
    adminUpdateQuestionnaire,
    QuestionnaireDetailItem,
    QuestionnaireListItem,
    QuestionnaireQuestionType,
} from '@/services/api';
import {
    Button,
    Card,
    Col,
    DatePicker,
    Divider,
    Drawer,
    Empty,
    Form,
    Input,
    Modal,
    Progress,
    Row,
    Select,
    Space,
    Switch,
    Table,
    Tag,
    Tabs,
    Typography,
    message,
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const scopeMap: Record<string, { text: string; color: string }> = {
    INTERNAL_STAFF: { text: '内部员工', color: 'blue' },
    MEMBER_LOGIN: { text: '会员登录', color: 'green' },
    UNRESTRICTED: { text: '不限制', color: 'purple' },
};

const statusMap: Record<string, { text: string; color: string }> = {
    DRAFT: { text: '草稿', color: 'default' },
    PUBLISHED: { text: '发布中', color: 'success' },
    CLOSED: { text: '已关闭', color: 'orange' },
};

const questionTypeMap: Record<QuestionnaireQuestionType, string> = {
    SINGLE_CHOICE: '单选投票',
    MULTIPLE_CHOICE: '多选投票',
    TEXT: '问答',
};

const getAnswerDisplay = (item: any) => {
    if (item?.optionLabel && item?.textValue) {
        return `${item.optionLabel}：${item.textValue}`;
    }
    return item?.optionLabel || item?.textValue || '-';
};

const getPercentColor = (percent: number) => {
    if (percent >= 60) return '#1677ff';
    if (percent >= 30) return '#52c41a';
    if (percent > 0) return '#faad14';
    return '#d9d9d9';
};

const getPercentTagColor = (percent: number) => {
    if (percent >= 60) return 'blue';
    if (percent >= 30) return 'green';
    if (percent > 0) return 'orange';
    return 'default';
};

const emptyQuestion = (sortOrder: number) => ({
    title: '',
    description: '',
    type: 'SINGLE_CHOICE',
    required: true,
    sortOrder,
    options: [{ label: '', isOther: false, sortOrder: 1 }, { label: '', isOther: false, sortOrder: 2 }],
});

const QuestionnairesPage: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const [form] = Form.useForm();
    const [visible, setVisible] = useState(false);
    const [editing, setEditing] = useState<QuestionnaireDetailItem | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detail, setDetail] = useState<QuestionnaireDetailItem | null>(null);

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({
            scope: 'UNRESTRICTED',
            status: 'DRAFT',
            allowEditSubmit: false,
            questions: [emptyQuestion(1)],
        });
        setVisible(true);
    };

    const openEdit = async (row: QuestionnaireListItem) => {
        try {
            setSubmitting(false);
            const full = await adminGetQuestionnaireDetail(Number(row.id));
            setEditing(full);
            form.resetFields();
            form.setFieldsValue({
                title: full.title,
                description: full.description,
                scope: full.scope,
                status: full.status,
                startAt: full.startAt ? dayjs(full.startAt) : null,
                endAt: full.endAt ? dayjs(full.endAt) : null,
                allowEditSubmit: Boolean(full.allowEditSubmit),
                questions: (full.questions || []).map((q, idx) => ({
                    title: q.title,
                    description: q.description,
                    type: q.type,
                    required: q.required,
                    sortOrder: q.sortOrder ?? idx + 1,
                    options: (q.options || []).map((opt, optIdx) => ({
                        label: opt.label,
                        isOther: Boolean(opt.isOther),
                        sortOrder: opt.sortOrder ?? optIdx + 1,
                    })),
                })),
            });
            setVisible(true);
        } catch (error: any) {
            message.error(error?.response?.data?.message || '加载问卷详情失败');
        }
    };

    const openDetail = async (row: QuestionnaireListItem) => {
        try {
            setDetailOpen(true);
            setDetailLoading(true);
            const full = await adminGetQuestionnaireDetail(Number(row.id));
            setDetail(full);
        } catch (error: any) {
            message.error(error?.response?.data?.message || '加载参与详情失败');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const payload = {
                title: String(values.title || '').trim(),
                description: String(values.description || '').trim() || undefined,
                scope: values.scope,
                status: values.status,
                startAt: values.startAt ? dayjs(values.startAt).toISOString() : undefined,
                endAt: values.endAt ? dayjs(values.endAt).toISOString() : undefined,
                allowEditSubmit: Boolean(values.allowEditSubmit),
                questions: (Array.isArray(values.questions) ? values.questions : []).map((q: any, idx: number) => ({
                    title: String(q?.title || '').trim(),
                    description: String(q?.description || '').trim() || undefined,
                    type: q?.type,
                    required: Boolean(q?.required),
                    sortOrder: Number(q?.sortOrder || idx + 1),
                    options: String(q?.type) === 'TEXT'
                        ? []
                        : (Array.isArray(q?.options) ? q.options : []).map((opt: any, optIdx: number) => ({
                            label: String(opt?.label || '').trim(),
                            isOther: Boolean(opt?.isOther),
                            sortOrder: Number(opt?.sortOrder || optIdx + 1),
                        })),
                })),
            };

            setSubmitting(true);
            if (editing?.id) {
                await adminUpdateQuestionnaire({ id: Number(editing.id), ...payload });
                message.success('问卷已更新');
            } else {
                await adminCreateQuestionnaire(payload as any);
                message.success('问卷已创建');
            }
            setVisible(false);
            setEditing(null);
            form.resetFields();
            actionRef.current?.reload();
        } catch (error: any) {
            if (!error?.errorFields) {
                message.error(error?.response?.data?.message || '保存失败');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const columns: ProColumns<QuestionnaireListItem>[] = [
        { title: 'ID', dataIndex: 'id', width: 80, search: false },
        { title: '标题', dataIndex: 'title', ellipsis: true },
        {
            title: '适用范围',
            dataIndex: 'scope',
            width: 120,
            valueEnum: {
                INTERNAL_STAFF: { text: '内部员工' },
                MEMBER_LOGIN: { text: '会员登录' },
                UNRESTRICTED: { text: '不限制' },
            },
            render: (_, row) => <Tag color={scopeMap[row.scope]?.color}>{scopeMap[row.scope]?.text || row.scope}</Tag>,
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            valueEnum: {
                DRAFT: { text: '草稿' },
                PUBLISHED: { text: '发布中' },
                CLOSED: { text: '已关闭' },
            },
            render: (_, row) => <Tag color={statusMap[row.status]?.color}>{statusMap[row.status]?.text || row.status}</Tag>,
        },
        {
            title: '题目数',
            dataIndex: 'questionCount',
            width: 90,
            search: false,
        },
        {
            title: '参与数',
            dataIndex: 'submissionCount',
            width: 90,
            search: false,
        },
        {
            title: '开放区间',
            dataIndex: 'startAt',
            width: 280,
            search: false,
            render: (_, row) => (
                <span>
                    {row.startAt ? dayjs(row.startAt).format('YYYY-MM-DD HH:mm') : '立即'} 至 {row.endAt ? dayjs(row.endAt).format('YYYY-MM-DD HH:mm') : '长期'}
                </span>
            ),
        },
        {
            title: '操作',
            width: 120,
            valueType: 'option',
            render: (_, row) => [
                <a key="detail" onClick={() => openDetail(row)}>详情</a>,
                <a key="edit" onClick={() => openEdit(row)}>编辑</a>,
            ],
        },
    ];

    return (
        <>
            <ProTable<QuestionnaireListItem>
                rowKey="id"
                actionRef={actionRef}
                headerTitle="匿名问卷信息采集"
                columns={columns}
                search={{ labelWidth: 86 }}
                toolBarRender={() => [
                    <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                        新建问卷
                    </Button>,
                ]}
                request={async (params) => {
                    const res = await adminListQuestionnaires({
                        page: params.current,
                        limit: params.pageSize,
                        keyword: params.keyword,
                        scope: (params.scope as any) || '',
                        status: (params.status as any) || '',
                    });
                    return {
                        data: res?.list || [],
                        total: Number(res?.total || 0),
                        success: true,
                    };
                }}
            />

            <Modal
                title={editing ? '编辑问卷' : '新建问卷'}
                open={visible}
                width={980}
                destroyOnClose
                confirmLoading={submitting}
                onCancel={() => {
                    setVisible(false);
                    setEditing(null);
                    form.resetFields();
                }}
                onOk={handleSubmit}
            >
                <Form form={form} layout="vertical">
                    <Form.Item label="问卷标题" name="title" rules={[{ required: true, message: '请输入问卷标题' }]}>
                        <Input maxLength={120} />
                    </Form.Item>
                    <Form.Item label="说明" name="description">
                        <Input.TextArea rows={3} maxLength={1000} />
                    </Form.Item>
                    <Space size={16} align="start" style={{ width: '100%', display: 'flex' }}>
                        <Form.Item label="适用范围" name="scope" rules={[{ required: true, message: '请选择适用范围' }]} style={{ minWidth: 180 }}>
                            <Select
                                options={[
                                    { value: 'INTERNAL_STAFF', label: '内部员工' },
                                    { value: 'MEMBER_LOGIN', label: '会员(需登录)' },
                                    { value: 'UNRESTRICTED', label: '不限制' },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]} style={{ minWidth: 160 }}>
                            <Select
                                options={[
                                    { value: 'DRAFT', label: '草稿' },
                                    { value: 'PUBLISHED', label: '发布中' },
                                    { value: 'CLOSED', label: '已关闭' },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item label="开始时间" name="startAt">
                            <DatePicker showTime style={{ width: 200 }} />
                        </Form.Item>
                        <Form.Item label="结束时间" name="endAt">
                            <DatePicker showTime style={{ width: 200 }} />
                        </Form.Item>
                        <Form.Item label="允许重复修改" name="allowEditSubmit" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                    </Space>

                    <Divider orientation="left">题目配置</Divider>
                    <Form.List name="questions">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map((field, index) => (
                                    <div key={field.key} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                                        <Space align="baseline" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Text strong>题目 {index + 1}</Text>
                                            {fields.length > 1 ? (
                                                <Button type="link" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)}>
                                                    删除题目
                                                </Button>
                                            ) : null}
                                        </Space>
                                        <Form.Item name={[field.name, 'title']} label="题目标题" rules={[{ required: true, message: '请输入题目标题' }]}>
                                            <Input maxLength={200} />
                                        </Form.Item>
                                        <Form.Item name={[field.name, 'description']} label="补充说明">
                                            <Input.TextArea rows={2} maxLength={500} />
                                        </Form.Item>
                                        <Space size={16} align="start" style={{ width: '100%', display: 'flex' }}>
                                            <Form.Item
                                                name={[field.name, 'type']}
                                                label="题目类型"
                                                rules={[{ required: true, message: '请选择题目类型' }]}
                                                style={{ minWidth: 180 }}
                                            >
                                                <Select
                                                    options={[
                                                        { value: 'SINGLE_CHOICE', label: '单选投票' },
                                                        { value: 'MULTIPLE_CHOICE', label: '多选投票' },
                                                        { value: 'TEXT', label: '问答' },
                                                    ]}
                                                />
                                            </Form.Item>
                                            <Form.Item name={[field.name, 'required']} label="必答" valuePropName="checked">
                                                <Switch />
                                            </Form.Item>
                                            <Form.Item name={[field.name, 'sortOrder']} label="排序">
                                                <Input type="number" />
                                            </Form.Item>
                                        </Space>

                                        <Form.Item noStyle shouldUpdate={(prev, curr) =>
                                            prev?.questions?.[field.name]?.type !== curr?.questions?.[field.name]?.type
                                        }>
                                            {({ getFieldValue }) => {
                                                const currentType = getFieldValue(['questions', field.name, 'type']);
                                                if (String(currentType) === 'TEXT') {
                                                    return <Text type="secondary">问答题无需配置选项。</Text>;
                                                }
                                                return (
                                                    <>
                                                        <Divider orientation="left" plain>选项</Divider>
                                                        <Form.List name={[field.name, 'options']}>
                                                            {(optionFields, optionOps) => (
                                                                <>
                                                                    {optionFields.map((optField, optIndex) => (
                                                                        <Space key={optField.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                                                                            <Form.Item
                                                                                name={[optField.name, 'label']}
                                                                                rules={[{ required: true, message: '请输入选项内容' }]}
                                                                                style={{ flex: 1, marginBottom: 0 }}
                                                                            >
                                                                                <Input placeholder={`选项 ${optIndex + 1}`} maxLength={120} />
                                                                            </Form.Item>
                                                                            <Form.Item name={[optField.name, 'isOther']} valuePropName="checked" style={{ marginBottom: 0 }}>
                                                                                <Switch checkedChildren="其他" unCheckedChildren="普通" />
                                                                            </Form.Item>
                                                                            <Form.Item name={[optField.name, 'sortOrder']} style={{ width: 90, marginBottom: 0 }}>
                                                                                <Input type="number" placeholder="排序" />
                                                                            </Form.Item>
                                                                            {optionFields.length > 2 ? (
                                                                                <Button type="link" danger onClick={() => optionOps.remove(optField.name)}>
                                                                                    删除
                                                                                </Button>
                                                                            ) : null}
                                                                        </Space>
                                                                    ))}
                                                                    <Button
                                                                        type="dashed"
                                                                        onClick={() => optionOps.add({ label: '', isOther: false, sortOrder: optionFields.length + 1 })}
                                                                        icon={<PlusOutlined />}
                                                                    >
                                                                        添加选项
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </Form.List>
                                                    </>
                                                );
                                            }}
                                        </Form.Item>
                                    </div>
                                ))}
                                <Button type="dashed" onClick={() => add(emptyQuestion(fields.length + 1))} icon={<PlusOutlined />} block>
                                    添加题目
                                </Button>
                            </>
                        )}
                    </Form.List>
                </Form>
            </Modal>

            <Drawer
                title={detail ? `问卷详情 #${detail.id}` : '问卷详情'}
                open={detailOpen}
                width={980}
                destroyOnClose
                onClose={() => {
                    setDetailOpen(false);
                    setDetail(null);
                }}
                loading={detailLoading}
            >
                {detail ? (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <div>
                            <Space wrap>
                                <Tag color={scopeMap[detail.scope]?.color}>{scopeMap[detail.scope]?.text || detail.scope}</Tag>
                                <Tag color={statusMap[detail.status]?.color}>{statusMap[detail.status]?.text || detail.status}</Tag>
                                <Tag>题目 {detail.questions?.length || 0}</Tag>
                                <Tag>参与 {detail.submissionCount || 0}</Tag>
                            </Space>
                            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 600 }}>{detail.title}</div>
                            {detail.description ? <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{detail.description}</div> : null}
                        </div>

                        <Row gutter={[12, 12]}>
                            <Col xs={12} sm={12} md={6}>
                                <Card size="small">
                                    <div style={{ color: '#666', fontSize: 12 }}>参与人数</div>
                                    <div style={{ fontSize: 24, fontWeight: 600 }}>{Number(detail.submissionCount || 0)}</div>
                                </Card>
                            </Col>
                            <Col xs={12} sm={12} md={6}>
                                <Card size="small">
                                    <div style={{ color: '#666', fontSize: 12 }}>题目数量</div>
                                    <div style={{ fontSize: 24, fontWeight: 600 }}>{Array.isArray(detail.questions) ? detail.questions.length : 0}</div>
                                </Card>
                            </Col>
                            <Col xs={12} sm={12} md={6}>
                                <Card size="small">
                                    <div style={{ color: '#666', fontSize: 12 }}>开放时间</div>
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                                        {detail.startAt ? dayjs(detail.startAt).format('MM-DD HH:mm') : '立即开始'}
                                    </div>
                                </Card>
                            </Col>
                            <Col xs={12} sm={12} md={6}>
                                <Card size="small">
                                    <div style={{ color: '#666', fontSize: 12 }}>截止时间</div>
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                                        {detail.endAt ? dayjs(detail.endAt).format('MM-DD HH:mm') : '长期有效'}
                                    </div>
                                </Card>
                            </Col>
                        </Row>

                        <Tabs
                            items={[
                                {
                                    key: 'stats',
                                    label: '投票效果',
                                    children: (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {(detail.statistics || []).length ? (
                                                (detail.statistics || []).map((row: any, index: number) => {
                                                    const optionStats = Array.isArray(row.optionStats) ? row.optionStats : [];
                                                    const totalVotes = optionStats.reduce((sum: number, item: any) => sum + Number(item.voteCount || 0), 0);
                                                    return (
                                                        <Card
                                                            key={row.questionId}
                                                            size="small"
                                                            title={
                                                                <Space wrap>
                                                                    <Text strong>{index + 1}. {row.title}</Text>
                                                                    <Tag>{questionTypeMap[row.type as QuestionnaireQuestionType] || row.type}</Tag>
                                                                    <Tag color="blue">作答 {row.type === 'TEXT' ? Number(row.textAnswerCount || 0) : totalVotes} 次</Tag>
                                                                </Space>
                                                            }
                                                        >
                                                            {row.description ? (
                                                                <div style={{ marginBottom: 12, color: '#666', whiteSpace: 'pre-wrap' }}>{row.description}</div>
                                                            ) : null}
                                                            {row.type === 'TEXT' ? (
                                                                Number(row.textAnswerCount || 0) > 0 ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                        <Text type="secondary">文本回答 {Number(row.textAnswerCount || 0)} 条</Text>
                                                                        {(Array.isArray(row.textAnswers) ? row.textAnswers : []).slice(0, 10).map((item: any) => (
                                                                            <div key={item.id} style={{ padding: '8px 12px', background: '#fafafa', borderRadius: 6 }}>
                                                                                <div style={{ color: '#666', whiteSpace: 'pre-wrap' }}>{item.textValue || '-'}</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无文本回答" />
                                                                )
                                                            ) : optionStats.length ? (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                                    {optionStats.map((item: any) => {
                                                                        const percent = totalVotes > 0 ? Number(((Number(item.voteCount || 0) / totalVotes) * 100).toFixed(1)) : 0;
                                                                        const extras = Array.isArray(item.textAnswers) ? item.textAnswers : [];
                                                                        return (
                                                                            <div key={item.id}>
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                                                                                    <div style={{ flex: 1 }}>
                                                                                        <Text>{item.label}{item.isOther ? '（其他）' : ''}</Text>
                                                                                    </div>
                                                                                    <Space size={8}>
                                                                                        <Tag color={getPercentTagColor(percent)} style={{ marginInlineEnd: 0 }}>
                                                                                            {percent}%
                                                                                        </Tag>
                                                                                        <Text type="secondary">{item.voteCount} 票</Text>
                                                                                    </Space>
                                                                                </div>
                                                                                <Progress percent={percent} showInfo={false} strokeColor={getPercentColor(percent)} />
                                                                                {item.isOther && extras.length ? (
                                                                                    <div style={{ marginTop: 8, padding: 10, background: '#fafafa', borderRadius: 6 }}>
                                                                                        <Text strong style={{ display: 'block', marginBottom: 6 }}>其他补充</Text>
                                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                                                            {extras.map((ans: any) => (
                                                                                                <div key={ans.id} style={{ color: '#666', whiteSpace: 'pre-wrap' }}>{ans.textValue || '-'}</div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                ) : null}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无投票数据" />
                                                            )}
                                                        </Card>
                                                    );
                                                })
                                            ) : (
                                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无统计数据" />
                                            )}
                                        </div>
                                    ),
                                },
                                {
                                    key: 'submissions',
                                    label: '参与明细',
                                    children: (
                                        <Table
                                            size="small"
                                            rowKey="id"
                                            pagination={{ pageSize: 10 }}
                                            dataSource={detail.submissions || []}
                                            columns={[
                                                {
                                                    title: '参与人',
                                                    dataIndex: 'submitterName',
                                                    width: 180,
                                                    render: (_: any, row: any) => (
                                                        <div>
                                                            <div>{row.submitterName || '匿名访客'}</div>
                                                            <div style={{ color: '#999', fontSize: 12 }}>{row.submitterPhone || row.clientIp || row.visitorToken || '-'}</div>
                                                        </div>
                                                    ),
                                                },
                                                {
                                                    title: '身份',
                                                    dataIndex: 'submitterUserType',
                                                    width: 120,
                                                    render: (_: any, row: any) => row.submitterUserType || 'GUEST',
                                                },
                                                {
                                                    title: '答题内容',
                                                    dataIndex: 'answers',
                                                    render: (answers: any[]) => (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                            {(Array.isArray(answers) ? answers : []).map((item: any) => (
                                                                <div key={item.id}>
                                                                    <Text strong>{item.questionTitle}</Text>
                                                                    <div style={{ color: '#666', whiteSpace: 'pre-wrap' }}>{getAnswerDisplay(item)}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ),
                                                },
                                                {
                                                    title: '参与时间',
                                                    dataIndex: 'createdAt',
                                                    width: 170,
                                                    render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
                                                },
                                            ]}
                                        />
                                    ),
                                },
                            ]}
                        />
                    </Space>
                ) : null}
            </Drawer>
        </>
    );
};

export default QuestionnairesPage;
