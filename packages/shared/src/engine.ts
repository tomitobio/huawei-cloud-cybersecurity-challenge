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
  const state: GameStateData = {
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
    hand: [],
    usedCards: [],
    remainingPool: scenario.deck ? [...scenario.deck.pool] : [],
    knowledge: { revealedSignals: [], clarity: 0 },
  };
  return prepareActiveEvent(scenario, state);
}

// --- Card-deck machinery ------------------------------------------------------

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Lookup of all cards declared by a deck-based scenario. */
export function cardIndex(scenario: Scenario): Map<string, DecisionOption> {
  const map = new Map<string, DecisionOption>();
  for (const card of scenario.cards ?? []) map.set(card.id, card);
  return map;
}

/**
 * Incident severity for an event: explicit `incidentSeverity`, otherwise derived
 * from the round (later rounds are treated as more severe). Clamped to >= 1.
 */
export function incidentSeverityFor(event: ScenarioEvent): number {
  if (typeof event.incidentSeverity === 'number') return Math.max(1, event.incidentSeverity);
  return 1 + Math.min(0.5, Math.max(0, ((event.round ?? 1) - 1) * 0.1));
}

/**
 * Apply focus-premium pricing and service-severity pricing to a card for a given
 * event. Focus premium scales cost & score when a `premiumOnFocus` card's tags
 * hit the event focus. Service cards (`serviceCard`) additionally scale their
 * cost by the event's incident severity. Pure; returns a copy when scaled.
 */
export function effectiveCard(
  card: DecisionOption,
  event: ScenarioEvent,
  scenario: Scenario,
): DecisionOption {
  let out = card;
  if (card.premiumOnFocus) {
    const focus = new Set(event.focusTags ?? []);
    if ((card.tags ?? []).some((tag) => focus.has(tag))) {
      const mult = scenario.economy?.focus ?? { costMultiplier: 1, scoreMultiplier: 1 };
      out = {
        ...out,
        cost: Math.round(out.cost * mult.costMultiplier),
        scoreDelta: Math.round((out.scoreDelta ?? 0) * mult.scoreMultiplier * 100) / 100,
        premium: true,
      };
    }
  }
  if (card.serviceCard) {
    const severity = incidentSeverityFor(event);
    if (severity !== 1) out = { ...out, cost: Math.round(out.cost * severity) };
  }
  return out;
}

/**
 * The cards currently presented for an event. Deck scenarios resolve the stored
 * hand (with focus-premium pricing); legacy scenarios use `event.options`.
 */
export function getEventCards(
  scenario: Scenario,
  event: ScenarioEvent,
  state: GameStateData,
): DecisionOption[] {
  if (scenario.deck && scenario.cards?.length) {
    const map = cardIndex(scenario);
    const ids = state.hand ?? [];
    if (!ids.length) return (event.options ?? []).map((c) => effectiveCard(c, event, scenario));
    return ids
      .map((id) => map.get(id))
      .filter((c): c is DecisionOption => Boolean(c))
      .map((c) => effectiveCard(c, event, scenario));
  }
  return (event.options ?? []).map((c) => effectiveCard(c, event, scenario));
}

/**
 * Draw a weighted sample (without replacement) of pool cards for an event.
 * Deterministic per (team, seed, round). Focus tags and accumulated clarity
 * increase the weight of relevant cards.
 */
