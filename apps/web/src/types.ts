import type { LocalizedText, Metrics, ControlId, ArchitectureNode } from '@hcc/shared';

/** A card in the global library (admin-managed), as returned by /cards. */
export interface GameCardRow {
  cardKey: string;
  label: LocalizedText;
  description: LocalizedText;
  cost: number;
  controls: ControlId[];
  tags: string[];
  kind: string;
  immediate?: Record<string, number> | null;
  delayed?: Record<string, number> | null;
  scoreDelta: number;
  clarityDelta: number;
  revealsSignals: string[];
  premiumOnFocus: boolean;
  serviceCard: boolean;
  baseWeight: number;
  isActive: boolean;
  requiresCards: string[];
  unlocksCards: string[];
  updatedAt?: string;
}

export interface ScenarioSummary {  key: string;
  name: LocalizedText;
  summary: LocalizedText;
  version: number;
  eventCount: number;
  organization: string;
  maturity: string;
  budget: number;
  valid: boolean;
  source?: 'builtin' | 'custom';
  isActive?: boolean;
}

/** Full-ish scenario detail used when creating a session (for card overrides). */
export interface ScenarioDetail {
  key: string;
  name: LocalizedText;
  cards?: {
    id: string;
    label: LocalizedText;
    cost: number;
    scoreDelta?: number;
    controls: ControlId[];
    kind?: string;
    serviceCard?: boolean;
  }[];
  deck?: { fixed: string[]; pool: string[]; drawCount: number; serviceFixed?: boolean };
}

/** A per-card cost/score override chosen when creating a session. */
export type CardOverride = { cost?: number; scoreDelta?: number };

export interface ScenarioPreviewStep {
  eventId: string;
  round: number;
  title: LocalizedText;
  optionId: string;
  optionLabel: LocalizedText;
  cost: number;
  appliedDeltas: Record<string, number>;
  metrics: Metrics;
  budget: number;
  score: number;
  nextEventId: string | null;
}

export interface ScenarioPreviewResult {
  key: string;
  source: 'builtin' | 'custom';
  problems: string[];
  steps: ScenarioPreviewStep[];
  finalScore: number;
  finalState: { metrics: Metrics; budget: number; status: string; flags: string[] };
}

export interface SessionListItem {
  id: string;
  name: string;
  joinCode: string;
  status: string;
  currentRound: number;
  teamCount: number;
  scenarioKey: string;
  scenarioName: string;
  seed: number;
  createdAt: string;
}

export interface LeaderboardRowData {
  teamId: string;
  name: string;
  color: string;
  score: number;
  budget: number;
  metrics: Metrics;
  status: string;
  fundedControls: string[];
}

export interface ConsoleTeam {
  id: string;
  name: string;
  color: string;
  joinCode: string;
  budgetStart: number;
  maturity: string;
  members: { id: string; displayName: string; role: string }[];
  state:
    | {
        metrics: Metrics;
        budget: number;
        version: number;
        status: string;
        flags: string[];
        currentEventId: string | null;
        completedEventIds: string[];
      }
    | null;
  score: number;
  currentEvent: { id: string; round: number; title: LocalizedText; phase: LocalizedText; instructorNotes?: LocalizedText } | null;
  pendingDecision: { optionId: string; rationale: string; cost: number; createdAt: string } | null;
  decisionCount: number;
  recentHistory: { type: string; payload: unknown; createdAt: string }[];
}

export interface SessionConsoleData {
  id: string;
  name: string;
  joinCode: string;
  audienceToken: string;
  status: string;
  currentRound: number;
  deadlineAt: string | null;
  deadlineSeconds: number;
  startedAt: string | null;
  endedAt: string | null;
  seed: number;
  weights: Record<string, number>;
  scenario: {
    key: string;
    name: LocalizedText;
    summary: LocalizedText;
    organization: {
      name: string;
      industry: LocalizedText;
      size: LocalizedText;
      description: LocalizedText;
      objectives: LocalizedText[];
      criticalAssets: { name: LocalizedText; criticality: string; description: LocalizedText }[];
    };
    architecture: ArchitectureNode[];
    debrief: { learningObjectives: LocalizedText[]; correctReasoning: LocalizedText[] };
    events: { id: string; round: number; title: LocalizedText; phase: LocalizedText; insightKey?: string }[];
  };
  teams: ConsoleTeam[];
  leaderboard: LeaderboardRowData[];
  insights: string[];
  audit: { action: string; payload: unknown; createdAt: string }[];
}

