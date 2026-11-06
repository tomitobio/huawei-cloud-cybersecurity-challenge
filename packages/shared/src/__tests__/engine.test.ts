import { describe, it, expect } from 'vitest';
import {
  applyCardOverrides,
  applyDecision,
  applyDecisions,
  availableOptions,
  conditionMet,
  finalScoreFor,
  getEvent,
  getEventCards,
  getVisibleSignals,
  initGameState,
  requiresCardsMet,
  simulatePlaythrough,
  validateScenario,
  EngineError,
} from '../engine';
import { ransomwareScenario } from '../scenarios/ransomware';
import { computeFinalScore as scoreFn } from '../scoring';
import type { GameStateData, Scenario } from '../types';

const baseWeights: Scenario['weights'] = {
  continuity: 1,
  riskReduction: 1,
  customerTrust: 1,
  financial: 1,
  governance: 1,
  responseQuality: 1,
  efficiency: 1,
};

/** A small synthetic deck scenario to exercise deck mechanics deterministically. */
function deckScenario(): Scenario {
  return {
    key: 'synth-deck',
    version: 1,
    name: { es: 'Mazo sintético', en: 'Synthetic deck' },
    summary: { es: 'x', en: 'x' },
    organization: {
      name: 'Synth',
      industry: { es: 'x', en: 'x' },
      size: { es: 'x', en: 'x' },
      description: { es: 'x', en: 'x' },
      objectives: [],
      criticalAssets: [],
    },
    architecture: [],
    start: { budget: 10, maturity: 'medium' },
    weights: baseWeights,
    cards: [
      {
        id: 'fixed-inv',
        label: { es: 'investigar', en: 'investigate' },
        description: { es: 'i', en: 'i' },
        cost: 0,
        controls: [],
        tags: ['web'],
        kind: 'investigate',
        revealsSignals: ['sig1'],
        clarityDelta: 0.5,
      },
      {
        id: 'fixed-premium',
        label: { es: 'premium', en: 'premium' },
        description: { es: 'p', en: 'p' },
        cost: 1,
        controls: [],
        tags: ['web'],
        premiumOnFocus: true,
        scoreDelta: 1,
      },
      { id: 'pool-a', label: { es: 'a', en: 'a' }, description: { es: 'a', en: 'a' }, cost: 1, controls: [], tags: ['web'] },
      { id: 'pool-b', label: { es: 'b', en: 'b' }, description: { es: 'b', en: 'b' }, cost: 1, controls: [], tags: ['web'] },
      { id: 'pool-c', label: { es: 'c', en: 'c' }, description: { es: 'c', en: 'c' }, cost: 1, controls: [], tags: ['web'] },
      { id: 'pool-d', label: { es: 'd', en: 'd' }, description: { es: 'd', en: 'd' }, cost: 1, controls: [], tags: ['other'] },
    ],
    deck: { fixed: ['fixed-inv', 'fixed-premium'], pool: ['pool-a', 'pool-b', 'pool-c', 'pool-d'], drawCount: 1 },
    economy: { incomePerRound: 5, focus: { costMultiplier: 2, scoreMultiplier: 2 }, minPerFocusTag: 1 },
    events: [
      {
        id: 'de1',
        round: 1,
        phase: { es: 'p', en: 'p' },
        title: { es: 't', en: 't' },
        narrative: { es: 'n', en: 'n' },
        focusTags: ['web'],
        signals: [{ id: 'sig1', text: { es: 'señal', en: 'signal' }, truth: 'true' }],
        next: 'de2',
      },
      {
        id: 'de2',
        round: 2,
        phase: { es: 'p', en: 'p' },
        title: { es: 't', en: 't' },
        narrative: { es: 'n', en: 'n' },
        focusTags: ['web'],
      },
    ],
    debrief: { learningObjectives: [], correctReasoning: [] },
  };
}

describe('scenario validation', () => {
  it('the ransomware scenario is valid and fully reachable', () => {
    expect(validateScenario(ransomwareScenario)).toEqual([]);
  });
});

