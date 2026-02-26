import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import i18next from 'i18next'

type DateFormat = 'relative' | 'absolute'
type Theme = 'light' | 'dark' | 'system'
export type Language = 'en' | 'es' | 'fr' | 'zh'

export interface Preferences {
  theme: Theme
  dateFormat: DateFormat
  itemsPerPage: 10 | 25 | 50
  language: Language
}

interface PreferencesContextValue {
  preferences: Preferences
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
}

const STORAGE_KEY = 'sw_preferences'
const LANG_KEY = 'sw_preferences_lang'

const defaults: Preferences = {
  theme: 'system',
  dateFormat: 'relative',
  itemsPerPage: 25,
  language: 'en',
}

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const stored = raw ? { ...defaults, ...JSON.parse(raw) } : defaults
    // Sync language from the detector's key if not yet in sw_preferences
    const detectedLang = localStorage.getItem(LANG_KEY)
    if (detectedLang && !stored.language) {
      stored.language = detectedLang as Language
    }
    return stored
  } catch {
    // ignore
  }
  return defaults
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  if (theme === 'dark') {
    html.classList.add('dark')
  } else if (theme === 'light') {
    html.classList.remove('dark')
  } else {
    // system
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences)

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    applyTheme(preferences.theme)
  }, [preferences.theme])

  // Listen for system theme changes when theme is 'system'
  useEffect(() => {
    if (preferences.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [preferences.theme])

  // Sync language preference with i18next and localStorage detector key
  useEffect(() => {
    void i18next.changeLanguage(preferences.language)
    localStorage.setItem(LANG_KEY, preferences.language)
  }, [preferences.language])

  const setPreference = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPreferences((prev) => {
        const next = { ...prev, [key]: value }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return next
      })
    },
    []
  )

  return (
    <PreferencesContext.Provider value={{ preferences, setPreference }}>
      {children}
    </PreferencesContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider')
  return ctx
}
