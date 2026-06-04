import React, { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Tabs, Typography, Upload } from 'antd';
import { DeleteOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Editor, Toolbar } from '@wangeditor/editor-for-react';
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor';
import '@wangeditor/editor/dist/css/style.css';
import {
  deleteMiniappProtocol,
  deleteMiniappProtocolCategory,
  listMiniappProtocolCategories,
  listMiniappProtocols,
  MiniappProtocolCategoryItem,
  MiniappProtocolItem,
  upsertMiniappProtocol,
  upsertMiniappProtocolCategory,
} from '@/services/api';
import { uploadFileToCosBySts } from '@/utils/cosUpload';

const { Text } = Typography;
const { TextArea } = Input;

type ProtocolPreset = {
  key: string;
  title: string;
  remark: string;
  sort: number;
  categoryName: string;
};

const CATEGORY_GROUPS = [
  {
    name: 'C 端用户协议（用户勾选）',
    items: [
      { key: 'platform_user_service_agreement', title: '平台用户服务协议', remark: '整合原用户协议、平台服务协议、会员注册协议', sort: 10 },
      { key: 'member_service_agreement', title: '会员服务协议', remark: '付费会员专属协议', sort: 20 },
      { key: 'privacy_policy_cookie', title: '隐私政策 + Cookie 使用说明', remark: '隐私政策与 Cookie 使用说明', sort: 30 },
      { key: 'minor_protection_rules', title: '未成年人保护专项规则', remark: '未成年人保护专项规则', sort: 40 },
      { key: 'order_service_agreement', title: '下单服务协议', remark: '用户下单前勾选的服务协议', sort: 50 },
      { key: 'after_sales_service_agreement', title: '售后服务协议', remark: '售后服务说明', sort: 60 },
      { key: 'wallet_service_agreement', title: '平台钱包服务协议', remark: '钱包账户服务说明', sort: 70 },
      { key: 'recharge_service_agreement', title: '充值服务协议、预付储值须知', remark: '充值及预付储值说明', sort: 80 },
      { key: 'passwordless_payment_authorization', title: '免密支付 / 快捷扣款授权协议', remark: '免密支付 / 快捷扣款授权', sort: 90 },
    ],
  },
  {
    name: 'B 端商户协议（商家入驻签约）',
    items: [
      { key: 'merchant_entry_cooperation_agreement', title: '商户入驻合作协议', remark: 'B 端商户入驻签约', sort: 100 },
      { key: 'merchant_settlement_agreement', title: '商户结算协议', remark: 'B 端商户结算条款', sort: 110 },
      { key: 'merchant_deposit_agreement', title: '商户保证金协议', remark: 'B 端商户保证金条款', sort: 120 },
      { key: 'product_service_publish_rules', title: '商品 / 服务发布管理规范', remark: '商品 / 服务发布规范', sort: 130 },
      { key: 'platform_advertising_cooperation_agreement', title: '平台广告投放协议（商家投流）', remark: '商家投流合作协议', sort: 140 },
    ],
  },
  {
    name: '平台对外合作协议（平台和第三方公司签）',
    items: [
      { key: 'revenue_sharing_service_agreement', title: '分账服务协议', remark: '平台对外合作协议', sort: 150 },
      { key: 'third_party_payment_cooperation_agreement', title: '第三方支付合作协议', remark: '平台对外合作协议', sort: 160 },
      { key: 'electronic_signature_usage_agreement', title: '电子签章使用协议', remark: '平台对外合作协议', sort: 170 },
    ],
  },
  {
    name: '营销活动合作协议',
    items: [
      { key: 'marketing_activity_cooperation_agreement', title: '营销活动合作协议', remark: '优惠券、拼团、平台活动等合作协议', sort: 180 },
    ],
  },
] as const;

const PROTOCOL_PRESETS: ProtocolPreset[] = CATEGORY_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    key: item.key,
    title: item.title,
    remark: item.remark,
    sort: item.sort,
    categoryName: group.name,
  })),
);

