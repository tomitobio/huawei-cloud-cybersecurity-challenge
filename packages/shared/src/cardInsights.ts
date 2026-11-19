import type { LocalizedText } from './types';

/**
 * Card "shape" / archetype taxonomy. Purely derived from a card's tags, controls,
 * kind and flags so it works both for built-in `DecisionOption`s and for the
 * admin-managed `GameCard` rows. Used by the UI to make each card's role visible
 * at a glance (colour + icon) and to lay cards out by role.
 */
export type CardArchetype =
  | 'service'
  | 'foundation'
  | 'investigation'
  | 'containment'
  | 'recovery'
  | 'data'
  | 'governance'
  | 'risk'
  | 'tuning'
  | 'generic';

export interface CardArchetypeInfo {
  key: CardArchetype;
  label: LocalizedText;
  /** Short glyph shown in the UI. */
  emoji: string;
  /** Tailwind-ish tone token the web layer maps to classes. */
  tone: string;
}

export const CARD_ARCHETYPES: Record<CardArchetype, CardArchetypeInfo> = {
  service: { key: 'service', label: { es: 'Servicio', en: 'Service' }, emoji: '🛡', tone: 'cyan' },
  foundation: { key: 'foundation', label: { es: 'Fundacional', en: 'Foundation' }, emoji: '🏗', tone: 'sky' },
  investigation: { key: 'investigation', label: { es: 'Investigación', en: 'Investigation' }, emoji: '🔍', tone: 'violet' },
  containment: { key: 'containment', label: { es: 'Contención', en: 'Containment' }, emoji: '🚧', tone: 'rose' },
  recovery: { key: 'recovery', label: { es: 'Recuperación', en: 'Recovery' }, emoji: '♻', tone: 'emerald' },
  data: { key: 'data', label: { es: 'Datos / Cifrado', en: 'Data / Encryption' }, emoji: '🔐', tone: 'teal' },
  governance: { key: 'governance', label: { es: 'Gobernanza / Comunicación', en: 'Governance / Comms' }, emoji: '⚖', tone: 'amber' },
  risk: { key: 'risk', label: { es: 'Riesgo / Ofensiva', en: 'Risk / Offensive' }, emoji: '⚠', tone: 'orange' },
  tuning: { key: 'tuning', label: { es: 'Ajuste', en: 'Tuning' }, emoji: '🎛', tone: 'indigo' },
  generic: { key: 'generic', label: { es: 'General', en: 'Generic' }, emoji: '•', tone: 'slate' },
};

export interface ArchetypeInput {
  id?: string;
  cardKey?: string;
  controls?: string[];
  tags?: string[];
  kind?: string;
  serviceCard?: boolean;
  scoreDelta?: number;
  grantsFlags?: string[];
}

/** Derive a single archetype for a card. Precedence matters; keep it explicit. */
export function classifyArchetype(card: ArchetypeInput): CardArchetype {
  const id = card.id ?? card.cardKey ?? '';
  const tags = new Set(card.tags ?? []);
  if (card.serviceCard) return 'service';
  // Deliberately bad / offensive options are flagged first so they never hide
  // behind another archetype.
  if (typeof card.scoreDelta === 'number' && card.scoreDelta < 0) return 'risk';
  const grantsFunded = (card.grantsFlags ?? []).some((f) => f.endsWith('_funded'));
  if (grantsFunded || id.endsWith('-enable')) return 'foundation';
  if (card.kind === 'investigate' || tags.has('forensics')) return 'investigation';
  if (tags.has('containment') || /(isolate|revoke|contain)/.test(id)) return 'containment';
  if (tags.has('recovery') || tags.has('backup')) return 'recovery';
  if (tags.has('encryption') || tags.has('data') || tags.has('keys') || tags.has('secrets')) return 'data';
  if (tags.has('comms') || tags.has('governance')) return 'governance';
  if (tags.has('tuning')) return 'tuning';
  return 'generic';
}

/* -------------------------------------------------------------------------- */
/* Duplicate detection                                                        */
/* -------------------------------------------------------------------------- */

export interface DuplicateInput extends ArchetypeInput {
  label?: LocalizedText;
  cost?: number;
}

export type DuplicateReason = 'service-pair' | 'same-context' | 'similar-name';

export interface DuplicateGroup {
  ids: string[];
  reason: DuplicateReason;
  /** 0..1 heuristic strength of the strongest link in the group. */
  score: number;
}

function setOf(xs: string[] | undefined): Set<string> {
  return new Set((xs ?? []).map((x) => x.toLowerCase()));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n += 1;
  return n;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'without', 'this', 'that', 'your', 'from', 'into',
  'las', 'los', 'del', 'con', 'por', 'para', 'una', 'que', 'sus', 'sobre',
]);

function nameTokens(text: string | undefined): Set<string> {
  return new Set(
    (text ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñ]+/g, ' ')
      .split(' ')
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  );
}

/** `svc-waf` ↔ `waf-enable` style pairs: the same service "use it" vs "deploy it". */
function isServicePair(a: string, b: string): boolean {
  const one = (x: string) => x.startsWith('svc-');
  if (one(a) === one(b)) return false;
  const svcSide = one(a) ? a : b;
  const other = one(a) ? b : a;
  const base = svcSide.slice('svc-'.length);
  return other === `${base}-enable`;
}

