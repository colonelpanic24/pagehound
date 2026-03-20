import { Search } from 'lucide-react'

export function SearchPage() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
      <Search className="h-12 w-12 mb-4 opacity-30" />
      <h2 className="text-lg font-medium">Search</h2>
      <p className="text-sm mt-1">Anna's Archive search coming in Phase 4.</p>
    </div>
  )
}
