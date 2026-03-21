export interface Author {
  id: number
  name: string
  sort_name: string
}

export interface Series {
  id: number
  name: string
}

export interface Book {
  id: number
  title: string
  sort_title: string
  subtitle: string | null
  description: string | null
  isbn_10: string | null
  isbn_13: string | null
  publisher: string | null
  published_date: string | null
  language: string | null
  page_count: number | null
  cover_image_path: string | null
  file_path: string
  file_format: string
  file_size: number | null
  added_date: string
  modified_date: string
  metadata_source: string | null
  metadata_confidence: number | null
  series_id: number | null
  series_index: number | null
  is_read: boolean
  is_missing: boolean
  rating: number | null
  authors: Author[]
  series: Series | null
  tags: string[]
}

export interface BookFilters {
  format?: string
  language?: string
  is_read?: boolean
  series_id?: number
  author_id?: number
  q?: string
  sort?: string
  sort_dir?: 'asc' | 'desc'
}

export type ViewMode = 'grid' | 'list'
export type GroupBy = 'none' | 'author' | 'series' | 'language'

export interface MetadataCandidate {
  source: string
  title: string | null
  subtitle: string | null
  authors: string[]
  description: string | null
  isbn_10: string | null
  isbn_13: string | null
  publisher: string | null
  published_date: string | null
  language: string | null
  page_count: number | null
  cover_url: string | null
  confidence: number
}

export interface ReviewBook {
  id: number
  title: string
  subtitle: string | null
  description: string | null
  isbn_10: string | null
  isbn_13: string | null
  publisher: string | null
  published_date: string | null
  language: string | null
  page_count: number | null
  cover_image_path: string | null
  metadata_source: string | null
  metadata_confidence: number | null
  authors: { id: number; name: string }[]
}

export interface MetadataReview {
  id: number
  book_id: number
  status: 'pending' | 'approved' | 'rejected'
  candidates: MetadataCandidate[]
  suggested_fields: Partial<Record<keyof Book, unknown>>
  suggested_confidence: number
  created_at: string
  reviewed_at: string | null
  book: ReviewBook
}

export interface SearchResult {
  id: string
  title: string
  authors: string[]
  file_format: string | null
  file_size_bytes: number | null
  file_size_str: string | null
  language: string | null
  publisher: string | null
  year: string | null
  source: string
  cover_url: string | null
  description: string | null
  extra: Record<string, unknown>
}

export interface KoboDevice {
  id: number
  name: string
  auth_token: string
  device_id: string | null
  last_synced: string | null
  created_at: string
  sync_url: string
}

export interface DownloadItem {
  id: number
  title: string
  authors: string
  file_format: string | null
  file_size_bytes: number | null
  source: string
  source_id: string
  status: 'queued' | 'downloading' | 'done' | 'failed'
  progress: number
  file_path: string | null
  error: string | null
  cover_url: string | null
  created_at: string
  updated_at: string
  book_id: number | null
}
