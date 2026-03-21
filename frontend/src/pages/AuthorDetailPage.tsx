import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, BookOpen, Sparkles, Loader2 } from 'lucide-react'
import { fetchAuthorDetail, discoverAuthorBooks } from '@/api/authors'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AvatarWithInitials } from '@/components/ui/avatar-initials'
import type { Book } from '@/types'
import type { DiscoveredBook } from '@/api/authors'

function LibraryBookCard({ book, onRead }: { book: Book; onRead: () => void }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div
      onClick={onRead}
      className="group flex flex-col rounded-lg border bg-card text-card-foreground overflow-hidden cursor-pointer hover:border-ring transition-colors"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        {book.cover_image_path && !imgError ? (
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
      </div>
      <div className="p-2">
        <p className="text-sm font-medium leading-tight line-clamp-2">{book.title}</p>
        {book.series && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{book.series.name}</p>
        )}
      </div>
    </div>
  )
}

function DiscoveredBookCard({ book, onDownload }: { book: DiscoveredBook; onDownload: () => void }) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-border bg-card">
      <div className="w-12 h-16 rounded overflow-hidden bg-muted shrink-0 flex items-center justify-center">
        {book.cover_url ? (
          <img src={book.cover_url} alt={book.title ?? ''} className="w-full h-full object-cover" />
        ) : (
          <BookOpen className="h-5 w-5 text-muted-foreground opacity-40" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug line-clamp-2">{book.title}</p>
        {book.published_date && (
          <p className="text-xs text-muted-foreground mt-0.5">{book.published_date.slice(0, 4)}</p>
        )}
      </div>
      <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0 self-center" onClick={onDownload}>
        <Download className="h-3.5 w-3.5" />
        Download
      </Button>
    </div>
  )
}


export function AuthorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showDiscover, setShowDiscover] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['author', Number(id)],
    queryFn: () => fetchAuthorDetail(Number(id)),
    enabled: !!id,
  })

  const { data: discovered = [], isFetching: isDiscovering } = useQuery({
    queryKey: ['author-discover', Number(id)],
    queryFn: () => discoverAuthorBooks(Number(id)),
    enabled: showDiscover && !!id,
    staleTime: 5 * 60_000,
  })

  function handleDownload(title: string, authors: string[]) {
    const q = [title, ...authors].join(' ')
    navigate(`/downloads?q=${encodeURIComponent(q)}`)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <button
          onClick={() => navigate('/authors')}
          className="text-muted-foreground hover:text-foreground transition-colors mb-4 inline-flex items-center gap-1.5 text-sm"
          aria-label="Back to authors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Authors
        </button>
        <div className="flex items-start gap-4">
          <AvatarWithInitials name={data?.name ?? ''} photoUrl={data?.photo_url} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold">{isLoading ? '…' : data?.name}</h1>
            {data && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.books.length} {data.books.length === 1 ? 'book' : 'books'} in library
              </p>
            )}
            {data?.bio && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{data.bio}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-8">
        {/* Library books */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
            {data?.books.map((book) => (
              <LibraryBookCard key={book.id} book={book} onRead={() => navigate(`/read/${book.id}`)} />
            ))}
          </div>
        )}

        {/* Discover section */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">More by this author</h2>
            {!showDiscover && (
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setShowDiscover(true)}>
                <Sparkles className="h-3.5 w-3.5" />
                Discover
              </Button>
            )}
          </div>
          {showDiscover && isDiscovering && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          )}
          {showDiscover && !isDiscovering && discovered.length === 0 && (
            <p className="text-sm text-muted-foreground">No additional books found.</p>
          )}
          {showDiscover && !isDiscovering && discovered.length > 0 && (
            <div className="flex flex-col gap-2 max-w-xl">
              {discovered.map((book, i) => (
                <DiscoveredBookCard
                  key={i}
                  book={book}
                  onDownload={() => handleDownload(book.title ?? '', book.authors)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
