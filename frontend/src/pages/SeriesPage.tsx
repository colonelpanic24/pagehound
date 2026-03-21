import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Layers, CheckSquare, Square, GitMerge } from 'lucide-react'
import { fetchSeriesList, mergeSeries } from '@/api/series'
import { Button } from '@/components/ui/button'
import { MergeDialog } from '@/components/ui/merge-dialog'
import type { SeriesSummary } from '@/api/series'

function SeriesCard({
  series,
  selectable,
  selected,
  onToggle,
  onClick,
}: {
  series: SeriesSummary
  selectable: boolean
  selected: boolean
  onToggle: () => void
  onClick: () => void
}) {
  return (
    <div
      onClick={selectable ? onToggle : onClick}
      className={`group flex flex-col rounded-lg border bg-card text-card-foreground overflow-hidden cursor-pointer transition-colors ${selected ? 'ring-2 ring-primary border-primary' : 'hover:border-ring'}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        {series.cover_image_path ? (
          <img
            src={`/covers/${series.cover_book_id}.jpg`}
            alt={series.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Layers className="h-10 w-10 text-muted-foreground opacity-30" />
          </div>
        )}
        {selectable && (
          <div className="absolute top-1.5 left-1.5 bg-background/90 rounded p-0.5">
            {selected ? (
              <CheckSquare className="h-5 w-5 text-primary" strokeWidth={2.5} />
            ) : (
              <Square className="h-5 w-5 text-muted-foreground/70" strokeWidth={2.5} />
            )}
          </div>
        )}
      </div>
      <div className="p-2 flex flex-col gap-0.5">
        <p className="text-sm font-medium leading-tight line-clamp-2">{series.name}</p>
        <p className="text-xs text-muted-foreground">
          {series.book_count} {series.book_count === 1 ? 'book' : 'books'}
        </p>
      </div>
    </div>
  )
}


export function SeriesPage() {
  const navigate = useNavigate()
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [mergeOpen, setMergeOpen] = useState(false)

  const { data: series = [], isLoading } = useQuery({
    queryKey: ['series'],
    queryFn: fetchSeriesList,
  })

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
          <h1 className="text-xl font-semibold">Series</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{series.length} series in your library</p>
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
            <button
              onClick={() => setSelectMode(true)}
              className="h-5 w-5 rounded border-2 border-muted-foreground/50 hover:border-foreground transition-colors flex items-center justify-center"
              aria-label="Enable selection"
            />
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : series.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No series found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
            {series.map((s) => (
              <SeriesCard
                key={s.id}
                series={s}
                selectable={selectMode}
                selected={selected.has(s.id)}
                onToggle={() => toggleSelect(s.id)}
                onClick={() => navigate(`/series/${s.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <MergeDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        selected={selected}
        items={series}
        entityLabel="Series"
        nameLabel="Merged series name"
        queryKey="series"
        onMerge={(ids, name) => mergeSeries(ids, name)}
        onMerged={exitSelectMode}
      />
    </div>
  )
}
