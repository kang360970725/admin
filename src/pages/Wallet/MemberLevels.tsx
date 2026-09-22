import React, { useRef, useState } from 'react';
import {
    ModalForm,
    ProFormDigit,
    ProFormSwitch,
    ProFormText,
    ProFormTextArea,
    ProTable,
    PageContainer,
} from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space, Tag } from 'antd';
import {
    createMemberLevelConfig,
    deleteMemberLevelConfig,
    getMemberLevelConfigs,
    updateMemberLevelConfig,
} from '@/services/api';

export default function MemberLevelsPage() {
    const actionRef = useRef<any>();
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);

    const columns: any[] = [
        { title: '排序', dataIndex: 'sortOrder', width: 80, search: false },
        { title: '编码', dataIndex: 'code', width: 100, search: false },
        { title: '名称', dataIndex: 'name', width: 120, search: false },
        { title: '充值门槛', dataIndex: 'minRechargeAmount', width: 120, search: false, render: (v: any) => `¥${Number(v ?? 0).toFixed(2)}` },
        {
            title: '权益',
            dataIndex: 'benefits',
            search: false,
            render: (v: any) => {
                const arr = Array.isArray(v) ? v : [];
                return (
                    <Space wrap>
                        {arr.length ? arr.map((item: string) => <Tag key={item}>{item}</Tag>) : '-'}
                    </Space>
                );
            },
        },
        { title: '默认等级', dataIndex: 'isDefault', width: 100, search: false, render: (v: boolean) => v ? <Tag color="blue">默认</Tag> : '-' },
        { title: '状态', dataIndex: 'enabled', width: 100, search: false, render: (v: boolean) => v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag> },
        {
            title: '操作',
            valueType: 'option',
            width: 190,
            render: (_: any, record: any) => [
                <Button
                    key="edit"
                    type="link"
                    onClick={() => {
                        setEditing({
                            ...record,
                            benefitsText: Array.isArray(record?.benefits) ? record.benefits.join('\n') : '',
                        });
                        setOpen(true);
                    }}
                >
                    编辑
                </Button>,
                <Popconfirm
                    key="delete"
                    title={`确认删除会员等级“${record.name}（${record.code}）”？`}
                    description="有关联会员或属于默认等级时，系统会拒绝删除。"
                    okText="确认删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={async () => {
                        try {
                            await deleteMemberLevelConfig(Number(record.id));
                            message.success('会员等级已删除');
                            actionRef.current?.reload();
                        } catch (e: any) {
                            message.error(e?.message || '删除失败');
                        }
                    }}
                >
                    <Button danger type="link">删除</Button>
                </Popconfirm>,
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
                    const data: any = await getMemberLevelConfigs();
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
                        新增等级
                    </Button>,
                ]}
            />

            <ModalForm
                title={editing ? '编辑会员等级' : '新增会员等级'}
                open={open}
                layout="vertical"
                width={820}
                modalProps={{ destroyOnClose: true, onCancel: () => setOpen(false), className: 'bc-admin-form-modal' }}
                initialValues={editing || { enabled: true, isDefault: false, sortOrder: 100, minRechargeAmount: 0, benefitsText: '' }}
                onFinish={async (values) => {
                    const payload = {
                        ...values,
                        benefits: String(values?.benefitsText || ''),
                    };
                    try {
                        if (editing?.id) {
                            await updateMemberLevelConfig(editing.id, payload);
                        } else {
                            await createMemberLevelConfig(payload);
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
                <div className="bc-admin-form">
                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">基础信息</div>
                        <div className="bc-admin-form-grid">
                            <ProFormText name="code" label="等级编码" rules={[{ required: true, message: '请输入编码' }]} disabled={!!editing?.id} />
                            <ProFormText name="name" label="等级名称" rules={[{ required: true, message: '请输入名称' }]} />
                            <ProFormDigit name="sortOrder" label="排序" min={0} fieldProps={{ precision: 0 }} />
                        </div>
                    </div>
                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">升级门槛</div>
                        <div className="bc-admin-form-grid">
                            <ProFormDigit name="minRechargeAmount" label="等级参考充值门槛" min={0} fieldProps={{ precision: 2 }} extra="仅用于客服参考和会员展示，不再自动调整会员等级" />
                        </div>
                    </div>
                    <div className="bc-admin-form-section">
                        <div className="bc-admin-form-section-title">权益与状态</div>
                        <div className="bc-admin-form-grid">
                            <div className="bc-admin-form-grid-full">
                                <ProFormTextArea
                                    name="benefitsText"
                                    label="会员权益"
                                    fieldProps={{ autoSize: { minRows: 4, maxRows: 8 } }}
                                    extra="每行一个权益"
                                />
                            </div>
                            <div className="bc-admin-form-grid-full">
                                <ProFormText name="description" label="说明" />
                            </div>
                            <ProFormSwitch name="isDefault" label="默认等级" />
                            <ProFormSwitch name="enabled" label="启用" />
                        </div>
                    </div>
                </div>
            </ModalForm>
        </PageContainer>
    );
}
