import { z } from 'zod';

/** Zod schemas for validating scenario definitions and API payloads. */

export const localizedTextSchema = z.object({
  es: z.string().min(1),
  en: z.string().min(1),
});

export const metricKeySchema = z.enum([
  'continuity',
  'riskReduction',
  'customerTrust',
  'financial',
  'governance',
  'responseQuality',
  'efficiency',
]);

export const controlIdSchema = z.enum(['HSS', 'CFW', 'WAF', 'DEW', 'CBH', 'SecMaster']);

const metricDeltasSchema = z.record(metricKeySchema, z.number());

export const conditionSchema = z.object({
  hasFlag: z.string().optional(),
  notFlag: z.string().optional(),
  metricGte: z.record(metricKeySchema, z.number()).optional(),
  metricLte: z.record(metricKeySchema, z.number()).optional(),
  minCoverage: z.number().int().min(0).optional(),
  requireControls: z.array(controlIdSchema).optional(),
});

export const decisionOptionSchema = z.object({
  id: z.string().min(1),
  label: localizedTextSchema,
  description: localizedTextSchema,
  cost: z.number().min(0),
  controls: z.array(controlIdSchema),
  requires: conditionSchema.optional(),
  grantsFlags: z.array(z.string()).optional(),
  removesFlags: z.array(z.string()).optional(),
  immediate: metricDeltasSchema.optional(),
  delayed: metricDeltasSchema.optional(),
  scoreDelta: z.number().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  risks: z.array(localizedTextSchema).optional(),
  mitigates: z.array(z.string()).optional(),
  isRecovery: z.boolean().optional(),
  variance: z.number().min(0).max(1).optional(),
  // Card-deck fields
  tags: z.array(z.string()).optional(),
  baseWeight: z.number().min(0).optional(),
  premiumOnFocus: z.boolean().optional(),
  kind: z.enum(['action', 'investigate']).optional(),
  revealsSignals: z.array(z.string()).optional(),
  clarityDelta: z.number().min(0).max(1).optional(),
  premium: z.boolean().optional(),
  serviceCard: z.boolean().optional(),
});

/** Card-library input (a card without its scenario-local id, plus a stable key). */
export const cardInputSchema = decisionOptionSchema
  .omit({ id: true, premium: true })
  .extend({
    cardKey: z.string().min(1).max(80),
    isActive: z.boolean().optional(),
  });

export const ambiguousSignalSchema = z.object({
  id: z.string().min(1),
  text: localizedTextSchema,
  truth: z.enum(['true', 'false', 'partial']),
});

export const handConfigSchema = z.object({
  fixed: z.array(z.string()).optional(),
  pool: z.array(z.string()).optional(),
  drawCount: z.number().int().min(0).optional(),
  income: z.number().min(0).optional(),
});

export const scenarioEventSchema = z.object({
  id: z.string().min(1),
  round: z.number().int().min(1),
  phase: localizedTextSchema,
  title: localizedTextSchema,
  narrative: localizedTextSchema,
  intel: z.array(localizedTextSchema).optional(),
  businessImpact: localizedTextSchema.optional(),
  controlsInPlay: z.array(controlIdSchema).optional(),
  options: z.array(decisionOptionSchema).optional(),
  focusTags: z.array(z.string()).optional(),
  incidentSeverity: z.number().min(0).max(5).optional(),
  hand: handConfigSchema.optional(),
  signals: z.array(ambiguousSignalSchema).optional(),
  hypotheses: z.array(localizedTextSchema).optional(),
  transitions: z
    .array(z.object({ when: conditionSchema, goto: z.string(), note: localizedTextSchema.optional() }))
    .optional(),
  next: z.string().optional(),
  insightKey: z.string().optional(),
  instructorNotes: localizedTextSchema.optional(),
});

