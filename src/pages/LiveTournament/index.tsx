import React, { useEffect, useRef, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, DatePicker, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, TimePicker, Typography, message } from 'antd';
import { getGameProjectOptions, getPlayerOptions, operateLiveTournament, publishLiveTournamentScore, saveLiveTournamentScore, settleLiveTournamentTicket } from '@/services/api';

const statusLabels: Record<string, string> = {
    BOOKED: '已预约', QUEUED: '候赛中', ON_STAGE: '参赛中',
    SCORING: '成绩统计中', FINISHED: '已完赛', ABSENT: '缺席',
};
const statusColors: Record<string, string> = {
    BOOKED: 'blue', QUEUED: 'cyan', ON_STAGE: 'green', SCORING: 'gold', FINISHED: 'green',
};
const formatTime = (value: string) => new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
});

export default function LiveTournamentPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [eventId, setEventId] = useState<number>();
    const [dayId, setDayId] = useState<number>();
    const [entries, setEntries] = useState<any[]>([]);
    const [busy, setBusy] = useState(false);
    const [dialog, setDialog] = useState<'create' | 'generate-days' | 'roster'>();
    const [form] = Form.useForm();
    const [scoreForm] = Form.useForm();
    const [scoring, setScoring] = useState<{ row: any; roundNumber: number }>();
    const [rescheduling, setRescheduling] = useState<any>();
    const [targetDayId, setTargetDayId] = useState<number>();
    const kills = Form.useWatch('kills', scoreForm);
    const queueMutationInFlight = useRef(false);
    const [options, setOptions] = useState<{label: string; value: number}[]>([]);
    const event = events.find(item => item.id === eventId);
    const day = event?.days.find((item: any) => item.id === dayId);
    const queued = entries.filter(row => row.status === 'QUEUED').sort((a, b) =>
        (a.queuePosition ?? Number.MAX_SAFE_INTEGER) - (b.queuePosition ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
    );

    async function loadEvents() {
        const list = await operateLiveTournament({ action: 'list' });
        setEvents(list);
        setEventId(current => current ?? list[0]?.id);
    }

    useEffect(() => { void loadEvents().catch(() => message.error('赛事加载失败')); }, []);
    useEffect(() => {
        let current = true;
        setEntries([]);
        if (dayId) void operateLiveTournament({ action: 'entries', dayId })
            .then(list => { if (current) setEntries(list); })
            .catch(() => { if (current) message.error('参赛名单加载失败'); });
        return () => { current = false; };
    }, [dayId]);

    async function run(action: () => Promise<void>) {
        setBusy(true);
        try { await action(); }
        catch (error: any) { message.error(error?.data?.message || '操作失败，请重试'); }
        finally { setBusy(false); }
    }

    function queue(ids: number[], absentId?: number) {
        if (queueMutationInFlight.current) return Promise.resolve();
        queueMutationInFlight.current = true;
        return run(async () => {
            setEntries(await operateLiveTournament({ action: 'queue', dayId, orderedIds: ids, absentId }));
        }).finally(() => { queueMutationInFlight.current = false; });
    }

    function editScore(row: any, roundNumber: number) {
        const score = row.rounds?.find((round: any) => round.roundNumber === roundNumber);
        setScoring({ row, roundNumber });
        scoreForm.setFieldsValue({
            kills: score?.kills ?? 0,
            firstKillSeconds: score?.firstKillElapsedMs == null ? undefined : score.firstKillElapsedMs / 1000,
        });
    }

    async function refreshEntries() {
        setEntries(await operateLiveTournament({ action: 'entries', dayId }));
    }

    function move(id: number, offset: number) {
        const ids = queued.map(row => row.id);
        const current = ids.indexOf(id);
        const next = current + offset;
        if (next < 0 || next >= ids.length) return;
        [ids[current], ids[next]] = [ids[next], ids[current]];
        void queue(ids);
    }

    async function searchOptions(keyword = '', type = dialog) {
        const response: any = type === 'roster'
            ? await getPlayerOptions({ keyword, limit: 50 })
            : await getGameProjectOptions({ keyword });
        const rows = response?.data?.list ?? response?.data ?? response?.list ?? response;
        setOptions(Array.isArray(rows) ? rows.map(item => ({
            label: item.label || item.name || String(item.value ?? item.id),
            value: Number(item.value ?? item.id),
        })) : []);
    }

    function openDialog(type: 'create' | 'generate-days' | 'roster') {
        form.resetFields();
        setDialog(type);
        if (type === 'create') form.setFieldsValue({ bookingThreshold: 40, memberTicketLimit: 1 });
        setOptions([]);
        if (type === 'roster') form.setFieldsValue({ quotas: day?.quotas?.length ? day.quotas : [{ minimum: 0 }] });
        if (type !== 'generate-days') void searchOptions('', type).catch(() => message.error('选项加载失败'));
    }

    return (
        <PageContainer title="直播挑战赛" extra={<Button type="primary" onClick={() => openDialog('create')}>创建赛事</Button>}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card style={{ background: 'linear-gradient(110deg, #eef5ff, #fff 75%)' }}>
                    <Space wrap align="center" size="middle">
                        <Select style={{ minWidth: 240 }} value={eventId} placeholder="选择赛事"
                            options={events.map(item => ({ label: item.title, value: item.id }))}
                            onChange={value => { setDayId(undefined); setEventId(value); }} />
                        {event && <Tag color={event.status === 'PUBLISHED' ? 'green' : 'default'}>
                            {event.status === 'PUBLISHED' ? '已发布' : event.status === 'CLOSED' ? '已结束' : '草稿'}
                        </Tag>}
                        {event && <Typography.Text type="secondary">售票 {formatTime(event.salesStartAt)} 至 {formatTime(event.salesEndAt)}</Typography.Text>}
                        {event && <Tag>预约门槛 {event.bookingThreshold} 张 · 每会员限购 {event.memberTicketLimit} 张</Tag>}
                        {event && <Tag color={event.days.length ? 'blue' : 'gold'}>
                            {event.days.length ? `已排 ${event.days.length} 场 · ${event.days.reduce((sum: number, item: any) => sum + item.capacity, 0)} 个席位` : '赛期与场次待定'}
                        </Tag>}
                        {event?.status !== 'CLOSED' && event && <Button onClick={() => openDialog('generate-days')}>批量生成场次</Button>}
                        {event?.status === 'PUBLISHED' && <Popconfirm title="锁定最终榜单并结束赛事？"
                            description="锁榜后将关闭录分和售票。"
                            onConfirm={() => run(async () => {
                                await publishLiveTournamentScore({ action: 'lock', tournamentId: eventId });
                                await loadEvents();
                                message.success('最终榜单已锁定');
                            })}><Button disabled={busy}>锁榜并结束赛事</Button></Popconfirm>}
                        {event?.status === 'DRAFT' && (
                            <Popconfirm title="发布后将按配置的售票时间开放售票" onConfirm={() => run(async () => {
                                await operateLiveTournament({ action: 'publish', tournamentId: eventId });
                                await loadEvents();
                                message.success('赛事已发布');
                            })}>
                                <Button type="primary" loading={busy}>发布赛事</Button>
                            </Popconfirm>
                        )}
                    </Space>
                </Card>
                <Card title="直播排场" extra={day && <Space wrap>
                    <Typography.Text type="secondary">容量 {day.capacity} 人 · 候赛 {queued.length} 人</Typography.Text>
                    <Button loading={busy} onClick={() => run(async () => {
                        await refreshEntries();
                        await loadEvents();
                        message.success('直播排场已刷新');
                    })}>刷新名单</Button>
                    <Button href={`/live-tournament/screen/${day.id}?control=1`} target="_blank" rel="noopener noreferrer">主播工作台</Button>
                    <Button onClick={() => openDialog('roster')}>{day.rosterPublishedAt ? '编辑转盘名单' : '配置转盘名单'}</Button>
                </Space>}>
                    <Select style={{ minWidth: 280, marginBottom: 20 }} value={dayId} placeholder="选择直播时段"
                        options={event?.days.map((item: any) => ({ label: `${formatTime(item.startsAt)} 开始`, value: item.id }))}
                        onChange={setDayId} />
                    {day ? <Table rowKey="id" pagination={false} dataSource={entries} scroll={{ x: 880 }} columns={[
                        { title: '出场序号', width: 100, render: (_, row) => row.appearanceSequence ?? '—' },
                        { title: '候场顺序', width: 100, render: (_, row) => row.queuePosition ?? '—' },
                        { title: '参赛昵称', render: (_, row) => row.competitionName || row.gameNickname },
                        { title: '游戏账号', render: (_, row) => <Space direction="vertical" size={0}>
                            <Typography.Text>{row.gameNickname}</Typography.Text>
                            <Typography.Text type="secondary" copyable>{row.gameAccountId}</Typography.Text>
                        </Space> },
                        { title: '联系选手', render: (_, row) => <a href={`tel:${row.contactPhone}`}>{row.contactPhone}</a> },
                        { title: '状态', render: (_, row) => <Tag color={statusColors[row.status]}>{statusLabels[row.status] ?? row.status}</Tag> },
                        { title: '对局成绩', width: 300, render: (_, row) => ['ON_STAGE', 'SCORING', 'FINISHED'].includes(row.status) && (
                            <Space direction="vertical" size={6}>
                                {[1, 2].map(roundNumber => {
                                    const score = row.rounds?.find((item: any) => item.roundNumber === roundNumber);
                                    const published = score?.publishedScore;
                                    const pending = score && (!published || published.kills !== score.kills ||
                                        published.firstKillElapsedMs !== score.firstKillElapsedMs ||
                                        published.firstKillAtMs !== (score.firstKillAt ? new Date(score.firstKillAt).getTime() : null) ||
                                        published.forfeited !== score.forfeited);
                                    return <Space key={roundNumber} wrap>
                                        <Typography.Text>第{roundNumber}局</Typography.Text>
                                        <Tag color={score?.publishedAt ? 'green' : score ? 'gold' : 'default'}>
                                            {score?.forfeited ? '弃权' : score
                                                ? `${score.kills} 杀${score.kills > 0 && score.firstKillElapsedMs != null ? ` · ${(score.firstKillElapsedMs / 1000).toFixed(3).replace(/\.?0+$/, '')} 秒首杀` : ''}`
                                                : '待录入'}
                                        </Tag>
                                        {score && <Tag color={pending ? 'gold' : 'green'}>{pending ? '待发布' : '已发布'}</Tag>}
                                        {event?.status !== 'CLOSED' && <>
                                            <Button size="small" disabled={!row.firstRoundStartedAt} onClick={() => editScore(row, roundNumber)}>录分</Button>
                                            {pending && <Button size="small" type="link" disabled={busy} onClick={() => run(async () => {
                                                await publishLiveTournamentScore({ entryId: row.id, roundNumber });
                                                await refreshEntries();
                                                message.success('成绩已发布');
                                            })}>{score.publishedAt ? '重新发布' : '发布'}</Button>}
                                        </>}
                                    </Space>;
                                })}
                            </Space>
                        ) },
                        { title: '操作', width: 230, render: (_, row) => <Space wrap>
                            {row.fulfilled && <Tag color="green">整票已结算</Tag>}
                            {row.status === 'FINISHED' && !row.fulfilled && <Popconfirm
                                title="确认整票履约并结算？"
                                description={`向转盘锁定的服务者结算 ¥${Number(event?.providerFee ?? 0).toFixed(1)}，第二局弃权仍按整票结算。`}
                                onConfirm={() => run(async () => {
                                    const result = await settleLiveTournamentTicket(row.orderId);
                                    await refreshEntries();
                                    message.success(result.idempotent ? '该门票已结算' : '整票履约和结算已完成');
                                })}>
                                <Button type="primary" size="small" disabled={busy}>确认整票结算</Button>
                            </Popconfirm>}
                            {row.status === 'BOOKED' && <Button size="small" type="primary" disabled={busy}
                                onClick={() => queue([...queued.map(item => item.id), row.id])}>签到并排场</Button>}
                            {row.status === 'QUEUED' && <>
                                <Button size="small" disabled={busy || queued[0]?.id === row.id} onClick={() => move(row.id, -1)}>上移</Button>
                                <Button size="small" disabled={busy || queued[queued.length - 1]?.id === row.id} onClick={() => move(row.id, 1)}>下移</Button>
                            </>}
                            {['BOOKED', 'QUEUED', 'ABSENT'].includes(row.status) && <Button size="small" disabled={busy}
                                onClick={() => { setRescheduling(row); setTargetDayId(undefined); }}>调整场次</Button>}
                            {['BOOKED', 'QUEUED'].includes(row.status) && <Popconfirm title="标记缺席并移出候赛队列？"
                                onConfirm={() => queue(queued.filter(item => item.id !== row.id).map(item => item.id), row.id)}>
                                <Button size="small" danger disabled={busy}>缺席</Button>
                            </Popconfirm>}
                        </Space> },
                    ]} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择直播时段查看预约和候赛名单" />}
                </Card>
            </Space>
            <Modal title="调整参赛场次" open={Boolean(rescheduling)} okText="确认调整" cancelText="取消"
                confirmLoading={busy} okButtonProps={{ disabled: !targetDayId }}
                onCancel={() => { if (!busy) { setRescheduling(undefined); setTargetDayId(undefined); } }}
                onOk={() => run(async () => {
                    if (!rescheduling || !targetDayId) return;
                    await operateLiveTournament({ action: 'reschedule-entry', entryId: rescheduling.id, targetDayId });
                    await Promise.all([refreshEntries(), loadEvents()]);
                    setRescheduling(undefined);
                    setTargetDayId(undefined);
                    message.success('场次已调整，选手已排到目标候场队尾');
                })}>
                <Typography.Paragraph>
                    {rescheduling?.competitionName || rescheduling?.gameNickname || '当前选手'}将从原场次释放，目标场次有空位时自动加入候场队尾。
                </Typography.Paragraph>
                <Typography.Paragraph type="secondary">
                    目标场次有空位时可直接调整；若已满，先把原选手标记缺席并将替补移入原场次，目标场次释放席位后，再把原选手调整过去。
                </Typography.Paragraph>
                <Select style={{ width: '100%' }} value={targetDayId} placeholder="选择新的直播场次"
                    options={event?.days.map((item: any) => {
                        const occupied = Number(item?._count?.entries ?? 0);
                        const remaining = Math.max(0, Number(item.capacity || 0) - occupied);
                        const currentUnchanged = item.id === rescheduling?.dayId && rescheduling?.status !== 'ABSENT';
                        const ended = new Date(item.endsAt).getTime() <= Date.now();
                        const unavailable = currentUnchanged || ended || remaining <= 0;
                        const status = currentUnchanged ? '当前场次' : ended ? '已结束' : remaining <= 0 ? '已满' : '';
                        return {
                            label: `${formatTime(item.startsAt)} · 容量 ${item.capacity} · 剩余 ${remaining}${status ? ` · ${status}` : ''}`,
                            value: item.id,
                            disabled: unavailable,
                        };
                    })}
                    onChange={setTargetDayId} />
            </Modal>
            <Modal title={scoring && `${scoring.row.competitionName || scoring.row.gameNickname} · 第 ${scoring.roundNumber} 局`}
                open={Boolean(scoring)} onCancel={() => setScoring(undefined)} onOk={() => scoreForm.submit()}
                okText="保存成绩并核销" confirmLoading={busy}>
                <Form form={scoreForm} layout="vertical" onFinish={values => run(async () => {
                    if (!scoring) return;
                    const firstKillElapsedMs = values.kills > 0 ? Math.round(values.firstKillSeconds * 1000) : null;
                    const roundStartedAt = new Date(scoring.row.firstRoundStartedAt).getTime();
                    await saveLiveTournamentScore({
                        orderId: scoring.row.orderId, roundNumber: scoring.roundNumber,
                        kills: values.kills,
                        firstKillElapsedMs,
                        firstKillAt: firstKillElapsedMs === null ? null : new Date(roundStartedAt + firstKillElapsedMs).toISOString(),
                    });
                    await refreshEntries();
                    setScoring(undefined);
                    message.success('成绩已保存，可单独发布到榜单');
                })}>
                    <Form.Item name="kills" label="原始击杀数" extra="单局计分最多 6 分，原始击杀数仍用于排序。" rules={[{ required: true }]}>
                        <InputNumber min={0} precision={0} />
                    </Form.Item>
                    <Form.Item name="firstKillSeconds" label="首杀耗时（秒）"
                        extra={Number(kills) > 0 ? '从本局开打到首次击杀的耗时，支持 0.001 秒精度。' : '击杀数大于 0 后填写；0 杀无需首杀时间。'}
                        rules={[{ validator: (_, value) => Number(kills) > 0 && (value === undefined || value === null)
                            ? Promise.reject(new Error('请输入首杀耗时')) : Promise.resolve() }]}>
                        <InputNumber min={0} precision={3} step={0.001} disabled={Number(kills) <= 0}
                            style={{ width: '100%' }} placeholder="例如 12.386" />
                    </Form.Item>
                </Form>
                {scoring?.roundNumber === 2 && scoring.row.status !== 'ON_STAGE' && <Popconfirm
                    title="将第二局登记为弃权？" onConfirm={() => run(async () => {
                        await saveLiveTournamentScore({ orderId: scoring.row.orderId, roundNumber: 2, kills: 0, forfeited: true });
                        await refreshEntries();
                        setScoring(undefined);
                        message.success('已登记弃权');
                    })}><Button danger disabled={busy}>记为弃权</Button></Popconfirm>}
            </Modal>
            <Modal title={dialog === 'create' ? '创建直播挑战赛' : dialog === 'roster' ? '当日转盘名单' : '批量生成场次'} open={Boolean(dialog)}
                onCancel={() => setDialog(undefined)} onOk={() => form.submit()} confirmLoading={busy} destroyOnClose>
                <Form form={form} layout="vertical" preserve={false} onFinish={values => run(async () => {
                    const payload = { ...values, action: dialog, tournamentId: eventId, dayId };
                    for (const key of ['startsAt', 'endsAt', 'salesStartAt', 'salesEndAt']) {
                        if (values[key]) payload[key] = `${values[key].format('YYYY-MM-DDTHH:mm:ss')}+08:00`;
                    }
                    if (dialog === 'generate-days') {
                        for (const key of ['firstDate', 'lastDate']) payload[key] = values[key].format('YYYY-MM-DD');
                        for (const key of ['dailyStart', 'dailyEnd']) payload[key] = values[key].format('HH:mm');
                    }
                    const saved = await operateLiveTournament(payload);
                    await loadEvents();
                    if (dialog === 'create') { setEventId(saved.id); setDayId(undefined); }

                    setDialog(undefined);
                    message.success(dialog === 'generate-days' ? `已新增 ${saved.count} 场，已有日期保留` : '已保存');
                })}>
                    {dialog === 'create' && <>
                        <Form.Item name="title" label="赛事名称" rules={[{ required: true }]}><Input maxLength={100} /></Form.Item>
                        <Form.Item name="gameProjectId" label="门票商品" extra="门票售价取自所选商品。" rules={[{ required: true }]}><Select showSearch filterOption={false} options={options} onSearch={searchOptions} placeholder="搜索现有商品" /></Form.Item>
                        <Form.Item name="providerFee" label="服务者固定结算金额（元／票）" extra="整票履约后，按此金额向转盘抽中的服务者结算一次。" rules={[{ required: true }]}><InputNumber min={0} precision={1} /></Form.Item>
                        <Form.Item name="salesStartAt" label="售票开始（北京时间）" rules={[{ required: true }]}><DatePicker showTime /></Form.Item>
                        <Form.Item name="salesEndAt" label="售票截止（北京时间）" rules={[{ required: true }]}><DatePicker showTime /></Form.Item>
                    </>}
                    {dialog === 'create' && <Space wrap align="start">
                        <Form.Item name="bookingThreshold" label="开放预约门槛（已售张数）" rules={[{ required: true }]}>
                            <InputNumber min={1} max={70} precision={0} />
                        </Form.Item>
                        <Form.Item name="memberTicketLimit" label="每会员购票上限" rules={[{ required: true }]}>
                            <InputNumber min={1} max={70} precision={0} />
                        </Form.Item>
                    </Space>}
                    {dialog === 'create' && <Typography.Text type="secondary">赛期可稍后确定。发布后按售票时间售票，达门槛且已有场次时，会员即可预约。</Typography.Text>}
                    {dialog === 'generate-days' && <>
                        <Typography.Paragraph type="secondary">按北京时间每天生成一场。已有场次的日期会跳过。</Typography.Paragraph>
                        <Space wrap align="start">
                            <Form.Item name="firstDate" label="首场日期" rules={[{ required: true }]}><DatePicker /></Form.Item>
                            <Form.Item name="lastDate" label="末场日期" rules={[{ required: true }]}><DatePicker /></Form.Item>
                            <Form.Item name="dailyStart" label="每日开始" rules={[{ required: true }]}><TimePicker format="HH:mm" /></Form.Item>
                            <Form.Item name="dailyEnd" label="每日结束" rules={[{ required: true }]}><TimePicker format="HH:mm" /></Form.Item>
                        </Space>
                    </>}
                    {dialog === 'roster' && <Form.List name="quotas">
                        {(fields, { add, remove }) => <>
                            {fields.map(field => <Card key={field.key} size="small" style={{ marginBottom: 12 }}
                                extra={<Button type="link" danger onClick={() => remove(field.name)}>移除</Button>}>
                                <Form.Item name={[field.name, 'providerId']} label="服务者" rules={[{ required: true }]}>
                                    <Select showSearch filterOption={false} options={options} onSearch={searchOptions} placeholder="搜索店内服务者" />
                                </Form.Item>
                                <Space wrap>
                                    <Form.Item name={[field.name, 'minimum']} label="保底次数" rules={[{ required: true }]}>
                                        <InputNumber min={0} max={70} precision={0} />
                                    </Form.Item>
                                    <Form.Item name={[field.name, 'maximum']} label="上限次数" rules={[{ required: true }]}>
                                        <InputNumber min={1} max={70} precision={0} />
                                    </Form.Item>
                                </Space>
                            </Card>)}
                            <Button block type="dashed" onClick={() => add({ minimum: 0 })}>添加服务者</Button>
                        </>}
                    </Form.List>}
                    {dialog === 'generate-days' && <Form.Item name="capacity" label="参赛人数上限" rules={[{ required: true }]}><InputNumber min={1} max={70} precision={0} /></Form.Item>}
                </Form>
            </Modal>
        </PageContainer>
    );
}
