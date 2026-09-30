import React, {useEffect, useMemo, useState} from 'react';
import {PageContainer} from '@ant-design/pro-components';
import {Avatar, Button, Card, DatePicker, Image, Modal, Space, Table, Tabs, message} from 'antd';
import {CopyOutlined, EyeOutlined, ReloadOutlined, TrophyOutlined} from '@ant-design/icons';
import dayjs, {Dayjs} from 'dayjs';
import {getPlayerLeaderboardOverview} from '@/services/api';
import styles from './index.less';

const {RangePicker} = DatePicker;
const money = (value: any) => `¥${Number(value || 0).toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
const medal = (rank: number) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
const formatTime = (value: any) => value ? dayjs(value).format('MM-DD HH:mm') : '-';
const maskPhone = (value: any) => String(value || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');

const LeaderboardPage: React.FC = () => {
    const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs().endOf('month')]);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [activeBoard, setActiveBoard] = useState<'netIncome' | 'orders' | 'grossPerformance'>('netIncome');
    const [posterOpen, setPosterOpen] = useState(false);
    const [posterImage, setPosterImage] = useState('');
    const rangePayload = useMemo(() => ({startAt: range[0].startOf('day').toISOString(), endAt: range[1].endOf('day').toISOString()}), [range]);

    const load = async () => {
        setLoading(true);
        try { setData(await getPlayerLeaderboardOverview(rangePayload)); }
        catch (e: any) { message.error(e?.response?.data?.message || '排行榜加载失败'); }
        finally { setLoading(false); }
    };
    useEffect(() => { void load(); }, [rangePayload.startAt, rangePayload.endAt]);

    const playerColumns = (primary: 'netIncomeAmount' | 'completedOrders' | 'grossPerformanceAmount'): any[] => [
        {title: '排名', dataIndex: 'rank', width: 72, render: (rank: number) => <span className={styles.playerRank}>{medal(rank)}</span>},
        {title: '陪玩', dataIndex: 'name', render: (_: any, row: any) => <Space><Avatar src={row.avatar}>{String(row.name || '?').slice(0, 1)}</Avatar><div className={styles.nameCell}><strong>{row.name}</strong><small>{row.staffRatingName} · {maskPhone(row.phone)}</small></div></Space>},
        ...(primary === 'netIncomeAmount' ? [{title: '净收益', dataIndex: 'netIncomeAmount', width: 160, render: (v: number) => <strong className={styles.cyanText}>{money(v)}</strong>}] : []),
        ...(primary === 'completedOrders' ? [{title: '完成接单', dataIndex: 'completedOrders', width: 140, render: (v: number) => <strong className={styles.cyanText}>{v} 单</strong>}] : []),
        ...(primary === 'grossPerformanceAmount' ? [{title: '总业绩', dataIndex: 'grossPerformanceAmount', width: 160, render: (v: number) => <strong className={styles.cyanText}>{money(v)}</strong>}] : []),
        {title: '最近结算', dataIndex: 'latestAt', width: 130, render: formatTime},
    ];

    const drawPoster = async () => {
        if (!data) return;
        const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1440;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const gradient = ctx.createLinearGradient(0, 0, 1080, 1440); gradient.addColorStop(0, '#081426'); gradient.addColorStop(.55, '#102c63'); gradient.addColorStop(1, '#075985'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1440);
        ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.font = '900 260px sans-serif'; ctx.fillText('VS', 650, 250);
        const text = (value: string, x: number, y: number, size: number, color = '#fff', weight = 500, align: CanvasTextAlign = 'left') => { ctx.fillStyle = color; ctx.font = `${weight} ${size}px "PingFang SC", sans-serif`; ctx.textAlign = align; ctx.fillText(value, x, y); };
        text('BLUECAT PLAYER BATTLE', 70, 90, 24, '#fde68a', 800); text('蓝猫爽打 · 陪玩竞技榜', 70, 160, 56, '#fff', 900); text(`${range[0].format('YYYY-MM-DD')} — ${range[1].format('YYYY-MM-DD')}`, 70, 210, 25, '#bae6fd');
        const posterBoards = [
            {title: '净收益榜 TOP 3', key: 'netIncome', field: 'netIncomeAmount', format: money, color: '#fde68a'},
            {title: '接单榜 TOP 3', key: 'orders', field: 'completedOrders', format: (v: any) => `${v} 单`, color: '#67e8f9'},
            {title: '总业绩榜 TOP 3', key: 'grossPerformance', field: 'grossPerformanceAmount', format: money, color: '#c4b5fd'},
        ];
        posterBoards.forEach((board, boardIndex) => {
            const startY = 305 + boardIndex * 340;
            text(board.title, 70, startY, 32, board.color, 800);
            (data.rankings?.[board.key] || []).slice(0, 3).forEach((item: any, i: number) => {
                const y = startY + 75 + i * 82;
                ctx.fillStyle = i === 0 ? 'rgba(250,204,21,.15)' : 'rgba(255,255,255,.07)'; ctx.fillRect(70, y - 48, 940, 68);
                text(medal(i + 1), 100, y, 30); text(item.name, 180, y, 27, '#fff', 700); text(board.format(item[board.field]), 970, y, 26, board.color, 800, 'right');
            });
        });
        text(`共 ${data.summary?.completedOrders || 0} 单 · ${data.summary?.activePlayers || 0} 位活跃陪玩`, 540, 1360, 25, '#bfdbfe', 600, 'center'); text(`生成时间 ${dayjs().format('YYYY-MM-DD HH:mm')}`, 540, 1400, 20, '#7dd3fc', 400, 'center');
        setPosterImage(canvas.toDataURL('image/png')); setPosterOpen(true);
    };
    const copyPoster = async () => {
        try { const blob = await (await fetch(posterImage)).blob(); await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]); message.success('排行榜海报已复制，可直接粘贴发送'); }
        catch { message.warning('当前浏览器不支持复制图片，请长按或右键保存'); }
    };
    const boardMeta = {
        netIncome: {title: '净收益榜', note: '按抽成后的实际收益排名', field: 'netIncomeAmount', format: money},
        orders: {title: '接单榜', note: '按已完成订单数量排名', field: 'completedOrders', format: (v: any) => `${v} 单`},
        grossPerformance: {title: '总业绩榜', note: '按抽成前总业绩排名', field: 'grossPerformanceAmount', format: money},
    } as const;
    const podium = (items: any[], field: string, formatter: (value: any) => string) => {
        const topThree = items.slice(0, 3);
        const displayItems = topThree.length === 3 ? [topThree[1], topThree[0], topThree[2]] : topThree;
        return <div className={`${styles.podium} ${styles.playerPodium}`}>{displayItems.map((item) => <article key={item.userId} className={`${styles.podiumCard} ${styles[`place${item.rank}`]}`}><div className={styles.medal}>{medal(item.rank)}</div><div className={styles.rankLabel}>第 {item.rank} 名</div><h2>{item.name}</h2><div className={styles.score}>{formatter(item[field])}</div><p>{boardMeta[activeBoard].note}</p></article>)}</div>;
    };

    return <PageContainer title={false} className={styles.page}>
        <section className={styles.hero}><div><div className={styles.eyebrow}>BLUECAT PLAYER BATTLE · LIVE</div><h1>陪玩竞技排行榜</h1><p>以已确认结单的真实结算数据排名，拒绝虚高，实力上榜。</p></div><Space wrap><RangePicker value={range} allowClear={false} onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])}/><Button icon={<EyeOutlined/>} onClick={drawPoster}>预览海报</Button><Button type="primary" icon={<ReloadOutlined/>} loading={loading} onClick={load}>刷新榜单</Button></Space></section>
        <section className={styles.statusStrip}><div><span>统计周期</span><strong>{range[0].format('YYYY-MM-DD')} — {range[1].format('YYYY-MM-DD')}</strong></div><div><span>已完成订单</span><strong>{data?.summary?.completedOrders || 0} 单</strong></div><div><span>净收益合计</span><strong>{money(data?.summary?.totalNetIncomeAmount)}</strong></div><div><span>总业绩</span><strong>{money(data?.summary?.totalGrossPerformanceAmount)}</strong></div></section>
        <section className={styles.playerSection}><div className={styles.boardSwitch}><div className={styles.sectionTitle}><TrophyOutlined/> {boardMeta[activeBoard].title} <small>{boardMeta[activeBoard].note}</small></div><Space wrap>{(Object.keys(boardMeta) as Array<keyof typeof boardMeta>).map(key => <Button key={key} type={activeBoard === key ? 'primary' : 'default'} onClick={() => setActiveBoard(key)}>{boardMeta[key].title}</Button>)}</Space></div>{podium(data?.rankings?.[activeBoard] || [], boardMeta[activeBoard].field, boardMeta[activeBoard].format)}</section>
        <Card bordered={false} className={styles.rankingCard}><Tabs items={[
            {key: 'netIncome', label: '净收益榜', children: <Table rowKey="userId" loading={loading} columns={playerColumns('netIncomeAmount')} dataSource={data?.rankings?.netIncome || []} pagination={false} size="small" scroll={{x: 820}}/>},
            {key: 'orders', label: '接单榜', children: <Table rowKey="userId" loading={loading} columns={playerColumns('completedOrders')} dataSource={data?.rankings?.orders || []} pagination={false} size="small" scroll={{x: 820}}/>},
            {key: 'grossPerformance', label: '总业绩榜', children: <Table rowKey="userId" loading={loading} columns={playerColumns('grossPerformanceAmount')} dataSource={data?.rankings?.grossPerformance || []} pagination={false} size="small" scroll={{x: 820}}/>},
        ]}/></Card>
        <Modal open={posterOpen} title="排行榜推送海报预览" width={820} footer={<Space><Button onClick={() => setPosterOpen(false)}>关闭</Button><Button type="primary" icon={<CopyOutlined/>} onClick={copyPoster}>复制图片</Button></Space>} onCancel={() => setPosterOpen(false)}><div className={styles.previewHint}>使用当前时间范围和实时榜单生成，仅供管理人员预览、复制后手动发送。</div><div className={styles.posterPreview}>{posterImage ? <Image preview src={posterImage} alt="陪玩竞技榜海报"/> : null}</div></Modal>
    </PageContainer>;
};

export default LeaderboardPage;
