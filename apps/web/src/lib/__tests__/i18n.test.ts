// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import i18n, { currentLang, setLang } from '../i18n';

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === 'object' && !Array.isArray(v)
      ? collectKeys(v as Record<string, unknown>, key)
      : [key];
  });
}

describe('i18n', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es');
  });

  it('ships the same key set in Spanish and English', () => {
    const es = collectKeys(i18n.getResourceBundle('es', 'translation'));
    const en = collectKeys(i18n.getResourceBundle('en', 'translation'));
    const missingInEn = es.filter((k) => !en.includes(k));
    const missingInEs = en.filter((k) => !es.includes(k));
    expect(missingInEn).toEqual([]);
    expect(missingInEs).toEqual([]);
  });

  it('translates the same key differently per language', () => {
    expect(i18n.t('common.save')).toBe('Guardar');
    expect(i18n.t('common.save', { lng: 'en' })).toBe('Save');
  });

  it('reports and switches the current language, persisting the choice', async () => {
    setLang('en');
    expect(currentLang()).toBe('en');
    expect(localStorage.getItem('hcc_lang')).toBe('en');
    setLang('es');
    expect(currentLang()).toBe('es');
    expect(localStorage.getItem('hcc_lang')).toBe('es');
  });

  it('treats unknown languages as Spanish (fallback)', async () => {
    await i18n.changeLanguage('fr');
    expect(currentLang()).toBe('es');
  });
});
