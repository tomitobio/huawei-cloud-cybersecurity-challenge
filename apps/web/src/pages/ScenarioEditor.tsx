import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CONTROL_IDS, METRIC_KEYS, type Scenario, type MetricKey } from '@hcc/shared';
import { api } from '../lib/api';
import { useLang } from '../lib/useLang';
import { Banner, Card, EmptyState, SectionTitle, cn } from '../components/ui';
import type { GameCardRow, ScenarioPreviewResult, ScenarioSummary } from '../types';

/** A minimal, valid, playable scenario to start a new custom definition. */
function blankScenario(key: string): Scenario {
  return {
    key,
    version: 1,
    name: { es: 'Nuevo escenario', en: 'New scenario' },
    summary: {
      es: 'Describe aquí la organización ficticia y el reto.',
      en: 'Describe the fictional organization and challenge here.',
    },
    organization: {
      name: 'Organización Ficticia',
      industry: { es: 'Sector', en: 'Industry' },
      size: { es: 'Tamaño', en: 'Size' },
      description: { es: 'Descripción de la organización.', en: 'Organization description.' },
      objectives: [{ es: 'Objetivo 1', en: 'Objective 1' }],
      criticalAssets: [
        {
          name: { es: 'Activo crítico', en: 'Critical asset' },
          criticality: 'high',
          description: { es: 'Descripción.', en: 'Description.' },
        },
      ],
    },
    architecture: [{ id: 'internet', label: { es: 'Internet', en: 'Internet' }, zone: 'internet' }],
    start: { budget: 100, maturity: 'medium' },
    weights: {
      continuity: 0.2,
      riskReduction: 0.2,
      customerTrust: 0.14,
      responseQuality: 0.14,
      financial: 0.12,
      governance: 0.1,
      efficiency: 0.1,
    },
    events: [
      {
        id: 'e1',
        round: 1,
        phase: { es: 'Preparación', en: 'Preparation' },
        title: { es: 'Primer evento', en: 'First event' },
        narrative: { es: 'Situación inicial.', en: 'Initial situation.' },
        options: [
          {
            id: 'opt-a',
            label: { es: 'Opción A', en: 'Option A' },
            description: { es: 'Descripción A.', en: 'Description A.' },
            cost: 10,
            controls: [],
            immediate: { riskReduction: 5 },
            scoreDelta: 5,
          },
          {
            id: 'opt-b',
            label: { es: 'Opción B', en: 'Option B' },
            description: { es: 'Descripción B.', en: 'Description B.' },
            cost: 0,
            controls: [],
            immediate: { riskReduction: -5 },
            scoreDelta: -5,
          },
        ],
      },
    ],
    debrief: {
      learningObjectives: [{ es: 'Objetivo de aprendizaje.', en: 'Learning objective.' }],
      correctReasoning: [{ es: 'Razonamiento correcto.', en: 'Correct reasoning.' }],
    },
  };
}

