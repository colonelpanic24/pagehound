import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { onWsEvent } from '@/hooks/useWebSocket'
import { fetchReviewQueue } from '@/api/metadata'

export function useReviewQueue() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['review-queue'],
    queryFn: () => fetchReviewQueue('pending'),
    staleTime: 30_000,
  })

  useEffect(() => {
    const unsubs = [
      // New review arrived
      onWsEvent('metadata.review_needed', () => {
        queryClient.invalidateQueries({ queryKey: ['review-queue'] })
      }),
      // A book was enriched (auto-applied) — update the book cache too
      onWsEvent('metadata.enriched', ({ payload }) => {
        queryClient.invalidateQueries({ queryKey: ['review-queue'] })
        // Update book in the books cache
        const book = (payload as { book?: Record<string, unknown> }).book
        if (book) {
          queryClient.setQueriesData<unknown[]>({ queryKey: ['books'] }, (old = []) =>
            (old as Array<{ id: unknown }>).map((b) => (b.id === book.id ? { ...b, ...book } : b))
          )
        }
      }),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [queryClient])

  return {
    reviews: data ?? [],
    pendingCount: data?.length ?? 0,
    isLoading,
    error,
  }
}
