import React, { useEffect, useState } from 'react';
import { history } from '@umijs/max';
import { Button, Result, Spin, Typography } from 'antd';
import { operateLiveTournament } from '@/services/api';

interface StudioEntryResult {
    day: null | {
        id: number;
        title: string;
        startsAt: string;
        endsAt: string;
        state: 'PREHEAT' | 'UPCOMING' | 'IN_PROGRESS' | 'ENDED';
    };
    message?: string;
}

export default function LiveTournamentStudioEntry() {
    const [result, setResult] = useState<StudioEntryResult>();
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        void operateLiveTournament({ action: 'studio-entry' })
            .then((response: StudioEntryResult) => {
                if (!active) return;
                setResult(response);
                if (response.day?.id) {
                    const preheat = response.day.state === 'PREHEAT';
                    history.replace(`/ops/live-tournament/stage/${response.day.id}?auto=1${preheat ? '&preheat=1&view=sales' : ''}`);
                }
            })
            .catch((reason: any) => {
                if (active) setError(reason?.data?.message || '场次关联失败，请检查网络后重试');
            });
        return () => { active = false; };
    }, []);

    if (error) {
        return <Result
            status="warning"
            title="主播工作台暂时无法进入"
            subTitle={error}
            extra={<Button type="primary" onClick={() => window.location.reload()}>重新校验今日场次</Button>}
        />;
    }

    if (result && !result.day) {
        return <Result
            status="info"
            title="今日暂无可直播场次"
            subTitle={result.message || '系统只会自动关联今日已发布的直播场次，请联系赛事运营确认排期。'}
            extra={<Button type="primary" onClick={() => window.location.reload()}>重新校验今日场次</Button>}
        />;
    }

    return <div style={{ minHeight: '68vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
            <Spin size="large" />
            <Typography.Title level={3} style={{ marginTop: 24, marginBottom: 8 }}>正在进入主播工作台</Typography.Title>
            <Typography.Text type="secondary">系统正在按北京时间自动关联今日直播场次，无需手动选择</Typography.Text>
        </div>
    </div>;
}
