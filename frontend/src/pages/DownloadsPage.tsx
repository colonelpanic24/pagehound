import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Download, BookOpen, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { searchBooks, enqueueDownload } from '@/api/downloads'
import { useDownloads } from '@/hooks/useDownloads'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import type { SearchResult, DownloadItem } from '@/types'

const SOURCE_OPTIONS = [
  { value: 'annas_archive', label: "Anna's Archive" },
]

// ── Search result card ────────────────────────────────────────────────────────

function ResultCard({
  result,
  onDownload,
  queued,
}: {
  result: SearchResult
  onDownload: (r: SearchResult) => void
  queued: boolean
}) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
      {/* Cover */}
      <div className="w-12 h-16 rounded overflow-hidden bg-muted shrink-0 flex items-center justify-center">
        {result.cover_url ? (
          <img
            src={result.cover_url}
            alt={result.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <BookOpen className="h-5 w-5 text-muted-foreground opacity-40" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug line-clamp-2">{result.title}</p>
        {result.authors.length > 0 && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {result.authors.join(', ')}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {result.file_format && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase">
              {result.file_format}
            </Badge>
          )}
          {result.file_size_str && (
            <span className="text-[11px] text-muted-foreground">{result.file_size_str}</span>
          )}
          {result.language && (
            <span className="text-[11px] text-muted-foreground uppercase">{result.language}</span>
          )}
          {result.year && (
            <span className="text-[11px] text-muted-foreground">{result.year}</span>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="shrink-0 flex items-center">
        <Button
          size="sm"
          variant={queued ? 'outline' : 'default'}
          disabled={queued}
          onClick={() => onDownload(result)}
          className="gap-1.5"
        >
          {queued ? (
            <><CheckCircle2 className="h-3.5 w-3.5" /> Queued</>
          ) : (
            <><Download className="h-3.5 w-3.5" /> Download</>
          )}
        </Button>
      </div>
    </div>
  )
}

// ── Download queue item ───────────────────────────────────────────────────────

function DownloadRow({ item }: { item: DownloadItem }) {
  const icon = {
    queued: <Clock className="h-4 w-4 text-muted-foreground" />,
    downloading: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
    done: <CheckCircle2 className="h-4 w-4 text-success" />,
    failed: <XCircle className="h-4 w-4 text-destructive" />,
  }[item.status]

  return (
    <div className="flex gap-3 items-start py-2.5 border-b border-border last:border-0">
      {/* Cover */}
      <div className="w-9 h-12 rounded overflow-hidden bg-muted shrink-0 flex items-center justify-center">
        {item.cover_url ? (
          <img
            src={item.cover_url}
            alt={item.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <BookOpen className="h-4 w-4 text-muted-foreground opacity-30" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug truncate">{item.title}</p>
            {item.authors && (
              <p className="text-xs text-muted-foreground truncate">{item.authors}</p>
            )}
          </div>
          <div className="shrink-0 mt-0.5">{icon}</div>
        </div>

        {/* Progress bar */}
        {item.status === 'downloading' && (
          <div className="mt-1.5">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${item.progress}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{item.progress}%</p>
          </div>
        )}

        {/* Error */}
        {item.status === 'failed' && item.error && (
          <p className="text-[11px] text-destructive mt-0.5 line-clamp-2">{item.error}</p>
        )}

        {/* Meta badges */}
        <div className="flex items-center gap-1.5 mt-1">
          {item.file_format && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 uppercase">
              {item.file_format}
            </Badge>
          )}
          {item.status === 'done' && (
            <span className="text-[11px] text-success">Imported to library</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function DownloadsPage() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [source, setSource] = useState('annas_archive')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set())

  const { downloads } = useDownloads()

  const active = downloads.filter((d) => d.status === 'queued' || d.status === 'downloading')
  const history = downloads.filter((d) => d.status === 'done' || d.status === 'failed')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setResults(null)
    try {
      const r = await searchBooks(q, source)
      setResults(r)
    } catch (err) {
      toast({ variant: 'destructive', title: 'Search failed', description: String(err) })
    } finally {
      setSearching(false)
    }
  }

  async function handleDownload(result: SearchResult) {
    try {
      await enqueueDownload(result)
      setQueuedIds((s) => new Set(s).add(result.id))
      queryClient.invalidateQueries({ queryKey: ['downloads'] })
      toast({ title: 'Download queued', description: `"${result.title}" added to queue.` })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to queue', description: String(err) })
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      {/* Search section */}
      <section>
        <h1 className="text-2xl font-semibold mb-4">Find Books</h1>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              placeholder="Search by title, author, or ISBN…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(
                'w-full h-9 rounded-md border border-input bg-background pl-8 pr-3 text-sm',
                'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
              )}
            />
          </div>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <Button type="submit" disabled={searching || !query.trim()} className="gap-1.5">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </form>

        {/* Results */}
        {searching && (
          <div className="flex items-center gap-2 mt-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </div>
        )}

        {results !== null && !searching && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              {results.length === 0
                ? 'No results found.'
                : `${results.length} result${results.length === 1 ? '' : 's'}`}
            </p>
            {results.map((r) => (
              <ResultCard
                key={r.id}
                result={r}
                onDownload={handleDownload}
                queued={queuedIds.has(r.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Queue section */}
      {downloads.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Downloads</h2>

          {active.length > 0 && (
            <div className="mb-4 rounded-lg border border-border bg-card px-3">
              <p className="text-xs font-medium text-muted-foreground pt-2.5 pb-1 uppercase tracking-wide">
                Active ({active.length})
              </p>
              {active.map((item) => <DownloadRow key={item.id} item={item} />)}
            </div>
          )}

          {history.length > 0 && (
            <div className="rounded-lg border border-border bg-card px-3">
              <p className="text-xs font-medium text-muted-foreground pt-2.5 pb-1 uppercase tracking-wide">
                History
              </p>
              {history.map((item) => <DownloadRow key={item.id} item={item} />)}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
