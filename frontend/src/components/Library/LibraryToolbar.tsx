import { useEffect, useRef, useState } from 'react'
import {
  LayoutGrid, List, Search, ScanLine, ArrowUp, ArrowDown,
  Sparkles, SlidersHorizontal, ChevronDown, MoreHorizontal, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { triggerScan } from '@/api/books'
import { triggerEnrichAll } from '@/api/metadata'
import { toast } from '@/hooks/useToast'
import { useFormats, useLanguages } from '@/hooks/useLibrary'
import type { BookFilters, GroupBy, ViewMode } from '@/types'

interface Props {
  filters: BookFilters
  onFiltersChange: (f: BookFilters) => void
  viewMode: ViewMode
  onViewModeChange: (m: ViewMode) => void
  groupBy: GroupBy
  onGroupByChange: (g: GroupBy) => void
}

const SELECT_CLS = cn(
  'h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background'
)

// Shared checkbox row for Format and Language filters
function CheckboxFilterSection({
  title, items, activeValue, labelClassName, onToggle,
}: {
  title: string
  items: string[]
  activeValue: string | undefined
  labelClassName?: (item: string) => string
  onToggle: (item: string) => void
}) {
  if (items.length === 0) return null
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <label key={item} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={activeValue === item}
              onChange={() => onToggle(item)}
              className="h-3.5 w-3.5 rounded border border-input accent-primary cursor-pointer"
            />
            <span className={labelClassName?.(item)}>{item}</span>
          </label>
        ))}
      </div>
    </section>
  )
}

const SORT_OPTIONS = [
  { value: 'title',          label: 'Title' },
  { value: 'added_date',     label: 'Date added' },
  { value: 'published_date', label: 'Published' },
  { value: 'rating',         label: 'Rating' },
]

function SortRow({
  label,
  active,
  activeDir,
  onPick,
}: {
  label: string
  active: boolean
  activeDir: 'asc' | 'desc'
  onPick: (dir: 'asc' | 'desc') => void
}) {
  const [hoverDir, setHoverDir] = useState(false)
  // When hovering the direction zone, preview the opposite of the active direction (or asc if not active)
  const baseDir: 'asc' | 'desc' = active ? activeDir : 'asc'
  const previewDir: 'asc' | 'desc' = baseDir === 'asc' ? 'desc' : 'asc'
  const displayDir = hoverDir ? previewDir : baseDir

  return (
    <div className={cn('flex items-center text-sm', active && 'text-primary')}>
      {/* Sort field — clicking sorts ascending (or keeps current dir if already active) */}
      <button
        onClick={() => onPick(active ? activeDir : 'asc')}
        className="flex-1 flex items-center gap-2 pl-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors text-left"
      >
        <Check className={cn('h-3.5 w-3.5 shrink-0', active ? 'opacity-100' : 'opacity-0')} />
        {label}
      </button>

      {/* Direction zone */}
      <button
        onMouseEnter={() => setHoverDir(true)}
        onMouseLeave={() => setHoverDir(false)}
        onClick={() => onPick(hoverDir ? previewDir : baseDir)}
        className="flex items-center gap-0.5 pr-3 pl-2 py-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="text-xs">{displayDir === 'asc' ? 'A–Z' : 'Z–A'}</span>
        {displayDir === 'asc'
          ? <ArrowDown className="h-3 w-3" />
          : <ArrowUp className="h-3 w-3" />
        }
      </button>
    </div>
  )
}

