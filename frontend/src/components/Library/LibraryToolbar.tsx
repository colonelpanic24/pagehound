import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, List, Search, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { triggerScan } from '@/api/books'
import { toast } from '@/hooks/useToast'
import type { BookFilters, GroupBy, ViewMode } from '@/types'

interface Props {
  totalBooks: number
  filters: BookFilters
  onFiltersChange: (f: BookFilters) => void
  viewMode: ViewMode
  onViewModeChange: (m: ViewMode) => void
  groupBy: GroupBy
  onGroupByChange: (g: GroupBy) => void
}

export function LibraryToolbar({
  totalBooks,
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  groupBy,
  onGroupByChange,
}: Props) {
  const [searchValue, setSearchValue] = useState(filters.q ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external filter change (e.g. clear all)
  useEffect(() => {
    setSearchValue(filters.q ?? '')
  }, [filters.q])

  function handleSearchChange(value: string) {
    setSearchValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, q: value || undefined })
    }, 300)
  }

  async function handleScan() {
    try {
      await triggerScan()
      toast({ title: 'Scan started', description: 'Library scan is running in the background.' })
    } catch {
      toast({ title: 'Scan failed', description: 'Could not start library scan.', variant: 'destructive' })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      {/* Left: count */}
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {totalBooks} {totalBooks === 1 ? 'book' : 'books'}
      </span>

      {/* Center: search */}
      <div className="relative flex-1 min-w-[160px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Search library…"
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className={cn(
            'w-full h-9 rounded-md border border-input bg-background pl-8 pr-3 text-sm',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background'
          )}
        />
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2 ml-auto flex-wrap">
        {/* Sort */}
        <select
          value={`${filters.sort ?? 'title'}:${filters.sort_dir ?? 'asc'}`}
          onChange={(e) => {
            const [sort, sort_dir] = e.target.value.split(':') as [string, 'asc' | 'desc']
            onFiltersChange({ ...filters, sort, sort_dir })
          }}
          className={cn(
            'h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background'
          )}
        >
          <option value="title:asc">Title A–Z</option>
          <option value="title:desc">Title Z–A</option>
          <option value="added_date:desc">Recently added</option>
          <option value="added_date:asc">Oldest added</option>
          <option value="published_date:desc">Published (newest)</option>
          <option value="published_date:asc">Published (oldest)</option>
        </select>

        {/* Group by */}
        <select
          value={groupBy}
          onChange={(e) => onGroupByChange(e.target.value as GroupBy)}
          className={cn(
            'h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background'
          )}
        >
          <option value="none">No grouping</option>
          <option value="author">Group by Author</option>
          <option value="series">Group by Series</option>
          <option value="format">Group by Format</option>
          <option value="language">Group by Language</option>
        </select>

        {/* View mode toggle */}
        <div className="flex rounded-md border border-input overflow-hidden">
          <button
            onClick={() => onViewModeChange('grid')}
            className={cn(
              'h-9 w-9 flex items-center justify-center transition-colors',
              viewMode === 'grid'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={cn(
              'h-9 w-9 flex items-center justify-center border-l border-input transition-colors',
              viewMode === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            <List className="h-4 w-4" />
          </button>
        </div>

        {/* Scan button */}
        <Button size="sm" onClick={handleScan} className="gap-1.5">
          <ScanLine className="h-4 w-4" />
          Scan library
        </Button>
      </div>
    </div>
  )
}
