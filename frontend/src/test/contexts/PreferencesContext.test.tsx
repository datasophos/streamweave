import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { PreferencesProvider, usePreferences } from '@/contexts/PreferencesContext'
import '@/i18n/config'

// Helper component that exposes context values for assertions
function PrefsDisplay() {
  const { preferences } = usePreferences()
  return (
    <div>
      <span data-testid="theme">{preferences.theme}</span>
      <span data-testid="dateFormat">{preferences.dateFormat}</span>
      <span data-testid="itemsPerPage">{preferences.itemsPerPage}</span>
      <span data-testid="language">{preferences.language}</span>
    </div>
  )
}

// Helper component that exercises setPreference
function PrefsChanger() {
  const { setPreference } = usePreferences()
  return (
    <div>
      <button onClick={() => setPreference('theme', 'dark')}>set dark</button>
      <button onClick={() => setPreference('theme', 'light')}>set light</button>
      <button onClick={() => setPreference('theme', 'system')}>set system</button>
      <button onClick={() => setPreference('dateFormat', 'absolute')}>set absolute</button>
      <button onClick={() => setPreference('itemsPerPage', 50)}>set 50</button>
      <button onClick={() => setPreference('language', 'en')}>set en</button>
      <button onClick={() => setPreference('language', 'es')}>set es</button>
      <button onClick={() => setPreference('language', 'fr')}>set fr</button>
      <button onClick={() => setPreference('language', 'zh')}>set zh</button>
    </div>
  )
}

function renderPrefs() {
  return render(
    <PreferencesProvider>
      <PrefsDisplay />
      <PrefsChanger />
    </PreferencesProvider>
  )
}

