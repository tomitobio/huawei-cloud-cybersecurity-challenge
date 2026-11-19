/**
 * Core domain types for the Huawei Cloud Cybersecurity Challenge simulation.
 *
 * The simulation engine is intentionally pure and deterministic: it depends only
 * on the scenario definition and the current game state. All narrative content is
 * represented as fictional, localized text — no real telemetry or attacks.
 */

export type Lang = 'es' | 'en';

/** Text available in every supported language. */
export interface LocalizedText {
  es: string;
  en: string;
}

export const METRIC_KEYS = [
  'continuity',
  'riskReduction',
  'customerTrust',
  'financial',
  'governance',
  'responseQuality',
  'efficiency',
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];
export type Metrics = Record<MetricKey, number>;

/** Huawei Cloud security services represented in the simulation. */
export const CONTROL_IDS = ['HSS', 'CFW', 'WAF', 'DEW', 'CBH', 'SecMaster'] as const;
export type ControlId = (typeof CONTROL_IDS)[number];

export type MaturityLevel = 'low' | 'medium' | 'high';
export type RiskLevel = 'low' | 'medium' | 'high';

/** A partial set of metric deltas. Positive = improvement. */
export type MetricDeltas = Partial<Record<MetricKey, number>>;

/**
 * A condition evaluated against the current game state. All provided fields
 * must hold (logical AND).
 */
export interface Condition {
  hasFlag?: string;
  notFlag?: string;
  /** Metric must be >= each listed value. */
  metricGte?: Partial<Record<MetricKey, number>>;
  /** Metric must be <= each listed value. */
  metricLte?: Partial<Record<MetricKey, number>>;
  /** Minimum number of distinct controls already funded. */
  minCoverage?: number;
  /** Required controls (funded flags) — all must be present. */
  requireControls?: ControlId[];
}

export interface Transition {
  when: Condition;
  /** Event id to jump to when the condition holds. */
  goto: string;
  note?: LocalizedText;
}

export interface DecisionOption {
  id: string;
  label: LocalizedText;
  description: LocalizedText;
  /** Budget cost in workshop credits. */
  cost: number;
  /**
   * Work-effort units this card consumes in the round (KIPS-style second
   * resource). When omitted it is derived from the card's nature (service cards
   * and multi-control measures cost more effort than quick actions). Only
   * enforced when the scenario sets `economy.effortPerRound`.
   */
  effort?: number;
  controls: ControlId[];
  /** Requirements that must be met for the option to be selectable. */
  requires?: Condition;
  grantsFlags?: string[];
  removesFlags?: string[];
  immediate?: MetricDeltas;
  /** Applied when the *next* decision is resolved (or at scenario end). */
  delayed?: MetricDeltas;
  /** Explicit scoring contribution (bonus > 0, penalty < 0). */
  scoreDelta?: number;
  riskLevel?: RiskLevel;
  risks?: LocalizedText[];
  /** Tags describing what this option mitigates (informational). */
  mitigates?: string[];
  isRecovery?: boolean;
  /**
   * Optional reproducibility knob in [0, 1]. When > 0 the engine jitters this
   * option's `immediate`/`delayed` magnitudes by +/- variance, driven by the
   * session seed. Defaults to 0 (fully deterministic — current behaviour).
   */
  variance?: number;

  // --- Card-deck fields (new gameplay) ---------------------------------------
  /**
   * Domain tags used by the deck randomizer and by focus weighting, e.g.
   * ['web', 'web_tampering']. A card whose tags intersect an event's
   * `focusTags` is drawn more often (and, if `premiumOnFocus`, costs/scores more).
   */
  tags?: string[];
  /** Base weight in the weighted card draw (default 1). */
  baseWeight?: number;
  /**
   * When true and the card's tags hit the current event's focus, the engine
   * scales its cost and score by `economy.focus`. Models an "in-demand" service:
   * more valuable in context but more expensive.
   */
  premiumOnFocus?: boolean;
  /** 'investigate' cards reveal ambiguous signals and add clarity. */
  kind?: 'action' | 'investigate';
  /** Signal ids revealed when an investigate card is chosen. */
  revealsSignals?: string[];
  /** Uncertainty reduction in [0, 1] contributed by an investigate card. */
  clarityDelta?: number;
  /** Set by the engine at runtime when focus premium pricing is applied. */
  premium?: boolean;
  /**
   * Marks a "Huawei service" fixed card (HSS/CFW/WAF/DEW/CBH/SecMaster). Service
   * cards are always present in the round's hand when `deck.serviceFixed` is on,
   * and their cost scales with the event's `incidentSeverity`.
   */
  serviceCard?: boolean;

  // --- Card relations --------------------------------------------------------
  /**
   * Card ids that must have been purchased already for this card to be
   * selectable (a hard prerequisite). Enables "buy one to be allowed to buy
   * another".
   */
  requiresCards?: string[];
  /**
   * Card ids unlocked (added to future hands) once this card is purchased.
   * Enables "purchasing this card lets you purchase those".
   */
  unlocksCards?: string[];
}

/** An ambiguous signal shown to teams; `truth` is only revealed after investigation. */
export interface AmbiguousSignal {
  id: string;
  text: LocalizedText;
  truth: 'true' | 'false' | 'partial';
}

/** Per-event override of the scenario deck / economy. */
export interface HandConfig {
  fixed?: string[];
  pool?: string[];
  drawCount?: number;
  income?: number;
}

