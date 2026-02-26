import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/contexts/PreferencesContext'
import { meApi } from '@/api/client'
import type { Language } from '@/contexts/PreferencesContext'

type Tab = 'profile' | 'preferences'

function ToggleGroup<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-sw-border overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-brand-600 text-white'
              : 'bg-sw-surface text-sw-fg-2 hover:bg-sw-hover'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function ProfileSection() {
  const { t } = useTranslation('settings')
  const { user } = useAuth()

  const [emailValue, setEmailValue] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [emailError, setEmailError] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle'
  )
  const [passwordError, setPasswordError] = useState('')

  const handleEmailChange = async () => {
    if (!emailValue.trim()) return
    setEmailStatus('loading')
    setEmailError('')
    try {
      await meApi.update({ email: emailValue.trim() })
      setEmailStatus('success')
      setEmailValue('')
      setTimeout(() => setEmailStatus('idle'), 3000)
    } catch (err: unknown) {
      setEmailStatus('error')
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'detail' in err.response.data
          ? String((err.response.data as { detail: unknown }).detail)
          : t('failed_email')
      setEmailError(msg)
    }
  }

  const handlePasswordChange = async () => {
    if (!newPassword) return
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwords_no_match'))
      setPasswordStatus('error')
      return
    }
    setPasswordStatus('loading')
    setPasswordError('')
    try {
      await meApi.update({ password: newPassword })
      setPasswordStatus('success')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordStatus('idle'), 3000)
    } catch (err: unknown) {
      setPasswordStatus('error')
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'detail' in err.response.data
          ? String((err.response.data as { detail: unknown }).detail)
          : t('failed_password')
      setPasswordError(msg)
    }
  }

  return (
    <div className="space-y-8">
      {/* Account info */}
      <section>
        <h2 className="text-base font-semibold text-sw-fg mb-4">{t('account_info')}</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-lg">
          <div>
            <dt className="text-xs font-medium text-sw-fg-muted uppercase tracking-wider">
              {t('field_email')}
            </dt>
            <dd className="mt-0.5 text-sm text-sw-fg">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-sw-fg-muted uppercase tracking-wider">
              {t('field_role')}
            </dt>
            <dd className="mt-0.5">
              {user?.role === 'admin' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sw-brand-bg text-sw-brand border border-sw-brand-bd">
                  {t('role_admin')}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sw-neut-bg text-sw-neut-fg">
                  {t('role_user')}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-sw-fg-muted uppercase tracking-wider">
              {t('field_verified')}
            </dt>
            <dd className="mt-0.5">
              {user?.is_verified ? (
                <span className="text-sm text-sw-ok-fg">{t('verified_yes')}</span>
              ) : (
                <span className="text-sm text-sw-warn-fg">{t('verified_no')}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-sw-fg-muted uppercase tracking-wider">
              {t('field_account_id')}
            </dt>
            <dd className="mt-0.5 text-sm text-sw-fg-muted font-mono truncate">{user?.id}</dd>
          </div>
        </dl>
      </section>

      {/* Change email */}
      <section className="border-t border-sw-border-sub pt-6">
        <h2 className="text-base font-semibold text-sw-fg mb-1">{t('change_email')}</h2>
        <p className="text-sm text-sw-fg-muted mb-4">{t('change_email_desc')}</p>
        <div className="max-w-sm space-y-3">
          <input
            type="email"
            placeholder={t('new_email_placeholder')}
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEmailChange()}
            className="block w-full rounded-lg border border-sw-border-in bg-sw-surface text-sw-fg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-sw-fg-faint"
          />
          {emailStatus === 'success' && (
            <p className="text-sm text-sw-ok-fg">{t('email_success')}</p>
          )}
          {emailStatus === 'error' && <p className="text-sm text-sw-err-fg">{emailError}</p>}
          <button
            onClick={handleEmailChange}
            disabled={emailStatus === 'loading' || !emailValue.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {emailStatus === 'loading' ? t('updating') : t('update_email')}
          </button>
        </div>
      </section>

      {/* Change password */}
      <section className="border-t border-sw-border-sub pt-6">
        <h2 className="text-base font-semibold text-sw-fg mb-1">{t('change_password')}</h2>
        <p className="text-sm text-sw-fg-muted mb-4">{t('change_password_desc')}</p>
        <div className="max-w-sm space-y-3">
          <input
            type="password"
            placeholder={t('new_password_placeholder')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="block w-full rounded-lg border border-sw-border-in bg-sw-surface text-sw-fg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-sw-fg-faint"
          />
          <input
            type="password"
            placeholder={t('confirm_password_placeholder')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePasswordChange()}
            className="block w-full rounded-lg border border-sw-border-in bg-sw-surface text-sw-fg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-sw-fg-faint"
          />
          {passwordStatus === 'success' && (
            <p className="text-sm text-sw-ok-fg">{t('password_success')}</p>
          )}
          {passwordStatus === 'error' && <p className="text-sm text-sw-err-fg">{passwordError}</p>}
          <button
            onClick={handlePasswordChange}
            disabled={passwordStatus === 'loading' || !newPassword}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {passwordStatus === 'loading' ? t('updating') : t('update_password')}
          </button>
        </div>
      </section>
    </div>
  )
}

function PreferencesSection() {
  const { t } = useTranslation('settings')
  const { preferences, setPreference } = usePreferences()

  const languageOptions: { label: string; value: Language }[] = [
    { label: `🇺🇸 ${t('lang_en')}`, value: 'en' },
    { label: `🇪🇸 ${t('lang_es')}`, value: 'es' },
    { label: `🇫🇷 ${t('lang_fr')}`, value: 'fr' },
    { label: `🇨🇦 ${t('lang_fr_ca')}`, value: 'fr-CA' },
    { label: `🇨🇳 ${t('lang_zh')}`, value: 'zh' },
  ]

  return (
    <div className="space-y-8 max-w-lg">
      <section>
        <h2 className="text-base font-semibold text-sw-fg mb-1">{t('theme')}</h2>
        <p className="text-sm text-sw-fg-muted mb-3">{t('theme_desc')}</p>
        <ToggleGroup
          options={[
            { label: t('theme_light'), value: 'light' },
            { label: t('theme_dark'), value: 'dark' },
            { label: t('theme_system'), value: 'system' },
          ]}
          value={preferences.theme}
          onChange={(v) => setPreference('theme', v)}
        />
      </section>

      <section className="border-t border-sw-border-sub pt-6">
        <h2 className="text-base font-semibold text-sw-fg mb-1">{t('date_format')}</h2>
        <p className="text-sm text-sw-fg-muted mb-3">{t('date_format_desc')}</p>
        <ToggleGroup
          options={[
            { label: t('date_relative'), value: 'relative' },
            { label: t('date_absolute'), value: 'absolute' },
          ]}
          value={preferences.dateFormat}
          onChange={(v) => setPreference('dateFormat', v)}
        />
        <p className="mt-2 text-xs text-sw-fg-faint">
          {preferences.dateFormat === 'relative'
            ? t('date_example_relative')
            : t('date_example_absolute', { date: new Date().toLocaleString() })}
        </p>
      </section>

      <section className="border-t border-sw-border-sub pt-6">
        <h2 className="text-base font-semibold text-sw-fg mb-1">{t('items_per_page')}</h2>
        <p className="text-sm text-sw-fg-muted mb-3">{t('items_per_page_desc')}</p>
        <ToggleGroup
          options={[
            { label: '10', value: 10 as const },
            { label: '25', value: 25 as const },
            { label: '50', value: 50 as const },
          ]}
          value={preferences.itemsPerPage}
          onChange={(v) => setPreference('itemsPerPage', v)}
        />
      </section>

      <section className="border-t border-sw-border-sub pt-6">
        <h2 className="text-base font-semibold text-sw-fg mb-1">{t('language')}</h2>
        <p className="text-sm text-sw-fg-muted mb-3">{t('language_desc')}</p>
        <ToggleGroup
          options={languageOptions}
          value={preferences.language}
          onChange={(v) => setPreference('language', v)}
        />
        <p className="mt-3 text-xs text-sw-fg-muted">
          {t('lang_ai_warning')}{' '}
          <a
            href="https://github.com/datasophos/streamweave/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-sw-fg"
          >
            {t('lang_report_link')}
          </a>
        </p>
      </section>
    </div>
  )
}

export function Settings() {
  const { t } = useTranslation('settings')
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: t('tab_profile') },
    { id: 'preferences', label: t('tab_preferences') },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-sw-fg mb-6">{t('title')}</h1>

      {/* Tab nav */}
      <div className="border-b border-sw-border mb-8">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-600 text-sw-brand'
                  : 'border-transparent text-sw-fg-muted hover:text-sw-fg-2 hover:border-sw-border-in'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'profile' && <ProfileSection />}
      {activeTab === 'preferences' && <PreferencesSection />}
    </div>
  )
}
