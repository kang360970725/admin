import React, { useEffect, useRef, useState } from 'react';
import { history, useLocation, useParams } from '@umijs/max';
import { Alert, Button, Space } from 'antd';
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
    rank?: number;
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

const colors = ['#0f6fff', '#7647ff', '#00a7a0', '#d7468a', '#d88317', '#2460a8'];
const placeholderProviders = Array.from({ length: 8 }, (_, index) => ({
    id: -(index + 1),
    name: `候选 ${index + 1}`,
    serviceRank: '候选席位',
}));

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
    const [now, setNow] = useState(Date.now());
    const [view, setView] = useState(searchParams.get('view') || 'stage');
    const [board, setBoard] = useState<Board>('overall');
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
    const revealedAt = current?.drawnAt ? new Date(current.drawnAt).getTime() + 3600 : 0;
    const spinning = Boolean(winner && now < revealedAt);

    useEffect(() => {
        setNow(Date.now());
        if (!revealedAt) return;
        const timeout = setTimeout(() => setNow(Date.now()), Math.max(0, revealedAt - Date.now()));
        return () => clearTimeout(timeout);
    }, [revealedAt]);

    async function act(action: string, player: Player) {
        if (mutationInFlight.current) return;
        mutationInFlight.current = true;
        mutationVersion.current += 1;
        setBusy(true);
        setOperationError('');
        try {
            const state = await operateLiveTournament({ action, dayId, entryId: player.id });
            setNow(Date.now());
            setStage(state);
            setConnectionError(false);
        } catch (error: any) {
            setOperationError(error?.data?.message || '操作失败，请刷新状态后重试');
        } finally {
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
    const segments = wheelProviders.map((_, index) =>
        `${colors[index % colors.length]} ${index / wheelProviders.length * 100}% ${(index + 1) / wheelProviders.length * 100}%`,
    );
    const winnerIndex = winner ? providers.indexOf(winner) : 0;
    const rotation = winner ? 1800 - (winnerIndex + 0.5) * 360 / providers.length : 0;
    const boardRows = stage?.leaderboard?.[board] ?? [];
    const boardValue = (row: BoardRow) => board === 'overall'
        ? `${row.points ?? 0} 分`
        : board === 'byKills' ? `${row.kills ?? 0} 杀` : `${((row.firstKillElapsedMs ?? 0) / 1000).toFixed(1)} 秒`;
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
        <section className="tournament-stage__ad-rotator" aria-label="赛事合作信息">
            <article className="tournament-stage__ad is-bluecat">
                <span>OFFICIAL GAMING SERVICE</span><strong>蓝猫爽打</strong><em>专业陪练 · 快乐上分 · 全程守护</em><b>BLUECAT PLAY</b>
            </article>
            <article className="tournament-stage__ad is-kook">
                <span>JOIN OUR COMMUNITY</span><strong>KOOK：867867</strong><em>加入赛事语音频道 · 获取最新赛况</em><b>BLUECAT ARENA</b>
            </article>
            <div className="tournament-stage__ad-dots"><i /><i /></div>
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
                <Button type={board === 'byKills' ? 'primary' : 'default'} onClick={() => setBoard('byKills')}>单局击杀</Button>
                <Button type={board === 'byFirstKill' ? 'primary' : 'default'} onClick={() => setBoard('byFirstKill')}>最快首杀</Button>
            </Space>
            {boardRows.length ? <>
                <div className="tournament-stage__podium">
                    {boardRows.slice(0, 3).map((row, index) => <article key={`${row.ticketId}-${row.roundNumber ?? 0}`} className={`is-rank-${index + 1}`}>
                        <span className="tournament-stage__podium-rank">{String(index + 1).padStart(2, '0')}</span>
                        <div><small>{index === 0 ? 'MVP LEADER' : index === 1 ? 'CHALLENGER' : 'CONTENDER'}</small><strong>{row.name}</strong></div>
                        <b>{boardValue(row)}</b>
                    </article>)}
                </div>
                <ol>
                {boardRows.slice(3).map((row, offset) => {
                    const index = offset + 3;
                    const change = row.previousRank && row.rank ? row.previousRank - row.rank : 0;
                    return <li key={`${row.ticketId}-${row.roundNumber ?? 0}`}>
                        <span>{String(row.rank ?? index + 1).padStart(2, '0')}</span><strong>{row.name}</strong>
                        <span>{boardValue(row)}</span>
                        {board === 'overall' && <small>{row.previousRank == null ? '新上榜' : change ? `${change > 0 ? '↑' : '↓'} ${Math.abs(change)}` : '—'}</small>}
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
                    <div className="tournament-stage__wheel" style={{
                        background: wheelProviders.length === 1 ? colors[0] : `conic-gradient(${segments.join(',')})`,
                        transform: `rotate(${rotation}deg)`,
                        transitionDuration: spinning ? '3.3s' : '0s',
                    }}>
                        {wheelProviders.map((provider, index) => {
                            const angle = (index + 0.5) * 2 * Math.PI / wheelProviders.length;
                            const radius = wheelProviders.length === 1 ? 0 : 34;
                            return <div key={provider.id} className="tournament-stage__label" style={{
                                left: `${50 + radius * Math.sin(angle)}%`,
                                top: `${50 - radius * Math.cos(angle)}%`,
                                transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
                                transitionDuration: spinning ? '3.3s' : '0s',
                            }}><small>{String(index + 1).padStart(2, '0')}</small><strong>{wheelProviders.length > 10 ? index + 1 : provider.name || '服务者'}</strong><em>{provider.serviceRank || '候选席位'}</em></div>;
                        })}
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
                    <strong>{spinning ? '正在抽取并开始比赛…' : winner ? `比赛进行中 · ${winner.name || '服务者'}` : current ? providers.length ? '点击转盘中心开始比赛' : '发布名单后即可开始抽取' : '等待确认选手上场'}</strong>
                </div>
                {controlMode && current?.providerId && !spinning && <Button className="tournament-stage__finish-button" loading={busy} onClick={() => act('stage-finish', current)}>结束当前选手比赛</Button>}
            </section>
        </div>}
    </main>;
}
