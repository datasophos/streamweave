import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, useSearchParams, Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/contexts/PreferencesContext'
import type { Language } from '@/contexts/PreferencesContext'

const LANGUAGE_OPTIONS: { value: Language; flag: string; label: string }[] = [
  { value: 'en', flag: '🇺🇸', label: 'English' },
  { value: 'es', flag: '🇪🇸', label: 'Español' },
  { value: 'fr', flag: '🇫🇷', label: 'Français' },
  { value: 'fr-CA', flag: '🇨🇦', label: 'Français (CA)' },
  { value: 'zh', flag: '🇨🇳', label: '中文' },
]

export function Login() {
  const { t } = useTranslation('login')
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const from = (location.state as { from?: string })?.from ?? searchParams.get('next') ?? '/'
  const { preferences, setPreference } = usePreferences()

  const [email, setEmail] = useState(import.meta.env.VITE_ADMIN_EMAIL ?? '')
  const [password, setPassword] = useState(import.meta.env.VITE_ADMIN_PASSWORD ?? '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Redirect already-authenticated users — after all hooks
  if (!isLoading && isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail === 'LOGIN_BAD_CREDENTIALS' ? t('bad_credentials') : t('invalid_credentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sw-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-sw-brand">{t('title')}</h1>
          <p className="mt-2 text-sm text-sw-fg-muted">{t('subtitle')}</p>
        </div>
        <div className="card">
          <h2 className="text-xl font-semibold text-sw-fg mb-6">{t('sign_in')}</h2>
          {error != null && (
            <div className="mb-4 rounded-md bg-sw-err-bg border border-sw-err-bd p-4 text-sm text-sw-err-fg">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">
                {t('email')}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="label">
                {t('password')}
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? t('signing_in') : t('sign_in')}
            </button>
          </form>
          <p className="mt-4 text-sm text-center text-sw-fg-muted">
            <Link to="/forgot-password" className="text-brand-600 hover:underline">
              Forgot password?
            </Link>
          </p>
        </div>

        {/* Language chooser */}
        <div className="mt-6 flex justify-center gap-1" role="group" aria-label="Language">
          {LANGUAGE_OPTIONS.map(({ value, flag, label }) => (
            <button
              key={value}
              onClick={() => setPreference('language', value)}
              title={label}
              aria-label={label}
              aria-pressed={preferences.language === value}
              className={`px-2.5 py-1.5 rounded-md text-base leading-none transition-colors ${
                preferences.language === value
                  ? 'bg-brand-600 text-white'
                  : 'text-sw-fg-faint hover:text-sw-fg hover:bg-sw-hover'
              }`}
            >
              {flag}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