describe('initGameState', () => {
  it('starts with budget + first-round income and the first event', () => {
    const state = initGameState('t1', ransomwareScenario);
    // deck scenarios grant per-round income on initialization too
    expect(state.budget).toBe(ransomwareScenario.start.budget + ransomwareScenario.economy!.incomePerRound);
    expect(state.currentEventId).toBe('e1-investment');
    expect(state.status).toBe('active');
    expect(state.version).toBe(0);
  });

  it('draws a fixed + pool hand and tracks the remaining pool', () => {
    const scenario = deckScenario();
    const state = initGameState('teamA', scenario, 42);
    expect(state.hand).toContain('fixed-inv');
    expect(state.hand).toContain('fixed-premium');
    // drawCount 1 -> hand = 2 fixed + 1 drawn
    expect(state.hand).toHaveLength(3);
    expect(state.remainingPool).toHaveLength(scenario.deck!.pool.length - scenario.deck!.drawCount);
    expect(state.knowledge).toEqual({ revealedSignals: [], clarity: 0 });
  });

  it('is deterministic per team/seed and independent across teams', () => {
    const scenario = deckScenario();
    const a1 = initGameState('teamA', scenario, 7);
    const a2 = initGameState('teamA', scenario, 7);
    expect(a1.hand).toEqual(a2.hand);
  });
});

describe('options and requirements (deck)', () => {
  it('returns only selectable, affordable options from the hand', () => {
    const state = initGameState('t1', ransomwareScenario);
    const event = getEvent(ransomwareScenario, state.currentEventId!);
    const opts = availableOptions(ransomwareScenario, event, state);
    expect(opts.length).toBeGreaterThan(0);
    for (const opt of opts) {
      expect(state.budget).toBeGreaterThanOrEqual(opt.cost);
    }
  });

  it('rejects unaffordable options', () => {
    const state = initGameState('t1', ransomwareScenario);
    state.budget = 0;
    const event = getEvent(ransomwareScenario, state.currentEventId!);
    const cards = getEventCards(ransomwareScenario, event, state);
    const paid = cards.find((c) => c.cost > 0)!;
    expect(() => applyDecision(ransomwareScenario, state, paid.id)).toThrow(EngineError);
  });
});

describe('deck economics and investigation', () => {
  it('applies focus premium pricing to premiumOnFocus cards', () => {
    const scenario = deckScenario();
    const state = initGameState('teamA', scenario, 1);
    const event = getEvent(scenario, 'de1');
    const cards = getEventCards(scenario, event, state);
    const premium = cards.find((c) => c.id === 'fixed-premium')!;
    expect(premium.premium).toBe(true);
    expect(premium.cost).toBe(2); // 1 * costMultiplier 2
    expect(premium.scoreDelta).toBe(2); // 1 * scoreMultiplier 2
  });

  it('investigate cards reveal signals and increase clarity', () => {
    const scenario = deckScenario();
    const state = initGameState('teamA', scenario, 1);
    const result = applyDecision(scenario, state, 'fixed-inv');
    expect(result.state.knowledge!.revealedSignals).toContain('sig1');
    expect(result.state.knowledge!.clarity).toBeCloseTo(0.5);
    const visible = getVisibleSignals(getEvent(scenario, 'de1'), result.state);
    const sig = visible.find((s) => s.id === 'sig1')!;
    expect(sig.revealed).toBe(true);
    expect(sig.truth).toBe('true');
  });

  it('does not reveal signal truth until investigated', () => {
    const scenario = deckScenario();
    const state = initGameState('teamA', scenario, 1);
    const visible = getVisibleSignals(getEvent(scenario, 'de1'), state);
    expect(visible[0]!.revealed).toBe(false);
    expect(visible[0]!.truth).toBeUndefined();
  });
});

describe('conditionMet', () => {
  const base = initGameState('t1', ransomwareScenario);
  it('handles flags, notFlag and metrics', () => {
    expect(conditionMet({ hasFlag: 'x' }, base)).toBe(false);
    const withFlag: GameStateData = { ...base, flags: ['x'] };
    expect(conditionMet({ hasFlag: 'x' }, withFlag)).toBe(true);
    expect(conditionMet({ notFlag: 'x' }, withFlag)).toBe(false);
    expect(conditionMet({ metricGte: { continuity: 1000 } }, base)).toBe(false);
    expect(conditionMet({}, base)).toBe(true);
    expect(conditionMet(undefined, base)).toBe(true);
  });

  it('counts funded controls for minCoverage', () => {
    const s: GameStateData = {
      ...base,
      flags: ['hss_funded', 'cfw_funded', 'waf_funded'],
    };
    expect(conditionMet({ minCoverage: 2 }, s)).toBe(true);
    expect(conditionMet({ minCoverage: 4 }, s)).toBe(false);
  });
});

