import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ProductCard } from '@hcc/shared';
import { api } from '../lib/api';
import { copyToClipboard } from '../lib/clipboard';
import { useLang } from '../lib/useLang';
import { getSocket, joinSessionRoom } from '../lib/socket';
import { ArchitectureDiagram } from '../components/ArchitectureDiagram';
import {
  Banner,
  Card,
  Countdown,
  EmptyState,
  Leaderboard,
  MetricBar,
  SectionTitle,
  StatusPill,
  cn,
} from '../components/ui';
import type { ConsoleTeam, SessionConsoleData } from '../types';

type Tab = 'live' | 'insights' | 'report';

export function ConsolePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { lt, lang } = useLang();
  const [data, setData] = useState<SessionConsoleData | null>(null);
  const [catalog, setCatalog] = useState<ProductCard[]>([]);
  const [tab, setTab] = useState<Tab>('live');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [report, setReport] = useState<ReportData | null>(null);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await api.get<{ session: SessionConsoleData }>(`/sessions/${id}`);
    setData(res.session);
    setSelectedTeam((prev) => prev || res.session.teams[0]?.id || '');
  }, [id]);

  useEffect(() => {
    void load();
    void api.get<{ cards: ProductCard[] }>('/catalog').then((r) => setCatalog(r.cards));
  }, [load]);

  useEffect(() => {
    if (!id) return;
    joinSessionRoom(id);
    const socket = getSocket();
    const handler = () => void load();
    ['roundReleased', 'roundResolved', 'decisionSubmitted', 'stateUpdated', 'insightRevealed', 'sessionStatus', 'deadlineSet'].forEach(
      (ev) => socket.on(ev, handler),
    );
    timer.current = window.setInterval(() => void load(), 5000);
    return () => {
      ['roundReleased', 'roundResolved', 'decisionSubmitted', 'stateUpdated', 'insightRevealed', 'sessionStatus', 'deadlineSet'].forEach(
        (ev) => socket.off(ev, handler),
      );
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [id, load]);

  async function action(path: string, body?: unknown, okMsg?: string) {
    if (!id) return;
    setError(null);
    setMessage(null);
    try {
      await api.post(`/sessions/${id}${path}`, body);
      if (okMsg) setMessage(okMsg);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function copy(text: string) {
    setError(null);
    setMessage(null);
    const ok = await copyToClipboard(text);
    if (ok) setMessage(t('common.copied'));
    else setError(t('common.copyFailed'));
  }

  const team = useMemo(() => data?.teams.find((x) => x.id === selectedTeam), [data, selectedTeam]);

  if (!data) return <EmptyState message={t('common.loading')} />;

  const audienceUrl = `${window.location.origin}/audience/${data.audienceToken}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">{data.name}</h1>
          <p className="text-xs text-slate-500">{lt(data.scenario.name)}</p>
        </div>
        <StatusPill status={data.status} />
        <span className="chip font-mono">R{data.currentRound}</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('console.timeLeft')}</p>
            <Countdown deadlineAt={data.deadlineAt} label={t('console.timeLeft')} />
          </div>
          <Link to={`/sessions/${id}/present`} className="btn-cyan">
            {t('console.presentation')}
          </Link>
        </div>
      </div>

      {message && <Banner kind="ok">{message}</Banner>}
      {error && <Banner kind="error">{error}</Banner>}

      <nav className="flex gap-1 border-b border-base-700">
        {(['live', 'insights', 'report'] as Tab[]).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
              tab === tb ? 'border-accent text-white' : 'border-transparent text-slate-400 hover:text-slate-200',
            )}
          >
            {tb === 'live' ? t('console.liveControl') : tb === 'insights' ? t('console.insights') : t('console.report')}
          </button>
        ))}
      </nav>

      {tab === 'live' && (
        <div className="space-y-5">
          <Card>
            <SectionTitle title={t('console.liveControl')} subtitle={`${t('sessions.joinCode')}: ${data.joinCode}`} />
            <div className="flex flex-wrap gap-2">
              {data.status === 'LOBBY' && (
                <button className="btn-primary" onClick={() => void action('/release', {}, 'Round released')}>
                  {t('console.start')}
                </button>
              )}
              {(data.status === 'ACTIVE' || data.status === 'PAUSED') && (
                <button className="btn-primary" onClick={() => void action('/release', {}, 'Round released')}>
                  {t('console.release')}
                </button>
              )}
              {data.status === 'ACTIVE' && (
                <button className="btn-ghost" onClick={() => void action('/pause')}>
                  {t('console.pause')}
                </button>
              )}
              {data.status === 'PAUSED' && (
                <button className="btn-ghost" onClick={() => void action('/resume')}>
                  {t('console.resume')}
                </button>
              )}
              {(data.status === 'ACTIVE' || data.status === 'PAUSED') && (
                <>
                  <button className="btn-cyan" onClick={() => void action('/resolve', {}, 'Round resolved')}>
                    {t('console.resolve')}
                  </button>
                  <button className="btn-ghost" onClick={() => void action('/resolve', { force: true }, 'Forced')}>
                    {t('console.force')}
                  </button>
                  <button className="btn-ghost" onClick={() => void action('/deadline', { seconds: data.deadlineSeconds })}>
                    {t('console.setDeadline')}
                  </button>
                </>
              )}
              {data.status !== 'ENDED' && (
                <button className="btn-ghost" onClick={() => void action('/end')}>
                  {t('console.end')}
                </button>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-base-700 pt-3 text-xs">
              <span className="text-slate-500">{t('console.audienceLink')}:</span>
              <code className="rounded bg-base-900 px-2 py-1 text-accent-cyan">{audienceUrl}</code>
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => void copy(audienceUrl)}>
                {t('common.copy')}
              </button>
              <button
                className="btn-ghost px-2 py-1 text-xs"
                onClick={() => void copy(data.teams.map((tm) => `${tm.name}: ${tm.joinCode}`).join('\n'))}
              >
                {t('console.copyCodes')}
              </button>
              <span className="text-slate-500">
                {t('console.seed')}: <span className="font-mono text-slate-300">{data.seed}</span>
              </span>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-3">
              <SectionTitle title={t('console.teams')} />
              <div className="grid gap-3 sm:grid-cols-2">
                {data.teams.map((tm) => (
                  <TeamCard key={tm.id} team={tm} onSelect={() => setSelectedTeam(tm.id)} selected={tm.id === selectedTeam} />
                ))}
              </div>
            </div>
            <div className="space-y-5">
              <Card>
                <SectionTitle title={t('console.leaderboard')} />
                <Leaderboard rows={data.leaderboard} />
              </Card>
              {team?.state && (
                <Card>
                  <SectionTitle title={`${lt(data.scenario.name)}`} subtitle={team.name} />
                  <ArchitectureDiagram nodes={data.scenario.architecture} fundedControls={team.state.flags.filter((f) => f.endsWith('_funded')).map((f) => f.replace('_funded', ''))} compact />
                </Card>
              )}
            </div>
          </div>

          <Card>
            <SectionTitle title={t('console.audit')} />
            <div className="max-h-56 overflow-auto">
              {data.audit.length === 0 ? (
                <EmptyState message="—" />
              ) : (
                <ul className="space-y-1 text-xs">
                  {data.audit.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono text-slate-500">{new Date(a.createdAt).toLocaleTimeString()}</span>
                      <span className="text-accent-cyan">{a.action}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === 'insights' && (
        <div className="space-y-4">
          <SectionTitle title={t('console.insights')} subtitle={`${t('console.revealed')}: ${data.insights.join(', ') || '—'}`} />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {catalog.map((card) => {
              const revealed = data.insights.includes(card.key);
              return (
                <div key={card.key} className={cn('card card-pad space-y-2', revealed && 'ring-1 ring-accent-cyan/40')}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-accent-cyan">{card.displayName}</h3>
                    {revealed && <span className="chip border-accent-cyan/40 text-accent-cyan">{t('console.revealed')}</span>}
                  </div>
                  <p className="text-xs text-slate-400">{lt(card.businessProblem)}</p>
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-300">
                    {card.capabilities.slice(0, 3).map((c, i) => (
                      <li key={i}>{lt(c)}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-200/80">⚠ {lt(card.limitations[0])}</p>
                  <div className="flex items-center justify-between pt-1">
                    <a href={card.docs[0]?.url} target="_blank" rel="noreferrer" className="text-xs text-accent-cyan hover:underline">
                      Docs ↗
                    </a>
                    <button className="btn-cyan px-2 py-1 text-xs" onClick={() => void action('/insights', { insightKey: card.key }, 'Insight revealed')}>
                      {t('console.revealInsight')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'report' && (
        <div className="space-y-4">
          <SectionTitle
            title={t('console.report')}
            right={
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => void generateReport(id!, setReport, setError)}>
                  {t('console.generateReport')}
                </button>
                {report && (
                  <button className="btn-ghost" onClick={() => window.print()}>
                    🖨 Print / PDF
                  </button>
                )}
              </div>
            }
          />
          {report ? <ReportView report={report} lang={lang} lt={lt} /> : <EmptyState message={t('console.generateReport')} />}
        </div>
      )}
    </div>
  );
}

function TeamCard({ team, onSelect, selected }: { team: ConsoleTeam; onSelect: () => void; selected: boolean }) {
  const { t } = useTranslation();
  const { lt } = useLang();
  const funded = (team.state?.flags ?? []).filter((f) => f.endsWith('_funded')).map((f) => f.replace('_funded', ''));
  return (
    <div
      onClick={onSelect}
      className={cn(
        'card card-pad cursor-pointer space-y-3',
        selected ? 'ring-1 ring-accent-cyan/50' : 'hover:border-base-600',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: team.color }} />
        <span className="font-medium text-slate-100">{team.name}</span>
        <span className="ml-auto font-mono text-sm text-white">{team.score.toFixed(1)}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="font-mono">{team.joinCode}</span>
        <span>
          {t('common.budget')}: <span className="font-mono text-slate-200">{team.state?.budget ?? 0}</span>
        </span>
        <span className="chip ml-auto">{team.members.length} 👤</span>
      </div>
      {team.state && (
        <div className="space-y-1.5">
          {(['continuity', 'riskReduction', 'responseQuality'] as const).map((k) => (
            <MetricBar key={k} label={t(`metrics.${k}`)} value={team.state!.metrics[k]} compact />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {funded.length ? funded.map((c) => <span key={c} className="chip text-[10px] text-accent-cyan">{c}</span>) : <span className="text-[10px] text-slate-500">—</span>}
      </div>
      {team.currentEvent && (
        <div className="rounded-lg border border-base-700 bg-base-900/60 p-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            R{team.currentEvent.round} · {lt(team.currentEvent.phase)}
          </p>
          <p className="text-xs text-slate-200">{lt(team.currentEvent.title)}</p>
          {team.pendingDecision ? (
            <p className="mt-1 text-[11px] text-accent-emerald">✔ {t('console.submitted')}: {team.pendingDecision.optionId}</p>
          ) : (
            <p className="mt-1 text-[11px] text-accent-amber">… {t('console.pending')}</p>
          )}
          {team.pendingDecision?.rationale && (
            <p className="mt-1 text-[11px] italic text-slate-400">“{team.pendingDecision.rationale}”</p>
          )}
          {team.currentEvent.instructorNotes && (
            <p className="mt-1 text-[11px] text-slate-500">📝 {lt(team.currentEvent.instructorNotes)}</p>
          )}
        </div>
      )}
    </div>
  );
}

interface ReportData {
  generatedAt: string;
  workshop: { name: string; date: string; scenario: { es: string; en: string }; organization: { name: string; industry: { es: string; en: string } } };
  disclaimer: { es: string; en: string };
  ranking: { rank: number; name: string; score: number; color: string }[];
  teams: {
    name: string;
    color: string;
    score: number;
    rank: number;
    metrics: Record<string, number>;
    budgetSpent: number;
    fundedControls: string[];
    decisions: { round: number; eventTitle?: { es: string; en: string }; optionLabel?: { es: string; en: string }; cost: number; scoreDelta: number; rationale: string; controls: string[] }[];
    successfulDecisions: unknown[];
    missedOpportunities: unknown[];
    noResponse: number[];
  }[];
  metricComparison: { key: string; label: { es: string; en: string }; weight: number; values: { name: string; value: number }[] }[];
  relevantControls: { service: string; docs: { label: string; url: string }[] }[];
  lessonsLearned: { es: string; en: string }[];
  correctReasoning: { es: string; en: string }[];
}

async function generateReport(id: string, setReport: (r: ReportData) => void, setError: (e: string) => void) {
  try {
    const res = await api.get<{ report: ReportData }>(`/sessions/${id}/report`);
    setReport(res.report);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Error');
  }
}

function ReportView({
  report,
  lt,
}: {
  report: ReportData;
  lang: 'es' | 'en';
  lt: (t?: { es: string; en: string } | null) => string;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Banner kind="info">{lt(report.disclaimer)}</Banner>
      <Card>
        <h3 className="text-base font-semibold text-white">{report.workshop.name}</h3>
        <p className="text-xs text-slate-400">
          {new Date(report.workshop.date).toLocaleDateString()} · {report.workshop.organization?.name} · {lt(report.workshop.scenario)}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {report.ranking.map((r) => (
            <div key={r.name} className="flex items-center gap-2 rounded-lg border border-base-700 p-2">
              <span className="font-mono text-slate-400">#{r.rank}</span>
              <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
              <span className="text-sm text-slate-200">{r.name}</span>
              <span className="ml-auto font-mono text-white">{r.score.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Decision timeline" />
        <div className="space-y-3">
          {report.teams.map((tm) => (
            <div key={tm.name} className="rounded-lg border border-base-700 p-3">
              <p className="text-sm font-medium text-slate-100">
                {tm.name} · <span className="font-mono">{tm.score.toFixed(1)}</span> · {t('common.budget')} spent {tm.budgetSpent}
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {tm.decisions.map((d, i) => (
                  <li key={i} className="flex flex-wrap gap-2">
                    <span className="font-mono text-slate-500">R{d.round}</span>
                    <span className="text-slate-300">{lt(d.optionLabel)}</span>
                    <span className={d.scoreDelta >= 0 ? 'text-accent-emerald' : 'text-accent'}>
                      {d.scoreDelta >= 0 ? '+' : ''}
                      {d.scoreDelta}
                    </span>
                    {d.controls.map((c) => (
                      <span key={c} className="chip text-[10px] text-accent-cyan">{c}</span>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Metric comparison" />
        <div className="space-y-2">
          {report.metricComparison.map((m) => (
            <div key={m.key}>
              <p className="mb-1 text-xs text-slate-400">
                {lt(m.label)} <span className="text-slate-600">(w={m.weight.toFixed(2)})</span>
              </p>
              <div className="flex gap-2">
                {m.values.map((v) => (
                  <div key={v.name} className="flex-1">
                    <div className="h-2 overflow-hidden rounded bg-base-700">
                      <div className="h-full bg-accent-cyan" style={{ width: `${v.value}%` }} />
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-slate-500">{v.name}: {Math.round(v.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle title="Lessons learned" />
          <ul className="list-disc space-y-1 pl-4 text-sm text-slate-300">
            {report.lessonsLearned.map((l, i) => (
              <li key={i}>{lt(l)}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionTitle title="Correct reasoning" />
          <ul className="list-disc space-y-1 pl-4 text-sm text-slate-300">
            {report.correctReasoning.map((l, i) => (
              <li key={i}>{lt(l)}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Relevant Huawei Cloud services" />
        <div className="flex flex-wrap gap-3">
          {report.relevantControls.map((c) => (
            <a key={c.service} href={c.docs[0]?.url} target="_blank" rel="noreferrer" className="chip border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10">
              {c.service} ↗
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
