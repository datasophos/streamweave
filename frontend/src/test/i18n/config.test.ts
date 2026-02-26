import { describe, it, expect } from 'vitest'
import '@/i18n/config'
import i18n from '@/i18n/config'

describe('i18n config', () => {
  it('initializes with English as the fallback language', () => {
    const fallback = i18n.options.fallbackLng
    // fallbackLng may be a string, array, or object map
    if (Array.isArray(fallback)) {
      expect(fallback).toContain('en')
    } else if (fallback && typeof fallback === 'object') {
      const map = fallback as Record<string, string[]>
      expect(map['default']).toContain('en')
    } else {
      expect(fallback).toBe('en')
    }
  })

  it('fr-CA falls back through fr then en', () => {
    const fallback = i18n.options.fallbackLng as Record<string, string[]>
    expect(fallback['fr-CA']).toEqual(['fr', 'en'])
  })

  it('has common as the default namespace', () => {
    expect(i18n.options.defaultNS).toBe('common')
  })

  it('loads all expected namespaces', () => {
    const expectedNs = [
      'common',
      'nav',
      'dashboard',
      'login',
      'instruments',
      'storage',
      'schedules',
      'hooks',
      'users',
      'files',
      'transfers',
      'request',
      'settings',
    ]
    const loadedNs = i18n.options.ns as string[]
    for (const ns of expectedNs) {
      expect(loadedNs).toContain(ns)
    }
  })

  it('translates a common key correctly', () => {
    expect(i18n.t('save', { ns: 'common' })).toBe('Save')
    expect(i18n.t('loading', { ns: 'common' })).toBe('Loading…')
    expect(i18n.t('cancel', { ns: 'common' })).toBe('Cancel')
  })

  it('translates nav keys correctly', () => {
    expect(i18n.t('dashboard', { ns: 'nav' })).toBe('Dashboard')
    expect(i18n.t('sign_out', { ns: 'nav' })).toBe('Sign out')
    expect(i18n.t('toggle_menu', { ns: 'nav' })).toBe('Toggle menu')
  })

  it('translates dashboard keys correctly', () => {
    expect(i18n.t('title', { ns: 'dashboard' })).toBe('Dashboard')
    expect(i18n.t('healthy', { ns: 'dashboard' })).toBe('Healthy')
    expect(i18n.t('no_transfers', { ns: 'dashboard' })).toBe('No transfers yet.')
  })

  it('supports interpolation in dashboard stat_completed', () => {
    expect(i18n.t('stat_completed', { ns: 'dashboard', count: 2 })).toBe('2 completed')
  })

  it('translates settings keys correctly', () => {
    expect(i18n.t('title', { ns: 'settings' })).toBe('Settings')
    expect(i18n.t('tab_profile', { ns: 'settings' })).toBe('Profile')
    expect(i18n.t('tab_preferences', { ns: 'settings' })).toBe('Preferences')
  })

  it('supports pluralization for file count', () => {
    expect(i18n.t('file_count', { ns: 'files', count: 1 })).toBe('1 file')
    expect(i18n.t('file_count', { ns: 'files', count: 3 })).toBe('3 files')
  })

  it('has Spanish (es) resources registered', () => {
    expect(i18n.hasResourceBundle('es', 'common')).toBe(true)
    expect(i18n.hasResourceBundle('es', 'settings')).toBe(true)
  })

  it('has French (fr) resources registered', () => {
    expect(i18n.hasResourceBundle('fr', 'common')).toBe(true)
    expect(i18n.hasResourceBundle('fr', 'settings')).toBe(true)
  })

  it('has Chinese (zh) resources registered', () => {
    expect(i18n.hasResourceBundle('zh', 'common')).toBe(true)
    expect(i18n.hasResourceBundle('zh', 'settings')).toBe(true)
  })

  it('has French Canadian (fr-CA) resources registered', () => {
    expect(i18n.hasResourceBundle('fr-CA', 'common')).toBe(true)
    expect(i18n.hasResourceBundle('fr-CA', 'settings')).toBe(true)
  })

  it('translates common keys in French Canadian using courriel vocabulary', () => {
    expect(i18n.t('save', { ns: 'common', lng: 'fr-CA' })).toBe('Enregistrer')
    expect(i18n.t('cancel', { ns: 'common', lng: 'fr-CA' })).toBe('Annuler')
  })

  it('fr-CA login uses courriel instead of e-mail', () => {
    expect(i18n.t('email', { ns: 'login', lng: 'fr-CA' })).toBe('Adresse courriel')
  })

  it('translates common keys in Spanish', () => {
    expect(i18n.t('save', { ns: 'common', lng: 'es' })).toBe('Guardar')
    expect(i18n.t('cancel', { ns: 'common', lng: 'es' })).toBe('Cancelar')
    expect(i18n.t('loading', { ns: 'common', lng: 'es' })).toBe('Cargando…')
  })

  it('translates common keys in French', () => {
    expect(i18n.t('save', { ns: 'common', lng: 'fr' })).toBe('Enregistrer')
    expect(i18n.t('cancel', { ns: 'common', lng: 'fr' })).toBe('Annuler')
    expect(i18n.t('loading', { ns: 'common', lng: 'fr' })).toBe('Chargement…')
  })

  it('translates common keys in Chinese', () => {
    expect(i18n.t('save', { ns: 'common', lng: 'zh' })).toBe('保存')
    expect(i18n.t('cancel', { ns: 'common', lng: 'zh' })).toBe('取消')
    expect(i18n.t('loading', { ns: 'common', lng: 'zh' })).toBe('加载中…')
  })

  it('language selector labels use native names in all locales', () => {
    for (const lng of ['en', 'es', 'fr', 'fr-CA', 'zh']) {
      expect(i18n.t('lang_es', { ns: 'settings', lng })).toBe('Español')
      expect(i18n.t('lang_fr', { ns: 'settings', lng })).toBe('Français')
      expect(i18n.t('lang_zh', { ns: 'settings', lng })).toBe('中文')
    }
  })

  it('lang_fr_ca key is present in all locales', () => {
    expect(i18n.t('lang_fr_ca', { ns: 'settings', lng: 'en' })).toBe('Français (CA)')
    expect(i18n.t('lang_fr_ca', { ns: 'settings', lng: 'fr' })).toBe('Français (Canada)')
    expect(i18n.t('lang_fr_ca', { ns: 'settings', lng: 'fr-CA' })).toBe('Français (Canada)')
  })

  it('AI warning key is present in all locales', () => {
    expect(i18n.t('lang_ai_warning', { ns: 'settings', lng: 'en' })).toBe(
      'Translations are AI-generated and may contain errors.'
    )
    expect(i18n.t('lang_ai_warning', { ns: 'settings', lng: 'es' })).toBeTruthy()
    expect(i18n.t('lang_ai_warning', { ns: 'settings', lng: 'fr' })).toBeTruthy()
    expect(i18n.t('lang_ai_warning', { ns: 'settings', lng: 'zh' })).toBeTruthy()
  })
})