function drawPool(
  scenario: Scenario,
  event: ScenarioEvent,
  state: GameStateData,
  pool: string[],
  count: number,
): string[] {
  const map = cardIndex(scenario);
  const focus = new Set(event.focusTags ?? []);
  const clarity = state.knowledge?.clarity ?? 0;
  const candidates: { id: string; weight: number }[] = [];
  for (const id of pool) {
    const card = map.get(id);
    if (!card) continue;
    if (!conditionMet(card.requires, state)) continue;
    const matches = (card.tags ?? []).filter((tag) => focus.has(tag)).length;
    let weight = scenario.deck?.weights?.[id] ?? card.baseWeight ?? 1;
    weight *= 1 + matches * 1.5;
    if (matches > 0) weight *= 1 + clarity * 0.5;
    candidates.push({ id, weight: Math.max(0.0001, weight) });
  }

  const seedBase = ((state.seed ?? 0) ^ hashString(state.teamId)) >>> 0;
  const rng = mulberry32(mixSeed(seedBase, state.completedEventIds.length + 1));
  const chosen: string[] = [];
  const n = Math.min(count, candidates.length);
  for (let k = 0; k < n; k += 1) {
    const total = candidates.reduce((acc, c) => acc + c.weight, 0);
    let r = rng() * total;
    let pick = candidates.length - 1;
    for (let i = 0; i < candidates.length; i += 1) {
      r -= candidates[i]!.weight;
      if (r <= 0) {
        pick = i;
        break;
      }
    }
    chosen.push(candidates[pick]!.id);
    candidates.splice(pick, 1);
  }
  return chosen;
}

/**
 * Prepare the hand (fixed + drawn pool cards) and per-round income for the
 * event the team is currently on. Idempotent: repeated calls for the same event
 * do not redraw or re-apply income. Legacy scenarios (no deck) are untouched.
 */
export function prepareActiveEvent(scenario: Scenario, state: GameStateData): GameStateData {
  if (!scenario.deck) return state;
  const event = state.currentEventId ? getEvent(scenario, state.currentEventId) : null;
  if (!event) {
    state.hand = [];
    state.handEventId = undefined;
    return state;
  }
  if (state.handEventId === event.id) return state;

  const deck = scenario.deck;
  const handCfg = event.hand ?? {};
  const baseFixed = handCfg.fixed ?? deck.fixed;
  const fixed = [...baseFixed];
  // Inject the Huawei service fixed cards relevant to the incident in play.
  if (deck.serviceFixed && !handCfg.fixed) {
    const inPlay = new Set(event.controlsInPlay ?? []);
    for (const card of scenario.cards ?? []) {
      if (card.serviceCard && card.controls.some((c) => inPlay.has(c)) && !fixed.includes(card.id)) {
        fixed.push(card.id);
      }
    }
  }
  const pool = handCfg.pool ?? deck.pool;
  const drawCount = handCfg.drawCount ?? deck.drawCount;
  const remaining = state.remainingPool ?? [...deck.pool];

  const drawn = drawPool(scenario, event, state, remaining, drawCount);
  const drawnSet = new Set(drawn);
  state.remainingPool = remaining.filter((id) => !drawnSet.has(id));
  state.usedCards = [...(state.usedCards ?? []), ...drawn];
  state.hand = [...fixed, ...drawn];
  state.handEventId = event.id;

  const income = handCfg.income ?? scenario.economy?.incomePerRound ?? 0;
  if (income > 0) state.budget += income;
  return state;
}

