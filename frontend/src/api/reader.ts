export interface ReadingProgress {
  percent_complete: number
  position: string | null
}

export async function fetchProgress(bookId: number): Promise<ReadingProgress> {
  const res = await fetch(`/api/books/${bookId}/progress`)
  if (!res.ok) throw new Error('Failed to fetch progress')
  return res.json()
}

export async function saveProgress(
  bookId: number,
  percent_complete: number,
  position: string | null,
): Promise<void> {
  await fetch(`/api/books/${bookId}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ percent_complete, position }),
  })
}
