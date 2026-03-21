import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, BookOpen } from 'lucide-react'
import { fetchBooks } from '@/api/books'
import { BookCard } from '@/components/Library/BookCard'
import { cn } from '@/lib/utils'
import type { Book } from '@/types'

export function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: books = [], isFetching: isLoading } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () => fetchBooks({ q: debouncedQ }),
    enabled: debouncedQ.length > 0,
  })

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQ(value.trim()), 300)
  }

  function handleBookClick(book: Book) {
    navigate(`/read/${book.id}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <input
            autoFocus
            type="search"
            placeholder="Search your library…"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            className={cn(
              'w-full h-11 rounded-lg border border-input bg-background pl-10 pr-4 text-base',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background'
            )}
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!debouncedQ ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">Type to search titles and authors</p>
          </div>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Searching…</p>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
            <p className="text-sm">No results for <strong>"{debouncedQ}"</strong></p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {books.length} {books.length === 1 ? 'result' : 'results'} for <strong>"{debouncedQ}"</strong>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {books.map((book) => (
                <BookCard key={book.id} book={book} onClick={() => handleBookClick(book)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
