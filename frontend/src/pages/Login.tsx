import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { ErrorMessage } from '@/components/ErrorMessage'

export function Login() {
  const { t } = useTranslation('login')
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from ?? '/'

  const [email, setEmail] = useState(import.meta.env.VITE_ADMIN_EMAIL ?? '')
  const [password, setPassword] = useState(import.meta.env.VITE_ADMIN_PASSWORD ?? '')
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err)
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
            <div className="mb-4">
              <ErrorMessage error={error} fallback={t('invalid_credentials')} />
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
        </div>
      </div>
    </div>
  )
}
