import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, BookOpen } from 'lucide-react'
import { fetchSeriesDetail } from '@/api/series'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Book } from '@/types'

function SeriesBookCard({ book, onRead, onDownload }: {
  book: Book
  onRead: () => void
  onDownload: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const showCover = book.cover_image_path !== null && !imgError
  const authorNames = book.authors.map((a) => a.name).join(', ')

  return (
    <div className={cn(
      'group flex flex-col rounded-lg border bg-card text-card-foreground overflow-hidden',
      'transition-colors',
      book.is_missing ? 'opacity-50' : 'cursor-pointer hover:border-ring',
    )}
      onClick={!book.is_missing ? onRead : undefined}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        {showCover ? (
          <img
            src={`/covers/${book.id}.jpg`}
            alt={book.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-10 w-10 text-muted-foreground opacity-30" />
          </div>
        )}
        <div className="absolute top-1.5 right-1.5">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase">
            {book.file_format}
          </Badge>
        </div>
        {book.series_index != null && (
          <div className="absolute bottom-1.5 left-1.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              #{book.series_index % 1 === 0 ? book.series_index.toFixed(0) : book.series_index}
            </Badge>
          </div>
        )}
      </div>
      <div className="p-2 flex flex-col gap-0.5 flex-1">
        <p className="text-sm font-medium leading-tight line-clamp-2">{book.title}</p>
        {authorNames && (
          <p className="text-xs text-muted-foreground leading-tight truncate">{authorNames}</p>
        )}
      </div>
      {book.is_missing && (
        <div className="px-2 pb-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs gap-1"
            onClick={(e) => { e.stopPropagation(); onDownload() }}
          >
            <Download className="h-3 w-3" />
            Download
          </Button>
        </div>
      )}
    </div>
  )
}

export function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['series', Number(id)],
    queryFn: () => fetchSeriesDetail(Number(id)),
    enabled: !!id,
  })

  function handleDownload(book: Book) {
    const q = [book.title, ...book.authors.map((a) => a.name)].join(' ')
    navigate(`/downloads?q=${encodeURIComponent(q)}`)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b border-border flex items-center gap-3">
        <button
          onClick={() => navigate('/series')}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to series"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold">{isLoading ? '…' : data?.name}</h1>
          {data && (
            <p className="text-sm text-muted-foreground">{data.books.length} {data.books.length === 1 ? 'book' : 'books'}</p>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
            {data?.books.map((book) => (
              <SeriesBookCard
                key={book.id}
                book={book}
                onRead={() => navigate(`/read/${book.id}`)}
                onDownload={() => handleDownload(book)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
