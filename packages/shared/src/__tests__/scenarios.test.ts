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
import { CARD_LIBRARY } from '../scenarios/cards';
import type { Scenario } from '../types';

const scenarios = listScenarios();

describe('scenario library', () => {
  it('registers the six built-in scenarios', () => {
    expect(listScenarios().map((s) => s.key).sort()).toEqual(
      [
        'corporate-multisector',
        'industrial-operations',
        'privileged-access-health',
        'public-services',
        'ransomware-retail',
        'webapp-travel',
      ].sort(),
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
      for (const hyp of event.hypotheses ?? []) {
        expect(hyp.es.length).toBeGreaterThan(0);
        expect(hyp.en.length).toBeGreaterThan(0);
      }
      for (const sig of event.signals ?? []) {
        expect(sig.text.es.length).toBeGreaterThan(0);
        expect(sig.text.en.length).toBeGreaterThan(0);
      }
    }
    // Card text: from the scenario deck, or the legacy inline options.
    const cards = scenario.cards ?? scenario.events.flatMap((e) => e.options ?? []);
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.label.es.length).toBeGreaterThan(0);
      expect(card.label.en.length).toBeGreaterThan(0);
      expect(card.description.es.length).toBeGreaterThan(0);
      expect(card.description.en.length).toBeGreaterThan(0);
    }
  });

  it('uses a coherent deck (fixed + pool) when deck-based', () => {
    if (!scenario.deck) return;
    expect((scenario.cards ?? []).length).toBeGreaterThan(0);
    expect(scenario.deck.fixed.length).toBeGreaterThanOrEqual(6);
    expect(scenario.deck.fixed.length).toBeLessThanOrEqual(7);
    expect(scenario.deck.pool.length).toBeGreaterThanOrEqual(scenario.deck.drawCount);
    // every focus tag must have at least 3 pool cards
    for (const event of scenario.events) {
      for (const tag of event.focusTags ?? []) {
        const count = scenario.deck.pool.filter((id) => (CARD_LIBRARY[id]?.tags ?? []).includes(tag)).length;
        expect(count).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('can be played start to finish with a bounded score', () => {
    let state = initGameState('t', scenario);
    let guard = 0;
    while (state.currentEventId && guard < 60) {
      const event = getEvent(scenario, state.currentEventId);
      const opts = availableOptions(scenario, event, state);
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

  it('is registered in the SCENARIOS map', () => {
    expect(Object.keys(SCENARIOS)).toContain(scenario.key);
  });
});

describe('deck variety', () => {
  it('scenarios use the same fixed cards (fairness) but draw different pools', () => {
    const decked = scenarios.filter((s) => s.deck);
    expect(decked.length).toBeGreaterThanOrEqual(6);
    const firstFixed = [...decked[0]!.deck!.fixed].sort().join(',');
    for (const s of decked) {
      expect([...s.deck!.fixed].sort().join(',')).toBe(firstFixed);
    }
  });
});
