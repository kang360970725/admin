import React, { useRef, useState } from 'react';
import { PageContainer, ProFormDigit, ProFormSwitch, ProFormText, ProTable, ModalForm } from '@ant-design/pro-components';
import { Button, message, Tag } from 'antd';
import { createMemberRechargePlan, getMemberRechargePlans, updateMemberRechargePlan } from '@/services/api';

export default function RechargePlansPage() {
    const actionRef = useRef<any>();
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);

    const columns: any[] = [
        { title: 'ID', dataIndex: 'id', width: 70, search: false },
        { title: '标题', dataIndex: 'title', width: 140, search: false },
        { title: '充值金额', dataIndex: 'amount', width: 120, search: false, render: (v: any) => `¥${Number(v ?? 0).toFixed(2)}` },
        { title: '赠送金额', dataIndex: 'bonusAmount', width: 120, search: false, render: (v: any) => `¥${Number(v ?? 0).toFixed(2)}` },
        { title: '赠送积分', dataIndex: 'giftPoints', width: 100, search: false },
        { title: '角标', dataIndex: 'badgeText', width: 100, search: false, render: (v: string) => v ? <Tag color="orange">{v}</Tag> : '-' },
        { title: '券文案', dataIndex: 'couponText', search: false, ellipsis: true },
        { title: '排序', dataIndex: 'sortOrder', width: 90, search: false },
        { title: '状态', dataIndex: 'enabled', width: 100, search: false, render: (v: boolean) => v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag> },
        {
            title: '操作',
            valueType: 'option',
            width: 100,
            render: (_, record) => [
                <Button
                    key="edit"
                    type="link"
                    onClick={() => {
                        setEditing(record);
                        setOpen(true);
                    }}
                >
                    编辑
                </Button>,
            ],
        },
    ];

    return (
        <PageContainer>
            <ProTable
                rowKey="id"
                actionRef={actionRef}
                search={false}
                columns={columns}
                request={async () => {
                    const data: any = await getMemberRechargePlans();
                    return { data: Array.isArray(data) ? data : [], success: true };
                }}
                toolBarRender={() => [
                    <Button
                        key="create"
                        type="primary"
                        onClick={() => {
                            setEditing(null);
                            setOpen(true);
                        }}
                    >
                        新增方案
                    </Button>,
                ]}
            />

            <ModalForm
                title={editing ? '编辑充值方案' : '新增充值方案'}
                open={open}
                modalProps={{ destroyOnClose: true, onCancel: () => setOpen(false) }}
                initialValues={editing || { enabled: true, sortOrder: 100, giftPoints: 0, bonusAmount: 0 }}
                onFinish={async (values) => {
                    try {
                        if (editing?.id) {
                            await updateMemberRechargePlan(editing.id, values);
                        } else {
                            await createMemberRechargePlan(values);
                        }
                        message.success('保存成功');
                        setOpen(false);
                        actionRef.current?.reload();
                        return true;
                    } catch (e: any) {
                        message.error(e?.message || '保存失败');
                        return false;
                    }
                }}
            >
                <ProFormText name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]} />
                <ProFormDigit name="amount" label="充值金额" min={0.01} fieldProps={{ precision: 2 }} rules={[{ required: true, message: '请输入充值金额' }]} />
                <ProFormDigit name="bonusAmount" label="赠送金额" min={0} fieldProps={{ precision: 2 }} />
                <ProFormDigit name="giftPoints" label="赠送积分" min={0} fieldProps={{ precision: 0 }} />
                <ProFormText name="badgeText" label="角标文案" />
                <ProFormText name="couponText" label="券/权益文案" />
                <ProFormDigit name="sortOrder" label="排序" min={0} fieldProps={{ precision: 0 }} />
                <ProFormSwitch name="enabled" label="启用" />
            </ModalForm>
        </PageContainer>
    );
}
