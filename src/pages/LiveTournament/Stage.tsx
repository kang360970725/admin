import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { history, useLocation, useParams } from '@umijs/max';
import { Alert, Button, Modal, Space } from 'antd';
import { getLiveTournamentProjection, operateLiveTournament } from '@/services/api';
import './stage.less';

interface Player {
    id: number;
    competitionName: string;
    gameNickname: string;
    gameAccountId?: string;
    providerId: number | null;
    drawnAt: string | null;
    firstRoundStartedAt: string | null;
}

interface BoardRow {
    ticketId: number;
    name: string;
    rank?: number | null;
    previousRank?: number | null;
    points?: number;
    kills?: number;
    roundNumber?: number;
    firstKillElapsedMs?: number;
}
type Board = 'overall' | 'byKills' | 'byFirstKill';

interface StageState {
    leaderboard?: Record<Board, BoardRow[]>;
    locked?: boolean;
    title: string;
    day?: { id: number; startsAt: string; endsAt: string; capacity: number };
    sales: { paid: number; remaining: number; limit: number; threshold: number; booked: boolean; open: boolean };
    current: Player | null;
    next: Player | null;
    providers: { id: number; name: string | null; serviceRank?: string }[];
}

const prizeTiers = [
    { rank: '第 1 名', amount: '1,600' },
    { rank: '第 2 名', amount: '1,100' },
    { rank: '第 3 名', amount: '800' },
    { rank: '第 4–8 名', amount: '500' },
    { rank: '第 9–16 名', amount: '300' },
    { rank: '第 17–24 名', amount: '150' },
    { rank: '第 25–32 名', amount: '50' },
];

const colors = ['#0f6fff', '#7647ff', '#00a7a0', '#d7468a', '#d88317', '#2460a8'];
const placeholderProviders = Array.from({ length: 8 }, (_, index) => ({
    id: -(index + 1),
    name: `候选 ${index + 1}`,
    serviceRank: '候选席位',
}));
const wheelSpinDurationMs = 4000;

