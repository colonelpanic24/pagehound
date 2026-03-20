import { BookCard } from './BookCard'
import type { Book, GroupBy } from '@/types'

interface Props {
  books: Book[]
  groupBy: GroupBy
  onBookClick?: (book: Book) => void
}

function GridLayout({ books, onBookClick }: { books: Book[]; onBookClick?: (book: Book) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {books.map((book) => (
        <BookCard key={book.id} book={book} onClick={() => onBookClick?.(book)} />
      ))}
    </div>
  )
}

function getGroupKey(book: Book, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'author':
      return book.authors.length > 0 ? book.authors[0].name : 'Unknown Author'
    case 'series':
      return book.series ? book.series.name : 'No Series'
    case 'format':
      return book.file_format.toUpperCase()
    case 'language':
      return book.language ?? 'Unknown Language'
    default:
      return ''
  }
}

export function BookGrid({ books, groupBy, onBookClick }: Props) {
  if (groupBy === 'none') {
    return <GridLayout books={books} onBookClick={onBookClick} />
  }

  // Group books
  const groupMap = new Map<string, Book[]>()
  for (const book of books) {
    const key = getGroupKey(book, groupBy)
    const existing = groupMap.get(key) ?? []
    existing.push(book)
    groupMap.set(key, existing)
  }

  // Sort groups alphabetically
  const sortedGroups = Array.from(groupMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  )

  return (
    <div className="space-y-8">
      {sortedGroups.map(([groupName, groupBooks]) => (
        <section key={groupName}>
          <h2 className="text-base font-semibold mb-3 text-foreground border-b border-border pb-1">
            {groupName}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({groupBooks.length})
            </span>
          </h2>
          <GridLayout books={groupBooks} onBookClick={onBookClick} />
        </section>
      ))}
    </div>
  )
}
