import type { LocalizedText, Metrics, ControlId, ArchitectureNode } from '@hcc/shared';

export interface ScenarioSummary {
  key: string;
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
  controls: ControlId[];
  immediate?: Record<string, number>;
  delayed?: Record<string, number>;
  scoreDelta?: number;
  riskLevel?: string;
  risks?: LocalizedText[];
  available: boolean;
  reason?: string;
}

export interface ProposalData {
  id: string;
  type: string;
  payload: { optionId?: string; rationale?: string; by?: string; proposalId?: string };
  createdAt: string;
}

export interface TeamWorkspaceData {
  team: { id: string; name: string; color: string; joinCode: string; maturity: string };
  session: { id: string; name: string; status: string; currentRound: number; deadlineAt: string | null };
  scenario: {
    name: LocalizedText;
    summary: LocalizedText;
    organization: SessionConsoleData['scenario']['organization'];
    architecture: ArchitectureNode[];
  };
  state: {
    metrics: Metrics;
    budget: number;
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
  } | null;
  submittedDecision: { optionId: string; rationale: string; cost: number; createdAt: string } | null;
  proposals: ProposalData[];
  timeline: { id: string; round: number; title: LocalizedText; phase: LocalizedText; narrative: LocalizedText }[];
  leaderboard: LeaderboardRowData[];
  members: { id: string; displayName: string; role: string }[];
}
