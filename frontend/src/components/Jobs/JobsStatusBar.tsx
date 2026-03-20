import { useState } from 'react'
import { Loader2, ChevronUp } from 'lucide-react'
import { useActiveJobs } from './JobsStore'
import { JobsDrawer } from './JobsDrawer'
import { useWsStatus } from '@/hooks/useWebSocket'
import { cn } from '@/lib/utils'

export function JobsStatusBar() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const activeJobs = useActiveJobs()
  const wsStatus = useWsStatus()

  const latestJob = activeJobs[0]

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-40 h-8 flex items-center justify-between px-4 border-t bg-muted/80 backdrop-blur-sm text-muted-foreground text-xs cursor-pointer hover:bg-muted transition-colors"
        onClick={() => setDrawerOpen(true)}
      >
        {/* Left: active job status */}
        <div className="flex items-center gap-2 min-w-0">
          {latestJob ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              <span className="truncate">{latestJob.message ?? latestJob.label}</span>
              {latestJob.percent != null && (
                <span className="shrink-0 tabular-nums">{latestJob.percent}%</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground/60">No active jobs</span>
          )}
        </div>

        {/* Right: WS status + drawer toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <WsIndicator status={wsStatus} />
          <ChevronUp className="h-3 w-3" />
        </div>
      </div>

      <JobsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}

function WsIndicator({ status }: { status: 'connected' | 'connecting' | 'disconnected' }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full',
          status === 'connected' && 'bg-green-500',
          status === 'connecting' && 'bg-yellow-400 animate-pulse',
          status === 'disconnected' && 'bg-red-500'
        )}
      />
      <span className="hidden sm:inline">{status}</span>
    </span>
  )
}