export const scenarioSchema = z.object({
  key: z.string().min(1),
  name: localizedTextSchema,
  version: z.number().int().min(1),
  summary: localizedTextSchema,
  organization: z.object({
    name: z.string(),
    industry: localizedTextSchema,
    size: localizedTextSchema,
    description: localizedTextSchema,
    objectives: z.array(localizedTextSchema),
    criticalAssets: z.array(
      z.object({
        name: localizedTextSchema,
        criticality: z.enum(['low', 'medium', 'high']),
        description: localizedTextSchema,
      }),
    ),
  }),
  architecture: z.array(
    z.object({
      id: z.string(),
      label: localizedTextSchema,
      zone: z.enum(['internet', 'perimeter', 'internal', 'data', 'admin', 'security']),
      control: controlIdSchema.optional(),
    }),
  ),
  start: z.object({
    budget: z.number().min(0),
    maturity: z.enum(['low', 'medium', 'high']),
    baseMetrics: metricDeltasSchema.optional(),
  }),
  weights: z.record(metricKeySchema, z.number()),
  cards: z.array(decisionOptionSchema).optional(),
  deck: z
    .object({
      fixed: z.array(z.string()),
      pool: z.array(z.string()),
      drawCount: z.number().int().min(0),
      serviceFixed: z.boolean().optional(),
      weights: z.record(z.string(), z.number()).optional(),
    })
    .optional(),
  economy: z
    .object({
      incomePerRound: z.number().min(0),
      focus: z
        .object({ costMultiplier: z.number().min(0), scoreMultiplier: z.number().min(0) })
        .optional(),
      minPerFocusTag: z.number().int().min(0).optional(),
    })
    .optional(),
  events: z.array(scenarioEventSchema).min(1),
  debrief: z.object({
    learningObjectives: z.array(localizedTextSchema),
    correctReasoning: z.array(localizedTextSchema),
  }),
});

/** API payload schemas */

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(80),
  role: z.enum(['ADMIN', 'INSTRUCTOR']).default('INSTRUCTOR'),
});

export const createSessionSchema = z.object({
  name: z.string().min(1).max(120),
  scenarioKey: z.string().min(1),
  /** Reproducibility seed. If omitted the server generates one. */
  seed: z.number().int().min(0).max(2147483647).optional(),
  weights: z.record(metricKeySchema, z.number()).optional(),
  teams: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        color: z.string().default('#22d3ee'),
        budget: z.number().min(0).optional(),
        maturity: z.enum(['low', 'medium', 'high']).optional(),
      }),
    )
    .optional(),
});

export const decisionSubmissionSchema = z
  .object({
    optionId: z.string().min(1).optional(),
    optionIds: z.array(z.string().min(1)).max(20).optional(),
    rationale: z.string().max(2000).optional().default(''),
    /** Optimistic concurrency token. */
    expectedVersion: z.number().int().min(0),
  })
  .refine((v) => (v.optionIds?.length ?? 0) > 0 || Boolean(v.optionId), {
    message: 'Provide optionId or a non-empty optionIds list',
    path: ['optionIds'],
  });

export const createTeamSchema = z.object({  name: z.string().min(1).max(60),
  color: z.string().default('#22d3ee'),
  budget: z.number().min(0).optional(),
  maturity: z.enum(['low', 'medium', 'high']).optional(),
});

export const joinSchema = z.object({
  code: z.string().min(4).max(12),
});

export const setDeadlineSchema = z.object({
  seconds: z.number().int().min(0).max(3600),
});

/** Scenario editor payloads */

export const saveScenarioSchema = z.object({
  scenario: scenarioSchema,
  isActive: z.boolean().optional(),
});

export const previewScenarioSchema = z.object({
  /** Built-in scenario key to load when no inline definition is provided. */
  key: z.string().min(1).optional(),
  scenario: scenarioSchema.optional(),
  /** Option id chosen at each step (by index); unknown ids fall back to default. */
  choices: z.array(z.string()).max(100).optional(),
  /** Seed for reproducing variability in the preview. */
  seed: z.number().int().min(0).max(2147483647).optional(),
});
