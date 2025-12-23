import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@umijs/max';
import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components';
import { Button, Space, Tag } from 'antd';
import { getEnumDicts, getMyDispatches } from '@/services/api';

type DictMap = Record<string, Record<string, string>>;

const statusColor = (v?: string) => {
    const s = String(v || '');
    if (s.includes('WAIT')) return 'orange';
    if (s.includes('ACCEPT')) return 'blue';
    if (s.includes('ARCH')) return 'gold';
    if (s.includes('COMP')) return 'green';
    if (s.includes('CANCEL') || s.includes('REFUND')) return 'red';
    return 'default';
};

const MyOrdersPage: React.FC = () => {
    const navigate = useNavigate();

    const [dicts, setDicts] = useState<DictMap>({});

    const t = (group: keyof DictMap, key: any, fallback?: string) => {
        const k = String(key ?? '');
        return dicts?.[group]?.[k] || fallback || k || '-';
    };

    useEffect(() => {
        (async () => {
            try {
                const res = await getEnumDicts();
                setDicts(res || {});
            } catch (e) {
                // 不阻塞页面
                console.error(e);
            }
        })();
    }, []);

    const columns = useMemo<ProColumns<any>[]>(() => {
        return [
            {
                title: '订单号',
                dataIndex: ['order', 'autoSerial'],
                width: 160,
                ellipsis: true,
            },
            {
                title: '项目',
                dataIndex: ['order', 'project', 'name'],
                ellipsis: true,
                render: (_, row) =>
                    row?.order?.project?.name || row?.order?.projectSnapshot?.name || '-',
            },
            {
                title: '计费',
                dataIndex: ['order', 'projectSnapshot', 'billingMode'],
                width: 110,
                render: (_, row) => {
                    const billingMode =
                        row?.order?.projectSnapshot?.billingMode || row?.order?.project?.billingMode;
                    return <Tag>{t('BillingMode', billingMode, billingMode)}</Tag>;
                },
            },
            {
                title: '订单状态',
                dataIndex: ['order', 'status'],
                width: 120,
                valueType: 'select',
                render: (_, row) => {
                    const v = row?.order?.status;
                    return <Tag color={statusColor(v)}>{t('OrderStatus', v, v)}</Tag>;
                },
            },
            {
                title: '本轮派单状态',
                dataIndex: 'status',
                width: 140,
                valueType: 'select',
                render: (_, row) => {
                    const v = row?.status;
                    return <Tag color={statusColor(v)}>{t('DispatchStatus', v, v)}</Tag>;
                },
            },
            {
                title: '本轮参与者',
                dataIndex: 'participants',
                render: (_, row) => {
                    const ps = Array.isArray(row?.participants) ? row.participants : [];
                    const actives = ps.filter((p: any) => p?.isActive !== false);
                    if (actives.length <= 0) return '-';
                    return (
                        <Space wrap size={[6, 6]}>
                            {actives.map((p: any) => {
                                const u = p?.user;
                                const name = u?.name || '未命名';
                                const phone = u?.phone || '-';
                                return <Tag key={p?.id}>{`${name}（${phone}）`}</Tag>;
                            })}
                        </Space>
                    );
                },
            },
            {
                title: '接单时间',
                dataIndex: 'updatedAt',
                width: 170,
                render: (_, row) => {
                    // participant.acceptedAt 如果你想更精准可改成“当前用户的 acceptedAt”
                    const ps = Array.isArray(row?.participants) ? row.participants : [];
                    const me = ps.find((p: any) => p?.acceptedAt);
                    const v = me?.acceptedAt || row?.updatedAt;
                    return v ? new Date(v).toLocaleString() : '-';
                },
            },
            {
                title: '实付金额',
                dataIndex: ['order', 'paidAmount'],
                width: 110,
                render: (_, row) => {
                    const v = row?.order?.paidAmount;
                    return v == null ? '-' : `¥${v}`;
                },
            },
            {
                title: '操作',
                valueType: 'option',
                width: 140,
                render: (_, row) => {
                    return [
                        <Button
                            key="detail"
                            type="link"
                            onClick={() => navigate(`/orders/${row?.orderId || row?.order?.id}`)}
                        >
                            查看订单
                        </Button>,
                    ];
                },
            },
        ];
    }, [dicts, navigate]);

    return (
        <PageContainer>
            <ProTable
                rowKey="id"
                columns={columns}
                search={{
                    labelWidth: 90,
                    defaultCollapsed: false,
                }}
                request={async (params) => {
                    const page = Number(params.current || 1);
                    const limit = Number(params.pageSize || 20);

                    // 这里先只做一个派单状态筛选；后面工作台会做更细的分组
                    const status = params.status ? String(params.status) : undefined;

                    const res: any = await getMyDispatches({ page, limit, status });
                    return {
                        data: res?.data || [],
                        success: true,
                        total: res?.total || 0,
                    };
                }}
                pagination={{ pageSize: 20 }}
                toolBarRender={false}
            />
        </PageContainer>
    );
};

export default MyOrdersPage;
