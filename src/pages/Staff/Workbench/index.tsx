import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from '@umijs/max';
import {Button, Form, Input, InputNumber, message, Modal, Select, Space, Tabs, Tag} from 'antd';

import {
    acceptDispatch,
    archiveDispatch,
    completeDispatch,
    getEnumDicts,
    getMyDispatches,
    getOrderDetail
} from '@/services/api';
import {PageContainer, ProTable, type ActionType, type ProColumns} from '@ant-design/pro-components';

type DictMap = Record<string, Record<string, string>>;

const statusText: Record<string, { text: string; color?: string }> = {
    WAIT_ASSIGN: {text: '待派单', color: 'default'},
    WAIT_ACCEPT: {text: '待接单', color: 'orange'},
    ACCEPTED: {text: '已接单', color: 'blue'},
    ARCHIVED: {text: '已存单', color: 'purple'},
    COMPLETED: {text: '已结单', color: 'green'},
    CANCELLED: {text: '已取消', color: 'red'},
};

const WorkbenchPage: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const navigate = useNavigate();

    // enums dicts
    const [dicts, setDicts] = useState<DictMap>({});

    // tabs
    const [tab, setTab] = useState<'WAIT_ACCEPT' | 'ACCEPTED' | 'DONE'>('WAIT_ACCEPT');

    // accept modal
    const [acceptOpen, setAcceptOpen] = useState(false);
    const [acceptSubmitting, setAcceptSubmitting] = useState(false);
    const [acceptForm] = Form.useForm();
    const [currentRow, setCurrentRow] = useState<any>(null);

    // archive/complete modal
    const [finishOpen, setFinishOpen] = useState(false);
    const [finishMode, setFinishMode] = useState<'ARCHIVE' | 'COMPLETE'>('ARCHIVE');
    const [finishSubmitting, setFinishSubmitting] = useState(false);
    const [finishForm] = Form.useForm();
    const watchedTotalProgressWan = Form.useWatch('totalProgressWan', finishForm);
    const [guaranteedCompleteRemainingWan, setGuaranteedCompleteRemainingWan] = useState<number | null>(null);

    const t = (group: keyof DictMap, key: any, fallback?: string) => {
        const k = String(key ?? '');
        return dicts?.[group]?.[k] || fallback || k || '-';
    };

    // ---- Hourly preview tick ----
    const [tick, setTick] = useState<number>(Date.now());

    useEffect(() => {
        if (!finishOpen) return;
        // 弹窗打开后每 30s 刷新一次“当前时间/时长预估”
        const timer = window.setInterval(() => setTick(Date.now()), 30_000);
        return () => window.clearInterval(timer);
    }, [finishOpen]);

    const minutesToBillableHours = (totalMinutes: number): number => {
        if (totalMinutes < 15) return 0;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        let extra = 0;
        if (minutes < 15) extra = 0;
        else if (minutes <= 45) extra = 0.5;
        else extra = 1;

        return hours + extra;
    };

    const mapDeductMinutesValue = (option?: string): number => {
        switch (option) {
            case 'M10':
                return 10;
            case 'M20':
                return 20;
            case 'M30':
                return 30;
            case 'M40':
                return 40;
            case 'M50':
                return 50;
            case 'M60':
                return 60;
            default:
                return 0;
        }
    };

    const loadDictsOnce = async () => {
        if (Object.keys(dicts || {}).length > 0) return;
        try {
            const res = await getEnumDicts();
            setDicts(res || {});
        } catch (e) {
            console.error(e);
        }
    };

    const billingModeOf = (row: any) => {
        const order = row?.order || {};
        const snap = order?.projectSnapshot || {};
        return snap.billingMode || order?.project?.billingMode;
    };

    const isGuaranteed = (row: any) => billingModeOf(row) === 'GUARANTEED';
    const isHourly = (row: any) => billingModeOf(row) === 'HOURLY';

    const participantsActive = (row: any) => {
        const ps = row?.participants || row?.order?.currentDispatch?.participants || [];
        return (Array.isArray(ps) ? ps : []).filter((p: any) => p?.isActive !== false);
    };

    const openAccept = async (row: any) => {
        await loadDictsOnce();
        setCurrentRow(row);
        acceptForm.setFieldsValue({remark: ''});
        setAcceptOpen(true);
    };

    const submitAccept = async () => {
        try {
            const values = await acceptForm.validateFields();
            if (!currentRow?.id) return;

            setAcceptSubmitting(true);
            await acceptDispatch(Number(currentRow.id), {remark: values.remark || undefined});

            message.success('已接单');
            setAcceptOpen(false);
            actionRef.current?.reload();
        } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || '接单失败');
        } finally {
            setAcceptSubmitting(false);
        }
    };

    const openFinish = async (row: any, mode: 'ARCHIVE' | 'COMPLETE') => {
        await loadDictsOnce();
        setCurrentRow(row);
        setFinishMode(mode);

        const ps = participantsActive(row);
        const count = ps.length || 1;

        // 保底单：只填“本轮总进度（万）”，后续均分写入 progresses
        // 小时单：只选扣时 + 备注（时长由后端按 acceptedAllAt->now 计算，这里仅做预览）
        finishForm.setFieldsValue({
            remark: '',
            deductMinutesOption: undefined,
            totalProgressWan: 0, // ✅ 新增字段
            progresses: ps.map((p: any) => ({
                userId: Number(p.userId),
                progressBaseWan: 0,
            })),
        });


        // ✅ 保底单结单：回显剩余保底（不允许输入）
        if (isGuaranteed(row) && mode === 'COMPLETE') {
            try {
                const orderId = Number(row?.order?.id);
                if (orderId) {
                    const detail = await getOrderDetail(orderId);

                    const base = Number(detail?.baseAmountWan ?? 0);
                    const dispatches = Array.isArray(detail?.dispatches) ? detail.dispatches : [];

                    // 只统计 ARCHIVED 的累计进度（和你结算口径一致）
                    let archivedProgress = 0;
                    for (const d of dispatches) {
                        if (String(d?.status) !== 'ARCHIVED') continue;
                        const parts = Array.isArray(d?.participants) ? d.participants : [];
                        for (const p of parts) archivedProgress += Number(p?.progressBaseWan ?? 0);
                    }

                    const remaining = Number.isFinite(base) ? Math.max(0, base - archivedProgress) : 0;

                    setGuaranteedCompleteRemainingWan(remaining);
                    // 这里写入 form，只用于“展示本次默认打了多少”，不让用户编辑
                    finishForm.setFieldsValue({totalProgressWan: remaining});
                }
            } catch (e) {
                // 拉详情失败不阻塞结单：后端仍会兜底按剩余补齐
                console.error(e);
            }
        }

        // // 打开弹窗并刷新一次 tick，保证“当前时间”立即更新
        setTick(Date.now());
        setFinishOpen(true);
    };

    const submitFinish = async () => {
        try {
            const values = await finishForm.validateFields();
            if (!currentRow?.id) return;

            setFinishSubmitting(true);

            const ps = participantsActive(currentRow);
            const count = ps.length || 1;

            // ✅ 保底单：只填总数，提交时均分到 progresses
            let progresses = values.progresses;
            if (isGuaranteed(currentRow) && finishMode === 'ARCHIVE') {
                const total = Number(values.totalProgressWan);
                if (!Number.isFinite(total)) {
                    message.error('存单请填写保底进度');
                    return;
                }
                const each = total / count;
                progresses = ps.map((p: any) => ({
                    userId: Number(p.userId),
                    progressBaseWan: each,
                }));
            }
            // ✅ 保底单：结单 COMPLETE 时不传 progresses（后端会按剩余保底兜底补齐）
            if (isGuaranteed(currentRow) && finishMode === 'COMPLETE') {
                progresses = undefined;
            }

            const payload: any = {
                remark: values.remark || undefined,
                deductMinutesOption: values.deductMinutesOption || undefined,
                progresses: progresses || undefined,
            };

            if (finishMode === 'ARCHIVE') {
                await archiveDispatch(Number(currentRow.id), payload);
                message.success('已存单');
            } else {
                await completeDispatch(Number(currentRow.id), payload);
                message.success('已结单');
            }

            setFinishOpen(false);
            actionRef.current?.reload();
        } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || (finishMode === 'ARCHIVE' ? '存单失败' : '结单失败'));
        } finally {
            setFinishSubmitting(false);
        }
    };

    const columns = useMemo<ProColumns<any>[]>(() => {
        return [
            {
                title: '订单号',
                dataIndex: ['order', 'autoSerial'],
                width: 160,
                copyable: true,
                ellipsis: true,
            },
            {
                title: '项目',
                dataIndex: ['order', 'project', 'name'],
                ellipsis: true,
                render: (_, row) => row?.order?.project?.name || row?.order?.projectSnapshot?.name || '-',
            },
            {
                title: '计费',
                dataIndex: ['order', 'projectSnapshot', 'billingMode'],
                width: 110,
                search: false,
                render: (_, row) => {
                    const m = billingModeOf(row);
                    return <Tag>{t('BillingMode', m, m)}</Tag>;
                },
            },
            {
                title: '派单状态',
                dataIndex: 'status',
                width: 110,
                render: (_, row) => {
                    const s = statusText[row.status] || {text: row.status};
                    return <Tag color={s.color as any}>{t('DispatchStatus', row.status, s.text)}</Tag>;
                },
                valueType: 'select',
                valueEnum: Object.fromEntries(
                    Object.keys(statusText).map((k) => [k, {text: statusText[k].text}]),
                ),
            },
            {
                title: '订单状态',
                dataIndex: ['order', 'status'],
                width: 110,
                search: false,
                render: (_, row) => {
                    const v = row?.order?.status;
                    const s = statusText[v] || {text: v};
                    return <Tag color={s.color as any}>{t('OrderStatus', v, s.text)}</Tag>;
                },
            },
            {
                title: '实付',
                dataIndex: ['order', 'paidAmount'],
                width: 90,
                search: false,
                render: (_, row) => {
                    const v = row?.order?.paidAmount;
                    return v == null ? '-' : `¥${v}`;
                },
            },
            {
                title: '客户游戏ID',
                dataIndex: ['order', 'customerGameId'],
                ellipsis: true,
            },
            {
                title: '本轮参与者',
                dataIndex: 'participants',
                search: false,
                render: (_, row) => {
                    const ps = participantsActive(row);
                    if (ps.length === 0) return '-';
                    return (
                        <Space wrap>
                            {ps.map((p: any) => {
                                const u = p?.user;
                                const name = u?.name || u?.phone || '未命名';
                                return <Tag key={p.id}>{name}</Tag>;
                            })}
                        </Space>
                    );
                },
            },
            {
                title: '更新时间',
                dataIndex: 'updatedAt',
                valueType: 'dateTime',
                width: 170,
                search: false,
            },
            {
                title: '操作',
                valueType: 'option',
                width: 260,
                render: (_, row) => {
                    const ops: React.ReactNode[] = [];

                    ops.push(
                        <Button key="detail" type="link"
                                onClick={() => navigate(`/orders/${row?.orderId || row?.order?.id}`)}>
                            详情
                        </Button>,
                    );

                    if (row?.status === 'WAIT_ACCEPT') {
                        ops.push(
                            <Button key="accept" type="link" onClick={() => openAccept(row)}>
                                接单
                            </Button>,
                        );
                    }

                    if (row?.status === 'ACCEPTED') {
                        ops.push(
                            <Button key="archive" type="link" onClick={() => openFinish(row, 'ARCHIVE')}>
                                存单
                            </Button>,
                        );
                        ops.push(
                            <Button key="complete" type="link" onClick={() => openFinish(row, 'COMPLETE')}>
                                结单
                            </Button>,
                        );
                    }

                    return ops;
                },
            },
        ];
    }, [dicts, navigate]);

    const requestList = async (params: any) => {
        const page = Number(params.current || 1);
        const limit = Number(params.pageSize || 20);

        // 后端支持 status 单值过滤；DONE 我们用“不传 status + 前端筛 DONE”
        const status =
            tab === 'WAIT_ACCEPT' ? 'WAIT_ACCEPT' : tab === 'ACCEPTED' ? 'ACCEPTED' : undefined;

        const res: any = await getMyDispatches({page, limit, status});

        let data = res?.data || [];
        if (tab === 'DONE') {
            data = data.filter((d: any) => d?.status === 'ARCHIVED' || d?.status === 'COMPLETED');
        }

        return {data, success: true, total: res?.total || 0};
    };

    const deductOptions = useMemo(() => {
        // DeductMinutesOption 的 key 集合从 dicts 里拿（若没有就兜底空）
        const m = dicts?.DeductMinutesOption || {};
        return Object.keys(m).map((k) => ({value: k, label: m[k]}));
    }, [dicts]);

    return (
        <PageContainer>
            <Tabs
                activeKey={tab}
                onChange={(k) => {
                    setTab(k as any);
                    // 切 tab 立即刷新
                    setTimeout(() => actionRef.current?.reload(), 0);
                }}
                items={[
                    {key: 'WAIT_ACCEPT', label: '待接单'},
                    {key: 'ACCEPTED', label: '进行中'},
                    {key: 'DONE', label: '已存/已结'},
                ]}
                style={{marginBottom: 12}}
            />

            <ProTable
                rowKey="id"
                actionRef={actionRef}
                columns={columns}
                search={{labelWidth: 90}}
                toolbar={{
                    actions: [
                        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
                            刷新
                        </Button>,
                    ],
                }}
                request={requestList}
                pagination={{pageSize: 20}}
            />

            {/* 接单 */}
            <Modal
                title="接单"
                open={acceptOpen}
                onCancel={() => setAcceptOpen(false)}
                onOk={submitAccept}
                confirmLoading={acceptSubmitting}
                destroyOnClose
            >
                <Form form={acceptForm} layout="vertical">
                    <Form.Item name="remark" label="备注（可选）">
                        <Input placeholder="例如：已联系客户/准备开打" allowClear/>
                    </Form.Item>
                    <Tag color="blue">该操作会写入操作日志（ACCEPT_DISPATCH）。</Tag>
                </Form>
            </Modal>

            {/* 存单 / 结单 */}
            <Modal
                title={finishMode === 'ARCHIVE' ? '存单' : '结单'}
                open={finishOpen}
                onCancel={() => setFinishOpen(false)}
                onOk={submitFinish}
                confirmLoading={finishSubmitting}
                destroyOnClose
            >
                <Form form={finishForm} layout="vertical">
                    {/* 小时单：显示当前时间 / 时长预估 + 扣时选项（选项从 /meta/enums 同步） */}
                    {currentRow && isHourly(currentRow) ? (
                        <>
                            <div style={{marginBottom: 8}}>
                                <Tag
                                    color="blue">当前{finishMode === 'ARCHIVE' ? '存单' : '结单'}时间：{new Date(tick).toLocaleString()}</Tag>
                            </div>

                            <div style={{marginBottom: 8}}>
                                {(() => {
                                    const start = currentRow?.acceptedAllAt ? new Date(currentRow.acceptedAllAt) : null;
                                    if (!start) return <Tag color="orange">缺少 acceptedAllAt，无法预估时长（后端会校验）</Tag>;

                                    const rawMinutes = Math.max(0, Math.floor((tick - start.getTime()) / 60000));
                                    const deduct = mapDeductMinutesValue(finishForm.getFieldValue('deductMinutesOption'));
                                    const effective = Math.max(0, rawMinutes - deduct);
                                    const hours = minutesToBillableHours(effective);

                                    return (
                                        <Space wrap>
                                            <Tag>开始：{start.toLocaleString()}</Tag>
                                            <Tag>原始分钟：{rawMinutes}</Tag>
                                            <Tag>扣除：{deduct} 分钟</Tag>
                                            <Tag color="green">计费分钟：{effective}</Tag>
                                            <Tag color="green">计费时长：{hours} 小时</Tag>
                                        </Space>
                                    );
                                })()}
                            </div>

                            <Form.Item name="deductMinutesOption" label="扣除分钟（可选）">
                                <Select
                                    allowClear
                                    placeholder="不允许手输负数，选择即扣时"
                                    options={deductOptions}
                                    showSearch
                                    optionFilterProp="label"
                                    onChange={() => {
                                        // 立即刷新预估显示
                                        setTick(Date.now());
                                    }}
                                />
                            </Form.Item>
                        </>
                    ) : null}

                    {/* 保底单：必须填写总进度，并实时显示“剩余保底” */}
                    {currentRow && isGuaranteed(currentRow) ? (
                        <>
                            {finishMode === 'ARCHIVE' ? (
                                <>
                                    <Form.Item
                                        name="totalProgressWan"
                                        label="本轮已打保底（万）- 总数"
                                        rules={[
                                            {required: true, message: '请输入本轮已打保底（万）'},
                                            () => ({
                                                validator: async (_, v) => {
                                                    const nv = Number(v);
                                                    if (!Number.isFinite(nv)) throw new Error('进度非法');
                                                    // ✅ 允许负数（炸单）
                                                },
                                            }),
                                        ]}
                                    >
                                        <InputNumber precision={0} style={{width: '100%'}}/>
                                    </Form.Item>
                                    {(() => {
                                        const base = Number(currentRow?.order?.baseAmountWan ?? currentRow?.order?.projectSnapshot?.baseAmount ?? 0);
                                        // const total = Number(finishForm.getFieldValue('totalProgressWan') ?? 0);
                                        const total = Number(watchedTotalProgressWan ?? 0);
                                        if (!Number.isFinite(base) || base <= 0) return <Tag
                                            color="orange">订单未设置保底基数，无法计算剩余</Tag>;

                                        const remaining = base - total;
                                        const ps = participantsActive(currentRow);
                                        const each = ps.length > 0 ? total / ps.length : total;

                                        return (
                                            <Space wrap style={{marginBottom: 8}}>
                                                <Tag>订单保底：{base} 万</Tag>
                                                <Tag color={remaining >= 0 ? 'green' : 'red'}>剩余保底：{remaining} 万</Tag>
                                                <Tag>本轮均分：{each} 万 / 人</Tag>
                                            </Space>
                                        );
                                    })()}
                                    <Tag color="gold">多人时无需逐个录入：只填总数，系统均分提交。</Tag>
                                </>
                            ) : (
                                <Space direction="vertical" style={{width: '100%'}}>
                                    <Tag color="gold">结单默认结算剩余全部保底，无需填写进度。</Tag>
                                    <Tag color="green">
                                        本次默认打保底（万）：{guaranteedCompleteRemainingWan ?? finishForm.getFieldValue('totalProgressWan') ?? '-'}
                                    </Tag>
                                </Space>
                            )}
                        </>
                    ) : null}

                    <Form.Item name="remark" label="备注（建议填写）">
                        <Input
                            placeholder={finishMode === 'ARCHIVE' ? '例如：客户临时有事，先存单' : '例如：已完成对局，正常结单'}
                            allowClear
                        />
                    </Form.Item>

                    <Tag color="blue">
                        {finishMode === 'ARCHIVE'
                            ? '该操作会写入操作日志（ARCHIVE_DISPATCH）。'
                            : '该操作会写入操作日志（COMPLETE_DISPATCH）并生成结算。'}
                    </Tag>
                </Form>
            </Modal>
        </PageContainer>
    );
};

export default WorkbenchPage;
