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
export type GroupBy = 'none' | 'author' | 'series' | 'format' | 'language'
