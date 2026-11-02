import {
  METRIC_KEYS,
  type MaturityLevel,
  type MetricDeltas,
  type MetricKey,
  type Metrics,
  type ScoreWeights,
} from './types';

/** Default scoring weights. Instructors can override per session. */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  continuity: 0.22,
  riskReduction: 0.2,
  customerTrust: 0.14,
  responseQuality: 0.14,
  financial: 0.12,
  governance: 0.1,
  efficiency: 0.08,
};

export const METRIC_LABELS: Record<MetricKey, { es: string; en: string }> = {
  continuity: { es: 'Continuidad de negocio', en: 'Business continuity' },
  riskReduction: { es: 'Reducción de riesgo', en: 'Security risk reduction' },
  customerTrust: { es: 'Confianza del cliente', en: 'Customer trust' },
  financial: { es: 'Impacto financiero', en: 'Financial impact' },
  governance: { es: 'Gobernanza y cumplimiento', en: 'Governance & compliance' },
  responseQuality: { es: 'Calidad de respuesta', en: 'Incident response quality' },
  efficiency: { es: 'Eficiencia de recursos', en: 'Resource efficiency' },
};

/** Baseline metrics by maturity level. */
export const MATURITY_BASELINE: Record<MaturityLevel, Metrics> = {
  low: {
    continuity: 55,
    riskReduction: 35,
    customerTrust: 55,
    financial: 50,
    governance: 40,
    responseQuality: 35,
    efficiency: 55,
  },
  medium: {
    continuity: 70,
    riskReduction: 48,
    customerTrust: 66,
    financial: 62,
    governance: 52,
    responseQuality: 48,
    efficiency: 62,
  },
  high: {
    continuity: 80,
    riskReduction: 62,
    customerTrust: 75,
    financial: 72,
    governance: 65,
    responseQuality: 62,
    efficiency: 68,
  },
};

export function clampMetric(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Apply a set of deltas to a metrics object, clamping to 0..100. */
export function applyDeltas(metrics: Metrics, deltas: MetricDeltas | undefined): Metrics {
  const next: Metrics = { ...metrics };
  if (!deltas) return next;
  for (const key of METRIC_KEYS) {
    const delta = deltas[key];
    if (typeof delta === 'number') {
      next[key] = clampMetric(next[key] + delta);
    }
  }
  return next;
}

/**
 * Final score for a team: weighted sum of its metrics plus explicit score
 * contributions from decisions. Transparent and explainable.
 */
export function computeFinalScore(
  metrics: Metrics,
  weights: ScoreWeights,
  explicitScore: number,
): number {
  let weighted = 0;
  let weightSum = 0;
  for (const key of METRIC_KEYS) {
    const w = weights[key] ?? 0;
    weighted += w * metrics[key];
    weightSum += w;
  }
  const normalized = weightSum > 0 ? weighted / weightSum : 0;
  return Math.round((normalized + explicitScore) * 100) / 100;
}

/** Normalize weights so they always sum to 1. */
export function normalizeWeights(weights: ScoreWeights): ScoreWeights {
  const sum = METRIC_KEYS.reduce((acc, k) => acc + (weights[k] ?? 0), 0);
  if (sum <= 0) return { ...DEFAULT_WEIGHTS };
  const out = {} as ScoreWeights;
  for (const key of METRIC_KEYS) out[key] = (weights[key] ?? 0) / sum;
  return out;
}
