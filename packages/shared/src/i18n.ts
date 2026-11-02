import type { Lang, LocalizedText } from './types';

/** Resolve a localized text value, falling back gracefully. */
export function t(text: LocalizedText | undefined | null, lang: Lang): string {
  if (!text) return '';
  return text[lang] ?? text.es ?? text.en ?? '';
}

/** Resolve a list of localized texts. */
export function tList(items: LocalizedText[] | undefined, lang: Lang): string[] {
  if (!items) return [];
  return items.map((i) => t(i, lang));
}
