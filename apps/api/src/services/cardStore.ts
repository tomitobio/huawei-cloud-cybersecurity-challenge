import { prisma } from '../db';
import { ApiError } from '../lib/http';
import type { DecisionOption, Scenario } from '@hcc/shared';
import type { GameCard as GameCardRow } from '@prisma/client';

/**
 * Global card library ("fixed pool"). Scenarios embed copies of the cards they
 * reference at save time, so editing a library card does not mutate running
 * sessions (reproducibility). All content is fictional/simulated.
 */

export type CardInput = {
  cardKey: string;
  label: { es: string; en: string };
  description: { es: string; en: string };
  cost?: number;
  controls: string[];
  tags?: string[];
  kind?: 'action' | 'investigate';
  immediate?: Record<string, number>;
  delayed?: Record<string, number>;
  scoreDelta?: number;
  clarityDelta?: number;
  revealsSignals?: string[];
  premiumOnFocus?: boolean;
  serviceCard?: boolean;
  baseWeight?: number;
  isActive?: boolean;
  requiresCards?: string[];
  unlocksCards?: string[];
};

/** Map a DB card row to a `DecisionOption` usable by the scenario/engine. */
export function toDecisionOption(row: GameCardRow): DecisionOption {
  return {
    id: row.cardKey,
    label: row.label as unknown as DecisionOption['label'],
    description: row.description as unknown as DecisionOption['description'],
    cost: row.cost,
    controls: row.controls as DecisionOption['controls'],
    tags: row.tags,
    kind: (row.kind as DecisionOption['kind']) ?? 'action',
    immediate: (row.immediate as DecisionOption['immediate']) ?? undefined,
    delayed: (row.delayed as DecisionOption['delayed']) ?? undefined,
    scoreDelta: row.scoreDelta,
    clarityDelta: row.clarityDelta,
    revealsSignals: row.revealsSignals,
    premiumOnFocus: row.premiumOnFocus,
    serviceCard: row.serviceCard,
    baseWeight: row.baseWeight,
    requiresCards: row.requiresCards,
    unlocksCards: row.unlocksCards,
  };
}

export function toApi(row: GameCardRow) {
  return {
    cardKey: row.cardKey,
    label: row.label,
    description: row.description,
    cost: row.cost,
    controls: row.controls,
    tags: row.tags,
    kind: row.kind,
    immediate: row.immediate,
    delayed: row.delayed,
    scoreDelta: row.scoreDelta,
    clarityDelta: row.clarityDelta,
    revealsSignals: row.revealsSignals,
    premiumOnFocus: row.premiumOnFocus,
    serviceCard: row.serviceCard,
    baseWeight: row.baseWeight,
    isActive: row.isActive,
    requiresCards: row.requiresCards,
    unlocksCards: row.unlocksCards,
    updatedAt: row.updatedAt,
  };
}

export async function listCards() {
  const rows = await prisma.gameCard.findMany({ orderBy: [{ controls: 'asc' }, { cardKey: 'asc' }] });
  return rows.map(toApi);
}

export async function getCard(cardKey: string) {
  const row = await prisma.gameCard.findUnique({ where: { cardKey } });
  if (!row) throw ApiError.notFound('Card not found');
  return row;
}

export async function createCard(input: CardInput) {
  const exists = await prisma.gameCard.findUnique({ where: { cardKey: input.cardKey } });
  if (exists) throw ApiError.conflict('A card with this key already exists');
  const row = await prisma.gameCard.create({
    data: {
      cardKey: input.cardKey,
      label: input.label as unknown as object,
      description: input.description as unknown as object,
      cost: input.cost ?? 0,
      controls: input.controls,
      tags: input.tags ?? [],
      kind: input.kind ?? 'action',
      immediate: (input.immediate as unknown as object) ?? undefined,
      delayed: (input.delayed as unknown as object) ?? undefined,
      scoreDelta: input.scoreDelta ?? 0,
      clarityDelta: input.clarityDelta ?? 0,
      revealsSignals: input.revealsSignals ?? [],
      premiumOnFocus: input.premiumOnFocus ?? false,
      serviceCard: input.serviceCard ?? false,
      baseWeight: input.baseWeight ?? 1,
      isActive: input.isActive ?? true,
      requiresCards: input.requiresCards ?? [],
      unlocksCards: input.unlocksCards ?? [],
    },
  });
  return toApi(row);
}

