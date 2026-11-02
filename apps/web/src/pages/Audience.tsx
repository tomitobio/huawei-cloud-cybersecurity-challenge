import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';
import { getSocket, joinSessionRoom } from '../lib/socket';
import { Card, EmptyState, SectionTitle, StatusPill } from '../components/ui';

interface AudienceView {
  sessionName: string;
  scenarioName: { es: string; en: string };
  status: string;
  currentRound: number;
  deadlineAt: string | null;
  organization: { name: string; description: { es: string; en: string } };
  leaderboard: { teamId: string; name: string; color: string; score: number; metrics: Record<string, number> }[];
  insights: { key: string; card: { displayName: string; businessProblem: { es: string; en: string } } | null }[];
}

export function AudiencePage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const { lt } = useLang();
  const [view, setView] = useState<AudienceView | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get<{ view: AudienceView }>(`/audience/${token}`);
      setView(res.view);
    } catch {
      setView(null);
    }
  }, [token]);

  useEffect(() => {
    void load();
    if (!token) return;
    const socket = getSocket();
    const handler = () => void load();
    ['roundReleased', 'roundResolved', 'insightRevealed', 'sessionStatus', 'stateUpdated'].forEach((ev) => socket.on(ev, handler));
    const timer = window.setInterval(() => void load(), 6000);
    return () => {
      ['roundReleased', 'roundResolved', 'insightRevealed', 'sessionStatus', 'stateUpdated'].forEach((ev) => socket.off(ev, handler));
      window.clearInterval(timer);
    };
  }, [token, load]);

  if (!view) return <EmptyState message={t('common.loading')} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-white">● {t('audience.live')}</span>
        <h1 className="text-2xl font-bold text-white">{view.sessionName}</h1>
        <StatusPill status={view.status} />
        <span className="ml-auto chip font-mono">R{view.currentRound}</span>
      </div>

      <Card>
        <SectionTitle title={view.organization.name} />
        <p className="text-sm text-slate-400">{lt(view.organization.description)}</p>
      </Card>

      <Card>
        <SectionTitle title={t('audience.standings')} />
        <ol className="space-y-2">
          {view.leaderboard.map((row, i) => (
            <li key={row.teamId} className="flex items-center gap-4 rounded-lg border border-base-700 p-3">
              <span className="w-8 text-center font-mono text-2xl font-bold text-slate-500">{i + 1}</span>
              <span className="h-3 w-3 rounded-full" style={{ background: row.color }} />
              <span className="flex-1 text-lg font-semibold text-slate-100">{row.name}</span>
              <span className="font-mono text-2xl font-bold text-white">{row.score.toFixed(1)}</span>
            </li>
          ))}
        </ol>
      </Card>

      {view.insights.length > 0 && (
        <Card>
          <SectionTitle title={t('console.insights')} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {view.insights.map((ins) =>
              ins.card ? (
                <div key={ins.key} className="rounded-lg border border-accent-cyan/30 p-3">
                  <p className="text-sm font-semibold text-accent-cyan">{ins.card.displayName}</p>
                  <p className="mt-1 text-xs text-slate-400">{lt(ins.card.businessProblem)}</p>
                </div>
              ) : null,
            )}
          </div>
        </Card>
      )}

      <p className="text-center text-xs text-slate-600">{t('common.readOnly')} · {t('appName')}</p>
    </div>
  );
}
