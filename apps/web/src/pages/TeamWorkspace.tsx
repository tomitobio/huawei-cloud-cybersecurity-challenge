import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLang } from '../lib/useLang';
import { getSocket, joinSessionRoom, joinTeamRoom } from '../lib/socket';
import { classifyArchetype } from '@hcc/shared';
import { archetypeBadge } from '../lib/archetype';
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
import type { OptionData, TeamReportData, TeamWorkspaceData } from '../types';

export function TeamWorkspacePage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { t } = useTranslation();
  const { lt } = useLang();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<TeamWorkspaceData | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [rationale, setRationale] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [report, setReport] = useState<TeamReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const load = useCallback(async () => {
    if (!teamId) return;
    const res = await api.get<{ workspace: TeamWorkspaceData }>(`/teams/${teamId}`);
    setData(res.workspace);
    if (res.workspace.submittedDecision) {
      const sd = res.workspace.submittedDecision;
      setSelected(sd.optionIds && sd.optionIds.length ? sd.optionIds : [sd.optionId]);
    }
  }, [teamId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/join');
      return;
    }
    void load();
    if (!teamId) return;
    joinTeamRoom(teamId);
    const socket = getSocket();
    const handler = () => void load();
    ['roundReleased', 'roundResolved', 'stateUpdated', 'decisionSubmitted', 'proposalCreated', 'voteCast', 'sessionStatus', 'deadlineSet'].forEach((ev) =>
      socket.on(ev, handler),
    );
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      ['roundReleased', 'roundResolved', 'stateUpdated', 'decisionSubmitted', 'proposalCreated', 'voteCast', 'sessionStatus', 'deadlineSet'].forEach((ev) =>
        socket.off(ev, handler),
      );
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, load, user, authLoading]);

  useEffect(() => {
    if (data?.session.id) joinSessionRoom(data.session.id);
  }, [data?.session.id]);

  if (!data) return <EmptyState message={t('common.loading')} />;

  const deadlinePassed = data.session.deadlineAt ? new Date(data.session.deadlineAt).getTime() < Date.now() : false;
  const locked = data.session.status === 'ENDED' || data.state.status !== 'active';
  const canAct = data.session.status === 'ACTIVE' && !locked && !deadlinePassed;
  // Explains *why* the action buttons are disabled, shown as a tooltip.
  const disabledReason = canAct
    ? undefined
    : locked
      ? t('team.locked')
      : data.session.status === 'PAUSED'
        ? t('team.paused')
        : data.session.status !== 'ACTIVE'
          ? t('team.waitingStart')
          : t('team.deadlinePassed');

  const selectedCost = data?.currentEvent
    ? data.currentEvent.options.filter((o) => selected.includes(o.id)).reduce((acc, o) => acc + o.cost, 0)
    : 0;
  const overBudget = Boolean(data) && selectedCost > data!.state.budget;
  const effortAvailable =
    typeof data?.state.effortRemaining === 'number'
      ? data.state.effortRemaining
      : typeof data?.session.effortPerRound === 'number'
        ? data.session.effortPerRound
        : null;
  const selectedEffort = data?.currentEvent
    ? data.currentEvent.options.filter((o) => selected.includes(o.id)).reduce((acc, o) => acc + (o.effort ?? 0), 0)
    : 0;
  const overEffort = typeof effortAvailable === 'number' && selectedEffort > effortAvailable;
  const teamFinished = data?.state.status === 'ended';

  async function submitDecision() {
    if (!teamId || selected.length === 0 || !data) return;
    setError(null);
    setMessage(null);
    try {
      await api.post(`/teams/${teamId}/decision`, { optionIds: selected, rationale, expectedVersion: data.state.version });
      setMessage(t('team.submitted'));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('team.actionFailed'));
      if (err instanceof ApiError && err.code === 'STALE_STATE') await load();
    }
  }

  async function generateTeamReport() {
    if (!teamId) return;
    setReportLoading(true);
    setError(null);
    try {
      const res = await api.get<{ report: TeamReportData }>(`/teams/${teamId}/report`);
      setReport(res.report);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('team.actionFailed'));
    } finally {
      setReportLoading(false);
    }
  }

  function toggleOption(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function propose(optionId: string) {
    if (!teamId) return;
    setError(null);
    setMessage(null);
    try {
      await api.post(`/teams/${teamId}/proposals`, { optionId, rationale });
      setMessage(t('team.proposalSent'));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('team.actionFailed'));
    }
  }

  async function vote(proposalId: string) {
    if (!teamId) return;
    setError(null);
    setMessage(null);
    try {
      await api.post(`/teams/${teamId}/vote`, { proposalId });
      setMessage(t('team.voteSent'));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('team.actionFailed'));
    }
  }

  const event = data.currentEvent;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ background: data.team.color }} />
        <h1 className="text-xl font-semibold text-white">{data.team.name}</h1>
        <StatusPill status={data.session.status} />
        <span className="chip font-mono">R{event?.round ?? data.session.currentRound}</span>
        {user && <span className="chip">{user.displayName} · {user.role}</span>}
        <div className="ml-auto text-right">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('console.timeLeft')}</p>
          <Countdown deadlineAt={data.session.deadlineAt} label={t('console.timeLeft')} />
        </div>
      </div>

      {message && <Banner kind="ok">{message}</Banner>}
      {error && <Banner kind="error">{error}</Banner>}
      {data.session.status === 'LOBBY' && <Banner kind="info">{t('team.waitingStart')}</Banner>}
      {data.session.status === 'PAUSED' && <Banner kind="info">{t('team.paused')}</Banner>}
      {deadlinePassed && !locked && <Banner kind="info">{t('team.deadlinePassed')}</Banner>}

      {teamFinished && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-200">{t('team.reportTitle')}</p>
              <p className="text-xs text-slate-500">{t('team.reportIntro')}</p>
            </div>
            <button className="btn-primary" disabled={reportLoading} onClick={() => void generateTeamReport()}>
              {reportLoading ? t('common.loading') : t('team.generateReport')}
            </button>
          </div>
        </Card>
      )}

      {report && <TeamReportView report={report} onClose={() => setReport(null)} />}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          {event ? (
            <Card>
              <p className="text-xs uppercase tracking-wide text-accent-cyan">
                {t('team.event')} · R{event.round} · {lt(event.phase)}
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">{lt(event.title)}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{lt(event.narrative)}</p>

              {event.intel.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('team.intel')}</p>
                  <ul className="mt-1 space-y-1 text-sm text-slate-300">
                    {event.intel.map((i, idx) => (
                      <li key={idx}>• {lt(i)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {event.businessImpact && (
                <div className="mt-3 rounded-lg border border-accent-amber/30 bg-accent-amber/5 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-accent-amber">{t('team.impact')}</p>
                  <p className="mt-1 text-sm text-amber-100">{lt(event.businessImpact)}</p>
                </div>
              )}
              {((event.signals && event.signals.length > 0) ||
                (event.hypotheses && event.hypotheses.length > 0)) && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {event.signals && event.signals.length > 0 && (
                    <div className="rounded-lg border border-base-700 bg-base-850/40 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-accent-cyan">
                        {t('team.signals')}
                        {typeof event.clarity === 'number' && ` · ${t('team.clarity')} ${Math.round(event.clarity * 100)}%`}
                      </p>
                      <ul className="mt-1 space-y-1 text-sm text-slate-300">
                        {event.signals.map((s) => (
                          <li key={s.id} className="flex items-start gap-2">
                            <span>{s.revealed ? '✓' : '?'}</span>
                            <span className={s.revealed ? 'text-slate-100' : 'text-slate-400'}>{lt(s.text)}</span>
                            <span className="ml-auto chip text-[10px]">
                              {s.revealed ? t('team.signalRevealed') : t('team.signalOpen')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {event.hypotheses && event.hypotheses.length > 0 && (
                    <div className="rounded-lg border border-base-700 bg-base-850/40 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {t('team.hypotheses')}
                      </p>
                      <ul className="mt-1 space-y-1 text-sm text-slate-300">
                        {event.hypotheses.map((h, idx) => (
                          <li key={idx}>• {lt(h)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <EmptyState message={data.session.status === 'ENDED' ? '✔' : t('team.waiting')} />
            </Card>
          )}

          {event && (
            <div className="space-y-3">
              <SectionTitle title={t('team.options')} subtitle={!canAct && !locked ? t('team.roundNotOpen') : t('team.selectMultiple')} />
              {event.options.map((opt) => (
                <OptionCard
                  key={opt.id}
                  option={opt}
                  selected={selected.includes(opt.id)}
                  submitted={Boolean(
                    data.submittedDecision &&
                      (data.submittedDecision.optionIds?.length
                        ? data.submittedDecision.optionIds
                        : [data.submittedDecision.optionId]
                      ).includes(opt.id),
                  )}
                  disabled={!canAct}
                  disabledTitle={disabledReason}
                  onSelect={() => toggleOption(opt.id)}
                  onPropose={() => void propose(opt.id)}
                />
              ))}
            </div>
          )}

          {event && (
            <Card>
              <SectionTitle title={t('team.rationale')} />
              <textarea
                className="input h-20"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                disabled={!canAct}
                placeholder={data.submittedDecision?.rationale ?? ''}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className={cn('text-xs', overBudget ? 'text-accent' : 'text-slate-400')}>
                  {t('team.totalCost')}: <span className="font-mono">{selectedCost}</span>
                  {typeof data.state.budget === 'number' && ` / ${data.state.budget}`}
                  {overBudget && ` · ${t('team.overBudget')}`}
                </span>
                {typeof effortAvailable === 'number' && (
                  <span className={cn('text-xs', overEffort ? 'text-accent' : 'text-slate-400')}>
                    ⚡ {t('team.effortTotal')}: <span className="font-mono">{selectedEffort}</span>
                    {` / ${effortAvailable}`}
                    {overEffort && ` · ${t('team.overEffort')}`}
                  </span>
                )}
                <button
                  className="btn-primary"
                  disabled={!canAct || selected.length === 0 || overBudget || overEffort}
                  title={!canAct ? disabledReason : overBudget ? t('team.overBudget') : overEffort ? t('team.overEffort') : undefined}
                  onClick={() => void submitDecision()}
                >
                  {data.submittedDecision ? `↻ ${t('team.submit')}` : t('team.submit')}
                </button>
                {data.submittedDecision && (
                  <span className="text-xs text-accent-emerald">
                    ✔ {t('team.submitted')}:{' '}
                    {(data.submittedDecision.optionIds?.length
                      ? data.submittedDecision.optionIds
                      : [data.submittedDecision.optionId]
                    ).join(', ')}
                  </span>
                )}
              </div>
            </Card>
          )}

          {data.proposals.length > 0 && (
            <Card>
              <SectionTitle title={t('team.proposals')} />
              <ul className="space-y-2">
                {data.proposals
                  .filter((p) => p.type === 'proposal')
                  .map((p) => {
                    const votes = data.proposals.filter((v) => v.type === 'vote' && v.payload.proposalId === p.id).length;
                    return (
                      <li key={p.id} className="flex items-center gap-3 rounded-lg border border-base-700 p-2 text-sm">
                        <span className="text-slate-300">{p.payload.optionId}</span>
                        <span className="text-xs text-slate-500">— {p.payload.by}</span>
                        {p.payload.rationale && <span className="truncate text-xs italic text-slate-500">“{p.payload.rationale}”</span>}
                        <span className="ml-auto chip">{votes} ★</span>
                        <button className="btn-ghost px-2 py-1 text-xs" disabled={!canAct} title={disabledReason} onClick={() => void vote(p.id)}>
                          {t('team.vote')}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <SectionTitle title={t('team.metrics')} />
            <div className="space-y-2">
              {(['continuity', 'riskReduction', 'customerTrust', 'financial', 'governance', 'responseQuality', 'efficiency'] as const).map((k) => (
                <MetricBar key={k} label={t(`metrics.${k}`)} value={data.state.metrics[k]} />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-base-700 pt-3 text-sm">
              <span className="text-slate-400">{t('common.budget')}</span>
              <span className="font-mono text-lg text-white">{data.state.budget}</span>
            </div>
            {typeof data.session.effortPerRound === 'number' && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-400">⚡ {t('team.effort')}</span>
                <span className="font-mono text-white">
                  {typeof data.state.effortRemaining === 'number' ? data.state.effortRemaining : data.session.effortPerRound}
                  {` / ${data.session.effortPerRound}`}
                </span>
              </div>
            )}
            {typeof data.session.incomePerRound === 'number' && data.session.incomePerRound > 0 && (
              <p className="mt-1 text-right text-[11px] text-slate-500">
                {t('team.budgetIncludes', { income: data.session.incomePerRound })}
              </p>
            )}
          </Card>

          <Card>
            <SectionTitle title={t('team.controls')} />
            <div className="flex flex-wrap gap-1">
              {data.state.fundedControls.length ? (
                data.state.fundedControls.map((c) => <span key={c} className="chip text-accent-cyan">{c.toUpperCase()}</span>)
              ) : (
                <span className="text-xs text-slate-500">—</span>
              )}
            </div>
            <div className="mt-3">
              <ArchitectureDiagram nodes={data.scenario.architecture} fundedControls={data.state.fundedControls} compact />
            </div>
          </Card>

          <Card>
            <SectionTitle title={t('console.leaderboard')} />
            <Leaderboard rows={data.leaderboard} highlightTeamId={data.team.id} />
          </Card>

          <Card>
            <SectionTitle title={t('team.timeline')} />
            {data.timeline.length === 0 ? (
              <p className="text-xs text-slate-500">—</p>
            ) : (
              <ol className="space-y-2 border-l border-base-700 pl-4">
                {data.timeline.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-base-600" />
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      R{e.round} · {lt(e.phase)}
                    </p>
                    <p className="text-xs text-slate-300">{lt(e.title)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function OptionCard({
  option,
  selected,
  submitted,
  disabled,
  disabledTitle,
  onSelect,
  onPropose,
}: {
  option: OptionData;
  selected: boolean;
  submitted: boolean;
  disabled: boolean;
  disabledTitle?: string;
  onSelect: () => void;
  onPropose: () => void;
}) {
  const { t } = useTranslation();
  const { lt } = useLang();
  const unavailable = !option.available;
  const reason =
    option.reason === 'budget'
      ? t('team.budgetLow')
      : option.reason === 'effort'
        ? t('team.effortLow')
        : option.reason === 'requires_cards'
          ? t('team.requiresCards')
          : t('team.reqNotMet');
  const { info: archInfo, cls: archCls } = archetypeBadge(classifyArchetype(option));
  return (
    <div
      className={cn(
        'card card-pad cursor-pointer transition',
        selected ? 'ring-2 ring-accent-cyan/60' : 'hover:border-base-600',
        unavailable && 'opacity-60',
      )}
      onClick={() => !disabled && !unavailable && onSelect()}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-1 h-4 w-4 flex-shrink-0 rounded-full border-2',
            selected ? 'border-accent-cyan bg-accent-cyan' : 'border-base-500',
          )}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-slate-100">{lt(option.label)}</h3>
            {submitted && <span className="chip border-accent-emerald/40 text-accent-emerald">{t('team.chosen')}</span>}
            <span className="ml-auto font-mono text-sm text-slate-300">
              {t('team.cost')}: {option.cost}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{lt(option.description)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={cn('chip text-[10px]', archCls)} title={lt(archInfo.label)}>
              {archInfo.emoji} {lt(archInfo.label)}
            </span>
            {option.premium && (
              <span className="chip text-[10px] text-accent-amber">★ {t('team.premium')}</span>
            )}
            {typeof option.effort === 'number' && option.effort > 0 && (
              <span className="chip text-[10px] text-accent-amber">⚡ {t('team.effort')} {option.effort}</span>
            )}
            {option.serviceCard && (
              <span className="chip text-[10px] text-accent-cyan">🛡 {t('team.serviceCard')}</span>
            )}
            {option.kind === 'investigate' && (
              <span className="chip text-[10px] text-accent-cyan">
                🔍 {t('team.investigate')}
                {option.revealsSignals && option.revealsSignals.length > 0 && ` · ${t('team.revealsSignals', { count: option.revealsSignals.length })}`}
              </span>
            )}
            {option.kind === 'investigate' && typeof option.clarityDelta === 'number' && option.clarityDelta > 0 && (
              <span className="chip text-[10px] text-accent-cyan">{t('team.clarityGain', { pct: Math.round(option.clarityDelta * 100) })}</span>
            )}
            {option.controls.map((c) => (
              <span key={c} className="chip text-[10px] text-accent-cyan">{c}</span>
            ))}
            {(option.missingRequires?.length ?? 0) > 0 && (
              <span className="chip text-[10px] text-rose-300" title={option.missingRequires!.map((m) => lt(m.label)).join(', ')}>
                🔒 {t('team.requiresCards')}: {option.missingRequires!.map((m) => lt(m.label)).join(', ')}
              </span>
            )}
            {(option.unlocks?.length ?? 0) > 0 && (
              <span className="chip text-[10px] text-accent-cyan" title={option.unlocks!.map((u) => lt(u.label)).join(', ')}>
                🔓 {t('team.unlocksCards')}: {option.unlocks!.map((u) => lt(u.label)).join(', ')}
              </span>
            )}
            {option.delayed && (
              <span className="chip text-[10px] text-amber-200">
                delayed: {Object.entries(option.delayed).map(([k, v]) => `${t(`metrics.${k}`, { defaultValue: k })} ${v > 0 ? '+' : ''}${v}`).join(', ')}
              </span>
            )}
            {option.risks && option.risks.length > 0 && (
              <span className="text-[11px] text-amber-200/80">⚠ {lt(option.risks[0])}</span>
            )}
          </div>
          {unavailable && <p className="mt-2 text-xs text-accent">{reason}</p>}
          <div className="mt-3 flex gap-2">
            <button
              className="btn-ghost px-2 py-1 text-xs"
              disabled={disabled || unavailable}
              title={disabled ? disabledTitle : unavailable ? reason : undefined}
              onClick={(e) => {
                e.stopPropagation();
                onPropose();
              }}
            >
              {t('team.proposal')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamReportView({ report, onClose }: { report: TeamReportData; onClose: () => void }) {
  const { t } = useTranslation();
  const { lt } = useLang();

  const DocButtons = ({ docs }: { docs: { label: string; url: string }[] }) => (
    <div className="mt-1 flex flex-wrap gap-2">
      {docs.map((d) => (
        <a
          key={d.url}
          href={d.url}
          target="_blank"
          rel="noreferrer"
          className="chip text-[11px] text-accent-cyan hover:underline"
        >
          {d.label} ↗
        </a>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-base-900/80 p-4 print:static print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl space-y-4 rounded-xl bg-base-800 p-5 shadow-xl print:bg-white print:text-black">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white print:text-black">{t('team.reportTitle')}</h2>
            <p className="text-xs text-slate-400">
              {report.team.name} · {lt(report.scenario.name)} · {t('team.score')}: {report.team.score}
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button className="btn-ghost" onClick={() => window.print()}>{t('team.print')}</button>
            <button className="btn-ghost" onClick={onClose}>{t('team.close')}</button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('team.score')}</p>
            <p className="text-2xl font-mono text-white print:text-black">{report.team.score}</p>
            <p className="text-xs text-slate-400">{t('team.maturity')}: {report.team.maturity}</p>
          </Card>
          <Card>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('team.budgetRemaining')}</p>
            <p className="text-2xl font-mono text-white print:text-black">{report.budget.remaining}</p>
            <p className="text-xs text-slate-400">
              {t('team.budgetStart')}: {report.budget.start} · {t('team.budgetSpent')}: {report.budget.spent}
            </p>
          </Card>
          <Card>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('team.clarityFinal')}</p>
            <p className="text-2xl font-mono text-white print:text-black">{Math.round(report.clarity * 100)}%</p>
            <p className="text-xs text-slate-400">{report.fundedControls.length} {t('team.controlsFunded')}</p>
          </Card>
        </div>

        <Card>
          <SectionTitle title={t('team.strengths')} />
          {report.strengths.length === 0 ? (
            <p className="text-xs text-slate-500">—</p>
          ) : (
            <ul className="space-y-2">
              {report.strengths.map((s, i) => (
                <li key={i} className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2">
                  <p className="text-sm text-emerald-200">✅ {lt(s.label)}</p>
                  {s.detail && <p className="text-xs text-slate-400">{lt(s.detail)}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle title={t('team.weaknesses')} />
          {report.weaknesses.length === 0 ? (
            <p className="text-xs text-slate-500">—</p>
          ) : (
            <ul className="space-y-2">
              {report.weaknesses.map((w, i) => (
                <li key={i} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
                  <p className="text-sm text-amber-200">⚠ {lt(w.label)}</p>
                  {w.detail && <p className="text-xs text-slate-400">{lt(w.detail)}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle title={t('team.architectureGaps')} />
          {report.architecture.gaps.length > 0 && (
            <ul className="mb-3 space-y-2">
              {report.architecture.gaps.map((g) => (
                <li key={g.control} className="rounded-lg border border-base-700 p-2">
                  <p className="text-sm text-slate-200">
                    {g.control} <span className="text-xs text-slate-500">({g.zone})</span>
                  </p>
                  {g.businessProblem && <p className="text-xs text-slate-400">{lt(g.businessProblem)}</p>}
                  <DocButtons docs={g.docs} />
                </li>
              ))}
            </ul>
          )}
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('team.coveredControls')}</p>
          <div className="flex flex-wrap gap-2">
            {report.architecture.services.map((svc) => (
              <span
                key={svc.service}
                className={cn('chip text-[11px]', svc.funded ? 'text-accent-emerald' : 'text-slate-500')}
              >
                {svc.funded ? '✓ ' : '· '}
                {svc.service}
              </span>
            ))}
          </div>
          <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('team.huaweiDocs')}</p>
          <div className="flex flex-wrap gap-2">
            {report.architecture.services
              .filter((s) => s.docs.length > 0)
              .map((s) => (
                <a
                  key={s.service}
                  href={s.docs[0]!.url}
                  target="_blank"
                  rel="noreferrer"
                  className="chip text-[11px] text-accent-cyan hover:underline"
                >
                  {s.service} ↗
                </a>
              ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title={t('team.decisions')} />
          {report.decisions.length === 0 ? (
            <p className="text-xs text-slate-500">—</p>
          ) : (
            <ol className="space-y-2">
              {report.decisions.map((d, i) => (
                <li key={i} className="rounded-lg border border-base-700 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">
                    {t('team.round')} {d.round} · {d.eventTitle ? lt(d.eventTitle) : d.eventId}
                  </p>
                  {d.noResponse ? (
                    <p className="text-xs text-amber-200">{t('team.noResponse')}</p>
                  ) : (
                    <p className="text-xs text-slate-300">{d.optionLabels.filter(Boolean).map((l) => lt(l!)).join(' · ')}</p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    {t('team.cost')}: {d.cost} · {t('team.score')}: {d.scoreDelta > 0 ? '+' : ''}{d.scoreDelta}
                    {d.controls.length > 0 && ` · ${d.controls.join(', ')}`}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <SectionTitle title={t('team.lessons')} />
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            {report.lessons.map((l, i) => (
              <li key={i}>{lt(l)}</li>
            ))}
          </ul>
          <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('team.correctReasoning')}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            {report.correctReasoning.map((l, i) => (
              <li key={i}>{lt(l)}</li>
            ))}
          </ul>
        </Card>

        <p className="rounded-lg border border-base-700 bg-base-900/40 p-3 text-[11px] text-slate-500">
          {lt(report.disclaimer)}
        </p>
      </div>
    </div>
  );
}
