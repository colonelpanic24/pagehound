import { useState } from 'react'
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
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
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const best = review.candidates[0] as MetadataCandidate | undefined

  async function handleApprove() {
    setBusy(true)
    try {
      await approveReview(review.id)
      queryClient.invalidateQueries({ queryKey: ['review-queue'] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
      toast({ title: 'Approved', description: `Metadata applied to "${review.book.title}".` })
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

  // Compute which fields actually differ
  const changedFields = Object.entries(review.suggested_fields as Record<string, unknown>)
    .filter(([field, value]) => {
      const current = (review.book as unknown as Record<string, unknown>)[field]
      return value !== null && value !== undefined && value !== current
    })

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
                {changedFields.length} field{changedFields.length === 1 ? '' : 's'} would change
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={handleReject} disabled={busy}>
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button size="sm" onClick={handleApprove} disabled={busy}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </div>
        </div>
      </CardHeader>

      {changedFields.length > 0 && (
        <CardContent className="pt-0">
          {/* Toggle diff */}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Hide changes' : 'Show changes'}
          </button>

          {expanded && (
            <div className="rounded-md border overflow-hidden text-sm">
              <div className="grid grid-cols-[auto_1fr_1fr] bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b">
                <span className="w-24">Field</span>
                <span>Current</span>
                <span>Suggested</span>
              </div>
              {changedFields.map(([field, suggested]) => {
                const current = (review.book as unknown as Record<string, unknown>)[field]
                return (
                  <div
                    key={field}
                    className="grid grid-cols-[auto_1fr_1fr] px-3 py-2 border-b last:border-0 gap-3"
                  >
                    <span className="w-24 text-xs text-muted-foreground shrink-0">
                      {FIELD_LABELS[field] ?? field}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {current != null ? String(current) : <em>empty</em>}
                    </span>
                    <span className="text-xs font-medium truncate">{String(suggested)}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Other candidates */}
          {review.candidates.length > 1 && expanded && (
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
