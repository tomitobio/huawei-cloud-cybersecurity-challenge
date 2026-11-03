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
  options: DecisionOption[];
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
  events: ScenarioEvent[];
  debrief: {
    learningObjectives: LocalizedText[];
    correctReasoning: LocalizedText[];
  };
}

/** A recorded decision for a single event. */
export interface RecordedDecision {
  eventId: string;
  optionId: string;
  round: number;
  cost: number;
}

/** Serializable game state for one team within one session. */
export interface GameStateData {
  teamId: string;
  currentEventId: string | null;
  completedEventIds: string[];
  flags: string[];
  metrics: Metrics;
  budget: number;
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
}

export type SessionStatus = 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED';

export type UserRole = 'ADMIN' | 'INSTRUCTOR' | 'CAPTAIN' | 'PARTICIPANT' | 'AUDIENCE';
