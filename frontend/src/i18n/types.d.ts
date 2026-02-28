import type common from './locales/en/common.json'
import type nav from './locales/en/nav.json'
import type dashboard from './locales/en/dashboard.json'
import type login from './locales/en/login.json'
import type instruments from './locales/en/instruments.json'
import type storage from './locales/en/storage.json'
import type schedules from './locales/en/schedules.json'
import type hooks from './locales/en/hooks.json'
import type users from './locales/en/users.json'
import type files from './locales/en/files.json'
import type transfers from './locales/en/transfers.json'
import type request from './locales/en/request.json'
import type settings from './locales/en/settings.json'
import type groups from './locales/en/groups.json'
import type projects from './locales/en/projects.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof common
      nav: typeof nav
      dashboard: typeof dashboard
      login: typeof login
      instruments: typeof instruments
      storage: typeof storage
      schedules: typeof schedules
      hooks: typeof hooks
      users: typeof users
      files: typeof files
      transfers: typeof transfers
      request: typeof request
      settings: typeof settings
      groups: typeof groups
      projects: typeof projects
    }
  }
}