function SortControl({
  filters,
  onFiltersChange,
}: {
  filters: BookFilters
  onFiltersChange: (f: BookFilters) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const sortField = filters.sort ?? 'added_date'
  const sortDir = filters.sort_dir ?? 'asc'
  const activeLabel = SORT_OPTIONS.find(o => o.value === sortField)?.label ?? 'Sort'

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function pick(value: string, dir: 'asc' | 'desc') {
    onFiltersChange({ ...filters, sort: value, sort_dir: dir })
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'h-9 flex items-center gap-1.5 px-3 rounded-md border border-input bg-background text-sm',
          'text-foreground hover:bg-accent transition-colors',
          open && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
        )}
      >
        {activeLabel}
        <span className="text-xs text-muted-foreground">{sortDir === 'asc' ? 'A–Z' : 'Z–A'}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 w-48 rounded-md border border-border bg-popover shadow-md py-1">
          {SORT_OPTIONS.map(({ value, label }) => (
            <SortRow
              key={value}
              label={label}
              active={sortField === value}
              activeDir={sortDir}
              onPick={(dir) => pick(value, dir)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function LibraryToolbar({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  groupBy,
  onGroupByChange,
}: Props) {
  const [searchValue, setSearchValue] = useState(filters.q ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const { formats } = useFormats()
  const { languages } = useLanguages()

  // Sync external filter change (e.g. clear all)
  useEffect(() => {
    setSearchValue(filters.q ?? '')
  }, [filters.q])

  // Close dropdowns on outside click — only register listener when a popover is open
  useEffect(() => {
    if (!filterOpen && !moreOpen) return
    function handler(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [filterOpen, moreOpen])

  function handleSearchChange(value: string) {
    setSearchValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, q: value || undefined })
    }, 300)
  }

  async function handleScan() {
    setMoreOpen(false)
    try {
      await triggerScan()
      toast({ title: 'Scan started', description: 'Library scan is running in the background.' })
    } catch {
      toast({ title: 'Scan failed', description: 'Could not start library scan.', variant: 'destructive' })
    }
  }

  async function handleEnrichAll() {
    setMoreOpen(false)
    try {
      const result = await triggerEnrichAll()
      toast({ title: 'Enrichment started', description: `Queued ${result.queued} book${result.queued === 1 ? '' : 's'} for metadata lookup.` })
    } catch {
      toast({ title: 'Enrichment failed', description: 'Could not start metadata enrichment.', variant: 'destructive' })
    }
  }

  const hasActiveFilters =
    filters.format !== undefined ||
    filters.language !== undefined ||
    filters.is_read !== undefined

  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      {/* Search */}
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

      {/* Filter popover */}
      <div className="relative" ref={filterRef}>
        <button
          onClick={() => setFilterOpen((o) => !o)}
          className={cn(
            'h-9 flex items-center gap-1.5 px-3 rounded-md border border-input bg-background text-sm',
            'text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
            filterOpen && 'bg-accent text-foreground'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {hasActiveFilters && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          )}
          <ChevronDown className="h-3 w-3" />
        </button>

        {filterOpen && (
          <div className="absolute top-full left-0 z-30 mt-1 w-56 rounded-md border border-border bg-popover shadow-md p-3 flex flex-col gap-4">
            <CheckboxFilterSection
              title="Format"
              items={formats}
              activeValue={filters.format}
              labelClassName={() => 'uppercase text-xs font-medium'}
              onToggle={(fmt) => onFiltersChange({ ...filters, format: filters.format === fmt ? undefined : fmt })}
            />
            <CheckboxFilterSection
              title="Language"
              items={languages}
              activeValue={filters.language}
              labelClassName={() => 'capitalize text-sm'}
              onToggle={(lang) => onFiltersChange({ ...filters, language: filters.language === lang ? undefined : lang })}
            />

            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Read status</p>
              <div className="flex flex-col gap-1">
                {([
                  { label: 'All', value: undefined },
                  { label: 'Read', value: true },
                  { label: 'Unread', value: false },
                ] as { label: string; value: boolean | undefined }[]).map(({ label, value }) => (
                  <label key={label} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="filter-read-status"
                      checked={filters.is_read === value}
                      onChange={() => onFiltersChange({ ...filters, is_read: value })}
                      className="h-3.5 w-3.5 border border-input accent-primary cursor-pointer"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </section>

            {hasActiveFilters && (
              <button
                onClick={() => onFiltersChange({ q: filters.q })}
                className="text-xs text-muted-foreground hover:text-foreground underline text-left"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Group by */}
      <select
        value={groupBy}
        onChange={(e) => onGroupByChange(e.target.value as GroupBy)}
        className={SELECT_CLS}
      >
        <option value="none">No grouping</option>
        <option value="author">Author</option>
        <option value="series">Series</option>
        <option value="language">Language</option>
      </select>

      {/* Sort */}
      <SortControl filters={filters} onFiltersChange={onFiltersChange} />

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

      {/* ⋯ overflow menu */}
      <div className="relative" ref={moreRef}>
        <button
          onClick={() => setMoreOpen((o) => !o)}
          aria-label="More actions"
          className={cn(
            'h-9 w-9 flex items-center justify-center rounded-md border border-input bg-background',
            'text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
            moreOpen && 'bg-accent text-foreground'
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {moreOpen && (
          <div className="absolute top-full right-0 z-30 mt-1 w-44 rounded-md border border-border bg-popover shadow-md py-1 text-sm">
            <button
              onClick={handleScan}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors text-left"
            >
              <ScanLine className="h-4 w-4 text-muted-foreground" />
              Scan library
            </button>
            <button
              onClick={handleEnrichAll}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors text-left"
            >
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              Enrich all
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
