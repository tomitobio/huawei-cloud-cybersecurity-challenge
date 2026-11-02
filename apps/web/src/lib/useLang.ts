import { useTranslation } from 'react-i18next';
import type { LocalizedText } from '@hcc/shared';

export function useLang() {
  const { i18n } = useTranslation();
  const lang: 'es' | 'en' = i18n.language === 'en' ? 'en' : 'es';
  const lt = (text?: LocalizedText | null): string => (text ? text[lang] ?? text.es ?? text.en ?? '' : '');
  return { lang, lt };
}
