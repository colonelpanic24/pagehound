export interface SeriesSummary {
  id: number
  name: string
  description: string | null
  book_count: number
  cover_book_id: number
  cover_image_path: string | null
}

export interface SeriesDetail {
  id: number
  name: string
  description: string | null
  books: import('@/types').Book[]
}

const BASE = '/api'

export async function fetchSeriesList(): Promise<SeriesSummary[]> {
  const res = await fetch(`${BASE}/series/`)
  if (!res.ok) throw new Error('Failed to fetch series')
  return res.json()
}

export async function fetchSeriesDetail(id: number): Promise<SeriesDetail> {
  const res = await fetch(`${BASE}/series/${id}`)
  if (!res.ok) throw new Error(`Failed to fetch series ${id}`)
  return res.json()
}

export async function mergeSeries(seriesIds: number[], newName: string): Promise<void> {
  const res = await fetch(`${BASE}/series/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ series_ids: seriesIds, new_name: newName }),
  })
  if (!res.ok) throw new Error('Failed to merge series')
}
