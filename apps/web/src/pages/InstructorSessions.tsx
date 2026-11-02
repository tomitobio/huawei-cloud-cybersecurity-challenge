import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';
import { Banner, Card, EmptyState, SectionTitle, StatusPill } from '../components/ui';
import type { ScenarioSummary, SessionListItem } from '../types';

export function SessionsPage() {
  const { t } = useTranslation();
  const { lt } = useLang();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [scenarioKey, setScenarioKey] = useState('');
  const [teamNames, setTeamNames] = useState('Equipo Alfa\nEquipo Bravo');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [s, sc] = await Promise.all([
      api.get<{ sessions: SessionListItem[] }>('/sessions'),
      api.get<{ scenarios: ScenarioSummary[] }>('/scenarios'),
    ]);
    setSessions(s.sessions);
    setScenarios(sc.scenarios);
    if (!scenarioKey && sc.scenarios[0]) setScenarioKey(sc.scenarios[0].key);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const teams = teamNames
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n, i) => ({ name: n, color: ['#22d3ee', '#f472b6', '#fbbf24', '#34d399', '#a78bfa'][i % 5] }));
      const res = await api.post<{ session: { id: string } }>('/sessions', { name, scenarioKey, teams });
      navigate(`/sessions/${res.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title={t('sessions.title')}
        right={
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? t('common.cancel') : t('sessions.new')}
          </button>
        }
      />

      {showForm && (
        <Card>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={create}>
            <div>
              <label className="label">{t('sessions.name')}</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">{t('sessions.scenario')}</label>
              <select className="input" value={scenarioKey} onChange={(e) => setScenarioKey(e.target.value)}>
                {scenarios.map((s) => (
                  <option key={s.key} value={s.key}>
                    {lt(s.name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">{t('common.teams')} (1 per line)</label>
              <textarea
                className="input h-24 font-mono text-sm"
                value={teamNames}
                onChange={(e) => setTeamNames(e.target.value)}
              />
            </div>
            {error && (
              <div className="sm:col-span-2">
                <Banner kind="error">{error}</Banner>
              </div>
            )}
            <div className="sm:col-span-2">
              <button className="btn-primary">{t('sessions.create')}</button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <EmptyState message={t('common.loading')} />
      ) : sessions.length === 0 ? (
        <EmptyState message={t('sessions.empty')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <Card key={s.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-100">{s.name}</h3>
                <StatusPill status={s.status} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{s.scenarioName}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                <span>
                  {s.teamCount} {t('sessions.teamCount')}
                </span>
                <span>
                  {t('console.currentEvent')}: R{s.currentRound}
                </span>
                <span className="ml-auto font-mono text-accent-cyan">{s.joinCode}</span>
              </div>
              <Link to={`/sessions/${s.id}`} className="btn-ghost mt-4">
                {t('sessions.open')}
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