const PROTOCOL_PRESET_MAP = new Map(PROTOCOL_PRESETS.map((item) => [item.key, item]));

function stripHtmlEmpty(html: string) {
  return String(html || '')
    .replace(/<p><br><\/p>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false });
}

const MiniappProtocolsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<MiniappProtocolCategoryItem[]>([]);
  const [protocols, setProtocols] = useState<MiniappProtocolItem[]>([]);
  const [activeTab, setActiveTab] = useState<'categories' | 'protocols'>('categories');
  const [categoryKeyword, setCategoryKeyword] = useState('');
  const [protocolKeyword, setProtocolKeyword] = useState('');
  const [protocolCategoryFilter, setProtocolCategoryFilter] = useState<number | 'ALL'>('ALL');
  const [protocolStatusFilter, setProtocolStatusFilter] = useState<'ALL' | 'ON' | 'OFF'>('ALL');
  const [categoryVisible, setCategoryVisible] = useState(false);
  const [categoryEditing, setCategoryEditing] = useState<MiniappProtocolCategoryItem | null>(null);
  const [protocolVisible, setProtocolVisible] = useState(false);
  const [protocolEditing, setProtocolEditing] = useState<MiniappProtocolItem | null>(null);
  const [coverImage, setCoverImage] = useState('');
  const [contentHtml, setContentHtml] = useState('<p>请输入协议内容</p>');
  const [editor, setEditor] = useState<IDomEditor | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [form] = Form.useForm();
  const [categoryForm] = Form.useForm();

  const loadAll = async () => {
    setLoading(true);
    try {
      const [categoryRows, protocolRows] = await Promise.all([listMiniappProtocolCategories(), listMiniappProtocols()]);
      setCategories(Array.isArray(categoryRows) ? categoryRows : []);
      setProtocols(Array.isArray(protocolRows) ? protocolRows : []);
    } catch (e: any) {
      message.error(e?.message || '加载协议数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  const protocolCounts = useMemo(() => {
    return protocols.reduce<Record<number, number>>((acc, item) => {
      const categoryId = Number(item.categoryId || 0);
      acc[categoryId] = (acc[categoryId] || 0) + 1;
      return acc;
    }, {});
  }, [protocols]);

  const categoryRows = useMemo(() => {
    const keyword = categoryKeyword.trim().toLowerCase();
    const rows = categories
      .map((item) => ({
        ...item,
        protocolCount: protocolCounts[item.id] || item.protocolCount || 0,
      }))
      .filter((item) => {
        if (!keyword) return true;
        return [item.name, item.description]
          .filter(Boolean)
          .some((text) => String(text).toLowerCase().includes(keyword));
      });

    return rows.sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
  }, [categories, categoryKeyword, protocolCounts]);

  const protocolCategoryOptions = useMemo(
    () =>
      categories
        .slice()
        .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
        .map((item) => ({
          label: `${item.name}${item.enabled ? '' : '（停用）'}`,
          value: item.id,
        })),
    [categories],
  );

  const protocolKeyOptions = useMemo(
    () =>
      CATEGORY_GROUPS.map((group) => ({
        label: group.name,
        options: group.items.map((item) => ({
          label: `${item.title} · ${item.key}`,
          value: item.key,
        })),
      })),
    [],
  );

  const filteredProtocols = useMemo(() => {
    const keyword = protocolKeyword.trim().toLowerCase();
    return protocols
      .filter((item) => {
        if (protocolCategoryFilter !== 'ALL' && Number(item.categoryId || 0) !== Number(protocolCategoryFilter)) return false;
        if (protocolStatusFilter === 'ON' && !item.enabled) return false;
        if (protocolStatusFilter === 'OFF' && item.enabled) return false;
        if (!keyword) return true;
        const categoryName = item.category?.name || '';
        return [item.key, item.title, item.remark, categoryName]
          .filter(Boolean)
          .some((text) => String(text).toLowerCase().includes(keyword));
      })
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
  }, [protocolCategoryFilter, protocolKeyword, protocolStatusFilter, protocols]);

  const editorConfig = useMemo<Partial<IEditorConfig>>(
    () => ({
      placeholder: '请输入协议内容，支持插入图片',
      MENU_CONF: {
        uploadImage: {
          async customUpload(file: File, insertFn: (url: string, alt?: string, href?: string) => void) {
            const url = await uploadProtocolMedia(file, 'rich');
            if (!url) {
              throw new Error('上传成功但未获取可用图片地址');
            }
            insertFn(url, file.name, url);
          },
        },
      },
    }),
    [],
  );

  const toolbarConfig = useMemo<Partial<IToolbarConfig>>(
    () => ({
      toolbarKeys: [
        'headerSelect',
        'bold',
        'italic',
        'underline',
        'through',
        '|',
        'color',
        'bgColor',
        '|',
        'bulletedList',
        'numberedList',
        'blockquote',
        '|',
        'insertLink',
        'insertImage',
        'uploadImage',
        '|',
        'undo',
        'redo',
      ],
    }),
    [],
  );

  const uploadProtocolMedia = async (file: File, scene: 'cover' | 'rich') => {
    const result = await uploadFileToCosBySts({
      module: 'miniapp-protocol',
      scene,
      file,
    });
    return String(result.url || '').trim();
  };

  const openCreateCategory = () => {
    setCategoryEditing(null);
    categoryForm.resetFields();
    categoryForm.setFieldsValue({
      enabled: true,
      sort: 0,
    });
    setCategoryVisible(true);
  };

  const openEditCategory = (row: MiniappProtocolCategoryItem) => {
    setCategoryEditing(row);
    categoryForm.setFieldsValue({
      ...row,
      enabled: row.enabled !== false,
    });
    setCategoryVisible(true);
  };

  const saveCategory = async () => {
    const values = await categoryForm.validateFields();
    setSaving(true);
    try {
      await upsertMiniappProtocolCategory({
        id: categoryEditing?.id,
        name: String(values.name || '').trim(),
        description: String(values.description || '').trim(),
        sort: Number(values.sort || 0),
        enabled: Boolean(values.enabled),
      });
      message.success('分类已保存');
      setCategoryVisible(false);
      setCategoryEditing(null);
      categoryForm.resetFields();
      await loadAll();
    } catch (e: any) {
      message.error(e?.data?.message || e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const openCreateProtocol = () => {
    setProtocolEditing(null);
    setCoverImage('');
    setContentHtml('<p>请输入协议内容</p>');
    form.resetFields();
    const firstPreset = PROTOCOL_PRESETS[0];
    const defaultCategory = categories.find((item) => item.name === firstPreset?.categoryName)?.id;
    form.setFieldsValue({
      key: firstPreset?.key,
      title: firstPreset?.title,
      remark: firstPreset?.remark,
      sort: firstPreset?.sort || 0,
      categoryId: defaultCategory,
      enabled: true,
    });
    setProtocolVisible(true);
  };

  const openEditProtocol = (row: MiniappProtocolItem) => {
    setProtocolEditing(row);
    setCoverImage(String(row.coverImage || '').trim());
    setContentHtml(String(row.content || '<p>请输入协议内容</p>'));
    form.setFieldsValue({
      ...row,
      enabled: row.enabled !== false,
      originalKey: row.key,
      categoryId: Number(row.categoryId || row.category?.id || 0),
    });
    setProtocolVisible(true);
  };

  const saveProtocol = async () => {
    const values = await form.validateFields();
    const content = stripHtmlEmpty(contentHtml);
    if (!content) {
      message.error('协议内容不能为空');
      return;
    }

    setSaving(true);
    try {
      await upsertMiniappProtocol({
        id: protocolEditing?.id,
        originalKey: protocolEditing ? String(protocolEditing.key || '').trim() : String(values.originalKey || '').trim() || undefined,
        key: String(values.key || '').trim(),
        categoryId: Number(values.categoryId || 0),
        title: String(values.title || '').trim(),
        coverImage: coverImage || undefined,
        content,
        enabled: Boolean(values.enabled),
        remark: String(values.remark || '').trim(),
        sort: Number(values.sort || 0),
      });
      message.success('协议已保存');
      setProtocolVisible(false);
      setProtocolEditing(null);
      setCoverImage('');
      setContentHtml('<p>请输入协议内容</p>');
      form.resetFields();
      await loadAll();
    } catch (e: any) {
      message.error(e?.data?.message || e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const removeCategory = async (row: MiniappProtocolCategoryItem) => {
    try {
      await deleteMiniappProtocolCategory({ id: row.id });
      message.success('分类已删除');
      await loadAll();
    } catch (e: any) {
      message.error(e?.data?.message || e?.message || '删除失败');
    }
  };

  const removeProtocol = async (row: MiniappProtocolItem) => {
    try {
      await deleteMiniappProtocol({ key: row.key });
      message.success('协议已删除');
      await loadAll();
    } catch (e: any) {
      message.error(e?.data?.message || e?.message || '删除失败');
    }
  };

  const currentCategoryName = (categoryId?: number | null) => {
    if (!categoryId) return '-';
    return categories.find((item) => Number(item.id) === Number(categoryId))?.name || '-';
  };

  return (
    <PageContainer title="协议维护" subTitle="分类可维护，协议键受控选择，支持富文本与图文封面上传">
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'categories' | 'protocols')}
        items={[
          {
            key: 'categories',
            label: '分类管理',
            children: (
              <Card
                extra={
                  <Space>
                    <Input.Search
                      allowClear
                      value={categoryKeyword}
                      onChange={(e) => setCategoryKeyword(e.target.value)}
                      onSearch={(value) => setCategoryKeyword(value)}
                      placeholder="搜索分类名称 / 描述"
                      style={{ width: 260 }}
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => void loadAll()} loading={loading}>
                      刷新
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateCategory}>
                      新增分类
                    </Button>
                  </Space>
                }
              >
                <Table<MiniappProtocolCategoryItem & { protocolCount?: number }>
                  rowKey="id"
                  loading={loading}
                  dataSource={categoryRows}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  columns={[
                    { title: '名称', dataIndex: 'name', width: 220 },
                    {
                      title: '说明',
                      dataIndex: 'description',
                      render: (value) => <Text ellipsis={{ tooltip: value }}>{value || '-'}</Text>,
                    },
                    {
                      title: '协议数',
                      dataIndex: 'protocolCount',
                      width: 100,
                      render: (value) => <Tag color="blue">{Number(value || 0)}</Tag>,
                    },
                    {
                      title: '排序',
                      dataIndex: 'sort',
                      width: 100,
                      render: (value) => <Tag>{Number(value || 0)}</Tag>,
                    },
                    {
                      title: '状态',
                      dataIndex: 'enabled',
                      width: 100,
                      render: (value) => (value ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
                    },
                    {
                      title: '更新时间',
                      dataIndex: 'updatedAt',
                      width: 180,
                      render: (value) => formatDateTime(String(value || '')),
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: 160,
                      render: (_, row) => (
                        <Space size={4}>
                          <Button type="link" size="small" onClick={() => openEditCategory(row)}>
                            编辑
                          </Button>
                          <Popconfirm
                            title="确认删除该分类？"
                            description="如果分类下还有协议，将无法删除。"
                            okText="删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => void removeCategory(row)}
                          >
                            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                              删除
                            </Button>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'protocols',
            label: '协议管理',
            children: (
              <Card
                extra={
                  <Space wrap>
                    <Input.Search
                      allowClear
                      value={protocolKeyword}
                      onChange={(e) => setProtocolKeyword(e.target.value)}
                      onSearch={(value) => setProtocolKeyword(value)}
                      placeholder="搜索协议键 / 标题 / 备注"
                      style={{ width: 260 }}
                    />
                    <Select
                      allowClear={false}
                      value={protocolCategoryFilter}
                      onChange={(value) => setProtocolCategoryFilter(value)}
                      style={{ width: 190 }}
                      options={[{ label: '全部分类', value: 'ALL' }, ...protocolCategoryOptions]}
                    />
                    <Select
                      value={protocolStatusFilter}
                      onChange={(value) => setProtocolStatusFilter(value)}
                      style={{ width: 150 }}
                      options={[
                        { label: '全部状态', value: 'ALL' },
                        { label: '仅启用', value: 'ON' },
                        { label: '仅停用', value: 'OFF' },
                      ]}
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => void loadAll()} loading={loading}>
                      刷新
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateProtocol}>
                      新增协议
                    </Button>
                  </Space>
                }
              >
                <Table<MiniappProtocolItem>
                  rowKey={(row) => `${row.id || row.key}`}
                  loading={loading}
                  dataSource={filteredProtocols}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  columns={[
                    {
                      title: '封面',
                      dataIndex: 'coverImage',
                      width: 90,
                      render: (value) =>
                        value ? (
                          <img
                            src={String(value)}
                            alt="cover"
                            style={{ width: 56, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid #f0f0f0' }}
                          />
                        ) : (
                          <Tag>无</Tag>
                        ),
                    },
                    {
                      title: '分类',
                      dataIndex: 'categoryId',
                      width: 220,
                      render: (value, row) => (
                        <Tag color={row.category?.enabled === false ? 'default' : 'blue'}>{currentCategoryName(Number(value || row.category?.id || 0))}</Tag>
                      ),
                    },
                    {
                      title: '协议键',
                      dataIndex: 'key',
                      width: 240,
                      render: (value) => <Text copyable>{String(value || '-')}</Text>,
                    },
                    {
                      title: '标题',
                      dataIndex: 'title',
                      width: 220,
                      render: (value) => <Text ellipsis={{ tooltip: value }}>{value || '-'}</Text>,
                    },
                    {
                      title: '状态',
                      dataIndex: 'enabled',
                      width: 100,
                      render: (value) => (value ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
                    },
                    {
                      title: '排序',
                      dataIndex: 'sort',
                      width: 90,
                      render: (value) => <Tag>{Number(value || 0)}</Tag>,
                    },
                    {
                      title: '备注',
                      dataIndex: 'remark',
                      render: (value) => <Text ellipsis={{ tooltip: value }}>{value || '-'}</Text>,
                    },
                    {
                      title: '更新时间',
                      dataIndex: 'updatedAt',
                      width: 180,
                      render: (value) => formatDateTime(String(value || '')),
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: 160,
                      render: (_, row) => (
                        <Space size={4}>
                          <Button type="link" size="small" onClick={() => openEditProtocol(row)}>
                            编辑
                          </Button>
                          <Popconfirm
                            title="确认删除该协议？"
                            description="删除后无法恢复。"
                            okText="删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => void removeProtocol(row)}
                          >
                            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                              删除
                            </Button>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={categoryEditing ? '编辑分类' : '新增分类'}
        open={categoryVisible}
        width={680}
        confirmLoading={saving}
        destroyOnClose
        onCancel={() => {
          setCategoryVisible(false);
          setCategoryEditing(null);
          categoryForm.resetFields();
        }}
        onOk={() => void saveCategory()}
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item label="分类名称" name="name" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="例如：C 端用户协议（用户勾选）" maxLength={120} showCount />
          </Form.Item>

          <Form.Item label="分类说明" name="description">
            <TextArea rows={2} placeholder="例如：用户在小程序端勾选确认的协议" maxLength={255} showCount />
          </Form.Item>

          <Space size={16} style={{ width: '100%' }} align="start">
            <Form.Item label="排序" name="sort" style={{ width: 220 }}>
              <InputNumber min={0} step={10} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="状态" name="enabled" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={protocolEditing ? '编辑协议' : '新增协议'}
        open={protocolVisible}
        width={1100}
        confirmLoading={saving}
        destroyOnClose
        onCancel={() => {
          setProtocolVisible(false);
          setProtocolEditing(null);
          setCoverImage('');
          setContentHtml('<p>请输入协议内容</p>');
          form.resetFields();
        }}
        onOk={() => void saveProtocol()}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="originalKey" hidden>
            <Input />
          </Form.Item>

          <Form.Item label="协议键" name="key" rules={[{ required: true, message: '请选择协议键' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={protocolKeyOptions}
              placeholder="请选择协议键"
              onChange={(value) => {
                const preset = PROTOCOL_PRESET_MAP.get(String(value || ''));
                if (!preset) return;
                const matchedCategory = categories.find((item) => item.name === preset.categoryName);
                form.setFieldsValue({
                  title: preset.title,
                  remark: preset.remark,
                  sort: preset.sort,
                  categoryId: matchedCategory?.id,
                });
              }}
            />
          </Form.Item>

          <Form.Item label="所属分类" name="categoryId" rules={[{ required: true, message: '请选择所属分类' }]}>
            <Select placeholder="请选择所属分类" options={protocolCategoryOptions} />
          </Form.Item>

          <Form.Item label="协议标题" name="title" rules={[{ required: true, message: '请输入协议标题' }]}>
            <Input placeholder="例如：下单服务协议" maxLength={120} showCount />
          </Form.Item>

          <Form.Item label="协议封面" name="coverImage">
            <Space align="start" size={16}>
              <Upload
                accept="image/*"
                showUploadList={false}
                customRequest={async (options: any) => {
                  try {
                    setUploadingCover(true);
                    const file = options.file as File;
                    const url = await uploadProtocolMedia(file, 'cover');
                    if (!url) throw new Error('上传成功但未获取可用封面地址');
                    setCoverImage(url);
                    form.setFieldsValue({ coverImage: url });
                    message.success('封面上传成功');
                    options.onSuccess?.({}, file);
                  } catch (e: any) {
                    message.error(e?.message || '封面上传失败');
                    options.onError?.(e);
                  } finally {
                    setUploadingCover(false);
                  }
                }}
              >
                <Button icon={<UploadOutlined />} loading={uploadingCover}>
                  上传封面
                </Button>
              </Upload>
              {coverImage ? (
                <img
                  src={coverImage}
                  alt="protocol-cover"
                  style={{ width: 128, height: 84, objectFit: 'cover', borderRadius: 8, border: '1px solid #f0f0f0' }}
                />
              ) : (
                <Tag color="default">未设置封面</Tag>
              )}
            </Space>
          </Form.Item>

          <Space size={16} style={{ width: '100%' }} align="start">
            <Form.Item label="排序" name="sort" style={{ width: 220 }} rules={[{ required: true, message: '请输入排序值' }]}>
              <InputNumber min={0} step={10} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="状态" name="enabled" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
          </Space>

          <Form.Item label="备注" name="remark">
            <TextArea rows={2} placeholder="可填写使用场景、说明或提醒" maxLength={255} showCount />
          </Form.Item>

          <Form.Item label="协议内容" required>
            <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden' }}>
              <Toolbar editor={editor} defaultConfig={toolbarConfig} mode="default" />
              <Editor
                defaultConfig={editorConfig}
                value={contentHtml}
                onCreated={setEditor}
                onChange={(ed) => setContentHtml(ed.getHtml())}
                mode="default"
                style={{ height: 420, overflowY: 'hidden' }}
              />
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              富文本图片上传已对接腾讯云文件资源管理。
            </Text>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default MiniappProtocolsPage;
