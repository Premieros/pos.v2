import { useEffect, useState } from 'react'

export type ShellLocale = 'ar' | 'en'

const LOCALE_KEY = 'pos.v2.shell.locale'
const COLLAPSED_KEY = 'pos.v2.shell.collapsed'

export function useShellPreferences() {
  const [locale, setLocaleState] = useState<ShellLocale>(() => localStorage.getItem(LOCALE_KEY) === 'en' ? 'en' : 'ar')
  const [collapsed, setCollapsedState] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1')
  const [mobileOpen, setMobileOpen] = useState(false)

  const setLocale = (next: ShellLocale) => {
    setLocaleState(next)
    localStorage.setItem(LOCALE_KEY, next)
  }

  const setCollapsed = (next: boolean) => {
    setCollapsedState(next)
    localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
  }

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth > 1020) setMobileOpen(false)
    }
    window.addEventListener('resize', closeOnDesktop)
    return () => window.removeEventListener('resize', closeOnDesktop)
  }, [])

  return {
    locale,
    dir: locale === 'ar' ? 'rtl' as const : 'ltr' as const,
    collapsed,
    mobileOpen,
    setLocale,
    setCollapsed,
    setMobileOpen,
  }
}
