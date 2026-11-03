import {
  type Condition,
  type DecisionOption,
  type GameStateData,
  type LocalizedText,
  type MetricDeltas,
  type Metrics,
  type Scenario,
  type ScenarioEvent,
  METRIC_KEYS,
} from './types';
import { applyDeltas, MATURITY_BASELINE, computeFinalScore } from './scoring';
import { mixSeed, mulberry32, normalizeVariance } from './rng';

export class EngineError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'EngineError';
  }
}

/** Find an event by id. Throws when missing. */
export function getEvent(scenario: Scenario, eventId: string): ScenarioEvent {
  const event = scenario.events.find((e) => e.id === eventId);
  if (!event) throw new EngineError('EVENT_NOT_FOUND', `Event ${eventId} not found in scenario`);
  return event;
}

/** The first event of a scenario (lowest round, then definition order). */
export function firstEventId(scenario: Scenario): string | null {
  if (scenario.events.length === 0) return null;
  const sorted = [...scenario.events].sort((a, b) => a.round - b.round);
  return sorted[0]?.id ?? null;
}

/** Create a fresh game state for a team starting the scenario. */
export function initGameState(teamId: string, scenario: Scenario, seed = 0): GameStateData {
  const baseline = { ...MATURITY_BASELINE[scenario.start.maturity] };
  const metrics = applyDeltas(baseline, scenario.start.baseMetrics);
  return {
    teamId,
    currentEventId: firstEventId(scenario),
    completedEventIds: [],
    flags: [],
    metrics,
    budget: scenario.start.budget,
    score: 0,
    status: 'active',
    version: 0,
    pendingDelayed: {},
    decisions: [],
    seed,
    rngCounter: 0,
  };
}

/** Evaluate a condition against a state. Empty conditions always hold. */
export function conditionMet(
  condition: Condition | undefined,
  state: GameStateData,
): boolean {
  if (!condition) return true;
  if (condition.hasFlag && !state.flags.includes(condition.hasFlag)) return false;
  if (condition.notFlag && state.flags.includes(condition.notFlag)) return false;

  if (condition.metricGte) {
    for (const [key, value] of Object.entries(condition.metricGte)) {
      if (state.metrics[key as keyof typeof state.metrics] < (value as number)) return false;
    }
  }
  if (condition.metricLte) {
    for (const [key, value] of Object.entries(condition.metricLte)) {
      if (state.metrics[key as keyof typeof state.metrics] > (value as number)) return false;
    }
  }
  if (typeof condition.minCoverage === 'number') {
    const funded = new Set(state.flags.filter((f) => f.endsWith('_funded')));
    if (funded.size < condition.minCoverage) return false;
  }
  if (condition.requireControls) {
    for (const control of condition.requireControls) {
      if (!state.flags.includes(`${control}_funded`)) return false;
    }
  }
  return true;
}

/**
 * Options currently selectable for an event: requirements met and affordable.
 * Options that are not affordable but otherwise valid are still returned with a
 * flag so the UI can explain why they are disabled — but for selection we only
 * expose valid ones here.
 */
export function availableOptions(
  event: ScenarioEvent,
  state: GameStateData,
): DecisionOption[] {
  return event.options.filter(
    (opt) => conditionMet(opt.requires, state) && state.budget >= opt.cost,
  );
}

export interface DecisionResult {
  state: GameStateData;
  /** Immediate metric deltas actually applied (including flushed delayed). */
  appliedDeltas: MetricDeltas;
  nextEventId: string | null;
  insightKey?: string;
  ended: boolean;
}

/**
 * Apply a decision to a game state. Pure & deterministic.
 *
 * Order of operations:
 *  1. Flush previously pending delayed effects into metrics.
 *  2. Validate the option against the current event and requirements.
 *  3. Subtract cost, apply immediate effects, set/remove flags.
 *  4. Queue this option's delayed effects for the next round.
 *  5. Determine the next event via transitions, explicit `next`, or order.
 */