/** Visible signals for a team: `truth` only exposed once investigated. */
export function getVisibleSignals(
  event: ScenarioEvent,
  state: GameStateData,
): { id: string; text: LocalizedText; revealed: boolean; truth?: 'true' | 'false' | 'partial' }[] {
  const revealed = new Set(state.knowledge?.revealedSignals ?? []);
  return (event.signals ?? []).map((s) => {
    const isRevealed = revealed.has(s.id);
    return {
      id: s.id,
      text: s.text,
      revealed: isRevealed,
      truth: isRevealed ? s.truth : undefined,
    };
  });
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
 * Works for both deck scenarios (from the drawn hand) and legacy inline options.
 */
export function availableOptions(
  scenario: Scenario,
  event: ScenarioEvent,
  state: GameStateData,
): DecisionOption[] {
  return getEventCards(scenario, event, state).filter(
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
 * Validate a multi-card selection for an event. Returns an EngineError code or
 * null when the selection is valid. Used by the API before persisting a decision.
 */
export function selectionProblem(
  scenario: Scenario,
  event: ScenarioEvent,
  state: GameStateData,
  optionIds: string[],
): string | null {
  const ids = [...new Set(optionIds)].filter(Boolean);
  if (ids.length === 0) return 'NO_OPTION';
  const cards = getEventCards(scenario, event, state);
  const chosen: DecisionOption[] = [];
  for (const id of ids) {
    const card = cards.find((o) => o.id === id);
    if (!card) return 'OPTION_NOT_FOUND';
    chosen.push(card);
  }
  for (const card of chosen) {
    if (!conditionMet(card.requires, state)) return 'REQUIREMENT_NOT_MET';
  }
  const total = chosen.reduce((acc, c) => acc + c.cost, 0);
  if (state.budget < total) return 'INSUFFICIENT_BUDGET';
  return null;
}

/**
 * Apply one or more decisions (multi-select) to a game state for the current
 * event. Pure & deterministic.
 *
 * Order of operations:
 *  1. Flush previously pending delayed effects into metrics (once).
 *  2. Validate every chosen option against the current event, requirements and
 *     the *combined* budget.
 *  3. For each option: subtract cost, apply immediate effects, flags, investigation.
 *  4. Queue each option's delayed effects for the next round (accumulated).
 *  5. Advance the event once via transitions/next/order, record the decision.
 */
export function applyDecisions(
  scenario: Scenario,
  inputState: GameStateData,
  optionIds: string[],
): DecisionResult {
  if (!inputState.currentEventId) {
    throw new EngineError('NO_ACTIVE_EVENT', 'No active event to decide on');
  }
  if (inputState.status !== 'active') {
    throw new EngineError('GAME_ENDED', 'The simulation has ended for this team');
  }
  const ids = [...new Set(optionIds)].filter(Boolean);
  if (ids.length === 0) throw new EngineError('NO_OPTION', 'At least one option is required');

  const state: GameStateData = {
    ...inputState,
    metrics: { ...inputState.metrics },
    flags: [...inputState.flags],
    completedEventIds: [...inputState.completedEventIds],
    decisions: [...inputState.decisions],
    pendingDelayed: { ...inputState.pendingDelayed },
    hand: [...(inputState.hand ?? [])],
    usedCards: [...(inputState.usedCards ?? [])],
    remainingPool: [...(inputState.remainingPool ?? [])],
    knowledge: {
      revealedSignals: [...(inputState.knowledge?.revealedSignals ?? [])],
      clarity: inputState.knowledge?.clarity ?? 0,
    },
  };

  const currentEventId = inputState.currentEventId;
  const event = getEvent(scenario, currentEventId);
  const cards = getEventCards(scenario, event, state);
  const chosen: DecisionOption[] = [];
  for (const id of ids) {
    const card = cards.find((o) => o.id === id);
    if (!card) throw new EngineError('OPTION_NOT_FOUND', `Option ${id} not found`);
    if (!conditionMet(card.requires, state)) {
      throw new EngineError('REQUIREMENT_NOT_MET', 'Option requirements are not satisfied');
    }
    chosen.push(card);
  }
  const totalCost = chosen.reduce((acc, c) => acc + c.cost, 0);
  if (state.budget < totalCost) {
    throw new EngineError('INSUFFICIENT_BUDGET', 'Not enough budget for this selection');
  }

  // Reproducible variability: jitter each option's magnitudes using a stream
  // derived from the session seed + decision counter.
  const rngCounter = inputState.rngCounter ?? 0;
  const rng = mulberry32(mixSeed(inputState.seed ?? 0, rngCounter));
  const jitter = (deltas: MetricDeltas | undefined, variance: number): MetricDeltas | undefined => {
    if (variance <= 0 || !deltas) return deltas;
    const out: MetricDeltas = {};
    for (const key of METRIC_KEYS) {
      const value = deltas[key];
      if (typeof value === 'number') {
        out[key] = Math.round(value * (1 + (rng() * 2 - 1) * variance));
      }
    }
    return out;
  };

  // 1. flush delayed effects from the previous round (once)
  state.metrics = applyDeltas(state.metrics, state.pendingDelayed);
  const applied: MetricDeltas = { ...state.pendingDelayed };
  state.pendingDelayed = {};
  state.budget -= totalCost;

  // 2-4. apply each chosen option
  for (const option of chosen) {
    const variance = normalizeVariance(option.variance);
    const immediate = jitter(option.immediate, variance);
    const delayed = jitter(option.delayed, variance);

    state.metrics = applyDeltas(state.metrics, immediate);
    for (const [k, v] of Object.entries(immediate ?? {})) {
      applied[k as keyof MetricDeltas] = (applied[k as keyof MetricDeltas] ?? 0) + (v as number);
    }
    state.score += option.scoreDelta ?? 0;

    for (const flag of option.grantsFlags ?? []) {
      if (!state.flags.includes(flag)) state.flags.push(flag);
    }
    for (const flag of option.removesFlags ?? []) {
      state.flags = state.flags.filter((f) => f !== flag);
    }

    if (option.kind === 'investigate') {
      for (const sig of option.revealsSignals ?? []) {
        if (!state.knowledge!.revealedSignals.includes(sig)) state.knowledge!.revealedSignals.push(sig);
      }
      const delta = option.clarityDelta ?? 0;
      state.knowledge!.clarity = Math.max(0, Math.min(1, state.knowledge!.clarity + delta));
    }

    if (delayed) {
      for (const [k, v] of Object.entries(delayed)) {
        const key = k as keyof MetricDeltas;
        state.pendingDelayed[key] = (state.pendingDelayed[key] ?? 0) + (v as number);
      }
    }
  }

  // record the decision (one entry per round, with all chosen option ids)
  state.completedEventIds.push(event.id);
  state.decisions.push({
    eventId: event.id,
    optionId: chosen[0]!.id,
    optionIds: chosen.map((c) => c.id),
    round: event.round,
    cost: totalCost,
  });

  // 5. advance the event once
  const nextEventId = resolveNextEventId(scenario, event, state);
  state.currentEventId = nextEventId;
  state.rngCounter = rngCounter + 1;
  state.version += 1;
  if (!nextEventId) {
    // final flush of delayed effects at scenario end
    state.metrics = applyDeltas(state.metrics, state.pendingDelayed);
    state.pendingDelayed = {};
    state.status = 'ended';
    state.hand = [];
    state.handEventId = undefined;
  } else {
    // draw the next round's hand and grant per-round income
    prepareActiveEvent(scenario, state);
  }

  return {
    state,
    appliedDeltas: applied,
    nextEventId,
    insightKey: event.insightKey,
    ended: !nextEventId,
  };
}

/** Single-option convenience wrapper around {@link applyDecisions}. */
export function applyDecision(
  scenario: Scenario,
  inputState: GameStateData,
  optionId: string,
): DecisionResult {
  return applyDecisions(scenario, inputState, [optionId]);
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
    const opts = availableOptions(scenario, event, state);
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

  const deckMode = Boolean(scenario.deck);
  const cardIds = new Set<string>();
  for (const card of scenario.cards ?? []) {
    if (cardIds.has(card.id)) problems.push(`Duplicate card id: ${card.id}`);
    cardIds.add(card.id);
  }

  if (deckMode) {
    const deck = scenario.deck!;
    if (!(scenario.cards ?? []).length) problems.push('Deck scenario has no cards');
    for (const id of [...deck.fixed, ...deck.pool]) {
      if (!cardIds.has(id)) problems.push(`Deck references unknown card ${id}`);
    }
    if (deck.pool.length < deck.drawCount) {
      problems.push(`Deck pool (${deck.pool.length}) is smaller than drawCount (${deck.drawCount})`);
    }
    const index = cardIndex(scenario);
    const minPerFocus = scenario.economy?.minPerFocusTag ?? 3;
    for (const event of scenario.events) {
      for (const tag of event.focusTags ?? []) {
        const count = deck.pool.filter((id) => (index.get(id)?.tags ?? []).includes(tag)).length;
        if (count < minPerFocus) {
          problems.push(
            `Event ${event.id} focus tag "${tag}" has only ${count} pool cards (min ${minPerFocus})`,
          );
        }
      }
    }
  }

  const ids = new Set<string>();
  for (const event of scenario.events) {
    if (ids.has(event.id)) problems.push(`Duplicate event id: ${event.id}`);
    ids.add(event.id);

    const eventOptions = event.options ?? [];
    if (!deckMode && !eventOptions.length) problems.push(`Event ${event.id} has no options`);
    const optIds = new Set<string>();
    for (const opt of eventOptions) {
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
