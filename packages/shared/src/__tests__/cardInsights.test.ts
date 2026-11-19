import { describe, it, expect } from 'vitest';
import { CARD_LIBRARY } from '../scenarios/cards';
import { findCardDuplicates, classifyArchetype } from '../cardInsights';
import { requiresCardsMet, unlockedCardIds } from '../engine';
import type { GameStateData, Scenario } from '../types';

const library = Object.values(CARD_LIBRARY);

describe('unlock tree (CARD_TREE) is applied to the library', () => {
  it('roots declare what they unlock', () => {
    expect(CARD_LIBRARY['waf-enable']!.unlocksCards).toEqual(
      expect.arrayContaining(['waf-tune', 'waf-injection', 'waf-anti-bot', 'waf-monitor']),
    );
    expect(CARD_LIBRARY['hss-enable']!.unlocksCards).toEqual(
      expect.arrayContaining(['hss-investigate', 'hss-patch', 'hss-baseline']),
    );
    expect(CARD_LIBRARY['backup-verify']!.unlocksCards).toEqual(['restore-clean']);
  });

  it('children require their parent (including a second tier)', () => {
    expect(CARD_LIBRARY['waf-tune']!.requiresCards).toEqual(['waf-enable']);
    expect(CARD_LIBRARY['restore-clean']!.requiresCards).toEqual(['backup-verify']);
  });

  it('level-2 cards require the service AND a level-1 card of the same service', () => {
    expect(CARD_LIBRARY['waf-web-tampering']!.requiresCards).toEqual(['waf-enable', 'waf-injection']);
    expect(CARD_LIBRARY['hss-isolate']!.requiresCards).toEqual(['hss-enable', 'hss-investigate']);
    expect(CARD_LIBRARY['cbh-revoke']!.requiresCards).toEqual(['cbh-enable', 'cbh-audit']);
    expect(CARD_LIBRARY['dew-keys']!.requiresCards).toEqual(['dew-enable', 'dew-encrypt']);
    // and the level-1 card unlocks it so it can surface in later hands
    expect(CARD_LIBRARY['waf-injection']!.unlocksCards).toEqual(['waf-web-tampering']);
  });

  it('requiresCardsMet gates a child until its parent is purchased', () => {
    const child = CARD_LIBRARY['waf-tune']!;
    const empty = { purchasedCards: [] } as unknown as GameStateData;
    const withParent = { purchasedCards: ['waf-enable'] } as unknown as GameStateData;
    expect(requiresCardsMet(child, empty)).toBe(false);
    expect(requiresCardsMet(child, withParent)).toBe(true);
  });

  it('unlockedCardIds surfaces children once the parent is owned', () => {
    const scenario = { cards: library } as unknown as Scenario;
    const state = { purchasedCards: ['waf-enable'] } as unknown as GameStateData;
    expect(unlockedCardIds(scenario, state)).toEqual(
      expect.arrayContaining(['waf-tune', 'waf-injection', 'waf-anti-bot', 'waf-monitor']),
    );
  });
});

describe('classifyArchetype', () => {
  it('derives a visible "shape" per card', () => {
    expect(classifyArchetype(CARD_LIBRARY['svc-waf']!)).toBe('service');
    expect(classifyArchetype(CARD_LIBRARY['waf-enable']!)).toBe('foundation');
    expect(classifyArchetype(CARD_LIBRARY['waf-block-bad']!)).toBe('risk');
    expect(classifyArchetype(CARD_LIBRARY['inv-host']!)).toBe('investigation');
    expect(classifyArchetype(CARD_LIBRARY['backup-verify']!)).toBe('recovery');
  });
});

describe('findCardDuplicates', () => {
  const groups = findCardDuplicates(
    library.map((c) => ({
      id: c.id,
      label: c.label,
      tags: c.tags,
      controls: c.controls,
      kind: c.kind,
      scoreDelta: c.scoreDelta,
      serviceCard: c.serviceCard,
      cost: c.cost,
    })),
  );

  const hasPair = (a: string, b: string) =>
    groups.some((g) => g.ids.includes(a) && g.ids.includes(b));

  it('flags the svc vs -enable service pairs', () => {
    expect(hasPair('svc-waf', 'waf-enable')).toBe(true);
    expect(hasPair('svc-hss', 'hss-enable')).toBe(true);
    expect(hasPair('svc-cfw', 'cfw-enable')).toBe(true);
    expect(hasPair('svc-dew', 'dew-enable')).toBe(true);
    expect(hasPair('svc-cbh', 'cbh-enable')).toBe(true);
    expect(hasPair('svc-secmaster', 'secmaster-enable')).toBe(true);
  });

  it('does not merge separate service families into one giant cluster', () => {
    for (const g of groups) {
      const hasWaf = g.ids.some((id) => id.startsWith('waf') || id === 'svc-waf');
      const hasCfw = g.ids.some((id) => id.startsWith('cfw') || id === 'svc-cfw');
      expect(hasWaf && hasCfw).toBe(false);
    }
  });
});