export async function updateCard(currentKey: string, input: CardInput) {
  const row = await prisma.gameCard.findUnique({ where: { cardKey: currentKey } });
  if (!row) throw ApiError.notFound('Card not found');
  if (input.cardKey !== currentKey) {
    const clash = await prisma.gameCard.findUnique({ where: { cardKey: input.cardKey } });
    if (clash) throw ApiError.conflict('Another card already uses this key');
  }
  const updated = await prisma.gameCard.update({
    where: { cardKey: currentKey },
    data: {
      cardKey: input.cardKey,
      label: input.label as unknown as object,
      description: input.description as unknown as object,
      cost: input.cost ?? row.cost,
      controls: input.controls,
      tags: input.tags ?? [],
      kind: input.kind ?? 'action',
      immediate: (input.immediate as unknown as object) ?? undefined,
      delayed: (input.delayed as unknown as object) ?? undefined,
      scoreDelta: input.scoreDelta ?? row.scoreDelta,
      clarityDelta: input.clarityDelta ?? 0,
      revealsSignals: input.revealsSignals ?? [],
      premiumOnFocus: input.premiumOnFocus ?? false,
      serviceCard: input.serviceCard ?? false,
      baseWeight: input.baseWeight ?? 1,
      isActive: input.isActive ?? true,
      requiresCards: input.requiresCards ?? [],
      unlocksCards: input.unlocksCards ?? [],
    },
  });
  return toApi(updated);
}

export async function deleteCard(cardKey: string) {
  const row = await prisma.gameCard.findUnique({ where: { cardKey } });
  if (!row) throw ApiError.notFound('Card not found');
  // Block deletion when any scenario definition references the card key.
  const scenarios = await prisma.scenario.findMany({ select: { key: true, definition: true } });
  const usedBy = scenarios.find((s) => JSON.stringify(s.definition).includes(`"${cardKey}"`));
  if (usedBy) {
    throw ApiError.conflict(`This card is used by scenario "${usedBy.key}" and cannot be deleted`);
  }
  await prisma.gameCard.delete({ where: { cardKey } });
  return { ok: true, cardKey };
}

/** Resolve a set of card keys to DecisionOption definitions (for embedding). */
export async function cardsByKeys(keys: string[]): Promise<DecisionOption[]> {
  if (keys.length === 0) return [];
  const rows = await prisma.gameCard.findMany({ where: { cardKey: { in: keys } } });
  const byKey = new Map(rows.map((r) => [r.cardKey, r]));
  return keys.map((k) => byKey.get(k)).filter((r): r is GameCardRow => Boolean(r)).map(toDecisionOption);
}

/**
 * Embed a standalone copy of every referenced library card into `scenario.cards`.
 * This snapshots the library at save time so editing a card later does not
 * mutate existing scenarios or running sessions.
 */
export async function embedScenarioCards(def: Scenario): Promise<Scenario> {
  const ids = new Set<string>();
  if (def.deck) {
    def.deck.fixed.forEach((i) => ids.add(i));
    def.deck.pool.forEach((i) => ids.add(i));
  }
  for (const e of def.events) {
    e.hand?.fixed?.forEach((i) => ids.add(i));
    e.hand?.pool?.forEach((i) => ids.add(i));
    (e.options ?? []).forEach((o) => ids.add(o.id));
  }
  if (ids.size === 0) return def;
  const resolved = await cardsByKeys([...ids]);
  const byId = new Map(resolved.map((c) => [c.id, c]));
  const existing = new Map((def.cards ?? []).map((c) => [c.id, c]));
  const merged: DecisionOption[] = [];
  for (const id of ids) {
    const card = byId.get(id) ?? existing.get(id);
    if (card) merged.push(card);
  }
  // Keep any inline/library cards that were not referenced (harmless extras).
  for (const c of def.cards ?? []) if (!byId.has(c.id) && !existing.has(c.id)) merged.push(c);
  return { ...def, cards: merged };
}
