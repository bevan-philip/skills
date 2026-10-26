import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Runs in <head> before paint so the page never flashes the wrong theme.
export const themeScript = `(() => {
  let t = null
  try { t = localStorage.getItem('boundary-theme') } catch {}
  const dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', dark)
})()`

function read(): 'light' | 'dark' {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = React.useState(read)
  React.useEffect(() => {
    const obs = new MutationObserver(() => setTheme(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

export function ThemeToggle() {
  const theme = useTheme()
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Toggle theme"
      onClick={() => {
        const next = theme === 'dark' ? 'light' : 'dark'
        document.documentElement.classList.toggle('dark', next === 'dark')
        try {
          localStorage.setItem('boundary-theme', next)
        } catch {}
      }}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
