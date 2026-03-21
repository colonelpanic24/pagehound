import { useState } from 'react'
import { CheckCircle2, XCircle, Sparkles } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useReviewQueue } from '@/hooks/useReviewQueue'
import { approveReview, rejectReview } from '@/api/metadata'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { toast } from '@/hooks/useToast'
import type { MetadataReview, MetadataCandidate } from '@/types'

const SOURCE_LABELS: Record<string, string> = {
  google_books: 'Google Books',
  open_library: 'Open Library',
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  description: 'Description',
  isbn_10: 'ISBN-10',
  isbn_13: 'ISBN-13',
  publisher: 'Publisher',
  published_date: 'Published',
  language: 'Language',
  page_count: 'Pages',
}

export function ReviewQueuePage() {
  const { reviews, isLoading } = useReviewQueue()

  if (isLoading) {
    return <div className="max-w-3xl mx-auto py-8 px-4 text-sm text-muted-foreground">Loading…</div>
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Metadata Review</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {reviews.length === 0
            ? 'No pending reviews.'
            : `${reviews.length} book${reviews.length === 1 ? '' : 's'} need your attention.`}
        </p>
      </div>

      {reviews.length === 0 && (
        <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 opacity-20" />
          <p className="text-sm">All caught up.</p>
        </div>
      )}

      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  )
}

function ReviewCard({ review }: { review: MetadataReview }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const best = review.candidates[0] as MetadataCandidate | undefined

  // Compute which fields actually differ
  const changedFields = Object.entries(review.suggested_fields as Record<string, unknown>)
    .filter(([field, value]) => {
      const current = (review.book as unknown as Record<string, unknown>)[field]
      return value !== null && value !== undefined && value !== current
    })

  // All fields checked by default
  const [checkedFields, setCheckedFields] = useState<Set<string>>(
    () => new Set(changedFields.map(([f]) => f))
  )

  function toggleField(field: string) {
    setCheckedFields((prev) => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }

  async function handleApprove() {
    setBusy(true)
    try {
      const selectedFields = Object.fromEntries(
        changedFields.filter(([f]) => checkedFields.has(f))
      )
      await approveReview(review.id, selectedFields)
      queryClient.invalidateQueries({ queryKey: ['review-queue'] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
      const appliedCount = Object.keys(selectedFields).length
      toast({ title: 'Approved', description: `Applied ${appliedCount} field${appliedCount === 1 ? '' : 's'} to "${review.book.title}".` })
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not approve review.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleReject() {
    setBusy(true)
    try {
      await rejectReview(review.id)
      queryClient.invalidateQueries({ queryKey: ['review-queue'] })
      toast({ title: 'Rejected', description: `Skipped metadata for "${review.book.title}".` })
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not reject review.' })
    } finally {
      setBusy(false)
    }
  }

  const checkedCount = checkedFields.size

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Cover thumbnail */}
          <div className="w-12 h-16 rounded overflow-hidden bg-muted shrink-0">
            {review.book.cover_image_path ? (
              <img
                src={`/covers/${review.book.id}.jpg`}
                alt={review.book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted" />
            )}
          </div>

          {/* Title + source + confidence */}
          <div className="flex-1 min-w-0">
            <p className="font-medium leading-tight truncate">{review.book.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {review.book.authors.map((a) => a.name).join(', ') || 'Unknown author'}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {best && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Sparkles className="h-3 w-3" />
                  {SOURCE_LABELS[best.source] ?? best.source}
                </Badge>
              )}
              <ConfidenceBadge score={review.suggested_confidence} />
              <span className="text-xs text-muted-foreground">
                {checkedCount} of {changedFields.length} field{changedFields.length === 1 ? '' : 's'} selected
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={handleReject} disabled={busy}>
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button size="sm" onClick={handleApprove} disabled={busy || checkedCount === 0}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Apply {checkedCount > 0 && checkedCount < changedFields.length ? `(${checkedCount})` : ''}
            </Button>
          </div>
        </div>
      </CardHeader>

      {changedFields.length > 0 && (
        <CardContent className="pt-0">
          <div className="rounded-md border overflow-hidden text-sm">
              <div className="grid grid-cols-[1.5rem_6rem_1fr_1fr] bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b gap-3">
                <span />
                <span>Field</span>
                <span>Current</span>
                <span>Suggested</span>
              </div>
              {changedFields.map(([field, suggested]) => {
                const current = (review.book as unknown as Record<string, unknown>)[field]
                const checked = checkedFields.has(field)
                return (
                  <label
                    key={field}
                    className="grid grid-cols-[1.5rem_6rem_1fr_1fr] px-3 py-2 border-b last:border-0 gap-3 items-start cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleField(field)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
                    />
                    <span className={`text-xs shrink-0 ${checked ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                      {FIELD_LABELS[field] ?? field}
                    </span>
                    <span className={`text-xs truncate ${checked ? 'text-muted-foreground' : 'text-muted-foreground/40'}`}>
                      {current != null ? String(current) : <em>empty</em>}
                    </span>
                    <span className={`text-xs font-medium truncate ${checked ? 'text-foreground' : 'text-muted-foreground/40 line-through'}`}>
                      {String(suggested)}
                    </span>
                  </label>
                )
              })}
            </div>
          {/* Other candidates */}
          {review.candidates.length > 1 && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-1.5">
                Other candidates ({review.candidates.length - 1}):
              </p>
              <div className="flex flex-wrap gap-2">
                {review.candidates.slice(1).map((c, i) => (
                  <Badge key={i} variant="outline" className="text-xs gap-1">
                    {SOURCE_LABELS[c.source] ?? c.source}
                    <ConfidenceBadge score={c.confidence} inline />
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function ConfidenceBadge({ score, inline }: { score: number; inline?: boolean }) {
  const color =
    score >= 80 ? 'text-success' : score >= 60 ? 'text-yellow-500' : 'text-destructive'
  if (inline) {
    return <span className={`${color} tabular-nums`}>{score}%</span>
  }
  return (
    <span className={`text-xs font-medium tabular-nums ${color}`}>{score}% confidence</span>
  )
}
