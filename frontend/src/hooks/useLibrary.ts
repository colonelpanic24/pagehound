import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { onWsEvent } from '@/hooks/useWebSocket'
import { fetchBooks, fetchFormats, fetchLanguages } from '@/api/books'
import type { Book, BookFilters } from '@/types'

export function useBooks(filters: BookFilters = {}) {
  const queryClient = useQueryClient()
  const key = ['books', filters] as const

  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => fetchBooks(filters),
  })

  useEffect(() => {
    const unsubAdded = onWsEvent('library.book_added', (msg) => {
      const payload = msg.payload as { book: Book }
      queryClient.setQueryData<Book[]>(key, (old = []) => [payload.book, ...old])
    })

    const unsubUpdated = onWsEvent('library.book_updated', (msg) => {
      const payload = msg.payload as { book_id: number; fields: Partial<Book> }
      queryClient.setQueryData<Book[]>(key, (old = []) =>
        old.map((b) =>
          b.id === payload.book_id ? { ...b, ...payload.fields } : b
        )
      )
    })

    const unsubRemoved = onWsEvent('library.book_removed', (msg) => {
      const payload = msg.payload as { book_id: number }
      queryClient.setQueryData<Book[]>(key, (old = []) =>
        old.filter((b) => b.id !== payload.book_id)
      )
    })

    return () => {
      unsubAdded()
      unsubUpdated()
      unsubRemoved()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, JSON.stringify(filters)])

  return { books: data ?? [], isLoading, error }
}

export function useFormats() {
  const { data } = useQuery({
    queryKey: ['formats'],
    queryFn: fetchFormats,
  })
  return { formats: data ?? [] }
}

export function useLanguages() {
  const { data } = useQuery({
    queryKey: ['languages'],
    queryFn: fetchLanguages,
  })
  return { languages: data ?? [] }
}
