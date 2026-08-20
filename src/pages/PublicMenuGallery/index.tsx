import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Carousel, Drawer, Empty, Modal, Skeleton, Tag, Typography, message } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import PhotoSwipe from 'photoswipe';
import 'photoswipe/style.css';
import {
  getPublicMenuDetail,
  getPublicMiniappCustomerServiceConfig,
  listPublicMiniappProtocolsByCategory,
  postPublicMenuList,
  type MiniappCustomerServiceConfig,
  type MiniappProtocolItem,
  type PublicMenuDetail,
  type PublicMenuItem,
} from '@/services/api';
import './index.less';

const { Title, Paragraph } = Typography;
const PAGE_SIZE = 8;
const PLACEHOLDER_IMAGE = '/menu-placeholder.png';

type PhotoSwipeImageItem = {
  src: string;
  width: number;
  height: number;
};

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

function normalizePublicDetailText(value: unknown) {
  const text = stripHtml(value);
  const placeholders = new Set(['请输入商品图文详情', '请输入商品图文详情；', '请输入商品图文详情。']);
  return placeholders.has(text) ? '' : text;
}

function loadPhotoSwipeImageSize(src: string): Promise<PhotoSwipeImageItem> {
  return new Promise((resolve) => {
    if (!src) {
      resolve({ src: PLACEHOLDER_IMAGE, width: 1080, height: 1080 });
      return;
    }

    const image = new window.Image();
    image.onload = () => {
      resolve({
        src,
        width: image.naturalWidth || 1080,
        height: image.naturalHeight || 1080,
      });
    };
    image.onerror = () => {
      resolve({ src: PLACEHOLDER_IMAGE, width: 1080, height: 1080 });
    };
    image.src = src;
  });
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
  const [productDetailDrawerOpen, setProductDetailDrawerOpen] = useState(false);
  const [productDetailLoading, setProductDetailLoading] = useState(false);
  const [customerServiceConfig, setCustomerServiceConfig] = useState<MiniappCustomerServiceConfig>({
    consultText: '详询客服',
    qrCodeUrl: '',
  });
  const [consultModalVisible, setConsultModalVisible] = useState(false);
  const [consultProductTitle, setConsultProductTitle] = useState('');
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const photoSwipeRef = useRef<PhotoSwipe | null>(null);

  const openConsultModal = useCallback((title?: string) => {
    setConsultProductTitle(normalizeText(title) || '商品详情');
    setConsultModalVisible(true);
  }, []);

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
    setProductDetailDrawerOpen(true);
    setProductDetailLoading(true);

    try {
      const detail = await getPublicMenuDetail(targetId);
      if (detail) {
        setPreviewItem(detail);
      }
    } catch {
      if (item) {
        setPreviewItem(item);
      }
    } finally {
      setProductDetailLoading(false);
    }
  }, []);

  const openPhotoSwipe = useCallback(async (images: string[], startIndex = 0) => {
    const imageList = Array.from(new Set((images || []).map(normalizeText).filter(Boolean)));
    if (!imageList.length) return;

    const safeIndex = Math.min(Math.max(0, Number(startIndex || 0)), imageList.length - 1);
    const dataSource = await Promise.all(imageList.map(loadPhotoSwipeImageSize));
    photoSwipeRef.current?.destroy();

    const pswp = new PhotoSwipe({
      dataSource,
      index: safeIndex,
      bgOpacity: 0.96,
      showHideAnimationType: 'fade',
      wheelToZoom: true,
      pinchToClose: true,
      closeOnVerticalDrag: true,
      paddingFn: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    });
    photoSwipeRef.current = pswp;
    pswp.on('destroy', () => {
      if (photoSwipeRef.current === pswp) photoSwipeRef.current = null;
    });
    pswp.init();
  }, []);

  const openProtocolPreview = useCallback((item: MiniappProtocolItem | null | undefined) => {
    if (!item || !Number.isFinite(Number(item.id)) || Number(item.id) <= 0) return;
    const imageSrc = extractFirstImageSrc((item as any)?.content);
    if (imageSrc) {
      void openPhotoSwipe([imageSrc], 0);
      return;
    }
    const imageList = extractAllImageSrcs((item as any)?.content);
    if (imageList.length) {
      setPreviewKind('protocol');
      setPreviewItem(item as any);
      void openPhotoSwipe(imageList, 0);
      return;
    }
    setPreviewKind('protocol');
    setPreviewItem(item as any);
    openConsultModal(normalizeText((item as any)?.title) || '协议详情');
  }, [openConsultModal, openPhotoSwipe]);

  useEffect(() => {
    return () => {
      photoSwipeRef.current?.destroy();
      photoSwipeRef.current = null;
    };
  }, []);

  const productPreviewImages = useMemo(() => {
    if (previewKind !== 'product' || !previewItem) return [];
    return extractAllImageSrcs((previewItem as any)?.richContent);
  }, [previewItem, previewKind]);

  const productPreviewText = useMemo(() => {
    if (previewKind !== 'product' || !previewItem) return '';
    const richText = normalizePublicDetailText((previewItem as any)?.richContent);
    const descText = normalizeText(previewItem.description);
    return richText || (descText === '请输入商品图文详情' ? '' : descText);
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
    (async () => {
      try {
        const config = await getPublicMiniappCustomerServiceConfig();
        setCustomerServiceConfig({
          consultText: normalizeText(config?.consultText) || '详询客服',
          qrCodeUrl: normalizeText(config?.qrCodeUrl),
          remark: normalizeText(config?.remark),
        });
      } catch {
        setCustomerServiceConfig({ consultText: '详询客服', qrCodeUrl: '' });
      }
    })();
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
  const isWechatReviewMode = Boolean(customerServiceConfig.wechatReviewMode);

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

  const getItemHeight = (id?: number) => {
    const heights = [220, 240, 205, 250, 225, 235, 215, 245, 260, 200, 230, 210];
    const idx = Math.abs(Number(id || 0)) % heights.length;
    return heights[idx] || 180;
  };

  if (isWechatReviewMode) {
    return (
      <div className="public-menu-gallery-page review-mode">
        <div className="gallery-review-shell">
          <section className="gallery-review-hero">
            <div className="gallery-review-eyebrow">LMSD Club Service Information</div>
            <Title level={2} className="gallery-review-title">平台服务说明</Title>
            <Paragraph className="gallery-review-desc">
              本页面用于展示平台线上互动服务范围、服务流程与用户须知，不提供直接交易、支付、下载或诱导分享功能。
            </Paragraph>
          </section>

          <section className="gallery-review-card">
            <div className="gallery-review-section-title">服务范围</div>
            <div className="gallery-review-grid">
              <div className="gallery-review-item">
                <div className="gallery-review-item-title">线上娱乐协助</div>
                <div className="gallery-review-item-text">提供游戏相关的信息咨询、流程说明和服务匹配协助。</div>
              </div>
              <div className="gallery-review-item">
                <div className="gallery-review-item-title">服务项目展示</div>
                <div className="gallery-review-item-text">展示平台可提供的项目类型，具体内容以平台确认结果为准。</div>
              </div>
              <div className="gallery-review-item">
                <div className="gallery-review-item-title">用户权益说明</div>
                <div className="gallery-review-item-text">说明服务前注意事项、履约边界、售后与投诉处理方式。</div>
              </div>
            </div>
          </section>

          <section className="gallery-review-card">
            <div className="gallery-review-section-title">服务流程</div>
            <ol className="gallery-review-steps">
              <li>用户了解平台服务说明与注意事项。</li>
              <li>平台根据用户需求进行服务信息确认。</li>
              <li>双方确认服务内容、时间安排与履约规则。</li>
              <li>服务完成后，用户可通过平台反馈体验或提交售后诉求。</li>
            </ol>
          </section>

          <section className="gallery-review-card">
            <div className="gallery-review-section-title">合规说明</div>
            <div className="gallery-review-copy">
              平台不支持违法违规、低俗擦边、赌博诈骗、诱导分享、恶意营销或侵犯他人权益的内容与行为。未成年人应在监护人指导下合理使用网络服务。
            </div>
          </section>

          <section className="gallery-review-card">
            <div className="gallery-review-section-title">用户须知</div>
            <div className="gallery-review-copy">
              本页面展示内容仅为服务信息说明，不构成即时交易承诺。具体服务安排、收费标准、退款售后与权益保障以平台正式确认和相关协议为准。
            </div>
          </section>

          <footer className="gallery-review-footer">
            <div>蓝猫爽打 · 线上互动服务平台</div>
            <div>蜀ICP备2026039511号-1</div>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="public-menu-gallery-page">
      <div className="gallery-shell">
        <div className="gallery-body">
          <main className="gallery-main">
            <section className="gallery-hero">
              <div>
                <div className="gallery-hero-eyebrow">BlueCat Service Menu</div>
                <Title level={3} className="gallery-hero-title">蓝猫服务菜单</Title>
                <Paragraph className="gallery-hero-desc">
                  浏览服务项目、价格与下单须知，按分类快速筛选，点击卡片可查看详情。
                </Paragraph>
              </div>
              <div className="gallery-hero-tags">
                <Tag color="blue">价格透明</Tag>
                <Tag color="green">服务者撮合</Tag>
                <Tag color="gold">下单前先看须知</Tag>
              </div>
            </section>

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
                <span>暂无下单须知展示</span>
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

      <Drawer
        placement="bottom"
        open={productDetailDrawerOpen}
        height="82vh"
        className="gallery-product-drawer"
        title={null}
        closable={false}
        destroyOnClose={false}
        onClose={() => {
          setProductDetailDrawerOpen(false);
          setProductDetailLoading(false);
        }}
      >
        <div className="gallery-product-detail">
          <div className="gallery-product-detail-handle" />
          <div className="gallery-product-detail-head">
            <div className="gallery-product-detail-main">
              <div className="gallery-product-detail-title">
                {normalizeText(previewItem?.name) || '商品详情'}
              </div>
              <div className="gallery-product-detail-tags">
                <Tag color="blue">
                  {labelOrDefault(
                    (previewItem as any)?.categoryName ||
                      (previewItem as any)?.category ||
                      (previewItem as any)?.gameTypeName ||
                      (previewItem as any)?.gameType,
                    '未分类',
                  )}
                </Tag>
                {normalizeText((previewItem as any)?.billingMode) ? (
                  <Tag>{normalizeText((previewItem as any)?.billingMode)}</Tag>
                ) : null}
              </div>
            </div>
            <div className="gallery-product-detail-price">
              ¥{Number((previewItem as any)?.price || 0).toFixed(0)}
            </div>
          </div>

          {productDetailLoading ? (
            <div className="gallery-product-detail-loading">
              <Skeleton active paragraph={{ rows: 4 }} />
            </div>
          ) : (
            <>
              {productPreviewText ? (
                <div className="gallery-product-detail-desc">{productPreviewText}</div>
              ) : null}

              {productPreviewImages.length ? (
                <div className="gallery-product-detail-images">
                  {productPreviewImages.map((src, index) => (
                    <button
                      type="button"
                      key={`${src}-${index}`}
                      className="gallery-product-detail-image-btn"
                      onClick={() => void openPhotoSwipe(productPreviewImages, index)}
                    >
                      <img
                        className="gallery-product-detail-image"
                        src={src || PLACEHOLDER_IMAGE}
                        alt={`商品详情-${index + 1}`}
                        loading="lazy"
                        onError={(event) => {
                          const target = event.currentTarget;
                          if (target.src !== PLACEHOLDER_IMAGE) target.src = PLACEHOLDER_IMAGE;
                        }}
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="gallery-product-detail-empty">
                  <div className="gallery-product-detail-empty-title">暂无图文详情</div>
                  <div className="gallery-product-detail-empty-text">更多服务细节可直接咨询客服。</div>
                </div>
              )}

              <div className="gallery-product-consult-card">
                <div className="gallery-product-consult-card-text">
                  {normalizeText(customerServiceConfig.consultText) || '详询客服'}
                </div>
                {normalizeText(customerServiceConfig.qrCodeUrl) ? (
                  <img
                    className="gallery-product-consult-card-qrcode"
                    src={normalizeText(customerServiceConfig.qrCodeUrl)}
                    alt="客服二维码"
                    onClick={() => openConsultModal(normalizeText(previewItem?.name) || '商品详情')}
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <div className="gallery-product-consult-card-tip">
                  扫码联系平台客服，确认服务档期、细节与下单方式。
                </div>
              </div>
            </>
          )}

          <div className="gallery-product-detail-safe-space" />
        </div>

        <div className="gallery-product-consult-bar">
          <button
            type="button"
            className="gallery-product-consult-button"
            onClick={() => openConsultModal(normalizeText(previewItem?.name) || '商品详情')}
          >
            查看客服二维码
          </button>
        </div>
      </Drawer>

      <button
        type="button"
        className="gallery-floating-consult"
        onClick={() => openConsultModal('蓝猫服务菜单')}
        aria-label="召唤客服"
      >
        <span className="gallery-floating-consult-dot" />
        <span className="gallery-floating-consult-text">召唤客服</span>
      </button>

      <Modal
        open={consultModalVisible}
        footer={null}
        centered
        width={320}
        className="gallery-consult-modal"
        onCancel={() => setConsultModalVisible(false)}
      >
        <div className="gallery-consult-card">
          <div className="gallery-consult-title">{consultProductTitle}</div>
          <div className="gallery-consult-text">
            {normalizeText(customerServiceConfig.consultText) || '详询客服'}
          </div>
          {normalizeText(customerServiceConfig.qrCodeUrl) ? (
            <img
              className="gallery-consult-qrcode"
              src={normalizeText(customerServiceConfig.qrCodeUrl)}
              alt="客服二维码"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          <div className="gallery-consult-tip">可截图保存二维码，联系平台客服咨询下单细节。</div>
        </div>
      </Modal>
    </div>
  );
}
