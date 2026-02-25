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
    isActive ? 'text-brand-700 bg-brand-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
  }`

function Divider() {
  return <div className="w-px h-4 bg-gray-200 mx-1 shrink-0" aria-hidden="true" />
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
            ? 'text-brand-700 bg-brand-50'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
          className="fixed w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50"
          style={{ top: pos.top, left: pos.left }}
        >
          {adminNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'text-brand-700 bg-brand-50 font-medium'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
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
        ? 'text-brand-700 bg-brand-50'
        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
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
      <div className="fixed top-14 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-40 md:hidden">
        <nav className="px-4 py-3 space-y-0.5">
          <NavLink to="/" end className={mobileLinkClass}>
            Dashboard
          </NavLink>

          {isAdmin && (
            <>
              <div className="pt-2 pb-1 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Admin
              </div>
              {adminNav.map((item) => (
                <NavLink key={item.to} to={item.to} className={mobileLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}

          <div className="pt-2 pb-1 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
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

        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">{user?.email}</p>
            {isAdmin && <p className="text-xs text-brand-700">Administrator</p>}
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Sign out
          </button>
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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-4">
            {/* Brand */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0 mr-1">
              <img src="/logo.svg" alt="" className="h-8 w-auto" />
              <span className="font-semibold text-gray-900 text-[15px] tracking-tight">
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
              <span className="text-sm text-gray-500 max-w-[160px] truncate hidden xl:block">
                {user?.email}
              </span>
              {isAdmin && (
                <span className="text-xs font-medium text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-2 py-0.5 whitespace-nowrap">
                  Admin
                </span>
              )}
              <Divider />
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors whitespace-nowrap"
              >
                Sign out
              </button>
            </div>

            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
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

      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <span className="text-xs text-gray-400 italic">
            StreamWeave — Data harvesting, simplified
          </span>
          <a
            href="https://datasophos.co"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span>Built by</span>
            <img src="/datasophos_wordmark.svg" alt="Datasophos" className="h-7 w-auto" />
          </a>
        </div>
      </footer>
    </div>
  )
}
