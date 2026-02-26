import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import common_en from './locales/en/common.json'
import nav_en from './locales/en/nav.json'
import dashboard_en from './locales/en/dashboard.json'
import login_en from './locales/en/login.json'
import instruments_en from './locales/en/instruments.json'
import storage_en from './locales/en/storage.json'
import schedules_en from './locales/en/schedules.json'
import hooks_en from './locales/en/hooks.json'
import users_en from './locales/en/users.json'
import files_en from './locales/en/files.json'
import transfers_en from './locales/en/transfers.json'
import request_en from './locales/en/request.json'
import settings_en from './locales/en/settings.json'
import common_es from './locales/es/common.json'
import nav_es from './locales/es/nav.json'
import dashboard_es from './locales/es/dashboard.json'
import login_es from './locales/es/login.json'
import instruments_es from './locales/es/instruments.json'
import storage_es from './locales/es/storage.json'
import schedules_es from './locales/es/schedules.json'
import hooks_es from './locales/es/hooks.json'
import users_es from './locales/es/users.json'
import files_es from './locales/es/files.json'
import transfers_es from './locales/es/transfers.json'
import request_es from './locales/es/request.json'
import settings_es from './locales/es/settings.json'
import common_fr from './locales/fr/common.json'
import nav_fr from './locales/fr/nav.json'
import dashboard_fr from './locales/fr/dashboard.json'
import login_fr from './locales/fr/login.json'
import instruments_fr from './locales/fr/instruments.json'
import storage_fr from './locales/fr/storage.json'
import schedules_fr from './locales/fr/schedules.json'
import hooks_fr from './locales/fr/hooks.json'
import users_fr from './locales/fr/users.json'
import files_fr from './locales/fr/files.json'
import transfers_fr from './locales/fr/transfers.json'
import request_fr from './locales/fr/request.json'
import settings_fr from './locales/fr/settings.json'
import common_zh from './locales/zh/common.json'
import nav_zh from './locales/zh/nav.json'
import dashboard_zh from './locales/zh/dashboard.json'
import login_zh from './locales/zh/login.json'
import instruments_zh from './locales/zh/instruments.json'
import storage_zh from './locales/zh/storage.json'
import schedules_zh from './locales/zh/schedules.json'
import hooks_zh from './locales/zh/hooks.json'
import users_zh from './locales/zh/users.json'
import files_zh from './locales/zh/files.json'
import transfers_zh from './locales/zh/transfers.json'
import request_zh from './locales/zh/request.json'
import settings_zh from './locales/zh/settings.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'sw_preferences_lang',
      caches: ['localStorage'],
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: [
      'common',
      'nav',
      'dashboard',
      'login',
      'instruments',
      'storage',
      'schedules',
      'hooks',
      'users',
      'files',
      'transfers',
      'request',
      'settings',
    ],
    resources: {
      en: {
        common: common_en,
        nav: nav_en,
        dashboard: dashboard_en,
        login: login_en,
        instruments: instruments_en,
        storage: storage_en,
        schedules: schedules_en,
        hooks: hooks_en,
        users: users_en,
        files: files_en,
        transfers: transfers_en,
        request: request_en,
        settings: settings_en,
      },
      es: {
        common: common_es,
        nav: nav_es,
        dashboard: dashboard_es,
        login: login_es,
        instruments: instruments_es,
        storage: storage_es,
        schedules: schedules_es,
        hooks: hooks_es,
        users: users_es,
        files: files_es,
        transfers: transfers_es,
        request: request_es,
        settings: settings_es,
      },
      fr: {
        common: common_fr,
        nav: nav_fr,
        dashboard: dashboard_fr,
        login: login_fr,
        instruments: instruments_fr,
        storage: storage_fr,
        schedules: schedules_fr,
        hooks: hooks_fr,
        users: users_fr,
        files: files_fr,
        transfers: transfers_fr,
        request: request_fr,
        settings: settings_fr,
      },
      zh: {
        common: common_zh,
        nav: nav_zh,
        dashboard: dashboard_zh,
        login: login_zh,
        instruments: instruments_zh,
        storage: storage_zh,
        schedules: schedules_zh,
        hooks: hooks_zh,
        users: users_zh,
        files: files_zh,
        transfers: transfers_zh,
        request: request_zh,
        settings: settings_zh,
      },
    },
    interpolation: { escapeValue: false },
  })

export default i18n
