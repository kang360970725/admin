import React, {useEffect, useMemo, useRef, useState} from 'react';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Drawer, Space, Tag, Typography } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import {getEnumDicts, getUserLogDetail, listUserLogs} from '@/services/api';

const { Text } = Typography;

/**
 * ✅ 我做这个页面的原则：
 * 1) 用最少字段实现你要的“分类查询”
 * 2) 列表不加载 oldData/newData（避免慢），点详情再拉
 * 3) 筛选维度覆盖：操作人(userId)、订单维度(targetType=ORDER+targetId)、action、时间范围、关键字
 */
const UserLogsPage: React.FC = () => {
    const actionRef = useRef<ActionType>();
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detail, setDetail] = useState<any>(null);

    const [actionDict, setActionDict] = useState<Record<string, string>>({});
    const [actionOptions, setActionOptions] = useState<{ label: string; value: string }[]>([]);

    useEffect(() => {
        (async () => {
            const enums = await getEnumDicts();
            const dict: Record<string, string> = enums?.Action || {};
            setActionDict(dict);

            // ✅ 下拉选项：value=code，label=明文（code）
            const opts = Object.entries(dict).map(([code, label]) => ({
                value: code,
                label: `${label}（${code}）`,
            }));
            setActionOptions(opts);
        })();
    }, []);

    const columns: any = useMemo(
        () => [
            {
                title: '时间',
                dataIndex: 'createdAt',
                valueType: 'dateTime',
                width: 170,
                search: false,
                render: (_, row) => dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss'),
            },
            {
                title: '操作人ID',
                dataIndex: 'userId',
                width: 100,
            },
            {
                title: '操作人',
                dataIndex: ['user', 'name'],
                width: 120,
                search: false,
                render: (_, row) => row?.user?.name || '-',
            },
            {
                title: '动作(action)',
                dataIndex: 'action',
                width: 180,
                render: (_, row) => {
                    const code = row.action;
                    const label = actionDict?.[code];
                    return label ? `${label}（${code}）` : code; // ✅ fallback：字典缺失就显示 code
                },
            },
            {
                title: '动作',
                dataIndex: 'action',
                hideInTable: true,
                valueType: 'select',
                fieldProps: {
                    options: actionOptions,
                    showSearch: true,
                    filterOption: (input: string, option: any) =>
                        String(option?.label || '').toLowerCase().includes(String(input || '').toLowerCase()),
                },
            },
            {
                title: '目标类型',
                dataIndex: 'targetType',
                width: 120,
            },
            {
                title: '目标ID',
                dataIndex: 'targetId',
                width: 100,
            },
            {
                title: '备注',
                dataIndex: 'remark',
                ellipsis: true,
                search: false,
            },
            {
                title: 'IP',
                dataIndex: 'ip',
                width: 140,
                search: false,
            },
            {
                title: '操作',
                valueType: 'option',
                width: 120,
                render: (_, row) => [
                    <Button
                        key="detail"
                        type="link"
                        onClick={async () => {
                            setDetailOpen(true);
                            setDetailLoading(true);
                            try {
                                const res = await getUserLogDetail({ id: row.id });
                                setDetail(res);
                            } finally {
                                setDetailLoading(false);
                            }
                        }}
                    >
                        详情
                    </Button>,
                ],
            },

            // ------- 搜索项（我放在 columns 里，让 ProTable 自动生成） -------
            {
                title: '关键字',
                dataIndex: 'keyword',
                hideInTable: true,
            },
            {
                title: '目标类型',
                dataIndex: 'targetType',
                hideInTable: true,
            },
            {
                title: '目标ID(订单ID等)',
                dataIndex: 'targetId',
                hideInTable: true,
            },
            {
                title: '动作(action)',
                dataIndex: 'action',
                hideInTable: true,
            },
            {
                title: '时间范围',
                dataIndex: 'createdAtRange',
                valueType: 'dateTimeRange',
                hideInTable: true,
            },
        ],
        [],
    );

    const renderAction = (code?: string) => {
        if (!code) return '-';
        const label = actionDict?.[code];
        return label ? `${label}（${code}）` : code; // ✅ 永远兜底
    };

    return (
        <PageContainer>
            <ProTable<any>
                rowKey="id"
                actionRef={actionRef}
                columns={columns}
                search={{ labelWidth: 90 }}
                request={async (params) => {
                    // ✅ 我把 ProTable 的 params 映射成后端 list DTO
                    const createdAtRange = params.createdAtRange as [string, string] | undefined;

                    const payload: any = {
                        page: params.current || 1,
                        pageSize: params.pageSize || 20,

                        userId: params.userId ? Number(params.userId) : undefined,
                        targetType: params.targetType || undefined,
                        targetId: params.targetId !== undefined && params.targetId !== null && params.targetId !== ''
                            ? Number(params.targetId)
                            : undefined,
                        action: params.action || undefined,
                        keyword: params.keyword || undefined,

                        createdAtFrom: createdAtRange?.[0],
                        createdAtTo: createdAtRange?.[1],

                        withUser: true,
                    };

                    const res: any = await listUserLogs(payload);

                    // 我适配 ProTable 标准返回格式：data/total/success
                    return {
                        data: res?.list || [],
                        total: res?.total || 0,
                        success: true,
                    };
                }}
                pagination={{ pageSize: 20 }}
                toolBarRender={() => [
                    <Button key="refresh" onClick={() => actionRef.current?.reload()}>
                        刷新
                    </Button>,
                ]}
            />

            <Drawer
                title="日志详情"
                open={detailOpen}
                onClose={() => {
                    setDetailOpen(false);
                    setDetail(null);
                }}
                width={720}
            >
                {detailLoading ? (
                    <Text>加载中...</Text>
                ) : !detail ? (
                    <Text type="secondary">暂无数据</Text>
                ) : (
                    <Space direction="vertical" style={{ width: '100%' }} size={12}>
                        <div>
                            <Text strong>ID：</Text> <Text>{detail.id}</Text>
                        </div>
                        <div>
                            <Text strong>时间：</Text>{' '}
                            <Text>{dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
                        </div>
                        <div>
                            <Text strong>操作人：</Text>{' '}
                            <Text>
                                {detail.user?.name || '-'}（ID: {detail.userId}）
                            </Text>
                        </div>
                        <div>
                            <Text strong>动作(action)：</Text> <Tag>{renderAction(detail?.action)}</Tag>
                        </div>
                        <div>
                            <Text strong>目标：</Text>{' '}
                            <Text>
                                {detail.targetType} / {detail.targetId ?? '-'}
                            </Text>
                        </div>
                        <div>
                            <Text strong>备注：</Text> <Text>{detail.remark || '-'}</Text>
                        </div>
                        <div>
                            <Text strong>IP / UA：</Text>{' '}
                            <Text>
                                {detail.ip || '-'} / {detail.userAgent || '-'}
                            </Text>
                        </div>

                        <div>
                            <Text strong>oldData：</Text>
                            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(detail.oldData ?? null, null, 2)}
              </pre>
                        </div>

                        <div>
                            <Text strong>newData：</Text>
                            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(detail.newData ?? null, null, 2)}
              </pre>
                        </div>
                    </Space>
                )}
            </Drawer>
        </PageContainer>
    );
};

export default UserLogsPage;
