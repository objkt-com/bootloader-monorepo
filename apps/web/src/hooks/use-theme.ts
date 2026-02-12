import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark' | 'system'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as Theme | null
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
      // Default to system if not set
      return 'system'
    }
    return 'system'
  })

  // Track the system preference separately
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  })

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')

    // Determine effective theme
    const effectiveTheme = theme === 'system' ? systemTheme : theme
    root.classList.add(effectiveTheme)
    localStorage.setItem('theme', theme)
  }, [theme, systemTheme])

  const toggle = () => {
    const effectiveTheme = theme === 'system' ? systemTheme : theme
    setTheme(effectiveTheme === 'light' ? 'dark' : 'light')
  }

  return {
    theme,
    setTheme,
    systemTheme,
    // Effective theme (resolved system to actual value)
    effectiveTheme: theme === 'system' ? systemTheme : theme,
    toggle,
  }
}