export function applyDecision(
  scenario: Scenario,
  inputState: GameStateData,
  optionId: string,
): DecisionResult {
  if (!inputState.currentEventId) {
    throw new EngineError('NO_ACTIVE_EVENT', 'No active event to decide on');
  }
  if (inputState.status !== 'active') {
    throw new EngineError('GAME_ENDED', 'The simulation has ended for this team');
  }

  const state: GameStateData = {
    ...inputState,
    metrics: { ...inputState.metrics },
    flags: [...inputState.flags],
    completedEventIds: [...inputState.completedEventIds],
    decisions: [...inputState.decisions],
    pendingDelayed: { ...inputState.pendingDelayed },
  };

  const currentEventId = inputState.currentEventId;
  const event = getEvent(scenario, currentEventId);
  const option = event.options.find((o) => o.id === optionId);
  if (!option) throw new EngineError('OPTION_NOT_FOUND', `Option ${optionId} not found`);
  if (!conditionMet(option.requires, state)) {
    throw new EngineError('REQUIREMENT_NOT_MET', 'Option requirements are not satisfied');
  }
  if (state.budget < option.cost) {
    throw new EngineError('INSUFFICIENT_BUDGET', 'Not enough budget for this option');
  }

  // Reproducible variability: when an option declares `variance`, jitter its
  // magnitudes using a stream derived from the session seed + decision counter.
  const variance = normalizeVariance(option.variance);
  const rngCounter = inputState.rngCounter ?? 0;
  const rng = variance > 0 ? mulberry32(mixSeed(inputState.seed ?? 0, rngCounter)) : null;
  const jitter = (deltas: MetricDeltas | undefined): MetricDeltas | undefined => {
    if (!rng || !deltas) return deltas;
    const out: MetricDeltas = {};
    for (const key of METRIC_KEYS) {
      const value = deltas[key];
      if (typeof value === 'number') {
        out[key] = Math.round(value * (1 + (rng() * 2 - 1) * variance));
      }
    }
    return out;
  };
  const immediate = jitter(option.immediate);
  const delayed = jitter(option.delayed);

  // 1. flush delayed effects from the previous round
  state.metrics = applyDeltas(state.metrics, state.pendingDelayed);
  const applied: MetricDeltas = { ...state.pendingDelayed };
  state.pendingDelayed = {};

  // 3. cost + immediate effects
  state.budget -= option.cost;
  state.metrics = applyDeltas(state.metrics, immediate);
  for (const [k, v] of Object.entries(immediate ?? {})) {
    applied[k as keyof MetricDeltas] = (applied[k as keyof MetricDeltas] ?? 0) + (v as number);
  }
  state.score += option.scoreDelta ?? 0;

  // flags
  for (const flag of option.grantsFlags ?? []) {
    if (!state.flags.includes(flag)) state.flags.push(flag);
  }
  for (const flag of option.removesFlags ?? []) {
    state.flags = state.flags.filter((f) => f !== flag);
  }

  // 4. queue delayed effects
  if (delayed) {
    for (const [k, v] of Object.entries(delayed)) {
      const key = k as keyof MetricDeltas;
      state.pendingDelayed[key] = (state.pendingDelayed[key] ?? 0) + (v as number);
    }
  }

  // record decision
  state.completedEventIds.push(event.id);
  state.decisions.push({
    eventId: event.id,
    optionId: option.id,
    round: event.round,
    cost: option.cost,
  });

  // 5. next event
  const nextEventId = resolveNextEventId(scenario, event, state);
  state.currentEventId = nextEventId;
  state.rngCounter = rngCounter + 1;
  state.version += 1;
  if (!nextEventId) {
    // final flush of delayed effects at scenario end
    state.metrics = applyDeltas(state.metrics, state.pendingDelayed);
    state.pendingDelayed = {};
    state.status = 'ended';
  }

  return {
    state,
    appliedDeltas: applied,
    nextEventId,
    insightKey: event.insightKey,
    ended: !nextEventId,
  };
}

/** Determine the next event id given the (already updated) state. */
export function resolveNextEventId(
  scenario: Scenario,
  event: ScenarioEvent,
  state: GameStateData,
): string | null {
  for (const transition of event.transitions ?? []) {
    if (conditionMet(transition.when, state)) return transition.goto;
  }
  if (event.next) return event.next;

  const sorted = [...scenario.events].sort((a, b) => a.round - b.round);
  const idx = sorted.findIndex((e) => e.id === event.id);
  const next = idx >= 0 ? sorted[idx + 1] : undefined;
  return next ? next.id : null;
}

