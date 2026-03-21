import { Moon, Sun, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTheme } from '@/hooks/useTheme'
import { fetchSettings } from '@/api/settings'
import type { AppSettings } from '@/api/settings'

function EnvHint({ name }: { name: string }) {
  return (
    <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
      {name}
    </code>
  )
}

function SettingRow({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5"><EnvHint name={hint} /></p>}
      </div>
      <div className="text-sm text-right shrink-0">{value}</div>
    </div>
  )
}

function LibraryCard({ s }: { s: AppSettings }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Library</CardTitle>
        <CardDescription>Book storage and database paths.</CardDescription>
      </CardHeader>
      <CardContent>
        <SettingRow
          label="Books directory"
          hint="BOOKS_DIR"
          value={<code className="text-xs font-mono break-all">{s.books_dir}</code>}
        />
      </CardContent>
    </Card>
  )
}

function MetadataCard({ s }: { s: AppSettings }) {
  const strategyLabel: Record<string, string> = {
    prefer_online: 'Prefer online',
    fill_gaps: 'Fill gaps only',
  }
  const sourceLabel: Record<string, string> = {
    google_books: 'Google Books',
    open_library: 'Open Library',
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metadata</CardTitle>
        <CardDescription>Google Books, Open Library, and confidence thresholds.</CardDescription>
      </CardHeader>
      <CardContent>
        <SettingRow
          label="Google Books API key"
          hint="GOOGLE_BOOKS_API_KEY"
          value={
            s.google_books_api_key_set
              ? <Badge variant="secondary">Configured</Badge>
              : <Badge variant="outline" className="text-muted-foreground">Not set (rate-limited)</Badge>
          }
        />
        <SettingRow
          label="Auto-apply threshold"
          hint="AUTO_APPLY_THRESHOLD"
          value={<span>{s.auto_apply_threshold}%</span>}
        />
        <SettingRow
          label="Merge strategy"
          hint="METADATA_STRATEGY"
          value={<span>{strategyLabel[s.metadata_strategy] ?? s.metadata_strategy}</span>}
        />
        <SettingRow
          label="Preferred source"
          hint="PREFERRED_SOURCE"
          value={<span>{sourceLabel[s.preferred_source] ?? s.preferred_source}</span>}
        />
      </CardContent>
    </Card>
  )
}

function KoboCard({ s }: { s: AppSettings }) {
  const isLocalhost = /localhost|127\.0\.0\.1/.test(s.base_url)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kobo &amp; OPDS</CardTitle>
        <CardDescription>
          Device sync and feed settings.{' '}
          <Link to="/kobo" className="inline-flex items-center gap-1 text-primary hover:underline">
            Manage devices <ExternalLink className="h-3 w-3" />
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SettingRow
          label="Base URL"
          hint="BASE_URL"
          value={<code className="text-xs font-mono break-all">{s.base_url}</code>}
        />
        {isLocalhost && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
            <strong>Warning:</strong> BASE_URL is set to localhost. Kobo devices cannot reach this address over the network. Set BASE_URL to your server's LAN or public address.
          </p>
        )}
        <SettingRow
          label="Kobo store"
          hint="KOBO_ENABLED"
          value={s.kobo_enabled ? <Badge variant="secondary">Enabled</Badge> : <Badge variant="outline">Disabled</Badge>}
        />
        <SettingRow
          label="OPDS feed"
          hint="OPDS_ENABLED"
          value={s.opds_enabled ? <Badge variant="secondary">Enabled</Badge> : <Badge variant="outline">Disabled</Badge>}
        />
      </CardContent>
    </Card>
  )
}

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: fetchSettings,
    staleTime: 60_000,
  })

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Runtime configuration. Change values via environment variables and restart the backend.
        </p>
      </div>

      {/* Appearance — always available */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Control how PageHound looks.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark'
                ? <Moon className="h-4 w-4 text-muted-foreground" />
                : <Sun className="h-4 w-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">Dark mode</p>
                <p className="text-xs text-muted-foreground">
                  {theme === 'dark' ? 'Currently using dark theme' : 'Currently using light theme'}
                </p>
              </div>
            </div>
            <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading configuration…</p>
      ) : settings ? (
        <>
          <LibraryCard s={settings} />
          <MetadataCard s={settings} />
          <KoboCard s={settings} />
        </>
      ) : (
        <p className="text-sm text-destructive">Failed to load configuration.</p>
      )}
    </div>
  )
}
