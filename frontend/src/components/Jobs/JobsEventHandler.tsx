/**
 * Mounts once at the app root. Subscribes to WS job events
 * and updates the JobsStore + fires toasts.
 */
import { useEffect } from 'react'
import { onWsEvent } from '@/hooks/useWebSocket'
import { updateJob } from './JobsStore'
import { toast } from '@/hooks/useToast'

function _jobCompletedDescription(type: string | undefined, summary: Record<string, unknown> | undefined): string {
  if (type === 'library_scan' || type === 'refresh_scan') {
    const added = summary?.added as number | undefined
    const updated = summary?.updated as number | undefined
    const removed = summary?.removed as number | undefined
    const parts: string[] = []
    if (added) parts.push(`${added} added`)
    if (updated) parts.push(`${updated} updated`)
    if (removed) parts.push(`${removed} removed`)
    return parts.length ? parts.join(', ') : 'Library is up to date.'
  }
  if (type === 'metadata_enrich') {
    const auto = summary?.auto_applied as number | undefined
    const review = summary?.review_needed as number | undefined
    const parts: string[] = []
    if (auto) parts.push(`${auto} enriched automatically`)
    if (review) parts.push(`${review} need review`)
    return parts.length ? parts.join(', ') + '.' : 'No new metadata found.'
  }
  return 'Finished successfully.'
}

export function JobsEventHandler() {
  useEffect(() => {
    const unsubs = [
      onWsEvent('job.started', ({ payload }) => {
        updateJob({
          id: payload.job_id as string,
          type: payload.type as string,
          label: payload.label as string,
          status: 'running',
          startedAt: new Date().toISOString(),
        })
      }),

      onWsEvent('job.progress', ({ payload }) => {
        updateJob({
          id: payload.job_id as string,
          message: payload.message as string | undefined,
          percent: payload.percent as number | undefined,
          status: 'running',
        })
      }),

      onWsEvent('job.completed', ({ payload }) => {
        const summary = payload.summary as Record<string, unknown> | undefined
        updateJob({
          id: payload.job_id as string,
          status: 'completed',
          summary,
          finishedAt: new Date().toISOString(),
          percent: 100,
        })
        toast({ title: 'Job completed', description: _jobCompletedDescription(payload.type as string | undefined, summary) })
      }),

      onWsEvent('job.failed', ({ payload }) => {
        updateJob({
          id: payload.job_id as string,
          status: 'failed',
          error: payload.error as string | undefined,
          finishedAt: new Date().toISOString(),
        })
        toast({
          variant: 'destructive',
          title: 'Job failed',
          description: (payload.error as string) ?? 'An unknown error occurred.',
        })
      }),

      // metadata.review_needed and metadata.enriched fire once per book —
      // suppress individual toasts; the sidebar badge reflects queue depth.

    ]

    return () => unsubs.forEach((fn) => fn())
  }, [])

  return null
}
