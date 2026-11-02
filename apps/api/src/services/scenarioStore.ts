import { prisma } from '../db';
import { ApiError } from '../lib/http';
import { SCENARIOS, validateScenario, type Scenario } from '@hcc/shared';

/**
 * Scenario storage. Built-in scenarios live in code (the `@hcc/shared` registry);
 * instructor-authored scenarios are stored as `Scenario` rows in the database.
 * A scenario key that exists in the built-in registry always wins.
 */

export function isBuiltinScenario(key: string): boolean {
  return Boolean(SCENARIOS[key]);
}

export interface StoredScenario {
  definition: Scenario;
  source: 'builtin' | 'custom';
  isActive: boolean;
  createdAt: Date | null;
}

/** All scenarios available to instructors: built-ins first, then custom ones. */
export async function listAllScenarios(): Promise<StoredScenario[]> {
  const builtin: StoredScenario[] = Object.values(SCENARIOS).map((s) => ({
    definition: s,
    source: 'builtin',
    isActive: true,
    createdAt: null,
  }));

  const rows = await prisma.scenario.findMany({ orderBy: { createdAt: 'asc' } });
  const custom: StoredScenario[] = rows
    .filter((r) => !SCENARIOS[r.key])
    .map((r) => ({
      definition: r.definition as unknown as Scenario,
      source: 'custom',
      isActive: r.isActive,
      createdAt: r.createdAt,
    }));

  return [...builtin, ...custom];
}

export async function findScenarioRow(key: string) {
  return prisma.scenario.findUnique({ where: { key } });
}

/** Built-in definition if present, otherwise the stored custom definition. */
export async function resolveScenarioDefinition(key: string): Promise<Scenario | undefined> {
  if (SCENARIOS[key]) return SCENARIOS[key];
  const row = await prisma.scenario.findUnique({ where: { key } });
  return row ? (row.definition as unknown as Scenario) : undefined;
}

/** Create or replace a custom scenario after schema + engine validation. */
export async function saveCustomScenario(def: Scenario, isActive = true) {
  if (SCENARIOS[def.key]) {
    throw ApiError.badRequest('A built-in scenario cannot be overwritten');
  }
  const problems = validateScenario(def);
  if (problems.length) {
    throw new ApiError(400, 'SCENARIO_INVALID', problems.join('; '));
  }
  return prisma.scenario.upsert({
    where: { key: def.key },
    update: {
      name: def.name.en,
      version: def.version,
      definition: def as unknown as object,
      isActive,
    },
    create: {
      key: def.key,
      name: def.name.en,
      version: def.version,
      definition: def as unknown as object,
      isActive,
    },
  });
}

export async function setScenarioActive(key: string, isActive: boolean) {
  if (SCENARIOS[key]) throw ApiError.badRequest('Built-in scenarios are always active');
  const row = await prisma.scenario.findUnique({ where: { key } });
  if (!row) throw ApiError.notFound('Scenario not found');
  return prisma.scenario.update({ where: { key }, data: { isActive } });
}

export async function deleteCustomScenario(key: string) {
  if (SCENARIOS[key]) throw ApiError.badRequest('Built-in scenarios cannot be deleted');
  const row = await prisma.scenario.findUnique({
    where: { key },
    include: { _count: { select: { sessions: true } } },
  });
  if (!row) throw ApiError.notFound('Scenario not found');
  if (row._count.sessions > 0) {
    throw ApiError.conflict('This scenario is used by existing sessions and cannot be deleted');
  }
  await prisma.scenario.delete({ where: { key } });
}
