import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CONTROL_IDS, METRIC_KEYS } from '@hcc/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLang } from '../lib/useLang';
import { Banner, Card, EmptyState, SectionTitle, cn } from '../components/ui';
import type { GameCardRow } from '../types';

type Draft = {
  cardKey: string;
  labelEs: string;
  labelEn: string;
  descEs: string;
  descEn: string;
  cost: number;
  controls: string[];
  tags: string;
  kind: 'action' | 'investigate';
  immediate: string;
  delayed: string;
  scoreDelta: number;
  clarityDelta: number;
  revealsSignals: string;
  premiumOnFocus: boolean;
  serviceCard: boolean;
  baseWeight: number;
  isActive: boolean;
};

function blankDraft(): Draft {
  return {
    cardKey: '',
    labelEs: '',
    labelEn: '',
    descEs: '',
    descEn: '',
    cost: 10,
    controls: [],
    tags: '',
    kind: 'action',
    immediate: '',
    delayed: '',
    scoreDelta: 5,
    clarityDelta: 0,
    revealsSignals: '',
    premiumOnFocus: false,
    serviceCard: false,
    baseWeight: 1,
    isActive: true,
  };
}

function cardToDraft(card: GameCardRow): Draft {
  return {
    cardKey: card.cardKey,
    labelEs: card.label?.es ?? '',
    labelEn: card.label?.en ?? '',
    descEs: card.description?.es ?? '',
    descEn: card.description?.en ?? '',
    cost: card.cost,
    controls: card.controls ?? [],
    tags: (card.tags ?? []).join(', '),
    kind: (card.kind as Draft['kind']) === 'investigate' ? 'investigate' : 'action',
    immediate: card.immediate ? JSON.stringify(card.immediate) : '',
    delayed: card.delayed ? JSON.stringify(card.delayed) : '',
    scoreDelta: card.scoreDelta ?? 0,
    clarityDelta: card.clarityDelta ?? 0,
    revealsSignals: (card.revealsSignals ?? []).join(', '),
    premiumOnFocus: Boolean(card.premiumOnFocus),
    serviceCard: Boolean(card.serviceCard),
    baseWeight: card.baseWeight ?? 1,
    isActive: card.isActive !== false,
  };
}

function parseJsonField(value: string): Record<string, number> | undefined {
  if (!value.trim()) return undefined;
  const parsed = JSON.parse(value);
  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
    throw new Error('expected a JSON object');
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(parsed)) out[k] = Number(v);
  return out;
}

function draftToPayload(d: Draft) {
  return {
    cardKey: d.cardKey.trim(),
    label: { es: d.labelEs.trim(), en: d.labelEn.trim() },
    description: { es: d.descEs.trim(), en: d.descEn.trim() },
    cost: Number(d.cost),
    controls: d.controls,
    tags: d.tags.split(',').map((s) => s.trim()).filter(Boolean),
    kind: d.kind,
    immediate: parseJsonField(d.immediate),
    delayed: parseJsonField(d.delayed),
    scoreDelta: Number(d.scoreDelta),
    clarityDelta: Number(d.clarityDelta),
    revealsSignals: d.revealsSignals.split(',').map((s) => s.trim()).filter(Boolean),
    premiumOnFocus: d.premiumOnFocus,
    serviceCard: d.serviceCard,
    baseWeight: Number(d.baseWeight),
    isActive: d.isActive,
  };
}

