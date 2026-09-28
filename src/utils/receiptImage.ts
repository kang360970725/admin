import dayjs from 'dayjs';

export type ReceiptTheme = {
    accent?: string;
    accent2?: string;
    bg1?: string;
    bg2?: string;
    cardBg?: string;
    cardBorder?: string;
    textMain?: string;
    textMuted?: string;
};

export type GenerateReceiptImageOptions = {
    width?: number;
    padding?: number;
    headerHeight?: number;
    lineHeight?: number;
    radius?: number;
    maxDpr?: number;
    theme?: ReceiptTheme;
};

type ParsedReceipt = {
    orderNo?: string;
    project?: string;
    orderMetricLabel?: string;
    orderMetricValue?: string;
    financeItems: Array<{ label: string; value: string; isBold?: boolean; color?: string }>;
    serviceName?: string;
    players: string[];
    orderTime?: string;
    waitTime?: string;
    estimatedEndTime?: string;
    tips: string[];
};

const normalizeText = (input: string) => String(input ?? '').replace(/\r/g, '').trimEnd();

const splitLabelValue = (line: string) => {
    const idx = line.search(/[：:]/);
    if (idx < 0) return null;
    const label = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    return {label, value};
};

const parseReceipt = (text: string): ParsedReceipt => {
    const model: ParsedReceipt = {players: [], tips: [], financeItems: []};
    const lines = String(text ?? '')
        .split('\n')
        .map((line) => normalizeText(line));

    let collectingPlayers = false;
    let collectingTips = false;

    for (const rawLine of lines) {
        const line = String(rawLine ?? '').trimEnd();
        if (!line.trim()) {
            collectingPlayers = false;
            continue;
        }

        const normalized = line.trim();
        const pair = splitLabelValue(normalized);

        if (collectingTips) {
            model.tips.push(normalized);
            continue;
        }

        if (pair) {
            const {label, value} = pair;
            if (!label) continue;

            if (label === '温馨提醒') {
                collectingPlayers = false;
                collectingTips = true;
                if (value) model.tips.push(value);
                continue;
            }

            if (label === '接待陪玩' || label === '接单陪玩') {
                collectingPlayers = true;
                if (value) model.players.push(value);
                continue;
            }

            if (
                label === '支付方式' ||
                label === '派单方式' ||
                label === '商品小计' ||
                label === '人工调整' ||
                label === '人工优惠' ||
                label === '优惠券抵扣' ||
                label === '实付金额' ||
                label === '储值扣除' ||
                label === '储值余额'
            ) {
                model.financeItems.push({
                    label,
                    value,
                    isBold: label === '实付金额' || label === '储值扣除',
                    color: label === '实付金额' || label === '储值扣除' ? '#ec4899' : undefined,
                });
                continue;
            }

            collectingPlayers = false;

            switch (label) {
                case '订单编号':
                    model.orderNo = value;
                    break;
                case '下单项目':
                    model.project = value;
                    break;
                case '订单保底':
                case '订单时长':
                    model.orderMetricLabel = label;
                    model.orderMetricValue = value;
                    break;
                case '接待客服':
                    model.serviceName = value;
                    break;
                case '下单时间':
                    model.orderTime = value;
                    break;
                case '预计等待时间':
                    model.waitTime = value;
                    break;
                case '预计结单时间':
                    model.estimatedEndTime = value;
                    break;
                default:
                    break;
            }
            continue;
        }

        if (collectingPlayers) {
            model.players.push(normalized.replace(/^\s+/, ''));
            continue;
        }
    }

    return model;
};