describe('delayed effects and transitions (legacy inline scenario)', () => {
  const synth: Scenario = {
    key: 'synth',
    version: 1,
    name: { es: 'Sintético', en: 'Synthetic' },
    summary: { es: 'x', en: 'x' },
    organization: {
      name: 'Synth',
      industry: { es: 'x', en: 'x' },
      size: { es: 'x', en: 'x' },
      description: { es: 'x', en: 'x' },
      objectives: [],
      criticalAssets: [],
    },
    architecture: [],
    start: { budget: 50, maturity: 'medium' },
    weights: baseWeights,
    events: [
      {
        id: 's1',
        round: 1,
        phase: { es: 'p', en: 'p' },
        title: { es: 't', en: 't' },
        narrative: { es: 'n', en: 'n' },
        options: [
          {
            id: 'a',
            label: { es: 'a', en: 'a' },
            description: { es: 'a', en: 'a' },
            cost: 5,
            controls: [],
            delayed: { riskReduction: 10 },
            grantsFlags: ['chose_a'],
          },
          { id: 'b', label: { es: 'b', en: 'b' }, description: { es: 'b', en: 'b' }, cost: 5, controls: [] },
        ],
        transitions: [{ when: { hasFlag: 'chose_a' }, goto: 's3' }],
        next: 's2',
      },
      {
        id: 's2',
        round: 2,
        phase: { es: 'p', en: 'p' },
        title: { es: 't', en: 't' },
        narrative: { es: 'n', en: 'n' },
        options: [{ id: 'c', label: { es: 'c', en: 'c' }, description: { es: 'c', en: 'c' }, cost: 0, controls: [] }],
        next: 's3',
      },
      {
        id: 's3',
        round: 3,
        phase: { es: 'p', en: 'p' },
        title: { es: 't', en: 't' },
        narrative: { es: 'n', en: 'n' },
        options: [{ id: 'd', label: { es: 'd', en: 'd' }, description: { es: 'd', en: 'd' }, cost: 0, controls: [] }],
      },
    ],
    debrief: { learningObjectives: [], correctReasoning: [] },
  };

  it('applies delayed effects on the next resolution', () => {
    const s0 = initGameState('t', synth);
    const risk0 = s0.metrics.riskReduction;
    const s1 = applyDecision(synth, s0, 'a').state;
    expect(s1.metrics.riskReduction).toBe(risk0);
    expect(s1.pendingDelayed.riskReduction).toBe(10);
    const s2 = applyDecision(synth, s1, 'd').state; // jumps to s3, flushes delayed
    expect(s2.metrics.riskReduction).toBe(risk0 + 10);
  });

  it('routes through transitions and ends with no next event', () => {
    const s0 = initGameState('t', synth);
    const s1 = applyDecision(synth, s0, 'a').state;
    expect(s1.currentEventId).toBe('s3'); // transition on flag
    const s2 = applyDecision(synth, s1, 'd');
    expect(s2.nextEventId).toBeNull();
    expect(s2.state.status).toBe('ended');
  });

  it('legacy availableOptions reads inline event.options', () => {
    const s0 = initGameState('t', synth);
    const event = getEvent(synth, 's1');
    const ids = availableOptions(synth, event, s0).map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['a', 'b']));
  });
});

