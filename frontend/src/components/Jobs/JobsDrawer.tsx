import { X, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { useJobs, type Job, type JobStatus } from './JobsStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Props {
  open: boolean
  onClose: () => void
}

export function JobsDrawer({ open, onClose }: Props) {
  const jobs = useJobs()

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <div className="fixed bottom-8 left-0 right-0 z-50 mx-auto max-w-2xl rounded-t-xl border bg-card shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">Jobs</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y">
          {jobs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No recent jobs.</p>
          ) : (
            jobs.map((job) => <JobRow key={job.id} job={job} />)
          )}
        </div>
      </div>
    </>
  )
}

function JobRow({ job }: { job: Job }) {
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <JobIcon status={job.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{job.label}</span>
          <Badge variant={statusVariant(job.status)} className="text-xs shrink-0">
            {job.status}
          </Badge>
        </div>
        {job.message && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{job.message}</p>
        )}
        {job.percent != null && job.status === 'running' && (
          <div className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${job.percent}%` }}
            />
          </div>
        )}
        {job.error && (
          <p className="text-xs text-destructive mt-0.5">{job.error}</p>
        )}
        {job.summary && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {Object.entries(job.summary)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' · ')}
          </p>
        )}
      </div>
    </div>
  )
}

function JobIcon({ status }: { status: JobStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-primary shrink-0" />
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
    case 'failed':
      return <XCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
    default:
      return <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
  }
}

function statusVariant(status: JobStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'running': return 'default'
    case 'completed': return 'secondary'
    case 'failed': return 'destructive'
    default: return 'outline'
  }
}
