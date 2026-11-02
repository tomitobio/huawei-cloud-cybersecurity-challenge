import { describe, it, expect } from 'vitest';
import {
  applyDecision,
  availableOptions,
  finalScoreFor,
  getEvent,
  initGameState,
  validateScenario,
} from '../engine';
import { SCENARIOS, listScenarios, getScenarioByKey } from '../scenarios';
import type { Scenario } from '../types';

const scenarios = listScenarios();

describe('scenario library', () => {
  it('registers the three built-in scenarios', () => {
    expect(listScenarios().map((s) => s.key).sort()).toEqual(
      ['privileged-access-health', 'ransomware-retail', 'webapp-travel'].sort(),
    );
  });

  it('looks up scenarios by key', () => {
    expect(getScenarioByKey('webapp-travel')?.key).toBe('webapp-travel');
    expect(getScenarioByKey('nope')).toBeUndefined();
  });
});

describe.each(scenarios.map((s) => [s.key, s] as const))('%s', (_key, scenario: Scenario) => {
  it('is valid and fully reachable', () => {
    expect(validateScenario(scenario)).toEqual([]);
  });

  it('has localized content in Spanish and English', () => {
    for (const event of scenario.events) {
      expect(event.title.es.length).toBeGreaterThan(0);
      expect(event.title.en.length).toBeGreaterThan(0);
      expect(event.narrative.es.length).toBeGreaterThan(0);
      expect(event.narrative.en.length).toBeGreaterThan(0);
      for (const opt of event.options) {
        expect(opt.label.es.length).toBeGreaterThan(0);
        expect(opt.label.en.length).toBeGreaterThan(0);
        expect(opt.description.es.length).toBeGreaterThan(0);
        expect(opt.description.en.length).toBeGreaterThan(0);
      }
    }
  });

  it('can be played start to finish with a bounded score', () => {
    let state = initGameState('t', scenario);
    let guard = 0;
    while (state.currentEventId && guard < 60) {
      const event = getEvent(scenario, state.currentEventId);
      const opts = availableOptions(event, state);
      expect(opts.length).toBeGreaterThan(0);
      // choose the highest-scoring affordable option to exercise positive paths
      const choice = [...opts].sort((a, b) => (b.scoreDelta ?? 0) - (a.scoreDelta ?? 0))[0]!;
      state = applyDecision(scenario, state, choice.id).state;
      guard += 1;
    }
    expect(guard).toBeLessThan(60);
    expect(state.status).toBe('ended');
    expect(state.currentEventId).toBeNull();
    for (const value of Object.values(state.metrics)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    expect(Number.isFinite(finalScoreFor(scenario, state))).toBe(true);
  });

  it('has every event reachable in the definition of the scenario', () => {
    // sanity: all scenario keys are unique
    expect(Object.keys(SCENARIOS)).toContain(scenario.key);
  });
});

describe('branching per scenario', () => {
  it('webapp routes to the over-blocking outage branch', () => {
    const scenario = getScenarioByKey('webapp-travel')!;
    const s0 = initGameState('t', scenario);
    const s1 = applyDecision(scenario, s0, 'pkg-web').state;
    const s2 = applyDecision(scenario, s1, 'waf-block-all');
    expect(s2.state.currentEventId).toBe('b3b-outage');
    expect(s2.state.flags).toContain('aggressive_blocking');
  });

  it('privileged routes to the expanded-breach branch when ignored', () => {
    const scenario = getScenarioByKey('privileged-access-health')!;
    const s0 = initGameState('t', scenario);
    const s1 = applyDecision(scenario, s0, 'pkg-priv-data').state;
    const s2 = applyDecision(scenario, s1, 'ignore-priv');
    expect(s2.state.currentEventId).toBe('c2b-breach');
    expect(s2.state.flags).toContain('ignored_priv');
  });

  it('privileged follows the normal path when investigated', () => {
    const scenario = getScenarioByKey('privileged-access-health')!;
    const s0 = initGameState('t', scenario);
    const s1 = applyDecision(scenario, s0, 'pkg-priv-data').state;
    const s2 = applyDecision(scenario, s1, 'cbh-review');
    expect(s2.state.currentEventId).toBe('c3-credentials');
    expect(s2.state.flags).toContain('priv_incident');
  });
});