describe('PreferencesContext', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
  })

  it('initializes with defaults when localStorage is empty', () => {
    renderPrefs()
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
    expect(screen.getByTestId('dateFormat')).toHaveTextContent('relative')
    expect(screen.getByTestId('itemsPerPage')).toHaveTextContent('25')
    expect(screen.getByTestId('language')).toHaveTextContent('en')
  })

  it('loads saved preferences from localStorage on mount', () => {
    localStorage.setItem(
      'sw_preferences',
      JSON.stringify({ theme: 'dark', dateFormat: 'absolute', itemsPerPage: 10 })
    )
    renderPrefs()
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(screen.getByTestId('dateFormat')).toHaveTextContent('absolute')
    expect(screen.getByTestId('itemsPerPage')).toHaveTextContent('10')
  })

  it('merges partial localStorage values with defaults', () => {
    localStorage.setItem('sw_preferences', JSON.stringify({ theme: 'light' }))
    renderPrefs()
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(screen.getByTestId('dateFormat')).toHaveTextContent('relative')
    expect(screen.getByTestId('itemsPerPage')).toHaveTextContent('25')
  })

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem('sw_preferences', 'not-valid-json{{{')
    renderPrefs()
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
  })

  it('setPreference updates the displayed value', async () => {
    const { user } = { user: { click: (el: HTMLElement) => act(() => el.click()) } }
    renderPrefs()

    await user.click(screen.getByRole('button', { name: 'set absolute' }))
    expect(screen.getByTestId('dateFormat')).toHaveTextContent('absolute')
  })

  it('setPreference persists to localStorage', async () => {
    renderPrefs()
    act(() => screen.getByRole('button', { name: 'set 50' }).click())

    const stored = JSON.parse(localStorage.getItem('sw_preferences') ?? '{}')
    expect(stored.itemsPerPage).toBe(50)
  })

  it('setting theme to dark adds dark class to <html>', () => {
    renderPrefs()
    act(() => screen.getByRole('button', { name: 'set dark' }).click())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('setting theme to light removes dark class from <html>', () => {
    document.documentElement.classList.add('dark')
    renderPrefs()
    act(() => screen.getByRole('button', { name: 'set light' }).click())
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('setting theme to system removes dark class when matchMedia reports light', () => {
    // matchMedia mock returns matches: false (light preference) by default
    document.documentElement.classList.add('dark')
    renderPrefs()
    act(() => screen.getByRole('button', { name: 'set system' }).click())
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('setting theme to system adds dark class when matchMedia reports dark', () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    renderPrefs()
    act(() => screen.getByRole('button', { name: 'set system' }).click())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('applies dark theme on mount when saved preference is dark', () => {
    localStorage.setItem('sw_preferences', JSON.stringify({ theme: 'dark' }))
    renderPrefs()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('fires applyTheme when matchMedia change event fires while theme is system', () => {
    // Capture the handler passed to addEventListener so we can invoke it
    let changeHandler: (() => void) | undefined
    const mqMock = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === 'change') changeHandler = handler
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList
    vi.mocked(window.matchMedia).mockReturnValue(mqMock)

    // Start with system theme (defaults to system)
    renderPrefs()
    expect(changeHandler).toBeDefined()

    // Simulate OS switching to dark — handler calls applyTheme('system') which re-checks matchMedia
    ;(mqMock as { matches: boolean }).matches = true
    act(() => changeHandler!())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes matchMedia listener when theme changes away from system', () => {
    const mqMock = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList
    vi.mocked(window.matchMedia).mockReturnValue(mqMock)

    renderPrefs()

    // Switching away from system triggers the useEffect cleanup
    act(() => screen.getByRole('button', { name: 'set dark' }).click())
    expect(mqMock.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('usePreferences throws when called outside PreferencesProvider', () => {
    function Bare() {
      return <div>{usePreferences().preferences.theme}</div>
    }
    expect(() => render(<Bare />)).toThrow('usePreferences must be used within PreferencesProvider')
  })

  it('initializes language field with default en', () => {
    renderPrefs()
    expect(screen.getByTestId('language')).toHaveTextContent('en')
  })

  it('loads language from localStorage sw_preferences', () => {
    localStorage.setItem('sw_preferences', JSON.stringify({ language: 'en' }))
    renderPrefs()
    expect(screen.getByTestId('language')).toHaveTextContent('en')
  })

  it('setPreference language updates the displayed value', async () => {
    renderPrefs()
    act(() => screen.getByRole('button', { name: 'set en' }).click())
    expect(screen.getByTestId('language')).toHaveTextContent('en')
  })

  it('setPreference language persists to localStorage', async () => {
    renderPrefs()
    act(() => screen.getByRole('button', { name: 'set en' }).click())
    const stored = JSON.parse(localStorage.getItem('sw_preferences') ?? '{}')
    expect(stored.language).toBe('en')
  })

  it('language change writes sw_preferences_lang to localStorage', async () => {
    renderPrefs()
    act(() => screen.getByRole('button', { name: 'set en' }).click())
    expect(localStorage.getItem('sw_preferences_lang')).toBe('en')
  })

  it('setPreference language supports es, fr, zh values', async () => {
    renderPrefs()
    act(() => screen.getByRole('button', { name: 'set es' }).click())
    expect(screen.getByTestId('language')).toHaveTextContent('es')

    act(() => screen.getByRole('button', { name: 'set fr' }).click())
    expect(screen.getByTestId('language')).toHaveTextContent('fr')

    act(() => screen.getByRole('button', { name: 'set zh' }).click())
    expect(screen.getByTestId('language')).toHaveTextContent('zh')
  })

  it('loads language from sw_preferences_lang when stored language is falsy', () => {
    // Simulate: sw_preferences exists but language is empty string (falsy),
    // and the i18next detector has stored a value in sw_preferences_lang
    localStorage.setItem('sw_preferences', JSON.stringify({ theme: 'light', language: '' }))
    localStorage.setItem('sw_preferences_lang', 'en')
    renderPrefs()
    expect(screen.getByTestId('language')).toHaveTextContent('en')
  })
})
