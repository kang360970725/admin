import React, { useMemo, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Form, Input, InputNumber, message, Modal, Select, Space, Table, Tag, Upload } from 'antd';
import { Typography } from 'antd';
import { getGoodsCategoryTree, upsertGoodsCategoryTree } from '@/services/api';
import { UploadOutlined } from '@ant-design/icons';
import { uploadFileToCosBySts } from '@/utils/cosUpload';

const { Text } = Typography;

type CategoryNode = {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  parentId?: string | null;
  sortOrder?: number;
  enabled?: boolean;
  coverImage?: string;
};

const toFlat = (tree: CategoryNode[]) => {
  const list: CategoryNode[] = [];
  const walk = (nodes: CategoryNode[]) => {
    (nodes || []).forEach((n) => {
      list.push(n);
      walk((n as any).children || []);
    });
  };
  walk(tree || []);
  return list;
};

const toTree = (flat: CategoryNode[]) => {
  const map = new Map<string, any>();
  (flat || []).forEach((x) => map.set(x.id, { ...x, children: [] }));
  const roots: any[] = [];
  (flat || []).forEach((x) => {
    const row = map.get(x.id);
    if (!x.parentId) roots.push(row);
    else map.get(x.parentId)?.children?.push(row);
  });
  const sortRec = (nodes: any[]) => {
    nodes.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    nodes.forEach((n) => sortRec(n.children || []));
  };
  sortRec(roots);
  return roots;
};

const GoodsCategoryManagementPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flat, setFlat] = useState<CategoryNode[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const tree = await getGoodsCategoryTree();
      setFlat(toFlat(Array.isArray(tree) ? tree : []));
    } catch (e: any) {
      message.error(e?.message || '加载分类失败');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  const levelOptions = [
    { label: '游戏分类', value: 1 },
    { label: '二级分类（类别）', value: 2 },
    { label: '三级分类（扩展）', value: 3 },
  ];

  const parentOptions = useMemo(
    () =>
      flat.map((x) => ({
        label: `${x.name}（L${x.level}）`,
        value: x.id,
        level: x.level,
      })),
    [flat],
  );

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ level: 1, enabled: true, sortOrder: 0 });
    setModalOpen(true);
  };

  const openEdit = (row: CategoryNode) => {
    setEditingId(row.id);
    form.setFieldsValue({ ...row, parentId: row.parentId || undefined });
    setModalOpen(true);
  };

  const saveOne = async () => {
    const v = await form.validateFields();
    const id = editingId || `gc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const level = Number(v.level || 1) as 1 | 2 | 3;
    const parentId = v.parentId ? String(v.parentId) : null;
    if (level > 1 && !parentId) {
      message.error('二级/三级分类必须选择父级分类');
      return;
    }
    if (level === 2) {
      const p = flat.find((x) => x.id === parentId);
      if (!p || p.level !== 1) {
        message.error('二级分类的父级必须是游戏分类');
        return;
      }
    }
    if (level === 3) {
      const p = flat.find((x) => x.id === parentId);
      if (!p || p.level !== 2) {
        message.error('三级分类的父级必须是二级分类');
        return;
      }
    }
    const next = [
      ...flat.filter((x) => x.id !== id),
      {
        id,
        name: String(v.name || '').trim(),
        level,
        parentId,
        sortOrder: Number(v.sortOrder || 0),
        enabled: Boolean(v.enabled),
        coverImage: String(v.coverImage || '').trim() || undefined,
      },
    ];
    setFlat(next);
    setModalOpen(false);
  };

  const removeOne = (id: string) => {
    const hasChild = flat.some((x) => x.parentId === id);
    if (hasChild) {
      message.error('请先删除子分类');
      return;
    }
    setFlat(flat.filter((x) => x.id !== id));
  };

  const persist = async () => {
    setSaving(true);
    try {
      await upsertGoodsCategoryTree(toTree(flat));
      message.success('分类树已保存');
      await load();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: '封面',
      dataIndex: 'coverImage',
      width: 90,
      render: (v: string) =>
        v ? (
          <img
            src={v}
            alt="cover"
            style={{ width: 56, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #f0f0f0' }}
          />
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    { title: '名称', dataIndex: 'name' },
    {
      title: '层级',
      dataIndex: 'level',
      render: (v: number) => <Tag color={v === 1 ? 'blue' : v === 2 ? 'gold' : 'purple'}>{`L${v}`}</Tag>,
    },
    {
      title: '父级',
      dataIndex: 'parentId',
      render: (v: string) => flat.find((x) => x.id === v)?.name || '-',
    },
    { title: '排序', dataIndex: 'sortOrder' },
    {
      title: '状态',
      dataIndex: 'enabled',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      render: (_: any, row: CategoryNode) => (
        <Space>
          <Button size="small" onClick={() => openEdit(row)}>编辑</Button>
          <Button size="small" danger onClick={() => removeOne(row.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title="分类管理" subTitle="支持一级游戏品类、二级类别、三级扩展分类">
      <Card
        extra={(
          <Space>
            <Button onClick={load} loading={loading}>刷新</Button>
            <Button type="primary" onClick={openCreate}>新增分类</Button>
            <Button type="primary" onClick={persist} loading={saving}>保存分类树</Button>
          </Space>
        )}
      >
        <Table rowKey="id" columns={columns as any} dataSource={flat} pagination={false} />
      </Card>

      <Modal title={editingId ? '编辑分类' : '新增分类'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={saveOne} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="例如：MOBA / 钻石局代练 / 五排车队" />
          </Form.Item>
          <Form.Item name="coverImage" label="分类封面图">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Upload
                showUploadList={false}
                customRequest={async (options: any) => {
                  try {
                    setUploadingCover(true);
                    const file = options.file as File;
                    const res = await uploadFileToCosBySts({
                      module: 'goods-category',
                      scene: 'cover',
                      file,
                    });
                    form.setFieldValue('coverImage', String(res.url || ''));
                    message.success('分类封面上传成功');
                    options.onSuccess?.({}, file);
                  } catch (e: any) {
                    message.error(e?.message || '分类封面上传失败');
                    options.onError?.(e);
                  } finally {
                    setUploadingCover(false);
                  }
                }}
              >
                <Button icon={<UploadOutlined />} loading={uploadingCover}>上传分类封面</Button>
              </Upload>
              {form.getFieldValue('coverImage') ? (
                <img
                  src={String(form.getFieldValue('coverImage'))}
                  alt="category-cover"
                  style={{ width: 180, height: 100, objectFit: 'cover', borderRadius: 6, border: '1px solid #f0f0f0' }}
                />
              ) : null}
            </Space>
          </Form.Item>
          <Form.Item name="level" label="分类层级" rules={[{ required: true, message: '请选择层级' }]}>
            <Select options={levelOptions} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const level = Number(getFieldValue('level') || 1);
              if (level <= 1) return null;
              return (
                <Form.Item name="parentId" label="父级分类" rules={[{ required: true, message: '请选择父级分类' }]}>
                  <Select
                    options={parentOptions.filter((x) => (level === 2 ? x.level === 1 : x.level === 2))}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
              );
            }}
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

export default GoodsCategoryManagementPage;
