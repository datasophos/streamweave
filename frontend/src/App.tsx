import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/layouts/AppLayout'
import { Login } from '@/pages/Login'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { ResetPassword } from '@/pages/ResetPassword'
import { VerifyEmail } from '@/pages/VerifyEmail'
import { Dashboard } from '@/pages/Dashboard'
import { Instruments } from '@/pages/admin/Instruments'
import { Storage } from '@/pages/admin/Storage'
import { Schedules } from '@/pages/admin/Schedules'
import { Hooks } from '@/pages/admin/Hooks'
import { Users } from '@/pages/admin/Users'
import { MyFiles } from '@/pages/user/MyFiles'
import { Transfers } from '@/pages/user/Transfers'
import { InstrumentRequest } from '@/pages/user/InstrumentRequest'
import { Settings } from '@/pages/user/Settings'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-brand-600" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }

  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />

        {/* Admin-only routes */}
        <Route
          path="/admin/instruments"
          element={
            <RequireAdmin>
              <Instruments />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/storage"
          element={
            <RequireAdmin>
              <Storage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/schedules"
          element={
            <RequireAdmin>
              <Schedules />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/hooks"
          element={
            <RequireAdmin>
              <Hooks />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAdmin>
              <Users />
            </RequireAdmin>
          }
        />

        {/* User routes */}
        <Route path="/files" element={<MyFiles />} />
        <Route path="/transfers" element={<Transfers />} />
        <Route path="/request" element={<InstrumentRequest />} />
        <Route path="/settings" element={<Settings />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
