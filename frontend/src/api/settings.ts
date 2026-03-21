export interface AppSettings {
  books_dir: string
  base_url: string
  auto_apply_threshold: number
  metadata_strategy: string
  preferred_source: string
  google_books_api_key_set: boolean
  kobo_enabled: boolean
  opds_enabled: boolean
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch('/api/library/settings')
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}