/** Scenario-level deck configuration. */
export interface DeckConfig {
  /** Card ids always available in the hand (same for every team). */
  fixed: string[];
  /** Card ids eligible for the weighted random draw. */
  pool: string[];
  /** How many pool cards to draw per round. */
  drawCount: number;
  /**
   * When true, the round's hand also injects the Huawei service fixed cards that
   * match the event's `controlsInPlay` (always present, cost scaled by severity).
   */
  serviceFixed?: boolean;
  /** Per-scenario draw-weight overrides keyed by card id (falls back to baseWeight). */
  weights?: Record<string, number>;
}

/** Scenario economy: per-round income and focus-premium multipliers. */
export interface EconomyConfig {
  /** Credits granted at the start of every round (helps teams not go broke). */
  incomePerRound: number;
  /**
   * Work-effort units available per round (KIPS-style). When set, the combined
   * effort of a round's selected cards may not exceed it. Unlike money it is a
   * per-round cap (it does not accumulate), modelling "you cannot do everything
   * at once". Omitted => effort constraint is disabled (legacy behaviour).
   */
  effortPerRound?: number;
  /** Multipliers applied to premium cards whose tags hit the event focus. */
  focus?: { costMultiplier: number; scoreMultiplier: number };
  /** Minimum number of pool cards per event focus tag (validation hint). */
  minPerFocusTag?: number;
}

export interface ScenarioEvent {
  id: string;
  round: number;
  phase: LocalizedText;
  title: LocalizedText;
  narrative: LocalizedText;
  intel?: LocalizedText[];
  businessImpact?: LocalizedText;
  controlsInPlay?: ControlId[];
  /** Inline options (legacy model). Deck-based scenarios leave this empty. */
  options?: DecisionOption[];
  /** Focus tags that weight the card draw for this event. */
  focusTags?: string[];
  /**
   * Incident severity multiplier (>=1) applied to the cost of Huawei service
   * fixed cards. When omitted, it is derived from the round (later rounds are
   * treated as more severe). Higher = service cards cost more this round.
   */
  incidentSeverity?: number;
  /** Per-event override of the deck hand / income. */
  hand?: HandConfig;
  /** Ambiguous signals (some are red herrings). `truth` is engine-only. */
  signals?: AmbiguousSignal[];
  /** Competing explanations shown to teams. */
  hypotheses?: LocalizedText[];
  transitions?: Transition[];
  /** Default next event id. If absent, the next event in definition order is used. */
  next?: string;
  /** Product insight key revealed by the instructor after this event resolves. */
  insightKey?: string;
  /** Never shown to teams. */
  instructorNotes?: LocalizedText;
}

export interface CriticalAsset {
  name: LocalizedText;
  criticality: RiskLevel;
  description: LocalizedText;
}

export interface ArchitectureNode {
  id: string;
  label: LocalizedText;
  zone: 'internet' | 'perimeter' | 'internal' | 'data' | 'admin' | 'security';
  control?: ControlId;
}

export type ScoreWeights = Record<MetricKey, number>;

export interface Scenario {
  key: string;
  name: LocalizedText;
  version: number;
  summary: LocalizedText;
  organization: {
    name: string;
    industry: LocalizedText;
    size: LocalizedText;
    description: LocalizedText;
    objectives: LocalizedText[];
    criticalAssets: CriticalAsset[];
  };
  architecture: ArchitectureNode[];
  start: {
    budget: number;
    maturity: MaturityLevel;
    baseMetrics?: MetricDeltas;
  };
  weights: ScoreWeights;
  /** Global card deck (fixed + pool). Used by deck-based scenarios. */
  cards?: DecisionOption[];
  /** Deck configuration for weighted per-round card draws. */
  deck?: DeckConfig;
  /** Per-round economy (income, focus premiums). */
  economy?: EconomyConfig;
  events: ScenarioEvent[];
  debrief: {
    learningObjectives: LocalizedText[];
    correctReasoning: LocalizedText[];
  };
}

/** A recorded decision for a single event. */
export interface RecordedDecision {
  eventId: string;
  /** Primary/first chosen option (kept for backward compatibility). */
  optionId: string;
  /** All options chosen this round (multi-select). Defaults to [optionId]. */
  optionIds?: string[];
  round: number;
  cost: number;
  /** Work-effort units consumed by this decision (when the scenario uses effort). */
  effort?: number;
}

/** Serializable game state for one team within one session. */
export interface GameStateData {
  teamId: string;
  currentEventId: string | null;
  completedEventIds: string[];
  flags: string[];
  metrics: Metrics;
  budget: number;
  /**
   * Work-effort units still available this round (KIPS-style). Resets to
   * `economy.effortPerRound` at the start of each round and decremented when a
   * decision is applied. Undefined when the scenario has no effort resource.
   */
  effortRemaining?: number;
  /** Accumulated explicit score contributions from decisions. */
  score: number;
  status: 'active' | 'ended';
  version: number;
  pendingDelayed: MetricDeltas;
  decisions: RecordedDecision[];
  /** Session seed driving reproducible variability. Missing => 0 (legacy). */
  seed?: number;
  /** Number of decisions resolved so far — advances the RNG stream. */
  rngCounter?: number;

  // --- Card-deck runtime state (new gameplay) --------------------------------
  /** Card ids currently available to the team this round. */
  hand?: string[];
  /** Pool cards already drawn (consumed) for this team. */
  usedCards?: string[];
  /** Pool cards still eligible to be drawn. */
  remainingPool?: string[];
  /** Event id the current hand was drawn for (idempotency guard). */
  handEventId?: string;
  /** Investigated signals and accumulated clarity in [0, 1]. */
  knowledge?: { revealedSignals: string[]; clarity: number };
  /** Card ids this team has already purchased (across all rounds). */
  purchasedCards?: string[];
}

export type SessionStatus = 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED';

export type UserRole = 'ADMIN' | 'MEMBER' | 'AUDIENCE';
