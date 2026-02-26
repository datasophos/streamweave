import { useState, useEffect, type FormEvent } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { authApi } from '@/api/client'

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()

  const [tokenValid, setTokenValid] = useState<boolean | null>(null) // null = checking
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validate token on mount by attempting a reset with an empty password.
  // fastapi-users returns RESET_PASSWORD_BAD_TOKEN before it checks the password,
  // so a missing/malformed token surfaces immediately.
  useEffect(() => {
    if (!token) {
      setTokenValid(false)
      return
    }
    authApi
      .resetPassword(token, '\x00') // sentinel: triggers token check, will fail on bad token
      .then(() => setTokenValid(true))
      .catch((err) => {
        const detail = err?.response?.data?.detail
        if (detail === 'RESET_PASSWORD_BAD_TOKEN') {
          setTokenValid(false)
        } else {
          // Any other error (e.g. password too short) means the token itself is valid
          setTokenValid(true)
        }
      })
  }, [token])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      navigate('/login', { state: { message: 'Password reset successful. Please sign in.' } })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Checking token validity
  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sw-bg">
        <p className="text-sw-fg-muted">Checking reset link...</p>
      </div>
    )
  }

  // Token missing or invalid
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sw-bg">
        <div className="card text-center space-y-4 w-full max-w-md">
          <h1 className="text-xl font-semibold text-sw-fg">Invalid reset link</h1>
          <p className="text-sw-fg-muted">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link to="/forgot-password" className="btn-primary inline-block">
            Request new link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sw-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-sw-brand">StreamWeave</h1>
        </div>
        <div className="card">
          <h2 className="text-xl font-semibold text-sw-fg mb-6">Set new password</h2>
          {error != null && (
            <div className="mb-4 rounded-md bg-sw-err-bg border border-sw-err-bd p-4 text-sm text-sw-err-fg">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="label">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="label">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
