import type { Book } from '@/types'

export interface AuthorSummary {
  id: number
  name: string
  sort_name: string
  book_count: number
  photo_url: string | null
}

export interface AuthorDetail {
  id: number
  name: string
  sort_name: string
  photo_url: string | null
  bio: string | null
  books: Book[]
}

export interface DiscoveredBook {
  title: string
  authors: string[]
  published_date: string | null
  cover_url: string | null
  isbn_13: string | null
  isbn_10: string | null
  description: string | null
}

const BASE = '/api'

export async function fetchAuthorList(): Promise<AuthorSummary[]> {
  const res = await fetch(`${BASE}/authors/`)
  if (!res.ok) throw new Error('Failed to fetch authors')
  return res.json()
}

export async function fetchAuthorDetail(id: number): Promise<AuthorDetail> {
  const res = await fetch(`${BASE}/authors/${id}`)
  if (!res.ok) throw new Error(`Failed to fetch author ${id}`)
  return res.json()
}

export async function discoverAuthorBooks(id: number): Promise<DiscoveredBook[]> {
  const res = await fetch(`${BASE}/authors/${id}/discover`)
  if (!res.ok) throw new Error(`Failed to discover books for author ${id}`)
  return res.json()
}

export async function enrichAuthorPhoto(id: number): Promise<void> {
  await fetch(`${BASE}/authors/${id}/enrich-photo`, { method: 'POST' })
}

export async function enrichAllAuthorPhotos(): Promise<void> {
  await fetch(`${BASE}/authors/enrich-photos`, { method: 'POST' })
}

export async function mergeAuthors(authorIds: number[], newName: string): Promise<void> {
  const res = await fetch(`${BASE}/authors/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author_ids: authorIds, new_name: newName }),
  })
  if (!res.ok) throw new Error('Failed to merge authors')
}
