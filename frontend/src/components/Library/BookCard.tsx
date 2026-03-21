import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Book } from '@/types'

interface Props {
  book: Book
  onClick?: () => void
}

function CoverPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <BookOpen className="h-10 w-10 text-muted-foreground opacity-40" />
    </div>
  )
}

export function BookCard({ book, onClick }: Props) {
  const [imgError, setImgError] = useState(false)
  const showImage = book.cover_image_path !== null && !imgError

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-lg border bg-card text-card-foreground overflow-hidden cursor-pointer',
        'hover:border-ring transition-colors',
        book.is_missing && 'opacity-50'
      )}
      onClick={onClick}
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        {showImage ? (
          <img
            src={`/covers/${book.id}.jpg`}
            alt={book.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <CoverPlaceholder />
        )}

        {/* Missing overlay */}
        {book.is_missing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <span className="text-xs font-medium text-muted-foreground">Missing</span>
          </div>
        )}

        {/* Format badge in corner */}
        <div className="absolute top-1.5 right-1.5">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase">
            {book.file_format}
          </Badge>
        </div>
      </div>

      {/* Info */}
      <div className="p-2 flex flex-col gap-0.5 min-h-0">
        <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground">
          {book.title}
        </p>
        {book.series && (
          <Link
            to={`/series/${book.series.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary/70 hover:text-primary leading-tight truncate"
          >
            {book.series.name}{book.series_index != null ? ` #${book.series_index % 1 === 0 ? book.series_index.toFixed(0) : book.series_index}` : ''}
          </Link>
        )}
        {book.authors.map((author) => (
          <Link
            key={author.id}
            to={`/authors/${author.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-muted-foreground hover:text-foreground leading-tight truncate"
          >
            {author.name}
          </Link>
        ))}
      </div>
    </div>
  )
}
