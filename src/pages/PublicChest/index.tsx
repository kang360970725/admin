import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Input, Modal, message } from 'antd';
import { GiftFilled, LockFilled, UnlockFilled } from '@ant-design/icons';
import { getChestPublicRewardPool, postChestPublicHistory, postChestPublicOpen, postChestPublicStatus } from '@/services/api';
import './index.less';

function ensureDeviceId() {
  const key = 'chest_public_device_id';
  const old = String(localStorage.getItem(key) || '').trim();
  if (old) return old;
  const next = `D${Date.now()}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  localStorage.setItem(key, next);
  return next;
}

function AutoFitText({
  text,
  className,
  max = 24,
  min = 12,
}: {
  text: string;
  className?: string;
  max?: number;
  min?: number;
}) {
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const [size, setSize] = useState(max);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const fit = () => {
      const parent = el.parentElement;
      if (!parent) return;
      let next = max;
      el.style.fontSize = `${next}px`;
      while (next > min && el.scrollWidth > parent.clientWidth) {
        next -= 1;
        el.style.fontSize = `${next}px`;
      }
      setSize(next);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [text, max, min]);

  return (
    <span
      ref={hostRef}
      className={className}
      style={{ fontSize: size, whiteSpace: 'nowrap', display: 'block', overflow: 'hidden' }}
      title={text}
    >
      {text}
    </span>
  );
}

export default function PublicChestPage() {
  const formatBjt = (raw: any) => {
    if (!raw) return '-';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '-';
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const pick = (t: string) => parts.find((p) => p.type === t)?.value || '00';
    return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}`;
  };

  const formatPercent = (v: any) => {
    const n = Number(v || 0);
    if (!Number.isFinite(n) || n <= 0) return '0%';
    // <0.1% 用万分比，0.1%~1% 用千分比，>=1% 用百分比
    if (n < 0.1) {
      const perTenThousand = n * 100;
      if (perTenThousand < 0.0001) return '<0.0001‱';
      if (perTenThousand < 0.01) return `${perTenThousand.toFixed(6)}‱`;
      return `${perTenThousand.toFixed(4)}‱`;
    }
    if (n < 1) {
      const perMille = n * 10;
      if (perMille < 0.0001) return '<0.0001‰';
      if (perMille < 0.01) return `${perMille.toFixed(6)}‰`;
      return `${perMille.toFixed(4)}‰`;
    }
    return `${n.toFixed(2)}%`;
  };

  const formatRewardType = (raw: any) => {
    const v = String(raw || '').toUpperCase();
    if (v === 'COUPON') return '优惠券';
    if (v === 'BONUS') return '积分';
    if (v === 'ITEM') return '道具';
    if (v === 'GAME_ITEM') return '游戏道具';
    if (v === 'VOUCHER') return '代金券';
    if (v === 'DEDUCT_COUPON') return '抵扣券';
    if (v === 'PHYSICAL') return '实物';
    if (v === 'CASH') return '现金';
    return raw || '-';
  };

  const STAR_LEVELS = [7, 6, 5, 4];

  const deviceId = useMemo(() => ensureDeviceId(), []);
  const currentCode = useMemo(() => {
    const qp = new URLSearchParams(window.location.search);
    const single = String(qp.get('code') || qp.get('redeemCode') || qp.get('lotteryCode') || '').trim();
    if (single) return single.toUpperCase();
    const firstFromCodes = String(qp.get('codes') || qp.get('redeemCodes') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0];
    return String(firstFromCodes || '').toUpperCase();
  }, []);
  const statusCacheKey = useMemo(() => `chest_status_cache_v2_${deviceId}_${currentCode || 'NO_CODE'}`, [deviceId, currentCode]);
  const phoneCacheKey = useMemo(() => `chest_phone_v1_${deviceId}`, [deviceId]);
  const [status, setStatus] = useState<any>({ enabled: false, title: '开宝盒活动', keyCount: 0 });
  const [phone, setPhone] = useState('');
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  const [bursting, setBursting] = useState(false);
  const [rewards, setRewards] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>({ name: '加载中', value: '-', desc: '本期超级大奖', bigWin: true });
  const [showProb, setShowProb] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [publicRewardPool, setPublicRewardPool] = useState<any[]>([]);
  const statusReqRef = React.useRef<{ inFlight: boolean; lastAt: number; lastKey: string }>({
    inFlight: false,
    lastAt: 0,
    lastKey: '',
  });
  const canOpen = !opening && /^1\d{10}$/.test(String(phone || '').trim()) && Number(status?.keyCount || 0) > 0;
  const showRareTip = rewards.length > 0;

  const topGrandItems = useMemo(() => {
    const list = Array.isArray(publicRewardPool) ? publicRewardPool : [];
    return list
      .filter((i) => Number(i?.probability || 0) > 0)
      .sort((a, b) => Number(a?.probability || 0) - Number(b?.probability || 0))
      .slice(0, 4)
      .map((i, idx) => ({
        name: String(i?.name || '-'),
        value: String(formatPercent(i?.probability || 0)),
        desc: `${formatRewardType(i?.type)} · 余${i?.stock === null || i?.stock === undefined ? '不限' : Number(i?.stock || 0)} · ${formatPercent(i?.probability)}`,
        rankStars: STAR_LEVELS[idx] || 4,
      }));
  }, [publicRewardPool]);
  const grandStars = '★'.repeat(Math.max(1, Number(preview?.rankStars || 4)));

  const loadStatus = async (silent = false, force = false) => {
    const reqKey = `${deviceId}|${String(phone || '').trim()}|${String(currentCode || '').trim()}`;
    const now = Date.now();
    const ref = statusReqRef.current;
    if (!force) {
      if (ref.inFlight) return;
      if (ref.lastKey === reqKey && now - ref.lastAt < 8000) return;
    }
    ref.inFlight = true;
    ref.lastAt = now;
    ref.lastKey = reqKey;
    try {
      const resp: any = await postChestPublicStatus({ deviceId, phone: phone || undefined, code: currentCode || undefined });
      if (Number(resp?.code || 0) !== 0) throw new Error(resp?.message || '状态加载失败');
      const base = resp?.data || resp || {};
      const nextKeyCount = Number(base?.keyCount ?? base?.remaining ?? 0);
      const next = {
        enabled: Boolean(base?.enabled),
        title: String(base?.title || '开宝盒活动'),
        keyCount: nextKeyCount,
        remaining: nextKeyCount,
        code: base?.code || currentCode || null,
      };
      setStatus(next);
      // localStorage.setItem(statusCacheKey, JSON.stringify({ ts: Date.now(), data: next }));
    } catch (e: any) {
      if (!silent) message.error(e?.message || '状态加载失败，请稍后重试');
    } finally {
      statusReqRef.current.inFlight = false;
    }
  };

  useEffect(() => {
    const raw = localStorage.getItem(statusCacheKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.data) setStatus(parsed.data);
      } catch {}
    }
    const p = String(localStorage.getItem(phoneCacheKey) || '').trim();
    if (p && /^1\d{10}$/.test(p)) {
      setPhone(p);
      setPhoneDraft(p);
    } else {
      setShowPhoneModal(true);
    }
    void loadStatus(true, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  useEffect(() => {
    if (!topGrandItems.length) return;
    setPreview(topGrandItems[0]);
    let idx = 0;
    const t = setInterval(() => {
      idx = (idx + 1) % topGrandItems.length;
      setPreview(topGrandItems[idx]);
    }, 2500);
    return () => clearInterval(t);
  }, [topGrandItems]);

  useEffect(() => {
    (async () => {
      try {
        const resp: any = await getChestPublicRewardPool();
        if (Number(resp?.code || 0) !== 0) return;
        const data = resp?.data || {};
        const list = Array.isArray(data?.list) ? data.list : [];
        setPublicRewardPool(list);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!currentCode) return;
    void loadStatus(true, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCode, statusCacheKey]);

  const loadHistory = async () => {
    try {
      const resp: any = await postChestPublicHistory({
        deviceId,
        page: 1,
        pageSize: 100,
        phone: phone || undefined,
        code: currentCode || undefined,
      });
      if (Number(resp?.code || 0) !== 0) throw new Error(resp?.message || '中奖记录加载失败');
      const data = resp?.data || resp || {};
      const list = Array.isArray(data?.list) ? data.list : [];
      setHistory(list);
    } catch (e: any) {
      message.warning(e?.message || '中奖记录加载失败');
    }
  };

  const playConfetti = () => {
    const canvas = document.getElementById('confettiCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array.from({ length: 160 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: Math.random() * 8 + 3,
      color: `hsl(${Math.random() * 360}, 100%, 60%)`,
      speedY: Math.random() * 6 + 5,
      speedX: (Math.random() - 0.5) * 3,
      rotation: Math.random() * 360,
      spin: (Math.random() - 0.5) * 12,
    }));
    let start: number | null = null;
    const draw = (ts: number) => {
      if (!start) start = ts;
      if (ts - start > 2200) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  };

  const open = async () => {
    if (!/^1\d{10}$/.test(String(phone || '').trim())) {
      message.warning('请先填写11位手机号');
      return;
    }
    if (opening) return;
    setOpening(true);
    setOpened(false);
    setBursting(false);
    try {
      await new Promise((r) => setTimeout(r, 360));
      const resp: any = await postChestPublicOpen({
        deviceId,
        costKeys: 1,
        phone: phone || undefined,
        code: currentCode || undefined,
      });
      if (Number(resp?.code || 0) !== 0) throw new Error(resp?.message || '开启失败，请稍后再试');
      const data = resp?.data || resp || {};
      const got = Array.isArray(data?.rewards) ? data.rewards : [];
      setRewards(got);
      setOpened(true);
      setBursting(true);
      const first = got[0];
      if (first) {
        const mapped = {
          name: first?.name || '神秘奖励',
          value: first?.type || '-',
          desc: '本次开箱获取',
          bigWin: true,
        };
        if (mapped.bigWin) playConfetti();
      }
      const leftKeys = Number(data?.leftKeys || 0);
      setStatus((prev: any) => ({ ...(prev || {}), keyCount: leftKeys }));
      localStorage.setItem(
        statusCacheKey,
        JSON.stringify({ ts: Date.now(), data: { ...(status || {}), keyCount: leftKeys } }),
      );
      setTimeout(() => setBursting(false), 1000);
    } catch (e: any) {
      message.warning(e?.message || '开启失败，请稍后再试');
    } finally {
      setOpening(false);
    }
  };

  const ensurePhone = () => {
    const p = String(phone || '').trim();
    if (/^1\d{10}$/.test(p)) return true;
    setPhoneDraft(p);
    setShowPhoneModal(true);
    return false;
  };

  const savePhone = async () => {
    const p = String(phoneDraft || '').trim();
    if (!/^1\d{10}$/.test(p)) {
      message.warning('请输入正确的11位手机号');
      return;
    }
    localStorage.setItem(phoneCacheKey, p);
    setPhone(p);
    setShowPhoneModal(false);
    await loadStatus(true, true);
    message.success('手机号已保存');
  };

  return (
    <div className="chest-event-page">
      <div className="glow-bg" />
      <canvas id="confettiCanvas" className="confetti-canvas" />

      <div className="h5-container">
        <div className="nav">
          <div />
          <div />
          <div className="nav-share" onClick={() => setShowProb(true)}>!</div>
        </div>

        <div className="event-header">
          <h1>👑 秘银宝盒 💎</h1>
          <div className="sub">⚡ 蓝猫加冕 · 好运连连 ⚡</div>
        </div>

        <div className="chest-area">
          <div className={`chest ${opening ? 'chest-opening' : ''}`} onClick={open}>
            <div className="chest-icon-shell">
              <GiftFilled className="chest-main-icon" />
              {opened ? <UnlockFilled className="chest-lock-icon" /> : <LockFilled className="chest-lock-icon" />}
            </div>
          </div>
        </div>
        <div className="chest-tip">👉 点击宝盒 · 开启好运 🔥</div>

        <div className="prize-panel">
          <div className="prize-label">✦ 本期超级大奖 ✦</div>
          <div className="reward-card">
            <div className="reward-info">
              <AutoFitText text={String(preview.name || '-')} className="reward-name" max={22} min={13} />
              <AutoFitText text={String(preview.desc || '-')} className="reward-desc" max={14} min={11} />
            </div>
            <div className="grand-visual">
              <div className="grand-rarity">👑 抽取难度</div>
              <div className="grand-stars">{grandStars}</div>
              {/*<AutoFitText text={`约 ${String(preview.value || '-')}`} className="reward-value" max={16} min={11} />*/}
            </div>
          </div>
        </div>

        <div className="status-row">
          <div className="attempts">🔑 剩余钥匙 <span>{status?.keyCount || 0}</span></div>
        </div>

        <button className="action-btn" disabled={!canOpen} onClick={() => { if (ensurePhone()) void open(); }}>
          {opening ? '开启中...' : '🎁 开启宝盒 ✨'}
        </button>

        <button className="history-btn" onClick={() => { if (!ensurePhone()) return; setShowHistory(true); void loadHistory(); }}>
          🧾 中奖记录
        </button>

      </div>

      <Modal
        title="宝盒物品与概率公示"
        open={showProb}
        onCancel={() => setShowProb(false)}
        footer={null}
        centered
        width={360}
        className="chest-mobile-modal chest-prob-modal"
      >
        <div className="reward-list">
          {publicRewardPool.map((r) => (
            <div key={String(r?.id)} className="reward-item">
              <div className="reward-name">{r?.name || '-'}</div>
              <div className="reward-type">
                <span className="meta-chip">🎯 {formatPercent(r?.probability)}</span>
                <span className="meta-chip">🎁 {formatRewardType(r?.type)}</span>
                <span className="meta-chip">📦 {r?.stock === null || r?.stock === undefined ? '不限' : Number(r?.stock || 0)}</span>
              </div>
              {r?.publicRuleText ? <div className="reward-rule-text">{String(r.publicRuleText)}</div> : null}
            </div>
          ))}
          {!publicRewardPool.length ? <div className="history-empty">暂无奖池配置</div> : null}
        </div>
      </Modal>

      <Modal
        title="🎉 恭喜获得"
        open={opened && rewards.length > 0}
        onCancel={() => setOpened(false)}
        centered
        width={360}
        className="chest-mobile-modal chest-reward-modal"
        footer={(
          <button className="modal-ok-btn" onClick={() => setOpened(false)}>
            太棒了
          </button>
        )}
      >
        {showRareTip ? <div className="reward-rare-tip">🏆 恭喜获得稀有奖励！</div> : null}
        <div className="reward-list">
          {rewards.map((r, idx) => (
            <div key={`${idx}-${r?.name}`} className="reward-item">
              <div className="reward-name">{r?.name || '-'}</div>
              <div className="reward-type">{r?.type || '-'}</div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        title="中奖记录"
        open={showHistory}
        onCancel={() => setShowHistory(false)}
        footer={null}
        centered
        width={360}
        className="chest-mobile-modal chest-history-modal"
      >
        <div className="history-modal-list">
          {history.length === 0 ? (
            <div className="history-empty">暂无中奖记录</div>
          ) : (
            history.map((h, idx) => (
              <div className="history-modal-item" key={`${h?.id || idx}-${h?.createdAt || idx}`}>
                <div className="line-a">
                  <span className="name">{h?.rewardName || h?.name || '-'}</span>
                  <span className="type">{formatRewardType(h?.rewardType || h?.type)}</span>
                </div>
                <div className="line-b">
                  <span>兑换码：{h?.redeemCode || '-'}</span>
                  <span>{formatBjt(h?.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal
        title="请先填写手机号"
        open={showPhoneModal}
        onCancel={() => {
          if (phone) setShowPhoneModal(false);
        }}
        onOk={() => void savePhone()}
        okText="保存"
        cancelButtonProps={{ style: phone ? undefined : { display: 'none' } }}
        maskClosable={false}
        centered
        width={360}
        className="chest-mobile-modal chest-phone-modal"
      >
        <div className="phone-modal-body">
          <div className="phone-modal-desc">绑定手机号后可参与活动并查询中奖记录</div>
          <Input
            value={phoneDraft}
            onChange={(e) => setPhoneDraft(String(e.target.value || '').replace(/\D/g, '').slice(0, 11))}
            maxLength={11}
            placeholder="请输入11位手机号"
            className="phone-modal-input"
          />
        </div>
      </Modal>
    </div>
  );
}
