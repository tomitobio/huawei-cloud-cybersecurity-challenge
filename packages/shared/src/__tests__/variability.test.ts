import { describe, it, expect } from 'vitest';
import { applyDecision, initGameState } from '../engine';
import { mulberry32, mixSeed, normalizeVariance } from '../rng';
import type { Scenario } from '../types';

const baseWeights: Scenario['weights'] = {
  continuity: 1,
  riskReduction: 1,
  customerTrust: 1,
  financial: 1,
  governance: 1,
  responseQuality: 1,
  efficiency: 1,
};

function scenarioWith(variance?: number): Scenario {
  return {
    key: `synth-${variance ?? 0}`,
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
            immediate: { riskReduction: 20, continuity: 15, financial: -10 },
            variance,
          },
          { id: 'b', label: { es: 'b', en: 'b' }, description: { es: 'b', en: 'b' }, cost: 0, controls: [] },
        ],
      },
    ],
    debrief: { learningObjectives: [], correctReasoning: [] },
  };
}

describe('mulberry32 PRNG', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 5 }, mulberry32(1));
    const b = Array.from({ length: 5 }, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it('mixSeed is stable and counter-sensitive', () => {
    expect(mixSeed(7, 0)).toBe(mixSeed(7, 0));
    expect(mixSeed(7, 0)).not.toBe(mixSeed(7, 1));
  });

  it('normalizeVariance clamps to [0, 1] and defaults to 0', () => {
    expect(normalizeVariance(undefined)).toBe(0);
    expect(normalizeVariance(-1)).toBe(0);
    expect(normalizeVariance(2)).toBe(1);
    expect(normalizeVariance(0.4)).toBe(0.4);
  });
});

describe('reproducible variability', () => {
  it('same seed reproduces the exact same result', () => {
    const s = scenarioWith(0.4);
    const a = applyDecision(s, initGameState('t', s, 42), 'a');
    const b = applyDecision(s, initGameState('t', s, 42), 'a');
    expect(a.state.metrics).toEqual(b.state.metrics);
    expect(a.state.pendingDelayed).toEqual(b.state.pendingDelayed);
  });

  it('different seeds produce different magnitudes when variance is set', () => {
    const s = scenarioWith(0.4);
    const a = applyDecision(s, initGameState('t', s, 1), 'a').state.metrics;
    const b = applyDecision(s, initGameState('t', s, 2), 'a').state.metrics;
    expect(a).not.toEqual(b);
  });

  it('stays fully deterministic when variance is 0 (default legacy behaviour)', () => {
    const s = scenarioWith(undefined);
    const a = applyDecision(s, initGameState('t', s, 1), 'a').state.metrics;
    const b = applyDecision(s, initGameState('t', s, 999), 'a').state.metrics;
    const c = applyDecision(s, initGameState('t', s, 0), 'a').state.metrics;
    expect(a).toEqual(c);
    expect(b).toEqual(c);
    // exact expected value: baseline medium riskReduction 48 + 20
    expect(a.riskReduction).toBe(68);
  });

  it('advances the rng counter by one per resolved decision', () => {
    const s = scenarioWith(0.4);
    const s0 = initGameState('t', s, 5);
    expect(s0.rngCounter).toBe(0);
    const s1 = applyDecision(s, s0, 'a').state;
    expect(s1.rngCounter).toBe(1);
    expect(s1.seed).toBe(5);
  });

  it('tolerates legacy states without seed/rngCounter fields', () => {
    const s = scenarioWith(0.4);
    const legacy = initGameState('t', s, 0);
    delete (legacy as { seed?: number }).seed;
    delete (legacy as { rngCounter?: number }).rngCounter;
    expect(() => applyDecision(s, legacy, 'a')).not.toThrow();
  });
});
