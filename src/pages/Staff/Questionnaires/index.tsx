import React, { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import {
    Button,
    Card,
    Drawer,
    Empty,
    Form,
    Input,
    List,
    Radio,
    Checkbox,
    Space,
    Tag,
    Typography,
    message,
} from 'antd';
import dayjs from 'dayjs';
import {
    getMyQuestionnaireDetail,
    listMyAvailableQuestionnaires,
    QuestionnaireDetailItem,
    QuestionnaireListItem,
    QuestionnaireQuestionItem,
    submitMyQuestionnaire,
} from '@/services/api';

const { Text } = Typography;

const scopeMap: Record<string, string> = {
    INTERNAL_STAFF: '内部员工',
    MEMBER_LOGIN: '会员登录',
    UNRESTRICTED: '不限制',
};

const questionTypeText: Record<string, string> = {
    SINGLE_CHOICE: '单选',
    MULTIPLE_CHOICE: '多选',
    TEXT: '问答',
};

const getSelectedOptionStyle = (selected: boolean) => ({
    padding: '10px 12px',
    borderRadius: 8,
    border: selected ? '1px solid #91caff' : '1px solid #f0f0f0',
    background: selected ? '#e6f4ff' : '#fff',
    transition: 'all 0.2s ease',
});

const buildFormValuesFromSubmission = (detail: QuestionnaireDetailItem | null | undefined) => {
    const values: Record<string, any> = {};
    const questions = Array.isArray(detail?.questions) ? detail!.questions : [];
    const answers = Array.isArray(detail?.mySubmission?.answers) ? detail!.mySubmission!.answers! : [];
    const answerMap = new Map<number, any[]>();

    for (const answer of answers) {
        const questionId = Number(answer?.questionId || 0);
        if (!questionId) continue;
        const list = answerMap.get(questionId) || [];
        list.push(answer);
        answerMap.set(questionId, list);
    }

    for (const question of questions) {
        const key = `q_${question.id}`;
        const matched = answerMap.get(Number(question.id)) || [];
        if (question.type === 'TEXT') {
            values[key] = matched[0]?.textValue || '';
            continue;
        }
        if (question.type === 'SINGLE_CHOICE') {
            const first = matched[0];
            if (first?.optionId) {
                values[key] = Number(first.optionId);
                if (first?.textValue) {
                    values[`${key}_other_${first.optionId}`] = first.textValue;
                }
            }
            continue;
        }
        const optionIds = matched
            .map((item) => Number(item?.optionId || 0))
            .filter((id) => Number.isFinite(id) && id > 0);
        values[key] = optionIds;
        for (const item of matched) {
            if (item?.optionId && item?.textValue) {
                values[`${key}_other_${item.optionId}`] = item.textValue;
            }
        }
    }

    return values;
};

const QuestionnairesPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<Array<QuestionnaireListItem & { submitted?: boolean }>>([]);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [detail, setDetail] = useState<(QuestionnaireDetailItem & { submitted?: boolean }) | null>(null);
    const [form] = Form.useForm();

    const loadList = async () => {
        try {
            setLoading(true);
            const res = await listMyAvailableQuestionnaires();
            setRows(Array.isArray(res) ? res : []);
        } catch (error: any) {
            message.error(error?.response?.data?.message || '加载问卷失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadList();
    }, []);

    const openDetail = async (id: number) => {
        try {
            setDetailOpen(true);
            setDetailLoading(true);
            const res = await getMyQuestionnaireDetail(id);
            setDetail(res);
            form.resetFields();
            form.setFieldsValue(buildFormValuesFromSubmission(res));
        } catch (error: any) {
            message.error(error?.response?.data?.message || '加载问卷失败');
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    };

    const questionBlocks = useMemo(() => {
        const questions = Array.isArray(detail?.questions) ? detail!.questions : [];
        return questions.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    }, [detail]);

    const handleSubmit = async () => {
        if (!detail?.id) return;
        try {
            const values = await form.validateFields();
            const answers = questionBlocks.map((question: QuestionnaireQuestionItem) => {
                if (question.type === 'TEXT') {
                    return {
                        questionId: Number(question.id),
                        textValue: String(values?.[`q_${question.id}`] || '').trim(),
                    };
                }

                if (question.type === 'SINGLE_CHOICE') {
                    const optionId = Number(values?.[`q_${question.id}`] || 0);
                    const otherText = String(values?.[`q_${question.id}_other_${optionId}`] || '').trim();
                    const payload: any = { questionId: Number(question.id), optionId };
                    if (otherText) {
                        payload.optionTexts = { [String(optionId)]: otherText };
                    }
                    return payload;
                }

                const selectedIds = (Array.isArray(values?.[`q_${question.id}`]) ? values[`q_${question.id}`] : [])
                    .map((v: any) => Number(v))
                    .filter((v: number) => Number.isFinite(v) && v > 0);
                const optionTexts: Record<string, string> = {};
                for (const optionId of selectedIds) {
                    const text = String(values?.[`q_${question.id}_other_${optionId}`] || '').trim();
                    if (text) {
                        optionTexts[String(optionId)] = text;
                    }
                }
                return {
                    questionId: Number(question.id),
                    optionIds: selectedIds,
                    optionTexts,
                };
            });

            setSubmitting(true);
            await submitMyQuestionnaire(Number(detail.id), { answers });
            message.success('提交成功');
            setDetailOpen(false);
            setDetail(null);
            form.resetFields();
            await loadList();
        } catch (error: any) {
            if (!error?.errorFields) {
                message.error(error?.response?.data?.message || '提交失败');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const renderQuestion = (question: QuestionnaireQuestionItem) => {
        const key = `q_${question.id}`;
        const selected = form.getFieldValue(key);
        const options = Array.isArray(question.options) ? question.options : [];

        const showOther = (optionId?: number) => {
            if (!optionId) return false;
            if (question.type === 'SINGLE_CHOICE') return Number(selected || 0) === Number(optionId);
            return Array.isArray(selected) && selected.includes(Number(optionId));
        };

        if (question.type === 'TEXT') {
            return (
                <Form.Item
                    name={key}
                    rules={question.required ? [{ required: true, message: `请填写“${question.title}”` }] : []}
                >
                    <Input.TextArea rows={4} maxLength={1000} />
                </Form.Item>
            );
        }

        if (question.type === 'SINGLE_CHOICE') {
            return (
                <>
                    <Form.Item
                        name={key}
                        rules={question.required ? [{ required: true, message: `请选择“${question.title}”` }] : []}
                    >
                        <Radio.Group style={{ width: '100%' }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                {options.map((option) => (
                                    <div
                                        key={option.id}
                                        style={getSelectedOptionStyle(Number(selected || 0) === Number(option.id))}
                                    >
                                        <Radio value={option.id}>{option.label}</Radio>
                                        {option.isOther && showOther(option.id) ? (
                                            <Form.Item
                                                name={`${key}_other_${option.id}`}
                                                rules={[{ required: true, message: '请填写其他内容' }]}
                                                style={{ margin: '8px 0 0 24px' }}
                                            >
                                                <Input maxLength={200} placeholder="请填写其他内容" />
                                            </Form.Item>
                                        ) : null}
                                    </div>
                                ))}
                            </Space>
                        </Radio.Group>
                    </Form.Item>
                </>
            );
        }

        return (
            <Form.Item
                shouldUpdate={(prev, curr) => prev?.[key] !== curr?.[key]}
                noStyle
            >
                {() => (
                    <>
                        <Form.Item
                            name={key}
                            rules={question.required ? [{ required: true, message: `请选择“${question.title}”` }] : []}
                        >
                            <Checkbox.Group style={{ width: '100%' }}>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    {options.map((option) => (
                                        <div
                                            key={option.id}
                                            style={getSelectedOptionStyle(Array.isArray(selected) && selected.includes(Number(option.id)))}
                                        >
                                            <Checkbox value={option.id}>{option.label}</Checkbox>
                                            {option.isOther && showOther(option.id) ? (
                                                <Form.Item
                                                    name={`${key}_other_${option.id}`}
                                                    rules={[{ required: true, message: '请填写其他内容' }]}
                                                    style={{ margin: '8px 0 0 24px' }}
                                                >
                                                    <Input maxLength={200} placeholder="请填写其他内容" />
                                                </Form.Item>
                                            ) : null}
                                        </div>
                                    ))}
                                </Space>
                            </Checkbox.Group>
                        </Form.Item>
                    </>
                )}
            </Form.Item>
        );
    };

    return (
        <PageContainer title={false}>
            <Card title="信息采集" loading={loading}>
                {!rows.length ? (
                    <Empty description="暂无可参与问卷" />
                ) : (
                    <List
                        dataSource={rows}
                        renderItem={(item) => (
                            <List.Item
                                actions={[
                                    <Button type="link" key="join" onClick={() => openDetail(Number(item.id))}>
                                        {item.submitted ? '查看' : '参与'}
                                    </Button>,
                                ]}
                            >
                                <div style={{ width: '100%' }}>
                                    <Space wrap>
                                        <Tag>{scopeMap[item.scope] || item.scope}</Tag>
                                        {item.submitted ? <Tag color="green">已参与</Tag> : <Tag color="blue">未参与</Tag>}
                                    </Space>
                                    <div style={{ marginTop: 8, fontWeight: 600 }}>{item.title}</div>
                                    {item.description ? (
                                        <div style={{ marginTop: 6, color: '#666', whiteSpace: 'pre-wrap' }}>{item.description}</div>
                                    ) : null}
                                    <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                                        开放时间：{item.startAt ? dayjs(item.startAt).format('YYYY-MM-DD HH:mm') : '立即'} 至 {item.endAt ? dayjs(item.endAt).format('YYYY-MM-DD HH:mm') : '长期'}
                                    </div>
                                </div>
                            </List.Item>
                        )}
                    />
                )}
            </Card>

            <Drawer
                title={detail?.title || '问卷详情'}
                open={detailOpen}
                width={760}
                destroyOnClose
                onClose={() => {
                    setDetailOpen(false);
                    setDetail(null);
                    form.resetFields();
                }}
                loading={detailLoading}
                extra={
                    detail?.submitted ? (
                        <Tag color="green">已参与</Tag>
                    ) : null
                }
            >
                {detail ? (
                    <Form form={form} layout="vertical">
                        {detail.description ? (
                            <div style={{ marginBottom: 16, whiteSpace: 'pre-wrap' }}>{detail.description}</div>
                        ) : null}
                        <Space wrap style={{ marginBottom: 16 }}>
                            <Tag>{scopeMap[detail.scope] || detail.scope}</Tag>
                            <Tag>{detail.questions?.length || 0} 题</Tag>
                        </Space>

                        {questionBlocks.map((question, index) => (
                            <Card key={question.id} size="small" style={{ marginBottom: 16 }}>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <div>
                                        <Text strong>{index + 1}. {question.title}</Text>
                                        <Space size={8} style={{ marginLeft: 8 }}>
                                            <Tag>{questionTypeText[question.type] || question.type}</Tag>
                                            {question.required ? <Tag color="red">必答</Tag> : <Tag>选答</Tag>}
                                        </Space>
                                    </div>
                                    {question.description ? <Text type="secondary">{question.description}</Text> : null}
                                    {renderQuestion(question)}
                                </Space>
                            </Card>
                        ))}

                        <Space>
                            <Button onClick={() => {
                                setDetailOpen(false);
                                setDetail(null);
                                form.resetFields();
                            }}>
                                关闭
                            </Button>
                            <Button type="primary" loading={submitting} onClick={handleSubmit}>
                                {detail.submitted ? '重新提交' : '提交问卷'}
                            </Button>
                        </Space>
                    </Form>
                ) : null}
            </Drawer>
        </PageContainer>
    );
};

export default QuestionnairesPage;
