import { Moon, Sun } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/hooks/useTheme'
import { Separator } from '@/components/ui/separator'

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure PageHound to your liking.</p>
      </div>

      <Separator />

      {/* Appearance */}
      <section className="space-y-4">
        <h2 className="text-base font-medium">Appearance</h2>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <div>
              <p className="text-sm font-medium">Dark mode</p>
              <p className="text-xs text-muted-foreground">
                {theme === 'dark' ? 'Currently using dark theme' : 'Currently using light theme'}
              </p>
            </div>
          </div>
          <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
        </div>
      </section>

      <Separator />

      {/* Library */}
      <section className="space-y-4">
        <h2 className="text-base font-medium">Library</h2>
        <p className="text-sm text-muted-foreground">
          Library settings (scan paths, metadata strategy, etc.) will be configurable here in Phase 2.
        </p>
      </section>
    </div>
  )
}