export function ScenarioEditorPage() {
  const { t } = useTranslation();
  const { lt } = useLang();

  const [list, setList] = useState<ScenarioSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ScenarioSummary | null>(null);
  const [def, setDef] = useState<Scenario | null>(null);
  const [originalKey, setOriginalKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [eventsText, setEventsText] = useState('');
  const [problems, setProblems] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<ScenarioPreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cardLib, setCardLib] = useState<GameCardRow[]>([]);

  async function loadList() {
    setLoading(true);
    const res = await api.get<{ scenarios: ScenarioSummary[] }>('/scenarios');
    setList(res.scenarios);
    setLoading(false);
  }

  useEffect(() => {
    void loadList();
    void (async () => {
      try {
        const res = await api.get<{ cards: GameCardRow[] }>('/cards');
        setCardLib(res.cards.filter((c) => c.isActive !== false));
      } catch {
        setCardLib([]);
      }
    })();
  }, []);

  function resetFeedback() {
    setError(null);
    setMessage(null);
    setProblems(null);
    setPreview(null);
  }

  async function openScenario(summary: ScenarioSummary) {
    resetFeedback();
    setSelected(summary);
    const res = await api.get<{ scenario: Scenario; problems: string[] }>(`/scenarios/${summary.key}`);
    setDef(res.scenario);
    setEventsText(JSON.stringify(res.scenario.events, null, 2));
    setProblems(res.problems.length ? res.problems : null);
    const isCustom = summary.source === 'custom';
    setEditing(isCustom);
    setOriginalKey(isCustom ? summary.key : null);
  }

  function startDuplicate() {
    if (!def) return;
    const key = window.prompt(t('editor.newKeyPrompt'), `${def.key}-copy`);
    if (!key) return;
    resetFeedback();
    const clone: Scenario = JSON.parse(JSON.stringify(def));
    clone.key = key;
    clone.version = 1;
    setDef(clone);
    setEventsText(JSON.stringify(clone.events, null, 2));
    setSelected(null);
    setEditing(true);
    setOriginalKey(null);
  }

  function startNew() {
    const key = window.prompt(t('editor.newKeyPrompt'), 'custom-scenario');
    if (!key) return;
    resetFeedback();
    const fresh = blankScenario(key);
    setDef(fresh);
    setEventsText(JSON.stringify(fresh.events, null, 2));
    setSelected(null);
    setEditing(true);
    setOriginalKey(null);
  }

  async function removeScenario(summary: ScenarioSummary) {
    if (!window.confirm(t('editor.deleteConfirm'))) return;
    try {
      await api.del(`/scenarios/${summary.key}`);
      setSelected(null);
      setDef(null);
      await loadList();
      setMessage(t('editor.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  /** Patch the top-level definition immutably. */
  function patch(p: Partial<Scenario>) {
    setDef((d) => (d ? { ...d, ...p } : d));
  }

  function patchLocalized(field: 'name' | 'summary', lang: 'es' | 'en', value: string) {
    setDef((d) => (d ? { ...d, [field]: { ...d[field], [lang]: value } } : d));
  }

  function patchWeight(key: MetricKey, value: number) {
    setDef((d) => (d ? { ...d, weights: { ...d.weights, [key]: value } } : d));
  }

  const emptyDeck: NonNullable<Scenario['deck']> = { fixed: [], pool: [], drawCount: 5 };

  function patchDeck(p: Partial<NonNullable<Scenario['deck']>>) {
    setDef((d) => (d ? { ...d, deck: { ...(d.deck ?? emptyDeck), ...p } } : d));
  }

  function toggleDeckCard(which: 'fixed' | 'pool', key: string) {
    setDef((d) => {
      if (!d) return d;
      const deck = d.deck ?? emptyDeck;
      const current = new Set(deck[which]);
      if (current.has(key)) current.delete(key);
      else current.add(key);
      return { ...d, deck: { ...deck, [which]: [...current] } };
    });
  }

  function patchDeckWeight(key: string, value: number) {
    setDef((d) => {
      if (!d) return d;
      const deck = d.deck ?? emptyDeck;
      return { ...d, deck: { ...deck, weights: { ...(deck.weights ?? {}), [key]: value } } };
    });
  }

  function patchEventHand(index: number, hand: { fixed?: string[]; drawCount?: number } | undefined) {
    if (!def) return;
    const events = def.events.map((e, i) => (i === index ? { ...e, hand } : e));
    setDef({ ...def, events });
    setEventsText(JSON.stringify(events, null, 2));
  }

  function toggleEventHandFixed(index: number, key: string) {
    if (!def) return;
    const ev = def.events[index];
    const current = new Set(ev.hand?.fixed ?? []);
    if (current.has(key)) current.delete(key);
    else current.add(key);
    const next: { fixed?: string[]; drawCount?: number } = { ...(ev.hand ?? {}) };
    next.fixed = [...current];
    if (next.fixed.length === 0) delete next.fixed;
    patchEventHand(index, Object.keys(next).length ? next : undefined);
  }

  function applyEventsJson(): boolean {
    if (!def) return false;
    try {
      const parsed = JSON.parse(eventsText);
      if (!Array.isArray(parsed)) throw new Error('events must be an array');
      setDef({ ...def, events: parsed });
      setError(null);
      return true;
    } catch (err) {
      setError(t('editor.jsonError', { msg: err instanceof Error ? err.message : 'parse error' }));
      return false;
    }
  }

  function currentDefinition(): Scenario | null {
    if (!def) return null;
    try {
      const parsed = JSON.parse(eventsText);
      return { ...def, events: parsed };
    } catch {
      return def;
    }
  }

  async function validate() {
    const candidate = currentDefinition();
    if (!candidate) return;
    setBusy(true);
    resetFeedback();
    try {
      const res = await api.post<{ ok: boolean; problems: string[] }>('/scenarios/validate', {
        scenario: candidate,
      });
      setProblems(res.problems.length ? res.problems : null);
      if (res.ok) setMessage(t('editor.noProblems'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function runPreview() {
    const candidate = currentDefinition();
    if (!candidate) return;
    setBusy(true);
    resetFeedback();
    try {
      const res = await api.post<ScenarioPreviewResult>('/scenarios/preview', { scenario: candidate });
      setPreview(res);
      setProblems(res.problems.length ? res.problems : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const candidate = currentDefinition();
    if (!candidate) return;
    if (!candidate.key) {
      setError(t('editor.keyRequired'));
      return;
    }
    if (!applyEventsJson()) return;
    setBusy(true);
    resetFeedback();
    try {
      if (originalKey) {
        await api.put(`/scenarios/${originalKey}`, { scenario: candidate });
      } else {
        await api.post('/scenarios', { scenario: candidate });
      }
      setOriginalKey(candidate.key);
      setEditing(true);
      await loadList();
      setMessage(t('editor.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  const weightsTotal = useMemo(
    () => (def ? METRIC_KEYS.reduce((acc, k) => acc + (def.weights[k] ?? 0), 0) : 0),
    [def],
  );

  return (
    <div className="space-y-4">
      <SectionTitle
        title={t('editor.title')}
        subtitle={t('editor.subtitle')}
        right={
          <button className="btn-primary" onClick={startNew}>
            {t('editor.new')}
          </button>
        }
      />

      {message && <Banner kind="ok">{message}</Banner>}
      {error && <Banner kind="error">{error}</Banner>}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Scenario list */}
        <div className="space-y-2">
          {loading ? (
            <EmptyState message={t('common.loading')} />
          ) : (
            list.map((s) => (
              <button
                key={s.key}
                onClick={() => void openScenario(s)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                  selected?.key === s.key
                    ? 'border-accent-cyan/50 bg-accent-cyan/5'
                    : 'border-base-700 bg-base-800/60 hover:border-base-600',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-100">{lt(s.name)}</span>
                  <span
                    className={cn(
                      'chip text-[10px]',
                      s.source === 'builtin'
                        ? 'border-base-600 bg-base-700 text-slate-300'
                        : 'border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan',
                    )}
                  >
                    {s.source === 'builtin' ? t('editor.builtin') : t('editor.custom')}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-mono">{s.key}</span>
                  <span>· {s.eventCount} {t('editor.events')}</span>
                  <span className={cn('ml-auto', s.valid ? 'text-accent-emerald' : 'text-accent')}>
                    {s.valid ? t('editor.validDef') : t('editor.invalidDef')}
                  </span>
                </div>
                {s.isActive === false && <span className="text-[10px] text-accent-amber">{t('editor.inactive')}</span>}
              </button>
            ))
          )}
        </div>

        {/* Editor / viewer */}
        <div>
          {!def ? (
            <Card>
              <EmptyState message={t('editor.selectHint')} />
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-slate-300">
                    <span className="font-mono text-slate-400">{def.key}</span>
                    {selected?.source === 'builtin' && (
                      <span className="ml-2 text-xs text-slate-500">({t('editor.builtin')})</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-ghost" onClick={startDuplicate}>
                      {t('editor.duplicate')}
                    </button>
                    {selected?.source === 'custom' && (
                      <button
                        className="btn-ghost text-rose-300"
                        onClick={() => selected && void removeScenario(selected)}
                      >
                        {t('editor.delete')}
                      </button>
                    )}
                    <button className="btn-ghost" disabled={busy} onClick={() => void validate()}>
                      {t('editor.validate')}
                    </button>
                    <button className="btn-ghost" disabled={busy} onClick={() => void runPreview()}>
                      {t('editor.preview')}
                    </button>
                    <button className="btn-primary" disabled={busy || !editing} onClick={() => void save()}>
                      {t('editor.save')}
                    </button>
                  </div>
                </div>

                {!editing && <Banner kind="info">{t('editor.builtinHint')}</Banner>}

                {/* Metadata */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('editor.key')}>
                    <input
                      className="input"
                      value={def.key}
                      disabled={!editing || Boolean(originalKey)}
                      onChange={(e) => patch({ key: e.target.value })}
                    />
                  </Field>
                  <Field label={t('editor.version')}>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={def.version}
                      disabled={!editing}
                      onChange={(e) => patch({ version: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label={t('editor.nameEs')}>
                    <input
                      className="input"
                      value={def.name.es}
                      disabled={!editing}
                      onChange={(e) => patchLocalized('name', 'es', e.target.value)}
                    />
                  </Field>
                  <Field label={t('editor.nameEn')}>
                    <input
                      className="input"
                      value={def.name.en}
                      disabled={!editing}
                      onChange={(e) => patchLocalized('name', 'en', e.target.value)}
                    />
                  </Field>
                  <Field label={t('editor.summaryEs')}>
                    <textarea
                      className="input h-16"
                      value={def.summary.es}
                      disabled={!editing}
                      onChange={(e) => patchLocalized('summary', 'es', e.target.value)}
                    />
                  </Field>
                  <Field label={t('editor.summaryEn')}>
                    <textarea
                      className="input h-16"
                      value={def.summary.en}
                      disabled={!editing}
                      onChange={(e) => patchLocalized('summary', 'en', e.target.value)}
                    />
                  </Field>
                  <Field label={t('editor.organization')}>
                    <input
                      className="input"
                      value={def.organization.name}
                      disabled={!editing}
                      onChange={(e) => patch({ organization: { ...def.organization, name: e.target.value } })}
                    />
                  </Field>
                  <Field label={t('editor.maturity')}>
                    <select
                      className="input"
                      value={def.start.maturity}
                      disabled={!editing}
                      onChange={(e) =>
                        patch({ start: { ...def.start, maturity: e.target.value as 'low' | 'medium' | 'high' } })
                      }
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>
                  </Field>
                  <Field label={t('editor.budget')}>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={def.start.budget}
                      disabled={!editing}
                      onChange={(e) => patch({ start: { ...def.start, budget: Number(e.target.value) } })}
                    />
                  </Field>
                </div>

                {/* Weights */}
                <div>
                  <p className="label">
                    {t('editor.weights')} <span className="text-slate-500">(Σ {weightsTotal.toFixed(2)})</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {METRIC_KEYS.map((k) => (
                      <div key={k}>
                        <label className="text-[11px] text-slate-500">{k}</label>
                        <input
                          className="input"
                          type="number"
                          step="0.01"
                          min={0}
                          value={def.weights[k] ?? 0}
                          disabled={!editing}
                          onChange={(e) => patchWeight(k, Number(e.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Controls reference */}
                <div>
                  <p className="label">{t('editor.controlsRef')}</p>
                  <div className="flex flex-wrap gap-1">
                    {CONTROL_IDS.map((c) => (
                      <span key={c} className="chip border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Deck & cards */}
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-200">{t('editor.deckTitle')}</p>
                  <span className="text-[11px] text-slate-500">{t('editor.deckHint')}</span>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-1 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      disabled={!editing}
                      checked={Boolean(def.deck?.serviceFixed)}
                      onChange={(e) => patchDeck({ serviceFixed: e.target.checked })}
                    />
                    {t('editor.deckServiceFixed')}
                  </label>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span>{t('editor.deckDrawCount')}</span>
                    <input
                      className="input w-20"
                      type="number"
                      min={0}
                      disabled={!editing}
                      value={def.deck?.drawCount ?? 5}
                      onChange={(e) => patchDeck({ drawCount: Number(e.target.value) })}
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {(def.deck?.fixed ?? []).length} {t('editor.deckFixedLower')} · {(def.deck?.pool ?? []).length}{' '}
                    {t('editor.deckPoolLower')}
                  </span>
                </div>

                {cardLib.length === 0 ? (
                  <EmptyState message={t('editor.deckNoCards')} />
                ) : (
                  <>
                    <div>
                      <p className="label">{t('editor.deckFixed')}</p>
                      <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
                        {cardLib.map((c) => {
                          const active = (def.deck?.fixed ?? []).includes(c.cardKey);
                          return (
                            <button
                              type="button"
                              key={c.cardKey}
                              disabled={!editing}
                              onClick={() => toggleDeckCard('fixed', c.cardKey)}
                              className={cn(
                                'chip text-[11px]',
                                active
                                  ? 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan'
                                  : 'text-slate-400',
                              )}
                            >
                              {c.cardKey}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="label">{t('editor.deckPool')}</p>
                      <div className="max-h-60 space-y-1 overflow-y-auto">
                        {cardLib.map((c) => {
                          const active = (def.deck?.pool ?? []).includes(c.cardKey);
                          return (
                            <div key={c.cardKey} className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={!editing}
                                onClick={() => toggleDeckCard('pool', c.cardKey)}
                                className={cn(
                                  'chip flex-1 justify-start text-left text-[11px]',
                                  active
                                    ? 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan'
                                    : 'text-slate-400',
                                )}
                              >
                                {c.cardKey}
                                {c.label && <span className="ml-2 truncate text-slate-500">{lt(c.label)}</span>}
                              </button>
                              {active && (
                                <input
                                  className="input w-16"
                                  type="number"
                                  step="0.1"
                                  min={0}
                                  disabled={!editing}
                                  title={t('editor.deckWeight')}
                                  value={def.deck?.weights?.[c.cardKey] ?? c.baseWeight}
                                  onChange={(e) => patchDeckWeight(c.cardKey, Number(e.target.value))}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="label">{t('editor.deckPerEvent')}</p>
                      <div className="space-y-1">
                        {def.events.map((ev, i) => (
                          <details key={ev.id ?? i} className="rounded border border-base-700 p-2">
                            <summary className="cursor-pointer text-xs text-slate-300">
                              {t('editor.round')} {ev.round} · {lt(ev.title)}
                              {ev.hand && (
                                <span className="chip ml-2 text-[10px] text-accent-cyan">
                                  {t('editor.deckOverride')}
                                </span>
                              )}
                            </summary>
                            <div className="mt-2 space-y-2">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                                <span>{t('editor.deckEventDrawCount')}</span>
                                <input
                                  className="input w-20"
                                  type="number"
                                  min={0}
                                  disabled={!editing}
                                  value={ev.hand?.drawCount ?? ''}
                                  placeholder={String(def.deck?.drawCount ?? 5)}
                                  onChange={(e) => {
                                    const n = e.target.value;
                                    const next: { fixed?: string[]; drawCount?: number } = { ...(ev.hand ?? {}) };
                                    if (n === '') delete next.drawCount;
                                    else next.drawCount = Number(n);
                                    patchEventHand(i, Object.keys(next).length ? next : undefined);
                                  }}
                                />
                                <button
                                  className="btn-ghost px-2 py-1 text-[11px]"
                                  disabled={!editing || !ev.hand}
                                  onClick={() => patchEventHand(i, undefined)}
                                >
                                  {t('editor.deckClearOverride')}
                                </button>
                              </div>
                              <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                                {cardLib.map((c) => {
                                  const active = (ev.hand?.fixed ?? []).includes(c.cardKey);
                                  return (
                                    <button
                                      type="button"
                                      key={c.cardKey}
                                      disabled={!editing}
                                      onClick={() => toggleEventHandFixed(i, c.cardKey)}
                                      className={cn(
                                        'chip text-[10px]',
                                        active
                                          ? 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan'
                                          : 'text-slate-400',
                                      )}
                                    >
                                      {c.cardKey}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </Card>

              {/* Events JSON */}
              <Card className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-200">{t('editor.eventsJson')}</p>
                  <div className="flex gap-2">
                    <button
                      className="btn-ghost"
                      disabled={!editing}
                      onClick={() => {
                        try {
                          setEventsText(JSON.stringify(JSON.parse(eventsText), null, 2));
                          setError(null);
                        } catch (err) {
                          setError(t('editor.jsonError', { msg: err instanceof Error ? err.message : 'parse error' }));
                        }
                      }}
                    >
                      {t('editor.formatJson')}
                    </button>
                    <button className="btn-ghost" disabled={!editing} onClick={() => applyEventsJson()}>
                      {t('editor.applyJson')}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{t('editor.eventsHelp')}</p>
                <textarea
                  className="input h-80 font-mono text-xs leading-relaxed"
                  value={eventsText}
                  spellCheck={false}
                  disabled={!editing}
                  onChange={(e) => setEventsText(e.target.value)}
                />
              </Card>

              {/* Problems */}
              {problems && (
                <Card>
                  <p className="mb-2 text-sm font-semibold text-rose-300">{t('editor.problems')}</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-300">
                    {problems.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </Card>
              )}
              {!problems && message && <Banner kind="ok">{t('editor.noProblems')}</Banner>}

              {/* Preview */}
              {preview && (
                <Card className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-200">{t('editor.previewTitle')}</p>
                    <span className="font-mono text-sm text-accent-cyan">
                      {t('editor.previewFinal')}: {preview.finalScore.toFixed(2)}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="py-1 pr-3">#</th>
                          <th className="py-1 pr-3">R</th>
                          <th className="py-1 pr-3">{t('editor.step')}</th>
                          <th className="py-1 pr-3">{t('editor.choice')}</th>
                          <th className="py-1 pr-3">{t('common.budget')}</th>
                          <th className="py-1 pr-3">{t('editor.previewScore')}</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-300">
                        {preview.steps.map((s, i) => (
                          <tr key={i} className="border-t border-base-700">
                            <td className="py-1 pr-3 text-slate-500">{i + 1}</td>
                            <td className="py-1 pr-3">{s.round}</td>
                            <td className="py-1 pr-3">{lt(s.title)}</td>
                            <td className="py-1 pr-3">{lt(s.optionLabel)}</td>
                            <td className="py-1 pr-3 font-mono">{s.budget}</td>
                            <td className="py-1 pr-3 font-mono">{s.score.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
