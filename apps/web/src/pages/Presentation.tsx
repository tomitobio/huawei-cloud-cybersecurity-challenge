import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';
import { getSocket, joinSessionRoom } from '../lib/socket';
import { ArchitectureDiagram } from '../components/ArchitectureDiagram';
import { Countdown, EmptyState, MetricBar, StatusPill, cn } from '../components/ui';
import type { SessionConsoleData } from '../types';

export function PresentationPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { lt } = useLang();
  const [data, setData] = useState<SessionConsoleData | null>(null);
  const [featured, setFeatured] = useState<string>('');

  const load = useCallback(async () => {
    if (!id) return;
    const res = await api.get<{ session: SessionConsoleData }>(`/sessions/${id}`);
    setData(res.session);
    setFeatured((p) => p || res.session.teams[0]?.id || '');
  }, [id]);

  useEffect(() => {
    void load();
    const socket = getSocket();
    const handler = () => void load();
    if (id) joinSessionRoom(id);
    ['roundReleased', 'roundResolved', 'stateUpdated', 'insightRevealed', 'sessionStatus'].forEach((ev) => socket.on(ev, handler));
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      ['roundReleased', 'roundResolved', 'stateUpdated', 'insightRevealed', 'sessionStatus'].forEach((ev) => socket.off(ev, handler));
      window.clearInterval(timer);
    };
  }, [id, load]);

  if (!data) return <EmptyState message={t('common.loading')} />;
  const team = data.teams.find((x) => x.id === featured) ?? data.teams[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{data.scenario.organization.name}</h1>
          <p className="text-sm text-slate-400">{lt(data.scenario.name)}</p>
        </div>
        <StatusPill status={data.status} />
        <div className="ml-auto flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('console.currentEvent')}</p>
            <p className="font-mono text-2xl font-bold text-white">R{data.currentRound}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('console.timeLeft')}</p>
            <span className="text-4xl">
              <Countdown deadlineAt={data.deadlineAt} label={t('console.timeLeft')} />
            </span>
          </div>
          <Link to={`/sessions/${id}`} className="btn-ghost text-xs">
            ← {t('common.back')}
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <div className="card card-pad">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">{t('console.leaderboard')}</h2>
            <ol className="space-y-2">
              {data.leaderboard.map((row, i) => (
                <li key={row.teamId} className={cn('flex items-center gap-3 rounded-lg border p-3', row.teamId === featured ? 'border-accent-cyan/50 bg-accent-cyan/5' : 'border-base-700')}>
                  <span className="w-8 text-center font-mono text-2xl font-bold text-slate-500">{i + 1}</span>
                  <span className="h-3 w-3 rounded-full" style={{ background: row.color }} />
                  <div className="flex-1">
                    <p className="text-lg font-semibold text-slate-100">{row.name}</p>
                    <div className="mt-1 flex gap-3">
                      {(['continuity', 'riskReduction'] as const).map((k) => (
                        <span key={k} className="text-[11px] text-slate-500">
                          {t(`metrics.${k}`)} <span className="font-mono text-slate-300">{Math.round(row.metrics[k])}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="font-mono text-3xl font-bold text-white">{row.score.toFixed(1)}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="card card-pad">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">{lt(data.scenario.organization.objectives[0])}</h2>
            <ul className="space-y-1 text-sm text-slate-400">
              {data.scenario.organization.objectives.map((o, i) => (
                <li key={i}>• {lt(o)}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card card-pad">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{t('team.event')}</h2>
              <div className="ml-auto flex gap-1">
                {data.teams.map((tm) => (
                  <button
                    key={tm.id}
                    onClick={() => setFeatured(tm.id)}
                    className={cn('rounded px-2 py-1 text-[11px]', tm.id === featured ? 'bg-base-700 text-white' : 'text-slate-500 hover:text-slate-300')}
                  >
                    {tm.name}
                  </button>
                ))}
              </div>
            </div>
            {team?.currentEvent ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-accent-cyan">
                  R{team.currentEvent.round} · {lt(team.currentEvent.phase)}
                </p>
                <h3 className="text-2xl font-bold text-white">{lt(team.currentEvent.title)}</h3>
                <p className="text-sm text-slate-400">
                  {team.pendingDecision ? `✔ ${t('console.submitted')}` : `… ${t('console.pending')}`}
                </p>
              </div>
            ) : (
              <EmptyState message="—" />
            )}
          </div>

          {team?.state && (
            <div className="card card-pad space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{t('team.metrics')}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['continuity', 'riskReduction', 'customerTrust', 'responseQuality'] as const).map((k) => (
                  <MetricBar key={k} label={t(`metrics.${k}`)} value={team.state!.metrics[k]} />
                ))}
              </div>
              <ArchitectureDiagram
                nodes={data.scenario.architecture}
                fundedControls={team.state.flags.filter((f) => f.endsWith('_funded')).map((f) => f.replace('_funded', ''))}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
