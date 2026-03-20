import { useState } from 'react'
import { X, Pencil, Sparkles, Check, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { patchBook } from '@/api/books'
import { triggerEnrich } from '@/api/metadata'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import type { Book } from '@/types'

const READABLE_FORMATS = ['epub', 'pdf']

interface Props {
  book: Book | null
  onClose: () => void
}

const EDITABLE_FIELDS: Array<{ key: keyof Book; label: string; multiline?: boolean }> = [
  { key: 'title', label: 'Title' },
  { key: 'subtitle', label: 'Subtitle' },
  { key: 'description', label: 'Description', multiline: true },
  { key: 'isbn_13', label: 'ISBN-13' },
  { key: 'isbn_10', label: 'ISBN-10' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'published_date', label: 'Published date' },
  { key: 'language', label: 'Language' },
  { key: 'page_count', label: 'Pages' },
]

export function BookDetailDrawer({ book, onClose }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Book>>({})
  const [saving, setSaving] = useState(false)
  const [enriching, setEnriching] = useState(false)

  if (!book) return null

  function startEdit() {
    setDraft({})
    setEditing(true)
  }

  function cancelEdit() {
    setDraft({})
    setEditing(false)
  }

  async function saveEdit() {
    if (!book || Object.keys(draft).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await patchBook(book.id, draft)
      queryClient.setQueriesData<Book[]>({ queryKey: ['books'] }, (old = []) =>
        old.map((b) => (b.id === updated.id ? updated : b))
      )
      toast({ title: 'Saved', description: 'Book updated.' })
      setEditing(false)
      setDraft({})
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save changes.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleEnrich() {
    if (!book) return
    setEnriching(true)
    try {
      await triggerEnrich(book.id)
      toast({ title: 'Enrichment queued', description: 'Metadata lookup is running.' })
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not start enrichment.' })
    } finally {
      setEnriching(false)
    }
  }

  async function toggleRead() {
    if (!book) return
    try {
      const updated = await patchBook(book.id, { is_read: !book.is_read })
      queryClient.setQueriesData<Book[]>({ queryKey: ['books'] }, (old = []) =>
        old.map((b) => (b.id === updated.id ? updated : b))
      )
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update read status.' })
    }
  }

  function fieldValue(key: keyof Book): string {
    const v = key in draft ? draft[key] : book![key]
    return v != null ? String(v) : ''
  }

  function setField(key: keyof Book, value: string) {
    setDraft((d) => ({ ...d, [key]: value === '' ? null : value }))
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 bg-background border-l border-border flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h2 className="font-semibold text-sm truncate pr-4">{book.title}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Cover + quick actions */}
          <div className="flex gap-4">
            <div className="w-20 h-28 rounded overflow-hidden bg-muted shrink-0">
              {book.cover_image_path ? (
                <img
                  src={`/covers/${book.id}.jpg`}
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted" />
              )}
            </div>
            <div className="flex flex-col gap-2 justify-center">
              <Badge variant="secondary" className="w-fit uppercase text-xs">
                {book.file_format}
              </Badge>
              {book.metadata_confidence != null && (
                <span className="text-xs text-muted-foreground">
                  {book.metadata_source} · {book.metadata_confidence}% confident
                </span>
              )}
              <button
                onClick={toggleRead}
                className={cn(
                  'flex items-center gap-1.5 text-xs rounded-md px-2 py-1 border transition-colors w-fit',
                  book.is_read
                    ? 'bg-success/10 text-success border-success/30'
                    : 'text-muted-foreground border-border hover:bg-muted'
                )}
              >
                <Check className="h-3 w-3" />
                {book.is_read ? 'Read' : 'Mark as read'}
              </button>
            </div>
          </div>

          {/* Authors */}
          {book.authors.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Authors</p>
              <p className="text-sm">{book.authors.map((a) => a.name).join(', ')}</p>
            </div>
          )}

          {/* Editable fields */}
          <div className="space-y-3">
            {EDITABLE_FIELDS.map(({ key, label, multiline }) => (
              <div key={key}>
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                {editing ? (
                  multiline ? (
                    <textarea
                      value={fieldValue(key)}
                      onChange={(e) => setField(key, e.target.value)}
                      rows={3}
                      className="w-full text-sm rounded-md border border-input bg-background px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  ) : (
                    <input
                      type="text"
                      value={fieldValue(key)}
                      onChange={(e) => setField(key, e.target.value)}
                      className="w-full text-sm rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  )
                ) : (
                  <p className="text-sm">
                    {book[key] != null ? String(book[key]) : (
                      <span className="text-muted-foreground/50 italic">—</span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t px-4 py-3 flex items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              {READABLE_FORMATS.includes(book.file_format) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { onClose(); navigate(`/read/${book.id}`) }}
                  className="gap-1.5"
                >
                  <BookOpen className="h-4 w-4" />
                  Read
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={startEdit} className="gap-1.5">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleEnrich}
                disabled={enriching}
                className="gap-1.5"
              >
                <Sparkles className="h-4 w-4" />
                {enriching ? 'Queued…' : 'Enrich metadata'}
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
