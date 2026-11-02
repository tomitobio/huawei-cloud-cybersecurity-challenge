import { describe, it, expect } from 'vitest';
import {
  applyDecision,
  availableOptions,
  conditionMet,
  finalScoreFor,
  getEvent,
  initGameState,
  simulatePlaythrough,
  validateScenario,
  EngineError,
} from '../engine';
import { ransomwareScenario } from '../scenarios/ransomware';
import { computeFinalScore as scoreFn } from '../scoring';
import type { GameStateData, Scenario } from '../types';

describe('scenario validation', () => {
  it('the ransomware scenario is valid and fully reachable', () => {
    const problems = validateScenario(ransomwareScenario);
    expect(problems).toEqual([]);
  });
});

describe('initGameState', () => {
  it('starts with the scenario budget and first event', () => {
    const state = initGameState('t1', ransomwareScenario);
    expect(state.budget).toBe(ransomwareScenario.start.budget);
    expect(state.currentEventId).toBe('e1-investment');
    expect(state.status).toBe('active');
    expect(state.version).toBe(0);
  });
});

describe('options and requirements', () => {
  it('filters options by requirements and budget', () => {
    const state = initGameState('t1', ransomwareScenario);
    const event = getEvent(ransomwareScenario, state.currentEventId!);
    const opts = availableOptions(event, state);
    expect(opts.length).toBe(5);
  });

  it('hides HSS-dependent option until HSS is funded', () => {
    const state = initGameState('t1', ransomwareScenario);
    const after = applyDecision(ransomwareScenario, state, 'pkg-minimal').state;
    const event = getEvent(ransomwareScenario, after.currentEventId!);
    const ids = availableOptions(event, after).map((o) => o.id);
    expect(ids).not.toContain('investigate-hss');
    expect(ids).toContain('investigate-manual');
  });

  it('grants flags and deducts budget', () => {
    const state = initGameState('t1', ransomwareScenario);
    const result = applyDecision(ransomwareScenario, state, 'pkg-balanced');
    expect(result.state.flags).toEqual(
      expect.arrayContaining(['hss_funded', 'cfw_funded', 'secmaster_funded']),
    );
    expect(result.state.budget).toBe(100 - 48);
    expect(result.nextEventId).toBe('e2-host-alert');
  });

  it('rejects unaffordable options', () => {
    const state = initGameState('t1', ransomwareScenario);
    state.budget = 3;
    expect(() => applyDecision(ransomwareScenario, state, 'pkg-balanced')).toThrow(EngineError);
  });

  it('rejects options whose requirements are unmet', () => {
    const state = initGameState('t1', ransomwareScenario);
    const after = applyDecision(ransomwareScenario, state, 'pkg-perimeter').state;
    expect(() => applyDecision(ransomwareScenario, after, 'investigate-hss')).toThrow(EngineError);
  });
});

describe('branching', () => {
  it('routes to the severe path when the alert is ignored', () => {
    const state = initGameState('t1', ransomwareScenario);
    const afterE1 = applyDecision(ransomwareScenario, state, 'pkg-detect').state;
    const afterE2 = applyDecision(ransomwareScenario, afterE1, 'ignore-alert');
    expect(afterE2.state.currentEventId).toBe('e3b-spread-severe');
    expect(afterE2.state.flags).toContain('ignored_alert');
  });

  it('routes to the normal path when the alert is investigated', () => {
    const state = initGameState('t1', ransomwareScenario);
    const afterE1 = applyDecision(ransomwareScenario, state, 'pkg-balanced').state;
    const afterE2 = applyDecision(ransomwareScenario, afterE1, 'investigate-hss');
    expect(afterE2.state.currentEventId).toBe('e3-spread');
    expect(afterE2.state.flags).toContain('confirmed_compromise');
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

describe('delayed effects and transitions (synthetic scenario)', () => {
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
    weights: { ...ransomwareScenario.weights },
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
          {
            id: 'b',
            label: { es: 'b', en: 'b' },
            description: { es: 'b', en: 'b' },
            cost: 5,
            controls: [],
          },
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
    // delayed not yet applied
    expect(s1.metrics.riskReduction).toBe(risk0);
    expect(s1.pendingDelayed.riskReduction).toBe(10);
    const s2 = applyDecision(synth, s1, 'd').state; // jumps to s3, flushes delayed
    expect(s2.metrics.riskReduction).toBe(risk0 + 10);
  });

  it('ends the game when there is no next event', () => {
    const s0 = initGameState('t', synth);
    const s1 = applyDecision(synth, s0, 'b').state; // -> s2
    const s2 = applyDecision(synth, s1, 'c').state; // -> s3
    const s3 = applyDecision(synth, s2, 'd'); // -> end
    expect(s3.nextEventId).toBeNull();
    expect(s3.state.status).toBe('ended');
  });
});

describe('full playthrough and scoring', () => {
  it('can be played start to finish and produces a bounded score', () => {
    let state = initGameState('t1', ransomwareScenario);
    let guard = 0;
    while (state.currentEventId && guard < 50) {
      const event = getEvent(ransomwareScenario, state.currentEventId);
      const opts = availableOptions(event, state);
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
    const score = finalScoreFor(ransomwareScenario, state);
    expect(Number.isFinite(score)).toBe(true);
  });

  it('computeFinalScore is a transparent weighted sum', () => {
    const metrics = { continuity: 100, riskReduction: 100, customerTrust: 100, financial: 100, governance: 100, responseQuality: 100, efficiency: 100 };
    expect(scoreFn(metrics, ransomwareScenario.weights, 0)).toBe(100);
    expect(scoreFn(metrics, ransomwareScenario.weights, 10)).toBe(110);
    const zero = { continuity: 0, riskReduction: 0, customerTrust: 0, financial: 0, governance: 0, responseQuality: 0, efficiency: 0 };
    expect(scoreFn(zero, ransomwareScenario.weights, 0)).toBe(0);
  });

  it('simulatePlaythrough returns steps and a bounded final score', () => {
    const result = simulatePlaythrough(ransomwareScenario);
    expect(result.steps.length).toBe(7);
    expect(result.steps[0]!.eventId).toBe('e1-investment');
    expect(result.steps.at(-1)!.nextEventId).toBeNull();
    expect(Number.isFinite(result.finalScore)).toBe(true);
    expect(result.finalState.status).toBe('ended');
  });

  it('simulatePlaythrough honours explicit choices', () => {
    const result = simulatePlaythrough(ransomwareScenario, ['pkg-detect', 'ignore-alert']);
    expect(result.steps[0]!.optionId).toBe('pkg-detect');
    expect(result.steps[1]!.optionId).toBe('ignore-alert');
    // the ignored alert branches to the severe spread event
    expect(result.steps[2]!.eventId).toBe('e3b-spread-severe');
  });
});