interface Edge {
  a: string;
  b: string;
  reason: DuplicateReason;
  score: number;
}

/**
 * Coarse domain used to keep duplicate clusters from bleeding across unrelated
 * families (e.g. a "credential" card must not bridge CBH and DEW). Derived from
 * tags only, with a fixed priority, so service and generic cards land together.
 */
function domainKey(card: DuplicateInput): string {
  const tags = setOf(card.tags);
  const has = (...xs: string[]) => xs.some((x) => tags.has(x));
  if (has('web', 'waf', 'web_tampering')) return 'web';
  if (has('network', 'egress', 'ddos', 'lateral')) return 'network';
  if (has('host')) return 'host';
  if (has('identity', 'privileged', 'audit')) return 'identity';
  if (has('data', 'encryption', 'keys', 'secrets', 'credential')) return 'data';
  if (has('correlation', 'ops')) return 'ops';
  if (has('recovery', 'backup')) return 'recovery';
  if (has('comms', 'governance')) return 'comms';
  if (has('training')) return 'training';
  return 'other';
}

function clusterEdges(edges: Edge[]): DuplicateGroup[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const e of edges) {
    if (!parent.has(e.a)) parent.set(e.a, e.a);
    if (!parent.has(e.b)) parent.set(e.b, e.b);
    union(e.a, e.b);
  }

  const groups = new Map<string, { ids: Set<string>; edges: Edge[] }>();
  for (const e of edges) {
    const root = find(e.a);
    const g = groups.get(root) ?? { ids: new Set<string>(), edges: [] };
    g.ids.add(e.a);
    g.ids.add(e.b);
    g.edges.push(e);
    groups.set(root, g);
  }

  const out: DuplicateGroup[] = [];
  for (const g of groups.values()) {
    if (g.ids.size < 2) continue;
    const order: DuplicateReason[] = ['service-pair', 'same-context', 'similar-name'];
    const best = g.edges.reduce((acc, e) => {
      if (order.indexOf(e.reason) < order.indexOf(acc.reason)) return e;
      if (order.indexOf(e.reason) === order.indexOf(acc.reason) && e.score > acc.score) return e;
      return acc;
    }, g.edges[0]!);
    out.push({
      ids: [...g.ids].sort(),
      reason: best.reason,
      score: Math.round(Math.max(...g.edges.map((e) => e.score)) * 100) / 100,
    });
  }
  return out;
}

/**
 * Heuristic grouping of cards that are the same or suspiciously similar in
 * context (NOT an automatic delete list — a review aid). Detection runs inside
 * each domain bucket so a full family of near-duplicates surfaces as one small
 * cluster without merging unrelated services.
 */
export function findCardDuplicates(cards: DuplicateInput[]): DuplicateGroup[] {
  const buckets = new Map<string, DuplicateInput[]>();
  for (const c of cards) {
    const key = domainKey(c);
    const arr = buckets.get(key) ?? [];
    arr.push(c);
    buckets.set(key, arr);
  }

  const out: DuplicateGroup[] = [];
  for (const bucket of buckets.values()) {
    const edges: Edge[] = [];
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const A = bucket[i]!;
        const B = bucket[j]!;
        const idA = A.id ?? A.cardKey ?? '';
        const idB = B.id ?? B.cardKey ?? '';
        if (!idA || !idB) continue;

        const controlsA = setOf(A.controls);
        const controlsB = setOf(B.controls);
        const tagsA = setOf(A.tags);
        const tagsB = setOf(B.tags);
        const tagJac = jaccard(tagsA, tagsB);
        const sharedTags = intersectionSize(tagsA, tagsB);
        const sharedControls = intersectionSize(controlsA, controlsB);
        const sameKind = (A.kind ?? 'action') === (B.kind ?? 'action');
        const archA = classifyArchetype(A);
        const archB = classifyArchetype(B);
        // Foundation ("deploy/enable") cards only pair via the explicit
        // service-pair rule; they should not merge into a family cluster.
        const sameArch = archA === archB && archA !== 'foundation';
        const nameJac = jaccard(nameTokens(A.label?.en), nameTokens(B.label?.en));

        let reason: DuplicateReason | null = null;
        let score = 0;
        if (isServicePair(idA, idB)) {
          reason = 'service-pair';
          score = 1;
        } else if (sameArch && sameKind && sharedTags >= 2 && tagJac >= 0.4) {
          reason = 'same-context';
          score = tagJac;
        } else if (sameArch && sameKind && sharedControls >= 1 && tagJac >= 0.4) {
          reason = 'same-context';
          score = tagJac;
        } else if (sameArch && sameKind && nameJac >= 0.72) {
          reason = 'similar-name';
          score = nameJac;
        }
        if (reason) edges.push({ a: idA, b: idB, reason, score });
      }
    }
    out.push(...clusterEdges(edges));
  }

  // Stable ordering: biggest clusters first, then by first id.
  out.sort((x, y) => y.ids.length - x.ids.length || x.ids[0]!.localeCompare(y.ids[0]!));
  return out;
}
