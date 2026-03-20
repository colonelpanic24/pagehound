/**
 * Lightweight reactive store for job state.
 * Updated directly by WebSocket events — no polling.
 */
import { useState, useEffect } from 'react'

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface Job {
  id: string
  type: string
  label: string
  status: JobStatus
  message?: string
  percent?: number
  summary?: Record<string, unknown>
  error?: string
  startedAt?: string
  finishedAt?: string
}

let jobs: Map<string, Job> = new Map()
const listeners: Set<() => void> = new Set()

function notify() {
  listeners.forEach((fn) => fn())
}

export function updateJob(patch: Partial<Job> & { id: string }) {
  const existing = jobs.get(patch.id) ?? { id: patch.id, type: '', label: '', status: 'pending' as JobStatus }
  jobs = new Map(jobs)
  jobs.set(patch.id, { ...existing, ...patch })
  notify()
}

export function getJobs(): Job[] {
  return Array.from(jobs.values()).sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
}

export function getActiveJobs(): Job[] {
  return getJobs().filter((j) => j.status === 'running' || j.status === 'pending')
}

export function useJobs(): Job[] {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const fn = () => forceUpdate((n) => n + 1)
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])
  return getJobs()
}

export function useActiveJobs(): Job[] {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const fn = () => forceUpdate((n) => n + 1)
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])
  return getActiveJobs()
}
