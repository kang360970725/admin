import React, { useEffect, useState } from 'react';
import { history, useParams } from '@umijs/max';
import { Alert, Button } from 'antd';
import { operateLiveTournament } from '@/services/api';
import './stage.less';

interface PreheatState {
    tournamentId: number;
    title: string;
    salesStartAt: string;
    salesEndAt: string;
    sales: { paid: number; remaining: number; limit: number; threshold: number; booked: boolean; open: boolean };
}

export default function LiveTournamentPreheat() {
    const { tournamentId: rawTournamentId } = useParams();
    const tournamentId = Number(rawTournamentId);
    const [state, setState] = useState<PreheatState>();
    const [connectionError, setConnectionError] = useState(false);

    useEffect(() => {
        const cls = 'bc-tournament-stage-fullscreen';
        document.body.classList.add(cls);
        return () => document.body.classList.remove(cls);
    }, []);

    useEffect(() => {
        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        async function refresh() {
            try {
                const response = await operateLiveTournament({ action: 'studio-preheat', tournamentId });
                if (!stopped) {
                    setState(response);
                    setConnectionError(false);
                }
            } catch {
                if (!stopped) setConnectionError(true);
            } finally {
                if (!stopped) timer = setTimeout(refresh, 5000);
            }
        }
        void refresh();
        return () => { stopped = true; clearTimeout(timer); };
    }, [tournamentId]);

    const threshold = Math.max(1, state?.sales.threshold ?? 1);
    const limit = Math.max(threshold, state?.sales.limit ?? 70);
    const unlocked = Boolean(state?.sales.booked) || (state?.sales.paid ?? 0) >= threshold;
    const progressMax = unlocked ? limit : threshold;
    const paid = Math.min(state?.sales.paid ?? 0, progressMax);
    const percent = Math.round(paid / progressMax * 100);

    return <main className="tournament-stage">
        <header className="tournament-stage__header">
            <div className="tournament-stage__brand">
                <div className="tournament-stage__live"><i /> LIVE PREHEAT</div>
                <h1>{state?.title || '直播挑战赛'}</h1>
                <p>BLUECAT ARENA · TICKET PREVIEW</p>
            </div>
            <div className="tournament-stage__header-actions">
                <Alert className="tournament-stage__auto-linked" type="info" showIcon
                    message="赛事尚未排期 · 售票预热展示"
                    action={<Button size="small" onClick={() => history.replace('/ops/live-tournament/studio')}>刷新场次</Button>} />
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
        {connectionError && <Alert type="warning" message="售票状态暂未同步，正在重连" showIcon />}
        <section className="tournament-stage__sales">
            <div className="tournament-stage__sales-title"><span>LIVE TICKET SALES</span><h2>门票售卖进度</h2></div>
            <div className="tournament-stage__numbers">
                <article><span>已售门票</span><strong>{state?.sales.paid ?? '—'}</strong></article>
                <article><span>剩余门票</span><strong>{state?.sales.remaining ?? '—'}</strong></article>
            </div>
            <div className="tournament-stage__progress" role="progressbar" aria-label="开放预约进度"
                aria-valuemin={0} aria-valuemax={progressMax} aria-valuenow={paid}>
                <div className="tournament-stage__progress-head"><span>{unlocked ? 'TOTAL TICKET SALES' : 'RESERVATION UNLOCK'}</span><strong>{percent}%</strong></div>
                <div className="tournament-stage__progress-track">
                    <div className="tournament-stage__progress-fill" style={{ width: `${percent}%` }}><i /></div>
                    <div className="tournament-stage__progress-grid" />
                    {unlocked && threshold < limit && <div className="tournament-stage__progress-unlock"
                        style={{ left: `${threshold / limit * 100}%` }}><span>{threshold} 张预约线</span></div>}
                </div>
                <div className="tournament-stage__progress-scale"><span>0</span><b>{state?.sales.paid ?? 0} 张已售</b>
                    <span>{unlocked ? `${limit} 张总票量` : `${threshold} 张开放预约`}</span></div>
            </div>
            <p>{state?.sales.booked ? '预约已开放' : state?.sales.open
                ? `距开放预约还差 ${Math.max(0, threshold - (state?.sales.paid ?? 0))} 张`
                : '赛事预热中'}</p>
        </section>
    </main>;
}