/** Compute the final score for a state (metrics are already final). */
export function finalScoreFor(scenario: Scenario, state: GameStateData): number {
  return computeFinalScore(state.metrics, scenario.weights, state.score);
}

export interface SimulatedStep {
  eventId: string;
  round: number;
  title: LocalizedText;
  optionId: string;
  optionLabel: LocalizedText;
  cost: number;
  appliedDeltas: MetricDeltas;
  metrics: Metrics;
  budget: number;
  score: number;
  nextEventId: string | null;
}

export interface PlaythroughResult {
  steps: SimulatedStep[];
  finalState: GameStateData;
  finalScore: number;
}

/**
 * Deterministically play a scenario start to finish for previewing/validating it.
 *
 * For each step the option is chosen from `choices` (by index) when it is
 * available; otherwise the available option with the highest `scoreDelta` is
 * used (ties broken by definition order). Pure and side-effect free.
 */
export function simulatePlaythrough(
  scenario: Scenario,
  choices: string[] = [],
  seed = 0,
): PlaythroughResult {
  let state = initGameState('preview', scenario, seed);
  const steps: SimulatedStep[] = [];
  let guard = 0;

  while (state.currentEventId && guard < 200) {
    const event = getEvent(scenario, state.currentEventId);
    const opts = availableOptions(event, state);
    if (!opts.length) break;

    const requested = choices[steps.length];
    const requestedOption = requested ? opts.find((o) => o.id === requested) : undefined;
    const option =
      requestedOption ??
      [...opts].sort((a, b) => (b.scoreDelta ?? 0) - (a.scoreDelta ?? 0))[0]!;

    const result = applyDecision(scenario, state, option.id);

    steps.push({
      eventId: event.id,
      round: event.round,
      title: event.title,
      optionId: option.id,
      optionLabel: option.label,
      cost: option.cost,
      appliedDeltas: result.appliedDeltas,
      metrics: result.state.metrics,
      budget: result.state.budget,
      score: finalScoreFor(scenario, result.state),
      nextEventId: result.nextEventId,
    });

    state = result.state;
    guard += 1;
  }

  return { steps, finalState: state, finalScore: finalScoreFor(scenario, state) };
}

/** Validate a scenario definition. Returns an array of human-readable problems. */
export function validateScenario(scenario: Scenario): string[] {
  const problems: string[] = [];
  if (!scenario.events.length) problems.push('Scenario has no events');
  const ids = new Set<string>();
  for (const event of scenario.events) {
    if (ids.has(event.id)) problems.push(`Duplicate event id: ${event.id}`);
    ids.add(event.id);
    if (!event.options.length) problems.push(`Event ${event.id} has no options`);
    const optIds = new Set<string>();
    for (const opt of event.options) {
      if (optIds.has(opt.id)) problems.push(`Duplicate option id ${opt.id} in event ${event.id}`);
      optIds.add(opt.id);
    }
    for (const tr of event.transitions ?? []) {
      if (!ids.has(tr.goto) && !scenario.events.some((e) => e.id === tr.goto)) {
        problems.push(`Event ${event.id} transition points to unknown event ${tr.goto}`);
      }
    }
    if (event.next && !scenario.events.some((e) => e.id === event.next)) {
      problems.push(`Event ${event.id} next points to unknown event ${event.next}`);
    }
  }
  // reachability from first event
  const first = firstEventId(scenario);
  if (first) {
    const reachable = new Set<string>();
    const stack = [first];
    while (stack.length) {
      const id = stack.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      const ev = scenario.events.find((e) => e.id === id);
      if (!ev) continue;
      for (const tr of ev.transitions ?? []) stack.push(tr.goto);
      if (ev.next) stack.push(ev.next);
    }
    for (const e of scenario.events) {
      if (!reachable.has(e.id)) problems.push(`Event ${e.id} is unreachable from start`);
    }
  }
  return problems;
}
