import type { Book, MetadataReview } from '@/types'

const BASE = '/api/metadata'

export async function fetchReviewQueue(status = 'pending'): Promise<MetadataReview[]> {
  const res = await fetch(`${BASE}/review?status=${status}`)
  if (!res.ok) throw new Error(`Failed to fetch review queue: ${res.statusText}`)
  return res.json()
}

export async function approveReview(
  id: number,
  fields?: Record<string, unknown>,
): Promise<{ ok: boolean; book: Book }> {
  const res = await fetch(`${BASE}/review/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields !== undefined ? { fields } : null),
  })
  if (!res.ok) throw new Error(`Failed to approve review: ${res.statusText}`)
  return res.json()
}

export async function rejectReview(id: number): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/review/${id}/reject`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to reject review: ${res.statusText}`)
  return res.json()
}

export async function triggerEnrich(bookId: number): Promise<{ queued: boolean }> {
  const res = await fetch(`${BASE}/enrich/${bookId}`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to enrich book: ${res.statusText}`)
  return res.json()
}

export async function triggerEnrichAll(): Promise<{ job_id: string; queued: number }> {
  const res = await fetch(`${BASE}/enrich-all`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to trigger enrich-all: ${res.statusText}`)
  return res.json()
}
