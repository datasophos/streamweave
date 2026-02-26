import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const adminNav = [
  { to: '/admin/instruments', label: 'Instruments' },
  { to: '/admin/storage', label: 'Storage' },
  { to: '/admin/schedules', label: 'Schedules' },
  { to: '/admin/hooks', label: 'Hooks' },
  { to: '/admin/users', label: 'Users' },
]

const userNav = [
  { to: '/files', label: 'My Files' },
  { to: '/transfers', label: 'Transfers' },
]

const requestNav = { to: '/request', label: 'Request Instrument' }

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-2.5 py-1.5 text-sm font-medium rounded transition-colors whitespace-nowrap ${
    isActive
      ? 'text-sw-brand bg-sw-brand-bg'
      : 'text-sw-fg-muted hover:text-sw-fg hover:bg-sw-hover'
  }`

function Divider() {
  return <div className="w-px h-4 bg-sw-border mx-1 shrink-0" aria-hidden="true" />
}

function AdminDropdown() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const isActive = adminNav.some((item) => location.pathname.startsWith(item.to))

  const openDropdown = () => {
    if (buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(true)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      )
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        aria-haspopup="true"
        aria-expanded={open}
        className={`flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium rounded transition-colors whitespace-nowrap ${
          isActive
            ? 'text-sw-brand bg-sw-brand-bg'
            : 'text-sw-fg-muted hover:text-sw-fg hover:bg-sw-hover'
        }`}
      >
        Admin
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M4.5 6.5l3.5 3.5 3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="fixed w-44 bg-sw-surface border border-sw-border rounded-lg shadow-lg py-1 z-50"
          style={{ top: pos.top, left: pos.left }}
        >
          {adminNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'text-sw-brand bg-sw-brand-bg font-medium'
                    : 'text-sw-fg-2 hover:bg-sw-hover hover:text-sw-fg'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </>
  )
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 text-sm font-medium rounded transition-colors ${
      isActive
        ? 'text-sw-brand bg-sw-brand-bg'
        : 'text-sw-fg-muted hover:bg-sw-hover hover:text-sw-fg'
    }`

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-30 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed top-14 left-0 right-0 bg-sw-surface border-b border-sw-border shadow-lg z-40 md:hidden">
        <nav className="px-4 py-3 space-y-0.5">
          <NavLink to="/" end className={mobileLinkClass}>
            Dashboard
          </NavLink>

          {isAdmin && (
            <>
              <div className="pt-2 pb-1 px-3 text-xs font-semibold text-sw-fg-faint uppercase tracking-wider">
                Admin
              </div>
              {adminNav.map((item) => (
                <NavLink key={item.to} to={item.to} className={mobileLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}

          <div className="pt-2 pb-1 px-3 text-xs font-semibold text-sw-fg-faint uppercase tracking-wider">
            {isAdmin ? 'Browse' : 'My Work'}
          </div>
          {userNav.map((item) => (
            <NavLink key={item.to} to={item.to} className={mobileLinkClass}>
              {item.label}
            </NavLink>
          ))}
          {!isAdmin && (
            <NavLink to={requestNav.to} className={mobileLinkClass}>
              {requestNav.label}
            </NavLink>
          )}
        </nav>

        <div className="px-4 py-3 border-t border-sw-border-sub">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-sw-fg">{user?.email}</p>
              {isAdmin && <p className="text-xs text-sw-brand">Administrator</p>}
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-sw-fg-muted hover:text-sw-fg transition-colors"
            >
              Sign out
            </button>
          </div>
          <NavLink to="/settings" className={mobileLinkClass}>
            Settings
          </NavLink>
        </div>
      </div>
    </>
  )
}

export function AppLayout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-sw-bg">
      <header className="bg-sw-surface border-b border-sw-border shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-4">
            {/* Brand */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0 mr-1">
              <img src="/logo.svg" alt="" className="h-8 w-auto" />
              <span className="font-semibold text-sw-fg text-[15px] tracking-tight">
                StreamWeave
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-0 flex-1">
              <Divider />
              <nav className="flex items-center gap-0.5">
                <NavLink to="/" end className={linkClass}>
                  Dashboard
                </NavLink>

                {isAdmin && (
                  <>
                    <Divider />
                    <AdminDropdown />
                  </>
                )}

                <Divider />
                {userNav.map((item) => (
                  <NavLink key={item.to} to={item.to} className={linkClass}>
                    {item.label}
                  </NavLink>
                ))}
                {!isAdmin && (
                  <NavLink to={requestNav.to} className={linkClass}>
                    {requestNav.label}
                  </NavLink>
                )}
              </nav>
            </div>

            {/* Spacer on mobile */}
            <div className="flex-1 md:hidden" />

            {/* Desktop user area */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <span className="text-sm text-sw-fg-muted max-w-[160px] truncate hidden xl:block">
                {user?.email}
              </span>
              {isAdmin && (
                <span className="text-xs font-medium text-sw-brand bg-sw-brand-bg border border-sw-brand-bd rounded-full px-2 py-0.5 whitespace-nowrap">
                  Admin
                </span>
              )}
              <Divider />
              <NavLink to="/settings" className={linkClass}>
                <svg
                  className="w-4 h-4 inline-block mr-1 -mt-0.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </svg>
                Settings
              </NavLink>
              <Divider />
              <button
                onClick={handleLogout}
                className="text-sm text-sw-fg-muted hover:text-sw-fg transition-colors whitespace-nowrap"
              >
                Sign out
              </button>
            </div>

            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2 rounded text-sw-fg-muted hover:text-sw-fg hover:bg-sw-hover transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    d="M3 5h14M3 10h14M3 15h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && <MobileMenu onClose={() => setMobileOpen(false)} />}

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>

      <footer className="bg-sw-surface border-t border-sw-border py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <span className="text-xs text-sw-fg-faint">
            StreamWeave — <span className="italic">Scientific data harvesting, simplified</span>
          </span>
          <a
            href="https://datasophos.co"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-sw-fg-faint hover:text-sw-fg-muted transition-colors"
          >
            <span>Built for</span>
            <span className="text-lg leading-none">👩‍🔬</span>
            <span>by</span>
            <img src="/datasophos_wordmark.svg" alt="Datasophos" className="h-7 w-auto" />
          </a>
        </div>
      </footer>
    </div>
  )
}
