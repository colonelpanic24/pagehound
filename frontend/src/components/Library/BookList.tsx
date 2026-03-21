import { useState } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown, BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { groupSortKey, getGroupKey } from '@/lib/grouping'
import type { Book, GroupBy } from '@/types'

interface Props {
  books: Book[]
  groupBy?: GroupBy
  onBookClick?: (book: Book) => void
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '—'
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const columnHelper = createColumnHelper<Book>()

const columns = [
  columnHelper.display({
    id: 'cover',
    header: '',
    cell: ({ row }) => {
      const book = row.original
      return (
        <div className="w-12 h-16 overflow-hidden rounded bg-muted flex-shrink-0 flex items-center justify-center">
          <img
            src={`/covers/${book.id}.jpg`}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent) {
                parent.innerHTML =
                  '<div class="w-full h-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-30"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>'
              }
            }}
          />
        </div>
      )
    },
    size: 48,
  }),
  columnHelper.accessor('title', {
    header: 'Title',
    cell: ({ row }) => {
      const book = row.original
      const authorNames = book.authors.map((a) => a.name).join(', ')
      return (
        <div className="min-w-0">
          <p className={cn('text-sm font-medium text-foreground truncate', book.is_missing && 'text-muted-foreground')}>
            {book.title}
            {book.subtitle && (
              <span className="text-muted-foreground font-normal"> — {book.subtitle}</span>
            )}
          </p>
          {authorNames && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{authorNames}</p>
          )}
        </div>
      )
    },
    enableSorting: true,
  }),
  columnHelper.accessor('file_format', {
    header: 'Format',
    cell: ({ getValue }) => (
      <Badge variant="secondary" className="text-[10px] uppercase">
        {getValue()}
      </Badge>
    ),
    enableSorting: false,
  }),
  columnHelper.accessor('published_date', {
    header: 'Published',
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(getValue())}</span>
    ),
    enableSorting: false,
  }),
  columnHelper.accessor('added_date', {
    header: 'Added',
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(getValue())}</span>
    ),
    enableSorting: false,
  }),
  columnHelper.accessor('file_size', {
    header: 'Size',
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground whitespace-nowrap">{formatFileSize(getValue())}</span>
    ),
    enableSorting: false,
  }),
]

function BookTable({ books, onBookClick }: { books: Book[]; onBookClick?: (book: Book) => void }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data: books,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="w-full overflow-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                return (
                  <th
                    key={header.id}
                    className={cn(
                      'px-3 py-2 text-left text-xs font-medium text-muted-foreground select-none',
                      canSort && 'cursor-pointer hover:text-foreground'
                    )}
                    style={{ width: header.column.columnDef.size }}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        sorted === 'asc' ? <ChevronUp className="h-3 w-3" />
                        : sorted === 'desc' ? <ChevronDown className="h-3 w-3" />
                        : <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No books found</p>
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onBookClick?.(row.original)}
                className={cn(
                  'border-t border-border hover:bg-muted/30 transition-colors cursor-pointer',
                  row.original.is_missing && 'opacity-50'
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export function BookList({ books, groupBy = 'none', onBookClick }: Props) {
  if (groupBy === 'none') {
    return <BookTable books={books} onBookClick={onBookClick} />
  }

  const groupMap = new Map<string, Book[]>()
  for (const book of books) {
    const key = getGroupKey(book, groupBy)
    ;(groupMap.get(key) ?? (groupMap.set(key, []), groupMap.get(key)!)).push(book)
  }

  const sortedGroups = Array.from(groupMap.entries()).sort(([a], [b]) =>
    groupSortKey(a).localeCompare(groupSortKey(b))
  )

  if (groupBy === 'series') {
    for (const [, groupBooks] of sortedGroups) {
      groupBooks.sort((a, b) =>
        (a.series_index ?? 9999) - (b.series_index ?? 9999) ||
        a.sort_title.localeCompare(b.sort_title)
      )
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {sortedGroups.map(([groupName, groupBooks]) => (
        <section key={groupName}>
          <h2 className="text-base font-semibold mb-2 text-foreground border-b border-border pb-1">
            {groupName}
            <span className="ml-2 text-sm font-normal text-muted-foreground">({groupBooks.length})</span>
          </h2>
          <BookTable books={groupBooks} onBookClick={onBookClick} />
        </section>
      ))}
    </div>
  )
}
