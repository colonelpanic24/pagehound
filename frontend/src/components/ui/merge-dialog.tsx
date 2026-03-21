import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface MergeItem {
  id: number
  name: string
  book_count: number
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  selected: Set<number>
  items: MergeItem[]
  entityLabel: string
  nameLabel: string
  queryKey: string
  onMerge: (ids: number[], name: string) => Promise<void>
  onMerged: () => void
}

export function MergeDialog({
  open,
  onOpenChange,
  selected,
  items,
  entityLabel,
  nameLabel,
  queryKey,
  onMerge,
  onMerged,
}: Props) {
  const selectedItems = items.filter((i) => selected.has(i.id))
  const defaultName =
    selectedItems.reduce(
      (best, i) => (i.book_count > (best?.book_count ?? -1) ? i : best),
      selectedItems[0]
    )?.name ?? ''

  const [name, setName] = useState(defaultName)

  const queryClient = useQueryClient()
  const { mutate, isPending } = useMutation({
    mutationFn: () => onMerge(Array.from(selected), name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] })
      onMerged()
      onOpenChange(false)
    },
  })

  const handleOpenChange = (v: boolean) => {
    if (v) setName(defaultName)
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Merge {entityLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Merging {selectedItems.length} {entityLabel.toLowerCase()}. All their books will be reassigned to the new name.
            </p>
            <ul className="text-sm space-y-1 border border-border rounded-md px-3 py-2 bg-muted/40 max-h-40 overflow-y-auto">
              {selectedItems.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span>{item.name}</span>
                  <span className="text-muted-foreground text-xs">{item.book_count} books</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="merge-name">{nameLabel}</Label>
            <Input
              id="merge-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={nameLabel}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutate()} disabled={isPending || !name.trim()}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
