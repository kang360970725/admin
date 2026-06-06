import React, { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Form, Input, InputNumber, message, Modal, Select, Space, Switch, Table, Tag, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { Editor, Toolbar } from '@wangeditor/editor-for-react';
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor';
import '@wangeditor/editor/dist/css/style.css';
import {
  createGameProject,
  getGameProjectRatingSummary,
  hideGameProjectReview,
  getGoodsCategoryTree,
  getGoodsTagList,
  getGameProjectList,
  listGameProjectReviews,
  updateGameProject,
} from '@/services/api';
import { uploadFileToCosBySts } from '@/utils/cosUpload';

const { Option } = Select;
const { TextArea } = Input;

type CategoryNode = { id: string; name: string; level: 1 | 2 | 3; parentId?: string | null; children?: CategoryNode[] };
type GoodsTag = { id: string; name: string; gameCategoryId: string; enabled?: boolean };

const flattenCategoryTree = (tree: CategoryNode[]) => {
  const list: CategoryNode[] = [];
  const walk = (nodes: CategoryNode[]) => (nodes || []).forEach((n) => {
    list.push(n);
    walk(n.children || []);
  });
  walk(tree || []);
  return list;
};

const billingModeLabelMap: Record<string, string> = {
  GUARANTEED: '保底单',
  HOURLY: '小时单',
  MODE_PLAY: '玩法单',
};

const GameProjectManagement: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  const [goodsTags, setGoodsTags] = useState<GoodsTag[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [querying, setQuerying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coverImage, setCoverImage] = useState<string>('');
  const [richContent, setRichContent] = useState<string>('');
  const [editor, setEditor] = useState<IDomEditor | null>(null);
  const [form] = Form.useForm();
  const [queryForm] = Form.useForm();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewProject, setReviewProject] = useState<any>(null);
  const [reviewSummary, setReviewSummary] = useState<{ ratingAvg: number; ratingCount: number }>({ ratingAvg: 0, ratingCount: 0 });
  const [reviewRows, setReviewRows] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewLimit, setReviewLimit] = useState(10);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [includeHidden, setIncludeHidden] = useState(true);

  useEffect(() => {
    loadProjects(1, 20);
  }, []);

  useEffect(() => {
    return () => {
      if (editor) editor.destroy();
    };
  }, [editor]);

  const loadProjects = async (nextPage = page, nextLimit = limit) => {
    setQuerying(true);
    try {
      const q = queryForm.getFieldsValue();
      const res: any = await getGameProjectList({
        page: nextPage,
        limit: nextLimit,
        keyword: String(q?.keyword || '').trim() || undefined,
        gameType: q?.gameType || undefined,
        category: q?.category || undefined,
      });
      setProjects(Array.isArray(res?.data) ? res.data : []);
      setTotal(Number(res?.total || 0));
      setPage(nextPage);
      setLimit(nextLimit);
    } catch {
      message.error('加载商品列表失败');
    } finally {
      setQuerying(false);
    }
  };

  const loadMeta = async () => {
    try {
      const [tree, tags] = await Promise.all([getGoodsCategoryTree(), getGoodsTagList()]);
      setCategoryTree(Array.isArray(tree) ? tree : []);
      setGoodsTags(Array.isArray(tags) ? tags : []);
    } catch {
      message.error('加载分类/标签失败');
    }
  };

  const putFileToCos = async (file: File, scene: 'cover' | 'rich') => {
    const result = await uploadFileToCosBySts({
      module: 'game-project',
      scene,
      file,
    });
    return String(result.url || '').trim();
  };

  const handleCreate = () => {
    setEditingProject(null);
    setCoverImage('');
    setRichContent('<p>请输入商品图文详情</p>');
    form.resetFields();
    form.setFieldsValue({
      type: 'CUSTOMIZED',
      billingMode: 'GUARANTEED',
      status: 'ACTIVE',
      showInMenuList: true,
      tagIds: [],
    });
    setModalVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingProject(record);
    setCoverImage(record.coverImage || '');
    setRichContent(record.richContent || '<p>请输入商品图文详情</p>');
    const tagIds = String(record.projectType || '')
      .split(',')
      .map((x) => x.trim())
      .filter((x) => !!x);
    form.setFieldsValue({
      ...record,
      showInMenuList: record.showInMenuList !== false,
      tagIds,
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    const normalizedRich = String(richContent || '').replace(/<p><br><\/p>/g, '').trim();
    if (!normalizedRich) {
      message.warning('商品详情不能为空');
      return;
    }

    setSubmitting(true);
    try {
      const submitData = {
        ...values,
        projectType: Array.isArray(values.tagIds) ? values.tagIds.join(',') : undefined,
        coverImage: coverImage || undefined,
        richContent: normalizedRich,
      };
      delete submitData.tagIds;

      if (editingProject) {
        await updateGameProject(editingProject.id, submitData);
        message.success('更新成功');
      } else {
        await createGameProject(submitData);
        message.success('创建成功');
      }
      setModalVisible(false);
      await loadProjects(page, limit);
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: any) => {
    Modal.confirm({
      title: '确认停用',
      content: `确定要停用商品 "${record.name}" 吗？`,
      onOk: async () => {
        try {
          await updateGameProject(record.id, { status: 'INACTIVE' });
          message.success('停用成功');
          await loadProjects(page, limit);
        } catch {
          message.error('停用失败');
        }
      },
    });
  };

  const handleActivate = async (record: any) => {
    try {
      await updateGameProject(record.id, { status: 'ACTIVE' });
      message.success('启用成功');
      await loadProjects(page, limit);
    } catch {
      message.error('启用失败');
    }
  };

  const openReviewModal = async (record: any) => {
    setReviewProject(record);
    setReviewModalVisible(true);
    setReviewPage(1);
    setIncludeHidden(true);
    await loadReviews(record.id, 1, reviewLimit, true);
  };

  const loadReviews = async (projectId: number, nextPage = reviewPage, nextLimit = reviewLimit, nextIncludeHidden = includeHidden) => {
    setReviewLoading(true);
    try {
      const [summary, rows] = await Promise.all([
        getGameProjectRatingSummary(projectId),
        listGameProjectReviews(projectId, { page: nextPage, limit: nextLimit, includeHidden: nextIncludeHidden }),
      ]);
      setReviewSummary({
        ratingAvg: Number(summary?.ratingAvg || 0),
        ratingCount: Number(summary?.ratingCount || 0),
      });
      setReviewRows(Array.isArray(rows?.data) ? rows.data : []);
      setReviewTotal(Number(rows?.total || 0));
      setReviewPage(nextPage);
      setReviewLimit(nextLimit);
    } catch {
      message.error('加载评价失败');
    } finally {
      setReviewLoading(false);
    }
  };

  const toggleHideReview = async (review: any) => {
    const hidden = !Boolean(review?.isHidden);
    let reason: string | undefined;
    if (hidden) {
      reason = window.prompt('请输入隐藏原因（可选）') || undefined;
    }
    try {
      await hideGameProjectReview(Number(review.id), { hidden, reason });
      message.success(hidden ? '已隐藏评价' : '已恢复评价');
      if (reviewProject?.id) {
        await loadReviews(Number(reviewProject.id), reviewPage, reviewLimit, includeHidden);
      }
    } catch {
      message.error('操作失败');
    }
  };

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
        'insertTable',
        '|',
        'undo',
        'redo',
      ],
    }),
    [],
  );

  const editorConfig = useMemo<Partial<IEditorConfig>>(
    () => ({
      placeholder: '请输入商品图文详情，支持上传图片',
      MENU_CONF: {
        uploadImage: {
          async customUpload(file: File, insertFn: (url: string, alt?: string, href?: string) => void) {
            const url = await putFileToCos(file, 'rich');
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

  const columns = [
    {
      title: '封面',
      dataIndex: 'coverImage',
      key: 'coverImage',
      render: (image: string) =>
        image ? <img src={image} style={{ width: 50, height: 50, objectFit: 'cover' }} alt="cover" /> : '-',
    },
    { title: '商品名称', dataIndex: 'name', key: 'name' },
    {
      title: '所属游戏',
      dataIndex: 'gameType',
      key: 'gameType',
      render: (v: string) => gameLevel1Options.find((x) => x.value === v)?.label || '-',
    },
    {
      title: '所属分类',
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => {
        const text = allCategories.find((x) => x.id === v)?.name || '-';
        return <Tag color="blue">{text}</Tag>;
      },
    },
    {
      title: '标签',
      dataIndex: 'projectType',
      key: 'projectType',
      render: (v: string) => {
        const ids = String(v || '').split(',').map((x) => x.trim()).filter((x) => !!x);
        if (!ids.length) return '-';
        return (
          <>
            {ids.map((id) => {
              const t = goodsTags.find((x) => x.id === id);
              return <Tag key={id}>{t?.name || id}</Tag>;
            })}
          </>
        );
      },
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => `¥${Number(price || 0)}`,
    },
    {
      title: '计费模式',
      dataIndex: 'billingMode',
      key: 'billingMode',
      width: 110,
      render: (v: string) => {
        const mode = String(v || '').trim();
        return mode ? <Tag color={mode === 'HOURLY' ? 'blue' : mode === 'GUARANTEED' ? 'gold' : 'green'}>{billingModeLabelMap[mode] || mode}</Tag> : '-';
      },
    },
    {
      title: '保底数据',
      dataIndex: 'baseAmount',
      key: 'baseAmount',
      width: 110,
      render: (v: number | null | undefined) => {
        if (v == null || Number.isNaN(Number(v))) return '-';
        return `${Number(v)} 万`;
      },
    },
    {
      title: '评分',
      dataIndex: 'ratingAvg',
      key: 'ratingAvg',
      render: (_: any, record: any) => {
        const avg = Number(record?.ratingAvg || 0);
        const cnt = Number(record?.ratingCount || 0);
        return <span>{avg > 0 ? avg.toFixed(1) : '-'}（{cnt}）</span>;
      },
    },
    {
      title: '划线价',
      dataIndex: 'originPrice',
      key: 'originPrice',
      render: (price: number) => (price == null ? '-' : `¥${Number(price || 0)}`),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>{status === 'ACTIVE' ? '启用' : '停用'}</Tag>,
    },
    {
      title: '展示到商品列表',
      dataIndex: 'showInMenuList',
      key: 'showInMenuList',
      width: 130,
      render: (v: boolean) => (v === false ? <Tag color="default">隐藏</Tag> : <Tag color="green">展示</Tag>),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => openReviewModal(record)}>
            评价
          </Button>
          {record.status === 'ACTIVE' ? (
            <Button type="link" size="small" danger onClick={() => handleDelete(record)}>
              停用
            </Button>
          ) : (
            <Button type="link" size="small" onClick={() => handleActivate(record)}>
              启用
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const allCategories = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree]);
  const gameLevel1Options = useMemo(
    () => allCategories.filter((x) => Number(x.level) === 1).map((x) => ({ label: x.name, value: x.id })),
    [allCategories],
  );
  const currentGameType = Form.useWatch('gameType', form);
  const level2Options = useMemo(
    () => allCategories.filter((x) => Number(x.level) === 2 && String(x.parentId || '') === String(currentGameType || '')).map((x) => ({ label: x.name, value: x.id })),
    [allCategories, currentGameType],
  );
  const queryGameType = Form.useWatch('gameType', queryForm);
  const queryLevel2Options = useMemo(
    () => allCategories.filter((x) => Number(x.level) === 2 && String(x.parentId || '') === String(queryGameType || '')).map((x) => ({ label: x.name, value: x.id })),
    [allCategories, queryGameType],
  );
  const level3Options = useMemo(
    () => allCategories.filter((x) => Number(x.level) === 3 && level2Options.some((l2) => l2.value === x.parentId)).map((x) => ({ label: x.name, value: x.id })),
    [allCategories, level2Options],
  );
  const categoryOptions = useMemo(() => [...level2Options, ...level3Options], [level2Options, level3Options]);
  const tagOptions = useMemo(
    () =>
      goodsTags
        .filter((x) => x.enabled !== false && String(x.gameCategoryId) === String(currentGameType || ''))
        .map((x) => ({ label: x.name, value: x.id })),
    [goodsTags, currentGameType],
  );

  useEffect(() => {
    loadMeta();
  }, []);

  return (
    <PageContainer>
      <Card
        title="商品列表"
        extra={
          <Button type="primary" onClick={handleCreate}>
            新增商品
          </Button>
        }
      >
        <Form form={queryForm} layout="inline" style={{ marginBottom: 12 }}>
          <Form.Item name="keyword">
            <Input allowClear placeholder="搜索商品名称/描述" style={{ width: 240 }} />
          </Form.Item>
          <Form.Item name="gameType">
            <Select
              allowClear
              placeholder="游戏分类"
              options={gameLevel1Options}
              style={{ width: 180 }}
              onChange={() => queryForm.setFieldValue('category', undefined)}
            />
          </Form.Item>
          <Form.Item name="category">
            <Select
              allowClear
              placeholder="二级分类"
              options={queryLevel2Options}
              disabled={!queryGameType}
              style={{ width: 180 }}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" loading={querying} onClick={() => loadProjects(1, limit)}>搜索</Button>
              <Button
                onClick={() => {
                  queryForm.resetFields();
                  void loadProjects(1, limit);
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
        <Table
          columns={columns}
          dataSource={projects}
          rowKey="id"
          loading={querying}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            onChange: (p, s) => loadProjects(p, s),
          }}
        />
      </Card>

      <Modal
        title={reviewProject ? `评价管理 - ${reviewProject.name}` : '评价管理'}
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
        width={980}
        destroyOnClose
      >
        <Space style={{ marginBottom: 12 }}>
          <Tag color="gold">综合评分：{Number(reviewSummary.ratingAvg || 0).toFixed(2)}</Tag>
          <Tag color="blue">有效评价：{Number(reviewSummary.ratingCount || 0)}</Tag>
          <span>显示隐藏评价</span>
          <Switch
            checked={includeHidden}
            onChange={(v) => {
              setIncludeHidden(v);
              if (reviewProject?.id) void loadReviews(Number(reviewProject.id), 1, reviewLimit, v);
            }}
          />
        </Space>
        <Table
          rowKey="id"
          loading={reviewLoading}
          dataSource={reviewRows}
          columns={[
            { title: '用户', dataIndex: ['user', 'name'], key: 'user', render: (_: any, r: any) => (r?.anonymous ? '匿名用户' : (r?.user?.name || r?.user?.phone || `用户${r?.user?.id || ''}`)) },
            { title: '订单ID', dataIndex: 'orderId', key: 'orderId', width: 90 },
            { title: '评分', dataIndex: 'score', key: 'score', width: 70 },
            {
              title: '标签',
              dataIndex: 'tags',
              key: 'tags',
              render: (tags: any) => (Array.isArray(tags) && tags.length ? tags.slice(0, 4).join(' / ') : '-'),
            },
            {
              title: '评价内容',
              dataIndex: 'content',
              key: 'content',
              render: (v: string) => <span style={{ maxWidth: 280, display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v || '-'}</span>,
            },
            { title: '状态', dataIndex: 'isHidden', key: 'isHidden', width: 90, render: (v: boolean) => (v ? <Tag color="default">已隐藏</Tag> : <Tag color="success">展示中</Tag>) },
            { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 170, render: (v: string) => (v ? new Date(v).toLocaleString() : '-') },
            {
              title: '操作',
              key: 'action',
              width: 90,
              render: (_: any, r: any) => (
                <Button type="link" size="small" danger={!r?.isHidden} onClick={() => toggleHideReview(r)}>
                  {r?.isHidden ? '恢复' : '隐藏'}
                </Button>
              ),
            },
          ]}
          pagination={{
            current: reviewPage,
            pageSize: reviewLimit,
            total: reviewTotal,
            showSizeChanger: true,
            onChange: (p, s) => {
              if (reviewProject?.id) void loadReviews(Number(reviewProject.id), p, s, includeHidden);
            },
          }}
        />
      </Modal>

      <Modal
        title={editingProject ? '编辑商品' : '新增商品'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={960}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input placeholder="例如：99保底488W哈夫币绝密单" />
          </Form.Item>

          <Form.Item name="price" label="价格" rules={[{ required: true, message: '请输入价格' }]}>
            <InputNumber min={0} step={1} precision={0} placeholder="请输入价格" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="originPrice" label="划线价（可空）">
            <InputNumber min={0} step={1} precision={0} placeholder="留空表示不展示划线价" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="description" label="简短描述">
            <TextArea rows={3} placeholder="用于卡片展示的简短描述" />
          </Form.Item>

          <Form.Item name="gameType" label="所属游戏" rules={[{ required: true, message: '请选择所属游戏' }]}>
            <Select
              options={gameLevel1Options}
              showSearch
              optionFilterProp="label"
              onChange={() => {
                form.setFieldValue('category', undefined);
                form.setFieldValue('tagIds', []);
              }}
              placeholder="先选择所属游戏（游戏分类）"
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate>
            {() => (
              <Form.Item name="category" label="所属分类" rules={[{ required: true, message: '请选择所属分类' }]}>
                <Select
                  options={categoryOptions}
                  showSearch
                  optionFilterProp="label"
                  disabled={!currentGameType}
                  placeholder={currentGameType ? '选择二级或三级分类' : '请先选择所属游戏'}
                />
              </Form.Item>
            )}
          </Form.Item>

          <Form.Item noStyle shouldUpdate>
            {() => (
              <Form.Item name="tagIds" label="商品标签">
                <Select
                  mode="multiple"
                  options={tagOptions}
                  showSearch
                  optionFilterProp="label"
                  disabled={!currentGameType}
                  placeholder={currentGameType ? '可多选标签（按所属游戏过滤）' : '请先选择所属游戏'}
                />
              </Form.Item>
            )}
          </Form.Item>

          <Form.Item name="type" hidden>
            <Input />
          </Form.Item>

          <Form.Item name="billingMode" label="计费模式" rules={[{ required: true, message: '请选择计费模式' }]}>
            <Select placeholder="请选择计费模式">
              <Option value="GUARANTEED">保底单</Option>
              <Option value="HOURLY">小时单</Option>
              <Option value="MODE_PLAY">玩法单</Option>
            </Select>
          </Form.Item>

          <Form.Item name="baseAmount" label="保底哈夫币数额">
            <InputNumber min={0} step={1} precision={0} placeholder="留空表示无保底要求" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="clubRate" label="俱乐部固定抽成比例">
            <InputNumber min={0} max={1} step={0.01} precision={2} placeholder="留空表示按陪玩评级比例分成" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="封面图片">
            <Upload
              listType="picture"
              showUploadList={false}
              customRequest={async (options: any) => {
                try {
                  const file = options.file as File;
                  const url = await putFileToCos(file, 'cover');
                  if (!url) throw new Error('上传成功但未获取可用封面地址');
                  setCoverImage(url);
                  message.success('封面上传成功');
                  options.onSuccess?.({}, file);
                } catch (e: any) {
                  message.error(e?.message || '封面上传失败');
                  options.onError?.(e);
                }
              }}
            >
              <Button icon={<UploadOutlined />}>上传封面</Button>
            </Upload>
            {coverImage && (
              <div style={{ marginTop: 8 }}>
                <img src={coverImage} style={{ width: 120, height: 120, objectFit: 'cover' }} alt="cover-preview" />
              </div>
            )}
          </Form.Item>

          <Form.Item label="商品详情（富文本）" required>
            <div style={{ border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <Toolbar editor={editor} defaultConfig={toolbarConfig} mode="default" />
              <Editor
                defaultConfig={editorConfig}
                value={richContent}
                onCreated={setEditor}
                onChange={(ed) => setRichContent(ed.getHtml())}
                mode="default"
                style={{ height: 360, overflowY: 'hidden' }}
              />
            </div>
          </Form.Item>

          {editingProject && (
            <Form.Item name="status" label="状态">
              <Select>
                <Option value="ACTIVE">启用</Option>
                <Option value="INACTIVE">停用</Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item name="showInMenuList" label="展示到商品列表" valuePropName="checked">
            <Switch checkedChildren="展示" unCheckedChildren="隐藏" />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {editingProject ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default GameProjectManagement;