const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill?: string | CanvasGradient,
    stroke?: string,
) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.stroke();
    }
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    let line = '';
    const lines: string[] = [];
    for (const ch of String(text ?? '')) {
        const test = line + ch;
        if (ctx.measureText(test).width > maxWidth && line !== '') {
            lines.push(line);
            line = ch;
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
};

const generateReceiptImageLegacy = async (title: string, text: string, opts: GenerateReceiptImageOptions = {}) => {
    if (typeof document === 'undefined') return null;

    const QUALITY = Math.min(opts.maxDpr ?? 3, Math.max(2, window.devicePixelRatio || 1));
    const COLORS = {
        bg: '#ffffff',
        primary: '#ec4899',
        secondary: '#f472b6',
        accent: '#fb923c',
        textMain: '#374151',
        textMuted: '#9ca3af',
        lightPink: '#fdf2f8',
        lightPurple: '#f5f3ff',
        lightOrange: '#fff7ed',
        success: '#10b981',
    };

    const parsed = parseReceipt(text);
    const orderNo = parsed.orderNo || '-';
    const project = parsed.project || '-';
    const orderMetricLabel = parsed.orderMetricLabel || '订单保底';
    const orderMetricValue = parsed.orderMetricValue || '-';
    const financeItems = parsed.financeItems.length
        ? parsed.financeItems
        : [
              // {label: '支付方式', value: '支付宝支付 💳'},
              {label: '商品小计', value: '¥ 0.00'},
              {label: '实付金额', value: '¥ 0.00', isBold: true, color: COLORS.primary},
          ];
    const serviceName = parsed.serviceName || '-';
    const players = parsed.players.length ? parsed.players : ['-'] + '🎮';
    const orderTime = parsed.orderTime || '-';
    const waitTime = parsed.waitTime || '5-10分钟';
    const tips = [
        '消费过程中如遇任何问题，请随时联系本单客服处理~',
        '订单完结24小时内支持售后，客服为售后唯一渠道；',
        '请勿相信其他任何人，谨防上当受骗。',
        '本店通过各类渠道收集客服或打手私联接单证据，',
        '举报查实私加联系方式及私单奖 500-2000R',
    ];

    const financeTop = 570;
    const financeBoxHeight = 90 + Math.max(0, financeItems.length - 2) * 30;
    const complaintGap = 20;
    const complaintTop = financeTop + financeBoxHeight + complaintGap;
    const complaintLineGap = 26;
    const complaintBoxHeight = 91 + Math.max(0, tips.length - 1) * complaintLineGap;
    const footerCenterY = complaintTop + complaintBoxHeight + 25;
    const contentH = Math.max(990, footerCenterY + 110);

    const createCanvas = (w: number, h: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * QUALITY);
        canvas.height = Math.round(h * QUALITY);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.setTransform(QUALITY, 0, 0, QUALITY, 0, 0);
        return {canvas, ctx};
    };

    const contentW = 450;
    const content = createCanvas(contentW, contentH);
    if (!content) return null;
    const C = content.ctx;

    // content canvas: replicate the original receipt canvas only
    C.clearRect(0, 0, contentW, contentH);
    roundRect(C, 0, 0, contentW, contentH, 38, COLORS.bg);

    const centerX = contentW / 2;

    const drawHeader = () => {
        const centerY = 100;

        C.beginPath();
        C.fillStyle = COLORS.lightPink;
        C.arc(centerX, centerY, 50, 0, Math.PI * 2);
        C.fill();

        C.fillStyle = COLORS.lightPink;
        C.beginPath();
        C.moveTo(centerX - 45, centerY - 20);
        C.quadraticCurveTo(centerX - 55, centerY - 65, centerX - 15, centerY - 48);
        C.fill();
        C.beginPath();
        C.moveTo(centerX + 45, centerY - 20);
        C.quadraticCurveTo(centerX + 55, centerY - 65, centerX + 15, centerY - 48);
        C.fill();

        C.fillStyle = COLORS.textMain;
        C.beginPath();
        C.arc(centerX - 18, centerY - 5, 4, 0, Math.PI * 2);
        C.arc(centerX + 18, centerY - 5, 4, 0, Math.PI * 2);
        C.fill();

        C.fillStyle = '#ffb6c1';
        C.globalAlpha = 0.6;
        C.beginPath();
        C.ellipse(centerX - 30, centerY + 10, 8, 5, 0, 0, Math.PI * 2);
        C.ellipse(centerX + 30, centerY + 10, 8, 5, 0, 0, Math.PI * 2);
        C.fill();
        C.globalAlpha = 1;

        C.strokeStyle = COLORS.textMain;
        C.lineWidth = 2;
        C.beginPath();
        C.moveTo(centerX - 5, centerY + 10);
        C.quadraticCurveTo(centerX, centerY + 15, centerX + 5, centerY + 10);
        C.stroke();

        C.beginPath();
        C.moveTo(centerX - 40, centerY + 5);
        C.lineTo(centerX - 60, centerY + 2);
        C.moveTo(centerX - 40, centerY + 12);
        C.lineTo(centerX - 60, centerY + 15);
        C.moveTo(centerX + 40, centerY + 5);
        C.lineTo(centerX + 60, centerY + 2);
        C.moveTo(centerX + 40, centerY + 12);
        C.lineTo(centerX + 60, centerY + 15);
        C.stroke();

        C.fillStyle = COLORS.primary;
        C.font = 'bold 28px sans-serif';
        C.textAlign = 'center';
        C.fillText(`蓝猫爽打 · 订单小票`, centerX, centerY + 85);
        C.fillStyle = COLORS.textMuted;
        C.font = '16px sans-serif';
        C.fillText('每一局游戏，都有蓝猫守护', centerX, centerY + 110);
        C.fillStyle = COLORS.textMain;
        C.font = 'bold 13px monospace';
        C.fillText(`订单编号：${orderNo}`, centerX, centerY + 132);
    };

    const drawCoreInfo = () => {
        const startY = 255;
        const margin = 30;
        const width = 390;

        roundRect(C, margin, startY, width, 210, 20, COLORS.lightOrange);

        C.textAlign = 'left';
        C.fillStyle = COLORS.textMain;
        C.font = 'bold 18px sans-serif';
        C.fillText('下单项目：', margin + 20, startY + 35);
        C.fillText(`${orderMetricLabel}：`, margin + 20, startY + 80);
        C.fillText('接待客服：', margin + 20, startY + 125);
        C.fillText('接待陪玩：', margin + 20, startY + 170);

        roundRect(C, margin + 110, startY + 13, 230, 32, 8, COLORS.accent);
        C.fillStyle = '#ffffff';
        C.font = 'bold 16px sans-serif';
        const projectLines = wrapText(C, project, 210);
        C.fillText(projectLines[0], margin + 120, startY + 35);

        roundRect(C, margin + 110, startY + 58, 120, 32, 8, COLORS.accent);
        C.fillStyle = '#ffffff';
        C.fillText(orderMetricValue, margin + 120, startY + 80);

        C.fillStyle = COLORS.textMain;
        C.font = '18px sans-serif';
        C.fillText(serviceName, margin + 110, startY + 125);

        C.fillStyle = COLORS.textMain;
        C.font = '18px sans-serif';
        const playX = margin + 110;
        const playMaxWidth = contentW - margin - 20 - playX;
        const playerText = Array.isArray(players) ? players.join(' ') : String(players);
        wrapText(C, playerText, playMaxWidth).forEach((line, i) => {
            C.fillText(line, playX, startY + 170 + i * 26);
        });
    };

    const drawTimeInfo = () => {
        const timeY = 480;
        C.textAlign = 'left';
        C.fillStyle = COLORS.primary;
        C.font = '14px sans-serif';
        C.fillText(`预计等待时间：${waitTime} ⏱️`, 50, timeY + 20);

        C.fillStyle = COLORS.textMuted;
        C.font = '14px sans-serif';
        C.fillText(`下单时间：${orderTime}`, 50, timeY + 48);

        C.setLineDash([5, 5]);
        C.strokeStyle = '#e5e7eb';
        C.beginPath();
        C.moveTo(30, timeY + 70);
        C.lineTo(contentW - 30, timeY + 70);
        C.stroke();
        C.setLineDash([]);
    };

    const drawFinancialDetails = () => {
        const financeY = financeTop;
        const margin = 30;
        const width = 390;
        roundRect(C, margin, financeY, width, financeBoxHeight, 20, COLORS.lightPurple);
        C.textAlign = 'left';
        C.fillStyle = COLORS.textMain;
        financeItems.forEach((item, index) => {
            const y = financeY + 35 + index * 30;
            C.textAlign = 'left';
            C.fillStyle = COLORS.textMain;
            C.font = '16px sans-serif';
            C.fillText(item.label, margin + 20, y);

            C.textAlign = 'right';
            C.fillStyle = item.color || COLORS.textMain;
            C.font = item.isBold ? 'bold 20px sans-serif' : '16px sans-serif';
            C.fillText(item.value, margin + width - 20, y);
        });
    };

    const drawComplaintInfo = () => {
        const complaintY = complaintTop;
        const margin = 30;
        const width = 390;
        roundRect(C, margin, complaintY, width, complaintBoxHeight, 20, '#fce4ec');

        C.textAlign = 'left';
        C.fillStyle = COLORS.textMain;
        C.font = 'bold 17px sans-serif';
        C.fillText('📢 售后与投诉须知', margin + 20, complaintY + 32);

        C.font = '13px sans-serif';
        tips.forEach((line, i) => {
            const isHighlighted =
                String(line).includes('本店通过各类渠道') ||
                String(line).includes('举报查实私加联系方式及私单奖');
            C.fillStyle = isHighlighted ? COLORS.primary : '#6b7280';
            C.font = isHighlighted ? 'bold 13px sans-serif' : '13px sans-serif';
            C.fillText(line, margin + 20, complaintY + 60 + i * 26);
        });
    };

    const drawFooter = () => {
        C.textAlign = 'center';

        C.fillStyle = COLORS.primary;
        C.font = 'bold 16px sans-serif';
        C.fillText('感谢你的选择，喵~ 🐱 期待下次陪你一起玩！', centerX, footerCenterY);

        C.fillStyle = COLORS.textMuted;
        C.font = '12px sans-serif';
        C.fillText('官方社交账号：微信公众号 | 抖音 | 小红书 @蓝猫爽打 @蓝猫爽打AIGC', centerX, footerCenterY + 25);

        C.fillStyle = COLORS.secondary;
        C.font = 'italic 14px sans-serif';
        C.fillText('" 喵喵喵！记得给我们好评哦～ 🐾 "', centerX, footerCenterY + 50);

        C.fillStyle = '#d1d5db';
        C.font = '10px monospace';
        C.fillText(`BlueCat · 萌爪订单小票 · ${dayjs().format('YYYY-MM-DD HH:mm')}`, centerX, footerCenterY + 70);
    };

    const drawDecorations = () => {
        const items = [
            {x: 40, y: 60, type: 'paw'},
            {x: 380, y: 150, type: 'star'},
            {x: 50, y: contentH - 50, type: 'heart'},
            {x: 400, y: contentH - 40, type: 'paw'},
            {x: 30, y: 350, type: 'star'},
        ];

        items.forEach((item) => {
            C.globalAlpha = 0.3;
            if (item.type === 'paw') {
                C.fillStyle = COLORS.secondary;
                C.beginPath();
                C.ellipse(item.x, item.y + 7.5, 15, 12, 0, 0, Math.PI * 2);
                C.fill();
                C.beginPath();
                C.arc(item.x - 15, item.y - 3.75, 6, 0, Math.PI * 2);
                C.arc(item.x - 5, item.y - 15, 6, 0, Math.PI * 2);
                C.arc(item.x + 5, item.y - 15, 6, 0, Math.PI * 2);
                C.arc(item.x + 15, item.y - 3.75, 6, 0, Math.PI * 2);
                C.fill();
            }
            if (item.type === 'star') {
                let rot = (Math.PI / 2) * 3;
                const spikes = 5;
                const outerRadius = 8;
                const innerRadius = outerRadius / 2;
                let x = item.x;
                let y = item.y;
                const step = Math.PI / spikes;
                C.beginPath();
                C.moveTo(item.x, item.y - outerRadius);
                for (let i = 0; i < spikes; i++) {
                    x = item.x + Math.cos(rot) * outerRadius;
                    y = item.y + Math.sin(rot) * outerRadius;
                    C.lineTo(x, y);
                    rot += step;
                    x = item.x + Math.cos(rot) * innerRadius;
                    y = item.y + Math.sin(rot) * innerRadius;
                    C.lineTo(x, y);
                    rot += step;
                }
                C.lineTo(item.x, item.y - outerRadius);
                C.closePath();
                C.fillStyle = COLORS.accent;
                C.fill();
            }
            if (item.type === 'heart') {
                C.fillStyle = COLORS.primary;
                C.save();
                C.translate(item.x, item.y);
                C.scale(12 / 80, 12 / 80);
                C.beginPath();
                C.moveTo(0, 0);
                C.bezierCurveTo(0, -3, -5, -15, -25, -15);
                C.bezierCurveTo(-55, -15, -55, 22.5, -55, 22.5);
                C.bezierCurveTo(-55, 40, -35, 62, 0, 80);
                C.bezierCurveTo(35, 62, 55, 40, 55, 22.5);
                C.bezierCurveTo(55, 22.5, 55, -15, 25, -15);
                C.bezierCurveTo(10, -15, 0, -3, 0, 0);
                C.closePath();
                C.fill();
                C.restore();
            }
            C.globalAlpha = 1;
        });
    };

    drawHeader();
    drawCoreInfo();
    drawTimeInfo();
    drawFinancialDetails();
    drawComplaintInfo();
    drawFooter();
    drawDecorations();

    // outer frame canvas wrapping the receipt canvas
    const frameOuterPad = 28;
    const frameInnerPad = 10;
    const frameW = contentW + frameOuterPad * 2 + frameInnerPad * 2;
    const frameH = contentH + frameOuterPad * 2 + frameInnerPad * 2;
    const finalW = frameW + 32;
    const finalH = frameH + 48;

    const final = createCanvas(finalW, finalH);
    if (!final) return null;
    const F = final.ctx;
    F.clearRect(0, 0, finalW, finalH);
    F.fillStyle = '#ffffff';
    F.fillRect(0, 0, finalW, finalH);

    const frameX = 16;
    const frameY = 24;
    const frameGrad = F.createLinearGradient(frameX, frameY, frameX + frameW, frameY + frameH);
    frameGrad.addColorStop(0, '#f8bbd0');
    frameGrad.addColorStop(0.4, '#ce93d8');
    frameGrad.addColorStop(1, '#f48fb1');
    F.save();
    F.shadowColor = 'rgba(233, 30, 99, 0.35)';
    F.shadowBlur = 18;
    F.shadowOffsetY = 8;
    roundRect(F, frameX, frameY, frameW, frameH, 48, frameGrad);
    F.restore();

    F.save();
    F.strokeStyle = 'rgba(255,255,255,0.35)';
    F.lineWidth = 3;
    roundRect(F, frameX + 8, frameY + 8, frameW - 16, frameH - 16, 42);
    F.stroke();
    F.restore();

    F.save();
    roundRect(F, frameX + frameOuterPad + 10, frameY + frameOuterPad + 10, frameW - (frameOuterPad + 10) * 2, frameH - (frameOuterPad + 10) * 2, 40, '#ffffff');
    F.restore();

    F.save();
    F.strokeStyle = 'rgba(255,255,255,0.48)';
    F.lineWidth = 2;
    roundRect(F, frameX + frameOuterPad + 10, frameY + frameOuterPad + 10, frameW - (frameOuterPad + 10) * 2, frameH - (frameOuterPad + 10) * 2, 36);
    F.stroke();
    F.restore();

    const topBadgeText = '欢迎板板大驾光临';
    F.save();
    F.font = '18px sans-serif';
    const topBadgeW = F.measureText(topBadgeText).width + 98;
    const topBadgeX = frameX + frameW / 2 - topBadgeW / 2;
    const topBadgeY = frameY - 8;
    const topBadgeGrad = F.createLinearGradient(topBadgeX, topBadgeY, topBadgeX + topBadgeW, topBadgeY + 42);
    topBadgeGrad.addColorStop(0, '#f8bbd0');
    topBadgeGrad.addColorStop(1, '#ce93d8');
    roundRect(F, topBadgeX, topBadgeY, topBadgeW, 42, 21, topBadgeGrad);
    F.fillStyle = '#ffffff';
    F.textAlign = 'center';
    F.textBaseline = 'middle';
    F.fillText(topBadgeText, frameX + frameW / 2, topBadgeY + 22);
    F.font = '22px sans-serif';
    F.fillText('♡', topBadgeX + 28, topBadgeY + 22);
    F.fillText('🐱', topBadgeX + topBadgeW - 28, topBadgeY + 22);
    F.restore();

    const bottomBadgeText = 'BlueCat · 蓝猫爽打 与您同行';
    F.save();
    F.font = '13px sans-serif';
    const bottomBadgeW = F.measureText(bottomBadgeText).width + 34;
    const bottomBadgeX = frameX + frameW / 2 - bottomBadgeW / 2;
    const bottomBadgeY = frameY + frameH - 30;
    roundRect(F, bottomBadgeX, bottomBadgeY, bottomBadgeW, 28, 14, 'rgba(255,255,255,0.86)');
    F.strokeStyle = 'rgba(206,147,216,0.25)';
    F.lineWidth = 1;
    roundRect(F, bottomBadgeX, bottomBadgeY, bottomBadgeW, 28, 14);
    F.stroke();
    F.fillStyle = COLORS.primary;
    F.textAlign = 'center';
    F.textBaseline = 'middle';
    F.fillText(bottomBadgeText, frameX + frameW / 2, bottomBadgeY + 14);
    F.restore();

    F.save();
    F.globalAlpha = 0.85;
    F.fillStyle = '#ffffff';
    F.beginPath();
    F.arc(frameX + 24, frameY + 24, 6, 0, Math.PI * 2);
    F.arc(frameX + 34, frameY + 16, 5, 0, Math.PI * 2);
    F.arc(frameX + 42, frameY + 26, 4.5, 0, Math.PI * 2);
    F.arc(frameX + 32, frameY + 32, 4, 0, Math.PI * 2);
    F.fill();
    F.beginPath();
    F.arc(frameX + frameW - 24, frameY + 54, 6, 0, Math.PI * 2);
    F.arc(frameX + frameW - 32, frameY + 44, 5, 0, Math.PI * 2);
    F.arc(frameX + frameW - 42, frameY + 56, 4.5, 0, Math.PI * 2);
    F.arc(frameX + frameW - 32, frameY + 64, 4, 0, Math.PI * 2);
    F.fill();
    F.beginPath();
    F.arc(frameX + 24, frameY + frameH - 36, 6, 0, Math.PI * 2);
    F.arc(frameX + 34, frameY + frameH - 44, 5, 0, Math.PI * 2);
    F.arc(frameX + 42, frameY + frameH - 34, 4.5, 0, Math.PI * 2);
    F.arc(frameX + 32, frameY + frameH - 28, 4, 0, Math.PI * 2);
    F.fill();
    F.beginPath();
    F.arc(frameX + frameW - 24, frameY + frameH - 34, 6, 0, Math.PI * 2);
    F.arc(frameX + frameW - 32, frameY + frameH - 44, 5, 0, Math.PI * 2);
    F.arc(frameX + frameW - 42, frameY + frameH - 32, 4.5, 0, Math.PI * 2);
    F.arc(frameX + frameW - 32, frameY + frameH - 26, 4, 0, Math.PI * 2);
    F.fill();
    F.restore();

    const contentX = frameX + frameOuterPad + frameInnerPad;
    const contentY = frameY + frameOuterPad + frameInnerPad;
    F.drawImage(content.canvas, contentX, contentY, contentW, contentH);

    return final.canvas.toDataURL('image/png');
};