export interface OptionData {
  id: string;
  label: LocalizedText;
  description: LocalizedText;
  cost: number;
  effort?: number;
  controls: ControlId[];
  immediate?: Record<string, number>;
  delayed?: Record<string, number>;
  scoreDelta?: number;
  riskLevel?: string;
  risks?: LocalizedText[];
  tags?: string[];
  kind?: 'action' | 'investigate';
  premium?: boolean;
  premiumOnFocus?: boolean;
  serviceCard?: boolean;
  revealsSignals?: string[];
  clarityDelta?: number;
  available: boolean;
  reason?: string;
}

/** An ambiguous signal as exposed to teams (truth only when revealed). */
export interface SignalData {
  id: string;
  text: LocalizedText;
  revealed: boolean;
  truth?: 'true' | 'false' | 'partial';
}

export interface ProposalData {
  id: string;
  type: string;
  payload: { optionId?: string; rationale?: string; by?: string; proposalId?: string };
  createdAt: string;
}

export interface TeamWorkspaceData {
  team: { id: string; name: string; color: string; joinCode: string; maturity: string };
  session: {
    id: string;
    name: string;
    status: string;
    currentRound: number;
    deadlineAt: string | null;
    budgetStart?: number;
    incomePerRound?: number;
    effortPerRound?: number | null;
  };
  scenario: {
    name: LocalizedText;
    summary: LocalizedText;
    organization: SessionConsoleData['scenario']['organization'];
    architecture: ArchitectureNode[];
  };
  state: {
    metrics: Metrics;
    budget: number;
    effortRemaining?: number | null;
    version: number;
    status: string;
    flags: string[];
    fundedControls: string[];
  };
  currentEvent: {
    id: string;
    round: number;
    phase: LocalizedText;
    title: LocalizedText;
    narrative: LocalizedText;
    intel: LocalizedText[];
    businessImpact?: LocalizedText;
    controlsInPlay: ControlId[];
    options: OptionData[];
    signals?: SignalData[];
    hypotheses?: LocalizedText[];
    clarity?: number;
  } | null;
  submittedDecision: { optionId: string; optionIds?: string[]; rationale: string; cost: number; createdAt: string } | null;
  proposals: ProposalData[];
  timeline: { id: string; round: number; title: LocalizedText; phase: LocalizedText; narrative: LocalizedText }[];
  leaderboard: LeaderboardRowData[];
  members: { id: string; displayName: string; role: string }[];
}

/** Self-service team report (own data only). */
export interface TeamReportItem {
  kind: string;
  label: LocalizedText;
  detail?: LocalizedText;
}

export interface TeamReportData {
  generatedAt: string;
  team: { id: string; name: string; color: string; maturity: string; score: number; status: string };
  scenario: { key: string; name: LocalizedText; summary: LocalizedText };
  metrics: { key: string; label: LocalizedText; value: number; baseline: number; weight: number; delta: number }[];
  budget: { start: number; spent: number; remaining: number };
  clarity: number;
  fundedControls: string[];
  decisions: {
    round: number;
    eventId: string;
    eventTitle?: LocalizedText;
    optionIds: string[];
    optionLabels: (LocalizedText | undefined)[];
    controls: ControlId[];
    cost: number;
    scoreDelta: number;
    noResponse: boolean;
    rationale: string;
  }[];
  strengths: TeamReportItem[];
  weaknesses: TeamReportItem[];
  architecture: {
    gaps: { control: string; zone: string; docs: { label: string; url: string }[]; domain?: LocalizedText; businessProblem?: LocalizedText }[];
    covered: { control: string; docs: { label: string; url: string }[]; domain?: LocalizedText }[];
    services: { service: string; funded: boolean; domain?: LocalizedText; docs: { label: string; url: string }[] }[];
  };
  lessons: LocalizedText[];
  correctReasoning: LocalizedText[];
  disclaimer: LocalizedText;
}
