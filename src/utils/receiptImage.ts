import dayjs from 'dayjs';

export type ReceiptTheme = {
    accent?: string;     // 主色
    accent2?: string;    // 辅色
    bg1?: string;
    bg2?: string;
    cardBg?: string;
    cardBorder?: string;
    textMain?: string;
    textMuted?: string;
};

export type GenerateReceiptImageOptions = {
    width?: number;              // 默认 560
    padding?: number;            // 默认 22
    headerHeight?: number;       // 默认 86
    lineHeight?: number;         // 默认 32
    radius?: number;             // 默认 20
    maxDpr?: number;             // 默认 3
    theme?: ReceiptTheme;        // 可选主题
};

const defaultTheme: Required<ReceiptTheme> = {
    accent: '#22d3ee',
    accent2: '#a78bfa',
    bg1: '#0b1220',
    bg2: '#0a0f1a',
    cardBg: 'rgba(255,255,255,0.78)',
    cardBorder: 'rgba(255,255,255,0.45)',
    textMain: '#0b1220',
    textMuted: '#6b7280',
};

export const generateReceiptImage = (title: string, text: string, opts: GenerateReceiptImageOptions = {}) => {
    const lines = String(text ?? '').split('\n');

    const W = opts.width ?? 560;
    const P = opts.padding ?? 22;
    const CARD_R = opts.radius ?? 20;

    const headerH = opts.headerHeight ?? 86;
    const lineH = opts.lineHeight ?? 32;

    const theme = { ...defaultTheme, ...(opts.theme ?? {}) };

    const dprRaw =
        typeof window !== 'undefined' && (window.devicePixelRatio || 1)
            ? Math.max(1, window.devicePixelRatio || 1)
            : 1;

    const maxDpr = opts.maxDpr ?? 3;
    const dpr = Math.min(maxDpr, dprRaw);

    const FONT_FAMILY =
        'ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", Arial';

    const FONT_NORMAL = `22px ${FONT_FAMILY}`;
    const FONT_NORMAL_BOLD = `700 22px ${FONT_FAMILY}`;
    const FONT_TIPS = `18px ${FONT_FAMILY}`;
    const FONT_TITLE = `800 30px ${FONT_FAMILY}`;
    const FONT_FOOT = `16px ${FONT_FAMILY}`;

    const canvasTmp = document?.createElement?.('canvas');
    if (!canvasTmp) return null;
    canvasTmp.width = Math.floor(W * dpr);
    canvasTmp.height = Math.floor(10 * dpr);
    canvasTmp.style.width = `${W}px`;
    canvasTmp.style.height = `10px`;

    const tctx = canvasTmp.getContext('2d');
    if (!tctx) return null;
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const maxTextW = W - P * 2 - 18;

    const wrapLines = (ctx: CanvasRenderingContext2D, s: string, maxW: number, font: string) => {
        ctx.font = font;
        const out: string[] = [];
        let cur = '';
        for (const ch of s) {
            const next = cur + ch;
            if (ctx.measureText(next).width > maxW) {
                if (cur) out.push(cur);
                cur = ch;
            } else {
                cur = next;
            }
        }
        if (cur) out.push(cur);
        return out.length ? out : [''];
    };

    // ✅ 分段：温馨提醒之后使用更小字体（原逻辑保留）
    let inTips = false;
    const prepared: Array<{ text: string; kind: 'normal' | 'tips' | 'blank' }> = [];
    for (const raw of lines) {
        const ln = String(raw ?? '');
        if (!ln) {
            prepared.push({ text: '', kind: 'blank' });
            continue;
        }
        if (ln.includes('温馨提醒')) inTips = true;
        prepared.push({ text: ln, kind: inTips ? 'tips' : 'normal' });
    }

    // 先估算实际渲染行数（考虑换行）
    const expanded: Array<{ text: string; kind: 'normal' | 'tips' | 'blank' }> = [];
    for (const it of prepared) {
        if (it.kind === 'blank') {
            expanded.push({ text: '', kind: 'blank' });
            continue;
        }
        const font = it.kind === 'tips' ? FONT_TIPS : FONT_NORMAL;
        const ws = wrapLines(tctx, it.text, maxTextW, font);
        ws.forEach((w) => expanded.push({ text: w, kind: it.kind }));
    }

    const bodyH = expanded.length * lineH + 96;
    const H = P * 2 + headerH + bodyH;

    const canvas = document?.createElement?.('canvas');
    if (!canvas) return null;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // =========================
    // 背景：深色渐变 + 轻噪点
    // =========================
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, theme.bg1);
    bg.addColorStop(1, theme.bg2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const addNoise = (alpha = 0.035) => {
        const step = 2;
        ctx.save();
        ctx.globalAlpha = alpha;
        for (let yy = 0; yy < H; yy += step) {
            for (let xx = 0; xx < W; xx += step) {
                const v = Math.random() * 255;
                ctx.fillStyle = `rgb(${v},${v},${v})`;
                ctx.fillRect(xx, yy, 1, 1);
            }
        }
        ctx.restore();
    };
    addNoise(0.035);

    const glowBlob = (cx: number, cy: number, r: number, rgb: string, a: number) => {
        ctx.save();
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(${rgb},${a})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };
    glowBlob(W * 0.15, H * 0.10, 220, '34,211,238', 0.20);
    glowBlob(W * 0.85, H * 0.18, 240, '167,139,250', 0.18);

    // =========================
    // 卡片
    // =========================
    const x = P;
    const y = P;
    const cw = W - P * 2;
    const ch = H - P * 2;

    const roundRect = (rx: number, ry: number, rw: number, rh: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(rx + r, ry);
        ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
        ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
        ctx.arcTo(rx, ry + rh, rx, ry, r);
        ctx.arcTo(rx, ry, rx + rw, ry, r);
        ctx.closePath();
    };

    ctx.save();
    ctx.shadowColor = 'rgba(34, 211, 238, 0.25)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    roundRect(x, y, cw, ch, CARD_R);
    ctx.fillStyle = theme.cardBg;
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRect(x + 0.5, y + 0.5, cw - 1, ch - 1, CARD_R);
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // =========================
    // Header
    // =========================
    roundRect(x, y, cw, headerH, CARD_R);
    ctx.save();
    ctx.clip();
    const hg = ctx.createLinearGradient(x, y, x + cw, y + headerH);
    hg.addColorStop(0, '#0b1220');
    hg.addColorStop(0.55, '#111827');
    hg.addColorStop(1, '#0b1220');
    ctx.fillStyle = hg;
    ctx.fillRect(x, y, cw, headerH);

    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y + 10, cw, 1);
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.35;
    const spot = ctx.createRadialGradient(x + cw - 56, y + 28, 0, x + cw - 56, y + 28, 42);
    spot.addColorStop(0, 'rgba(255,255,255,0.9)');
    spot.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.arc(x + cw - 56, y + 28, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = FONT_TITLE;
    ctx.fillText(title, x + 22, y + 56);

    // 撕口
    const punch = (cy: number) => {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        const r = 5;
        const gap = 16;
        for (let px = x + 18; px < x + cw - 18; px += gap) {
            ctx.beginPath();
            ctx.arc(px, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    };
    punch(y + headerH);

    // =========================
    // 内容
    // =========================
    const isKeyLine = (s: string) =>
        s.startsWith('下单项目：') ||
        s.startsWith('订单时长：') ||
        s.startsWith('订单保底：') ||
        s.startsWith('预计结单时间：');

    let yy = y + headerH + 38;

    for (const it of expanded) {
        if (it.kind === 'blank') {
            yy += lineH * 0.55;
            continue;
        }

        if (it.kind === 'tips') {
            ctx.font = FONT_TIPS;
            ctx.fillStyle = theme.textMuted;
        } else {
            ctx.font = FONT_NORMAL;
            ctx.fillStyle = theme.textMain;
        }

        const shouldHighlight = it.kind === 'normal' && isKeyLine(it.text);

        if (shouldHighlight) {
            const idx = it.text.indexOf('：');
            const left = idx >= 0 ? it.text.slice(0, idx + 1) : it.text;
            const right = idx >= 0 ? it.text.slice(idx + 1) : '';

            // 荧光底
            ctx.save();
            ctx.font = FONT_NORMAL_BOLD;

            const leftW = (() => {
                ctx.font = FONT_NORMAL;
                return ctx.measureText(left).width;
            })();
            const valueW = ctx.measureText(right).width;

            const padX = 10;
            const padY = 7;
            const bx = x + 20 + leftW + 2;
            const by = yy - 22 - padY;
            const bw = Math.min(valueW + padX * 2, cw - 40 - leftW);
            const bh = 28 + padY * 2;

            const vg = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
            vg.addColorStop(0, 'rgba(34, 211, 238, 0.18)');
            vg.addColorStop(1, 'rgba(167, 139, 250, 0.16)');
            ctx.fillStyle = vg;

            const rr = 12;
            ctx.beginPath();
            ctx.moveTo(bx + rr, by);
            ctx.arcTo(bx + bw, by, bx + bw, by + bh, rr);
            ctx.arcTo(bx + bw, by + bh, bx, by + bh, rr);
            ctx.arcTo(bx, by + bh, bx, by, rr);
            ctx.arcTo(bx, by, bx + bw, by, rr);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = 'rgba(34, 211, 238, 0.28)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();

            // 左 label
            ctx.font = FONT_NORMAL;
            ctx.fillStyle = '#334155';
            ctx.fillText(left, x + 20, yy);

            // 右 value
            ctx.save();
            ctx.font = FONT_NORMAL_BOLD;
            ctx.shadowColor = 'rgba(34, 211, 238, 0.25)';
            ctx.shadowBlur = 10;
            ctx.fillStyle = theme.textMain;
            ctx.fillText(right, x + 20 + leftW + 10, yy);
            ctx.restore();
        } else {
            ctx.fillText(it.text, x + 20, yy);
        }

        yy += lineH;
    }

    // =========================
    // Footer
    // =========================
    const footerY = y + ch - 56;

    const dg = ctx.createLinearGradient(x + 20, 0, x + cw - 20, 0);
    dg.addColorStop(0, 'rgba(34,211,238,0)');
    dg.addColorStop(0.5, 'rgba(148,163,184,0.55)');
    dg.addColorStop(1, 'rgba(167,139,250,0)');
    ctx.strokeStyle = dg;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 20, footerY);
    ctx.lineTo(x + cw - 20, footerY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(148, 163, 184, 0.95)';
    ctx.font = FONT_FOOT;
    const rightText = dayjs().format('YYYY-MM-DD HH:mm');
    ctx.fillText(`BlueCat · 订单专用小票 · ${rightText}`, x + 20, footerY + 32);

    return canvas.toDataURL('image/png');
};