/** BlueCat blue ticket-style receipt. Keep the text input as the source of truth so
 * new order fields can be added without coupling this image helper to order APIs. */
const generateReceiptImageBlueDraft = async (_title: string, text: string, opts: GenerateReceiptImageOptions = {}) => {
    if (typeof document === 'undefined') return null;

    const dpr = Math.min(opts.maxDpr ?? 3, Math.max(2, window.devicePixelRatio || 1));
    const parsed = parseReceipt(text);
    const W = Math.max(560, opts.width ?? 560);
    const scale = W / 560;
    const blue = opts.theme?.accent || '#2f70cf';
    const blueDark = '#1853a3';
    const blueLine = '#a9cdfb';
    const ink = '#202936';
    const muted = '#7185a3';
    const side = 34 * scale;
    const innerW = W - side * 2;

    const scratch = document.createElement('canvas');
    const measure = scratch.getContext('2d');
    if (!measure) return null;
    const font = (weight: string | number, size: number) => `${weight} ${size * scale}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    const getLines = (value: string, maxWidth: number, valueFont: string) => {
        measure.font = valueFont;
        return wrapText(measure, value || '-', maxWidth);
    };

    const playersText = parsed.players.length ? parsed.players.join('  ') : '（待派单/待接单）';
    const infoValueWidth = innerW - 158 * scale;
    const playerLines = getLines(playersText, infoValueWidth, font(400, 15));
    const projectLines = getLines(parsed.project || '-', infoValueWidth, font(600, 16));
    const infoRows = [
        {icon: '▣', label: '订单编号', lines: getLines(parsed.orderNo || '-', infoValueWidth, font(400, 14)), mono: true},
        {icon: '▤', label: '下单项目', lines: projectLines, strong: true},
        {icon: '◇', label: parsed.orderMetricLabel || '订单保底', lines: [parsed.orderMetricValue || '-'], strong: true},
        {icon: '♙', label: '接待客服', lines: [parsed.serviceName || '-']},
        {icon: '♧', label: '接待陪玩', lines: playerLines},
        {icon: '◷', label: '预计等待', lines: [parsed.waitTime || '5-10分钟'], strong: true},
        ...(parsed.estimatedEndTime ? [{icon: '◴', label: '预计结单', lines: [parsed.estimatedEndTime]}] : []),
        {icon: '▦', label: '下单时间', lines: [parsed.orderTime || '-']},
    ];
    const rowH = (row: {lines: string[]}) => Math.max(34 * scale, row.lines.length * 22 * scale + 8 * scale);
    const infoH = 62 * scale + infoRows.reduce((sum, row) => sum + rowH(row), 0) + 12 * scale;

    const financeItems = parsed.financeItems.length
        ? parsed.financeItems
        : [{label: '商品小计', value: '¥0.00'}, {label: '实付金额', value: '¥0.00', isBold: true}];
    const financeH = 64 * scale + financeItems.length * 36 * scale + 14 * scale;
    const tips = parsed.tips.length ? parsed.tips : [
        '消费过程中如遇任何问题，请随时联系本单客服处理～',
        '订单完结24小时内支持售后，客服为售后唯一渠道；',
        '请勿相信其他任何人，谨防上当受骗。',
    ];
    const tipLines = tips.flatMap((tip) => getLines(tip, innerW - 40 * scale, font(400, 13)));
    const noticeH = 70 * scale + tipLines.length * 22 * scale + 52 * scale;
    const qrH = 150 * scale;
    const headerH = 315 * scale;
    const footerH = 196 * scale;
    const gap = 18 * scale;
    const H = headerH + infoH + financeH + noticeH + qrH + footerH + gap * 5;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rr = (x: number, y: number, w: number, h: number, r: number, fill?: string | CanvasGradient, stroke?: string) => {
        ctx.lineWidth = 1 * scale;
        roundRect(ctx, x, y, w, h, r, fill, stroke);
    };
    const label = (value: string, x: number, y: number, size: number, color = ink, weight: string | number = 400, align: CanvasTextAlign = 'left') => {
        ctx.font = font(weight, size);
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(value, x, y);
    };
    const dashed = (x1: number, y: number, x2: number) => {
        ctx.save();
        ctx.setLineDash([6 * scale, 6 * scale]);
        ctx.strokeStyle = blueLine;
        ctx.lineWidth = 1 * scale;
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
        ctx.restore();
    };
    const sparkle = (x: number, y: number, radius: number, color = blue) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - radius); ctx.quadraticCurveTo(x + radius * .22, y - radius * .22, x + radius, y);
        ctx.quadraticCurveTo(x + radius * .22, y + radius * .22, x, y + radius);
        ctx.quadraticCurveTo(x - radius * .22, y + radius * .22, x - radius, y);
        ctx.quadraticCurveTo(x - radius * .22, y - radius * .22, x, y - radius); ctx.fill();
    };
    const section = (y: number, height: number, titleCn: string, titleEn: string, warm = false) => {
        const gradient = ctx.createLinearGradient(side, y, W - side, y + height);
        if (warm) { gradient.addColorStop(0, '#fffaf0'); gradient.addColorStop(1, '#fff7e4'); }
        else { gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(1, '#f5f9ff'); }
        rr(side, y, innerW, height, 20 * scale, gradient, warm ? '#f1d9a5' : blueLine);
        label(titleCn, side + 20 * scale, y + 36 * scale, 19, warm ? '#334155' : blueDark, 700);
        if (titleEn) label(titleEn, side + 112 * scale, y + 34 * scale, 10, warm ? '#b79c6c' : '#92b9ee', 500);
        dashed(side, y + 52 * scale, W - side);
    };

    // paper and soft blue halo
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#edf5ff'); bg.addColorStop(.48, '#ffffff'); bg.addColorStop(1, '#e6f0ff');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.shadowColor = 'rgba(38,101,190,.22)'; ctx.shadowBlur = 25 * scale; ctx.shadowOffsetY = 8 * scale;
    rr(18 * scale, 12 * scale, W - 36 * scale, H - 24 * scale, 16 * scale, '#ffffff'); ctx.restore();

    // ticket perforations
    ctx.fillStyle = '#e4efff';
    for (let x = 44 * scale; x < W - 30 * scale; x += 38 * scale) {
        ctx.beginPath(); ctx.arc(x, 12 * scale, 10 * scale, 0, Math.PI); ctx.fill();
    }
    [76, H / scale - 76].forEach((yy) => {
        ctx.beginPath(); ctx.arc(18 * scale, yy * scale, 11 * scale, -.5 * Math.PI, .5 * Math.PI); ctx.fill();
        ctx.beginPath(); ctx.arc(W - 18 * scale, yy * scale, 11 * scale, .5 * Math.PI, 1.5 * Math.PI); ctx.fill();
    });

    label('♡  欢迎板板大驾光临  🐱', W / 2, 52 * scale, 18, blueDark, 500, 'center');
    sparkle(W - 56 * scale, 46 * scale, 8 * scale);
    dashed(side + 4 * scale, 72 * scale, W - side - 4 * scale);

    // abstract blue cat mascot, matching the reference without requiring a remote asset
    const cx = W / 2;
    const catY = 112 * scale;
    ctx.save();
    const catGrad = ctx.createLinearGradient(cx - 70 * scale, catY, cx + 70 * scale, catY + 90 * scale);
    catGrad.addColorStop(0, '#9bc9ff'); catGrad.addColorStop(1, '#4f91e8');
    ctx.fillStyle = catGrad;
    ctx.beginPath(); ctx.moveTo(cx - 62 * scale, catY + 40 * scale); ctx.lineTo(cx - 53 * scale, catY - 8 * scale);
    ctx.lineTo(cx - 22 * scale, catY + 13 * scale); ctx.quadraticCurveTo(cx, catY, cx + 22 * scale, catY + 13 * scale);
    ctx.lineTo(cx + 53 * scale, catY - 8 * scale); ctx.lineTo(cx + 62 * scale, catY + 40 * scale);
    ctx.quadraticCurveTo(cx + 66 * scale, catY + 91 * scale, cx, catY + 91 * scale);
    ctx.quadraticCurveTo(cx - 66 * scale, catY + 91 * scale, cx - 62 * scale, catY + 40 * scale); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(cx - 23 * scale, catY + 48 * scale, 17 * scale, 22 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 23 * scale, catY + 48 * scale, 17 * scale, 22 * scale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#174c92';
    ctx.beginPath(); ctx.arc(cx - 23 * scale, catY + 51 * scale, 8 * scale, 0, Math.PI * 2); ctx.arc(cx + 23 * scale, catY + 51 * scale, 8 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f29ab0'; ctx.beginPath(); ctx.arc(cx, catY + 70 * scale, 4 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = blueDark; ctx.lineWidth = 2 * scale; ctx.beginPath(); ctx.moveTo(cx, catY + 74 * scale); ctx.quadraticCurveTo(cx - 7 * scale, catY + 83 * scale, cx - 13 * scale, catY + 76 * scale); ctx.moveTo(cx, catY + 74 * scale); ctx.quadraticCurveTo(cx + 7 * scale, catY + 83 * scale, cx + 13 * scale, catY + 76 * scale); ctx.stroke();
    ctx.restore();

    label('蓝猫爽打 · 订单小票', W / 2, 242 * scale, 32, blue, 800, 'center');
    label('每一局游戏，都有蓝猫守护', W / 2, 274 * scale, 16, blueDark, 500, 'center');
    label('BLUECAT', W / 2, 296 * scale, 10, '#f0ad22', 600, 'center');

    let y = headerH + gap;
    section(y, infoH, '订单信息', 'ORDER INFORMATION');
    let rowY = y + 75 * scale;
    infoRows.forEach((row) => {
        const h = rowH(row);
        label(row.icon, side + 22 * scale, rowY, 16, blueDark, 600);
        label(`${row.label}：`, side + 52 * scale, rowY, 14, ink, 400);
        row.lines.forEach((line, index) => label(
            line,
            side + 142 * scale,
            rowY + index * 22 * scale,
            'mono' in row && row.mono ? 13 : 15,
            'strong' in row && row.strong ? blue : ink,
            'strong' in row && row.strong ? 700 : 400,
        ));
        rowY += h;
    });

    y += infoH + gap;
    section(y, financeH, '结算信息', 'PAYMENT INFORMATION');
    financeItems.forEach((item, index) => {
        const fy = y + (79 + index * 36) * scale;
        label(`${index === 0 ? '▧' : index === financeItems.length - 1 ? '▣' : '◇'}  ${item.label}：`, side + 22 * scale, fy, 14, ink, 400);
        label(item.value, W - side - 24 * scale, fy, item.isBold ? 20 : 15, item.isBold ? blue : ink, item.isBold ? 700 : 400, 'right');
    });

    y += financeH + gap;
    section(y, noticeH, '📣  售后与投诉须知', '', true);
    tipLines.forEach((line, index) => label(line, side + 20 * scale, y + (80 + index * 22) * scale, 13, index >= Math.max(0, tipLines.length - 2) ? blueDark : '#596474', index >= Math.max(0, tipLines.length - 2) ? 600 : 400));
    label('本店通过各类渠道收集客服或打手私联接单证据，', side + 20 * scale, y + noticeH - 42 * scale, 12, blueDark, 600);
    label('举报查实私加联系方式及私单奖 500-2000R', side + 20 * scale, y + noticeH - 20 * scale, 12, blue, 700);

    y += noticeH + gap;
    const qrGradient = ctx.createLinearGradient(side, y, W - side, y + qrH);
    qrGradient.addColorStop(0, '#eef6ff'); qrGradient.addColorStop(1, '#ffffff');
    rr(side, y, innerW, qrH, 20 * scale, qrGradient, blueLine);
    const qrSize = 106 * scale;
    rr(side + 20 * scale, y + 22 * scale, qrSize, qrSize, 12 * scale, '#ffffff', blueLine);
    ctx.save(); ctx.setLineDash([5 * scale, 4 * scale]); ctx.strokeStyle = '#73a9ed'; ctx.lineWidth = 2 * scale;
    roundRect(ctx, side + 30 * scale, y + 32 * scale, qrSize - 20 * scale, qrSize - 20 * scale, 8 * scale); ctx.stroke(); ctx.restore();
    label('小程序码', side + 73 * scale, y + 72 * scale, 14, blue, 700, 'center');
    label('预留区域', side + 73 * scale, y + 94 * scale, 11, muted, 400, 'center');
    label('扫码进入蓝猫爽打小程序', side + 150 * scale, y + 58 * scale, 17, blueDark, 700);
    label('查订单 · 找客服 · 享福利', side + 150 * scale, y + 87 * scale, 14, muted, 400);
    label('请将正式小程序码替换至左侧区域', side + 150 * scale, y + 113 * scale, 11, '#91a3bb', 400);

    y += qrH + gap;
    sparkle(side + 20 * scale, y + 28 * scale, 7 * scale, '#f1bd42');
    sparkle(W - side - 20 * scale, y + 28 * scale, 7 * scale, '#69a8f0');
    label('感谢你的选择，喵～ 🐱 期待下次陪你一起玩！', W / 2, y + 34 * scale, 16, blueDark, 700, 'center');
    label('官方社交账号：微信公众号｜抖音｜小红书 @蓝猫爽打', W / 2, y + 64 * scale, 12, muted, 400, 'center');
    label('“喵喵喵！记得给我们好评哦～ 🐾”', W / 2, y + 91 * scale, 14, blue, 500, 'center');
    dashed(side + 4 * scale, y + 114 * scale, W - side - 4 * scale);
    label(`BlueCat · 萌爪订单小票 · ${dayjs().format('YYYY-MM-DD HH:mm')}`, W / 2, y + 135 * scale, 11, muted, 400, 'center');
    const bar = ctx.createLinearGradient(side, 0, W - side, 0); bar.addColorStop(0, '#4d94e8'); bar.addColorStop(1, '#2470ce');
    rr(side, y + 147 * scale, innerW, 34 * scale, 8 * scale, bar);
    label('✦  BlueCat · 蓝猫爽打 与您同行  ✦', W / 2, y + 170 * scale, 14, '#ffffff', 500, 'center');

    return canvas.toDataURL('image/png');
};

const loadReceiptAsset = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load receipt asset: ${src}`));
        image.src = src;
    });

