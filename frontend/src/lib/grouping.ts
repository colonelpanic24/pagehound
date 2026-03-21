import type { Book, GroupBy } from '@/types'

const _ARTICLES = new Set(['the', 'a', 'an'])

export function groupSortKey(name: string): string {
  const space = name.indexOf(' ')
  if (space > 0 && _ARTICLES.has(name.slice(0, space).toLowerCase())) return name.slice(space + 1)
  return name
}

export function getGroupKey(book: Book, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'author': return book.authors[0]?.name ?? 'Unknown Author'
    case 'series': return book.series?.name ?? 'No Series'
    case 'language': return book.language ?? 'Unknown Language'
    default: return ''
  }
}
