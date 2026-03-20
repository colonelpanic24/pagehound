import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface EpubReaderRef {
  prev: () => void
  next: () => void
}

interface Props {
  url: string
  initialPosition: string | null
  onRelocate: (cfi: string, percentage: number) => void
}

export const EpubReader = forwardRef<EpubReaderRef, Props>(
  ({ url, initialPosition, onRelocate }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renditionRef = useRef<any>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bookRef = useRef<any>(null)

    useImperativeHandle(ref, () => ({
      prev: () => renditionRef.current?.prev(),
      next: () => renditionRef.current?.next(),
    }))

    useEffect(() => {
      if (!containerRef.current) return

      let destroyed = false

      import('epubjs').then(({ default: Epub }) => {
        if (destroyed || !containerRef.current) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const book = (Epub as any)(url)
        bookRef.current = book

        const rendition = book.renderTo(containerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'paginated',
        })
        renditionRef.current = rendition

        rendition.display(initialPosition || undefined)

        book.ready.then(() => {
          book.locations.generate(1024)
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rendition.on('relocated', (location: any) => {
          const cfi: string = location.start.cfi
          const pct: number = book.locations.percentageFromCfi(cfi) ?? 0
          onRelocate(cfi, pct)
        })
      })

      return () => {
        destroyed = true
        renditionRef.current?.destroy()
        bookRef.current?.destroy()
        renditionRef.current = null
        bookRef.current = null
      }
      // url is intentionally the only dep — reinit only when the book changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url])

    return (
      <div className="relative w-full h-full">
        <div ref={containerRef} className="w-full h-full" />
        {/* Click zones for page navigation */}
        <div
          className="absolute inset-y-0 left-0 w-1/4 cursor-pointer z-10"
          onClick={() => renditionRef.current?.prev()}
        />
        <div
          className="absolute inset-y-0 right-0 w-1/4 cursor-pointer z-10"
          onClick={() => renditionRef.current?.next()}
        />
      </div>
    )
  },
)

EpubReader.displayName = 'EpubReader'
