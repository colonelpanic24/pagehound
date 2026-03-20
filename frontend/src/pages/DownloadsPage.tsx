import { Download } from 'lucide-react'

export function DownloadsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
      <Download className="h-12 w-12 mb-4 opacity-30" />
      <h2 className="text-lg font-medium">Downloads</h2>
      <p className="text-sm mt-1">Download queue and history coming in Phase 4.</p>
    </div>
  )
}