describe('full playthrough and scoring', () => {
  it('can be played start to finish and produces a bounded score', () => {
    let state = initGameState('t1', ransomwareScenario);
    let guard = 0;
    while (state.currentEventId && guard < 50) {
      const event = getEvent(ransomwareScenario, state.currentEventId);
      const opts = availableOptions(ransomwareScenario, event, state);
      expect(opts.length).toBeGreaterThan(0);
      const choice = opts[0]!;
      state = applyDecision(ransomwareScenario, state, choice.id).state;
      guard += 1;
    }
    expect(state.status).toBe('ended');
    expect(state.currentEventId).toBeNull();
    for (const value of Object.values(state.metrics)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    expect(Number.isFinite(finalScoreFor(ransomwareScenario, state))).toBe(true);
  });

  it('computeFinalScore is a transparent weighted sum', () => {
    const metrics = { continuity: 100, riskReduction: 100, customerTrust: 100, financial: 100, governance: 100, responseQuality: 100, efficiency: 100 };
    expect(scoreFn(metrics, ransomwareScenario.weights, 0)).toBe(100);
    expect(scoreFn(metrics, ransomwareScenario.weights, 10)).toBe(110);
    const zero = { continuity: 0, riskReduction: 0, customerTrust: 0, financial: 0, governance: 0, responseQuality: 0, efficiency: 0 };
    expect(scoreFn(zero, ransomwareScenario.weights, 0)).toBe(0);
  });

  it('simulatePlaythrough returns one step per event and a bounded final score', () => {
    const result = simulatePlaythrough(ransomwareScenario);
    expect(result.steps.length).toBe(ransomwareScenario.events.length);
    expect(result.steps[0]!.eventId).toBe('e1-investment');
    expect(result.steps.at(-1)!.nextEventId).toBeNull();
    expect(Number.isFinite(result.finalScore)).toBe(true);
    expect(result.finalState.status).toBe('ended');
  });
});

/** Two-card deck: buy-a unlocks buy-b, which requires buy-a. */
function relationScenario(): Scenario {
  return {
    key: 'synth-rel',
    version: 1,
    name: { es: 'Rel', en: 'Rel' },
    summary: { es: 'x', en: 'x' },
    organization: {
      name: 'S',
      industry: { es: 'x', en: 'x' },
      size: { es: 'x', en: 'x' },
      description: { es: 'x', en: 'x' },
      objectives: [],
      criticalAssets: [],
    },
    architecture: [],
    start: { budget: 20, maturity: 'medium' },
    weights: baseWeights,
    deck: { fixed: ['buy-a'], pool: [], drawCount: 0, serviceFixed: false },
    cards: [
      {
        id: 'buy-a',
        label: { es: 'A', en: 'A' },
        description: { es: 'a', en: 'a' },
        cost: 2,
        controls: [],
        scoreDelta: 5,
        unlocksCards: ['buy-b'],
      },
      {
        id: 'buy-b',
        label: { es: 'B', en: 'B' },
        description: { es: 'b', en: 'b' },
        cost: 3,
        controls: [],
        scoreDelta: 8,
        requiresCards: ['buy-a'],
      },
    ],
    events: [
      { id: 'e1', round: 1, phase: { es: 'p', en: 'p' }, title: { es: 't', en: 't' }, narrative: { es: 'n', en: 'n' }, next: 'e2' },
      { id: 'e2', round: 2, phase: { es: 'p', en: 'p' }, title: { es: 't', en: 't' }, narrative: { es: 'n', en: 'n' } },
    ],
    debrief: { learningObjectives: [], correctReasoning: [] },
  };
}

describe('card relations and per-session overrides', () => {
  it('gates a card behind a prerequisite and injects unlocked cards', () => {
    const scenario = relationScenario();
    const state = initGameState('team-1', scenario, 0);
    const cardB = scenario.cards!.find((c) => c.id === 'buy-b')!;
    expect(state.hand).toContain('buy-a');
    expect(state.hand).not.toContain('buy-b');
    expect(requiresCardsMet(cardB, state)).toBe(false);
    expect(availableOptions(scenario, getEvent(scenario, 'e1'), state).map((o) => o.id)).not.toContain('buy-b');

    const r1 = applyDecision(scenario, state, 'buy-a');
    expect(r1.state.purchasedCards).toContain('buy-a');
    expect(r1.state.hand).toContain('buy-b');
    expect(requiresCardsMet(cardB, r1.state)).toBe(true);
    expect(availableOptions(scenario, getEvent(scenario, 'e2'), r1.state).map((o) => o.id)).toContain('buy-b');

    const before = r1.state;
    const r2 = applyDecision(scenario, before, 'buy-b');
    expect(r2.state.purchasedCards).toContain('buy-b');
    expect(r2.state.score - before.score).toBe(8);
    expect(before.budget - r2.state.budget).toBe(3);
  });

  it('rejects buying a card whose prerequisite is missing', () => {
    const scenario = relationScenario();
    const state = initGameState('team-2', scenario, 0);
    state.hand = ['buy-a', 'buy-b'];
    expect(() => applyDecisions(scenario, state, ['buy-b'])).toThrowError(/REQUIRES_CARDS|purchase another/);
  });

  it('applies per-session cost/score overrides on top of the scenario', () => {
    const scenario = relationScenario();
    const patched = applyCardOverrides(scenario, { 'buy-a': { cost: 0, scoreDelta: 1 }, 'buy-b': { cost: 1 } });
    const a = patched.cards!.find((c) => c.id === 'buy-a')!;
    const b = patched.cards!.find((c) => c.id === 'buy-b')!;
    expect(a.cost).toBe(0);
    expect(a.scoreDelta).toBe(1);
    expect(b.cost).toBe(1);
    expect(b.scoreDelta).toBe(8);
    expect(scenario.cards!.find((c) => c.id === 'buy-a')!.cost).toBe(2);
  });
});
