import { CARD_ARCHETYPES, type CardArchetype } from '@hcc/shared';

/**
 * Tailwind class strings per archetype tone. Kept literal so the JIT compiler
 * picks them up. Used to give every card an at-a-glance "shape" (colour + glyph).
 */
const ARCHETYPE_CLASSES: Record<string, string> = {
  cyan: 'border-accent-cyan/40 text-accent-cyan',
  sky: 'border-sky-400/40 text-sky-300',
  violet: 'border-violet-400/40 text-violet-300',
  rose: 'border-rose-400/40 text-rose-300',
  emerald: 'border-accent-emerald/40 text-accent-emerald',
  teal: 'border-teal-400/40 text-teal-300',
  amber: 'border-accent-amber/40 text-accent-amber',
  orange: 'border-orange-400/40 text-orange-300',
  indigo: 'border-indigo-400/40 text-indigo-300',
  slate: 'border-base-600 text-slate-400',
};

export function archetypeBadge(key: CardArchetype) {
  const info = CARD_ARCHETYPES[key];
  return { info, cls: ARCHETYPE_CLASSES[info.tone] ?? ARCHETYPE_CLASSES.slate! };
}
