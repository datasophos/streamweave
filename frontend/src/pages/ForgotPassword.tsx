import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/api/client'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sw-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-sw-brand">StreamWeave</h1>
        </div>
        <div className="card">
          <h2 className="text-xl font-semibold text-sw-fg mb-6">Reset password</h2>
          {submitted ? (
            <div className="space-y-4 text-center">
              <p className="text-sw-fg-muted">
                If an account exists for <strong>{email}</strong>, you will receive a password reset
                email shortly.
              </p>
              <Link to="/login" className="btn-secondary inline-block">
                Back to login
              </Link>
            </div>
          ) : (
            <>
              {error != null && (
                <div className="mb-4 rounded-md bg-sw-err-bg border border-sw-err-bd p-4 text-sm text-sw-err-fg">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="label">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="you@example.com"
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
              <p className="mt-4 text-sm text-center text-sw-fg-muted">
                <Link to="/login" className="text-brand-600 hover:underline">
                  Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
