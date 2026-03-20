import { useState } from 'react'
import { BookOpen, SlidersHorizontal, X } from 'lucide-react'
import { useBooks } from '@/hooks/useLibrary'
import { LibraryToolbar } from '@/components/Library/LibraryToolbar'
import { FilterSidebar } from '@/components/Library/FilterSidebar'
import { BookGrid } from '@/components/Library/BookGrid'
import { BookList } from '@/components/Library/BookList'
import { BookDetailDrawer } from '@/components/Library/BookDetailDrawer'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Book, BookFilters, GroupBy, ViewMode } from '@/types'

function getStoredViewMode(): ViewMode {
  try {
    const v = localStorage.getItem('library.viewMode')
    if (v === 'grid' || v === 'list') return v
  } catch {
    // ignore
  }
  return 'grid'
}

function getStoredGroupBy(): GroupBy {
  try {
    const v = localStorage.getItem('library.groupBy')
    if (v === 'none' || v === 'author' || v === 'series' || v === 'format' || v === 'language') return v
  } catch {
    // ignore
  }
  return 'none'
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="flex flex-col rounded-lg overflow-hidden border border-border animate-pulse">
          <div className="aspect-[2/3] bg-muted" />
          <div className="p-2 flex flex-col gap-1">
            <div className="h-3 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
      <BookOpen className="h-14 w-14 mb-4 opacity-20" />
      <h2 className="text-lg font-medium text-foreground">Your library is empty</h2>
      <p className="text-sm mt-1">Click <strong>Scan library</strong> to get started.</p>
    </div>
  )
}

export function LibraryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode)
  const [groupBy, setGroupBy] = useState<GroupBy>(getStoredGroupBy)
  const [filters, setFilters] = useState<BookFilters>({})
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)

  const { books, isLoading } = useBooks(filters)

  function handleViewModeChange(m: ViewMode) {
    setViewMode(m)
    try { localStorage.setItem('library.viewMode', m) } catch { /* ignore */ }
  }

  function handleGroupByChange(g: GroupBy) {
    setGroupBy(g)
    try { localStorage.setItem('library.groupBy', g) } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="px-4 border-b border-border">
        <div className="flex items-center gap-2">
          {/* Mobile sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle filters"
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
          </Button>
          <div className="flex-1 min-w-0">
            <LibraryToolbar
              totalBooks={books.length}
              filters={filters}
              onFiltersChange={setFilters}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              groupBy={groupBy}
              onGroupByChange={handleGroupByChange}
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <div
          className={cn(
            'border-r border-border overflow-y-auto p-4 shrink-0 bg-background',
            'hidden md:block',
            sidebarOpen && 'block'
          )}
        >
          <FilterSidebar filters={filters} onChange={setFilters} />
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-background/80 md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <div
              className="absolute top-0 left-0 h-full w-64 bg-background border-r border-border p-4 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <FilterSidebar filters={filters} onChange={setFilters} />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <LoadingSkeleton />
          ) : books.length === 0 ? (
            <EmptyState />
          ) : viewMode === 'grid' ? (
            <BookGrid books={books} groupBy={groupBy} onBookClick={setSelectedBook} />
          ) : (
            <BookList books={books} onBookClick={setSelectedBook} />
          )}
        </div>
      </div>

      <BookDetailDrawer book={selectedBook} onClose={() => setSelectedBook(null)} />
    </div>
  )
}