let receiptFontPromise: Promise<void> | null = null;
const ensureReceiptFont = async () => {
    if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
    if (!receiptFontPromise) {
        receiptFontPromise = new FontFace(
            'Alimama FangYuanTi VF',
            'url(/receipt-assets/AlimamaFangYuanTiVF.woff2) format("woff2")',
            {weight: '100 900'},
        )
            .load()
            .then((loadedFont) => {
                document.fonts.add(loadedFont);
            })
            .catch(() => undefined);
    }
    await receiptFontPromise;
};

/**
 * PSD-backed receipt renderer. The exported PSD artwork contains no sample text,
 * so all customer/order values below remain live data rather than baked pixels.
 */
export const generateReceiptImage = async (_title: string, text: string, opts: GenerateReceiptImageOptions = {}) => {
    if (typeof document === 'undefined') return null;

    await ensureReceiptFont();

    const parsed = parseReceipt(text);
    const sourceW = 1752;
    const sourceH = 3592;
    const width = Math.max(700, opts.width ?? 700);
    const scale = width / sourceW;
    const height = sourceH * scale;
    const dpr = Math.min(opts.maxDpr ?? 3, Math.max(2, window.devicePixelRatio || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let template: HTMLImageElement;
    let miniappCode: HTMLImageElement | null = null;
    try {
        template = await loadReceiptAsset('/receipt-assets/receipt-pink-template.png');
        miniappCode = await loadReceiptAsset('/receipt-assets/bluecat-miniapp-code.jpg').catch(() => null);
    } catch {
        return generateReceiptImageBlueDraft(_title, text, opts);
    }
    ctx.drawImage(template, 0, 0, width, height);

    const sx = (value: number) => value * scale;
    const pink = '#f55f8b';
    const pinkDark = '#e94979';
    const blue = '#397dcf';
    const ink = '#353238';
    const muted = '#8c7f84';
    const font = (weight: string | number, size: number) => `${weight} ${sx(size)}px "Alimama FangYuanTi VF", "PingFang SC", "Microsoft YaHei", sans-serif`;
    const drawText = (
        value: string,
        x: number,
        y: number,
        size: number,
        color = ink,
        weight: string | number = 400,
        align: CanvasTextAlign = 'left',
    ) => {
        ctx.font = font(weight, size);
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(value, sx(x), sx(y));
    };
    const fitText = (
        value: string,
        x: number,
        y: number,
        maxWidth: number,
        initialSize: number,
        minSize: number,
        color = ink,
        weight: string | number = 400,
        align: CanvasTextAlign = 'left',
    ) => {
        let size = initialSize;
        ctx.font = font(weight, size);
        while (size > minSize && ctx.measureText(value).width > sx(maxWidth)) {
            size -= 1;
            ctx.font = font(weight, size);
        }
        drawText(value, x, y, size, color, weight, align);
    };
    const wrapped = (value: string, widthInSourcePx: number, size: number, weight: string | number = 400) => {
        ctx.font = font(weight, size);
        return wrapText(ctx, value || '-', sx(widthInSourcePx));
    };

    drawText('欢迎板板大驾光临', 876, 190, 39, pink, 700, 'center');
    drawText('蓝猫', 575, 1032, 105, blue, 800, 'center');
    drawText('爽打', 790, 1032, 91, pink, 800, 'center');
    drawText('· 订单小票', 1126, 1032, 91, pink, 800, 'center');
    drawText('每一局游戏，都有蓝猫守护', 876, 1177, 42, pink, 700, 'center');

    // Order number sits above the six icon-aligned rows to preserve all current data.
    fitText(`订单编号：${parsed.orderNo || '-'}`, 1430, 1341, 520, 22, 18, '#a88b94', 400, 'right');
    drawText('订单信息', 876, 1303, 50, '#ffffff', 700, 'center');
    const orderRows = [
        {label: '下单项目', value: parsed.project || '-', strong: false},
        {label: parsed.orderMetricLabel || '订单保底', value: parsed.orderMetricValue || '-', strong: true},
        {label: '接待客服', value: parsed.serviceName || '-', strong: false},
        {label: '接待陪玩', value: parsed.players.length ? parsed.players.join('  ') : '（待派单/待接单）', strong: false},
        {label: '预计等待时间', value: parsed.waitTime || '5-10分钟', strong: false},
        {label: '下单时间', value: parsed.orderTime || '-', strong: false},
    ];
    const rowYs = [1382, 1472, 1570, 1672, 1773, 1873];
    orderRows.forEach((row, index) => {
        drawText(`${row.label}：`, 420, rowYs[index], row.label.length > 5 ? 31 : 34, ink, 500);
        fitText(row.value, 710, rowYs[index], 690, 34, 23, row.strong ? pink : ink, row.strong ? 700 : 400);
    });
    if (parsed.estimatedEndTime) {
        drawText(`预计结单：${parsed.estimatedEndTime}`, 1395, 1909, 22, muted, 400, 'right');
    }

    drawText('结算信息', 876, 2041, 50, '#ffffff', 700, 'center');
    const paidItem = [...parsed.financeItems].reverse().find((item) => item.label === '实付金额') ||
        parsed.financeItems[parsed.financeItems.length - 1] || {label: '实付金额', value: '¥0.00', isBold: true};
    const ordinaryFinance = parsed.financeItems.filter((item) => item !== paidItem);
    if (ordinaryFinance.length > 3) {
        const rowsPerColumn = Math.ceil(ordinaryFinance.length / 2);
        const columnStarts = [420, 920];
        const valueEnds = [850, 1390];
        const financeGap = rowsPerColumn > 3 ? 39 : 51;
        ordinaryFinance.forEach((item, index) => {
            const column = Math.floor(index / rowsPerColumn);
            const row = index % rowsPerColumn;
            const fy = 2114 + row * financeGap;
            const labelX = columnStarts[column];
            const valueX = valueEnds[column];
            drawText(`${item.label}：`, labelX, fy, rowsPerColumn > 3 ? 22 : 25, ink, 500);
            fitText(item.value, valueX, fy, 220, rowsPerColumn > 3 ? 22 : 25, 18, ink, 400, 'right');
        });
    } else {
        ordinaryFinance.forEach((item, index) => {
            const fy = 2118 + index * 55;
            drawText(`${item.label}：`, 420, fy, 31, ink, 500);
            fitText(item.value, 1385, fy, 650, 32, 22, ink, 400, 'right');
        });
    }
    drawText(`${paidItem.label}：`, 420, 2350, 38, blue, 700);
    fitText(paidItem.value, 1365, 2366, 560, 72, 48, pinkDark, 800, 'right');

    drawText('售后与投诉须知', 884, 2540, 46, '#ffffff', 700, 'center');
    const tipLines = (parsed.tips.length ? parsed.tips : [
        '消费过程中如遇任何问题，请随时联系本单客服处理～',
        '订单完结24小时内支持售后，客服为售后唯一渠道；',
        '请勿相信其他任何人，谨防上当受骗。',
    ]).flatMap((line) => wrapped(line, 860, 30));
    tipLines.slice(0, 5).forEach((line, index) => drawText(line, 348, 2665 + index * 48, 30, '#51484b', 400));
    drawText('本店通过各类渠道收集客服或打手私联接单证据，', 348, 2864, 28, '#51484b', 400);
    drawText('举报查实私加联系方式及私单奖 500-2000R', 348, 2910, 29, pinkDark, 700);

    drawText('感谢你的选择，喵～ 期待下次陪你一起玩！', 876, 3047, 41, pink, 700, 'center');

    // Use the original lower information panel for a sufficiently large mini-app-code slot.
    ctx.save();
    ctx.fillStyle = 'rgba(255,250,248,.94)';
    roundRect(ctx, sx(260), sx(3099), sx(1232), sx(222), sx(28), 'rgba(255,250,248,.94)', '#f7b9c9');
    ctx.restore();
    const qrX = 282;
    const qrY = 3108;
    const qrSize = 204;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx(qrX - 6), sx(qrY - 6), sx(qrSize + 12), sx(qrSize + 12));
    if (miniappCode) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(miniappCode, sx(qrX), sx(qrY), sx(qrSize), sx(qrSize));
    } else {
        ctx.setLineDash([sx(10), sx(8)]);
        ctx.lineWidth = sx(4);
        ctx.strokeStyle = pink;
        ctx.strokeRect(sx(qrX), sx(qrY), sx(qrSize), sx(qrSize));
    }
    ctx.restore();
    drawText('扫码进入蓝猫爽打小程序', 548, 3168, 34, pinkDark, 700);
    drawText('查订单 · 找客服 · 享福利', 548, 3221, 28, ink, 400);
    drawText('微信扫码即可进入小程序', 548, 3268, 23, muted, 400);

    drawText(`BlueCat · 萌爪订单小票 · ${dayjs().format('YYYY-MM-DD HH:mm')}`, 876, 3395, 28, '#9d9095', 400, 'center');
    drawText('BlueCat · 蓝猫爽打 与您同行。', 876, 3475, 31, '#9d9095', 400, 'center');

    return canvas.toDataURL('image/png');
};

