import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Carousel, Empty, Image, Modal, Skeleton, Space, Tag, Typography, message } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { getPublicMenuDetail, getPublicMiniappHomeConfig, postPublicMenuList, type PublicMenuDetail, type PublicMenuItem, type MiniappHomeConfig } from '@/services/api';
import './index.less';

const { Text, Title, Paragraph } = Typography;
const PAGE_SIZE = 8;
const PLACEHOLDER_IMAGE = '/menu-placeholder.png';

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function labelOrDefault(value: unknown, fallback: string) {
  const text = normalizeText(value);
  return text || fallback;
}

function FilterTuneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9">
        <path d="M4 6.5h10" />
        <path d="M15 6.5h5" />
        <path d="M4 12h5" />
        <path d="M10.5 12h10.5" />
        <path d="M4 17.5h13" />
        <path d="M18 17.5h2" />
      </g>
      <g fill="currentColor">
        <circle cx="15" cy="6.5" r="1.8" />
        <circle cx="10.5" cy="12" r="1.8" />
        <circle cx="18" cy="17.5" r="1.8" />
      </g>
    </svg>
  );
}

export default function PublicMenuGalleryPage() {
  const [items, setItems] = useState<PublicMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [sortMode, setSortMode] = useState<'default' | 'new' | 'price-asc' | 'price-desc'>('default');
  const [priceRange, setPriceRange] = useState<'all' | '0-50' | '50-100' | '100+'>('all');
  const [homeConfigLoading, setHomeConfigLoading] = useState(true);
  const [homeConfig, setHomeConfig] = useState<MiniappHomeConfig | null>(null);
  const [filters, setFilters] = useState<{
    gameTypes: string[];
    projectTypes: string[];
    categories: string[];
    categoryOptions: Array<{ key: string; label: string }>;
  }>({
    gameTypes: [],
    projectTypes: [],
    categories: [],
    categoryOptions: [],
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState<PublicMenuDetail | PublicMenuItem | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const loadHomeConfig = useCallback(async () => {
    setHomeConfigLoading(true);
    try {
      const res: any = await getPublicMiniappHomeConfig();
      const next = (res && typeof res === 'object' && 'data' in res ? (res as any).data : res) || {};
      setHomeConfig(next as MiniappHomeConfig);
    } catch {
      setHomeConfig(null);
    } finally {
      setHomeConfigLoading(false);
    }
  }, []);

  const openProductPreview = useCallback(async (item: PublicMenuItem | null | undefined, productId?: number) => {
    const targetId = Number(productId || item?.id || 0);
    if (!Number.isFinite(targetId) || targetId <= 0) return;

    setPreviewItem(item || null);
    setPreviewOpen(true);
    setPreviewLoading(true);

    try {
      const detail = await getPublicMenuDetail(targetId);
      if (detail) {
        setPreviewItem(detail);
      }
    } catch {
      if (item) setPreviewItem(item);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const loadPage = useCallback(async (targetPage: number, reset = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      const res: any = await postPublicMenuList({
        page: targetPage,
        limit: PAGE_SIZE,
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
      });
      const list = Array.isArray(res?.list) ? (res.list as PublicMenuItem[]) : [];
      setItems((prev) => (reset ? list : [...prev, ...list]));
      setFilters({
        gameTypes: Array.isArray(res?.filters?.gameTypes) ? res.filters.gameTypes : [],
        projectTypes: Array.isArray(res?.filters?.projectTypes) ? res.filters.projectTypes : [],
        categories: Array.isArray(res?.filters?.categories) ? res.filters.categories : [],
        categoryOptions: Array.isArray(res?.filters?.categoryOptions) ? res.filters.categoryOptions : [],
      });
      setPage(Number(res?.page || targetPage));
      setHasMore(Boolean(res?.hasMore));
    } catch (error: any) {
      if (reset) {
        message.error(error?.message || '商品加载失败');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    document.title = '蓝猫爽打-服务图层';
  }, []);

  useEffect(() => {
    void loadHomeConfig();
    setItems([]);
    setPage(1);
    setHasMore(false);
    void loadPage(1, true);
  }, [loadHomeConfig, loadPage, selectedCategory]);

  const categoryGroups = useMemo(
    () => [{ key: 'ALL', label: '全部' }, ...filters.categoryOptions],
    [filters.categoryOptions],
  );

  const visibleItems = useMemo(() => {
    const list = [...items];

    const filtered = list.filter((item) => {
      const price = Number(item.price || 0);
      if (priceRange === '0-50') return price >= 0 && price < 50;
      if (priceRange === '50-100') return price >= 50 && price < 100;
      if (priceRange === '100+') return price >= 100;
      return true;
    });

    if (sortMode === 'default') {
      return filtered;
    }

    filtered.sort((a, b) => {
      const pa = Number(a.price || 0);
      const pb = Number(b.price || 0);
      if (sortMode === 'price-asc') return pa - pb;
      if (sortMode === 'price-desc') return pb - pa;
      return Number(b.id || 0) - Number(a.id || 0);
    });

    return filtered;
  }, [items, priceRange, sortMode]);

  const leftColumnItems = useMemo(
    () => visibleItems.filter((_, index) => index % 2 === 0),
    [visibleItems],
  );

  const rightColumnItems = useMemo(
    () => visibleItems.filter((_, index) => index % 2 === 1),
    [visibleItems],
  );

  const hasActiveFilter = selectedCategory !== 'ALL' || sortMode !== 'default' || priceRange !== 'all';

  const bannerItem = useMemo(() => {
    const banners = Array.isArray(homeConfig?.banners) ? homeConfig.banners : [];
    const normalized = banners
      .map((banner: any) => ({
        ...banner,
        targetType: String(banner?.targetType || '').trim(),
        targetValue: String(banner?.targetValue || '').trim(),
        coverImage: String(banner?.coverImage || '').trim(),
      }))
      .filter((banner: any) => banner.coverImage);
    return normalized.filter((banner: any) => ['product', 'project'].includes(banner.targetType) && banner.targetValue);
  }, [homeConfig]);

  useEffect(() => {
    if (!hasMore || loadingMore) return undefined;
    const target = loadMoreRef.current;
    if (!target) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || loading || loadingMore || !hasMore) return;
        void loadPage(page + 1, false);
      },
      {
        root: null,
        rootMargin: '200px 0px',
        threshold: 0.01,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadPage, loading, loadingMore, page]);

  const getItemHeight = (id?: number) => {
    const heights = [220, 240, 205, 250, 225, 235, 215, 245, 260, 200, 230, 210];
    const idx = Math.abs(Number(id || 0)) % heights.length;
    return heights[idx] || 180;
  };

  return (
    <div className="public-menu-gallery-page">
      <div className="gallery-shell">
        <div className="gallery-body">
          <main className="gallery-main">
            <div className="gallery-filter-sticky">
              <div className="gallery-filter-topline">
                <div className="gallery-filter-scroll hide-scrollbar">
                  {categoryGroups.map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      className={`gallery-filter-chip ${selectedCategory === group.key ? 'is-active' : ''}`}
                      onClick={() => setSelectedCategory(group.key)}
                    >
                      <span className="gallery-filter-chip-label">{group.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`gallery-filter-icon ${hasActiveFilter ? 'is-active' : ''}`}
                  onClick={() => setFilterPanelOpen(true)}
                >
                  <FilterTuneIcon />
                </button>
              </div>
            </div>

            {homeConfigLoading && !bannerItem.length ? <div className="gallery-notice-banner-skeleton" /> : null}

            {bannerItem.length ? (
              <div className="gallery-notice-banner">
                <Carousel
                  dots={false}
                  autoplay
                  autoplaySpeed={4000}
                  infinite={bannerItem.length > 1}
                  draggable
                  swipe
                  className="gallery-notice-carousel"
                >
                  {bannerItem.map((banner: any, index: number) => (
                    <div key={`${banner.targetType}-${banner.targetValue}-${index}`}>
                      <button
                        type="button"
                        className="gallery-notice-banner-slide"
                        onClick={() => void openProductPreview({
                          id: Number(banner.targetValue),
                          name: banner.title || '下单须知',
                          price: 0,
                          coverImage: banner.coverImage,
                          description: banner.subtitle || '',
                        } as PublicMenuItem, Number(banner.targetValue))}
                      >
                        <img
                          className="gallery-notice-banner-image"
                          src={banner.coverImage || PLACEHOLDER_IMAGE}
                          alt={banner.title || '下单须知'}
                          loading="lazy"
                          onError={(event) => {
                            const target = event.currentTarget;
                              if (target.src !== PLACEHOLDER_IMAGE) target.src = PLACEHOLDER_IMAGE;
                            }}
                        />
                        <div className="gallery-notice-banner-overlay">
                          <div className="gallery-notice-banner-title">{banner.title || '必看说明'}</div>
                        </div>
                      </button>
                    </div>
                  ))}
                </Carousel>
              </div>
            ) : null}

            {loading ? (
              <div className="gallery-skeleton-grid" aria-hidden="true">
                {Array.from({ length: 2 }).map((_, columnIndex) => (
                  <div className="gallery-skeleton-column" key={columnIndex}>
                    {Array.from({ length: 2 }).map((__, idx) => (
                      <div className="gallery-skeleton-card" key={`${columnIndex}-${idx}`}>
                        <Skeleton active title={false} paragraph={{ rows: 0 }} />
                        <div className="gallery-skeleton-image" />
                        <div className="gallery-skeleton-line short" />
                        <div className="gallery-skeleton-line" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && visibleItems.length === 0 ? (
              <div className="gallery-empty">
                <Empty description="当前分类下暂无可展示商品" />
              </div>
            ) : null}

            {!loading && visibleItems.length > 0 ? (
              <div className="gallery-grid">
                <div className="gallery-grid-column">
                  {leftColumnItems.map((item) => {
                    const price = Number(item.price || 0);
                    const description = normalizeText(item.description);
                    const hasDescription = Boolean(description);
                    const imageHeight = getItemHeight(item.id);
                    return (
                      <article key={item.id} className={`gallery-item ${hasDescription ? 'has-desc' : 'no-desc'}`}>
                        <button
                          type="button"
                          className="gallery-item-image-wrap"
                          onClick={() => void openProductPreview(item)}
                        >
                          <img
                            className="gallery-item-image"
                            src={normalizeText(item.coverImage) || PLACEHOLDER_IMAGE}
                            alt={item.name}
                            loading="lazy"
                            style={{ height: imageHeight }}
                            onError={(event) => {
                              const target = event.currentTarget;
                              if (target.src !== PLACEHOLDER_IMAGE) target.src = PLACEHOLDER_IMAGE;
                            }}
                          />
                          <div className="gallery-item-badge">
                            {labelOrDefault(item.categoryName || item.category || item.gameTypeName || item.gameType, '未分类')}
                          </div>
                        </button>
                        <div className="gallery-item-meta">
                          <div className="gallery-item-title-row">
                            <span className="gallery-item-name">{item.name || '未命名商品'}</span>
                            <span className="gallery-item-price">¥{price.toFixed(0)}</span>
                          </div>
                          {description ? <div className="gallery-item-desc">{description}</div> : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div className="gallery-grid-column">
                  {rightColumnItems.map((item) => {
                    const price = Number(item.price || 0);
                    const description = normalizeText(item.description);
                    const hasDescription = Boolean(description);
                    const imageHeight = getItemHeight(item.id);
                    return (
                      <article key={item.id} className={`gallery-item ${hasDescription ? 'has-desc' : 'no-desc'}`}>
                        <button
                          type="button"
                          className="gallery-item-image-wrap"
                          onClick={() => void openProductPreview(item)}
                        >
                          <img
                            className="gallery-item-image"
                            src={normalizeText(item.coverImage) || PLACEHOLDER_IMAGE}
                            alt={item.name}
                            loading="lazy"
                            style={{ height: imageHeight }}
                            onError={(event) => {
                              const target = event.currentTarget;
                              if (target.src !== PLACEHOLDER_IMAGE) target.src = PLACEHOLDER_IMAGE;
                            }}
                          />
                          <div className="gallery-item-badge">
                            {labelOrDefault(item.categoryName || item.category || item.gameTypeName || item.gameType, '未分类')}
                          </div>
                        </button>
                        <div className="gallery-item-meta">
                          <div className="gallery-item-title-row">
                            <span className="gallery-item-name">{item.name || '未命名商品'}</span>
                            <span className="gallery-item-price">¥{price.toFixed(0)}</span>
                          </div>
                          {description ? <div className="gallery-item-desc">{description}</div> : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {!loading && hasMore ? (
              <div className="gallery-load-more" ref={loadMoreRef}>
                <div className="gallery-load-more-spinner" />
                <span>继续加载更多</span>
              </div>
            ) : null}
            {!loading && loadingMore ? (
              <div className="gallery-load-more">
                <div className="gallery-load-more-spinner" />
                <span>加载中...</span>
              </div>
            ) : null}
            {!loading && !loadingMore && !hasMore && visibleItems.length > 0 ? (
              <div className="gallery-load-done">已加载全部商品</div>
            ) : null}
          </main>
        </div>
      </div>

      <div className={`gallery-filter-overlay ${filterPanelOpen ? 'open' : ''}`} onClick={() => setFilterPanelOpen(false)} />
      <div className={`gallery-filter-panel ${filterPanelOpen ? 'open' : ''}`}>
        <div className="gallery-filter-panel-head">
          <span className="gallery-filter-panel-title">商品筛选</span>
          <button type="button" className="gallery-filter-close" onClick={() => setFilterPanelOpen(false)}>
            <CloseOutlined />
          </button>
        </div>

        <section className="gallery-filter-section">
          <div className="gallery-filter-section-title">排序方式</div>
          <div className="gallery-filter-options">
            {[
              { value: 'default', label: '默认' },
              { value: 'new', label: '新品优先' },
              { value: 'price-asc', label: '价格从低到高' },
              { value: 'price-desc', label: '价格从高到低' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`filter-option ${sortMode === opt.value ? 'active' : ''} ${opt.value === 'default' ? 'is-default' : ''}`}
                onClick={() => setSortMode(opt.value as 'default' | 'new' | 'price-asc' | 'price-desc')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="gallery-filter-section">
          <div className="gallery-filter-section-title">价格区间</div>
          <div className="gallery-filter-options">
            {[
              { value: 'all', label: '全部' },
              { value: '0-50', label: '0-50元' },
              { value: '50-100', label: '50-100元' },
              { value: '100+', label: '100元以上' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`filter-option ${priceRange === opt.value ? 'active' : ''}`}
                onClick={() => setPriceRange(opt.value as 'all' | '0-50' | '50-100' | '100+')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="gallery-filter-section">
          <div className="gallery-filter-section-title">商品分类</div>
          <div className="gallery-filter-options">
            {categoryGroups.map((group) => (
              <button
                key={group.key}
                type="button"
                className={`filter-option ${selectedCategory === group.key ? 'active' : ''}`}
                onClick={() => setSelectedCategory(group.key)}
              >
                {group.label}
              </button>
            ))}
          </div>
        </section>

        <div className="gallery-filter-actions">
          <button
            type="button"
            className="gallery-filter-reset"
            onClick={() => {
              setSortMode('default');
              setPriceRange('all');
              setSelectedCategory('ALL');
            }}
          >
            重置
          </button>
          <button type="button" className="gallery-filter-confirm" onClick={() => setFilterPanelOpen(false)}>
            确认
          </button>
        </div>
      </div>

      <Modal
        open={previewOpen}
        onCancel={() => {
          setPreviewOpen(false);
          setPreviewItem(null);
          setPreviewLoading(false);
        }}
        footer={null}
        centered
        width={960}
        className="gallery-preview-modal"
        destroyOnClose
      >
        {previewLoading || previewItem ? (
          <div className="gallery-preview">
            {previewLoading && !previewItem ? (
              <div className="gallery-preview-loading">
                <Skeleton active paragraph={{ rows: 4 }} />
              </div>
            ) : previewItem ? (
              <>
                <div className="gallery-preview-head">
                  <div>
                    <Title level={4} style={{ margin: 0 }}>
                      {previewItem.name || '未命名商品'}
                    </Title>
                    <Space size={8} wrap style={{ marginTop: 8 }}>
                      <Tag color="blue">{labelOrDefault(previewItem.gameTypeName || previewItem.gameType, '游戏分类')}</Tag>
                      <Tag color="cyan">{labelOrDefault(previewItem.categoryName || previewItem.category, '商品类别')}</Tag>
                      {normalizeText(previewItem.projectTypeNames?.join(' / ') || previewItem.projectType) ? (
                        <Tag color="geekblue">{previewItem.projectTypeNames?.join(' / ') || previewItem.projectType}</Tag>
                      ) : null}
                    </Space>
                  </div>
                  <Text className="gallery-preview-price">¥{Number(previewItem.price || 0).toFixed(0)}</Text>
                </div>
                <Image
                  src={normalizeText(previewItem.coverImage) || PLACEHOLDER_IMAGE}
                  alt={previewItem.name}
                  preview={false}
                  className="gallery-preview-image"
                  onError={(event) => {
                    const target = event.currentTarget as HTMLImageElement;
                    if (target.src !== PLACEHOLDER_IMAGE) target.src = PLACEHOLDER_IMAGE;
                  }}
                />
                {normalizeText(previewItem.description) ? (
                  <Paragraph className="gallery-preview-desc">{previewItem.description}</Paragraph>
                ) : null}
                {normalizeText((previewItem as any)?.richContent) ? (
                  <div
                    className="gallery-preview-rich"
                    dangerouslySetInnerHTML={{ __html: String((previewItem as any).richContent || '') }}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
