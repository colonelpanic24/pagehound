import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface PdfReaderRef {
  prev: () => void
  next: () => void
}

interface Props {
  url: string
  initialPage: number
  onPageChange: (page: number, total: number) => void
}

export const PdfReader = forwardRef<PdfReaderRef, Props>(
  ({ url, initialPage, onPageChange }, ref) => {
    const [numPages, setNumPages] = useState(0)
    const [pageNumber, setPageNumber] = useState(Math.max(1, initialPage))
    const [pageWidth, setPageWidth] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      prev: () => setPageNumber((p) => Math.max(1, p - 1)),
      next: () => setPageNumber((p) => Math.min(numPages || p, p + 1)),
    }))

    // Measure container width for PDF page sizing
    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const ro = new ResizeObserver((entries) => {
        setPageWidth(entries[0].contentRect.width - 32)
      })
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    useEffect(() => {
      if (numPages > 0) onPageChange(pageNumber, numPages)
    }, [pageNumber, numPages]) // eslint-disable-line react-hooks/exhaustive-deps

    function handleLoadSuccess({ numPages: n }: { numPages: number }) {
      setNumPages(n)
    }

    function goTo(page: number) {
      setPageNumber(Math.max(1, Math.min(numPages || 1, page)))
    }

    return (
      <div ref={containerRef} className="relative w-full h-full overflow-auto flex flex-col items-center py-4 gap-2">
        {/* Side click zones */}
        <div
          className="fixed left-0 inset-y-0 w-16 cursor-pointer z-10"
          onClick={() => goTo(pageNumber - 1)}
        />
        <div
          className="fixed right-0 inset-y-0 w-16 cursor-pointer z-10"
          onClick={() => goTo(pageNumber + 1)}
        />

        <Document
          file={url}
          onLoadSuccess={handleLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              Loading PDF…
            </div>
          }
          error={
            <div className="flex items-center justify-center h-48 text-sm text-destructive">
              Failed to load PDF.
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            width={pageWidth > 0 ? pageWidth : undefined}
            renderAnnotationLayer
            renderTextLayer
          />
        </Document>

        {numPages > 0 && (
          <p className="text-xs text-muted-foreground pb-2 tabular-nums">
            Page {pageNumber} of {numPages}
          </p>
        )}
      </div>
    )
  },
)

PdfReader.displayName = 'PdfReader'