export function CardLibraryPage() {
  const { t } = useTranslation();
  const { lt } = useLang();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN';

  const [cards, setCards] = useState<GameCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [controlFilter, setControlFilter] = useState<string>('');

  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ cards: GameCardRow[] }>('/cards');
      setCards(res.cards);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (controlFilter && !(c.controls as string[]).includes(controlFilter)) return false;
      if (!q) return true;
      const hay = `${c.cardKey} ${c.label?.es} ${c.label?.en}`.toLowerCase();
      return hay.includes(q);
    });
  }, [cards, query, controlFilter]);

  function startNew() {
    setError(null);
    setMessage(null);
    setEditingKey(null);
    setDraft(blankDraft());
  }

  function startEdit(card: GameCardRow) {
    setError(null);
    setMessage(null);
    setEditingKey(card.cardKey);
    setDraft(cardToDraft(card));
  }

  function cancel() {
    setDraft(null);
    setEditingKey(null);
  }

  async function save() {
    if (!draft) return;
    setError(null);
    setMessage(null);
    let payload;
    try {
      payload = draftToPayload(draft);
    } catch (err) {
      setError(t('cards.jsonError', { msg: err instanceof Error ? err.message : 'parse error' }));
      return;
    }
    if (!payload.cardKey) {
      setError(t('cards.keyRequired'));
      return;
    }
    setBusy(true);
    try {
      if (editingKey) {
        await api.put(`/cards/${encodeURIComponent(editingKey)}`, payload);
      } else {
        await api.post('/cards', payload);
      }
      setDraft(null);
      setEditingKey(null);
      await load();
      setMessage(t('cards.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(card: GameCardRow) {
    if (!window.confirm(t('cards.deleteConfirm', { key: card.cardKey }))) return;
    setError(null);
    setMessage(null);
    try {
      await api.del(`/cards/${encodeURIComponent(card.cardKey)}`);
      await load();
      setMessage(t('cards.deleted'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  function toggleControl(control: string) {
    setDraft((d) => {
      if (!d) return d;
      const has = d.controls.includes(control);
      return { ...d, controls: has ? d.controls.filter((c) => c !== control) : [...d.controls, control] };
    });
  }

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title={t('cards.title')}
        subtitle={t('cards.subtitle')}
        right={
          canEdit ? (
            <button className="btn-primary" onClick={startNew}>
              {t('cards.new')}
            </button>
          ) : (
            <span className="chip">{t('common.readOnly')}</span>
          )
        }
      />

      {message && <Banner kind="ok">{message}</Banner>}
      {error && <Banner kind="error">{error}</Banner>}
      {!canEdit && <Banner kind="info">{t('cards.instructorHint')}</Banner>}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input flex-1"
                placeholder={t('cards.search')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select className="input w-40" value={controlFilter} onChange={(e) => setControlFilter(e.target.value)}>
                <option value="">{t('cards.allControls')}</option>
                {CONTROL_IDS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="chip text-[11px] text-slate-400">
                {filtered.length}/{cards.length}
              </span>
            </div>

            {loading ? (
              <EmptyState message={t('common.loading')} />
            ) : filtered.length === 0 ? (
              <EmptyState message={t('cards.empty')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="py-1 pr-3">{t('cards.colKey')}</th>
                      <th className="py-1 pr-3">{t('cards.colLabel')}</th>
                      <th className="py-1 pr-3">{t('cards.colCost')}</th>
                      <th className="py-1 pr-3">{t('cards.colControls')}</th>
                      <th className="py-1 pr-3">{t('cards.colKind')}</th>
                      <th className="py-1 pr-3">{t('cards.colWeight')}</th>
                      <th className="py-1 pr-3">{t('cards.colFlags')}</th>
                      {canEdit && <th className="py-1 pr-3" />}
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {filtered.map((c) => (
                      <tr key={c.cardKey} className="border-t border-base-700 align-top">
                        <td className="py-2 pr-3 font-mono text-xs">{c.cardKey}</td>
                        <td className="py-2 pr-3">
                          <div className="text-slate-100">{c.label ? lt(c.label) : '—'}</div>
                          <div className="text-[11px] text-slate-500">{c.description ? lt(c.description) : ''}</div>
                        </td>
                        <td className="py-2 pr-3 font-mono">{c.cost}</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {(c.controls ?? []).map((ctrl) => (
                              <span key={ctrl} className="chip text-[10px]">
                                {ctrl}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-xs">{c.kind}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{c.baseWeight}</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {c.serviceCard && <span className="chip text-[10px] text-accent-cyan">🛡</span>}
                            {c.premiumOnFocus && <span className="chip text-[10px] text-accent-amber">★</span>}
                            {!c.isActive && <span className="chip text-[10px] text-accent">{t('cards.inactive')}</span>}
                          </div>
                        </td>
                        {canEdit && (
                          <td className="py-2 pr-3">
                            <div className="flex gap-1">
                              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => startEdit(c)}>
                                {t('cards.edit')}
                              </button>
                              <button className="btn-ghost px-2 py-1 text-xs text-rose-300" onClick={() => void remove(c)}>
                                {t('cards.delete')}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {draft && canEdit && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-200">
                {editingKey ? t('cards.editTitle') : t('cards.newTitle')}
              </p>
              <button className="btn-ghost px-2 py-1 text-xs" onClick={cancel}>
                {t('common.close')}
              </button>
            </div>

            <div>
              <label className="label">{t('cards.fieldKey')}</label>
              <input
                className="input font-mono text-xs"
                value={draft.cardKey}
                disabled={Boolean(editingKey)}
                onChange={(e) => setField('cardKey', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">{t('cards.fieldLabelEs')}</label>
                <input className="input" value={draft.labelEs} onChange={(e) => setField('labelEs', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('cards.fieldLabelEn')}</label>
                <input className="input" value={draft.labelEn} onChange={(e) => setField('labelEn', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">{t('cards.fieldDescEs')}</label>
                <textarea className="input h-16" value={draft.descEs} onChange={(e) => setField('descEs', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('cards.fieldDescEn')}</label>
                <textarea className="input h-16" value={draft.descEn} onChange={(e) => setField('descEn', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">{t('cards.fieldCost')}</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={draft.cost}
                  onChange={(e) => setField('cost', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label">{t('cards.fieldScore')}</label>
                <input
                  className="input"
                  type="number"
                  value={draft.scoreDelta}
                  onChange={(e) => setField('scoreDelta', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label">{t('cards.fieldWeight')}</label>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  min={0}
                  value={draft.baseWeight}
                  onChange={(e) => setField('baseWeight', Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="label">{t('cards.fieldKind')}</label>
              <select className="input" value={draft.kind} onChange={(e) => setField('kind', e.target.value as Draft['kind'])}>
                <option value="action">action</option>
                <option value="investigate">investigate</option>
              </select>
            </div>

            <div>
              <label className="label">{t('cards.fieldControls')}</label>
              <div className="flex flex-wrap gap-1">
                {CONTROL_IDS.map((ctrl) => (
                  <button
                    key={ctrl}
                    type="button"
                    className={cn(
                      'chip text-[11px]',
                      draft.controls.includes(ctrl)
                        ? 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan'
                        : 'text-slate-400',
                    )}
                    onClick={() => toggleControl(ctrl)}
                  >
                    {ctrl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">{t('cards.fieldTags')}</label>
              <input className="input" value={draft.tags} onChange={(e) => setField('tags', e.target.value)} />
            </div>

            <div>
              <label className="label">{t('cards.fieldImmediate')}</label>
              <textarea
                className="input h-16 font-mono text-xs"
                placeholder='{"riskReduction": 5}'
                value={draft.immediate}
                onChange={(e) => setField('immediate', e.target.value)}
              />
              <p className="mt-1 text-[10px] text-slate-500">
                {t('cards.metricsHint')}: {METRIC_KEYS.join(', ')}
              </p>
            </div>
            <div>
              <label className="label">{t('cards.fieldDelayed')}</label>
              <textarea
                className="input h-16 font-mono text-xs"
                placeholder='{"continuity": -3}'
                value={draft.delayed}
                onChange={(e) => setField('delayed', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">{t('cards.fieldClarity')}</label>
                <input
                  className="input"
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  value={draft.clarityDelta}
                  onChange={(e) => setField('clarityDelta', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label">{t('cards.fieldSignals')}</label>
                <input
                  className="input"
                  value={draft.revealsSignals}
                  onChange={(e) => setField('revealsSignals', e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-slate-300">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={draft.premiumOnFocus}
                  onChange={(e) => setField('premiumOnFocus', e.target.checked)}
                />
                {t('cards.fieldPremium')}
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={draft.serviceCard}
                  onChange={(e) => setField('serviceCard', e.target.checked)}
                />
                {t('cards.fieldService')}
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={draft.isActive} onChange={(e) => setField('isActive', e.target.checked)} />
                {t('cards.fieldActive')}
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={cancel}>
                {t('common.cancel')}
              </button>
              <button className="btn-primary" disabled={busy} onClick={() => void save()}>
                {busy ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
