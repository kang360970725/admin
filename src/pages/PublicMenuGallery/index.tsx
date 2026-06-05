import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Carousel, Empty, Image, Skeleton, Space, Tag, Typography, message } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { getPublicMenuDetail, listPublicMiniappProtocolsByCategory, postPublicMenuList, type MiniappProtocolItem, type PublicMenuDetail, type PublicMenuItem } from '@/services/api';
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

function extractFirstImageSrc(html: unknown) {
  const text = String(html ?? '');
  if (!text) return '';
  const match = text.match(/<img[^>]*\ssrc=["']([^"']+)["'][^>]*>/i);
  if (match?.[1]) return match[1].trim();
  const hrefMatch = text.match(/data-href=["']([^"']+)["']/i);
  return hrefMatch?.[1]?.trim() || '';
}

function extractAllImageSrcs(html: unknown) {
  const text = String(html ?? '');
  if (!text) return [];
  const list = Array.from(text.matchAll(/<img[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi))
    .map((match) => String(match?.[1] || '').trim())
    .filter(Boolean);
  if (list.length) return Array.from(new Set(list));
  const href = Array.from(text.matchAll(/data-href=["']([^"']+)["']/gi))
    .map((match) => String(match?.[1] || '').trim())
    .filter(Boolean);
  return Array.from(new Set(href));
}

function stripHtml(html: unknown) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  const [bannerLoading, setBannerLoading] = useState(true);
  const [bannerLoadFailed, setBannerLoadFailed] = useState(false);
  const [bannerProtocols, setBannerProtocols] = useState<MiniappProtocolItem[]>([]);
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
  const [previewKind, setPreviewKind] = useState<'product' | 'protocol'>('product');
  const [previewItem, setPreviewItem] = useState<PublicMenuDetail | PublicMenuItem | null>(null);
  const [productPreviewVisible, setProductPreviewVisible] = useState(false);
  const [productPreviewCurrent, setProductPreviewCurrent] = useState(0);
  const [protocolPreviewVisible, setProtocolPreviewVisible] = useState(false);
  const [protocolPreviewCurrent, setProtocolPreviewCurrent] = useState(0);
  const [bannerPreviewVisible, setBannerPreviewVisible] = useState(false);
  const [bannerPreviewSrc, setBannerPreviewSrc] = useState('');
  const [inlinePreview, setInlinePreview] = useState<{
    title: string;
    text: string;
    kind: 'product' | 'protocol';
  } | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const loadBannerProtocols = useCallback(async () => {
    setBannerLoading(true);
    setBannerLoadFailed(false);
    try {
      const res: any = await listPublicMiniappProtocolsByCategory('C 端客户权益');
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setBannerProtocols(list as MiniappProtocolItem[]);
    } catch {
      setBannerProtocols([]);
      setBannerLoadFailed(true);
    } finally {
      setBannerLoading(false);
    }
  }, []);

  const openProductPreview = useCallback(async (item: PublicMenuItem | null | undefined, productId?: number) => {
    const targetId = Number(productId || item?.id || 0);
    if (!Number.isFinite(targetId) || targetId <= 0) return;

    setPreviewKind('product');
    setPreviewItem(item || null);
    setInlinePreview(null);

    try {
      const detail = await getPublicMenuDetail(targetId);
      if (detail) {
        setPreviewItem(detail);
      }
      const nextDetail = detail || item;
      const imageList = extractAllImageSrcs((nextDetail as any)?.richContent);
      if (imageList.length) {
        setProductPreviewCurrent(0);
        setProductPreviewVisible(true);
      } else {
        const text = stripHtml((nextDetail as any)?.richContent) || normalizeText((nextDetail as any)?.description);
        setInlinePreview({
          title: normalizeText((nextDetail as any)?.name) || '商品详情',
          text: text || '商品详情暂无图片内容',
          kind: 'product',
        });
      }
    } catch {
      if (item) {
        setPreviewItem(item);
        const imageList = extractAllImageSrcs((item as any)?.richContent);
        if (imageList.length) {
          setProductPreviewCurrent(0);
          setProductPreviewVisible(true);
        } else {
          setInlinePreview({
            title: normalizeText(item.name) || '商品详情',
            text: stripHtml((item as any)?.richContent) || normalizeText(item.description) || '商品详情暂无图片内容',
            kind: 'product',
          });
        }
      }
    }
  }, []);

  const openProtocolPreview = useCallback((item: MiniappProtocolItem | null | undefined) => {
    if (!item || !Number.isFinite(Number(item.id)) || Number(item.id) <= 0) return;
    const imageSrc = extractFirstImageSrc((item as any)?.content);
    if (imageSrc) {
      setBannerPreviewSrc(imageSrc);
      setBannerPreviewVisible(true);
      return;
    }
    const imageList = extractAllImageSrcs((item as any)?.content);
    if (imageList.length) {
      setPreviewKind('protocol');
      setPreviewItem(item as any);
      setProtocolPreviewCurrent(0);
      setProtocolPreviewVisible(true);
      setInlinePreview(null);
      return;
    }
    setPreviewKind('protocol');
    setPreviewItem(item as any);
    setInlinePreview({
      title: normalizeText((item as any)?.title) || '协议详情',
      text: stripHtml((item as any)?.content) || '协议内容暂无图片',
      kind: 'protocol',
    });
  }, []);

  const productPreviewImages = useMemo(() => {
    if (previewKind !== 'product' || !previewItem) return [];
    return extractAllImageSrcs((previewItem as any)?.richContent);
  }, [previewItem, previewKind]);

  const productPreviewText = useMemo(() => {
    if (previewKind !== 'product' || !previewItem) return '';
    const richText = stripHtml((previewItem as any)?.richContent);
    const descText = normalizeText(previewItem.description);
    return richText || descText;
  }, [previewItem, previewKind]);

  const protocolPreviewImages = useMemo(() => {
    if (previewKind !== 'protocol' || !previewItem) return [];
    return extractAllImageSrcs((previewItem as any)?.content);
  }, [previewItem, previewKind]);

  const protocolPreviewText = useMemo(() => {
    if (previewKind !== 'protocol' || !previewItem) return '';
    return stripHtml((previewItem as any)?.content);
  }, [previewItem, previewKind]);

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
    document.title = '蓝猫爽打-服务列表';
  }, []);

  useEffect(() => {
    void loadBannerProtocols();
    setItems([]);
    setPage(1);
    setHasMore(false);
    void loadPage(1, true);
  }, [loadBannerProtocols, loadPage, selectedCategory]);

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
    return bannerProtocols
      .map((banner) => ({
        id: Number(banner.id || 0),
        title: normalizeText(banner.title) || '必看说明',
        coverImage: normalizeText(banner.coverImage) || PLACEHOLDER_IMAGE,
        content: normalizeText(banner.content),
        targetValue: String(banner.key || banner.id || '').trim(),
      }))
      .filter((banner) => banner.id > 0 && banner.coverImage);
  }, [bannerProtocols]);

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

  const closeInlinePreview = useCallback(() => {
    setInlinePreview(null);
    setPreviewItem(null);
    setPreviewKind('product');
  }, []);

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

            {bannerLoading && !bannerItem.length ? <div className="gallery-notice-banner-skeleton" /> : null}
            {!bannerLoading && bannerLoadFailed ? (
              <div className="gallery-notice-banner-empty">
                <span>Banner 暂无可展示内容</span>
              </div>
            ) : null}

            {!bannerLoadFailed && bannerItem.length ? (
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
                    <div key={`${banner.id}-${index}`}>
                      <button
                        type="button"
                        className="gallery-notice-banner-slide"
                        onClick={() => openProtocolPreview({
                          id: Number(banner.id),
                          categoryId: Number((banner as any)?.categoryId || 0),
                          category: (banner as any)?.category || null,
                          key: String((banner as any)?.key || ''),
                          title: banner.title || '必看说明',
                          coverImage: banner.coverImage,
                          content: banner.content || '',
                          enabled: true,
                          remark: undefined,
                          sort: 0,
                        } as MiniappProtocolItem)}
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

            {!loading && visibleItems.length > 0 ? (
              <div className="gallery-load-more" ref={loadMoreRef}>
                {loadingMore || hasMore ? <div className="gallery-load-more-spinner" /> : null}
                <span>{loadingMore ? '加载中...' : hasMore ? '继续加载更多' : '已加载全部商品'}</span>
              </div>
            ) : null}

            {inlinePreview ? (
              <div className="gallery-inline-preview">
                <div className="gallery-inline-preview-head">
                  <div className="gallery-inline-preview-title">{inlinePreview.title}</div>
                  <button type="button" className="gallery-inline-preview-close" onClick={closeInlinePreview}>
                    <CloseOutlined />
                  </button>
                </div>
                <div className="gallery-inline-preview-text">{inlinePreview.text}</div>
              </div>
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

      <div style={{ display: 'none' }}>
        <Image.PreviewGroup
          preview={{
            visible: productPreviewVisible,
            current: productPreviewCurrent,
            onVisibleChange: (visible) => {
              setProductPreviewVisible(visible);
              if (!visible) {
                setProductPreviewCurrent(0);
                setPreviewItem(null);
                setPreviewKind('product');
              }
            },
          }}
        >
          {productPreviewImages.map((src, index) => (
            <Image
              key={`product-${index}-${src}`}
              src={src || PLACEHOLDER_IMAGE}
              alt={`商品详情-${index + 1}`}
              onError={(event) => {
                const target = event.currentTarget as HTMLImageElement;
                if (target.src !== PLACEHOLDER_IMAGE) target.src = PLACEHOLDER_IMAGE;
              }}
            />
          ))}
        </Image.PreviewGroup>
        <Image.PreviewGroup
          preview={{
            visible: protocolPreviewVisible,
            current: protocolPreviewCurrent,
            onVisibleChange: (visible) => {
              setProtocolPreviewVisible(visible);
              if (!visible) {
                setProtocolPreviewCurrent(0);
                setPreviewItem(null);
                setPreviewKind('product');
              }
            },
          }}
        >
          {protocolPreviewImages.map((src, index) => (
            <Image
              key={`protocol-${index}-${src}`}
              src={src || PLACEHOLDER_IMAGE}
              alt={`协议内容-${index + 1}`}
              onError={(event) => {
                const target = event.currentTarget as HTMLImageElement;
                if (target.src !== PLACEHOLDER_IMAGE) target.src = PLACEHOLDER_IMAGE;
              }}
            />
          ))}
        </Image.PreviewGroup>
      </div>
      {bannerPreviewSrc ? (
        <Image
          style={{ display: 'none' }}
          src={bannerPreviewSrc}
          preview={{
            visible: bannerPreviewVisible,
            src: bannerPreviewSrc,
            onVisibleChange: (visible) => {
              setBannerPreviewVisible(visible);
              if (!visible) setBannerPreviewSrc('');
            },
          }}
        />
      ) : null}
    </div>
  );
}
