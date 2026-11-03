import { Router } from 'express';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth';
import {
  SCENARIOS,
  getScenarioByKey,
  listScenarios,
  simulatePlaythrough,
  validateScenario,
  previewScenarioSchema,
  saveScenarioSchema,
  type Scenario,
} from '@hcc/shared';
import {
  deleteCustomScenario,
  listAllScenarios,
  resolveScenarioDefinition,
  saveCustomScenario,
  setScenarioActive,
} from '../services/scenarioStore';
import { audit } from '../services/game';

export const scenarioRouter = Router();

scenarioRouter.use('/scenarios', requireAuth);

function summarize(s: Scenario, source: 'builtin' | 'custom', isActive: boolean) {
  return {
    key: s.key,
    name: s.name,
    summary: s.summary,
    version: s.version,
    eventCount: s.events.length,
    organization: s.organization.name,
    maturity: s.start.maturity,
    budget: s.start.budget,
    source,
    isActive,
    valid: validateScenario(s).length === 0,
  };
}

// List all scenarios (built-in + custom) for instructors and admins.
scenarioRouter.get(
  '/scenarios',
  asyncHandler(async (_req, res) => {
    const all = await listAllScenarios();
    res.json({
      scenarios: all.map((entry) => summarize(entry.definition, entry.source, entry.isActive)),
    });
  }),
);

// Full definition of one scenario (with validation problems), built-in or custom.
scenarioRouter.get(
  '/scenarios/:key',
  asyncHandler(async (req, res) => {
    const builtin = getScenarioByKey(req.params.key);
    if (builtin) {
      return res.json({
        scenario: builtin,
        problems: validateScenario(builtin),
        source: 'builtin',
        isActive: true,
      });
    }
    const row = await resolveScenarioDefinition(req.params.key);
    if (!row) throw ApiError.notFound('Scenario not found');
    res.json({ scenario: row, problems: validateScenario(row), source: 'custom', isActive: true });
  }),
);

// Validate a scenario payload without saving it.
scenarioRouter.post(
  '/scenarios/validate',
  asyncHandler(async (req, res) => {
    const parsed = saveScenarioSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(200).json({
        ok: false,
        issues: parsed.error.issues,
        problems: ['The definition does not match the scenario schema'],
      });
    }
    const problems = validateScenario(parsed.data.scenario as Scenario);
    res.json({ ok: problems.length === 0, issues: [], problems });
  }),
);

// Preview (simulate) a scenario to see how a playthrough behaves.
scenarioRouter.post(
  '/scenarios/preview',
  asyncHandler(async (req, res) => {
    const parsed = previewScenarioSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Invalid preview payload');

    let scenario: Scenario | undefined;
    if (parsed.data.scenario) {
      scenario = parsed.data.scenario as Scenario;
    } else if (parsed.data.key) {
      scenario = await resolveScenarioDefinition(parsed.data.key);
    }
    if (!scenario) throw ApiError.notFound('Scenario not found');

    const problems = validateScenario(scenario);
    let result;
    try {
      result = simulatePlaythrough(scenario, parsed.data.choices ?? [], parsed.data.seed ?? 0);
    } catch (err) {
      throw ApiError.badRequest(`Preview failed: ${(err as Error).message}`);
    }
    res.json({
      key: scenario.key,
      source: SCENARIOS[scenario.key] ? 'builtin' : 'custom',
      problems,
      ...result,
    });
  }),
);

// Create or replace a custom scenario.
scenarioRouter.post(
  '/scenarios',
  requireRole('ADMIN', 'INSTRUCTOR'),
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { scenario, isActive } = saveScenarioSchema.parse(req.body);
    const row = await saveCustomScenario(scenario as Scenario, isActive ?? true);
    await audit(null, req.user!.sub, 'scenario.saved', { key: row.key, version: row.version });
    res.status(201).json({ scenario: row.definition, key: row.key, isActive: row.isActive });
  }),
);

// Update a custom scenario definition by key.
scenarioRouter.put(
  '/scenarios/:key',
  requireRole('ADMIN', 'INSTRUCTOR'),
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { scenario, isActive } = saveScenarioSchema.parse(req.body);
    if (scenario.key !== req.params.key) {
      throw ApiError.badRequest('The payload key does not match the URL key');
    }
    if (SCENARIOS[req.params.key]) throw ApiError.badRequest('Built-in scenarios cannot be edited');
    const row = await saveCustomScenario(scenario as Scenario, isActive ?? true);
    await audit(null, req.user!.sub, 'scenario.updated', { key: row.key, version: row.version });
    res.json({ scenario: row.definition, key: row.key, isActive: row.isActive });
  }),
);

// Toggle a custom scenario's active flag.
scenarioRouter.post(
  '/scenarios/:key/active',
  requireRole('ADMIN', 'INSTRUCTOR'),
  asyncHandler<AuthedRequest>(async (req, res) => {
    const isActive = Boolean(req.body?.isActive);
    const row = await setScenarioActive(req.params.key, isActive);
    await audit(null, req.user!.sub, 'scenario.active.set', { key: row.key, isActive });
    res.json({ key: row.key, isActive: row.isActive });
  }),
);

// Delete a custom scenario (blocked when sessions reference it).
scenarioRouter.delete(
  '/scenarios/:key',
  requireRole('ADMIN', 'INSTRUCTOR'),
  asyncHandler<AuthedRequest>(async (req, res) => {
    await deleteCustomScenario(req.params.key);
    await audit(null, req.user!.sub, 'scenario.deleted', { key: req.params.key });
    res.json({ ok: true, key: req.params.key });
  }),
);

// Small helper for the frontend: the list of supported metric keys/weights defaults.
scenarioRouter.get(
  '/scenarios-meta',
  asyncHandler(async (_req, res) => {
    res.json({ builtinKeys: Object.keys(SCENARIOS), builtinCount: listScenarios().length });
  }),
);