export type MemberRechargeReceiptItem = {
    label: string;
    value: string;
    highlight?: boolean;
};

export type GenerateMemberRechargeReceiptImageOptions = GenerateReceiptImageOptions & {
    subtitle?: string;
    items?: MemberRechargeReceiptItem[];
    footerTips?: string[];
};

export const generateMemberRechargeReceiptImage = async (
    title: string,
    items: MemberRechargeReceiptItem[] = [],
    opts: GenerateMemberRechargeReceiptImageOptions = {},
) => {
    if (typeof document === 'undefined') return null;

    const QUALITY = Math.min(opts.maxDpr ?? 3, Math.max(2, window.devicePixelRatio || 1));
    const contentW = opts.width ?? 450;
    const padding = opts.padding ?? 28;
    const cardW = contentW - padding * 2;
    const rowGap = 16;
    const COLORS = {
        bg: '#ffffff',
        primary: opts.theme?.accent || '#2563eb',
        secondary: opts.theme?.accent2 || '#7c3aed',
        cardBg: opts.theme?.cardBg || '#f8fafc',
        cardBorder: opts.theme?.cardBorder || '#dbeafe',
        textMain: opts.theme?.textMain || '#111827',
        textMuted: opts.theme?.textMuted || '#64748b',
        softBlue: '#eff6ff',
        softPurple: '#f5f3ff',
        softYellow: '#fff7ed',
    };

    const createCanvas = (w: number, h: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * QUALITY);
        canvas.height = Math.round(h * QUALITY);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.setTransform(QUALITY, 0, 0, QUALITY, 0, 0);
        return {canvas, ctx};
    };

    const measure = createCanvas(contentW, 120);
    if (!measure) return null;
    const M = measure.ctx;
    M.font = '16px sans-serif';
    const rows = items.map((item) => ({
        ...item,
        valueLines: wrapText(M, item.value || '-', cardW - 150),
    }));
    const detailH = 28 + rows.reduce((sum, item) => sum + Math.max(28, item.valueLines.length * 23) + rowGap, 0);
    const footerTips = opts.footerTips?.length
        ? opts.footerTips
        : ['该小票仅用于老板核对会员储值到账，请以后台充值记录与会员钱包流水为准。'];
    M.font = '13px sans-serif';
    const footerTipLines = footerTips.flatMap((line) => wrapText(M, line, cardW - 40));
    const footerBoxH = 58 + Math.max(1, footerTipLines.length) * 22;
    const footerGap = 22;
    const bottomSafeH = 56;
    const contentH = Math.max(700, 195 + detailH + footerGap + footerBoxH + bottomSafeH);
    const content = createCanvas(contentW, contentH);
    if (!content) return null;
    const C = content.ctx;
    const centerX = contentW / 2;

    C.clearRect(0, 0, contentW, contentH);
    roundRect(C, 0, 0, contentW, contentH, 34, COLORS.bg);

    const headerGrad = C.createLinearGradient(0, 0, contentW, 180);
    headerGrad.addColorStop(0, '#dbeafe');
    headerGrad.addColorStop(0.55, '#f5f3ff');
    headerGrad.addColorStop(1, '#fdf2f8');
    roundRect(C, padding, 26, cardW, 145, 26, headerGrad);

    C.fillStyle = COLORS.primary;
    C.font = 'bold 28px sans-serif';
    C.textAlign = 'center';
    C.fillText(title || '蓝猫爽打 · 会员储值小票', centerX, 78);
    C.fillStyle = COLORS.textMuted;
    C.font = '15px sans-serif';
    C.fillText(opts.subtitle || '会员储值到账凭证', centerX, 106);
    C.fillStyle = COLORS.secondary;
    C.font = 'bold 18px sans-serif';
    C.fillText('储值成功 · 已入账', centerX, 142);

    const detailTop = 195;
    roundRect(C, padding, detailTop, cardW, detailH, 22, COLORS.cardBg, COLORS.cardBorder);
    let y = detailTop + 34;
    rows.forEach((item) => {
        const rowH = Math.max(28, item.valueLines.length * 23);
        C.textAlign = 'left';
        C.fillStyle = COLORS.textMuted;
        C.font = '15px sans-serif';
        C.fillText(item.label, padding + 22, y);

        C.textAlign = 'right';
        C.fillStyle = item.highlight ? COLORS.primary : COLORS.textMain;
        C.font = item.highlight ? 'bold 18px sans-serif' : '16px sans-serif';
        item.valueLines.forEach((line, index) => {
            C.fillText(line, padding + cardW - 22, y + index * 23);
        });

        y += rowH + rowGap;
    });

    const tipsTop = detailTop + detailH + 22;
    roundRect(C, padding, tipsTop, cardW, footerBoxH, 20, COLORS.softYellow);
    C.textAlign = 'left';
    C.fillStyle = COLORS.textMain;
    C.font = 'bold 16px sans-serif';
    C.fillText('核对提示', padding + 20, tipsTop + 30);
    C.fillStyle = COLORS.textMuted;
    C.font = '13px sans-serif';
    footerTipLines.forEach((line, index) => {
        C.fillText(line, padding + 20, tipsTop + 58 + index * 22);
    });

    C.textAlign = 'center';
    C.fillStyle = COLORS.textMuted;
    C.font = '12px monospace';
    C.fillText(`BlueCat · 会员储值小票 · ${dayjs().format('YYYY-MM-DD HH:mm')}`, centerX, tipsTop + footerBoxH + 36);

    const frameOuterPad = 24;
    const frameW = contentW + frameOuterPad * 2;
    const frameH = contentH + frameOuterPad * 2;
    const finalW = frameW + 28;
    const finalH = frameH + 40;
    const final = createCanvas(finalW, finalH);
    if (!final) return null;
    const F = final.ctx;
    F.clearRect(0, 0, finalW, finalH);
    F.fillStyle = '#ffffff';
    F.fillRect(0, 0, finalW, finalH);

    const frameX = 14;
    const frameY = 20;
    const frameGrad = F.createLinearGradient(frameX, frameY, frameX + frameW, frameY + frameH);
    frameGrad.addColorStop(0, '#93c5fd');
    frameGrad.addColorStop(0.5, '#c4b5fd');
    frameGrad.addColorStop(1, '#f9a8d4');
    F.save();
    F.shadowColor = 'rgba(37, 99, 235, 0.22)';
    F.shadowBlur = 18;
    F.shadowOffsetY = 8;
    roundRect(F, frameX, frameY, frameW, frameH, 44, frameGrad);
    F.restore();
    roundRect(F, frameX + frameOuterPad, frameY + frameOuterPad, contentW, contentH, 36, '#ffffff');
    F.drawImage(content.canvas, frameX + frameOuterPad, frameY + frameOuterPad, contentW, contentH);

    return final.canvas.toDataURL('image/png');
};
