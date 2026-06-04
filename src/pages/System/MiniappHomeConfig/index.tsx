import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Checkbox, Col, Form, Input, message, Modal, Row, Select, Space, Tabs, Tag, Typography, Upload } from 'antd';
import { DeleteOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import {
  getMiniappHomeConfig,
  getMiniappHomePublishedConfig,
  getCouponTemplates,
  listMiniappAnnouncementOptions,
  listMiniappHomeProductCandidates,
  listMiniappHomeStaffCandidates,
  MiniappHomeConfig,
  publishMiniappHomeConfig,
  upsertMiniappHomeConfig,
} from '@/services/api';
import { uploadFileToCosBySts } from '@/utils/cosUpload';

const { Text } = Typography;

const emptyConfig: MiniappHomeConfig = {
  banners: [],
  hotSales: [],
  limitedBenefits: [],
  recommendedStaff: [],
  hotEvents: [],
  quickEntries: [],
  esportsGoods: [],
};

const moduleMeta: Array<{ key: keyof MiniappHomeConfig; title: string; tip: string }> = [
  { key: 'banners', title: 'Banner推荐位', tip: '支持跳转商品详情/页面链接' },
  { key: 'hotSales', title: '热销推荐', tip: '首页热销卡片' },
  { key: 'limitedBenefits', title: '限时福利', tip: '时效活动条目' },
  { key: 'recommendedStaff', title: '推荐陪玩师', tip: '可选员工+陪玩权限候选' },
  { key: 'hotEvents', title: '热门赛事', tip: '跳转富文本详情' },
  { key: 'quickEntries', title: '快捷功能', tip: '图标/名称/描述/配色/跳转' },
  { key: 'esportsGoods', title: '电竞周边', tip: '商品入口' },
];

const moduleFields: Record<keyof MiniappHomeConfig, Array<{ key: string; label: string; placeholder?: string }>> = {
  banners: [
    { key: 'coverImage', label: '封面图' },
    { key: 'title', label: '标题' },
    { key: 'subtitle', label: '副标题' },
    { key: 'tag', label: '标签' },
    { key: 'icon', label: 'ICON', placeholder: 'solar:cup-star-bold' },
    { key: 'actionText', label: '按钮文案' },
    { key: 'targetType', label: '跳转类型' },
    { key: 'targetValue', label: '跳转值' },
  ],
  hotSales: [
    { key: 'title', label: '标题' },
    { key: 'score', label: '评分' },
    { key: 'sold', label: '销量' },
    { key: 'price', label: '现价' },
    { key: 'originPrice', label: '原价' },
    { key: 'icon', label: 'ICON' },
    { key: 'targetType', label: '跳转类型' },
    { key: 'targetValue', label: '跳转值' },
  ],
  limitedBenefits: [
    { key: 'title', label: '标题' },
    { key: 'badge', label: '角标' },
    { key: 'desc', label: '描述1' },
    { key: 'subDesc', label: '描述2' },
    { key: 'activityType', label: '活动类型' },
    { key: 'startAt', label: '开始时间' },
    { key: 'durationHours', label: '有效时长(小时)' },
    { key: 'couponTemplateId', label: '优惠券模板' },
    { key: 'discountOriginPrice', label: '划线价' },
    { key: 'icon', label: 'ICON' },
    { key: 'actionText', label: '按钮文案' },
    { key: 'targetType', label: '跳转类型' },
    { key: 'targetValue', label: '跳转值' },
  ],
  recommendedStaff: [
    { key: 'id', label: '陪玩师ID' },
    { key: 'labelA', label: '标签A' },
    { key: 'labelB', label: '标签B' },
    { key: 'score', label: '评分' },
    { key: 'orderCount', label: '接单量' },
    { key: 'priceText', label: '价格文案' },
    { key: 'targetType', label: '跳转类型' },
    { key: 'targetValue', label: '跳转值' },
  ],
  hotEvents: [
    { key: 'title', label: '标题' },
    { key: 'emoji', label: 'Emoji' },
    { key: 'timeText', label: '时间文案' },
    { key: 'prize', label: '奖励文案' },
    { key: 'actionText', label: '按钮文案' },
    { key: 'stats', label: '统计文案' },
    { key: 'targetType', label: '跳转类型' },
    { key: 'targetValue', label: '跳转值' },
  ],
  quickEntries: [
    { key: 'title', label: '名称' },
    { key: 'desc', label: '描述' },
    { key: 'icon', label: 'ICON' },
    { key: 'iconColor', label: 'ICON颜色' },
    { key: 'bgColor', label: '背景色' },
    { key: 'tone', label: '色调key' },
    { key: 'targetType', label: '跳转类型' },
    { key: 'targetValue', label: '跳转值' },
  ],
  esportsGoods: [
    { key: 'title', label: '标题' },
    { key: 'price', label: '现价' },
    { key: 'originPrice', label: '原价' },
    { key: 'targetType', label: '跳转类型' },
    { key: 'targetValue', label: '跳转值' },
  ],
};

const MiniappHomeConfigPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<MiniappHomeConfig>(emptyConfig);
  const [activeKey, setActiveKey] = useState<keyof MiniappHomeConfig>('banners');
  const [currentList, setCurrentList] = useState<any[]>([]);
  const [publishedConfig, setPublishedConfig] = useState<MiniappHomeConfig>(emptyConfig);
  const [staffCandidates, setStaffCandidates] = useState<any[]>([]);
  const [staffKeyword, setStaffKeyword] = useState('');
  const [productCandidates, setProductCandidates] = useState<any[]>([]);
  const [productKeyword, setProductKeyword] = useState('');
  const [announcementOptions, setAnnouncementOptions] = useState<Array<{ id: number; title: string; audience: 'ALL' | 'APPLET' | 'ADMIN' }>>([]);
  const [couponTemplateOptions, setCouponTemplateOptions] = useState<Array<{ id: number; name: string; type?: string }>>([]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [uploadingBannerCover, setUploadingBannerCover] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [itemForm] = Form.useForm();
  const currentTargetType = Form.useWatch('targetType', itemForm);
  const currentActivityType = Form.useWatch('activityType', itemForm);

  const activeMeta = useMemo(() => moduleMeta.find((m) => m.key === activeKey)!, [activeKey]);

  const syncCurrentList = (list: any[]) => {
    setCurrentList(list);
    setConfig((prev) => ({ ...prev, [activeKey]: list }));
  };

  const loadProductCandidates = async (params?: { keyword?: string }) => {
    const rows = await listMiniappHomeProductCandidates({
      keyword: params?.keyword || undefined,
    });
    setProductCandidates(Array.isArray(rows) ? rows : []);
  };

  const reload = async () => {
    setLoading(true);
    try {
      const [cfg, candidates, published, announcements, couponTemplates] = await Promise.all([
        getMiniappHomeConfig(),
        listMiniappHomeStaffCandidates(staffKeyword || undefined),
        getMiniappHomePublishedConfig(),
        listMiniappAnnouncementOptions(),
        getCouponTemplates({ page: 1, limit: 200, status: 'ACTIVE' }),
      ]);
      const next = { ...emptyConfig, ...(cfg || {}) };
      setConfig(next);
      setCurrentList(Array.isArray(next[activeKey]) ? next[activeKey] : []);
      setStaffCandidates(Array.isArray(candidates) ? candidates : []);
      const products = await listMiniappHomeProductCandidates({
        keyword: productKeyword || undefined,
      });
      setProductCandidates(Array.isArray(products) ? products : []);
      setAnnouncementOptions(Array.isArray(announcements) ? announcements : []);
      setCouponTemplateOptions(Array.isArray(couponTemplates?.data) ? couponTemplates.data : []);
      setPublishedConfig({ ...emptyConfig, ...(published || {}) });
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    setCurrentList(Array.isArray(config[activeKey]) ? config[activeKey] : []);
  }, [activeKey, config]);

  const validateConfig = (cfg: MiniappHomeConfig): { ok: boolean; message?: string } => {
    const requiredMap: Record<keyof MiniappHomeConfig, string[]> = {
      banners: ['name', 'coverImage', 'title', 'targetType', 'targetValue'],
      hotSales: ['name', 'title', 'price', 'targetType', 'targetValue'],
      limitedBenefits: ['name', 'title', 'activityType', 'startAt', 'targetType', 'targetValue'],
      recommendedStaff: ['id', 'name', 'targetType', 'targetValue'],
      hotEvents: ['name', 'title', 'targetType', 'targetValue'],
      quickEntries: ['name', 'title', 'icon', 'targetType', 'targetValue'],
      esportsGoods: ['name', 'title', 'price', 'targetType', 'targetValue'],
    };
    for (const m of moduleMeta) {
      const arr = (cfg[m.key] || []) as any[];
      for (let i = 0; i < arr.length; i += 1) {
        const item = arr[i] || {};
        for (const k of requiredMap[m.key]) {
          const v = item?.[k];
          if (v === undefined || v === null || String(v).trim() === '') {
            return { ok: false, message: `${m.title} 第${i + 1}项缺少必填字段：${k}` };
          }
        }
        if (m.key === 'limitedBenefits') {
          const activityType = String(item?.activityType || '');
          const durationText = String(item?.durationHours ?? '').trim();
          const durationHours = Number(item?.durationHours);
          const isLongTerm = item?.isLongTerm === true || !durationText;
          if (activityType === 'coupon' && String(item?.targetType || '') !== 'coupon') {
            return { ok: false, message: `${m.title} 第${i + 1}项：优惠券活动跳转类型必须为coupon` };
          }
          if (activityType === 'discount' && String(item?.targetType || '') !== 'product') {
            return { ok: false, message: `${m.title} 第${i + 1}项：折扣活动跳转类型必须为product` };
          }
          if (!isLongTerm && (!Number.isFinite(durationHours) || durationHours <= 0)) {
            return { ok: false, message: `${m.title} 第${i + 1}项：有效时长需为空(长期)或大于0` };
          }
          if (activityType === 'coupon' && !String(item?.couponTemplateId || item?.targetValue || '').trim()) {
            return { ok: false, message: `${m.title} 第${i + 1}项：优惠券活动必须关联优惠券模板` };
          }
          if (activityType === 'discount' && Number(item?.discountOriginPrice) <= 0) {
            return { ok: false, message: `${m.title} 第${i + 1}项：折扣活动划线价必须大于0` };
          }
        }
      }
    }
    return { ok: true };
  };

  const saveAll = async () => {
    const finalConfig = { ...config, [activeKey]: currentList };
    const valid = validateConfig(finalConfig);
    if (!valid.ok) {
      message.error(valid.message);
      return;
    }
    setSaving(true);
    try {
      await upsertMiniappHomeConfig(finalConfig);
      message.success('首页配置已保存');
      await reload();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setEditingIndex(null);
    itemForm.resetFields();
    itemForm.setFieldsValue({ targetType: 'page', targetValue: undefined });
    setEditorVisible(true);
  };

  const openEdit = (idx: number) => {
    setEditingIndex(idx);
    itemForm.setFieldsValue(currentList[idx] || {});
    setEditorVisible(true);
  };

  const saveItem = async () => {
    const values = await itemForm.validateFields();
    const fail = (msg: string) => {
      message.error(msg);
      throw new Error(msg);
    };

    // 单项保存前置校验（按模块）
    if (!String(values?.name || '').trim()) fail('名称(name)必填');
    if (!String(values?.targetType || '').trim()) fail('跳转类型必填');
    if (!String(values?.targetValue || '').trim()) fail('跳转值必填');

    if (activeKey === 'banners') {
      if (!String(values?.coverImage || '').trim()) fail('Banner封面图必填');
      if (!String(values?.title || '').trim()) fail('Banner标题必填');
    }

    if (activeKey === 'hotSales') {
      if (!String(values?.title || '').trim()) fail('热销标题必填');
      if (Number(values?.price) <= 0) fail('热销现价必须大于0');
    }

    if (activeKey === 'esportsGoods') {
      if (!String(values?.title || '').trim()) fail('电竞周边标题必填');
      if (Number(values?.price) <= 0) fail('电竞周边现价必须大于0');
    }

    if (activeKey === 'limitedBenefits') {
      const activityType = String(values?.activityType || '').trim();
      const durationText = String(values?.durationHours ?? '').trim();
      const durationHours = Number(values?.durationHours);
      const isLongTerm = values?.isLongTerm === true || !durationText;
      if (!activityType) fail('限时福利活动类型必填');
      if (!String(values?.startAt || '').trim()) fail('限时福利开始时间必填');
      if (!isLongTerm && (!Number.isFinite(durationHours) || durationHours <= 0)) fail('限时福利有效时长需为空(长期)或大于0');
      if (activityType === 'coupon') {
        if (String(values?.targetType || '') !== 'coupon') fail('优惠券活动的跳转类型必须为优惠券');
        if (!String(values?.couponTemplateId || values?.targetValue || '').trim()) fail('优惠券活动必须关联优惠券模板');
      }
      if (activityType === 'discount') {
        if (String(values?.targetType || '') !== 'product') fail('折扣活动的跳转类型必须为商品');
        if (Number(values?.discountOriginPrice) <= 0) fail('折扣活动必须填写有效划线价');
      }
      if (isLongTerm) {
        values.durationHours = undefined;
      } else {
        values.durationHours = durationHours;
      }
      values.isLongTerm = isLongTerm;
    }

    const next = [...currentList];
    if (editingIndex === null) next.push(values);
    else next[editingIndex] = values;
    syncCurrentList(next);
    setEditorVisible(false);
  };

  const addProductToHotSales = (p: any) => {
    const productId = String(p?.id || '');
    if (!productId) return;
    const exists = (currentList || []).some((x) => String(x?.targetType) === 'product' && String(x?.targetValue) === productId);
    if (exists) {
      message.info('该商品已在热销推荐列表');
      return;
    }
    const price = Number(p?.price || 0);
    syncCurrentList([
      ...(currentList || []),
      {
        name: p?.name || `热销商品${productId}`,
        title: p?.name || `热销商品${productId}`,
        score: '5.0',
        sold: '100+',
        price: price > 0 ? price.toFixed(2) : '0.00',
        originPrice: price > 0 ? (price * 1.2).toFixed(2) : '0.00',
        icon: 'solar:gamepad-old-bold',
        targetType: 'product',
        targetValue: productId,
      },
    ]);
  };

  const canAddCurrentProduct = (p: any) => {
    const productId = String(p?.id || '');
    if (!productId) return false;
    return !(currentList || []).some((x) => String(x?.targetType) === 'product' && String(x?.targetValue) === productId);
  };

  const hasValidCover = (p: any) => !!String(p?.coverImage || '').trim();

  return (
    <>
      <Row gutter={16}>
        <Col span={14}>
          <Card
            title="小程序功能配置 / 首页配置"
            extra={(
              <Space>
                <Button onClick={reload} loading={loading}>刷新</Button>
                <Button type="primary" onClick={saveAll} loading={saving}>保存草稿</Button>
                <Button
                  loading={saving}
                  onClick={async () => {
                    const finalConfig = { ...config, [activeKey]: currentList };
                    const ok = validateConfig(finalConfig);
                    if (!ok.ok) {
                      message.error(ok.message);
                      return;
                    }
                    setSaving(true);
                    try {
                      await upsertMiniappHomeConfig(finalConfig);
                      await publishMiniappHomeConfig();
                      message.success('已保存并发布到线上');
                      await reload();
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  保存并发布
                </Button>
              </Space>
            )}
          >
            <Tabs
              activeKey={activeKey}
              onChange={(k) => setActiveKey(k as keyof MiniappHomeConfig)}
              items={moduleMeta.map((m) => ({ key: m.key, label: m.title }))}
            />

            <Space direction="vertical" style={{ width: '100%' }} size={10}>
              <Text type="secondary">{activeMeta.tip}</Text>
              <Button icon={<PlusOutlined />} type="primary" onClick={openCreate}>新增一项</Button>
              {currentList.map((row, idx) => (
                <Card
                  size="small"
                  key={`${activeKey}-${idx}`}
                  title={`${row?.name || row?.title || activeMeta.title} #${idx + 1}`}
                  extra={(
                    <Space>
                      <Button size="small" onClick={() => openEdit(idx)}>编辑</Button>
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => syncCurrentList(currentList.filter((_, i) => i !== idx))}
                      >
                        删除
                      </Button>
                    </Space>
                  )}
                >
                  {activeKey === 'hotSales' ? (
                    <Row gutter={[8, 8]}>
                      <Col span={24}>
                        <Text strong>{row?.title || '-'}</Text>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">现价：</Text>
                        <Text>¥{String(row?.price ?? '-')}</Text>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">原价：</Text>
                        <Text>¥{String(row?.originPrice ?? '-')}</Text>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">评分：</Text>
                        <Text>{String(row?.score ?? '-')}</Text>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">销量：</Text>
                        <Text>{String(row?.sold ?? '-')}</Text>
                      </Col>
                      <Col span={24}>
                        <Tag color="blue">商品ID #{String(row?.targetValue ?? '-')}</Tag>
                      </Col>
                    </Row>
                  ) : (
                    <Row gutter={8}>
                      {moduleFields[activeKey].map((f) => (
                        <Col span={12} key={f.key} style={{ marginBottom: 6 }}>
                          <Text type="secondary">{f.label}：</Text>
                          {f.key === 'coverImage' && row?.[f.key] ? (
                            <div>
                              <img src={String(row?.[f.key])} alt="banner-cover" style={{ width: 140, height: 56, objectFit: 'cover', borderRadius: 4 }} />
                            </div>
                          ) : (
                            <div>{String(row?.[f.key] ?? '-')}</div>
                          )}
                        </Col>
                      ))}
                    </Row>
                  )}
                </Card>
              ))}

              {activeKey === 'recommendedStaff' && (
                <Card size="small" title="陪玩师候选（员工+陪玩权限）">
                  <Space style={{ marginBottom: 10 }}>
                    <Input
                      placeholder="按姓名/手机号筛选候选"
                      value={staffKeyword}
                      onChange={(e) => setStaffKeyword(e.target.value)}
                      style={{ width: 240 }}
                    />
                    <Button onClick={() => reload()}>查询</Button>
                  </Space>
                  <Space wrap>
                    {staffCandidates.map((s) => (
                      <Tag
                        key={s.id}
                        onClick={() => {
                          const exists = (currentList || []).some((x) => String(x?.id) === String(s?.id));
                          if (exists) {
                            message.info('该陪玩师已在推荐列表');
                            return;
                          }
                          syncCurrentList([
                            ...(currentList || []),
                            {
                              id: s.id,
                              name: s.name || s.phone || `用户${s.id}`,
                              labelA: s?.staffRating?.name || '陪玩师',
                              labelB: s?.workStatus || 'IDLE',
                              score: '5.0',
                              orderCount: '0',
                              priceText: '--',
                              targetType: 'page',
                              targetValue: `/pages/coach-details/index?id=${s.id}`,
                            },
                          ]);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {s.name || s.phone}#{s.id}
                      </Tag>
                    ))}
                  </Space>
                </Card>
              )}

              {activeKey === 'hotSales' && (
                <Card size="small" title="热销商品候选（商品管理列表）">
                  <Space style={{ marginBottom: 10 }}>
                    <Input
                      placeholder="按商品名筛选候选"
                      value={productKeyword}
                      onChange={(e) => setProductKeyword(e.target.value)}
                      style={{ width: 240 }}
                    />
                    <Button onClick={() => loadProductCandidates({ keyword: productKeyword || undefined })}>查询</Button>
                  </Space>
                  <Row gutter={[10, 10]}>
                    {productCandidates.map((p) => {
                      const canAdd = canAddCurrentProduct(p);
                      const coverOk = hasValidCover(p);
                      const disabled = !coverOk || !canAdd;
                      return (
                        <Col span={12} key={p.id}>
                          <Card
                            size="small"
                            bodyStyle={{ padding: 10 }}
                            style={{ borderRadius: 8, borderColor: disabled ? '#d9d9d9' : undefined, opacity: disabled ? 0.65 : 1 }}
                            actions={[
                              <Button
                                key="add"
                                type={!disabled ? 'primary' : 'default'}
                                size="small"
                                disabled={disabled}
                                onClick={() => {
                                  if (!coverOk) {
                                    message.warning('内容不完善：缺少封面图，无法加入热销');
                                    return;
                                  }
                                  addProductToHotSales(p);
                                }}
                              >
                                {!coverOk ? '内容不完善' : canAdd ? '加入热销' : '已添加'}
                              </Button>,
                            ]}
                          >
                            <Space direction="vertical" size={6} style={{ width: '100%' }}>
                              <img
                                src={coverOk ? String(p.coverImage) : 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22240%22 height=%2290%22 viewBox=%220 0 240 90%22%3E%3Crect width=%22240%22 height=%2290%22 fill=%22%23f5f5f5%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2212%22%3E无封面图%3C/text%3E%3C/svg%3E'}
                                alt="product-cover"
                                style={{ width: '100%', height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid #f0f0f0' }}
                              />
                              <Text strong ellipsis={{ tooltip: p?.name || '-' }}>{p?.name || '-'}</Text>
                              <Space size={6}>
                                <Tag color="gold">¥{p?.price != null ? p.price : '--'}</Tag>
                                {!coverOk ? <Tag color="red">内容不完善</Tag> : null}
                              </Space>
                            </Space>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                </Card>
              )}
            </Space>
          </Card>
        </Col>

        <Col span={10}>
          <Card title="首页预览（草稿）" style={{ position: 'sticky', top: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {moduleMeta.map((m) => {
                const arr = (config[m.key] || []) as any[];
                if (!arr.length) return null;
                return (
                  <Card key={m.key} size="small" title={m.title} bodyStyle={{ paddingTop: 8, paddingBottom: 8 }}>
                    <Text type="secondary">共 {arr.length} 项</Text>
                  </Card>
                );
              })}
            </Space>
          </Card>

          <Card title="当前发布版（结构）" style={{ marginTop: 12 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {moduleMeta.map((m) => {
                const arr = (publishedConfig[m.key] || []) as any[];
                if (!arr.length) return null;
                return (
                  <Card key={`published-${m.key}`} size="small" title={m.title} bodyStyle={{ paddingTop: 8, paddingBottom: 8 }}>
                    <Text type="secondary">共 {arr.length} 项</Text>
                  </Card>
                );
              })}
            </Space>
          </Card>
        </Col>
      </Row>

      <Modal
        title={`${editingIndex === null ? '新增' : '编辑'}${activeMeta.title}项`}
        open={editorVisible}
        onCancel={() => setEditorVisible(false)}
        onOk={saveItem}
        width={760}
      >
        <Form form={itemForm} layout="vertical">
          {activeKey === 'banners' && (
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">封面图建议比例 5:2，推荐尺寸 1500 × 600（至少 750 × 300），避免文字与主体被裁切。</Text>
            </div>
          )}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="name" label="名称(name)" rules={[{ required: true, message: '请输入名称' }]}>
                <Input placeholder="用于后台识别的名称" />
              </Form.Item>
            </Col>
            {moduleFields[activeKey].map((f) => (
              <Col span={12} key={f.key}>
                <Form.Item name={f.key} label={f.label}>
                  {f.key === 'targetType' ? (
                    <Select
                      onChange={async (val) => {
                        if (val === 'product') {
                          itemForm.setFieldValue('targetValue', undefined);
                          await loadProductCandidates();
                        }
                      }}
                      options={[
                        { label: '页面', value: 'page' },
                        { label: '商品', value: 'product' },
                        { label: '优惠券', value: 'coupon' },
                        { label: '通知公告', value: 'announcement' },
                        { label: '链接', value: 'link' },
                        { label: '项目', value: 'project' },
                      ]}
                    />
                  ) : activeKey === 'limitedBenefits' && f.key === 'activityType' ? (
                    <Select
                      options={[
                        { label: '优惠券活动', value: 'coupon' },
                        { label: '折扣活动', value: 'discount' },
                      ]}
                      onChange={(val) => {
                        if (val === 'coupon') itemForm.setFieldsValue({ targetType: 'coupon', actionText: itemForm.getFieldValue('actionText') || '立即领取' });
                        if (val === 'discount') itemForm.setFieldsValue({ targetType: 'product', actionText: itemForm.getFieldValue('actionText') || '立即抢' });
                      }}
                    />
                  ) : activeKey === 'limitedBenefits' && f.key === 'startAt' ? (
                    <Input type="datetime-local" />
                  ) : activeKey === 'limitedBenefits' && f.key === 'durationHours' ? (
                    <Input type="number" disabled={itemForm.getFieldValue('isLongTerm') === true} placeholder={itemForm.getFieldValue('isLongTerm') === true ? '已设为长期有效' : '为空表示长期，例如：24'} />
                  ) : activeKey === 'limitedBenefits' && f.key === 'couponTemplateId' ? (
                    <Select
                      showSearch
                      optionFilterProp="label"
                      disabled={currentActivityType !== 'coupon'}
                      placeholder={currentActivityType === 'coupon' ? '选择优惠券模板' : '仅优惠券活动可选'}
                      options={couponTemplateOptions.map((x) => ({ value: String(x.id), label: `${x.name} #${x.id}` }))}
                      onChange={(v) => {
                        const found = couponTemplateOptions.find((x) => String(x.id) === String(v));
                        if (!found) return;
                        itemForm.setFieldsValue({ targetType: 'coupon', targetValue: String(found.id), title: itemForm.getFieldValue('title') || found.name, name: itemForm.getFieldValue('name') || found.name });
                      }}
                    />
                  ) : activeKey === 'limitedBenefits' && f.key === 'discountOriginPrice' ? (
                    <Input type="number" disabled={currentActivityType !== 'discount'} placeholder={currentActivityType === 'discount' ? '填写划线价' : '仅折扣活动可填'} />
                  ) : f.key === 'targetValue' && currentTargetType === 'coupon' ? (
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="选择优惠券模板"
                      options={couponTemplateOptions.map((x) => ({ value: String(x.id), label: `${x.name} #${x.id}` }))}
                    />
                  ) : f.key === 'targetValue' && currentTargetType === 'product' ? (
                    <Select
                      showSearch
                      filterOption={false}
                      placeholder="请选择商品"
                      onSearch={async (v) => await loadProductCandidates({ keyword: v || undefined })}
                      onChange={(v) => {
                        const found = (productCandidates || []).find((p) => String(p?.id) === String(v));
                        if (!found) return;
                        const price = Number(found?.price || 0);
                        if (activeKey === 'hotSales') {
                          itemForm.setFieldsValue({
                            targetType: 'product',
                            targetValue: String(found.id),
                            title: itemForm.getFieldValue('title') || found.name,
                            name: itemForm.getFieldValue('name') || found.name,
                            price: itemForm.getFieldValue('price') || (price > 0 ? price.toFixed(2) : '0.00'),
                            originPrice: itemForm.getFieldValue('originPrice') || (price > 0 ? (price * 1.2).toFixed(2) : '0.00'),
                            icon: itemForm.getFieldValue('icon') || 'solar:gamepad-old-bold',
                          });
                        } else if (activeKey === 'limitedBenefits' && currentActivityType === 'discount') {
                          itemForm.setFieldsValue({
                            targetType: 'product',
                            targetValue: String(found.id),
                            title: itemForm.getFieldValue('title') || found.name,
                            name: itemForm.getFieldValue('name') || found.name,
                            discountOriginPrice: itemForm.getFieldValue('discountOriginPrice') || (price > 0 ? (price * 1.2).toFixed(2) : '0.00'),
                          });
                        }
                      }}
                      options={(productCandidates || []).map((p) => ({ label: `${p?.name || '-'} #${p?.id} ${p?.price != null ? `¥${p?.price}` : ''}`, value: String(p?.id) }))}
                    />
                  ) : f.key === 'targetValue' && currentTargetType === 'announcement' ? (
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="请选择系统公告（全平台/小程序）"
                      options={(announcementOptions || []).map((a) => ({
                        label: `[${a?.audience}] ${a?.title || '-'} #${a?.id}`,
                        value: String(a?.id),
                      }))}
                    />
                  ) : f.key === 'coverImage' && activeKey === 'banners' ? (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Upload
                        showUploadList={false}
                        customRequest={async (options: any) => {
                          try {
                            setUploadingBannerCover(true);
                            const file = options.file as File;
                            const res = await uploadFileToCosBySts({
                              module: 'miniapp-home',
                              scene: 'cover',
                              file,
                            });
                            itemForm.setFieldValue('coverImage', res.url);
                            message.success('Banner封面上传成功');
                            options.onSuccess?.({}, file);
                          } catch (e: any) {
                            message.error(e?.message || 'Banner封面上传失败');
                            options.onError?.(e);
                          } finally {
                            setUploadingBannerCover(false);
                          }
                        }}
                      >
                        <Button icon={<UploadOutlined />} loading={uploadingBannerCover}>上传Banner封面</Button>
                      </Upload>
                      {itemForm.getFieldValue('coverImage') ? (
                        <img
                          src={String(itemForm.getFieldValue('coverImage'))}
                          alt="banner-cover-preview"
                          style={{ width: 220, height: 88, objectFit: 'cover', borderRadius: 4 }}
                        />
                      ) : null}
                    </Space>
                  ) : (
                    <Input placeholder={f.placeholder || f.label} />
                  )}
                </Form.Item>
              </Col>
            ))}
            {activeKey === 'banners' && currentTargetType === 'announcement' ? (
              <Col span={12}>
                <Form.Item label="关联通知公告（快捷设置）">
                  <Select
                    showSearch
                    allowClear
                    optionFilterProp="label"
                    placeholder="选择通知公告"
                    options={(announcementOptions || []).map((a) => ({
                      label: `[${a?.audience}] ${a?.title || '-'} #${a?.id}`,
                      value: String(a?.id),
                    }))}
                    onChange={(v) => {
                      if (!v) return;
                      const found = (announcementOptions || []).find((a) => String(a?.id) === String(v));
                      if (!found) return;
                      itemForm.setFieldsValue({
                        targetType: 'announcement',
                        targetValue: String(found.id),
                        title: itemForm.getFieldValue('title') || found.title,
                        name: itemForm.getFieldValue('name') || found.title,
                        actionText: itemForm.getFieldValue('actionText') || '查看公告',
                      });
                    }}
                  />
                </Form.Item>
              </Col>
            ) : null}
            {activeKey === 'limitedBenefits' ? (
              <Col span={12}>
                <Form.Item name="isLongTerm" label="长期有效" valuePropName="checked">
                  <Checkbox
                    onChange={(e) => {
                      const checked = e?.target?.checked === true;
                      if (checked) {
                        itemForm.setFieldValue('durationHours', undefined);
                      }
                    }}
                  >
                    不设置截止时间
                  </Checkbox>
                </Form.Item>
              </Col>
            ) : null}
          </Row>
        </Form>
      </Modal>
    </>
  );
};

export default MiniappHomeConfigPage;
