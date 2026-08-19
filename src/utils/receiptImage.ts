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
    project?: string;
    orderMetricLabel?: string;
    orderMetricValue?: string;
    financeItems: Array<{ label: string; value: string; isBold?: boolean; color?: string }>;
    serviceName?: string;
    players: string[];
    orderTime?: string;
    waitTime?: string;
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
                label === '优惠券抵扣' ||
                label === '实付金额' ||
                label === '储值扣除' ||
                label === '储值余额' ||
                label === '预计增加积分'
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

export const generateReceiptImage = async (title: string, text: string, opts: GenerateReceiptImageOptions = {}) => {
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

    const financeTop = 550;
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
    };

    const drawCoreInfo = () => {
        const startY = 235;
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
        const timeY = 460;
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
