import type { SearchResult, DownloadItem } from '@/types'

const BASE = '/api/downloads'

export async function searchBooks(
  query: string,
  source = 'annas_archive',
  limit = 20,
): Promise<SearchResult[]> {
  const res = await fetch(`${BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, source, limit }),
  })
  if (!res.ok) throw new Error(`Search failed: ${res.statusText}`)
  const data = await res.json()
  return data.results as SearchResult[]
}

export async function enqueueDownload(result: SearchResult): Promise<DownloadItem> {
  const res = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: result.title,
      authors: result.authors,
      file_format: result.file_format,
      file_size_bytes: result.file_size_bytes,
      source: result.source,
      source_id: result.id,
      cover_url: result.cover_url,
    }),
  })
  if (!res.ok) throw new Error(`Enqueue failed: ${res.statusText}`)
  return res.json()
}

export async function fetchDownloads(): Promise<DownloadItem[]> {
  const res = await fetch(`${BASE}/`)
  if (!res.ok) throw new Error(`Failed to fetch downloads: ${res.statusText}`)
  return res.json()
}
