import React, { useMemo, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Form, Input, InputNumber, message, Modal, Select, Space, Table, Tag } from 'antd';
import { getGoodsCategoryTree, getGoodsTagList, upsertGoodsTagList } from '@/services/api';

type CategoryNode = { id: string; name: string; level: 1 | 2 | 3; children?: CategoryNode[] };
type GoodsTag = {
  id: string;
  name: string;
  gameCategoryId: string;
  sortOrder?: number;
  enabled?: boolean;
};

const flatten = (nodes: CategoryNode[]): CategoryNode[] => {
  const list: CategoryNode[] = [];
  const walk = (arr: CategoryNode[]) => (arr || []).forEach((n) => {
    list.push(n);
    walk(n.children || []);
  });
  walk(nodes || []);
  return list;
};

const GoodsTagManagementPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [tags, setTags] = useState<GoodsTag[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [categoryTree, tagList] = await Promise.all([getGoodsCategoryTree(), getGoodsTagList()]);
      setCategories(Array.isArray(categoryTree) ? categoryTree : []);
      setTags(Array.isArray(tagList) ? tagList : []);
    } catch (e: any) {
      message.error(e?.message || '加载标签配置失败');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  const allCategories = useMemo(() => flatten(categories), [categories]);
  const level1Options = useMemo(
    () => allCategories.filter((x) => Number(x.level) === 1).map((x) => ({ label: x.name, value: x.id })),
    [allCategories],
  );

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true, sortOrder: 0 });
    setModalOpen(true);
  };

  const openEdit = (row: GoodsTag) => {
    setEditingId(row.id);
    form.setFieldsValue(row);
    setModalOpen(true);
  };

  const saveOne = async () => {
    const v = await form.validateFields();
    const id = editingId || `gt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const next = [
      ...tags.filter((x) => x.id !== id),
      {
        id,
        name: String(v.name || '').trim(),
        gameCategoryId: String(v.gameCategoryId || '').trim(),
        sortOrder: Number(v.sortOrder || 0),
        enabled: Boolean(v.enabled),
      } as GoodsTag,
    ];
    setTags(next);
    setModalOpen(false);
  };

  const removeOne = (id: string) => setTags(tags.filter((x) => x.id !== id));

  const persist = async () => {
    setSaving(true);
    try {
      await upsertGoodsTagList(tags);
      message.success('商品标签已保存');
      await load();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: '标签名称', dataIndex: 'name' },
    {
      title: '所属游戏(游戏分类)',
      dataIndex: 'gameCategoryId',
      render: (v: string) => level1Options.find((x) => x.value === v)?.label || '-',
    },
    { title: '排序', dataIndex: 'sortOrder' },
    {
      title: '状态',
      dataIndex: 'enabled',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      render: (_: any, row: GoodsTag) => (
        <Space>
          <Button size="small" onClick={() => openEdit(row)}>编辑</Button>
          <Button size="small" danger onClick={() => removeOne(row.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title="商品标签管理" subTitle="标签与游戏分类绑定，供商品编辑页选择">
      <Card
        extra={(
          <Space>
            <Button onClick={load} loading={loading}>刷新</Button>
            <Button type="primary" onClick={openCreate}>新增标签</Button>
            <Button type="primary" onClick={persist} loading={saving}>保存标签</Button>
          </Space>
        )}
      >
        <Table rowKey="id" columns={columns as any} dataSource={tags} pagination={false} />
      </Card>

      <Modal title={editingId ? '编辑标签' : '新增标签'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={saveOne} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="标签名称" rules={[{ required: true, message: '请输入标签名称' }]}>
            <Input placeholder="例如：上分稳 / 包时长 / 速通" />
          </Form.Item>
          <Form.Item name="gameCategoryId" label="所属游戏（游戏分类）" rules={[{ required: true, message: '请选择所属游戏' }]}>
            <Select options={level1Options} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="状态">
            <Select options={[{ label: '启用', value: true }, { label: '停用', value: false }]} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default GoodsTagManagementPage;
