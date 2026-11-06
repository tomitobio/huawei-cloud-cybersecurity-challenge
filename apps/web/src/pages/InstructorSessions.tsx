import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';
import { Banner, Card, EmptyState, SectionTitle, StatusPill } from '../components/ui';
import type { CardOverride, ScenarioDetail, ScenarioSummary, SessionListItem } from '../types';

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
  const [seed, setSeed] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scenarioDetail, setScenarioDetail] = useState<ScenarioDetail | null>(null);
  const [overrides, setOverrides] = useState<Record<string, CardOverride>>({});
  const [showCosts, setShowCosts] = useState(false);

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

  // Load the selected scenario's cards so the admin can set cost/points per card
  // for this session (instead of baking those values into the card library).
  useEffect(() => {
    if (!scenarioKey) return;
    let alive = true;
    api
      .get<{ scenario: ScenarioDetail }>(`/scenarios/${encodeURIComponent(scenarioKey)}`)
      .then((res) => {
        if (!alive) return;
        setScenarioDetail(res.scenario);
        setOverrides({});
      })
      .catch(() => {
        if (alive) setScenarioDetail(null);
      });
    return () => {
      alive = false;
    };
  }, [scenarioKey]);

  const deckCards = useMemo(() => {
    if (!scenarioDetail?.cards) return [];
    const byId = new Map(scenarioDetail.cards.map((c) => [c.id, c]));
    const ids = new Set<string>();
    scenarioDetail.deck?.fixed?.forEach((id) => ids.add(id));
    scenarioDetail.deck?.pool?.forEach((id) => ids.add(id));
    if (scenarioDetail.deck?.serviceFixed) {
      scenarioDetail.cards.forEach((c) => {
        if (c.serviceCard) ids.add(c.id);
      });
    }
    return [...ids].map((id) => byId.get(id)).filter(Boolean) as NonNullable<ScenarioDetail['cards']>;
  }, [scenarioDetail]);

  function setOverride(id: string, field: 'cost' | 'scoreDelta', value: number) {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const teams = teamNames
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n, i) => ({ name: n, color: ['#22d3ee', '#f472b6', '#fbbf24', '#34d399', '#a78bfa'][i % 5] }));
      const res = await api.post<{ session: { id: string } }>('/sessions', {
        name,
        scenarioKey,
        seed: seed.trim() === '' ? undefined : Number(seed.trim()),
        cardOverrides: Object.keys(overrides).length ? overrides : undefined,
        teams,
      });
      navigate(`/sessions/${res.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function remove(session: SessionListItem) {
    if (!window.confirm(t('sessions.deleteConfirm', { name: session.name }))) return;
    setError(null);
    try {
      await api.del(`/sessions/${session.id}`);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sessions.deleteError'));
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

      {error && <Banner kind="error">{error}</Banner>}

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
            <div>
              <label className="label">{t('sessions.seed')}</label>
              <input
                className="input font-mono"
                inputMode="numeric"
                placeholder={t('sessions.seedPlaceholder')}
                value={seed}
                onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, ''))}
              />
              <p className="mt-1 text-xs text-slate-500">{t('sessions.seedHint')}</p>
            </div>
            <div className="sm:col-span-2 rounded border border-base-700 p-3">
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => setShowCosts((v) => !v)}
              >
                {showCosts ? '▾' : '▸'} {t('sessions.costTitle')} ({deckCards.length})
              </button>
              <p className="mt-1 text-xs text-slate-500">{t('sessions.costHint')}</p>
              {showCosts &&
                (deckCards.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">{t('sessions.costNoCards')}</p>
                ) : (
                  <div className="mt-2 max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] uppercase text-slate-500">
                        <tr>
                          <th className="py-1 pr-2">{t('sessions.costCard')}</th>
                          <th className="py-1 pr-2">{t('sessions.costDefault')}</th>
                          <th className="py-1 pr-2">{t('sessions.costCost')}</th>
                          <th className="py-1 pr-2">{t('sessions.costScore')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deckCards.map((card) => (
                          <tr key={card.id} className="border-t border-base-700 align-middle">
                            <td className="py-1 pr-2">
                              <div className="text-slate-200">{lt(card.label)}</div>
                              <div className="font-mono text-[10px] text-slate-500">{card.id}</div>
                            </td>
                            <td className="py-1 pr-2 font-mono text-slate-400">
                              {card.cost} / {card.scoreDelta ?? 0}
                            </td>
                            <td className="py-1 pr-2">
                              <input
                                type="number"
                                min={0}
                                className="input w-20 py-1"
                                value={overrides[card.id]?.cost ?? card.cost}
                                onChange={(e) => setOverride(card.id, 'cost', Number(e.target.value))}
                              />
                            </td>
                            <td className="py-1 pr-2">
                              <input
                                type="number"
                                className="input w-20 py-1"
                                value={overrides[card.id]?.scoreDelta ?? (card.scoreDelta ?? 0)}
                                onChange={(e) => setOverride(card.id, 'scoreDelta', Number(e.target.value))}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button type="button" className="btn-ghost mt-2 text-xs" onClick={() => setOverrides({})}>
                      {t('sessions.costReset')}
                    </button>
                  </div>
                ))}
            </div>
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
              <p className="mt-1 text-xs text-slate-500">
                {(() => {
                  const sc = scenarios.find((x) => x.key === s.scenarioKey);
                  return sc ? lt(sc.name) : s.scenarioName;
                })()}
              </p>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                <span>
                  {s.teamCount} {t('sessions.teamCount')}
                </span>
                <span>
                  {t('console.currentEvent')}: R{s.currentRound}
                </span>
                <span className="ml-auto font-mono text-accent-cyan">{s.joinCode}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {t('sessions.seed')}: <span className="font-mono">{s.seed}</span>
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Link to={`/sessions/${s.id}`} className="btn-ghost flex-1">
                  {t('sessions.open')}
                </Link>
                <button
                  className="btn-ghost text-accent hover:border-accent/50"
                  title={t('sessions.delete')}
                  aria-label={t('sessions.delete')}
                  onClick={() => void remove(s)}
                >
                  🗑
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
