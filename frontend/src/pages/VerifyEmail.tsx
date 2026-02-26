import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { authApi } from '@/api/client'

export function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('No verification token provided.')
      return
    }
    authApi
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error')
        const detail = err?.response?.data?.detail
        setErrorMessage(
          detail === 'VERIFY_USER_ALREADY_VERIFIED'
            ? 'Your email is already verified.'
            : 'The verification link is invalid or has expired.'
        )
      })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-sw-bg">
      <div className="w-full max-w-md card text-center space-y-4">
        {status === 'verifying' && <p className="text-sw-fg-muted">Verifying your email...</p>}
        {status === 'success' && (
          <>
            <h1 className="text-xl font-semibold text-sw-fg">Email verified!</h1>
            <p className="text-sw-fg-muted">Your email address has been verified.</p>
            <Link to="/login" className="btn-primary inline-block">
              Sign in
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-xl font-semibold text-sw-fg">Verification failed</h1>
            <p className="text-sw-err-fg">{errorMessage}</p>
            <Link to="/login" className="btn-secondary inline-block">
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
