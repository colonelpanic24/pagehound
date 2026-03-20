import type { Book, BookFilters } from '@/types'

const BASE = '/api'

export async function fetchBooks(filters: BookFilters = {}): Promise<Book[]> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  const res = await fetch(`${BASE}/books${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(`Failed to fetch books: ${res.statusText}`)
  return res.json() as Promise<Book[]>
}

export async function fetchBook(id: number): Promise<Book> {
  const res = await fetch(`${BASE}/books/${id}`)
  if (!res.ok) throw new Error(`Failed to fetch book ${id}: ${res.statusText}`)
  return res.json() as Promise<Book>
}

export async function fetchFormats(): Promise<string[]> {
  const res = await fetch(`${BASE}/books/formats`)
  if (!res.ok) throw new Error(`Failed to fetch formats: ${res.statusText}`)
  return res.json() as Promise<string[]>
}

export async function fetchLanguages(): Promise<string[]> {
  const res = await fetch(`${BASE}/books/languages`)
  if (!res.ok) throw new Error(`Failed to fetch languages: ${res.statusText}`)
  return res.json() as Promise<string[]>
}

export async function triggerScan(): Promise<{ job_id: string }> {
  const res = await fetch(`${BASE}/library/scan`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to trigger scan: ${res.statusText}`)
  return res.json() as Promise<{ job_id: string }>
}

export async function triggerRefresh(): Promise<{ job_id: string }> {
  const res = await fetch(`${BASE}/library/refresh`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to trigger refresh: ${res.statusText}`)
  return res.json() as Promise<{ job_id: string }>
}

export async function patchBook(id: number, fields: Partial<Book>): Promise<Book> {
  const res = await fetch(`${BASE}/books/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error(`Failed to patch book ${id}: ${res.statusText}`)
  return res.json() as Promise<Book>
}