export default function TournamentStage() {
    const { dayId: rawDayId } = useParams();
    const dayId = Number(rawDayId);
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const autoLinked = searchParams.get('auto') === '1';
    const preheatMode = searchParams.get('preheat') === '1';
    const authenticated = Boolean(localStorage.getItem('token'));
    const [presentationOnly, setPresentationOnly] = useState(searchParams.get('viewOnly') === '1' || !authenticated);
    const controlMode = authenticated && !presentationOnly;
    const internal = controlMode;
    const [stage, setStage] = useState<StageState>();
    const [busy, setBusy] = useState(false);
    const [connectionError, setConnectionError] = useState(false);
    const [operationError, setOperationError] = useState('');
    const [spinKey, setSpinKey] = useState<string | null>(null);
    const [drawPending, setDrawPending] = useState(false);
    const [drawNetworkSlow, setDrawNetworkSlow] = useState(false);
    const [view, setView] = useState(searchParams.get('view') || 'stage');
    const [board, setBoard] = useState<Board>('overall');
    const [rulesOpen, setRulesOpen] = useState(false);
    const [showCommunityAd, setShowCommunityAd] = useState(false);

    useEffect(() => {
        const interval = window.setInterval(() => setShowCommunityAd(value => !value), 5000);
        return () => window.clearInterval(interval);
    }, []);

    const mutationVersion = useRef(0);
    const mutationInFlight = useRef(false);

    useEffect(() => {
        const cls = 'bc-tournament-stage-fullscreen';
        document.body.classList.add(cls);
        return () => document.body.classList.remove(cls);
    }, []);

    useEffect(() => {
        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        async function refresh() {
            const version = mutationVersion.current;
            try {
                if (mutationInFlight.current) return;
                const state = await (internal
                    ? operateLiveTournament({ action: 'stage', dayId })
                    : getLiveTournamentProjection(dayId));
                if (!stopped && version === mutationVersion.current) {
                    setStage(state);
                    setConnectionError(false);
                }
            } catch {
                if (!stopped && version === mutationVersion.current) setConnectionError(true);
            } finally {
                if (!stopped) timer = setTimeout(refresh, 1500);
            }
        }
        void refresh();
        return () => { stopped = true; clearTimeout(timer); };
    }, [dayId, internal]);

    const current = stage?.current;
    const next = stage?.next;
    const providers = stage?.providers ?? [];
    const winner = providers.find(provider => provider.id === current?.providerId);
    const drawKey = winner && current?.drawnAt ? `${current.id}:${current.drawnAt}:${winner.id}` : null;
    const seenDrawKey = useRef<string | null>(null);
    const awaitingLocalSpin = Boolean(drawKey && seenDrawKey.current !== drawKey);
    const spinning = Boolean(drawKey && (spinKey === drawKey || awaitingLocalSpin));

    // The projection may receive the result later than the control page. Always
    // start a complete local animation when this page first observes a new draw.
    // useLayoutEffect avoids painting the final winner for one frame beforehand.
    useLayoutEffect(() => {
        if (!drawKey || seenDrawKey.current === drawKey) return;
        seenDrawKey.current = drawKey;
        setSpinKey(drawKey);
        const timer = window.setTimeout(() => {
            setSpinKey(value => value === drawKey ? null : value);
        }, wheelSpinDurationMs + 150);
        return () => window.clearTimeout(timer);
    }, [drawKey]);

    async function act(action: string, player: Player) {
        if (mutationInFlight.current) return;
        mutationInFlight.current = true;
        mutationVersion.current += 1;
        setBusy(true);
        setOperationError('');
        const drawing = action === 'stage-draw';
        let slowTimer: number | undefined;
        if (drawing) {
            // Give immediate visual feedback while the server securely decides the
            // winner. This is only a pending effect and never reveals a fake result.
            setDrawPending(true);
            setDrawNetworkSlow(false);
            slowTimer = window.setTimeout(() => setDrawNetworkSlow(true), 1500);
        }
        try {
            const state = await operateLiveTournament({ action, dayId, entryId: player.id });
            setStage(state);
            setConnectionError(false);
        } catch (error: any) {
            setOperationError(error?.data?.message || '操作失败，请刷新状态后重试');
        } finally {
            if (slowTimer !== undefined) window.clearTimeout(slowTimer);
            if (drawing) {
                setDrawPending(false);
                setDrawNetworkSlow(false);
            }
            mutationInFlight.current = false;
            setBusy(false);
        }
    }

    function playerCard(label: string, englishLabel: string, player: Player | null | undefined, currentCard = false) {
        return <article className={`tournament-stage__player ${currentCard ? 'is-current' : 'is-next'}`}>
            <div className="tournament-stage__player-topline">
                <div className="tournament-stage__player-label"><small>{englishLabel}</small><span>{label}</span></div>
                <span className="tournament-stage__player-state">{currentCard ? player ? 'LIVE' : '空闲' : player ? 'STANDBY' : '待排队'}</span>
            </div>
            <div className="tournament-stage__player-body">
                <div>
                    <strong>{player?.competitionName || (currentCard ? '等待确认上场' : '暂无候场选手')}</strong>
                    {player && <div className="tournament-stage__nickname">游戏昵称 · {player.gameNickname}</div>}
                    {internal && player?.gameAccountId && <div className="tournament-stage__id">游戏 ID · {player.gameAccountId}</div>}
                </div>
                {!currentCard && controlMode && !current && player && <Button
                    className="tournament-stage__stage-button"
                    loading={busy}
                    onClick={() => act('stage-enter', player)}
                >确认上场</Button>}
            </div>
        </article>;
    }

    const wheelProviders = providers.length ? providers : placeholderProviders;
    const winnerIndex = winner ? providers.indexOf(winner) : 0;
    const finalRotation = winner ? 1800 - (winnerIndex + 0.5) * 360 / providers.length : 0;
    const wheelMotionStyle = {
        '--wheel-final-rotation': `${finalRotation}deg`,
        '--wheel-final-inverse': `${-finalRotation}deg`,
        '--wheel-accel-rotation': `${finalRotation * .07}deg`,
        '--wheel-accel-inverse': `${finalRotation * -.07}deg`,
        '--wheel-cruise-rotation': `${finalRotation * .93}deg`,
        '--wheel-cruise-inverse': `${finalRotation * -.93}deg`,
        '--wheel-spin-duration': `${wheelSpinDurationMs}ms`,
    } as React.CSSProperties;
    const boardRows = stage?.leaderboard?.[board] ?? [];
    const podiumRows = boardRows.filter(row => row.rank !== null).slice(0, 3);
    const listRows = boardRows.slice(podiumRows.length);
    const boardValue = (row: BoardRow) => board === 'overall'
        ? `${row.points ?? 0} 分`
        : board === 'byKills' ? `${row.kills ?? 0} 次淘汰` : `${((row.firstKillElapsedMs ?? 0) / 1000).toFixed(3).replace(/\.?0+$/, '')} 秒`;
    const salesThreshold = Math.max(1, stage?.sales.threshold ?? 1);
    const salesLimit = Math.max(salesThreshold, stage?.sales.limit ?? 70);
    const salesUnlocked = Boolean(stage?.sales.booked) || (stage?.sales.paid ?? 0) >= salesThreshold;
    const salesProgressMax = salesUnlocked ? salesLimit : salesThreshold;
    const salesValue = Math.min(stage?.sales.paid ?? 0, salesProgressMax);
    const salesPercent = Math.round(salesValue / salesProgressMax * 100);
    const scheduleText = stage?.day ? `${new Date(stage.day.startsAt).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    })}–${new Date(stage.day.endsAt).toLocaleTimeString('zh-CN', {
        timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false,
    })}` : '';

    function salesProgress(compact = false) {
        return <div
            className={`tournament-stage__progress ${compact ? 'is-compact' : ''}`}
            role="progressbar"
            aria-label="开放预约进度"
            aria-valuemin={0}
            aria-valuemax={salesProgressMax}
            aria-valuenow={salesValue}
        >
            <div className="tournament-stage__progress-head">
                <span>{salesUnlocked ? compact ? '总票进度' : 'TOTAL TICKET SALES' : compact ? '预约解锁' : 'RESERVATION UNLOCK'}</span>
                <strong>{salesPercent}%</strong>
            </div>
            <div className="tournament-stage__progress-track">
                <div className="tournament-stage__progress-fill" style={{ width: `${salesPercent}%` }}><i /></div>
                <div className="tournament-stage__progress-grid" />
                {salesUnlocked && salesThreshold < salesLimit && <div className="tournament-stage__progress-unlock"
                    style={{ left: `${salesThreshold / salesLimit * 100}%` }}><span>{salesThreshold} 张预约线</span></div>}
            </div>
            {!compact && <div className="tournament-stage__progress-scale"><span>0</span><b>{stage?.sales.paid ?? 0} 张已售</b>
                <span>{salesUnlocked ? `${salesLimit} 张总票量` : `${salesThreshold} 张开放预约`}</span></div>}
        </div>;
    }

    return <main className="tournament-stage">
        <header className="tournament-stage__header">
            <div className="tournament-stage__brand">
                <div className="tournament-stage__live"><i /> {controlMode ? 'LIVE CONTROL' : 'LIVE ARENA'}</div>
                <h1>{stage?.title || '直播挑战赛'}</h1>
                <p>BLUECAT ARENA · DAY {Number.isFinite(dayId) ? String(dayId).padStart(2, '0') : '--'}</p>
            </div>
            <div className="tournament-stage__header-actions">
                <Space wrap className="tournament-stage__nav">
                    {!preheatMode && <Button type={view === 'stage' ? 'primary' : 'default'} onClick={() => setView('stage')}>直播转盘</Button>}
                    <Button type={view === 'sales' ? 'primary' : 'default'} onClick={() => setView('sales')}>售票进度</Button>
                    {!preheatMode && <Button type={view === 'board' ? 'primary' : 'default'} onClick={() => setView('board')}>赛事榜单</Button>}
                    {controlMode && !preheatMode && <Button onClick={() => setRulesOpen(true)}>比赛赛制</Button>}
                </Space>
                {authenticated && <Button
                    className="tournament-stage__screen-link"
                    onClick={() => setPresentationOnly(value => !value)}
                >{presentationOnly ? '返回主播操作' : '切换纯净投屏'}</Button>}
                {controlMode && autoLinked && <Alert
                    className="tournament-stage__auto-linked"
                    type="success"
                    showIcon
                    message={`${preheatMode ? '预热展示 · 仅展示售票' : '今日场次已自动关联'}${scheduleText ? ` · ${scheduleText}` : ''}`}
                    action={<Button size="small" onClick={() => history.replace('/ops/live-tournament/studio')}>刷新场次</Button>}
                />}
            </div>
        </header>
        {controlMode && !preheatMode && <Modal
            className="tournament-rules"
            title="比赛赛制"
            centered
            width={640}
            open={rulesOpen}
            onCancel={() => setRulesOpen(false)}
            footer={<Button type="primary" onClick={() => setRulesOpen(false)}>关闭</Button>}
        >
            <dl className="tournament-rules__scores">
                <div><dt>每次有效淘汰</dt><dd>1 <small>分</small></dd></div>
                <div><dt>单局上限</dt><dd>6 <small>分</small></dd></div>
                <div><dt>两局上限</dt><dd>12 <small>分</small></dd></div>
            </dl>
            <section className="tournament-rules__section">
                <h3>上场与对局</h3>
                <p>主播核对并确认上场后，转盘抽取陪练。同一位陪练陪同选手打两局，全程使用「<strong>航天基地·绝密</strong>」。</p>
                <p>陪练负责提供信息和行动路线，<strong>默认不开枪</strong>，按选手指挥行动。选手装备不限，陪练统一使用 5 套双枪 AWM。</p>
                <p>打完第一局后缺席第二局，第二局按<strong>弃权计 0 分</strong>。</p>
            </section>
            <section className="tournament-rules__section">
                <h3>有效淘汰与加分</h3>
                <p>选手是唯一得分方。<strong>选手先击倒</strong>对手，由选手或陪练完成淘汰，分数均记给选手。<strong>陪练先击倒</strong>，即使选手完成淘汰也不计分。</p>
                <p><strong className="tournament-rules__key">5 分钟内</strong>完成有效淘汰<strong className="tournament-rules__key">额外加 1 分</strong>，<strong className="tournament-rules__key">20 分钟以后</strong>完成的<strong className="tournament-rules__key">淘汰不计分</strong>。加分计入<strong className="tournament-rules__key">单局 6 分上限</strong>。</p>
            </section>
            <section className="tournament-rules__section">
                <h3>总榜排序</h3>
                <ol className="tournament-rules__ranking">
                    <li><strong>总积分</strong>高者优先，<strong>至少完成一次有效淘汰</strong>才有名次。零分选手按确认上场时间展示</li>
                    <li><strong className="tournament-rules__key">单局最高有效淘汰数</strong>多者优先</li>
                    <li><strong>最快首淘汰</strong>耗时短者优先，同耗时则先达成者优先</li>
                    <li><strong>确认上场时间</strong>早者优先</li>
                </ol>
            </section>
            <p className="tournament-rules__note">每局成绩发布后更新总榜、单局淘汰榜和最快首淘汰榜，赛后锁榜。两局<strong>满 12 分</strong>可获「天才板板」称号。</p>
            <section className="tournament-rules__prizes" aria-labelledby="tournament-prizes-title">
                <header>
                    <div>
                        <h3 id="tournament-prizes-title">赛事奖金</h3>
                        <p>总榜前 32 名获奖</p>
                    </div>
                    <div className="tournament-rules__prize-total">
                        <span>总奖池</span>
                        <strong>¥10,000</strong>
                    </div>
                </header>
                <table aria-labelledby="tournament-prizes-title">
                    <thead><tr><th scope="col">总榜名次</th><th scope="col">每人奖金</th></tr></thead>
                    <tbody>
                        {prizeTiers.map(({ rank, amount }) => <tr key={rank}>
                            <th scope="row">{rank}</th>
                            <td>¥{amount}</td>
                        </tr>)}
                    </tbody>
                </table>
            </section>
        </Modal>}
        <section className="tournament-stage__ad-rotator" aria-label="赛事合作信息">
            {showCommunityAd ? <article key="community" className="tournament-stage__ad is-kook">
                <span>JOIN OUR COMMUNITY</span><strong>KOOK：867867</strong><em>加入赛事语音频道 · 获取最新赛况</em><b>BLUECAT ARENA</b>
            </article> : <article key="bluecat" className="tournament-stage__ad is-bluecat">
                <span>OFFICIAL GAMING SERVICE</span><strong>蓝猫爽打</strong><em>专业陪练 · 快乐上分 · 全程守护</em><b>BLUECAT PLAY</b>
            </article>}
            <div className="tournament-stage__ad-dots" aria-hidden="true">
                <i className={showCommunityAd ? undefined : 'is-active'} />
                <i className={showCommunityAd ? 'is-active' : undefined} />
            </div>
        </section>
        {connectionError && <Alert type="warning" message="直播状态暂未同步，正在重连" showIcon />}
        {operationError && <Alert type="error" message={operationError} showIcon />}
        {!internal && view === 'stage' && stage && <section className="tournament-stage__sales-strip" aria-label="报名进度">
            <strong>报名进度</strong>
            <span>已售 <b>{stage.sales.paid}</b> 张</span>
            <span>余票 <b>{stage.sales.remaining}</b> 张</span>
            {salesProgress(true)}
            <span>{stage.locked ? '赛事已结束' : stage.sales.booked ? '预约已开放' : `距开放预约还差 ${Math.max(0, stage.sales.threshold - stage.sales.paid)} 张`}</span>
        </section>}
        {view === 'board' ? <section className="tournament-stage__board">
            <div className="tournament-stage__board-head">
                <div><span>ARENA RANKING</span><h2>{stage?.locked ? '最终榜单' : '实时战力榜'}</h2></div>
                <em><i /> {stage?.locked ? 'RANK LOCKED' : 'LIVE UPDATE'}</em>
            </div>
            <Space wrap className="tournament-stage__board-tabs">
                <Button type={board === 'overall' ? 'primary' : 'default'} onClick={() => setBoard('overall')}>总榜</Button>
                <Button type={board === 'byKills' ? 'primary' : 'default'} onClick={() => setBoard('byKills')}>单局淘汰</Button>
                <Button type={board === 'byFirstKill' ? 'primary' : 'default'} onClick={() => setBoard('byFirstKill')}>最快首淘汰</Button>
            </Space>
            {boardRows.length ? <>
                {podiumRows.length > 0 && <div className="tournament-stage__podium">
                    {podiumRows.map((row, index) => <article key={`${row.ticketId}-${row.roundNumber ?? 0}`} className={`is-rank-${index + 1}`}>
                        <span className="tournament-stage__podium-rank">{String(index + 1).padStart(2, '0')}</span>
                        <div><small>{index === 0 ? 'MVP LEADER' : index === 1 ? 'CHALLENGER' : 'CONTENDER'}</small><strong>{row.name}</strong></div>
                        <b>{boardValue(row)}</b>
                    </article>)}
                </div>}
                <ol>
                {listRows.map((row, offset) => {
                    const index = offset + podiumRows.length;
                    const change = row.previousRank && row.rank ? row.previousRank - row.rank : 0;
                    return <li key={`${row.ticketId}-${row.roundNumber ?? 0}`}>
                        <span>{row.rank === null ? '—' : String(row.rank ?? index + 1).padStart(2, '0')}</span><strong>{row.name}</strong>
                        <span>{boardValue(row)}</span>
                        {board === 'overall' && <small>{row.rank === null ? '' : row.previousRank == null ? '新上榜' : change ? `${change > 0 ? '↑' : '↓'} ${Math.abs(change)}` : '—'}</small>}
                    </li>;
                })}
                </ol>
            </> : <div className="tournament-stage__empty">等待发布有效成绩</div>}
        </section> : view === 'sales' && stage ? <section className="tournament-stage__sales">
            <div className="tournament-stage__sales-title"><span>LIVE TICKET SALES</span><h2>门票售卖进度</h2></div>
            <div className="tournament-stage__numbers">
                <article><span>已售门票</span><strong>{stage.sales.paid}</strong></article>
                <article><span>剩余门票</span><strong>{stage.sales.remaining}</strong></article>
            </div>
            {salesProgress()}
            <p>{stage.locked ? '赛事已结束' : stage.sales.booked ? '预约已开放' : stage.sales.open
                ? `距开放预约还差 ${Math.max(0, stage.sales.threshold - stage.sales.paid)} 张` : '当前未开放售票'}</p>
        </section> : <div className="tournament-stage__layout">
            <aside className="tournament-stage__lineup">
                <div className="tournament-stage__section-title"><span>PLAYER QUEUE</span><strong>选手序列</strong></div>
                {playerCard('当前比赛席位', 'NOW PLAYING', current, true)}
                {playerCard(current ? '下一位候场' : '等待确认上场', 'UP NEXT', next)}
                <div className="tournament-stage__safety-note"><i /> 上场确认与转盘操作分区，避免连续误触</div>
            </aside>
            <section className="tournament-stage__draw">
                <div className="tournament-stage__draw-head">
                    <div className="tournament-stage__section-title"><span>MATCH DRAW</span><strong>服务者大转盘</strong></div>
                    <div className={providers.length ? 'tournament-stage__roster-status is-ready' : 'tournament-stage__roster-status'}>
                        <i /> {providers.length ? `${providers.length} 位候选已就绪` : '候选名单待发布'}
                    </div>
                </div>
                <div className={providers.length ? 'tournament-stage__wheel-frame' : 'tournament-stage__wheel-frame is-placeholder'} key={current?.id ?? 'waiting'}>
                    <div className="tournament-stage__wheel-aura" />
                    <div className="tournament-stage__ticks" />
                    <div className="tournament-stage__orbit tournament-stage__orbit--outer" />
                    <div className="tournament-stage__orbit tournament-stage__orbit--inner" />
                    <div className="tournament-stage__pointer" />
                    <div className="tournament-stage__wheel">
                        <div className={`tournament-stage__wheel-rotor ${spinning ? 'is-spinning' : drawPending ? 'is-pending' : ''}`}
                            style={wheelMotionStyle}
                            onAnimationEnd={event => {
                                if (event.target === event.currentTarget && spinKey === drawKey) setSpinKey(null);
                            }}>
                            <svg className="tournament-stage__wheel-segments" viewBox="0 0 100 100" aria-hidden="true">
                                {wheelProviders.length === 1 ? <circle cx="50" cy="50" r="50" fill={colors[0]} /> :
                                    wheelProviders.map((provider, index) => {
                                        const start = index * 2 * Math.PI / wheelProviders.length;
                                        const end = (index + 1) * 2 * Math.PI / wheelProviders.length;
                                        const startPoint = `${50 + 50 * Math.sin(start)} ${50 - 50 * Math.cos(start)}`;
                                        const endPoint = `${50 + 50 * Math.sin(end)} ${50 - 50 * Math.cos(end)}`;
                                        return <path key={provider.id} d={`M 50 50 L ${startPoint} A 50 50 0 0 1 ${endPoint} Z`}
                                            fill={colors[index % colors.length]} />;
                                    })}
                            </svg>
                            {wheelProviders.map((provider, index) => {
                                const angle = (index + 0.5) * 2 * Math.PI / wheelProviders.length;
                                const radius = wheelProviders.length === 1 ? 0 : 34;
                                return <div key={provider.id} className="tournament-stage__label" style={{
                                    left: `${50 + radius * Math.sin(angle)}%`,
                                    top: `${50 - radius * Math.cos(angle)}%`,
                                }}><small>{String(index + 1).padStart(2, '0')}</small><strong>{wheelProviders.length > 10 ? index + 1 : provider.name || '服务者'}</strong><em>{provider.serviceRank || '候选席位'}</em></div>;
                            })}
                        </div>
                    </div>
                    <div className={`tournament-stage__hub ${controlMode && current && !current.providerId ? 'is-actionable' : ''}`}>
                        {controlMode && current && !current.providerId ? <Button
                            loading={busy}
                            disabled={!providers.length}
                            onClick={() => act('stage-draw', current)}
                        ><small>START MATCH</small><strong>转动</strong><span>即刻开赛</span></Button> : <><strong>BC</strong><span>{winner ? 'LOCKED' : 'DRAW'}</span></>}
                    </div>
                </div>
                <div className="tournament-stage__roster">
                    {providers.map((provider, index) => <span key={provider.id}><b>{String(index + 1).padStart(2, '0')}</b><strong>{provider.name || '服务者'}</strong><em>{provider.serviceRank || '未评级'}</em></span>)}
                </div>
                <div className={winner ? 'tournament-stage__result has-winner' : 'tournament-stage__result'} aria-live="polite">
                    <span>DRAW STATUS</span>
                    <strong>{drawPending
                        ? drawNetworkSlow ? '网络响应较慢，抽取指令处理中，请勿重复点击…' : '抽取指令已发送，正在连接服务器…'
                        : spinning ? '正在抽取并开始比赛…'
                            : winner ? `比赛进行中 · ${winner.name || '服务者'}`
                                : current ? providers.length ? '点击转盘中心开始比赛' : '发布名单后即可开始抽取'
                                    : '等待确认选手上场'}</strong>
                </div>
                {controlMode && current?.providerId && !spinning && <Button className="tournament-stage__finish-button" loading={busy} onClick={() => act('stage-finish', current)}>结束当前选手比赛</Button>}
            </section>
        </div>}
    </main>;
}
