/**
 * Mounts once at the app root. Subscribes to WS job events
 * and updates the JobsStore + fires toasts.
 */
import { useEffect } from 'react'
import { onWsEvent } from '@/hooks/useWebSocket'
import { updateJob } from './JobsStore'
import { toast } from '@/hooks/useToast'

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
        updateJob({
          id: payload.job_id as string,
          status: 'completed',
          summary: payload.summary as Record<string, unknown> | undefined,
          finishedAt: new Date().toISOString(),
          percent: 100,
        })
        toast({ title: 'Job completed', description: `Job ${payload.job_id} finished successfully.` })
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
          description: (payload.error as string) ?? `Job ${payload.job_id} failed.`,
        })
      }),

      onWsEvent('metadata.review_needed', ({ payload }) => {
        toast({
          title: 'Metadata review needed',
          description: `Book ${payload.book_id} needs metadata review.`,
        })
      }),
    ]

    return () => unsubs.forEach((fn) => fn())
  }, [])

  return null
}
