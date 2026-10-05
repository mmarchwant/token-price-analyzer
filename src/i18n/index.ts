import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import advisorEn from './locales/en/advisor.json';
import budgetEn from './locales/en/budget.json';
import commonEn from './locales/en/common.json';
import compareEn from './locales/en/compare.json';
import explorerEn from './locales/en/explorer.json';
import historyEn from './locales/en/history.json';
import profilesEn from './locales/en/profiles.json';
import sourcesEn from './locales/en/sources.json';
import subscriptionsEn from './locales/en/subscriptions.json';

import advisorPl from './locales/pl/advisor.json';
import budgetPl from './locales/pl/budget.json';
import commonPl from './locales/pl/common.json';
import comparePl from './locales/pl/compare.json';
import explorerPl from './locales/pl/explorer.json';
import historyPl from './locales/pl/history.json';
import profilesPl from './locales/pl/profiles.json';
import sourcesPl from './locales/pl/sources.json';
import subscriptionsPl from './locales/pl/subscriptions.json';

export const defaultNS = 'common';
export const resources = {
  en: {
    common: commonEn,
    advisor: advisorEn,
    explorer: explorerEn,
    budget: budgetEn,
    subscriptions: subscriptionsEn,
    compare: compareEn,
    history: historyEn,
    profiles: profilesEn,
    sources: sourcesEn,
  },
  pl: {
    common: commonPl,
    advisor: advisorPl,
    explorer: explorerPl,
    budget: budgetPl,
    subscriptions: subscriptionsPl,
    compare: comparePl,
    history: historyPl,
    profiles: profilesPl,
    sources: sourcesPl,
  },
} as const;

const updateHtmlLang = (lang: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'pl'],
    defaultNS,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'tpa-lang',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

updateHtmlLang(i18n.language || 'en');

i18n.on('languageChanged', (lang) => {
  updateHtmlLang(lang);
});

export default i18n;
