import { useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Users, Sparkles, Loader2, CheckSquare, Square, GitMerge } from 'lucide-react'
import { fetchAuthorList, enrichAllAuthorPhotos, mergeAuthors } from '@/api/authors'
import { Button } from '@/components/ui/button'
import { AvatarWithInitials } from '@/components/ui/avatar-initials'
import { MergeDialog } from '@/components/ui/merge-dialog'

export function AuthorsPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)

  const { data: authors = [], isLoading } = useQuery({
    queryKey: ['authors'],
    queryFn: fetchAuthorList,
  })

  const { mutate: enrichAll, isPending: isEnriching } = useMutation({
    mutationFn: enrichAllAuthorPhotos,
  })

  const { grouped, letters } = useMemo(() => {
    const grouped: Record<string, typeof authors> = {}
    for (const a of authors) {
      const letter = a.sort_name[0]?.toUpperCase() ?? '#'
      ;(grouped[letter] ??= []).push(a)
    }
    return { grouped, letters: Object.keys(grouped).sort() }
  }, [authors])

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Authors</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{authors.length} authors in your library</p>
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <span className="text-sm text-muted-foreground">{selected.size} selected</span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={selected.size < 2}
                onClick={() => setMergeOpen(true)}
              >
                <GitMerge className="h-3.5 w-3.5" />
                Merge
              </Button>
              <Button size="sm" variant="ghost" onClick={exitSelectMode}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                onClick={() => enrichAll()}
                disabled={isEnriching}
              >
                {isEnriching
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Sparkles className="h-4 w-4" />}
                Enrich photos
              </Button>
              <button
                onClick={() => setSelectMode(true)}
                className="h-5 w-5 rounded border-2 border-muted-foreground/50 hover:border-foreground transition-colors flex items-center justify-center"
                aria-label="Enable selection"
              />
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : authors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No authors found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {letters.map((letter) => (
              <section key={letter}>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{letter}</p>
                <div className="flex flex-col divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {grouped[letter].map((author) => (
                    <div
                      key={author.id}
                      onClick={() => {
                        if (selectMode) toggleSelect(author.id)
                        else navigate(`/authors/${author.id}`)
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 bg-card hover:bg-muted transition-colors cursor-pointer"
                    >
                      {selectMode && (
                        <span className="shrink-0">
                          {selected.has(author.id) ? (
                            <CheckSquare className="h-5 w-5 text-primary" strokeWidth={2.5} />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground/70" strokeWidth={2.5} />
                          )}
                        </span>
                      )}
                      <AvatarWithInitials name={author.name} photoUrl={author.photo_url} size="sm" />
                      <span className="text-sm font-medium flex-1">{author.name}</span>
                      <span className="text-xs text-muted-foreground ml-4 shrink-0">
                        {author.book_count} {author.book_count === 1 ? 'book' : 'books'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <MergeDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        selected={selected}
        items={authors}
        entityLabel="Authors"
        nameLabel="Merged author name"
        queryKey="authors"
        onMerge={(ids, name) => mergeAuthors(ids, name)}
        onMerged={exitSelectMode}
      />
    </div>
  )
}
