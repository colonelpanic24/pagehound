import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { fetchProgress, saveProgress } from '@/api/reader'
import { EpubReader, type EpubReaderRef } from '@/components/Reader/EpubReader'
import { PdfReader, type PdfReaderRef } from '@/components/Reader/PdfReader'
import { Button } from '@/components/ui/button'
import type { Book } from '@/types'

const READABLE_FORMATS = ['epub', 'pdf']

export function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const id = parseInt(bookId!, 10)

  const epubRef = useRef<EpubReaderRef>(null)
  const pdfRef = useRef<PdfReaderRef>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [percentage, setPercentage] = useState(0)
  const [savedPosition, setSavedPosition] = useState<string | null>(null)
  const [progressLoaded, setProgressLoaded] = useState(false)

  const { data: book } = useQuery<Book>({
    queryKey: ['books', id],
    queryFn: () => fetch(`/api/books/${id}`).then((r) => r.json()),
  })

  useEffect(() => {
    fetchProgress(id)
      .then((p) => {
        setSavedPosition(p.position)
        setPercentage(p.percent_complete)
      })
      .catch(() => {})
      .finally(() => setProgressLoaded(true))
  }, [id])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowLeft') {
        epubRef.current?.prev()
        pdfRef.current?.prev()
      } else if (e.key === 'ArrowRight') {
        epubRef.current?.next()
        pdfRef.current?.next()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const handleProgress = useCallback(
    (position: string | null, pct: number) => {
      setPercentage(pct)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveProgress(id, pct, position)
      }, 3000)
    },
    [id],
  )

  if (!book || !progressLoaded) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!READABLE_FORMATS.includes(book.file_format)) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <p className="text-sm">
          Format <strong>{book.file_format.toUpperCase()}</strong> is not supported in the browser
          reader.
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    )
  }

  const fileUrl = `/api/books/${id}/file`
  const isEpub = book.file_format === 'epub'

  function prev() {
    epubRef.current?.prev()
    pdfRef.current?.prev()
  }
  function next() {
    epubRef.current?.next()
    pdfRef.current?.next()
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b shrink-0 bg-background/95 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Close reader"
        >
          <X className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-sm font-medium truncate">{book.title}</h1>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {Math.round(percentage * 100)}%
        </span>
      </div>

      {/* Reader area */}
      <div className="flex-1 min-h-0">
        {isEpub ? (
          <EpubReader
            ref={epubRef}
            url={fileUrl}
            initialPosition={savedPosition}
            onRelocate={(cfi, pct) => handleProgress(cfi, pct)}
          />
        ) : (
          <PdfReader
            ref={pdfRef}
            url={fileUrl}
            initialPage={savedPosition ? parseInt(savedPosition, 10) : 1}
            onPageChange={(page, total) =>
              handleProgress(String(page), total > 0 ? page / total : 0)
            }
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t shrink-0 bg-background/95 backdrop-blur">
        <Button variant="outline" size="sm" onClick={prev} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${percentage * 100}%` }}
            />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={next} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
